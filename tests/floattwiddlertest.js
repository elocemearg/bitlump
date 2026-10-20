/* Half-precision test cases:
 * https://en.wikipedia.org/wiki/Half-precision_floating-point_format#Half_precision_examples
 */
const floatFieldTests16 = [
    {
        /* Zero */
        "value" : 0,
        "sign" : 0,
        "exponent" : -14,
        "mantissa" : 0,
        "exponentrawhex" : "0x00",
        "mantissarawhex" : "0x000",
        "hex" : "0x0000"
    },
    {
        /* 1 */
        "value" : 1,
        "sign" : 0,
        "exponent" : 0,
        "mantissa" : 1,
        "exponentrawhex" : "0x0F",
        "mantissarawhex" : "0x000",
        "hex" : "0x3C00"
    },
    {
        /* -2 */
        "value" : -2,
        "sign" : 1,
        "exponent" : 1,
        "mantissa" : 1,
        "exponentrawhex" : "0x10",
        "mantissarawhex" : "0x000",
        "hex" : "0xC000"
    },
    {
        /* smallest positive subnormal number */
        "value" : 0.000000059604645,
        "sign" : 0,
        "exponent" : -14,
        "mantissa" : 1/1024,
        "exponentrawhex" : "0x00",
        "mantissarawhex" : "0x001",
        "hex" : "0x0001"
    },
    {
        /* largest subnormal number */
        "value" : 0.000060975552,
        "sign" : 0,
        "exponent" : -14,
        "mantissa" : 1023/1024,
        "exponentrawhex" : "0x00",
        "mantissarawhex" : "0x3FF",
        "hex" : "0x03FF"
    },
    {
        /* smallest positive normal number */
        "value" : 0.00006103515625,
        "sign" : 0,
        "exponent" : -14,
        "mantissa" : 1,
        "exponentrawhex" : "0x01",
        "mantissarawhex" : "0x000",
        "hex" : "0x0400"
    },
    {
        /* nearest number to 1/3 */
        "value" : 0.33325195,
        "sign" : 0,
        "exponent" : -2,
        "mantissa" : 1 + 341/1024,
        "exponentrawhex" : "0x0D",
        "mantissarawhex" : "0x155",
        "hex" : "0x3555"
    },
    {
        /* largest number less than 1 */
        "value" : 0.99951172,
        "sign" : 0,
        "exponent" : -1,
        "mantissa" : 1 + 1023/1024,
        "exponentrawhex" : "0x0E",
        "mantissarawhex" : "0x3FF",
        "hex" : "0x3BFF"
    },
    {
        /* smallest number larger than 1 */
        "value" : 1.00097656,
        "sign" : 0,
        "exponent" : 0,
        "mantissa" : 1025/1024,
        "exponentrawhex" : "0x0F",
        "mantissarawhex" : "0x001",
        "hex" : "0x3C01"
    },
    {
        /* closest value to pi */
        "value" : 3.140625,
        "sign" : 0,
        "exponent" : 1,
        "mantissa" : 3.140625 / 2,
        "exponentrawhex" : "0x10",
        "mantissarawhex" : "0x248",
        "hex" : "0x4248"
    },
    {
        /* largest odd number: after 2048, lowest mantissa bit represents 2 */
        "value" : 2047,
        "sign" : 0,
        "exponent" : 10,
        "mantissa" : 2047 / 1024,
        "exponentrawhex" : "0x19",
        "mantissarawhex" : "0x3FF",
        "hex" : "0x67FF"
    },
    {
        /* largest normal number */
        "value" : 65504,
        "sign" : 0,
        "exponent" : 15,
        "mantissa" : 65504 / Math.pow(2, 15),
        "exponentrawhex" : "0x1E",
        "mantissarawhex" : "0x3FF",
        "hex" : "0x7BFF"
    },
    {
        /* Infinity */
        "value" : Infinity,
        "sign" : 0,
        "exponent" : 16,
        "mantissa" : 1,
        "exponentrawhex" : "0x1F",
        "mantissarawhex" : "0x000",
        "hex" : "0x7C00"
    },
    {
        /* -Infinity */
        "value" : -Infinity,
        "sign" : 1,
        "exponent" : 16,
        "mantissa" : 1,
        "exponentrawhex" : "0x1F",
        "mantissarawhex" : "0x000",
        "hex" : "0xFC00"
    },
];

