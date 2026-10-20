/* References to fixed HTML elements */

/* Input box */
let inputBox = document.getElementById("inputbox");

/* <h2> tag for output */
let outputHeading = document.getElementById("outputheading");

/* Outputs for the sign, exponent and mantissa fields of the float, and the
 * full hex and decimal strings. */
let outputSignRaw = document.getElementById("signraw");
let outputExponentRaw = document.getElementById("exponentraw");
let outputMantissaRaw = document.getElementById("mantissaraw");
let outputValueRaw = document.getElementById("valuehex");
let outputSignValue = document.getElementById("signvalue");
let outputExponentValue = document.getElementById("exponentvalue");
let outputMantissaValue = document.getElementById("mantissavalue");
let outputValueDecimal = document.getElementById("valuedecimal");

/* <a> tags for linking back to the Bitlump main page with the two main
 * output fields, the hex and decimal representations of the value */
let linkValueRaw = document.getElementById("valuehexlink");
let linkValueDecimal = document.getElementById("valuedecimallink");

/* Buttons for 16/32/64-bit selection */
let floatSchemeInputs = [
    document.getElementById("floatscheme16"),
    document.getElementById("floatscheme32"),
    document.getElementById("floatscheme64")
];

/* Drop-down list containing the input formats */
let floatInputSelector = document.getElementById("floatinputformat");

/* Three table cells containing the bit-buttons for the sign bit, the
 * exponent bits, and the mantissa bits. */
let signBitButtonsCell = document.getElementById("signbitbuttons");
let exponentBitButtonsCell = document.getElementById("exponentbitbuttons");
let mantissaBitButtonsCell = document.getElementById("mantissabitbuttons");

/* Decrement/increment buttons */
let decrementExponentButton = document.getElementById("decrementexponent");
let incrementExponentButton = document.getElementById("incrementexponent");
let decrementMantissaButton = document.getElementById("decrementmantissa");
let incrementMantissaButton = document.getElementById("incrementmantissa");

/* Other bit manipulation buttons */
let endianSwapButton = document.getElementById("endianswap");
let flipBitsButton = document.getElementById("flipbits");
let setZeroButton = document.getElementById("setzero");

/* Link for the "IEEE 754 hex encoding" text */
let ieee754EncodingLink = document.createElement("A");
ieee754EncodingLink.setAttribute("target", "_blank");
ieee754EncodingLink.innerText = "IEEE 754 hex encoding";

/* <th> tags containing the headings for the main outputs - the contents
 * vary depending on whether the user has entered a string or binary
 * representation of a float. */
let valueHexTitle = document.getElementById("valuehextitle");

/* key (e.g. "negative" or "zero") maps to list of HTML elements to be given
 * the fpconditionlit class when that condition applies. */
let fpConditionLights = {};

/* Buttons, one per bit, with which the user can toggle the float's bits. */
let signBitButton = null;
let exponentBitButtons = [];
let mantissaBitButtons = [];

/* A bit-button-shaped thing which isn't a real button, it just shows the value
 * of the implied leading mantissa bit, which is usually 1 (unless the number
 * is subnormal) and does not actually appear in the encoding. */
let impliedMantissaBit = document.createElement("DIV");
impliedMantissaBit.classList.add("leadingmantissadigit");
impliedMantissaBit.innerText = "1.";

/* A BinaryInt object converted from either the decimal input box or the hex
 * input box. This is where we remember the binary reprsentation of the float
 * value we're currently showing.
 * If the input is invalid, inputFloatBinary is null. */
let inputFloatBinary = null;

/* One of the FPScheme objects from floatSchemes (see below) */
let currentFloatScheme = null;

/* Functions for manipulating the state of the bit-toggling buttons, and
 * for recreating them when we select a different precision. */
function setBitButtonValue(button, value) {
    if (value) {
        button.innerText = "1";
        button.setAttribute("data-value", 1);
    }
    else {
        button.innerText = "0";
        button.setAttribute("data-value", 0);
    }
}

function clearBitButtonValues() {
    setBitButtonValue(signBitButton, 0);
    for (let i = 0; i < exponentBitButtons.length; i++) {
        setBitButtonValue(exponentBitButtons[i], 0);
    }
    for (let i = 0; i < mantissaBitButtons.length; i++) {
        setBitButtonValue(mantissaBitButtons[i], 0);
    }
}

