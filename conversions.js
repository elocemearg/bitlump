
/* conversion name -> Conversion */
let conversions = {};

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

function isUnicodeCodepoint(cp) {
    return cp >= 0 && cp <= 0x10FFFF && !(cp >= 0xD800 && cp <= 0xDFFF);
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
        this.binaryIntValue = createBinaryIntFromString(text, -1, text.startsWith("-"));

        if (this.binaryIntValue != null) {
            this.intValue = this.binaryIntValue.getJSInt();
        }
        else {
            this.intValue = null;
        }

        /* Create some other BinaryInt values as signed/unsigned 8/16/32/64-bit
         * integers. */
        this.binaryIntConversions = {};
        if (this.binaryIntValue) {
            for (let s = 0; s < 2; s++) {
                for (let n = 8; n <= 64; n *= 2) {
                    let key = (s ? "signed" : "unsigned") + n.toString();
                    this.binaryIntConversions[key] = createBinaryIntFromString(text, Math.floor(n / 8), s != 0);
                }
            }
        }

        /* Try to parse as a float */
        if (text.trim().length > 0) {
            /* Try to parse as a JavaScript number */
            let floatText = text;
            if (floatText.toLowerCase().startsWith("0x")) {
                /* Ignore spaces in hex input */
                floatText = floatText.replace(/\s+/g, "");
            }
            this.floatValue = Number(floatText);

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
        else {
            this.floatValue = null;
        }

        /* Try to parse the text as a sequence of bytes, which is either
         * one or more 0x-prefixed hex numbers, or two or more space-separated
         * possibly-0x-prefixed hex numbers. */
        let words = text.split(/\s+/);
        if (words.length > 1 || (words.length == 1 && words[0].toLowerCase().startsWith("0x"))) {
            this.bytes = hexToByteArray(text);
        }
        else {
            this.bytes = null;
        }
    }

    getBinaryInt() {
        return this.binaryIntValue;
    }

    getConvertedBinaryInt(signed, bits) {
        let key = (signed ? "signed" : "unsigned") + bits.toString();
        let value = this.binaryIntConversions[key];
        if (value == null)
            return null;
        else
            return value;
    }

    getBytes() {
        return this.bytes;
    }

    isBytes() {
        return this.bytes != null;
    }

    /* Format a supplied BinaryInt the same way this one is formatted. */
    formatBinaryInt(binaryInt) {
        return binaryInt.formatAsOriginalBase();
    }

    isInteger() {
        return this.intValue != null && !isNaN(this.intValue);
    }

    isHexInteger() {
        return this.binaryIntValue != null && this.binaryIntValue.isConvertedFromHex();
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

function convertInt(inputValue, signed, bits, hex) {
    let binaryInt = inputValue.getConvertedBinaryInt(signed, bits);

    if (binaryInt == null)
        return null;

    if (hex) {
        return "0x" + binaryInt.formatHex();
    }
    else {
        return binaryInt.formatDecimal();
    }
}

/* Return a copy of bytesOriginal where every chunk of bytesPerWord bytes
 * has its order reversed. bytesOriginal.length must be a multiple of
 * bytesPerWord. If it isn't, then if extend is true the copy is extended
 * accordingly with 0-bytes, and if extend is false null is returned. */
function swapByteOrder(bytesOriginal, bytesPerWord, extend) {
    let bytes = [];
    for (let i = 0; i < bytesOriginal.length; i++) {
        bytes.push(bytesOriginal[i]);
    }
    /* If extend = true, pad the byte array to be a multiple of bytesPerWord
     * bytes. If extend = false, do nothing and return if the byte array isn't
     * already a multiple of bytesPerWord bytes. */
    if (bytes.length % bytesPerWord != 0) {
        if (extend) {
            while (bytes.length % bytesPerWord != 0) {
                bytes.push(0);
            }
        }
        else {
            return null;
        }
    }

    for (let start = 0; start < bytes.length; start += bytesPerWord) {
        let l = start;
        let r = start + bytesPerWord - 1;
        while (l < r) {
            let tmp = bytes[l];
            bytes[l] = bytes[r];
            bytes[r] = tmp;
            l++;
            r--;
        }
    }
    return bytes;
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

function formatByteArray(bytes, bytesPerGroup) {
    let groups = [];
    let currentGroup = [];
    if (bytes.length == 0) {
        return "";
    }
    for (let i = 0; i < bytes.length; i++) {
        let b = bytes[i];
        if (currentGroup.length > 0 && currentGroup.length % bytesPerGroup == 0) {
            groups.push(currentGroup.join(""));
            currentGroup = [];
        }
        currentGroup.push(HEX_DIGITS[b >> 4] + HEX_DIGITS[b & 15]);
    }
    if (currentGroup.length > 0)
        groups.push(currentGroup.join(""));
    return (groups.length == 1 ? "0x" : "") + groups.join(" ");
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

function isLowSurrogate(cp) {
    return cp >= 0xdc00 && cp < 0xe000;
}

function makeCodepointLinkElement(cp) {
    let a = document.createElement("A");
    let cpText = "U+" + intToHex(cp, 4);
    a.href = "https://codepoints.net/" + cpText;
    a.target = "_blank";
    a.innerText = cpText;
    a.title = "See " + cpText + " on codepoints.net (new tab)";
    return a;
}

class DynamicTableFiller {
    constructor(inputValue, outputElement) {
        this.inputValue = inputValue;
        this.outputElement = outputElement;
    }

    nextRow() {
    }


    getOverflowText(maxRows) {
        return "Only the first " + maxRows.toString() + " rows are shown.";
    }

    finished(maxRows, overflowed) {
        let text = this.inputValue.getText();
        let overflowDiv = this.outputElement.getElementsByClassName("dyntableoverflowreport");
        if (overflowDiv.length > 0) {
            overflowDiv = overflowDiv[0];
            if (overflowed) {
                overflowDiv.innerText = this.getOverflowText(maxRows);
                overflowDiv.style.display = "block";
            }
            else {
                overflowDiv.style.display = "none";
            }
        }
    }
}

class Text2UnicodeDynamicTableFiller extends DynamicTableFiller {
    constructor(inputValue, outputElement) {
        super(inputValue, outputElement);
        this.pos = 0;
        this.text = inputValue.getText();
        this.utf8Sequences = [];
        this.utf16Sequences = [];
    }

    nextRow() {
        let text = this.text;
        let rowContents = null;

        if (this.pos < text.length) {
            let character = text.charAt(this.pos);
            let cc = text.charCodeAt(this.pos);
            let cp = text.codePointAt(this.pos);
            if (isHighSurrogate(cc) && this.pos + 1 < text.length) {
                /* This codepoint takes up two characters. */
                character += text.charAt(++this.pos);
            }

            this.utf8Sequences.push(codepointToUTF8Hex(cp));
            this.utf16Sequences.push(codepointToUTF16Hex(cp));

            rowContents = [
                /* Character */
                document.createTextNode(character),

                /* Link to codepoint */
                makeCodepointLinkElement(cp),

                /* Codepoint in decimal */
                document.createTextNode(cp.toString()),

                /* UTF-8 encoding */
                document.createTextNode(codepointToUTF8Hex(cp)),

                /* UTF-16 encoding */
                document.createTextNode(codepointToUTF16Hex(cp))
            ];
            this.pos++;
        }
        return rowContents;
    }

    getOverflowText(maxRows) {
        return "Only the first " + maxRows.toString() + " characters are shown.";
    }

    finished(maxRows) {
        super.finished(maxRows, this.pos < this.text.length);

        /* Set the text2unicodeutf8encodingheader and
         * text2unicodeutf16encodingheader elements so that clicking them
         * copies the UTF-8 or UTF-16 encoding to the clipboard. */
        for (let encoding = 8; encoding <= 16; encoding += 8) {
            let th = this.outputElement.getElementsByClassName("text2unicodeutf" + encoding.toString() + "encodingheader");
            if (th.length > 0) {
                let sequences = (encoding == 8 ? this.utf8Sequences : this.utf16Sequences);
                if (sequences.length > 0) {
                    th[0].setAttribute("data-text-to-copy", (sequences.length == 1 ? "0x" : "") + sequences.join(" "));
                }
            }
        }
    }
}

class Bytes2TextDynamicTableFiller extends DynamicTableFiller {
    constructor(inputValue, outputElement) {
        super(inputValue, outputElement);
        this.decodedChars = [];
    }

    makeHexBytesNode(bytes, errorByteIndex, furtherBytesExpected, isOverlongEncoding, isInvalidCodepoint, encodingName) {
        let beforeErrValue = null;
        let errValue = null;
        let afterErrValue = null;

        if (errorByteIndex < 0 || (errorByteIndex >= bytes.length && furtherBytesExpected == 0)) {
            beforeErrValue = bytes.map(x => intToHex(x, 2)).join(" ");
            afterErrValue = null;
        }
        else if (furtherBytesExpected > 0) {
            /* All the bytes are valid but there are bytes missing. */
            beforeErrValue = bytes.map(x => intToHex(x, 2)).join(" ") + " ";
            errValue = "";
            for (let i = 0; i < furtherBytesExpected; i++) {
                if (i > 0)
                    errValue += " ";
                errValue += "??";
            }
        }
        else {
            /* The byte at position errorByteIndex is invalid */
            beforeErrValue = bytes.slice(0, errorByteIndex).map(x => intToHex(x, 2)).join(" ") + " ";
            errValue = intToHex(bytes[errorByteIndex], 2);
            afterErrValue = " " + bytes.slice(errorByteIndex + 1).map(x => intToHex(x, 2)).join(" ");
        }

        let node = document.createElement("SPAN");
        if (isInvalidCodepoint) {
            node.classList.add("invalidbyteseq");
            node.title = "This " + encodingName + " sequence is not valid because it decodes to an invalid codepoint.";
        }
        else if (isOverlongEncoding) {
            node.classList.add("invalidbyteseq");
            node.title = "This " + encodingName + " sequence is not valid because the codepoint is not encoded in its shortest possible form.";
        }

        node.appendChild(document.createTextNode(beforeErrValue));
        if (errValue != null) {
            let errSpan = document.createElement("SPAN");
            errSpan.classList.add("invalidbyte");
            errSpan.innerText = errValue;
            if (furtherBytesExpected)
                errSpan.title = "This " + encodingName + " sequence is not valid because it is incomplete.";
            else
                errSpan.title = "This " + encodingName + " sequence is not valid because this byte isn't allowed to appear here.";
            node.appendChild(errSpan);
        }
        if (afterErrValue != null) {
            node.appendChild(document.createTextNode(afterErrValue));
        }
        return node;
    }

    finished(maxRows) {
        super.finished(maxRows, this.bytes != null && this.pos < this.bytes.length);
        let stringOutputElement = this.outputElement.getElementsByClassName("bytes2textstring");
        if (stringOutputElement.length > 0) {
            stringOutputElement = stringOutputElement[0];
            stringOutputElement.innerText = this.decodedChars.join("");
        }
    }

    getOverflowText(maxRows) {
        return "Only the first " + maxRows.toString() + " characters are shown.";
    }
}

class Bytes2UTF16DynamicTableFiller extends Bytes2TextDynamicTableFiller {
    constructor(inputValue, outputElement) {
        super(inputValue, outputElement);
        this.pos = 0;
        this.bytes = inputValue.getBytes();
    }

    nextRow() {
        let bytes = this.bytes;
        let startByteIndex = this.pos;
        let errorByteIndex = -1;
        let missingBytes = 0;
        let charBytes = [];
        let codepoint = 0;
        let charDisplayCodepoint = 0;

        if (bytes == null || this.pos >= bytes.length) {
            return null;
        }

        charBytes.push(bytes[this.pos++]);
        if (this.pos >= bytes.length) {
            /* Incomplete UTF-16 character */
            errorByteIndex = 0;
            missingBytes = 1;
        }

        if (errorByteIndex < 0) {
            let c1 = 0;
            let c2 = 0;
            charBytes.push(bytes[this.pos++]);
            c1 = charBytes[0] * 256 + charBytes[1];
            if (isHighSurrogate(c1)) {
                /* Expect two more bytes */
                for (let i = 0; i < 2; i++) {
                    if (this.pos >= bytes.length) {
                        errorByteIndex = charBytes.length - 1;
                        missingBytes = 2 - i;
                        if (i == 1 && !(charBytes[errorByteIndex] >= 0xdc && charBytes[errorByteIndex] <= 0xdf)) {
                            /* The main problem isn't a missing byte, it's that
                             * the third byte of the sequence can't be the
                             * start of a low-order surrogate. */
                            missingBytes = 0;
                        }
                        break;
                    }
                    else {
                        charBytes.push(bytes[this.pos++]);
                    }
                }
                if (errorByteIndex < 0) {
                    c2 = charBytes[2] * 256 + charBytes[3];
                    if (!isLowSurrogate(c2)) {
                        errorByteIndex = 2;
                    }
                }
                if (errorByteIndex < 0) {
                    codepoint = 0x10000 + ((c1 & 0x3ff) << 10) + (c2 & 0x3ff);
                }
            }
            else {
                codepoint = c1;
            }
        }

        if (errorByteIndex >= 0) {
            /* Unicode replacement character */
            charDisplayCodepoint = 0xfffd;
        }
        else {
            charDisplayCodepoint = codepoint;
        }

        /* Not a codepoint */
        if (!isUnicodeCodepoint(codepoint)) {
            charDisplayCodepoint = 0xfffd;
        }

        this.decodedChars.push(String.fromCodePoint(charDisplayCodepoint));

        return [
            document.createTextNode(startByteIndex.toString()),
            document.createTextNode(String.fromCodePoint(charDisplayCodepoint)),
            errorByteIndex >= 0 ? document.createTextNode("(invalid)") : makeCodepointLinkElement(codepoint),
            document.createTextNode(errorByteIndex >= 0 ? "" : codepoint.toString()),
            this.makeHexBytesNode(charBytes, errorByteIndex, missingBytes,
                false, errorByteIndex < 0 && !isUnicodeCodepoint(codepoint), "UTF-16")
        ];
    }
}

class Bytes2UTF8DynamicTableFiller extends Bytes2TextDynamicTableFiller {
    constructor(inputValue, outputElement) {
        super(inputValue, outputElement);
        this.pos = 0;
        this.bytes = inputValue.getBytes();
    }

    nextRow() {
        let bytes = this.bytes;
        let startByteIndex = this.pos;

        if (bytes == null || this.pos >= bytes.length) {
            return null;
        }

        let firstByte = bytes[this.pos++];
        let numContBytes = 0;
        let cp = 0;
        let charDisplayCodepoint = 0;
        let charBytes = [];
        let errorByteIndex = -1;
        let missingBytes = 0;
        let isOverlongEncoding = false;

        charBytes.push(firstByte);
        if ((firstByte & 0x80) == 0) {
            numContBytes = 0;
            cp = firstByte;
        }
        else if ((firstByte & 0xe0) == 0xc0) {
            numContBytes = 1;
            cp = firstByte & 0x1f;
        }
        else if ((firstByte & 0xf0) == 0xe0) {
            numContBytes = 2;
            cp = firstByte & 0x0f;
        }
        else if ((firstByte & 0xf8) == 0xf0) {
            numContBytes = 3;
            cp = firstByte & 0x07;
        }
        else if ((firstByte & 0xfc) == 0xf8) {
            numContBytes = 4;
            cp = firstByte & 0x03;
        }
        else if ((firstByte & 0xfe) == 0xfc) {
            numContBytes = 5;
            cp = firstByte & 0x01;
        }
        else {
            /* Invalid first byte */
            errorByteIndex = 0;
        }

        if (errorByteIndex < 0) {
            for (let i = 0; i < numContBytes; i++) {
                if (this.pos >= bytes.length) {
                    /* Unexpected end of sequence */
                    errorByteIndex = charBytes.length;
                    missingBytes = numContBytes - i;
                    break;
                }
                let contByte = bytes[this.pos++];

                charBytes.push(contByte);

                if ((contByte & 0xc0) != 0x80) {
                    /* Invalid continuation byte */
                    errorByteIndex = charBytes.length - 1;
                    break;
                }

                /* Shift in another six bits to cp */
                cp <<= 6;
                cp |= contByte & 0x3f;
            }
        }

        /* Check that the codepoint produced from this UTF-8 sequence is
         * encoded using its shortest possible form. If not, mark it as an
         * overlong encoding. */
        if (errorByteIndex < 0) {
            let contBytesRequired = 0;
            contBytesRequired += (cp >= 0x80) ? 1 : 0;
            contBytesRequired += (cp >= 0x800) ? 1 : 0;
            contBytesRequired += (cp >= 0x10000) ? 1 : 0;
            contBytesRequired += (cp >= 0x200000) ? 1 : 0;
            contBytesRequired += (cp >= 0x4000000) ? 1 : 0;
            isOverlongEncoding = (numContBytes > contBytesRequired);
        }

        if (errorByteIndex >= 0) {
            /* Unicode replacement character */
            charDisplayCodepoint = 0xfffd;
        }
        else {
            charDisplayCodepoint = cp;
        }

        /* Not a codepoint */
        if (!isUnicodeCodepoint(cp)) {
            charDisplayCodepoint = 0xfffd;
        }

        this.decodedChars.push(String.fromCodePoint(charDisplayCodepoint));

        return [
            document.createTextNode(startByteIndex.toString()),
            document.createTextNode(String.fromCodePoint(charDisplayCodepoint)),
            errorByteIndex >= 0 ? document.createTextNode("(invalid)") : makeCodepointLinkElement(cp),
            document.createTextNode(errorByteIndex >= 0 ? "" : cp.toString()),
            this.makeHexBytesNode(charBytes, errorByteIndex, missingBytes,
                isOverlongEncoding,
                errorByteIndex < 0 && !isUnicodeCodepoint(cp), "UTF-8")
        ];
    }
}

function fillTable(outputElement, dynamicTableFiller) {
    const maxRows = 20;

    /* Find the table in the div */
    let table = outputElement.getElementsByTagName("TABLE");
    if (table.length == 0) {
        return false;
    }
    else {
        table = table[0];
    }

    for (let rowNum = 0; rowNum < maxRows; rowNum++) {
        /* Find the tr element for this row */
        let tr = table.getElementsByClassName("dyntable-row-" + rowNum.toString());
        let tdContents = dynamicTableFiller.nextRow();
        let tds = [];
        if (tdContents == null) {
            /* Get a reference to the table row but don't add anything to it */
            if (tr.length == 0) {
                tr = null;
            }
            else {
                tr = tr[0];
            }
        }
        else if (tr.length == 0) {
            /* This row doesn't exist yet - create it */
            tr = document.createElement("TR");
            tr.classList.add("dyntable");
            tr.classList.add("dyntable-row-" + rowNum.toString());

            let colgroup = table.getElementsByTagName("COLGROUP");
            let colTags = null;
            if (colgroup.length > 0) {
                colgroup = colgroup[0];
                colTags = colgroup.getElementsByTagName("COL");
            }

            for (let i = 0; i < tdContents.length; i++) {
                let td = document.createElement("TD");
                td.classList.add("outputvalue");

                /* List the classes which apply to the relevant <col> tag
                 * and apply them to the new <td> tag. */
                if (colTags != null && i < colTags.length) {
                    let cl = colTags[i].classList;
                    for (let j = 0; j < cl.length; j++) {
                        td.classList.add(cl[j]);
                    }
                    td.style.textAlign = colTags[i].style.textAlign;
                }
                tds.push(td);
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
        else {
            /* We only expect one row for each position */
            tr = tr[0];
            tds = tr.getElementsByTagName("TD");
        }

        if (tdContents == null) {
            if (tr) {
                tr.style.display = "none";
            }
        }
        else {
            tr.style.display = null;
            for (let i = 0; i < tdContents.length; i++) {
                tds[i].innerHTML = "";
                tds[i].appendChild(tdContents[i]);
            }
        }
    }

    dynamicTableFiller.finished(maxRows);

    return true;
}

function text2UnicodeFunc(inputValue, params, outputFlags, outputElement) {
    return fillTable(outputElement,
            new Text2UnicodeDynamicTableFiller(inputValue, outputElement)
    );
}

function bytes2TextFunc(inputValue, params, outputFlags, outputElement) {
    let filler;
    if (params["textdecoding"] == "utf8") {
        filler = new Bytes2UTF8DynamicTableFiller(inputValue, outputElement);
    }
    else {
        filler = new Bytes2UTF16DynamicTableFiller(inputValue, outputElement);
    }
    return fillTable(outputElement, filler);
}

function formatInt(n, fieldWidth) {
    let minus = (n < 0);
    return (minus ? "-" : "") + leftPad(Math.abs(n).toString(), '0', fieldWidth - (minus ? 1 : 0));
}

function dateToString(d, utc) {
    let year = utc ? d.getUTCFullYear() : d.getFullYear();
    let month = utc ? d.getUTCMonth() : d.getMonth();
    let date = utc ? d.getUTCDate() : d.getDate();
    let day = utc ? d.getUTCDay() : d.getDay();
    let hour = utc ? d.getUTCHours() : d.getHours();
    let minute = utc ? d.getUTCMinutes() : d.getMinutes();
    let second = utc ? d.getUTCSeconds() : d.getSeconds();
    let millisecond = utc ? d.getUTCMilliseconds() : d.getMilliseconds();

    if (isNaN(year)) {
        return null;
    }

    let timeZoneOffsetMinutes = utc ? 0 : d.getTimezoneOffset();

    /* Note that getTimezoneOffset() returns a positive number if your local
     * time zone is behind UTC, and negative if it's ahead, for reasons. */
    let timeZone = utc ? "+0000" : ((timeZoneOffsetMinutes <= 0 ? "+" : "-") +
        formatInt(Math.floor(Math.abs(timeZoneOffsetMinutes) / 60), 2) +
        formatInt(Math.floor(Math.abs(timeZoneOffsetMinutes) % 60), 2));

    return weekDayName(day) + " " +
        formatInt(year, 4) + "-" +
        formatInt(month + 1, 2) + "-" +
        formatInt(date, 2) + " " +
        formatInt(hour, 2) + ":" +
        formatInt(minute, 2) + ":" +
        formatInt(second, 2) + "." +
        formatInt(millisecond, 3) + " " +
        timeZone;
}

function dateValueToString(binaryInt, inputValue, params, utc) {
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

    try {
        let d = new Date(ms);
        return dateToString(d, utc);
    }
    catch (e) {
        if (e instanceof RangeError) {
            /* If it's more than 8640000000000 seconds (100 million
             * days) since the Unix epoch, we get a RangeError */
            return null;
        }
        else {
            throw e;
        }
    }
}

function dateValueToUTCString(binaryInt, inputValue, params) {
    return dateValueToString(binaryInt, inputValue, params, true);
}

function dateValueToLocalString(binaryInt, inputValue, params) {
    return dateValueToString(binaryInt, inputValue, params, false);
}

function initConversions() {
    createConversionFromBinaryInt("hex", binaryInt => "0x" + binaryInt.formatHex(false));
    createConversionFromBinaryInt("octal", binaryInt => "0o" + binaryInt.formatOctal());
    createConversionFromBinaryInt("binary", binaryInt => "0b" + binaryInt.formatBinary());
    createConversionFromBinaryInt("decimal", binaryInt => binaryInt.formatDecimal());

    let signedness = [ "signed", "unsigned" ];
    let numBits = [ 8, 16, 32, 64 ];
    for (let i = 0; i < signedness.length; i++) {
        for (let j = 0; j < numBits.length; j++) {
            for (let k = 0; k < 2; k++) {
                createConversionFromBinaryInt(
                    signedness[i] + numBits[j].toString() + (k == 0 ? "hex" : "dec"),
                    function(binaryInt, inputValue, params) {
                        return convertInt(inputValue, i == 0, numBits[j], k == 0);
                    }
                );
            }
        }
    }

    createConversionFromBinaryInt("fromunixutc", dateValueToUTCString);
    createConversionFromBinaryInt("fromunixlocal", dateValueToLocalString);

    createConversionFromBinaryInt("unicodecharacter",
        function(binaryInt, inputValue) {
            if (!(inputValue.isInteger() && isUnicodeCodepoint(inputValue.getInteger())))
                return null;
            return String.fromCodePoint(inputValue.getInteger());
        }
    );

    /* unicodecodepoint value is a link, so we can't use the helper function
     * which expects a convert function returning a string. */
    conversions["unicodecodepoint"] = new Conversion("binaryint", "unicodecodepooint",
        function(inputValue, params, outputFlags, outputElement) {
            outputElement.innerHTML = "";
            if (!(inputValue.isInteger() && isUnicodeCodepoint(inputValue.getInteger()))) {
                return false;
            }
            outputElement.appendChild(makeCodepointLinkElement(inputValue.getInteger()));
            return true;
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

    /* Byte string to UTF-8 decoding */
    conversions["bytes2text"] = new Conversion("bytes", "bytes2text", bytes2TextFunc);
}
