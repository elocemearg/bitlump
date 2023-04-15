
/* conversion name -> Conversion */
let conversions = {};

function isHexInteger(input) {
    return input.match(/^ *0x[0-9a-fA-F]+ *$/) != null;
}

function leftPad(s, padChar, desiredLength) {
    let numPads = desiredLength - s.length;
    if (numPads > 0) {
        return Array(numPads).fill(padChar).join("") + s;
    }
    else {
        return s;
    }
}

function intToHex(i, fieldWidth=0) {
    return leftPad(i.toString(16).toUpperCase(), '0', fieldWidth);
}

function setFlagActive(flags, name, active) {
    if (name in flags) {
        if (active)
            flags[name].classList.add("flagactive");
        else
            flags[name].classList.remove("flagactive");
    }
}

const fractionValues = {
    0xBC: 1/4, /* ¼ */
    0xBD: 1/2, /* ½ */
    0xBE: 3/4,  /* ¾ */
    0x2150: 1/7,
    0x2151: 1/9,
    0x2152: 1/10,
    0x2153: 1/3,
    0x2154: 2/3,
    0x2155: 1/5,
    0x2156: 2/5,
    0x2157: 3/5,
    0x2158: 4/5,
    0x2159: 1/6,
    0x215A: 5/6,
    0x215B: 1/8,
    0x215C: 3/8,
    0x215D: 5/8,
    0x215E: 7/8,
    0x2189: 0 /* 0/3 */
};
const simpleFractionRegex = /^([0-9]*)\s*(.)$/;
const oneOverDenomRegex = /^([0-9]*)\s*\u215f([0-9]+)$/; // U+215F: one-over...
const intNumDenomRegex = /^([0-9]+)\s+([0-9]+)[\u2044\/]([0-9]+)$/; // U+2044: fraction slash
const numDenomRegex = /^([0-9]+)[\u2044\/]([0-9]+)$/;

/* Try to parse text as a fractional number matching any of the four regexes
 * above. Return a floating-point number or null. */
function parseFraction(text) {
    let fractionValue = null;
    let minus = false;
    let integerPart = null;
    let fractionPart = null;

    text = text.trim();
    if (text.charAt(0) == '-') {
        minus = true;
        text = text.substr(1);
    }

    let m;
    if ((m = text.match(simpleFractionRegex)) != null) {
        /* An optional integer followed by a single fraction character such
         * as ½ */
        let f = m[2];
        integerPart = (m[1].length == 0 ? 0 : parseInt(m[1]));
        f = m[2].codePointAt(0);
        if (f in fractionValues) {
            fractionPart = fractionValues[f];
        }
        else {
            return null;
        }
        return (integerPart + fractionPart) * (minus ? -1 : 1);
    }
    else if ((m = text.match(oneOverDenomRegex)) != null) {
        /* An optional integer, followed by U+215F ("1/") followed by a
         * positive integer denominator. */
        let d = parseInt(m[2]);
        integerPart = (m[1].length == 0 ? 0 : parseInt(m[1]));
        if (isNaN(d) || d == 0)
            return null;
        fractionPart = 1.0 / d;
    }
    else if ((m = text.match(intNumDenomRegex)) != null) {
        /* An integer, followed by at least one space, followed by a
         * non-negative integer numerator, then U+2044 (fraction slash) or
         * U+002F (ordinary slash), then a positive integer denominator. */
        let n = parseInt(m[2]);
        let d = parseInt(m[3]);
        integerPart = parseInt(m[1]);
        if (isNaN(n) || isNaN(d) || d == 0)
            return null;
        fractionPart = n / d;
    }
    else if ((m = text.match(numDenomRegex)) != null) {
        /* The same as above but without the leading integer. Numerator
         * followed by slash followed by denominator. */
        let n = parseInt(m[1]);
        let d = parseInt(m[2]);
        integerPart = 0;
        if (isNaN(n) || isNaN(d) || d == 0)
            return null;
        fractionPart = n / d;
    }

    if (isNaN(integerPart) || integerPart == null || fractionPart == null)
        return null;

    return (integerPart + fractionPart) * (minus ? -1 : 1);
}

