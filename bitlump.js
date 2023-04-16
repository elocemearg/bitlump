
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
 *             "converterParamElements": [ list of names of HTML elements of parameters of this converter ],
 *             "outputElement": <HTML element for output>,
 *             "flagElements": { name -> HTML elements of flag associated with this converter }
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

    let outputDivs = document.getElementsByClassName("outputcontainer");
    for (let outputDivIndex = 0; outputDivIndex < outputDivs.length; outputDivIndex++) {
        let odiv = outputDivs[outputDivIndex];
        let converterName = odiv.getAttribute("data-converter");
        if (converterName) {
            let converter = getConversion(converterName);
            if (converter) {
                let inputTypeName = converter.getInputTypeName();
                /* Find the output group element which contains this output */
                for (let cgIndex = 0; cgIndex < conversionGroups.length; cgIndex++) {
                    if (conversionGroups[cgIndex].outputGroupElement.contains(odiv)) {
                        let cg = conversionGroups[cgIndex];
                        /* output element may contain a data-param-element-names
                         * attribute, which lists the names of controls to be
                         * passed to the converter as parameters. */
                        let paramElementNames = odiv.getAttribute("data-param-element-names");
                        if (paramElementNames) {
                            paramElementNames = paramElementNames.split(",").map(x => x.trim());
                        }
                        else {
                            paramElementNames = [];
                        }

                        /* A converter may have a number of flag elements
                         * associated with it, which we must reset if the
                         * converter fails to convert. */
                        let flags = odiv.getAttribute("data-flags");
                        let flagElements = {};
                        if (flags) {
                            flags = flags.split(",").map(x => x.trim());
                            for (let i = 0; i < flags.length; i++) {
                                let el = document.getElementById(flags[i]);
                                if (el) {
                                    flagElements[flags[i]] = el;
                                }
                            }
                        }

                        cg.conversionOutputs.push({
                            "converter" : converter,
                            "converterParamElements" : paramElementNames,
                            "outputElement" : odiv,
                            "flagElements" : flagElements,
                        });
                        break;
                    }
                }
            }
        }
    }
}

function buildQueryString(namesValues) {
    let q = "";
    for (let name in namesValues) {
        if (q.length > 0)
            q += "&";
        q += encodeURIComponent(name) + "=" + encodeURIComponent(namesValues[name].toString());
    }
    return q;
}

function inputChanged(text) {
    /* Change the URL query string to reflect the new input */
    let newUrl;
    if (text.trim().length > 0) {
        newUrl = "?" + buildQueryString({
            "i" : text
        });
    }
    else {
        newUrl = "?";
    }
    if (window.history.replaceState) {
        window.history.replaceState(null, null, newUrl);
    }

    /* Create an InputValue from our text set currentInputValue to it */
    currentInputValue = new InputValue(text);

    /* Start all the fancy machinery */
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

        if (inputTypeName == "binaryint") {
            groupEnable = currentInputValue.getBinaryInt() != null;
        }
        else if (inputTypeName == "float") {
            groupEnable = currentInputValue.isFloat();
        }
        else if (inputTypeName == "text") {
            /* Everything is valid text */
            groupEnabled = true;
        }

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
            let oe = co.outputElement;
            let outputValue = null;
            let params = paramElementNamesToParams(co.converterParamElements);
            let conversionSuccess = co.converter.convert(currentInputValue, params, co.flagElements, oe);
            if (conversionSuccess) {
                oe.classList.remove("outputcontainervoid");
                oe.disabled = false;
            }
            else {
                oe.disabled = true;
                oe.classList.add("outputcontainervoid");
                for (let flagId in co.flagElements) {
                    co.flagElements[flagId].classList.remove("flagactive");
                }
            }
        }
    }

    /* Anything with the class outputvalue, which does not have the class
     * outputvaluenoautolink, has its contents automatically linkified.
     * Clicking the link feeds in the output value as the input. */
    let outputElements = document.getElementsByClassName("outputvalue");
    for (let outputIndex = 0; outputIndex < outputElements.length; outputIndex++) {
        let oe = outputElements[outputIndex];
        if (!oe.disabled && !oe.classList.contains("outputvaluenoautolink")) {
            let valueText = oe.innerText;
            let linkValueText = valueText;
            let link = document.createElement("A");

            if (oe.classList.contains("outputvaluehex")) {
                /* Value is a series of hex numbers (at least two digits each),
                 * possibly without the leading 0x, separated by spaces. We
                 * must add the 0x so that if the user clicks, the numbers
                 * don't get interpreted as base-10. */
                linkValueText = valueText.replace(/\b([0-9a-fA-F][0-9a-fA-F])/g, "0x$1");
            }
            link.href = "?i=" + encodeURIComponent(linkValueText);
            link.classList.add("outputvaluelink");
            link.innerText = valueText;
            oe.innerHTML = "";
            oe.appendChild(link);
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

function clearInput() {
    inputBox.value = "";
    inputBox.focus();
    inputChanged(inputBox.value);
}

function copyInput() {
    inputBox.select();
    inputBox.setSelectionRange(0, 99999);
    document.execCommand("copy");
}

function queryStringToDict(queryString) {
    let dict = {};
    if (queryString == null || queryString.length == 0) {
        return dict;
    }

    if (queryString[0] == '?') {
        queryString = queryString.substring(1);
    }

    let components = queryString.split("&");
    for (let i = 0; i < components.length; ++i) {
        let nameEqualsValue = components[i];
        let equalsPos = nameEqualsValue.search("=");

        if (equalsPos >= 0) {
            name = nameEqualsValue.substring(0, equalsPos);
            value = nameEqualsValue.substring(equalsPos + 1);
        }
        else {
            name = nameEqualsValue;
            value = "";
        }

        name = decodeURIComponent(name.replace(/\+/g, " "));
        value = decodeURIComponent(value.replace(/\+/g, " "));
        dict[name] = value;
    }

    return dict;
}

function parseQueryString() {
    let url = window.location.href;
    let qPos = url.indexOf('?');
    if (qPos >= 0) {
        return queryStringToDict(url.substr(qPos + 1));
    }
    else {
        return {};
    }
}


function initPage() {
    initConversions();
    mainDiv = document.getElementById("main");
    inputBox = document.getElementById("input");
    inputBox.addEventListener("input", function() {
        inputChanged(inputBox.value);
    });

    let queryString = parseQueryString();
    if ("i" in queryString) {
        inputBox.value = queryString["i"];
    }

    inputBox.focus();
    initialiseConversionControls();
    inputChanged(inputBox.value);
}