function recreateBitButtons(scheme) {
    signBitButton = scheme.createSignBitButton();
    exponentBitButtons = scheme.createExponentBitButtons();
    mantissaBitButtons = scheme.createMantissaBitButtons();
    signBitButtonsCell.innerHTML = "";
    exponentBitButtonsCell.innerHTML = "";
    mantissaBitButtonsCell.innerHTML = "";

    signBitButtonsCell.appendChild(signBitButton);

    let buttonLists = [
        [ exponentBitButtons, exponentBitButtonsCell ],
        [ mantissaBitButtons, mantissaBitButtonsCell ]
    ];

    for (let i = 0; i < buttonLists.length; i++) {
        let src = buttonLists[i][0];
        let dest = buttonLists[i][1];
        if (i == 1) {
            /* Display the implied leading "1." at the start of the mantissa */
            dest.appendChild(impliedMantissaBit);
        }
        for (let j = 0; j < src.length; j++) {
            let bitsFromEnd = src.length - 1 - j;
            dest.appendChild(src[j]);
            if (bitsFromEnd > 0) {
                if (bitsFromEnd % 8 == 0) {
                    dest.appendChild(document.createElement("BR"));
                }
                else if (bitsFromEnd % 4 == 3) {
                    src[j].classList.add("bitbuttonstartofgroup");
                }
            }
        }
    }
}

/* Functions for manipulating the state of the condition lights on the display:
 * negative, zero, subnormal, infinity, NaN. */
function setFPConditionLight(key, on) {
    let list = fpConditionLights[key];
    if (list) {
        for (let i = 0; i < list.length; i++) {
            let l = list[i];
            if (on) {
                if (!l.classList.contains("fpconditionlit")) {
                    l.classList.add("fpconditionlit");
                }
            }
            else {
                if (l.classList.contains("fpconditionlit")) {
                    l.classList.remove("fpconditionlit");
                }
            }
        }
    }
}

function clearFPConditionLights() {
    for (let key in fpConditionLights) {
        setFPConditionLight(key, false);
    }
}

function makeBitMask(sizeBytes, topBit, numBits) {
    let bin = createBinaryIntFromHex("0x00", sizeBytes);
    for (let bit = topBit; bit > topBit - numBits; bit--) {
        bin.toggleBit(bit);
    }
    return bin;
}


/* FPScheme: represents a floating-point precision and associated encoding
 * such as single-precision or double-precision. Bit positions and counts are
 * supplied on construction. */
class FPScheme {
    constructor(precisionWord, numBits, signBitIndex,
            topExpBitIndex, numExpBits, topMantissaBitIndex, numMantissaBits,
            expBias, roundTripDecimalDigits) {
        this.precisionWord = precisionWord;
        this.numBits = numBits;
        this.signBitIndex = signBitIndex;
        this.topExpBitIndex = topExpBitIndex;
        this.numExpBits = numExpBits;
        this.topMantissaBitIndex = topMantissaBitIndex;
        this.numMantissaBits = numMantissaBits;
        this.expBias = expBias;

        /* Raw exponent of all 1s is a NaN, raw exponent of all 0s is a
         * subnormal or zero value. The other values are actual exponent
         * values, with a bias added. */
        this.minExp = -this.expBias;
        this.minNormalExp = this.minExp + 1;
        this.maxNormalExp = Math.pow(2, numExpBits) - 2 - this.expBias;
        this.maxExp = this.maxNormalExp + 1;

        this.roundTripDecimalDigits = roundTripDecimalDigits;
        this.exponentHexDigits = Math.ceil(numExpBits / 4);
        this.mantissaHexDigits = Math.ceil(numMantissaBits / 4);

        /* Various other constants related to this floating-point precision
         * rather than to any specific value */
        const sizeBytes = Math.floor(this.numBits / 8);
        this.signBitMask = makeBitMask(sizeBytes, this.signBitIndex, 1);
        this.exponentBitMask = makeBitMask(sizeBytes, this.topExpBitIndex, this.numExpBits);
        this.mantissaBitMask = makeBitMask(sizeBytes, this.topMantissaBitIndex, this.numMantissaBits);
        this.smallestSubnormalBinary = createBinaryIntFromHex("0x01", sizeBytes);
        this.largestSubnormalBinary = this.mantissaBitMask.copy();
        this.smallestNormalBinary = createBinaryIntFromHex("0x00", sizeBytes);
        this.smallestNormalBinary.toggleBit(this.topExpBitIndex - this.numExpBits + 1);
        this.largestNormalBinary = this.exponentBitMask.copy();
        this.largestNormalBinary.toggleBit(this.topExpBitIndex - this.numExpBits + 1); /* maxExp - 1 */
        this.largestNormalBinary.bitwiseOr(this.mantissaBitMask);
    }

    getNumBits() {
        return this.numBits;
    }

    getRoundTripDecimalDigits() {
        return this.roundTripDecimalDigits;
    }

    getPrecisionWord() {
        return this.precisionWord;
    }

    getNumExponentBits() {
        return this.numExpBits;
    }

    getExponentBias() {
        return this.expBias;
    }

