
const HEX_DIGITS = "0123456789ABCDEF";

const JS_MAX_SAFE_INTEGER = null;
const JS_MIN_SAFE_INTEGER = null;

let FLOATS_LITTLE_ENDIAN = null;

function isFloatLittleEndian() {
    if (FLOATS_LITTLE_ENDIAN === null) {
        /* 64-bit float representation of 1 is 0x3ff0000000000000 */
        let fa = new Float64Array(1);
        fa[0] = 1.0;
        let ba = new Uint8Array(fa.buffer);
        FLOATS_LITTLE_ENDIAN = (ba[0] == 0);
        console.log("Floats appear to be " + (FLOATS_LITTLE_ENDIAN ? "little" : "big") + "-endian.");
    }
    return FLOATS_LITTLE_ENDIAN;
}

function shiftLeft(bytes, numBits) {
    let overflow = false;

    if (numBits > 8) {
        /* Shift whole bytes first */
        for (let i = 0; i < numBits / 8; i++) {
            let b = bytes.shift();
            overflow = (b != 0);
            bytes.push(0);
        }
        bits %= 8;
    }

    /* Now shift the remaining bits. At this point, bits < 8. */
    let carry = 0;
    for (let i = 0; i < bytes.length; i++) {
        let b = bytes[i] << numBits;
        if (b > 0xff) {
            if (i == 0)
                carry |= b >> 8;
            else
                bytes[i - 1] |= b >> 8;
        }
        bytes[i] = b & 0xff;
    }

    overflow = overflow || (carry != 0);

    return overflow;
}

function addUnsignedBytes(bytes, x) {
    let carry = 0;
    let thisPos = bytes.length - 1;
    let xPos = x.length - 1;
    while (thisPos >= 0) {
        let sum = (xPos >= 0 ? x[xPos] : 0) + bytes[thisPos] + carry;
        bytes[thisPos] = sum & 0xff;
        carry = sum >> 8;
        xPos--;
        thisPos--;
    }
    return carry != 0;
}

function negateBytes(bytes) {
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = (~bytes[i]) & 0xff;
    }
    addUnsignedBytes(bytes, [1]);
}

function bytesIsZero(bytes) {
    for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] != 0)
            return false;
    }
    return true;
}

function textToByteArray(text, numBytes, signed) {
    let pos = 0;
    let base = 10;
    let minus = false;

    bytes = [];
    for (let i = 0; i < numBytes; i++) {
        bytes.push(0);
    }

    text = text.trim().toUpperCase();
    if (text.substr(pos, 1) == '-') {
        minus = true;
        pos += 1;
    }

    if (text.substr(pos, 2) == "0X") {
        base = 16;
        pos += 2;
    }

    if (pos >= text.length) {
        /* No digits? */
        return null;
    }

    for (; pos < text.length; pos++) {
        let c = text.charCodeAt(pos);
        let digit;
        if (c >= 0x30 && c <= 0x39) {
            digit = c - 0x30;
        }
        else if (base == 16 && c >= 0x41 && c <= 0x46) {
            digit = 10 + c - 0x41;
        }
        else {
            return null;
        }

        if (base == 16) {
            if (shiftLeft(bytes, 4))
                return null;
        }
        else {
            /* Multiply by 10 */
            if (shiftLeft(bytes, 1))
                return null;
            let x = [...bytes];
            if (shiftLeft(bytes, 2))
                return null;
            if (addUnsignedBytes(bytes, x))
                return null;
        }
        if (addUnsignedBytes(bytes, [digit]))
            return null;
    }
    if (minus) {
        negateBytes(bytes);
        if ((bytes[0] & 0x80) == 0 && !bytesIsZero(bytes)) {
            /* If after making this negative it's positive and nonzero, overflow. */
            return null;
        }
    }

    /* If we're a signed integer, and there was no minus sign, and the input
     * was in base 10, and the top bit is now set, return null. This is what
     * happens when you input, say, "128" to an 8-bit signed integer. We get
     * 0x80 but 128 can't be expressed in an 8-bit signed integer. */
    if (signed && !minus && base == 10 && (this.bytes[0] & 0x80) != 0) {
        return null;
    }

    return bytes;
}

