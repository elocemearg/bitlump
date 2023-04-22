
let mainDiv = null;
let inputBox = null;
let currentInputValue = new InputValue("");

let intTypeRadioButtons = {};
let endianSwap16Button = null;
let endianSwap32Button = null;
let endianSwap64Button = null;

let intManipulationButtons = [];

let copyIndicator = null;
let copyIndicatorTimeout = null;

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

    /* Any tag with autocopytagdata class behaves like an output value for
     * the purpose of what happens when you click on it, except that what
     * gets copied to the clipboard is the contents of the tag's
     * data-text-to-copy attribute rather than its innerText. */
    let autoCopyTags = document.getElementsByClassName("autocopytagdata");
    for (let i = 0; i < autoCopyTags.length; i++) {
        autoCopyTags[i].addEventListener("click", outputValueClickHandler);
    }
}

function updateURL(text) {
    let newUrl;
    if (text.trim().length > 0) {
        let keyValues = {};
        if (!getCheckBoxValue("unixtsscale-auto")) {
            /* Default timestamp unit is auto-guess. If that is not checked,
             * also encode the selected unit in the URL. */
            keyValues["t"] = getRadioButtonValue("unixtsscale");
        }
        let bytesTextDecoding = getSelectOptionValue("textdecoding");
        if (bytesTextDecoding != "utf8") {
            /* Default decoding of bytes to text is UTF-8, put it in the URL
             * if it's something else. */
            keyValues["u"] = bytesTextDecoding;
        }
        keyValues["i"] = text;
        newUrl = "?" + buildQueryString(keyValues);
    }
    else {
        newUrl = "?";
    }
    if (window.history.replaceState) {
        window.history.replaceState(null, null, newUrl);
    }
}

