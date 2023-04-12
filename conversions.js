
/* conversion name -> Conversion */
let conversions = {};

function isHexInteger(input) {
    return input.match(/^ *0x[0-9a-fA-F]+ *$/) != null;
}

function intToHex(i) {
    return i.toString(16).toUpperCase();
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

class InputValue {
    constructor(text) {
        this.text = text;

        /* Put the value into a binary integer */
        this.binaryIntValue = createBinaryIntFromString(text, 8, text.trim().startsWith("-"));

        if (this.binaryIntValue != null) {
            this.intValue = this.binaryIntValue.getJSInt();
        }
        else {
            this.intValue = null;
        }

        /* Try to parse as a float */
        if (text.trim().length > 0)
            this.floatValue = Number(text);
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

    convert(value, params) {
        return this.func(value, params);
    }
}

function createConversion(categoryName, conversionName, func) {
    let conversion = new Conversion(categoryName, conversionName, func);
    conversions[conversionName] = conversion;
}

function createConversionFromBinaryInt(conversionName, func) {
    return createConversion("binaryint", conversionName,
        function(inputValue, params) {
            let b = inputValue.getBinaryInt();
            if (b == null)
                return null;
            return func(b, inputValue, params);
        }
    );
}

function createConversionFromFloat(conversionName, func) {
    return createConversion("float", conversionName,
        function(inputValue, params) {
            if (inputValue.isFloat())
                return func(inputValue.getFloat(), inputValue, params);
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

            return new Date(ms).toUTCString();
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

    createConversionFromBinaryInt("unicodecodepoint",
        function(binaryInt, inputValue) {
            if (!(inputValue.isInteger() && isUnicodeCodepoint(inputValue.getInteger())))
                return null;
            return String.fromCodePoint(inputValue.getInteger());
        }
    );

    createConversionFromBinaryInt("utf8encoding",
        function(binaryInt, inputValue) {
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

    createConversionFromBinaryInt("utf16encoding",
        function(binaryInt, inputValue) {
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
        binaryInt => "0x" + leftPad(intToHex(binaryInt.getCastFloat32Exponent(true)), '0', 2)
    );

    createConversionFromBinaryInt("float32bin2mantissa",
        binaryInt => binaryInt.getCastFloat32Mantissa().toFixed(9)
    );

    createConversionFromBinaryInt("float32bin2mantissaraw",
        binaryInt => "0x" + leftPad(intToHex(binaryInt.getCastFloat32Mantissa(true)), '0', 6)
    );

    createConversionFromBinaryInt("float32bin2value",
        binaryInt => binaryInt.getCastFloat32().toPrecision(7)
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
        binaryInt => "0x" + leftPad(intToHex(binaryInt.getCastFloat64Exponent(true)), '0', 3)
    );

    createConversionFromBinaryInt("float64bin2mantissa",
        binaryInt => binaryInt.getCastFloat64Mantissa().toFixed(17)
    );

    createConversionFromBinaryInt("float64bin2mantissaraw",
        binaryInt => "0x" + leftPad(intToHex(binaryInt.getCastFloat64Mantissa(true)), '0', 13)
    );

    createConversionFromBinaryInt("float64bin2value",
        binaryInt => binaryInt.getCastFloat64().toPrecision(15)
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
            f => "0x" + leftPad(intToHex(getFloatExponent(f, fBits, true)), '0', fBits == 32 ? 2 : 3)
        );

        createConversionFromFloat(namePreamble + "exp",
            f => getFloatExponent(f, fBits, false).toString()
        );

        createConversionFromFloat(namePreamble + "mantissaraw",
            f => "0x" + leftPad(intToHex(getFloatMantissa(f, fBits, true)), '0', fBits == 32 ? 6 : 13)
        );

        createConversionFromFloat(namePreamble + "mantissa",
            f => getFloatMantissa(f, fBits, false).toFixed(fBits == 32 ? 9 : 17)
        );

        createConversionFromFloat(namePreamble + "hexvalue",
            f => "0x" + createBinaryIntFromFloatBin(f, fBits).formatHex()
        );

    }

    /* 64-bit float to value - just .toString() it */
    createConversionFromFloat("float64tovalue", f => f.toString())

    /* 32-bit float to value - drag it kicking and screaming through a Float32 */
    createConversionFromFloat("float32tovalue",
        function(f) {
            let fa = new Float32Array(1);
            fa[0] = f;
            f = fa[0];
            return f.toString();
        }
    );
}
