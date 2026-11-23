// qref <q6_k|q4_0> rows cols in.f32 out.f32 : ggml quantize (no imatrix) + dequantize
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "ggml.h"
int main(int argc, char **argv) {
    enum ggml_type t = strcmp(argv[1], "q6_k") == 0 ? GGML_TYPE_Q6_K : GGML_TYPE_Q4_0;
    long rows = atol(argv[2]), cols = atol(argv[3]);
    float *x = malloc(rows * cols * 4), *y = malloc(rows * cols * 4);
    FILE *f = fopen(argv[4], "rb"); fread(x, 4, rows * cols, f); fclose(f);
    size_t rs = ggml_row_size(t, cols);
    char *q = malloc(rs * rows);
    ggml_quantize_init(t);
    ggml_quantize_chunk(t, x, q, 0, rows, cols, NULL);
    const struct ggml_type_traits *tr = ggml_get_type_traits(t);
    for (long r = 0; r < rows; r++) tr->to_float(q + r * rs, y + r * cols, cols);
    f = fopen(argv[5], "wb"); fwrite(y, 4, rows * cols, f); fclose(f);
    return 0;
}
