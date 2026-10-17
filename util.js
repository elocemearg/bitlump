
function leftPad(s, padChar, desiredLength) {
    let numPads = desiredLength - s.length;
    if (numPads > 0) {
        return Array(numPads).fill(padChar).join("") + s;
    }
    else {
        return s;
    }
}

function intToHex(i, fieldWidth=0, add0x=false) {
    return (add0x ? "0x" : "") + leftPad(i.toString(16).toUpperCase(), '0', fieldWidth);
}

function getContainingLabel(element) {
    while (element != null && element.tagName.toLowerCase() != "label") {
        element = element.parentElement;
    }
    return element;
}