    getNumMantissaBits() {
        return this.numMantissaBits;
    }

    getSubnormalExponent() {
        return this.minNormalExp;
    }

    getMinExponent() {
        return this.minNormalExp;
    }

    getMaxExponent() {
        return this.maxNormalExp;
    }

    getSignBitMask() {
        return "0x" + this.signBitMask.formatHex();
    }

    getExponentBitMask() {
        return "0x" + this.exponentBitMask.formatHex();
    }

    getMantissaBitMask() {
        return "0x" + this.mantissaBitMask.formatHex();
    }

    getSmallestSubnormalString() {
        return this.getValueString(this.smallestSubnormalBinary);
    }

    getSmallestSubnormalHex() {
        return "0x" + this.getHex(this.smallestSubnormalBinary);
    }

    getLargestSubnormalString() {
        return this.getValueString(this.largestSubnormalBinary);
    }

    getLargestSubnormalHex() {
        return "0x" + this.getHex(this.largestSubnormalBinary);
    }

    getSmallestNormalString() {
        return this.getValueString(this.smallestNormalBinary);
    }

    getSmallestNormalHex() {
        return "0x" + this.getHex(this.smallestNormalBinary);
    }

    getLargestNormalString() {
        return this.getValueString(this.largestNormalBinary);
    }

    getLargestNormalHex() {
        return "0x" + this.getHex(this.largestNormalBinary);
    }

    isNegative(bin) {
        return bin.getBit(this.signBitIndex);
    }

    isZero(bin) {
        return this.getExponentRaw(bin) == 0 && this.getMantissaRaw(bin) == 0;
    }

    isSubnormal(bin) {
        return this.getExponentRaw(bin) == 0 && this.getMantissaRaw(bin) != 0;
    }

    isInfinity(bin) {
        return this.getExponentRaw(bin) == (1 << this.numExpBits) - 1 && this.getMantissaRaw(bin) == 0;
    }

    isNotANumber(bin) {
        return this.getExponentRaw(bin) == (1 << this.numExpBits) - 1 && this.getMantissaRaw(bin) != 0;
    }

    getSign(bin) {
        return this.isNegative(bin) ? "-" : "+";
    }

    getExponentRaw(bin) {
        return bin.extractBits(this.topExpBitIndex, this.numExpBits);
    }

    getExponentRawHex(bin) {
        return intToHex(this.getExponentRaw(bin), this.exponentHexDigits, true);
    }

    getExponent(bin) {
        let rawExp = this.getExponentRaw(bin);
        if (rawExp == 0) {
            /* Value is subnormal or zero */
            return this.minNormalExp;
        }
        else {
            return rawExp - this.expBias;
        }
    }

    getMantissaRaw(bin) {
        return bin.extractBits(this.topMantissaBitIndex, this.numMantissaBits);
    }

    getMantissaRawHex(bin) {
        return intToHex(this.getMantissaRaw(bin), this.mantissaHexDigits, true);
    }

    getMantissa(bin) {
        return bin.getCastFloatMantissa(false, this.getExponentRaw(bin), this.topMantissaBitIndex, this.numMantissaBits);
    }

    getMantissaString(bin) {
        return this.getMantissa(bin).toFixed(this.roundTripDecimalDigits - 1);
    }

    getMantissaBinary(bin) {
        let str = "";
        if (this.isSubnormal(bin)) {
            str += "0.";
        }
        else {
            str += "1.";
        }
        for (let bit = this.topMantissaBitIndex; bit > this.topMantissaBitIndex - this.numMantissaBits; bit--) {
            str += bin.getBit(bit) ? "1" : "0";
        }
        return str;
    }


    getHex(bin) {
        return bin.formatHex();
    }

    getValue(bin) {
        return buildFloat(this.isNegative(bin), this.getExponent(bin),
            this.getMantissaRaw(bin), this.getMantissa(bin), this.maxExp);
    }

    getValueString(bin) {
        return this.getValue(bin).toPrecision(this.roundTripDecimalDigits);
    }

    createBitToggleButton(bitIndex) {
        let button = document.createElement("BUTTON");
        let b = bitIndex;
        let scheme = this;
        button.innerText = "0";
        button.classList.add("bitbutton");
        button.addEventListener("click", function() {
            if (inputFloatBinary != null) {
                inputFloatBinary.toggleBit(b);
                updateDisplayFromBinary(inputFloatBinary, true, scheme);
            }
        });
        return button;
    }

    createSignBitButton() {
        return this.createBitToggleButton(this.signBitIndex);
    }

    createBitButtonList(topBitIndex, numBits) {
        let l = [];
        for (let i = 0; i < numBits; i++) {
            l.push(this.createBitToggleButton(topBitIndex - i));
        }
        return l;
    }

