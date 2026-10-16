
let copyIndicator = null;
let copyIndicatorTimeout = null;

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

function clickToCopyHandler(event) {
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

function attachCopyHandlerToAutoCopyTagData() {
    let autoCopyTags = document.getElementsByClassName("autocopytagdata");
    for (let i = 0; i < autoCopyTags.length; i++) {
        autoCopyTags[i].addEventListener("click", clickToCopyHandler);
    }
}

/* Attach the click-to-copy handler to all elements with the class className
 * which do not already have the clicktocopy class and which do not have
 * the class excludeClassName (which is ignored if null). */
function attachCopyHandlerToElementsWithClass(className, excludeClassName) {
    let outputElements = document.getElementsByClassName(className);
    for (let outputIndex = 0; outputIndex < outputElements.length; outputIndex++) {
        let oe = outputElements[outputIndex];
        if (!oe.classList.contains("clicktocopy") && (excludeClassName == null || !oe.classList.contains(excludeClassName))) {
            oe.addEventListener("click", clickToCopyHandler);
            oe.classList.add("clicktocopy");
        }
    }
}