class InputValue {
    constructor(text) {
        this.text = text;

        /* Before parsing as a number, change any minus signs to plain old
         * hyphens and lose leading and trailing spaces. */
        text = text.trim().replace("−", "-");

        /* Put the value into a binary integer */
        this.binaryIntValue = createBinaryIntFromString(text, 8, text.startsWith("-"));

        if (this.binaryIntValue != null) {
            this.intValue = this.binaryIntValue.getJSInt();
        }
        else {
            this.intValue = null;
        }

        /* Try to parse as a float */
        if (text.trim().length > 0) {
            /* Try to parse as a JavaScript number */
            this.floatValue = Number(text);

            /* If it's not that, then maybe it's some sort of fancy fraction */
            if (isNaN(this.floatValue)) {
                this.floatValue = parseFraction(text);
            }

            /* What about infinity? */
            if (this.floatValue == null) {
                if (text == "∞")
                    this.floatValue = Infinity;
                else if (text == "-∞")
                    this.floatValue = -Infinity;
            }
        }
        else
            this.floatValue = null;
    }

    getBinaryInt() {
        return this.binaryIntValue;
    }

    /* Format a supplied BinaryInt the same way this one is formatted. */
    formatBinaryInt(binaryInt) {
        if (this.isHexInteger()) {
            return "0x" + binaryInt.formatHex(false);
        }
        else {
            return binaryInt.formatDecimal();
        }
    }

    isInteger() {
        return this.intValue != null && !isNaN(this.intValue);
    }

    isHexInteger() {
        return isHexInteger(this.text);
    }

    isFloat() {
        return this.floatValue != null && !isNaN(this.floatValue);
    }

    getInteger() {
        return this.intValue;
    }

    getFloat() {
        return this.floatValue;
    }

    getText() {
        return this.text;
    }
}

class Conversion {
    constructor(inputTypeName, name, func) {
        this.inputTypeName = inputTypeName;
        this.name = name;
        this.func = func;
    }

    getName() {
        return this.name;
    }

    getInputTypeName() {
        return this.inputTypeName;
    }

    /* Converts inputValue to whatever the output should be and puts that in
     * outputElement if the conversion is successful.
     * Returns true if the conversion was successful and false otherwise. */
    convert(inputValue, params, outputFlags, outputElement) {
        return this.func(inputValue, params, outputFlags, outputElement);
    }
}

class StringConversion extends Conversion {
    constructor(inputTypeName, name, func) {
        super(inputTypeName, name,
            function (inputValue, params, outputFlags, outputElement) {
                if (outputElement) {
                    let outputValue = func(inputValue, params, outputFlags);
                    if (outputValue === null) {
                        outputElement.innerHTML = "&nbsp;";
                        return false;
                    }
                    else {
                        outputElement.innerText = outputValue;
                        return true;
                    }
                }
                else {
                    return false;
                }
            }
        );
    }
}

/* Create a Conversion object.
 * func returns the output as a string rather than putting it into an HTML
 * element itself. The Conversion object we create will deal with putting the
 * result into an element. */
function createStringConversion(categoryName, conversionName, func) {
    let conversion = new StringConversion(categoryName, conversionName, func);
    conversions[conversionName] = conversion;
}

function createConversionFromBinaryInt(conversionName, func) {
    return createStringConversion("binaryint", conversionName,
        function(inputValue, params, outputFlags) {
            let b = inputValue.getBinaryInt();
            if (b == null)
                return null;
            return func(b, inputValue, params, outputFlags);
        }
    );
}

function createConversionFromFloat(conversionName, func) {
    return createStringConversion("float", conversionName,
        function(inputValue, params, flags) {
            if (inputValue.isFloat())
                return func(inputValue.getFloat(), inputValue, params, flags);
            else
                return null;
        }
    );
}