    createExponentBitButtons() {
        return this.createBitButtonList(this.topExpBitIndex, this.numExpBits);
    }

    createMantissaBitButtons() {
        return this.createBitButtonList(this.topMantissaBitIndex, this.numMantissaBits);
    }

    setButtonValues(bin) {
        setBitButtonValue(signBitButton, this.isNegative(bin));
        for (let i = 0; i < this.numExpBits; i++) {
            if (i >= exponentBitButtons.length) {
                break;
            }
            setBitButtonValue(exponentBitButtons[i], bin.getBit(this.topExpBitIndex - i));
        }
        for (let i = 0; i < this.numMantissaBits; i++) {
            if (i >= mantissaBitButtons.length) {
                break;
            }
            setBitButtonValue(mantissaBitButtons[i], bin.getBit(this.topMantissaBitIndex - i));
        }
        impliedMantissaBit.innerText = (this.isSubnormal(bin) || this.isZero(bin)) ? "0." : "1.";
    }

    /* Delta must be -1 or 1 */
    modifyExponent(bin, delta) {
        if (delta > 0) {
            bin.incrementFromBit(this.topExpBitIndex - this.numExpBits + 1);
        }
        else if (delta < 0) {
            bin.decrementFromBit(this.topExpBitIndex - this.numExpBits + 1);
        }
    }

    /* Delta must be -1 or 1 */
    modifyMantissa(bin, delta) {
        if (delta > 0) {
            bin.increment();
        }
        else if (delta < 0) {
            bin.decrement();
        }
    }
}

/* List of all floating-point schemes (FPScheme). The key to this map is
 * the number of bits, which must be the same as the "value" attribute of
 * the associated radio button. */
let floatSchemes = {
    16 : new FPScheme("half", 16, 15, 14, 5, 9, 10, 15, 5),
    32 : new FPScheme("single", 32, 31, 30, 8, 22, 23, 127, 9),
    64 : new FPScheme("double", 64, 63, 62, 11, 51, 52, 1023, 17),
};

/* Return the number of bits in the currently-selected float precision. */
function getFloatBits() {
    return currentFloatScheme.getNumBits();
}

/* Return the FPScheme object last selected by one of the precision buttons. */
function getFloatScheme() {
    return currentFloatScheme;
}

/* Return the value of the <option> element selected in the "input format"
 * drop-down. Example values are "string" and "hex". */
function getInputFormat() {
    for (let i = 0; i < floatInputSelector.options.length; i++) {
        let option = floatInputSelector.options[i];
        if (option.selected) {
            return option.value;
        }
    }
    return null;
}

/* Update the query-string of the URL in the address bar to reflect the
 * currently selected precision and the current input. */
function updateURL() {
    let bits = getFloatBits();
    let format = getInputFormat();
    let params = {};

    if (bits) {
        params["p"] = bits;
    }
    if (format == "string" && inputBox.value.length > 0) {
        params["f"] = inputBox.value;
    }
    else if (format == "hex" && inputBox.value.length > 0) {
        params["h"] = inputBox.value;
    }

    let newUrl = "?" + buildQueryString(params);

    if (window.history.replaceState) {
        window.history.replaceState(null, null, newUrl);
    }
}

/* Update the state of the output fields, bit-toggling buttons, and
 * long-winded explanation column, to reflect the IEEE 754 bit pattern
 * represented by "bin". */