/* Some test cases, most of them from https://en.wikipedia.org/wiki/Single-precision_floating-point_format#Notable_single-precision_cases */
const floatFieldTests32 = [
    {
        /* Zero */
        "value" : 0,
        "sign" : 0,
        "exponent" : -126,
        "mantissa" : 0,
        "exponentrawhex" : "0x00",
        "mantissarawhex" : "0x000000",
        "hex" : "0x00000000"
    },
    {
        /* Smallest positive subnormal number */
        "value" : 1.4012984643e-45,
        "sign" : 0,
        "exponent" : -126,
        "mantissa" : Math.pow(2, -23),
        "exponentrawhex" : "0x00",
        "mantissarawhex" : "0x000001",
        "hex" : "0x00000001",
    },
    {
        /* Largest positive subnormal number */
        "value" : 1.1754942107e-38,
        "sign" : 0,
        "exponent" : -126,
        "mantissa" : 1 - Math.pow(2, -23),
        "exponentrawhex" : "0x00",
        "mantissarawhex" : "0x7FFFFF",
        "hex" : "0x007FFFFF"
    },
    {
        /* Smallest positive normal number */
        "value" : 1.1754943508e-38,
        "sign" : 0,
        "exponent" : -126,
        "mantissa" : 1,
        "exponentrawhex" : "0x01",
        "mantissarawhex" : "0x000000",
        "hex" : "0x00800000"
    },
    {
        /* Largest number less than 1 */
        "value" : 0.999999940395355225,
        "sign" : 0,
        "exponent" : -1,
        "mantissa" : 2 * 0.999999940395355225,
        "exponentrawhex" : "0x7E",
        "mantissarawhex" : "0x7FFFFF",
        "hex" : "0x3F7FFFFF"
    },
    {
        /* 1 */
        "value" : 1,
        "sign" : 0,
        "exponent" : 0,
        "mantissa" : 1,
        "exponentrawhex" : "0x7F",
        "mantissarawhex" : "0x000000",
        "hex" : "0x3F800000"
    },
    {
        /* Smallest number larger than 1 */
        "value" : 1.00000011920928955,
        "sign" : 0,
        "exponent" : 0,
        "mantissa" : 1.00000011920928955,
        "exponentrawhex" : "0x7F",
        "mantissarawhex" : "0x000001",
        "hex" : "0x3F800001"
    },
    {
        /* -2 */
        "value" : -2,
        "sign" : 1,
        "exponent" : 1,
        "mantissa" : 1,
        "exponentrawhex" : "0x80",
        "mantissarawhex" : "0x000000",
        "hex" : "0xC0000000"
    },
    {
        /* Positive infinity */
        "value" : Infinity,
        "sign" : 0,
        "exponent" : 128,
        "mantissa" : 1,
        "exponentrawhex" : "0xFF",
        "mantissarawhex" : "0x000000",
        "hex" : "0x7F800000"
    },
    {
        /* Negative infinity */
        "value" : -Infinity,
        "sign" : 1,
        "exponent" : 128,
        "mantissa" : 1,
        "exponentrawhex" : "0xFF",
        "mantissarawhex" : "0x000000",
        "hex" : "0xFF800000"
    },
    {
        /* 1.1 */
        "value" : 1.1,
        "sign" : 0,
        "exponent" : 0,
        "mantissa" : 1.10000002384185791,
        "exponentrawhex" : "0x7F",
        "mantissarawhex" : "0x0CCCCD",
        "hex" : "0x3F8CCCCD",
        "expectedvaluefromhex" : "1.10000002", /* decimal form of nearest single-precision representation to 1.1 */
    }
];

/* Double-precision test cases:
 * https://en.wikipedia.org/wiki/Double-precision_floating-point_format#Double-precision_examples
 */
