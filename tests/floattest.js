function fixExponentDigits(resultString) {
    /* C's printf() always gives at least two exponent digits, even if the
     * exponent is less than 10 (e.g. "1.000000e+05"), so before comparing with
     * the expected value which a C program generated, add the leading zero if
     * necessary. */
    if (resultString.length >= 3 &&
            resultString.charAt(resultString.length - 3) == 'e' &&
            (resultString.charAt(resultString.length - 2) == '+' ||
                resultString.charAt(resultString.length - 2) == '-')) {
        return resultString.substr(0, resultString.length - 1) + "0" + resultString.charAt(resultString.length - 1);
    }
    else {
        return resultString;
    }
}

function runFloatTest() {
    let testArrays = [ float32Tests, float64Tests ];
    let failed = false;
    let testsPassed = 0;
    let testsRun = 0;
    let roundingDiscrepancies = [0, 0];

    for (let a = 0; a < 2; a++) {
        let name = (a == 0 ? "float32" : "float64");
        let tests = testArrays[a];
        for (let i = 0; i < tests.length; i++) {
            let inputHexString = tests[i].input;
            let expectedString = tests[i].expectedValue;
            let expectedStringExtraPrec = tests[i].expectedValueExtra;

            let b = createBinaryIntFromString(inputHexString, 8, false);

            let result = (a == 0 ? b.getCastFloat32() : b.getCastFloat64());
            let resultString = (a == 0 ? result.toExponential(6) : result.toExponential(14));

            /* If the resultString ends with e[+-] followed by only one digit,
             * add a leading zero to the exponent because C printf() always
             * produces an exponent of at least two digits. */
            resultString = fixExponentDigits(resultString);

            if (resultString != expectedString) {
                /* When C's printf() rounds to a given number of decimal places,
                 * it breaks ties by rounding to nearest even. JavaScript's
                 * .toExponential() function breaks ties by rounding away from
                 * zero. So if the result doesn't match what we expected, try
                 * again with one extra decimal place and see if that
                 * resolves things. */
                let resultStringExtraPrec = (a == 0 ? result.toExponential(7) : result.toExponential(15));
                resultStringExtraPrec = fixExponentDigits(resultStringExtraPrec);
                if (resultStringExtraPrec != expectedStringExtraPrec) {
                    console.log(name + " test " + (i + 1).toString() + "/" +
                        tests.length + ": input " + inputHexString +
                        ", expected " + expectedString +
                        ", observed " + resultString);
                    failed = true;
                }
                else {
                    roundingDiscrepancies[a]++;
                    testsPassed++;
                }
            }
            else {
                testsPassed++;
            }
            testsRun++;
        }
    }
    console.log(testsPassed.toString() + "/" + testsRun.toString() + " tests passed.");
    console.log(roundingDiscrepancies[0].toString() + " float32 values and " +
        roundingDiscrepancies[1].toString() + " float64 values rounded " +
        "differently from C but passed when an additional digit was provided.");
    if (!failed) {
        console.log("All tests passed.");
    }
}
