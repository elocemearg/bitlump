/* Functions for parsing timestamps and doing calendar-related things. */

const JULIAN_DATE_OF_UNIX_EPOCH = 2440588.0 - 0.5;
const fullMonthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const monthNames = {
    "jan" : 1, "feb" : 2, "mar" : 3, "apr" : 4, "may" : 5, "jun" : 6,
    "jul" : 7, "aug" : 8, "sep" : 9, "oct" : 10, "nov" : 11, "dec" : 12
};

const weekDayNames = [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ];
function weekDayName(n) {
    return weekDayNames[n];
}

const timestampPatterns = [
    /* ISO timestamp patterns: year-month-day hour:minute:second */
    {
        "regex": /([A-Za-z]+)?,?\s*(\d+)-(\d+)-(\d+)(\s+|T)(\d+):(\d+):(\d+)\.(\d+)(\s*[+-]?\d{4})?/,
        "fieldnames" : [ "weekday", "year", "month", "day", "dummy", "hour", "minute", "second", "subsecond", "tz" ]
    },
    {
        "regex": /([A-Za-z]+)?,?\s*(\d+)-(\d+)-(\d+)(\s+|T)(\d+):(\d+):(\d+)(\s*[+-]?\d{4})?/,
        "fieldnames" : [ "weekday", "year", "month", "day", "dummy", "hour", "minute", "second", "tz" ]
    },
    {
        "regex": /([A-Za-z]+)?,?\s*(\d+)-(\d+)-(\d+)(\s+|T)(\d+):(\d+)(\s*[+-]?\d{4})?/,
        "fieldnames" : [ "weekday", "year", "month", "day", "dummy", "hour", "minute", "tz" ]
    },
    {
        "regex": /([A-Za-z]+)?,?\s*(\d+)-(\d+)-(\d+)(\s+|T)(\d+)(\s*[+-]?\d{4})?/,
        "fieldnames" : [ "weekday", "year", "month", "day", "dummy", "hour", "tz" ]
    },
    {
        "regex": /([A-Za-z]+)?,?\s*(\d+)-(\d+)-(\d+)/,
        "fieldnames" : [ "weekday", "year", "month", "day" ]
    },
    {
        "regex": /([A-Za-z]+)?,?\s*(\d+)-(\d+)/,
        "fieldnames" : [ "weekday", "year", "month" ]
    },

    /* RFC 822 timestamp patterns:
     * [Weekday,] dd mmm yyyy hh:mm:ss [tz] */
    {
        "regex": /([A-Za-z]+)?,?\s*(\d+)\s+([A-Za-z]+)\s+(\d+)\s+(\d+):(\d+):(\d+)(?:\.(\d+))?(\s*[+-]?\d{4})?/,
        "fieldnames" : [ "weekday", "day", "monthname", "year", "hour", "minute", "second", "subsecond", "tz" ]
    },
    {
        "regex": /([A-Za-z]+)?,?\s*(\d+)\s+([A-Za-z]+)\s+(\d+)\s+(\d+):(\d+)(\s*[+-]?\d{4})?/,
        "fieldnames" : [ "weekday", "day", "monthname", "year", "hour", "minute", "tz" ]
    },
    {
        "regex": /([A-Za-z]+)?,?\s*(\d+)\s+([A-Za-z]+)\s+(\d+)\s+(\d+)(\s*[+-]?\d{4})?/,
        "fieldnames" : [ "weekday", "day", "monthname", "year", "hour", "tz" ]
    },
    {
        "regex": /([A-Za-z]+)?,?\s*(\d+)\s+([A-Za-z]+)\s+(\d+)/,
        "fieldnames" : [ "weekday", "day", "monthname", "year", "tz" ]
    },

    /* "Weekday monthname monthdate year" patterns */
    {
        "regex": /([A-Za-z]+)[ ,]+([A-Za-z]+)\s+(\d+)[ ,]+(\d+)\s+(\d+):(\d+):(\d+)(?:\.(\d+))?(\s*[+-]?\d{4})?/,
        "fieldnames" : [ "weekday", "monthname", "day", "year", "hour", "minute", "second", "subsecond", "tz" ]
    },
    {
        "regex": /([A-Za-z]+)[ ,]+([A-Za-z]+)\s+(\d+)[ ,]+(\d+)\s+(\d+):(\d+)(\s*[+-]?\d{4})?/,
        "fieldnames" : [ "weekday", "monthname", "day", "year", "hour", "minute", "tz" ]
    },
    {
        "regex": /([A-Za-z]+)[ ,]+([A-Za-z]+)\s+(\d+)[ ,]+(\d+)\s+(\d+)(\s*[+-]?\d{4})?/,
        "fieldnames" : [ "weekday", "monthname", "day", "year", "hour", "tz" ]
    },
    {
        "regex": /([A-Za-z]+)[ ,]+([A-Za-z]+)\s+(\d+)[ ,]+(\d+)/,
        "fieldnames" : [ "weekday", "monthname", "day", "year" ]
    },

    /* "Monthname monthdate year" patterns */
    {
        "regex": /([A-Za-z]+)\s+(\d+)[ ,]+(\d+)\s+(\d+):(\d+):(\d+)(?:\.(\d+))?(\s*[+-]?\d{4})?/,
        "fieldnames" : [ "monthname", "day", "year", "hour", "minute", "second", "subsecond", "tz" ]
    },
    {
        "regex": /([A-Za-z]+)\s+(\d+)[ ,]+(\d+)\s+(\d+):(\d+)(\s*[+-]?\d{4})?/,
        "fieldnames" : [ "monthname", "day", "year", "hour", "minute", "tz" ]
    },
    {
        "regex": /([A-Za-z]+)\s+(\d+)[ ,]+(\d+)\s+(\d+)(\s*[+-]?\d{4})?/,
        "fieldnames" : [ "monthname", "day", "year", "hour", "tz" ]
    },
    {
        "regex": /([A-Za-z]+)\s+(\d+)[ ,]+(\d+)/,
        "fieldnames" : [ "monthname", "day", "year" ]
    },
];