function updateDisplay(bin) {
    let scheme = getFloatScheme();
    if (scheme == null || bin == null) {
        outputSignRaw.innerText = "";
        outputExponentRaw.innerText = "";
        outputMantissaRaw.innerText = "";
        outputValueRaw.innerText = "(invalid input)";
        outputSignValue.innerText = "";
        outputExponentValue.innerText = "";
        outputMantissaValue.innerText = "";
        outputValueDecimal.innerText = "(invalid input)";
        linkValueRaw.href = null;
        linkValueDecimal.href = null;
        clearBitButtonValues();
        clearFPConditionLights();
        inputBox.classList.add("invalidinput");
        return null;
    }

    if (inputBox.classList.contains("invalidinput")) {
        inputBox.classList.remove("invalidinput");
    }

    const hexValue = "0x" + scheme.getHex(bin);
    const decimalValue = scheme.getValueString(bin);
    const exponentRawHex = scheme.getExponentRawHex(bin);
    const exponentRaw = scheme.getExponentRaw(bin);
    const exponent = scheme.getExponent(bin);
    const mantissaRawHex = scheme.getMantissaRawHex(bin);
    const mantissaBinary = scheme.getMantissaBinary(bin);
    const mantissaString = scheme.getMantissaString(bin);
    const isNegative = scheme.isNegative(bin);
    const isSubnormal = scheme.isSubnormal(bin);
    const isZero = scheme.isZero(bin);
    const isNotANumber = scheme.isNotANumber(bin);
    const isInfinity = scheme.isInfinity(bin);

    outputSignRaw.innerText = isNegative ? "1" : "0";
    outputExponentRaw.innerText = exponentRawHex;
    outputMantissaRaw.innerText = mantissaRawHex;
    outputValueRaw.innerText = hexValue;

    outputSignValue.innerText = scheme.getSign(bin);
    outputExponentValue.innerText = exponent.toString();
    outputMantissaValue.innerText = mantissaString;
    outputValueDecimal.innerText = decimalValue;

    linkValueRaw.href = "index.html?i=" + encodeURIComponent(hexValue);
    linkValueDecimal.href = "index.html?i=" + encodeURIComponent(decimalValue);

    setFPConditionLight("subnormal", isSubnormal);
    setFPConditionLight("zero", isZero);
    setFPConditionLight("negative", isNegative);
    setFPConditionLight("infinity", isInfinity);
    setFPConditionLight("nan", isNotANumber);

    scheme.setButtonValues(bin);

    /* Fill in the long-winded explanation of all the fields, what they mean,
     * and how we arrive at the final value from the bit fields. */
    if (isNegative) {
        setContentsByClass("signextratext", "The sign bit in the supplied number is 1, so this value is <b>negative</b>.");
    }
    else {
        setContentsByClass("signextratext", "The sign bit in the supplied number is 0, so this value is <b>positive</b>.");
    }

    let valueHtml = "<p>The value of the number supplied is therefore:</p><blockquote>" + (isNegative ? "-1" : "1") +
        "&nbsp;&#x00d7;&nbsp;2<sup>" + exponent.toString() + "</sup>" +
        "&nbsp;&#x00d7;&nbsp;" + mantissaBinary + "<sub>2</sub></blockquote>";
    valueHtml += "<p>which equals:</p>";
    valueHtml += "<blockquote><b>" + decimalValue + "</b> (to " + scheme.getRoundTripDecimalDigits().toString() + " decimal digits).</blockquote>";

    if (isZero) {
        setContentsByClass("exponentextratext", "The supplied number is zero because the exponent and mantissa fields are all 0-bits, so there is no meaningful exponent value.");
        setContentsByClass("mantissaextratext", "The supplied number's exponent and mantissa fields are all 0-bits, so this is <b>zero</b>.");
        setContentsByClass("valueextratext", "<p>In this case the value is <b>0</b>.</p>");
    }
    else if (isSubnormal) {
        setContentsByClass("exponentextratext", "The supplied number's raw exponent field is all 0-bits, so it is <b>subnormal</b> and the exponent is <b>" + scheme.getSubnormalExponent() + ".</b>");
        setContentsByClass("mantissaextratext", "The supplied subnormal number has the raw mantissa field " +
            mantissaRawHex + " (hex) which translates to the binary mantissa <b>" +
            mantissaBinary + "</b> (base 2) which is <b>" +
            mantissaString + "</b> (decimal).");
        setContentsByClass("valueextratext", valueHtml);
    }
    else if (isInfinity) {
        setContentsByClass("exponentextratext", "The supplied number's raw exponent field is all 1-bits and the mantissa is zero, so there is no exponent, and the number is <b>" + (isNegative ? "-" : "") + "Infinity</b>.");
        setContentsByClass("mantissaextratext", "The supplied number is infinite, so there is no meaningful mantissa.");
        setContentsByClass("valueextratext", "<p>The value of the supplied number is <b>" + decimalValue + "</b>.</p>");
    }
    else if (isNotANumber) {
        setContentsByClass("exponentextratext", "The supplied number's raw exponent field is all 1-bits and the mantissa is not zero, so there is no exponent, and the number is <b>NaN</b> (not a number).");
        setContentsByClass("mantissaextratext", "The supplied number is NaN, so there is no meaningful mantissa.");
        setContentsByClass("valueextratext", "<p>The value of the supplied number is <b>NaN</b> (not a number).</p>");
    }
    else {
        setContentsByClass("exponentextratext",
            "The supplied number's raw exponent field is " +
                exponentRawHex + " (" + exponentRaw.toString() +
                "). Subtracting " + scheme.getExponentBias().toString() +
                " gives the true exponent: <b>" + exponent.toString() + "</b>.");
        setContentsByClass("mantissaextratext", "The supplied number has the raw mantissa field " + mantissaRawHex +
            " (hex), which when combined with the implied leading 1 bit gives the binary mantissa <b>" +
            mantissaBinary + "</b> (base 2), which is <b>" +
            mantissaString + "</b> (decimal).");
        setContentsByClass("valueextratext", valueHtml);
    }

    updateURL();
}

