# On-device latency harness (llama-bench on a phone)

What users feel is **time to first token** (prefill of the system prompt and history) and decode
speed. Measure both on the fixed device matrix (Pixel 9, Galaxy S24, an 8 Gen 2 phone, a 6 to
8 GB mid-range phone, iPhone 15 Pro, iPhone 17 Pro) for every release candidate, with the
GGUF that will ship (Q4_0).

## Android (adb + Termux or a plain adb shell)

Build llama.cpp for arm64 with the same version that llama.rn bundles (`LLAMA_CPP_REF` in
`export/build_llama_cpp.sh`), with OpenCL for Adreno GPUs:

```sh
# on the workstation, with the Android NDK installed
cmake -B build-android -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK/build/cmake/android.toolchain.cmake \
  -DANDROID_ABI=arm64-v8a -DANDROID_PLATFORM=android-28 -DGGML_OPENCL=ON -DBUILD_SHARED_LIBS=OFF
cmake --build build-android --target llama-bench -j
adb push build-android/bin/llama-bench /data/local/tmp/
adb push out/gguf/italia-tutor-e4b-q4_0.gguf /data/local/tmp/
adb shell chmod +x /data/local/tmp/llama-bench
```

Run with the phone at room temperature, screen on, charging off, other apps closed. A tutor turn
prefills about 900 to 1,500 tokens (system prompt plus a few turns) and generates about 60 to
150:

```sh
adb shell "cd /data/local/tmp && ./llama-bench -m italia-tutor-e4b-q4_0.gguf \
  -p 512,1024,1536 -n 128 -t 4,6 -ngl 0,99 -r 3 -o json" > bench-pixel9.json
```

`-ngl 0` is CPU only; `-ngl 99` offloads to the GPU (OpenCL). Repeat after 5 minutes of
continuous use to see thermal throttling (`-r 10`).

## iOS

llama-bench cannot run as a command-line tool on iOS. Use the app's development build: the
model settings screen's benchmark (llama.rn `context.bench(pp, tg, pl, nr)`) with the same
pp 512/1024/1536 and tg 128, and export the JSON. Metal is used automatically.

## Into the report

```sh
uv run python -m eval report ... --bench pixel9=bench-pixel9.json --bench s24=bench-s24.json
```

Targets (from the research): decode at least 10 tok/s (speech needs about 3 to 4), and time to
first token under about 1.5 s for a 1,000-token prompt with the KV cache of the system prompt
reused between turns.
