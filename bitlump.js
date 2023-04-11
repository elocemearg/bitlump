
let mainDiv = null;
let inputBox = null;
let currentInputValue = new InputValue("");

function inputChanged(text) {
    currentInputValue = new InputValue(text);
    refresh();
}

function refresh() {
    let outputGroups = document.getElementsByClassName("outputgroup");
    let enabledCategories = {};

    /* For each "outputgroup" div, work out whether the input type that group
     * deals with is compatible with the input. If it isn't, disable that
     * group. */
    for (let i = 0; i < outputGroups.length; i++) {
        let og = outputGroups[i];
        let categoryName = og.getAttribute("data-category");
        let enable = true;
        if (categoryName == "binaryint") {
            enable = currentInputValue.getBinaryInt() != null;
        }
        else if (categoryName == "float") {
            enable = currentInputValue.isFloat();
        }

        if (enable) {
            og.classList.remove("outputgroupvoid");
            enabledCategories[categoryName] = true;
        }
        else {
            og.classList.add("outputgroupvoid");
        }
    }

    /* Now for each "outputvalue" div, if its category is enabled, run that
     * outputvalue's converter on the input value to get a string, and put
     * that string in the outputvalue div. */
    let outputDivs = document.getElementsByClassName("outputvalue");
    for (let i = 0; i < outputDivs.length; i++) {
        let odiv = outputDivs[i];
        let converterName = odiv.getAttribute("data-converter");
        if (converterName) {
            let converter = getConversion(converterName);
            let outputValue = null;
            if (converter == null) {
                console.log("converter name " + converterName + " not found");
            }
            else if (!(converter.getInputTypeCategory() in enabledCategories)) {
                outputValue = null;
            }
            else {
                outputValue = converter.convert(currentInputValue);
            }
            if (outputValue !== null) {
                odiv.innerHTML = outputValue;
                odiv.classList.remove("outputvaluevoid");
            }
            else {
                odiv.innerHTML = "&nbsp;";
                odiv.disabled = true;
                odiv.classList.add("outputvaluevoid");
            }
        }
    }
}

function modifyBinaryInt(func) {
    let binaryInt = currentInputValue.getBinaryInt();
    if (binaryInt) {
        binaryInt = binaryInt.copy();
        if (func(binaryInt)) {
            let text = currentInputValue.formatBinaryInt(binaryInt);
            inputBox.value = text;
            inputChanged(text);
        }
    }
}

function decrementInputValue() {
    modifyBinaryInt(function(x) { return x.decrement(); });
}

function incrementInputValue() {
    modifyBinaryInt(function(x) { return x.increment(); });
}

function shiftLeftInputValue() {
    modifyBinaryInt(function(x) { x.shiftLeft(1); return true; /* Ignore overflow */ });
}

function shiftRightInputValue() {
    modifyBinaryInt(function(x) { return x.shiftRight(1); });
}

function endianSwapInputValue(numBytes) {
    modifyBinaryInt(function(x) { return x.endianSwap(numBytes); });
}

function initPage() {
    initConversions();
    mainDiv = document.getElementById("main");
    inputBox = document.getElementById("input");
    inputBox.addEventListener("input", function() {
        inputChanged(inputBox.value);
    });

    inputBox.focus();
    inputChanged("");
}