/* Floating point format:
 *     Optional minus sign;
 *     A nonzero number of digits, with at most one decimal point amongst them;
 *     Optionally: a letter E, an optional sign, and one or more digits.
 */
const floatRegex = /^-?(([0-9]+)|([0-9]+\.[0-9]*)|(\.[0-9]+))([Ee][+-]?[0-9]+)?$/;
/* parseFloatStrict()
 * Like parseFloat(), but returns NaN if the string has any junk on the end of
 * an otherwise valid string. For example, parseFloat("1.234xyz") returns
 * 1.234, but parseFloatStrict("1.234xyz") returns NaN. */
function parseFloatStrict(s) {
    s = s.trim().toLowerCase();
    if (!floatRegex.test(s)) {
        if (s == "infinity" || s == "inf") {
            return Infinity;
        }
        else if (s == "-infinity" || s == "-inf") {
            return -Infinity;
        }
        else {
            return NaN;
        }
    }
    else {
        return parseFloat(s);
    }
}

function getFloatBinaryFromDecimalInput() {
    let valueString = inputBox.value.trim();
    let value = valueString.length == 0 ? 0 : parseFloatStrict(valueString);
    if (isNaN(value)) {
        return null;
    }
    else {
        let scheme = getFloatScheme();
        let bin = null;
        let numBits = scheme.getNumBits();
        if (numBits == 16) {
            bin = createBinaryIntFromFloat16Bin(value);
        }
        else if (numBits == 32) {
            bin = createBinaryIntFromFloat32Bin(value);
        }
        else {
            bin = createBinaryIntFromFloat64Bin(value);
        }
        return bin;
    }
}

function decimalInputHandler() {
    inputFloatBinary = getFloatBinaryFromDecimalInput();
    updateDisplay(inputFloatBinary);
}

function inputHandler() {
    let format = getInputFormat();
    if (format == "string") {
        decimalInputHandler();
    }
    else if (format == "hex") {
        hexInputHandler();
    }
}

/* Set inputFloatBinary to floatBinary, then update the display output
 * according to the value of floatBinary, rather than by re-parsing the input.
 * If updateHexInput is set, and the input format is hex, update the input box
 * to the hex representation of floatBinary.
 * The display is updated according to the precision specified by "scheme";
 * if scheme is null, we'll call getFloatScheme() ourselves. */
function updateDisplayFromBinary(floatBinary, updateHexInput, scheme) {
    if (scheme == null) {
        scheme = getFloatScheme();
    }
    inputFloatBinary = floatBinary;
    if (floatBinary != null) {
        if (getInputFormat() == "hex") {
            if (updateHexInput) {
                inputBox.value = scheme.getHex(floatBinary);
            }
        }
        else {
            inputBox.value = scheme.getValueString(floatBinary);
        }
    }
    updateDisplay(floatBinary);
}

/* Parse the contents of the input box as hex, and try to make a BinaryInt
 * of the appropriate length (according to getFloatScheme()) from it.
 * If the contents of the input box doesn't parse as a hex string or is too
 * long for the selected float precision, return null. */
function getFloatBinaryFromHexInput() {
    let scheme = getFloatScheme();
    let bits = scheme.getNumBits();
    let numBytes = Math.ceil(bits / 8);
    let hexString = inputBox.value.trim();

    /* Remove any leading zeroes */
    if (hexString.toLowerCase().startsWith("0x")) {
        hexString = hexString.substring(2);
    }
    while (hexString.length > 0 && hexString.charAt(0) == "0" || hexString.charAt(0) == " ") {
        hexString = hexString.substring(1);
    }

    /* If the string is empty, take it as zero */
    if (hexString == "") {
        hexString = "0";
    }

    /* Return a BinaryInt object, which is at most numBytes bytes. If we have
     * too many hex digits after removing the leading zeroes, this will
     * return zero. */
    return createBinaryIntFromHex(hexString, numBytes);
}

function hexInputHandler() {
    inputFloatBinary = getFloatBinaryFromHexInput();
    updateDisplayFromBinary(inputFloatBinary, false);
}

/* Update the display to reflect that the selected floating point precision
 * has just changed. Among other things, this re-parses the input as a float
 * of the new precision, recreates the bit-toggle buttons, and calls
 * updateDisplay(). */