function buildFloat(sign, exponent, rawMantissa, mantissa, maxExp) {
    let n = mantissa;
    if (exponent == maxExp) {
        if (rawMantissa != 0)
            return NaN;
        else if (s)
            return -Infinity;
        else
            return Infinity;
    }
    else {
        n *= 2 ** exponent;
    }

    if (sign)
        n = -n;

    return n;
}

/* Binary integer of arbitrary fixed size. */
class BinaryInt {
    constructor(bytes, signed) {
        this.bytes = bytes;
        this.signed = signed;
    }

    isNegative() {
        return this.signed && (this.bytes[0] & 0x80) != 0;
    }

    isZero() {
        for (let i = 0; i < this.bytes.length; i++) {
            if (this.bytes[i] != 0)
                return false;
        }
        return true;
    }

    negate() {
        negateBytes(this.bytes);
    }

    swapEndianity() {
        let l = 0;
        let r = this.bytes.length - 1;
        while (l < r) {
            let tmp = this.bytes[l];
            this.bytes[l] = this.bytes[r];
            this.bytes[r] = tmp;
            l++;
            r--;
        }
    }

    isMostNegativeInteger() {
        if (!this.signed || this.bytes[0] != 0x80)
            return false;
        for (let i = 1; i < this.bytes.length; i++) {
            if (this.bytes[i] != 0)
                return false;
        }
        return true;
    }

    formatHex(leadingZeroes=true) {
        let nibbles = [];
        for (let i = 0; i < this.bytes.length; i++) {
            let b = this.bytes[i];
            nibbles.push(HEX_DIGITS[b >> 4]);
            nibbles.push(HEX_DIGITS[b & 15]);
        }
        if (!leadingZeroes) {
            while (nibbles.length > 1 && nibbles[0] == '0') {
                nibbles.shift();
            }
        }
        return nibbles.join("");
    }

    getJSInt() {
        /* If the integer falls in the range
         * [ Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER ]
         * then return that as an ordinary number. Otherwise return null. */
        if (this.ge(BinaryInt.JS_MIN_SAFE_INTEGER) && this.le(BinaryInt.JS_MAX_SAFE_INTEGER)) {
            let n = 0;
            if (this.isNegative()) {
                /* Each base-256 "digit" x counts for -(255 - x) in that
                 * position, except for the last one which counts -(256 - x).
                 * So 0xffffffff is:
                 *     -(0 * 256^3 + 0 * 256^2 + 0 * 256^1 + 1 * 256^0).
                 */
                for (let i = 0; i < this.bytes.length; i++) {
                    n *= 256;
                    n -= 255 + (i == this.bytes.length - 1 ? 1 : 0) - this.bytes[i];
                }
            }
            else {
                for (let i = 0; i < this.bytes.length; i++) {
                    n *= 256;
                    n += this.bytes[i];
                }
            }
            return n;
        }
        else {
            return null;
        }
    }

    getSign() {
        if (this.isNegative()) {
            return -1;
        }
        else if (this.isZero()) {
            return 0;
        }
        else {
            return 1;
        }
    }

    /* Return -1, 0 or -1 if this is respectively less than, equal to, or
     * greater than, other. */
    cmp(other) {
        let thisSign = this.getSign();
        let otherSign = other.getSign();
        if (thisSign < otherSign)
            return -1;
        else if (thisSign > otherSign)
            return 1;
        else if (thisSign == 0 && otherSign == 0)
            return 0;

        /* If we get here, both numbers have the same sign and neither number
         * is zero. */
        let length = Math.max(this.bytes.length, other.bytes.length);
        let thisIndex = this.bytes.length - length;
        let otherIndex = other.bytes.length - length;
        let signPad = (thisSign < 0 ? 0xff : 0);
        while (thisIndex < this.bytes.length) {
            let thisByte = (thisIndex < 0) ? signPad : this.bytes[thisIndex];
            let otherByte = (otherIndex < 0) ? signPad : other.bytes[otherIndex];
            if (thisByte != otherByte) {
                if (thisByte < otherByte)
                    return -1;
                else
                    return 1;
            }
            thisIndex++;
            otherIndex++;
        }
        return 0;
    }

    eq(other) {
        return this.cmp(other) == 0;
    }

    gt(other) {
        return this.cmp(other) > 0;
    }

    lt(other) {
        return this.cmp(other) < 0;
    }

    ge(other) {
        return this.cmp(other) >= 0;
    }

    le(other) {
        return this.cmp(other) <= 0;
    }