function getConversion(conversionName) {
    return conversions[conversionName];
}

function convertInt(inputValue, signed, bits) {
    let binaryInt = createBinaryIntFromString(inputValue.getText(), Math.floor(bits / 8), signed);

    if (binaryInt == null)
        return null;

    if (inputValue.isHexInteger()) {
        /* Format the answer in base 10 */
        return binaryInt.formatDecimal();
    }
    else {
        if (signed) {
            /* Format the answer in hex */
            return "0x" + binaryInt.formatHex();
        }
        else {
            /* Format the answer in hex if positive, unsigned decimal if negative */
            if (binaryInt.isNegative()) {
                return binaryInt.formatDecimal();
            }
            else {
                return "0x" + binaryInt.formatHex();
            }
        }
    }
}

function hexByteString(bytes) {
    let resultString = "";
    for (let i = 0; i < bytes.length; i++) {
        let b = bytes[i];
        if (i > 0)
            resultString += " ";
        resultString += HEX_DIGITS[b >> 4];
        resultString += HEX_DIGITS[b & 15];
    }
    return resultString;
}

function floatOrNull(inputValue, func) {
    if (inputValue.isFloat()) {
        return func(inputValue.getFloat());
    }
    else {
        return null;
    }
}

function getFloatSign(f, fBits) {
    if (fBits == 32)
        return createBinaryIntFromFloat32Bin(f).getBit(31);
    else if (fBits == 64)
        return createBinaryIntFromFloat64Bin(f).getBit(63);
    else
        throw new Error("getFloatSign() called with fBits=" + fBits);
}

function getFloatExponent(f, fBits, raw=false) {
    if (fBits == 32)
        return createBinaryIntFromFloat32Bin(f).getCastFloat32Exponent(raw);
    else if (fBits == 64)
        return createBinaryIntFromFloat64Bin(f).getCastFloat64Exponent(raw);
    else
        throw new Error("getFloatExponent() called with fBits=" + fBits);
}

function getFloatMantissa(f, fBits, raw=false) {
    if (fBits == 32)
        return createBinaryIntFromFloat32Bin(f).getCastFloat32Mantissa(raw);
    else if (fBits == 64)
        return createBinaryIntFromFloat64Bin(f).getCastFloat64Mantissa(raw);
    else
        throw new Error("getFloatMantissa() called with fBits=" + fBits);
}

const weekDayNames = [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ];
function weekDayName(n) {
    return weekDayNames[n];
}

function codepointToUTF8Hex(cp) {
    let leadingBits = 0;
    let byteCount = 0;
    let utf8Bytes = [];
    if (cp < 0x80) {
        leadingBits = 0;
        byteCount = 1;
    }
    else if (cp < 0x800) {
        leadingBits = 0xc0;
        byteCount = 2;
    }
    else if (cp < 0x10000) {
        leadingBits = 0xe0;
        byteCount = 3;
    }
    else {
        leadingBits = 0xf0;
        byteCount = 4;
    }

    for (let i = 0; i < byteCount - 1; i++) {
        utf8Bytes.unshift(0x80 | (cp & 0x3f));
        cp >>= 6;
    }
    utf8Bytes.unshift(leadingBits | cp);
    return hexByteString(utf8Bytes);
}

function codepointToUTF16Hex(cp) {
    if (cp >= 0x10000) {
        cp -= 0x10000;
        return intToHex(0xD800 + ((cp >> 10) & 0x3ff), 4) + " " +
            intToHex(0xDC00 + (cp & 0x3ff), 4);
    }
    else {
        return intToHex(cp, 4);
    }
}

function isHighSurrogate(cp) {
    return cp >= 0xd800 && cp < 0xdc00;
}