function notifyFloatPrecisionChanged() {
    let bits = getFloatBits();
    let scheme = getFloatScheme();
    let format = getInputFormat();
    let precisionWord = scheme.getPrecisionWord();
    let precisionWordCapitalised = precisionWord.charAt(0).toUpperCase() + precisionWord.substring(1);
    let wikiUrl = "https://en.wikipedia.org/wiki/" + precisionWordCapitalised + "-precision_floating-point_format";

    ieee754EncodingLink.href = wikiUrl;
    setHrefByClass("wikipediaformatlink", wikiUrl);

    /* Highlight the button corresponding to the currently-selected precision */
    for (let i = 0; i < floatSchemeInputs.length; i++) {
        let button = floatSchemeInputs[i];
        if (parseInt(button.getAttribute("data-value")) == bits) {
            if (!button.classList.contains("buttonhighlight")) {
                button.classList.add("buttonhighlight");
            }
        }
        else {
            if (button.classList.contains("buttonhighlight")) {
                button.classList.remove("buttonhighlight");
            }
        }
    }

    /* Set inputFloatBinary from whatever input box is showing. */
    inputFloatBinary = null;
    if (format == "string") {
        inputFloatBinary = getFloatBinaryFromDecimalInput();
    }
    else if (format == "hex") {
        inputFloatBinary = getFloatBinaryFromHexInput();
    }

    /* Fill in various text placeholders relating to the floating point
     * precision currently in effect. */
    setContentsByClass("floatformatdigits", scheme.getRoundTripDecimalDigits().toString());
    setContentsByClass("textnumbits", scheme.getNumBits().toString());
    setContentsByClass("textprecisionword", scheme.getPrecisionWord());
    setContentsByClass("textnumexponentbits", scheme.getNumExponentBits().toString());
    setContentsByClass("textexponentbias", scheme.getExponentBias().toString());
    setContentsByClass("textnummantissabits", scheme.getNumMantissaBits().toString());
    setContentsByClass("textsubnormalexponent", scheme.getSubnormalExponent().toString());
    setContentsByClass("textsignbitmask", scheme.getSignBitMask());
    setContentsByClass("textexponentbitmask", scheme.getExponentBitMask());
    setContentsByClass("textmantissabitmask", scheme.getMantissaBitMask());
    setContentsByClass("textminexponent", scheme.getMinExponent());
    setContentsByClass("textmaxexponent", scheme.getMaxExponent());
    setContentsByClass("textsmallestsubnormal", scheme.getSmallestSubnormalString());
    setContentsByClass("textsmallestsubnormalhex", scheme.getSmallestSubnormalHex());
    setContentsByClass("textlargestsubnormal", scheme.getLargestSubnormalString());
    setContentsByClass("textlargestsubnormalhex", scheme.getLargestSubnormalHex());
    setContentsByClass("textsmallestnormal", scheme.getSmallestNormalString());
    setContentsByClass("textsmallestnormalhex", scheme.getSmallestNormalHex());
    setContentsByClass("textlargestnormal", scheme.getLargestNormalString());
    setContentsByClass("textlargestnormalhex", scheme.getLargestNormalHex());

    recreateBitButtons(scheme);
    updateDisplay(inputFloatBinary);
}

/* Set currentFloatScheme to one of the FPScheme objects in floatSchemes. */
function setFloatScheme(bits) {
    let scheme = floatSchemes[bits];
    if (scheme) {
        currentFloatScheme = scheme;
        notifyFloatPrecisionChanged();
    }
}

function notifyInputFormatChanged() {
    let format = getInputFormat();
    let scheme = getFloatScheme();
    if (scheme == null || format == null) {
        return;
    }
    if (format == "string") {
        outputHeading.innerText = "Closest representable value";
        valueHexTitle.innerHTML = "";
        valueHexTitle.appendChild(document.createTextNode("Closest representable value, "));
        valueHexTitle.appendChild(ieee754EncodingLink);
        if (inputFloatBinary == null) {
            /* Input was previously invalid. If it's valid for the string
             * format, then use it. This helps the user if they type "1.4",
             * realise that they're still in hex mode, and change the format
             * to decimal - don't make them retype the "1.4". */
            inputFloatBinary = getFloatBinaryFromDecimalInput();
            if (inputFloatBinary == null) {
                /* Input is still invalid - just clear it */
                inputBox.value = "";
            }
        }
        else {
            /* Set the input box to the decimal representation of
             * the existing inputFloatBinary value. */
            inputBox.value = scheme.getValueString(inputFloatBinary);
        }
    }
    else {
        outputHeading.innerText = "IEEE 754 bit fields";
        valueHexTitle.innerHTML = "";
        valueHexTitle.appendChild(ieee754EncodingLink);
        if (inputFloatBinary == null) {
            /* Again, if the input was previously invalid but is valid for
             * this new selected format, keep the input. */
            inputFloatBinary = getFloatBinaryFromHexInput();
            if (inputFloatBinary == null) {
                inputBox.value = "";
            }
        }
        else {
            inputBox.value = scheme.getHex(inputFloatBinary);
        }
    }
    updateDisplay(inputFloatBinary);
}

/* formatName is the "value" attribute of one of the <option> tags inside
 * the <select id="floatinputformat"> element. */