const floatFieldTests64 = [
    {
        /* Zero */
        "value" : 0,
        "sign" : 0,
        "exponent" : -1022,
        "mantissa" : 0,
        "exponentrawhex" : "0x000",
        "mantissarawhex" : "0x0000000000000",
        "hex" : "0x0000000000000000"
    },
    {
        /* 1 */
        "value" : 1,
        "sign" : 0,
        "exponent" : 0,
        "mantissa" : 1,
        "exponentrawhex" : "0x3FF",
        "mantissarawhex" : "0x0000000000000",
        "hex" : "0x3FF0000000000000"
    },
    {
        /* largest number less than 1 */
        "value" : 0.9999999999999998890,
        "sign" : 0,
        "exponent" : -1,
        "mantissa" : 2 * 0.9999999999999998890,
        "exponentrawhex" : "0x3FE",
        "mantissarawhex" : "0xFFFFFFFFFFFFF",
        "hex" : "0x3FEFFFFFFFFFFFFF"
    },
    {
        /* smallest number greater than 1 */
        "value" : 1.0000000000000002220,
        "sign" : 0,
        "exponent" : 0,
        "mantissa" : 1.0000000000000002220,
        "exponentrawhex" : "0x3FF",
        "mantissarawhex" : "0x0000000000001",
        "hex" : "0x3FF0000000000001"
    },
    {
        /* second smallest number greater than 1 */
        "value" : 1.0000000000000004441,
        "sign" : 0,
        "exponent" : 0,
        "mantissa" : 1.0000000000000004441,
        "exponentrawhex" : "0x3FF",
        "mantissarawhex" : "0x0000000000002",
        "hex" : "0x3FF0000000000002"
    },
    {
        /* 2 */
        "value" : 2,
        "sign" : 0,
        "exponent" : 1,
        "mantissa" : 1,
        "exponentrawhex" : "0x400",
        "mantissarawhex" : "0x0000000000000",
        "hex" : "0x4000000000000000"
    },
    {
        /* -2 */
        "value" : -2,
        "sign" : 1,
        "exponent" : 1,
        "mantissa" : 1,
        "exponentrawhex" : "0x400",
        "mantissarawhex" : "0x0000000000000",
        "hex" : "0xC000000000000000"
    },
    {
        /* 23 */
        "value" : 23,
        "sign" : 0,
        "exponent" : 4,
        "mantissa" : 1 + Math.pow(2, -2) + Math.pow(2, -3) + Math.pow(2, -4),
        "exponentrawhex" : "0x403",
        "mantissarawhex" : "0x7000000000000", /* 1.0111 (base 2), leading bit is implied */
        "hex" : "0x4037000000000000"
    },
    {
        /* 3/256 */
        "value" : 3/256,
        "sign" : 0,
        "exponent" : -7,
        "mantissa" : 1.5,
        "exponentrawhex" : "0x3F8",
        "mantissarawhex" : "0x8000000000000",
        "hex" : "0x3F88000000000000"
    },
    {
        /* smallest positive subnormal number */
        "value" : 4.9406564584124654e-324,
        "sign" : 0,
        "exponent" : -1022,
        "mantissa" : Math.pow(2, -52),
        "exponentrawhex" : "0x000",
        "mantissarawhex" : "0x0000000000001",
        "hex" : "0x0000000000000001"
    },
    {
        /* largest subnormal number */
        "value" : 2.2250738585072009e-308,
        "sign" : 0,
        "exponent" : -1022,
        "mantissa" : 1 - Math.pow(2, -52),
        "exponentrawhex" : "0x000",
        "mantissarawhex" : "0xFFFFFFFFFFFFF",
        "hex" : "0x000FFFFFFFFFFFFF"
    },
    {
        /* smallest positive normal number */
        "value" : 2.2250738585072014e-308,
        "sign" : 0,
        "exponent" : -1022,
        "mantissa" : 1,
        "exponentrawhex" : "0x001",
        "mantissarawhex" : "0x0000000000000",
        "hex" : "0x0010000000000000"
    },
    {
        /* largest normal number */
        "value" : 1.7976931348623157e308,
        "sign" : 0,
        "exponent" : 1023,
        "mantissa" : 2 - Math.pow(2, -52),
        "exponentrawhex" : "0x7FE",
        "mantissarawhex" : "0xFFFFFFFFFFFFF",
        "hex" : "0x7FEFFFFFFFFFFFFF"
    },
    {
        /* positive infinity */
        "value" : Infinity,
        "sign" : 0,
        "exponent" : 1024,
        "mantissa" : 1,
        "exponentrawhex" : "0x7FF",
        "mantissarawhex" : "0x0000000000000",
        "hex" : "0x7FF0000000000000"
    },
    {
        /* negative infinity */
        "value" : -Infinity,
        "sign" : 1,
        "exponent" : 1024,
        "mantissa" : 1,
        "exponentrawhex" : "0x7FF",
        "mantissarawhex" : "0x0000000000000",
        "hex" : "0xFFF0000000000000"
    },
    {
        /* Closest approximation to 1/3 */
        "value" : 1/3,
        "sign" : 0,
        "exponent" : -2,
        "mantissa" : 4/3,
        "exponentrawhex" : "0x3FD",
        "mantissarawhex" : "0x5555555555555",
        "hex" : "0x3FD5555555555555"
    },
    {
        /* 1.1, which shows up as 1.1000000000000001 to 17 digits */
        "value" : 1.1,
        "sign" : 0,
        "exponent" : 0,
        "mantissa" : 1.1,
        "exponentrawhex" : "0x3FF",
        "mantissarawhex" : "0x199999999999A",
        "hex" : "0x3FF199999999999A",
        "expectedvaluefromhex" : "1.1000000000000001"
    }
];