    addByte(n) {
        let carry = n;
        for (let i = this.bytes.length - 1; i >= 0; i--) {
            if (carry == 0)
                return true;
            this.bytes[i] += carry;
            carry = this.bytes[i] >> 8;
            this.bytes[i] &= 0xff;
        }
        return carry == 0;
    }

    increment() {
        return this.addByte(1);
    }

    subtractByte(n) {
        let borrow = n;
        for (let i = this.bytes.length - 1; i >= 0; i--) {
            if (borrow == 0)
                return true;
            this.bytes[i] -= borrow;
            if (this.bytes[i] < 0) {
                borrow = 1;
                this.bytes[i] += 256;
            }
            else {
                borrow = 0;
            }
        }
        return borrow == 0;
    }

    decrement() {
        return this.subtractByte(1);
    }

    shiftLeft(bits) {
        return !shiftLeft(this.bytes, bits);
    }

    shiftRight(bits) {
        let padByte = this.isNegative() ? 0xff : 0;
        while (bits >= 8) {
            this.bytes.pop();
            this.bytes.unshift(padByte);
        }
        if (bits > 0) {
            let readMask = (1 << bits) - 1;
            let carry = padByte & readMask;
            for (let i = 0; i < this.bytes.length; i++) {
                /* Shift in from the previous byte */
                let shiftedIn = carry << (8 - bits);
                carry = this.bytes[i] & readMask;
                this.bytes[i] >>= bits;
                this.bytes[i] |= shiftedIn;
            }
        }
        return true;
    }

    endianSwap(numBytes) {
        if (numBytes > this.bytes.length)
            return false;

        let padByte = this.isNegative() ? 0xff : 0;

        /* If numBytes < this.bytes.length, discard the top unswapped bytes and
         * set them all to 0 of 0xff depending on the value's sign. */
        for (let i = 0; i < this.bytes.length - numBytes; i++) {
            this.bytes[i] = padByte;
        }

        let l = this.bytes.length - numBytes;
        let r = this.bytes.length - 1;
        while (l < r) {
            let tmp = this.bytes[l];
            this.bytes[l] = this.bytes[r];
            this.bytes[r] = tmp;
            l++;
            r--;
        }

        return true;
    }

    formatDecimal() {
        let digits = [];
        if (this.isZero()) {
            return "0";
        }
        let x = this.copy();
        let minus = false;
        let addOne = false;

        if (x.isMostNegativeInteger()) {
            /* Most negative integer can't be negated, so add 1 now then
             * correct for it afterwards. */
            addOne = true;
            addUnsignedBytes(x.bytes, [1]);
        }
        if (x.isNegative()) {
            minus = true;
            x.negate();
        }
        while (!x.isZero()) {
            digits.push(x.unsignedDivideBy(10));
        }
        if (addOne) {
            /* 2^x-1 never ends with a 9, so don't need to handle carry here */
            digits[0]++;
        }

        let digitChars = [];
        if (minus)
            digitChars.push("-");
        for (let i = digits.length - 1; i >= 0; i--) {
            digitChars.push(digits[i].toString());
        }
        return digitChars.join("");
    }

    unsignedDivideBy(divisorByte) {
        /* Base-256 long division.
         * divisorByte must be an integer in the range [1, 255]. */
        let quotient = [];
        let numerator = 0;
        let remainder = 0;
        for (let i = 0; i < this.bytes.length; i++) {
            numerator *= 256;
            numerator += this.bytes[i];
            if (numerator >= divisorByte) {
                quotient.push(Math.floor(numerator / divisorByte));
                remainder = numerator % divisorByte;
                this.bytes[i] = remainder;
                numerator = remainder;
            }
            else {
                remainder = this.bytes[i];
                this.bytes[i] = 0;
                quotient.push(0);
            }
        }

        /* Leave the quotient in this object, and return the remainder, which
         * will be less than divisorByte and thus less than 256. */
        this.bytes = quotient;
        return remainder;
    }

    getBit(bit) {
        let byteOffset = this.bytes.length - 1 - Math.floor(bit / 8);
        let mask = 1 << (bit % 8);
        if (byteOffset < 0) {
            return 0;
        }
        else if (this.bytes[byteOffset] & mask) {
            return 1;
        }
        else {
            return 0;
        }
    }

    extractBits(topBit, length) {
        let n = 0;
        for (let i = topBit; i > topBit - length; i--) {
            n *= 2;
            n += this.getBit(i);
        }
        return n;
    }

