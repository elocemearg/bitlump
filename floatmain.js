let decimalInput = document.getElementById("decimalinput");
let hexInput = document.getElementById("hexinput");

let outputSignRaw = document.getElementById("signraw");
let outputExponentRaw = document.getElementById("exponentraw");
let outputMantissaRaw = document.getElementById("mantissaraw");
let outputValueRaw = document.getElementById("valuehex");
let outputSignValue = document.getElementById("signvalue");
let outputExponentValue = document.getElementById("exponentvalue");
let outputMantissaValue = document.getElementById("mantissavalue");
let outputValueDecimal = document.getElementById("valuedecimal");

let floatFormat32Input = document.getElementById("floatformat32");
let floatFormat64Input = document.getElementById("floatformat64");

let floatInputSelectorString = document.getElementById("floatinputstring");
let floatInputSelectorHex = document.getElementById("floatinputhex");

let signBitButtonsCell = document.getElementById("signbitbuttons");
let exponentBitButtonsCell = document.getElementById("exponentbitbuttons");
let mantissaBitButtonsCell = document.getElementById("mantissabitbuttons");

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


let inputFloatValue = 0;
let inputFloatBinary = null;

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

class FPPrecision {
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

    isNegative(bin) {
        return bin.getBit(this.signBitIndex);
    }

    isZero(bin) {
        return this.getExponentRaw(bin) == 0 && this.getMantissaRaw(bin) == 0;
    }

    isSubnormal(bin) {
        return this.getExponentRaw(bin) == 0 && this.getMantissaRaw(bin) != 0;
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
            return this.minExp;
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
        let impl = this;
        button.innerText = "0";
        button.classList.add("bitbutton");
        button.addEventListener("click", function() {
            if (inputFloatBinary != null) {
                inputFloatBinary.toggleBit(b);
                refreshFromInputFloatBinary(impl, true);
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
}


let floatTypes = {
    32 : new FPPrecision(32, 31, 30, 8, 22, 23, 127, 9),
    64 : new FPPrecision(64, 63, 62, 11, 51, 52, 1023, 17),
};

function getFloatBits() {
    if (floatFormat32Input.checked) {
        return 32;
    }
    else {
        return 64;
    }
}

function refreshDisplay() {
    let bits = getFloatBits();
    let impl = floatTypes[bits];
    let bin = inputFloatBinary;
    if (impl == null || bin == null) {
        return null;
    }

    outputSignRaw.innerText = impl.isNegative(bin) ? "1" : "0";
    outputExponentRaw.innerText = impl.getExponentRawHex(bin);
    outputMantissaRaw.innerText = impl.getMantissaRawHex(bin);
    outputValueRaw.innerText = "0x" + impl.getHex(bin);

    outputSignValue.innerText = impl.getSign(bin);
    outputExponentValue.innerText = impl.getExponent(bin);
    outputMantissaValue.innerText = impl.getMantissaString(bin);
    outputValueDecimal.innerText = impl.getValueString(bin);

    impl.setButtonValues(bin);
}

function decimalInputHandler() {
    let valueString = decimalInput.value.trim();
    let value = valueString.length == 0 ? 0 : parseFloat(valueString);
    if (isNaN(value)) {
        decimalInput.style.backgroundColor = "red";
    }
    else {
        const bits = getFloatBits();
        let impl = floatTypes[bits];
        decimalInput.style.backgroundColor = null;
        hexInput.value = "";
        inputFloatValue = value;
        if (bits == 32) {
            inputFloatBinary = createBinaryIntFromFloat32Bin(inputFloatValue);
        }
        else {
            inputFloatBinary = createBinaryIntFromFloat64Bin(inputFloatValue);
        }
        if (impl) {
            hexInput.value = impl.getHex(inputFloatBinary);
        }
        refreshDisplay();
    }
}

function refreshFromInputFloatBinary(impl, refreshHexInput) {
    inputFloatValue = impl.getValue(inputFloatBinary);
    decimalInput.value = impl.getValueString(inputFloatBinary);
    if (refreshHexInput) {
        hexInput.value = impl.getHex(inputFloatBinary);
    }
    refreshDisplay();
}

function hexInputHandler() {
    let bits = getFloatBits();
    let impl = floatTypes[bits];
    let numBytes = Math.ceil(bits / 8);
    let hexString = hexInput.value.trim();

    if (hexString == "") {
        /* If the user deletes the contents of the hex string input, take
         * this as 0 rather than turning it red like it's an error. */
        hexString = "0";
    }

    let bin = createBinaryIntFromHex(hexString, numBytes);
    if (bin == null) {
        hexInput.style.backgroundColor = "red";
    }
    else {
        hexInput.style.backgroundColor = null;
        inputFloatBinary = bin;
        refreshFromInputFloatBinary(impl, false);
    }
}

function recreateBitButtons(impl) {
    signBitButton = impl.createSignBitButton();
    exponentBitButtons = impl.createExponentBitButtons();
    mantissaBitButtons = impl.createMantissaBitButtons();
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

function changeFloatPrecision() {
    let bits = getFloatBits();
    let impl = floatTypes[bits];
    if (bits == 32) {
        inputFloatBinary = createBinaryIntFromFloat32Bin(inputFloatValue);
        decimalInput.setAttribute("placeholder", "e.g. 1.23456789e-10...");
        hexInput.setAttribute("placeholder", "e.g. 40490FDB")
    }
    else {
        inputFloatBinary = createBinaryIntFromFloat64Bin(inputFloatValue);
        decimalInput.setAttribute("placeholder", "e.g. 1.2345678901234567e-89...");
        hexInput.setAttribute("placeholder", "e.g. 400921FB54442D18")
    }
    recreateBitButtons(impl);
    refreshDisplay();
}

function changeInputFormat() {
    if (floatInputSelectorString.checked) {
        decimalInput.style.display = null;
        hexInput.style.display = "none";
    }
    else {
        decimalInput.style.display = "none";
        hexInput.style.display = null;
    }
}

decimalInput.addEventListener("input", decimalInputHandler);
hexInput.addEventListener("input", hexInputHandler);
floatFormat32Input.addEventListener("change", changeFloatPrecision);
floatFormat64Input.addEventListener("change", changeFloatPrecision);

floatInputSelectorString.addEventListener("change", changeInputFormat);
floatInputSelectorHex.addEventListener("change", changeInputFormat);

function initPage() {
    decimalInput.focus();
    inputFloatValue = 0;
    inputFloatBinary = createBinaryIntFromFloat32Bin(inputFloatValue);
    changeFloatPrecision();
    changeInputFormat();
}