function reportTestFailure(suiteName, testIndex, test, message) {
    console.error(`${suiteName}: test ${testIndex + 1} FAILED: ${test.value}, ${test.hex}`);
    console.error("    " + message);
}

function testFloatFields(suiteName, tests, scheme, createFunction) {
    let testsPassed = 0;
    for (let testIndex = 0; testIndex < tests.length; testIndex++) {
        let test = tests[testIndex];
        let bin = createFunction(test.value);
        if (bin == null) {
            reportTestFailure(suiteName, testIndex, test, "createFunction(" + test.value.toString() + ") returned null")
            continue;
        }

        if (scheme.getSign(bin) != (test.sign ? "-" : "+")) {
            reportTestFailure(suiteName, testIndex, test, "getSign() returned wrong result");
            continue;
        }

        let observedExponent = scheme.getExponent(bin);
        if (observedExponent != test.exponent) {
            reportTestFailure(suiteName, testIndex, test, `getExponent(): expected ${test.exponent}, observed ${observedExponent}`);
            continue;
        }

        let observedMantissa = scheme.getMantissa(bin);
        if (observedMantissa != test.mantissa) {
            reportTestFailure(suiteName, testIndex, test, `getMantissa(): expected ${test.mantissa}, observed ${observedMantissa}`);
            continue;l
        }

        let observedExponentRawHex = scheme.getExponentRawHex(bin);
        if (observedExponentRawHex != test.exponentrawhex) {
            reportTestFailure(suiteName, testIndex, test, `getExponentRawHex(): expected ${test.exponentrawhex}, observed ${observedExponentRawHex}`);
            continue;
        }

        let observedMantissaRawHex = scheme.getMantissaRawHex(bin);
        if (observedMantissaRawHex != test.mantissarawhex) {
            reportTestFailure(suiteName, testIndex, test, `getMantissaRawHex(): expected ${test.mantissarawhex}, observed ${observedMantissaRawHex}`);
            continue;
        }

        let observedHex = scheme.getHex(bin);
        let expectedHex = test.hex;
        if (expectedHex.startsWith("0x")) {
            /* getHex() doesn't prefix the "0x" */
            expectedHex = expectedHex.substring(2);
        }
        if (observedHex != expectedHex) {
            reportTestFailure(suiteName, testIndex, test, `getHex(): expected ${expectedHex}, observed ${observedHex}`);
            continue;
        }

        let binFromValue = createBinaryIntFromHex(test.hex, Math.floor(scheme.getNumBits() / 8));
        let observedValue = scheme.getValueString(binFromValue);
        let expectedValue = test.expectedvaluefromhex;
        if (expectedValue == null) {
            expectedValue = test.value.toPrecision(scheme.getRoundTripDecimalDigits());
        }
        if (observedValue != expectedValue) {
            reportTestFailure(suiteName, testIndex, test, `getValueString(): expected ${expectedValue}, observed ${observedValue}`);
            continue;
        }

        testsPassed++;
    }

    console.log(`${suiteName}: ${testsPassed}/${tests.length} tests passed.`);
    if (testsPassed != tests.length) {
        console.error(`${suiteName}: ${tests.length - testsPassed} tests failed.`);
    }

    return testsPassed == tests.length;
}

function runTests() {
    let result = true;
    result = testFloatFields("testFloatFields (16)", floatFieldTests16, floatSchemes[16], createBinaryIntFromFloat16Bin) && result;
    result = testFloatFields("testFloatFields (32)", floatFieldTests32, floatSchemes[32], createBinaryIntFromFloat32Bin) && result;
    result = testFloatFields("testFloatFields (64)", floatFieldTests64, floatSchemes[64], createBinaryIntFromFloat64Bin) && result;
    if (result) {
        console.log("All tests passed.");
    }
    else {
        console.log("Some tests failed. See above.");
    }
    return result;
}