function parseTimestampPattern(pattern, input) {
    let text = input.trim();
    let m = text.match(pattern.regex);

    /* We must match the pattern, and the pattern must match the whole string */
    if (m == null || m[0] != text)
        return null;

    let fields = {};
    for (let i = 0; i < pattern.fieldnames.length; i++) {
        if (m[i + 1] != null) {
            fields[pattern.fieldnames[i]] = m[i + 1];
        }
    }
    return fields;
}

function monthNameToNumber(name) {
    let shortName = name.toLowerCase().substr(0, 3);
    if (shortName in monthNames)
        return monthNames[shortName];
    else
        return null;
}

function parseTimestamp(text) {
    /* Split into words separated by whitespace */
    let fields = null;

    for (let patternIndex = 0; patternIndex < timestampPatterns.length; patternIndex++) {
        let pat = timestampPatterns[patternIndex];

        /* Use the first pattern which completely matches the string */
        fields = parseTimestampPattern(pat, text);
        if (fields != null) {
            break;
        }
    }

    if (fields == null)
        return null;

    let convertedFields = {};
    for (let fieldName in fields) {
        switch (fieldName) {
            case "year":
            case "month":
            case "day":
            case "hour":
            case "minute":
            case "second":
                convertedFields[fieldName] = parseInt(fields[fieldName]);
                break;
            case "monthname":
                let monthNumber = monthNameToNumber(fields[fieldName]);
                if (monthNumber == null)
                    return null;
                convertedFields["month"] = monthNumber;
                break;
            case "subsecond":
                /* Convert this to milliseconds */
                let numDigits = fields[fieldName].length;
                let subsecond = parseInt(fields[fieldName]);
                while (numDigits < 3) {
                    numDigits++;
                    subsecond *= 10;
                }
                while (numDigits > 3) {
                    numDigits--;
                    subsecond = Math.floor(subsecond / 10);
                }
                convertedFields["millisecond"] = subsecond;
                break;
            case "tz":
                let tzInt = parseInt(fields[fieldName]);
                let tzMin = 0;
                let tzHour = 0;
                let tzTotalMinutes = 0;
                let tzMinus = false;
                if (!isNaN(tzInt)) {
                    /* Convert e.g. +0130 into 1 hour 30 minutes */
                    tzMinus = (tzInt < 0);
                    tzInt = Math.abs(tzInt);
                    tzHour = Math.floor(tzInt / 100);
                    tzMin = tzInt % 100;
                }
                tzTotalMinutes = tzHour * 60 + tzMin;
                if (tzMinus)
                    tzTotalMinutes = -tzTotalMinutes;
                convertedFields["tzMinutes"] = tzTotalMinutes;
                break;
            default:
                convertedFields[fieldName] = fields[fieldName];
        }
    }

    return convertedFields;
}

function fillTimestamp(timestamp) {
    if (timestamp == null)
        return null;

    const fieldDefaults = {
        "month" : 1,
        "day" : 1,
        "hour" : 0,
        "minute" : 0,
        "second" : 0,
        "millisecond" : 0,
        "tzMinutes" : null /* if no time zone given, assume local time */
    };

    let filledTimestamp = {};
    for (let fieldName in timestamp) {
        filledTimestamp[fieldName] = timestamp[fieldName];
    }
    for (let fieldName in fieldDefaults) {
        if (timestamp[fieldName] == null) {
            filledTimestamp[fieldName] = fieldDefaults[fieldName];
        }
    }
    return filledTimestamp;
}

function getMonthStartWeekday(year, month) {
    let d = new Date(year, month, 1);
    d.setUTCFullYear(year);
    d.setUTCMonth(month - 1);
    d.setUTCDate(1);
    d.setUTCHours(12);
    d.setUTCMinutes(0);
    d.setUTCSeconds(0);
    d.setUTCMilliseconds(0);
    /* Shift day of week so 0 = Monday, 1 = Tuesday, ... */
    return (d.getUTCDay() + 6) % 7
}

function getDaysInMonth(year, month) {
    if (month == 2) {
        if (year % 4 == 0 && !(year % 100 == 0 && year % 400 != 0))
            return 29;
        else
            return 28;
    }
    else if (month == 4 || month == 6 || month == 9 || month == 11)
        return 30;
    else
        return 31;
}