function inputChanged(text) {
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

function getIntTypeFromButtonValue(value) {
    let fields = value.split("-");
    if (fields.length != 2)
        return null;
    let bits = parseInt(fields[1]);
    if (isNaN(bits))
        return null;
    return {
        "signed": fields[0] == "signed",
        "bits": bits
    };
}

function setButtonsEnabledState() {
    let selectedIntTypeDisabled = true;
    let selectedIntType = null;

    /* Find which radio button is selected */
    for (let key in intTypeRadioButtons) {
        let intType = getIntTypeFromButtonValue(key);
        let b = currentInputValue.getConvertedBinaryInt(intType["signed"], intType["bits"]);
        intTypeRadioButtons[key].disabled = (b == null);
        if (intTypeRadioButtons[key].checked) {
            if (b != null)
                selectedIntTypeDisabled = false;
            selectedIntType = intType;
        }
    }

    /* Disable all buttons if the selected int type is unavailable */
    for (let i = 0; i < intManipulationButtons.length; i++) {
        intManipulationButtons[i].disabled = selectedIntTypeDisabled;
    }

    if (!selectedIntTypeDisabled && selectedIntType) {
        /* Enable only the endian swap buttons that make sense for the
         * selected int type. */
        let bits = selectedIntType["bits"];
        endianSwap16Button.disabled = bits < 16;
        endianSwap32Button.disabled = bits < 32;
        endianSwap64Button.disabled = bits < 64;
    }

    /* Disable bytes panel's endian-swap buttons and character encoding
     * selector if the input value isn't a byte array. */
    let bytesEndianSwapButtons = document.getElementsByClassName("bytesendianswap");
    for (let i = 0; i < bytesEndianSwapButtons.length; i++) {
        bytesEndianSwapButtons[i].disabled = !currentInputValue.isBytes();
    }
    let textDecoding = document.getElementById("textdecoding");
    if (textDecoding) {
        textDecoding.disabled = !currentInputValue.isBytes();
    }
}

function killCopyIndicator() {
    if (copyIndicator) {
        if (copyIndicator.parentElement) {
            copyIndicator.parentElement.removeChild(copyIndicator);
        }
        copyIndicator.style.display = "none";
        copyIndicator = null;
    }
}

function startCopyIndicator(indicatorText, posX, posY, parentElement) {
    if (copyIndicator == null) {
        copyIndicator = document.createElement("DIV");
        copyIndicator.classList.add("copyindicator");
        copyIndicator.innerText = indicatorText;
        copyIndicator.style.left = posX.toString() + "px";
        copyIndicator.style.top = posY.toString() + "px";

        /* Add the copy indicator to the outputvalue element and kill it in
         * 1000ms from now. In that time it will animate. */
        parentElement.appendChild(copyIndicator);
        copyIndicatorTimeout = setTimeout(killCopyIndicator, 1000);
    }
}

function outputValueClickHandler(event) {
    let outputValue = event.target;

    /* The event might have been delivered to a tag contained within the
     * outputvalue, or it might even be the copy indicator itself if it's
     * still there, but we want the innerText property of the nearest
     * containing outputvalue. */
    while (outputValue != null && !(outputValue.classList.contains("outputvalue") || outputValue.classList.contains("autocopytagdata"))) {
        outputValue = outputValue.parentElement;
    }

    /* Don't allow click-to-copy on a void output element */
    if (outputValue == null || outputValue.classList.contains("outputcontainervoid")) {
        return;
    }

    /* Wherever the floating copy indicator is, remove it. */
    killCopyIndicator();
    if (copyIndicatorTimeout) {
        clearTimeout(copyIndicatorTimeout);
    }

    /* Now copy the text from the outputvalue. */
    if (outputValue) {
        /* When the Promise resolves, make the indicator start at the position
         * of the mouse click. */

        /* If there is a data-text-to-copy attribute, take that as the text
         * to copy to the clipboard. */
        let clipboardText = outputValue.getAttribute("data-text-to-copy");
        if (clipboardText == null) {
            if (outputValue.classList.contains("autocopytagdata")) {
                /* autocopytagdata must have a data-text-to-copy attribute
                 * or it's not valid */
                return null;
            }
            else {
                /* Otherwise, take the inner text of the tag. */
                clipboardText = outputValue.innerText;
            }
        }
        let p = navigator.clipboard.writeText(clipboardText);
        let rect = outputValue.getBoundingClientRect();
        let indicatorY = event.clientY - rect.top;
        let indicatorX = event.clientX - rect.left;
        p.then(
            function() {
                /* Create a new floating copy indicator, to tell the user they
                 * copied * something to the clipboard. */
                startCopyIndicator("Copied", indicatorX, indicatorY, outputValue);
            },
            function() {
            }
        );
    }
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
            groupEnable = true;
        }
        else if (inputTypeName == "bytes") {
            groupEnable = currentInputValue.isBytes();
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

        /* Clear any data-text-to-copy attribute for any class=autocopytagdata
         * elements in this group, so that these are not clickable unless a
         * conversion function fills in the data-text-to-copy attribute with
         * something new. */
        let autoCopyTags = outputGroupElement.getElementsByClassName("autocopytagdata");
        for (let i = 0; i < autoCopyTags.length; i++) {
            autoCopyTags[i].removeAttribute("data-text-to-copy");
        }

        /* Set the value of any outputvalue elements in this group */
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
     * outputvaluenoautocopy, has its contents automatically linkified.
     * Clicking the link feeds in the output value as the input. */
    let outputElements = document.getElementsByClassName("outputvalue");
    for (let outputIndex = 0; outputIndex < outputElements.length; outputIndex++) {
        let oe = outputElements[outputIndex];
        if (!oe.classList.contains("clicktocopy") && !oe.classList.contains("outputvaluenoautocopy")) {
            oe.addEventListener("click", outputValueClickHandler);
            oe.classList.add("clicktocopy");
        }
    }

    setButtonsEnabledState();

    /* Change the URL query string to reflect the new input */
    updateURL(inputBox.value);
}

function getSelectedIntType() {
    let radioButtons = document.getElementsByName("inttype");
    let intTypeStr = null;
    let intType = {};
    for (let i = 0; i < radioButtons.length; i++) {
        if (radioButtons[i].checked) {
            intTypeStr = radioButtons[i].value;
            break;
        }
    }
    if (intTypeStr == null)
        return null;

    return getIntTypeFromButtonValue(intTypeStr);
}

function modifyBinaryInt(func) {
    let selectedIntType = getSelectedIntType();
    if (selectedIntType == null) {
        return false;
    }

    let binaryInt = createBinaryIntFromString(inputBox.value,
        Math.floor(selectedIntType["bits"] / 8), selectedIntType["signed"]);
    if (binaryInt) {
        func(binaryInt);
        let text = currentInputValue.formatBinaryInt(binaryInt);
        inputBox.value = text;
        inputChanged(text);
        return true;
    }

    return false;
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

function endianSwapInputBytes(numBytes) {
    if (currentInputValue.isBytes()) {
        let bytes = currentInputValue.getBytes();
        let swappedBytes = swapByteOrder(bytes, numBytes, true);
        if (swappedBytes) {
            let newText = formatByteArray(swappedBytes, numBytes);
            if (newText) {
                inputBox.value = newText;
                inputChanged(newText);
            }
        }
    }
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

function intTypeRadioButtonClicked(e) {
    setButtonsEnabledState();
}

function changeBytesTextDecodingMode() {
    refresh();
}

function toggleHelp() {
    let showHelpButton = document.getElementById("helpexpandbutton");
    let helpText = document.getElementById("helptext");
    if (helpText) {
        if (helpText.style.display == "none") {
            helpText.style.display = "block";
            showHelpButton.innerText = "▲";
        }
        else {
            helpText.style.display = "none";
            showHelpButton.innerText = "▼";
        }
    }
    return false;
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
    if ("u" in queryString) {
        setSelectOptionValue("textdecoding", queryString["u"]);
    }
    if ("t" in queryString) {
        setCheckboxValue("unixtsscale-auto", false);
        setRadioButtonValue("unixtsscale", queryString["t"]);
    }

    inputBox.focus();
    initialiseConversionControls();

    /* Do some button setup admin */
    let intRadioButtons = document.getElementsByName("inttype");
    for (let i = 0; i < intRadioButtons.length; i++) {
        intTypeRadioButtons[intRadioButtons[i].value] = intRadioButtons[i];
        intRadioButtons[i].addEventListener("click", intTypeRadioButtonClicked);
    }

    endianSwap16Button = document.getElementById("endianswap16int");
    endianSwap32Button = document.getElementById("endianswap32int");
    endianSwap64Button = document.getElementById("endianswap64int");

    intManipulationButtons.push(endianSwap16Button);
    intManipulationButtons.push(endianSwap32Button);
    intManipulationButtons.push(endianSwap64Button);
    intManipulationButtons.push(document.getElementById("incrementint"));
    intManipulationButtons.push(document.getElementById("decrementint"));
    intManipulationButtons.push(document.getElementById("shiftleftint"));
    intManipulationButtons.push(document.getElementById("shiftrightint"));

    inputChanged(inputBox.value);
}
