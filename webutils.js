/* General utility functions for manipulating HTML elements. */

function buildQueryString(namesValues) {
    let q = "";
    for (let name in namesValues) {
        if (q.length > 0)
            q += "&";
        q += encodeURIComponent(name) + "=" + encodeURIComponent(namesValues[name].toString());
    }
    return q;
}

function getCheckBoxValue(id) {
    let cb = document.getElementById(id);
    if (cb) {
        return cb.checked;
    }
    else {
        return false;
    }
}

function getRadioButtonValue(name) {
    let radios = document.getElementsByName(name);
    for (let i = 0; i < radios.length; i++) {
        if (radios[i].checked) {
            return radios[i].value;
        }
    }
    return null;
}

function getSelectOptionValue(name) {
    let select = document.getElementsByName(name);
    if (select.length == 0)
        return null;
    select = select[0];
    if (select.selectedIndex >= 0 && select.selectedIndex < select.options.length) {
        return select.options[select.selectedIndex].value;
    }
    else {
        return null;
    }
}

function setSelectOptionValue(name, value) {
    let select = document.getElementsByName(name);
    if (select.length > 0) {
        select = select[0];
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value == value) {
                select.selectedIndex = i;
                break;
            }
        }
    }
}

function setCheckboxValue(id, value) {
    let cb = document.getElementById(id);
    if (cb) {
        cb.checked = value;
    }
}

function setRadioButtonValue(name, value) {
    let radios = document.getElementsByName(name);
    for (let i = 0; i < radios.length; i++) {
        radios[i].checked = (radios[i].value == value);
    }
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
