
let mainDiv = null;
let inputBox = null;
let currentInputValue = new InputValue("");

/* Data structure containing all the conversion output elements and their
 * conversion functions.
 *
 * [
 *     inputTypeName: input type name, e.g. "binaryint", "float"
 *     outputGroupElement: <outputgroup HTML element>
 *     paramControls: [ list of contained elements with class=converter-param ]
 *     conversionOutputs: [
 *         {
 *             "converter": <Conversion object>,
 *             "outputElement": <HTML element for output>
 *         },
 *     ]
 * ]
 */
let conversionGroups = [];

class ConversionOutput {
    constructor(outputElement, converter) {
        this.outputElement = outputElement;
        this.converter = converter;
    }
}

function initialiseConversionControls() {
    let outputGroups = document.getElementsByClassName("outputgroup");
    for (let i = 0; i < outputGroups.length; i++) {
        let og = outputGroups[i];
        let inputTypeName = og.getAttribute("data-category");
        if (inputTypeName) {
            conversionGroups.push({
                "inputTypeName" : inputTypeName,
                "paramControls" : og.getElementsByClassName("converter-param"),
                "outputGroupElement" : og,
                "conversionOutputs" : []
            });
        }
    }

    let outputDivs = document.getElementsByClassName("outputvalue");
    for (let i = 0; i < outputDivs.length; i++) {
        let odiv = outputDivs[i];
        let converterName = odiv.getAttribute("data-converter");
        if (converterName) {
            let converter = getConversion(converterName);
            if (converter) {
                let inputTypeName = converter.getInputTypeName();
                /* Find the output group element which contains this output */
                for (let j = 0; j < conversionGroups.length; j++) {
                    if (conversionGroups[j].outputGroupElement.contains(odiv)) {
                        let cg = conversionGroups[j];
                        /* output element may contain a data-param-element-names
                         * attribute, which lists the names of controls to be
                         * passed to the converter as parameters. */
                        let paramElementNames = odiv.getAttribute("data-param-element-names");
                        if (paramElementNames) {
                            paramElementNames = paramElementNames.split(",");
                        }
                        else {
                            paramElementNames = [];
                        }
                        cg.conversionOutputs.push({
                            "converter" : converter,
                            "converterParamElements" : paramElementNames,
                            "outputElement" : odiv,
                        });
                        break;
                    }
                }
            }
        }
    }
}

function inputChanged(text) {
    currentInputValue = new InputValue(text);
    refresh();
}

function paramElementNameToValue(name) {
    let value = null;
    let elements = document.getElementsByName(name);

    /* Choose the first element in the list which:
     *    is a radio button and checked (return its value)
     *    is a select element (return the value of the selected option)
     *    is a checkbox (return true or false)
     *    is any other input (return its value)
     */
    for (let i = 0; value === null && i < elements.length; i++) {
        let e = elements[i];
        let tagName = e.tagName.toLowerCase();
        if (tagName == "select") {
            value = e.options[e.selectedIndex].value;
        }
        else if (tagName == "input") {
            if (e.type == "radio") {
                if (e.checked)
                    value = e.value;
            }
            else if (e.type == "checkbox") {
                value = e.checked;
            }
            else {
                value = e.value;
            }
        }
    }
    return value;
}

/* Return an object whose names are the parameter names given in the array
 * "names", and each value is the value of the HTML element with that name,
 * as defined by paramElementNameToValue(). */
function paramElementNamesToParams(names) {
    let params = {};
    for (let i = 0; i < names.length; i++) {
        params[names[i]] = paramElementNameToValue(names[i]);
    }
    return params;
}

function refresh() {
    for (let groupIndex = 0; groupIndex < conversionGroups.length; groupIndex++) {
        let inputTypeName = conversionGroups[groupIndex].inputTypeName;
        let outputGroupElement = conversionGroups[groupIndex].outputGroupElement;
        let groupParamControls = conversionGroups[groupIndex].paramControls;
        let conversionOutputs = conversionGroups[groupIndex].conversionOutputs;
        let groupEnable = true;

        if (inputTypeName == "binaryint")
            groupEnable = currentInputValue.getBinaryInt() != null;
        else if (inputTypeName == "float")
            groupEnable = currentInputValue.getFloat() != null;

        /* Put this output group in its enabled/disabled colours */
        if (groupEnable) {
            outputGroupElement.classList.remove("outputgroupvoid");
        }
        else {
            outputGroupElement.classList.add("outputgroupvoid");
        }

        /* Enable/disable any parameter controls in this group */
        for (let paramIndex = 0; paramIndex < groupParamControls.length; paramIndex++) {
            groupParamControls[paramIndex].disabled = !groupEnable;
        }

        for (let outputIndex = 0; outputIndex < conversionOutputs.length; outputIndex++) {
            let co = conversionOutputs[outputIndex];
            let odiv = co.outputElement;
            let outputValue = null;
            let params = paramElementNamesToParams(co.converterParamElements);
            if (groupEnable) {
                outputValue = co.converter.convert(currentInputValue, params);
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

function unixTimestampUnitChanged() {
    document.getElementById("unixtsscale-auto").checked = false;
    refresh();
}

function unixTimestampUnitAutoDetectChanged() {
    refresh();
}

function initPage() {
    initConversions();
    mainDiv = document.getElementById("main");
    inputBox = document.getElementById("input");
    inputBox.addEventListener("input", function() {
        inputChanged(inputBox.value);
    });

    inputBox.focus();
    initialiseConversionControls();
    inputChanged(inputBox.value);
}
