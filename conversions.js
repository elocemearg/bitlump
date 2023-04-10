
/* conversion name -> Conversion */
let conversions = {};

function parseNumber(input) {
    input = input.trim()
    if (input.startsWith("0x")) {
        return parseInt(input.substring(2), 16);
    }
    else {
        return parseInt(input);
    }
}

function isHexInteger(input) {
    return input.match(/^ *0x[0-9a-fA-F]+ *$/) != null;
}

function intToHex(i) {
    return i.toString(16).toUpperCase();
}

class InputValue {
    constructor(text) {
        this.text = text;

        /* Try to parse as an integer */
        this.intValue = parseNumber(text);

        /* Try to parse as a float */
        this.floatValue = parseFloat(text);

        this.binaryIntValue = createBinaryIntFromString(text, 8, text.trim().startsWith("-"));
    }

    getBinaryInt() {
        return this.binaryIntValue;
    }

    isInteger() {
        return !isNaN(this.intValue);
    }

    isHexInteger() {
        return isHexInteger(this.text);
    }

    isFloat() {
        return !isNaN(this.floatValue);
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
    constructor(name, heading, func) {
        this.func = func;
        this.name = name;
        this.heading = heading;
    }

    getName() {
        return this.name;
    }

    getHeading() {
        return this.heading;
    }

    convert(value, params) {
        return this.func(value, params);
    }
}

function createConversion(categoryName, conversionName, conversionHeading, func) {
    let conversion = new Conversion(conversionName, conversionHeading, func);
    conversions[conversionName] = conversion;
}

function getConversion(conversionName) {
    return conversions[conversionName];
}

function convertInt(inputValue, signed, bits, swapEndianity) {
    let binaryInt = createBinaryIntFromString(inputValue.getText(), Math.floor(bits / 8), signed);

    if (binaryInt == null)
        return null;

    if (swapEndianity) {
        binaryInt.swapEndianity();
    }

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

function initConversions() {
    createConversion("numbers", "hex", "Hex",
        function(input, params) {
            let binaryInt = input.getBinaryInt();
            if (binaryInt == null)
                return null;
            return "0x" + binaryInt.formatHex(false);
        }
    );

    createConversion("numbers", "decimal", "Decimal",
        function(input, params) {
            let binaryInt = input.getBinaryInt();
            if (binaryInt == null)
                return null;
            return binaryInt.formatDecimal();
        }
    );

    let signedness = [ "signed", "unsigned" ];
    let numBits = [ 8, 16, 32, 64 ];
    let littleEndian = [ false, true ];
    for (let i = 0; i < signedness.length; i++) {
        for (let j = 0; j < numBits.length; j++) {
            for (let k = 0; k < littleEndian.length; k++) {
                createConversion("numbers",
                    signedness[i] + numBits[j].toString() + (littleEndian[k] ? "le" : ""),
                    signedness[i] + " " + numBits[j].toString() + "-bit integer" + (littleEndian[k] ? " (LE)" : ""),
                    function(inputValue) {
                        return convertInt(inputValue, i == 0, numBits[j], littleEndian[k]);
                    }
                );
            }
        }
    }

    createConversion("numbers", "fromunixutc", "Unix timestamp (UTC)",
        function(input) {
            if (!input.isInteger()) {
                return null;
            }
            let t = input.getInteger();
            let d = new Date(t * 1000);
            return d.toUTCString();
        }
    );

    createConversion("numbers", "fromunixlocal", "Unix timestamp (local)",
        function(input) {
            if (!input.isInteger()) {
                return null;
            }
            let t = input.getInteger();
            let d = new Date(t * 1000);
            return d.toString();
        }
    );

    function isUnicodeCodepoint(cp) {
        return cp >= 0 && cp <= 0x10FFFF && !(cp >= 0xD800 && cp <= 0xDFFF);
    }

    createConversion("numbers", "unicodecodepoint", "Unicode codepoint",
        function(inputValue) {
            if (!(inputValue.isInteger() && isUnicodeCodepoint(inputValue.getInteger())))
                return null;
            return String.fromCodePoint(inputValue.getInteger());
        }
    );

    createConversion("numbers", "utf8encoding", "UTF-8 encoding",
        function(inputValue) {
            if (!(inputValue.isInteger() && isUnicodeCodepoint(inputValue.getInteger())))
                return null;
            let cp = inputValue.getInteger();
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
    );

    createConversion("numbers", "utf16encoding", "UTF-16 encoding",
        function(inputValue) {
            if (!(inputValue.isInteger() && isUnicodeCodepoint(inputValue.getInteger()))) {
                return null;
            }

            let cp = inputValue.getInteger();
            if (cp <= 0xffff) {
                return hexByteString([cp >> 8, cp & 0xff]);
            }
            else {
                cp -= 0x10000;
                let pairs = [ 0xD800 | ((cp >> 10) & 0x3ff), 0xDC00 | (cp & 0x3ff) ];
                return hexByteString([pairs[0] >> 8, pairs[0] & 0xff, pairs[1] >> 8, pairs[1] & 0xff]);
            }
        }
    );

}