function text2UnicodeFunc(inputValue, params, outputFlags, outputElement) {
    let text = inputValue.getText();
    const maxRows = 20;
    let pos = 0;
    let rowNum = 0;

    /* Find the table in the div */
    let table = outputElement.getElementsByTagName("TABLE");
    if (table.length == 0) {
        console.log("wot no table?");
        return false;
    }
    else {
        table = table[0];
    }

    for (let rowNum = 0; rowNum < maxRows; rowNum++) {
        /* Find the tr element for this row */
        let tr = table.getElementsByClassName("text2unicode-row-" + rowNum.toString());
        if (tr.length == 0) {
            /* This row doesn't exist yet - create it */
            tr = document.createElement("TR");
            tr.classList.add("text2unicode");
            tr.classList.add("text2unicode-row-" + rowNum.toString());

            let tds = [];
            for (let i = 0; i < 5; i++) {
                tds.push(document.createElement("TD"));
            }
            tds[0].classList.add("text2unicode-char");
            tds[1].classList.add("text2unicode-cp");
            tds[2].classList.add("text2unicode-dec");
            tds[3].classList.add("text2unicode-utf8");
            tds[4].classList.add("text2unicode-utf16");
            for (let i = 0; i < tds.length; i++) {
                tr.appendChild(tds[i]);
            }
            table.appendChild(tr);
        }
        else {
            /* We only expect one row for each position */
            tr = tr[0];
        }

        if (pos < text.length) {
            let character = text.charAt(pos);
            let cc = text.charCodeAt(pos);
            let cp = text.codePointAt(pos);
            let tds = tr.getElementsByTagName("TD");
            if (isHighSurrogate(cc) && pos + 1 < text.length) {
                /* This codepoint takes up two characters. */
                character += text.charAt(++pos);
            }
            if (tds[0]) {
                tds[0].innerText = character;
            }
            if (tds[1]) {
                tds[1].innerText = "U+" + intToHex(cp, 4);
            }
            if (tds[2]) {
                tds[2].innerText = cp;
            }
            if (tds[3]) {
                tds[3].innerText = codepointToUTF8Hex(cp);
            }
            if (tds[4]) {
                tds[4].innerText = codepointToUTF16Hex(cp);
            }
            tr.style.display = null;
        }
        else {
            tr.style.display = "none";
        }
        pos++;
    }

    let overflowDiv = outputElement.getElementsByClassName("text2unicodeoverflowreport");
    if (overflowDiv.length > 0) {
        overflowDiv = overflowDiv[0];
        if (pos < text.length) {
            overflowDiv.innerText = "Only the first " + maxRows.toString() + " characters are shown.";
            overflowDiv.style.display = "block";
        }
        else {
            overflowDiv.style.display = "none";
        }
    }
    return true;
}