    getCastFloat32Sign() {
        return this.getBit(31);
    }

    getCastFloat64Sign() {
        return this.getBit(63);
    }

    getCastFloat32Exponent(raw=false) {
        let rawExponent = this.extractBits(30, 8);
        if (raw) {
            return rawExponent;
        }
        else {
            if (rawExponent == 0)
                return -126;
            else
                return rawExponent - 127;
        }
    }

    getCastFloat64Exponent(raw=false) {
        let rawExponent = this.extractBits(62, 11);
        if (raw) {
            return rawExponent;
        }
        else {
            if (rawExponent == 0)
                return -1022;
            else
                return rawExponent - 1023;
        }
    }

    getCastFloat32Mantissa(raw=false) {
        return this.getCastFloatMantissa(raw, this.getCastFloat32Exponent(true), 22, 23);
    }

    getCastFloat64Mantissa(raw=false) {
        return this.getCastFloatMantissa(raw, this.getCastFloat64Exponent(true), 51, 52);
    }

    getCastFloatMantissa(raw, rawExponent, mantissaBitStart, mantissaBitLength) {
        let rawMantissa = this.extractBits(mantissaBitStart, mantissaBitLength);
        if (raw) {
            return rawMantissa;
        }
        else {
            let mantissa = 0;
            if (rawExponent != 0)
                mantissa = 1.0;
            if (rawMantissa != 0) {
                let bitValue = 1.0;
                for (let i = 0; i < mantissaBitLength; i++) {
                    bitValue /= 2;
                    if (this.getBit(mantissaBitStart - i)) {
                        mantissa += bitValue;
                    }
                }
            }
            return mantissa;
        }
    }

    getCastFloat32() {
        let sign = this.getCastFloat32Sign();
        let exponent = this.getCastFloat32Exponent();
        let rawMantissa = this.getCastFloat32Mantissa(true);
        let mantissa = this.getCastFloat32Mantissa();
        return buildFloat(sign, exponent, rawMantissa, mantissa, 128);
    }

    getCastFloat64() {
        let sign = this.getCastFloat64Sign();
        let exponent = this.getCastFloat64Exponent();
        let rawMantissa = this.getCastFloat64Mantissa(true);
        let mantissa = this.getCastFloat64Mantissa();
        return buildFloat(sign, exponent, rawMantissa, mantissa, 1024);
    }

    copy() {
        return new BinaryInt([...this.bytes], this.signed);
    }
}

function createBinaryIntFromString(text, numBytes, signed) {
    let bytes = textToByteArray(text, numBytes, signed);
    if (bytes == null)
        return null;
    return new BinaryInt(bytes, signed);
}

function createBinaryIntFromFloat64Bin(f) {
    let fa = new Float64Array(1);
    fa[0] = f;
    let bytes = new Uint8Array(fa.buffer);
    let bytesSwapped = [];
    if (isFloatLittleEndian()) {
        for (let i = 0; i < 8; i++) {
            bytesSwapped.push(bytes[7 - i]);
        }
    }
    else {
        for (let i = 0; i < 8; i++) {
            bytesSwapped.push(bytes[i]);
        }
    }
    return new BinaryInt(bytesSwapped, false);
}

function createBinaryIntFromFloat32Bin(f) {
    let fa = new Float32Array(1);
    fa[0] = f;
    let bytes = new Uint8Array(fa.buffer);
    let bytesSwapped = [];
    if (isFloatLittleEndian()) {
        for (let i = 0; i < 4; i++) {
            bytesSwapped.push(bytes[3 - i]);
        }
    }
    else {
        for (let i = 0; i < 4; i++) {
            bytesSwapped.push(bytes[i]);
        }
    }
    return new BinaryInt(bytesSwapped, false);
}

function createBinaryIntFromFloatBin(f, fBits) {
    if (fBits == 32) {
        return createBinaryIntFromFloat32Bin(f);
    }
    else if (fBits == 64) {
        return createBinaryIntFromFloat64Bin(f);
    }
    else {
        throw new Error("createBinaryIntFromFloatBin() called with fBits=" + fBits.toString());
    }
}

BinaryInt.JS_MAX_SAFE_INTEGER = createBinaryIntFromString(Number.MAX_SAFE_INTEGER.toString(), 8, true);
BinaryInt.JS_MIN_SAFE_INTEGER = createBinaryIntFromString(Number.MIN_SAFE_INTEGER.toString(), 8, true);