function setInputFormat(formatName) {
    for (let i = 0; i < floatInputSelector.options.length; i++) {
        let option = floatInputSelector.options[i];
        if (option.value == formatName) {
            option.selected = true;
            break;
        }
    }
    notifyInputFormatChanged();
}

function modifyExponent(delta) {
    if (inputFloatBinary != null) {
        let scheme = getFloatScheme();
        scheme.modifyExponent(inputFloatBinary, delta);
        updateDisplayFromBinary(inputFloatBinary, true, scheme);
    }
}

function modifyMantissa(delta) {
    if (inputFloatBinary != null) {
        let scheme = getFloatScheme();
        scheme.modifyMantissa(inputFloatBinary, delta);
        updateDisplayFromBinary(inputFloatBinary, true, scheme);
    }
}

function decrementExponentHandler() {
    modifyExponent(-1);
}

function incrementExponentHandler() {
    modifyExponent(1);
}

function decrementMantissaHandler() {
    modifyMantissa(-1);
}

function incrementMantissaHandler() {
    modifyMantissa(1);
}

function endianSwapHandler() {
    if (inputFloatBinary != null) {
        inputFloatBinary.swapEndianity();
        updateDisplayFromBinary(inputFloatBinary, true);
    }
}

function flipBitsHandler() {
    if (inputFloatBinary != null) {
        inputFloatBinary.flipAllBits();
        updateDisplayFromBinary(inputFloatBinary, true);
    }
}

function setZeroHandler() {
    if (inputFloatBinary != null) {
        inputFloatBinary.zeroAllBits();
        updateDisplayFromBinary(inputFloatBinary, true);
    }
}

function initPage() {
    /* Attach event listeners to things that need them */
    inputBox.addEventListener("input", inputHandler);

    /* When we change float precision, call setFloatScheme(), which switches
     * currentFloatScheme then calls notifyFloatPrecisionChanged() in order
     * to recalculate everything. */
    for (let i = 0; i < floatSchemeInputs.length; i++) {
        let bits = parseInt(floatSchemeInputs[i].getAttribute("data-value"));
        if (!isNaN(bits)) {
            floatSchemeInputs[i].addEventListener("click", function () {
                setFloatScheme(bits);
            });
        }
    }

    /* When the input format is changed, call notifyInputFormatChanged */
    floatInputSelector.addEventListener("change", notifyInputFormatChanged);

    /* Attach handlers to the dec/increment and bit manipulation buttons */
    decrementExponentButton.addEventListener("click", decrementExponentHandler);
    incrementExponentButton.addEventListener("click", incrementExponentHandler);
    decrementMantissaButton.addEventListener("click", decrementMantissaHandler);
    incrementMantissaButton.addEventListener("click", incrementMantissaHandler);

    endianSwapButton.addEventListener("click", endianSwapHandler);
    flipBitsButton.addEventListener("click", flipBitsHandler);
    setZeroButton.addEventListener("click", setZeroHandler);

    /* Put the element with id "fpconditionnegative" in the fpConditionLights
     * map with the key "negative", and so on. The illumination status of
     * these lights are changed with setFPConditionLight(key, on). */
    let fpConditionElements = document.getElementsByClassName("fpcondition");
    for (let i = 0; i < fpConditionElements.length; i++) {
        let el = fpConditionElements[i];
        for (let j = 0; j < el.classList.length; j++) {
            let className = el.classList[j];
            if (className.startsWith("fpcondition") && className != "fpcondition") {
                let key = className.substring(11);
                if (fpConditionLights[key] === undefined) {
                    fpConditionLights[key] = [];
                }
                fpConditionLights[key].push(el);
            }
        }
    }


    inputFloatBinary = createBinaryIntFromFloat32Bin(0);

    /* If the URL's query string has parameters, apply them to the precision
     * selector and input box.
     * Query parameter "p" specifies the precision level, 32 or 64 bit. */
    let queryString = parseQueryString();
    if ("p" in queryString) {
        let bits = parseInt(queryString["p"]);
        if (!isNaN(bits)) {
            setFloatScheme(bits);
        }
    }

    if (currentFloatScheme == null) {
        setFloatScheme(32);
    }

    /* Handle parameters like h=0x12345678 (enter hex input mode) and f=3.142
     * (enter decimal input mode). */
    if ("h" in queryString) {
        setInputFormat("hex");
        inputBox.value = queryString["h"];
        hexInputHandler();
    }
    else if ("f" in queryString) {
        setInputFormat("string");
        inputBox.value = queryString["f"];
        decimalInputHandler();
    }
    else {
        inputBox.value = "";
        decimalInputHandler();
        notifyInputFormatChanged();
    }

    attachCopyHandlerToElementsWithClass("outputvalue", null);
}