function initConversions() {
    createConversionFromBinaryInt("hex", binaryInt => "0x" + binaryInt.formatHex(false));

    createConversionFromBinaryInt("decimal", binaryInt => binaryInt.formatDecimal());

    let signedness = [ "signed", "unsigned" ];
    let numBits = [ 8, 16, 32, 64 ];
    for (let i = 0; i < signedness.length; i++) {
        for (let j = 0; j < numBits.length; j++) {
            createConversionFromBinaryInt(
                signedness[i] + numBits[j].toString(),
                function(binaryInt, inputValue, params) {
                    return convertInt(inputValue, i == 0, numBits[j]);
                }
            );
        }
    }

    createConversionFromBinaryInt("fromunixutc",
        function(binaryInt, inputValue, params) {
            if (!inputValue.isInteger()) {
                return null;
            }
            let t = inputValue.getInteger();
            let ms;
            let unitAutoDetect = params["unixtsscaleauto"];
            let unit = params["unixtsscale"];
            if (unitAutoDetect) {
                /* Auto-detect */
                let tAbs = Math.abs(t);
                if (tAbs <= 2 ** 32) {
                    /* Assume seconds */
                    unit = "s";
                }
                else if (tAbs / 1000 <= 2 ** 32) {
                    /* Assume milliseconds */
                    unit = "ms";
                }
                else {
                    /* Assume microseconds */
                    unit = "us";
                }
                document.getElementById("unixtsscale-" + unit).checked = true;
            }
            if (unit == "s") {
                ms = t * 1000;
            }
            else if (unit == "ms") {
                ms = t;
            }
            else if (unit == "us") {
                ms = t / 1000;
            }

            let d = new Date(ms);
            return weekDayName(d.getUTCDay()) + " " + d.toISOString().replace("T", " ").replace("Z", "") + " UTC";
        }
    );

    createConversionFromBinaryInt("fromunixlocal",
        function(binaryInt, inputValue) {
            if (!inputValue.isInteger()) {
                return null;
            }
            let t = inputValue.getInteger();
            let d = new Date(t * 1000);
            return d.toString();
        }
    );

    function isUnicodeCodepoint(cp) {
        return cp >= 0 && cp <= 0x10FFFF && !(cp >= 0xD800 && cp <= 0xDFFF);
    }

    createConversionFromBinaryInt("unicodecharacter",
        function(binaryInt, inputValue) {
            if (!(inputValue.isInteger() && isUnicodeCodepoint(inputValue.getInteger())))
                return null;
            return String.fromCodePoint(inputValue.getInteger());
        }
    );

    createConversionFromBinaryInt("unicodecodepoint",
        function(binaryInt, inputValue) {
            if (!(inputValue.isInteger() && isUnicodeCodepoint(inputValue.getInteger())))
                return null;
            return "U+" + intToHex(inputValue.getInteger(), 4);
        }
    );

    createConversionFromBinaryInt("utf8encoding",
        function(binaryInt, inputValue) {
            if (!(inputValue.isInteger() && isUnicodeCodepoint(inputValue.getInteger())))
                return null;
            return codepointToUTF8Hex(inputValue.getInteger());
        }
    );

    createConversionFromBinaryInt("utf16encoding",
        function(binaryInt, inputValue) {
            if (!(inputValue.isInteger() && isUnicodeCodepoint(inputValue.getInteger()))) {
                return null;
            }
            return codepointToUTF16Hex(inputValue.getInteger());
        }
    );

    createConversionFromBinaryInt("codepointblock",
        function(binaryInt, inputValue) {
            if (!(inputValue.isInteger() && isUnicodeCodepoint(inputValue.getInteger()))) {
                return null;
            }
            let cp = inputValue.getInteger();
            return getUnicodeCodepointBlock(cp);
        }
    );

    conversions["codepointlink"] = new Conversion("binaryint", "codepointlink",
        function(inputValue, params, outputFlags, outputElement) {
            if (!(inputValue.isInteger() && isUnicodeCodepoint(inputValue.getInteger()))) {
                outputElement.innerHTML = "";
                return false;
            }
            let cpString = "U+" + intToHex(inputValue.getInteger(), 4);
            outputElement.innerHTML = "<a href=\"https://codepoints.net/" + cpString + "\" target=\"_blank\">" +
                "See " + cpString + " on codepoints.net</a> (opens in new window)";
            return true;
        }
    );

    createConversionFromBinaryInt("float32bin2sign",
        binaryInt => binaryInt.getCastFloat32Sign() ? "-" : "+"
    );

    createConversionFromBinaryInt("float32bin2signraw",
        binaryInt => binaryInt.getCastFloat32Sign() ? "1" : "0"
    );

    createConversionFromBinaryInt("float32bin2exp",
        binaryInt => binaryInt.getCastFloat32Exponent().toString()
    );

    createConversionFromBinaryInt("float32bin2expraw",
        binaryInt => "0x" + intToHex(binaryInt.getCastFloat32Exponent(true), 2)
    );

    createConversionFromBinaryInt("float32bin2mantissa",
        binaryInt => binaryInt.getCastFloat32Mantissa().toFixed(9)
    );

    createConversionFromBinaryInt("float32bin2mantissaraw",
        binaryInt => "0x" + intToHex(binaryInt.getCastFloat32Mantissa(true), 6)
    );

    createConversionFromBinaryInt("float32bin2value",
        function(binaryInt, inputValue, params, flags) {
            setFlagActive(flags, "float32binsubnormal", binaryInt.isFloat32Subnormal());
            return binaryInt.getCastFloat32().toPrecision(7);
        }
    );

    createConversionFromBinaryInt("float64bin2sign",
        binaryInt => binaryInt.getCastFloat64Sign() ? "-" : "+"
    );

    createConversionFromBinaryInt("float64bin2signraw",
        binaryInt => binaryInt.getCastFloat64Sign() ? "1" : "0"
    );

    createConversionFromBinaryInt("float64bin2exp",
        binaryInt => binaryInt.getCastFloat64Exponent().toString()
    );

    createConversionFromBinaryInt("float64bin2expraw",
        binaryInt => "0x" + intToHex(binaryInt.getCastFloat64Exponent(true), 3)
    );

    createConversionFromBinaryInt("float64bin2mantissa",
        binaryInt => binaryInt.getCastFloat64Mantissa().toFixed(17)
    );

    createConversionFromBinaryInt("float64bin2mantissaraw",
        binaryInt => "0x" + intToHex(binaryInt.getCastFloat64Mantissa(true), 13)
    );

    createConversionFromBinaryInt("float64bin2value",
        function(binaryInt, inputValue, params, flags) {
            setFlagActive(flags, "float64binsubnormal", binaryInt.isFloat64Subnormal());
            return binaryInt.getCastFloat64().toPrecision(15);
        }
    );

    /* Generate float-to-bits conversions for 32-bit and 64-bit floats */
    for (let fBits = 32; fBits <= 64; fBits += 32) {
        let namePreamble = "float" + fBits.toString() + "to";
        createConversionFromFloat(namePreamble + "signraw",
            f => getFloatSign(f, fBits) ? "1" : "0"
        );

        createConversionFromFloat(namePreamble + "sign",
            f => getFloatSign(f, fBits) ? "-" : "+"
        );

        createConversionFromFloat(namePreamble + "expraw",
            f => "0x" + intToHex(getFloatExponent(f, fBits, true), fBits == 32 ? 2 : 3)
        );

        createConversionFromFloat(namePreamble + "exp",
            f => getFloatExponent(f, fBits, false).toString()
        );

        createConversionFromFloat(namePreamble + "mantissaraw",
            f => "0x" + intToHex(getFloatMantissa(f, fBits, true), fBits == 32 ? 6 : 13)
        );

        createConversionFromFloat(namePreamble + "mantissa",
            f => getFloatMantissa(f, fBits, false).toFixed(fBits == 32 ? 9 : 17)
        );

        createConversionFromFloat(namePreamble + "hexvalue",
            f => "0x" + createBinaryIntFromFloatBin(f, fBits).formatHex()
        );

    }

    /* 64-bit float to value - just .toString() it */
    createConversionFromFloat("float64tovalue",
        function(f, inputValue, params, flags) {
            setFlagActive(flags, "float64subnormal",
                getFloatExponent(f, 64, true) == 0 && getFloatMantissa(f, 64, true) != 0);
            return f.toString();
        }
    );

    /* 32-bit float to value - drag it kicking and screaming through a Float32 */
    createConversionFromFloat("float32tovalue",
        function(f, inputValue, params, flags) {
            let fa = new Float32Array(1);
            fa[0] = f;
            f = fa[0];
            setFlagActive(flags, "float32subnormal",
                getFloatExponent(f, 32, true) == 0 && getFloatMantissa(f, 32, true) != 0);
            return f.toString();
        }
    );


    /* Text to individual Unicode codepoints */
    conversions["text2unicode"] = new Conversion("text", "text2unicode", text2UnicodeFunc);
}