/* Test functions */

function testBinaryIntCase(n, numBytes, signed) {
    let b = createBinaryIntFromString(n.toString(), numBytes, signed);
    let expectedDecimal = n.toString();
    let expectedHex = (n < 0 ? (256 ** numBytes + n) : n).toString(16).toUpperCase();
    while (expectedHex.length < numBytes * 2) {
        expectedHex = "0" + expectedHex;
    }
    let observedDecimal = b.formatDecimal();
    let observedHex = b.formatHex();
    if (observedDecimal != expectedDecimal) {
        console.log("n " + n.toString() + ", formatDecimal() returned " + observedDecimal);
        return false;
    }
    if (observedHex != expectedHex) {
        console.log("n " + n.toString() + ", formatHex() returned " + observedHex + ", expected " + expectedHex);
        return false;
    }
    return true;
}

function testBinaryIntFormat(numBytes, numTests) {
    let failed = false;
    let unsignedMax = 256 ** numBytes;
    if (numBytes > 4) {
        console.log("Usage: testBinaryIntFormt(numBytes <= 4, numTests >= 0);");
        return;
    }
    for (let i = 1; i <= numTests; i++) {
        let n = Math.floor(Math.random() * unsignedMax) - unsignedMax / 2;
        if (!testBinaryIntCase(n, numBytes, true)) {
            console.log("Test " + i.toString() + "/" + numTests.toString() + " failed.");
            failed = true;
            break;
        }
    }
    if (!failed) {
        console.log(numTests.toString() + " tests passed.");
    }
}

function randomSignedness(n, maxSignedValue) {
    if (n < 0)
        return true;
    else if (n > maxSignedValue)
        return false;
    else
        return Math.random() < 0.5;
}

function testBinaryIntCmp(numBytes, numTests) {
    let failed = false;
    let unsignedMax = 256 ** numBytes;
    if (numBytes > 4) {
        console.log("Usage: testBinaryIntCmp(numBytes > 4, numTests >= 0);");
        return;
    }

    for (let i = 1; i <= numTests; i++) {
        let a = Math.floor(Math.random() * unsignedMax) - unsignedMax / 2;
        let b = Math.floor(Math.random() * unsignedMax) - unsignedMax / 2;
        let aSigned = randomSignedness(a, unsignedMax / 2 - 1);
        let bSigned = randomSignedness(b, unsignedMax / 2 - 1);
        let aBin = createBinaryIntFromString(a.toString(), numBytes, aSigned);
        let bBin = createBinaryIntFromString(b.toString(), numBytes, bSigned);
        let expectedCmp;
        if (a < b)
            expectedCmp = -1;
        else if (a == b)
            expectedCmp = 0;
        else
            expectedCmp = 1;
        let observedCmp = aBin.cmp(bBin);
        if (expectedCmp != observedCmp) {
            console.log("Test " + i.toString() + "/" + numTests.toString() + ": a " + a.toString() + ", b " + b.toString() + ", expected cmp " + expectedCmp.toString() + ", observed cmp " + observedCmp.toString());
            failed = true;
            break;
        }
    }
    if (!failed) {
        console.log(numTests.toString() + " tests passed.");
    }
}

function testExhaustiveBinaryIntFormat(numBytes) {
    let numBits = numBytes * 8;
    let numTests = 0;
    let failed = false;
    let minCase = -(2 ** (numBits - 1));
    let maxCase = 2 ** (numBits - 1) - 1;

    for (let n = minCase; n <= maxCase; n++) {
        if (!testBinaryIntCase(n, numBytes, true)) {
            failed = true;
            break;
        }
        numTests++;
    }
    if (!failed) {
        console.log(numTests.toString() + " signed tests (" + minCase.toString() + " to " + maxCase.toString() + ") passed.");
    }
    else {
        return;
    }

    numTests = 0;
    minCase = 0;
    maxCase = 2 ** numBits - 1;
    for (let n = minCase; n <= maxCase; n++) {
        if (!testBinaryIntCase(n, numBytes, false)) {
            failed = true;
            break;
        }
        numTests++;
    }
    if (!failed) {
        console.log(numTests.toString() + " unsigned tests (" + minCase.toString() + " to " + maxCase.toString() + ") passed.");
    }
}
