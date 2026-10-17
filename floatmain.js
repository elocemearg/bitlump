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

/* Radio buttons for 32/64-bit selection */
let floatSchemeInputs = [
    document.getElementById("floatscheme32"),
    document.getElementById("floatscheme64")
];

/* Containing labels for the radio buttons, populated further down */
let floatSchemeInputLabels = [];

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


/* Functions for manipulating the state of the bit-toggling buttons, and
 * for recreating them when we change between 32 and 64 bit precision. */
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

/* FPScheme: represents a floating-point precision and associated encoding
 * such as single-precision or double-precision. Bit positions and counts are
 * supplied on construction. */
class FPScheme {
    constructor(numBits, signBitIndex, topExpBitIndex, numExpBits,
            topMantissaBitIndex, numMantissaBits, expBias, roundTripDecimalDigits) {
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
    }

    howManyBits() {
        return this.numBits;
    }

    getRoundTripDecimalDigits() {
        return this.roundTripDecimalDigits;
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
    32 : new FPScheme(32, 31, 30, 8, 22, 23, 127, 9),
    64 : new FPScheme(64, 63, 62, 11, 51, 52, 1023, 17),
};

/* Return the "value" attribute of the selected precision radio button.
 * The return value may be used as a key to floatSchemes. */
function getFloatBits() {
    for (let i = 0; i < floatSchemeInputs.length; i++) {
        if (floatSchemeInputs[i].checked) {
            return parseInt(floatSchemeInputs[i].value);
        }
    }
    return null;
}

/* Return the FPScheme object currently selected by the radio buttons. */
function getFloatScheme() {
    let bits = getFloatBits();
    return floatSchemes[bits];
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

/* Update the state of the output fields a bit button state to reflect the
 * IEEE 754 bit pattern represented by "bin". */
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
        clearBitButtonValues();
        clearFPConditionLights();
        inputBox.classList.add("invalidinput");
        return null;
    }

    if (inputBox.classList.contains("invalidinput")) {
        inputBox.classList.remove("invalidinput");
    }

    outputSignRaw.innerText = scheme.isNegative(bin) ? "1" : "0";
    outputExponentRaw.innerText = scheme.getExponentRawHex(bin);
    outputMantissaRaw.innerText = scheme.getMantissaRawHex(bin);
    outputValueRaw.innerText = "0x" + scheme.getHex(bin);

    outputSignValue.innerText = scheme.getSign(bin);
    outputExponentValue.innerText = scheme.getExponent(bin);
    outputMantissaValue.innerText = scheme.getMantissaString(bin);
    outputValueDecimal.innerText = scheme.getValueString(bin);

    setFPConditionLight("subnormal", scheme.isSubnormal(bin));
    setFPConditionLight("zero", scheme.isZero(bin));
    setFPConditionLight("negative", scheme.isNegative(bin));
    setFPConditionLight("infinity", scheme.isInfinity(bin));
    setFPConditionLight("nan", scheme.isNotANumber(bin));

    scheme.setButtonValues(bin);

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
        if (scheme.howManyBits() == 32) {
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
    let bits = scheme.howManyBits();
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

    if (bits == 32) {
        ieee754EncodingLink.href = "https://en.wikipedia.org/wiki/Single-precision_floating-point_format";
    }
    else {
        ieee754EncodingLink.href = "https://en.wikipedia.org/wiki/Double-precision_floating-point_format";
    }

    /* Highlight the label containing the selected radio button */
    for (let i = 0; i < floatSchemeInputLabels.length; i++) {
        let label = floatSchemeInputLabels[i];
        if (label && label.classList.contains("radiolabel")) {
            if (floatSchemeInputs[i].checked) {
                if (!label.classList.contains("radiolabelselected")) {
                    label.classList.add("radiolabelselected");
                }
            }
            else {
                if (label.classList.contains("radiolabelselected")) {
                    label.classList.remove("radiolabelselected");
                }
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

    /* Any element which needs to contain 9 or 17 depending on whether we're
     * using 32-bit or 64-bit floats, set them now. */
    let floatFormatDigits = document.getElementsByClassName("floatformatdigits");
    for (let i = 0; i < floatFormatDigits.length; i++) {
        floatFormatDigits[i].innerText = scheme.getRoundTripDecimalDigits().toString();
    }

    recreateBitButtons(scheme);
    updateDisplay(inputFloatBinary);
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

inputBox.addEventListener("input", inputHandler);

for (let i = 0; i < floatSchemeInputs.length; i++) {
    floatSchemeInputs[i].addEventListener("change", notifyFloatPrecisionChanged);
    floatSchemeInputLabels.push(getContainingLabel(floatSchemeInputs[i]));
}

floatInputSelector.addEventListener("change", notifyInputFormatChanged);

decrementExponentButton.addEventListener("click", decrementExponentHandler);
incrementExponentButton.addEventListener("click", incrementExponentHandler);
decrementMantissaButton.addEventListener("click", decrementMantissaHandler);
incrementMantissaButton.addEventListener("click", incrementMantissaHandler);

endianSwapButton.addEventListener("click", endianSwapHandler);
flipBitsButton.addEventListener("click", flipBitsHandler);
setZeroButton.addEventListener("click", setZeroHandler);

function initPage() {
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
            for (let i = 0; i < floatSchemeInputs.length; i++) {
                if (parseInt(floatSchemeInputs[i].value) == bits) {
                    floatSchemeInputs[i].checked = true;
                    break;
                }
            }
        }
    }

    /* Set up the bit-twiddling buttons for the selected precision. */
    notifyFloatPrecisionChanged();

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
        changeInputFormat();
    }

    attachCopyHandlerToElementsWithClass("outputvalue", null);
}
