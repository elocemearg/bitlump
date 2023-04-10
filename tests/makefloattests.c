#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <getopt.h>
#include <time.h>
#include <math.h>
#include <errno.h>
#include <fenv.h>
#include <error.h>
#include <float.h>

void
write_float32_test_case(FILE *out, float f) {
    unsigned char *x = (unsigned char *) &f;
    char float_hex[11];
    strcpy(float_hex, "0x");
    for (int i = 0; i < 4; i++) {
        sprintf(float_hex + 2 + i * 2, "%02x", (unsigned int) x[3 - i]);
    }
    float_hex[10] = '\0';
    fprintf(out, "    { \"input\": \"%s\", \"expectedValue\": \"%.6e\", \"expectedValueExtra\": \"%.7e\" },\n",
            float_hex, (double) f, (double) f);
}

void
write_float64_test_case(FILE *out, double f) {
    unsigned char *x = (unsigned char *) &f;
    char float_hex[19];
    strcpy(float_hex, "0x");
    for (int i = 0; i < 8; i++) {
        sprintf(float_hex + 2 + i * 2, "%02x", (unsigned int) x[7 - i]);
    }
    float_hex[18] = '\0';
    fprintf(out, "    { \"input\": \"%s\", \"expectedValue\": \"%.14e\", \"expectedValueExtra\": \"%.15e\" },\n",
            float_hex, f, f);
}

int
random_bool() {
    return rand() > RAND_MAX / 2;
}

float random_float32() {
    float ret = 0;
    do {
        float f = 1;
        float bit_value = 0.5;
        int e;

        /* Generate a random 23-bit mantissa */
        for (int i = 0; i < 23; i++) {
            if (random_bool()) {
                f += bit_value;
            }
            bit_value /= 2;
        }
        if (random_bool()) {
            f = -f;
        }

        /* Generate a random exponent, not all zeroes or all ones */
        e = 1 + rand() % 254;

        feclearexcept(FE_ALL_EXCEPT);
        ret = ldexpf(f, e - 127);
    } while (fetestexcept(FE_INVALID | FE_OVERFLOW | FE_UNDERFLOW));
    return ret;
}

double random_float64() {
    double ret = 0;
    do {
        double d = 1;
        double bit_value = 0.5;
        int e;

        /* Generate a random 52-bit mantissa */
        for (int i = 0; i < 52; i++) {
            if (random_bool()) {
                d += bit_value;
            }
            bit_value /= 2;
        }
        if (random_bool()) {
            d = -d;
        }

        /* Generate a random 11-bit exponent, not all zeroes or all ones */
        e = 1 + rand() % 2046;

        feclearexcept(FE_ALL_EXCEPT);
        ret = ldexp(d, e - 1023);
    } while (fetestexcept(FE_INVALID | FE_OVERFLOW | FE_OVERFLOW));
    return ret;
}

int main(int argc, char **argv) {
    char *output_filename = "floattestdata.js";
    int num_random_tests = 10000;
    FILE *out;
    int seed = 1;
    int c;
    
    while ((c = getopt(argc, argv, "hn:s:")) != -1) {
        switch (c) {
            case 'n':
                num_random_tests = atoi(optarg);
                break;

            case 's':
                seed = atoi(optarg);
                break;

            case 'h':
                printf("Usage: makefloattests [-n numrandomtests] [-s seed]\n");
                printf("Output file is %s\n", output_filename);
                exit(0);
                break;

            default:
                exit(1);
        }
    }
    srand(seed);

    out = fopen(output_filename, "w");
    if (out == NULL) {
        error(1, errno, "%s", output_filename);
    }

    fprintf(out, "const float32Tests = [\n");

    write_float32_test_case(out, 0);
    write_float32_test_case(out, 1);
    write_float32_test_case(out, -1);
    write_float32_test_case(out, FLT_MIN);
    write_float32_test_case(out, FLT_MAX);
    for (int i = 0; i < num_random_tests; ++i) {
        write_float32_test_case(out, random_float32());
    }
    fprintf(out, "];\n");

    fprintf(out, "const float64Tests = [\n");
    write_float64_test_case(out, 0);
    write_float64_test_case(out, 1);
    write_float64_test_case(out, -1);
    write_float64_test_case(out, DBL_MIN);
    write_float64_test_case(out, DBL_MAX);
    for (int i = 0; i < num_random_tests; ++i) {
        write_float64_test_case(out, random_float64());
    }
    fprintf(out, "];\n");

    fclose(out);

    return 0;
}
