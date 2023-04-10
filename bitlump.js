
let mainDiv = null;
let inputBox = null;

function inputChanged(text) {
    let inputValue = new InputValue(text);
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
            else {
                outputValue = converter.convert(inputValue);
            }
            if (outputValue !== null) {
                odiv.innerText = outputValue;
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
