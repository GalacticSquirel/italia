// dump make_qx_quants(16,32,...,1) sub-block scales for in.f32 (n floats) -> out.f32 (n/16)
#include "ggml-quants.c"
int main(int argc, char **argv) {
    long n = atol(argv[1]);
    float *x = malloc(n * 4), *s = malloc(n / 16 * 4);
    FILE *f = fopen(argv[2], "rb"); fread(x, 4, n, f); fclose(f);
    int8_t L[16];
    for (long b = 0; b < n / 16; b++) s[b] = make_qx_quants(16, 32, x + 16 * b, L, 1, NULL);
    f = fopen(argv[3], "wb"); fwrite(s, 4, n / 16, f); fclose(f);
    return 0;
}
