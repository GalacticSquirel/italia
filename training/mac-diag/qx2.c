// in.f32 n -> d.f32 (n/256), sc.f32 (n/16), deq.f32 (n) using quantize_row_q6_K_ref compiled here
#include "ggml-quants.c"
int main(int argc, char **argv) {
    long n = atol(argv[1]), nb = n / 256;
    float *x = malloc(n * 4), *d = malloc(nb * 4), *sc = malloc(n / 16 * 4), *y = malloc(n * 4);
    FILE *f = fopen(argv[2], "rb"); fread(x, 4, n, f); fclose(f);
    block_q6_K *q = malloc(nb * sizeof(block_q6_K));
    quantize_row_q6_K_ref(x, q, n);
    dequantize_row_q6_K(q, y, n);
    for (long i = 0; i < nb; i++) { d[i] = GGML_FP16_TO_FP32(q[i].d); for (int j = 0; j < 16; j++) sc[i*16+j] = q[i].scales[j]; }
    f = fopen("/tmp/c_d.f32", "wb"); fwrite(d, 4, nb, f); fclose(f);
    f = fopen("/tmp/c_sc.f32", "wb"); fwrite(sc, 4, n / 16, f); fclose(f);
    f = fopen("/tmp/c_y.f32", "wb"); fwrite(y, 4, n, f); fclose(f);
    return 0;
}
