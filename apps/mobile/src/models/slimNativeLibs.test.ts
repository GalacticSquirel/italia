/**
 * The APK-slimming config plugin leaves an engine build out of the APK only
 * once the manifest says it is published for download.
 */
import { MANIFEST } from './manifest';

const { slimProperties } = jest.requireActual<{
  slimProperties: (models: readonly unknown[]) => Record<string, string>;
}>('../../plugins/withSlimNativeLibs');

const engine = (name: string, available?: boolean) => ({
  kind: 'engine',
  files: [{ name, ...(available === undefined ? {} : { available }) }],
});

describe('withSlimNativeLibs', () => {
  it('always compresses native libraries', () => {
    expect(slimProperties([])).toEqual({ 'expo.useLegacyPackaging': 'true' });
  });

  it('keeps unpublished engine builds in the APK', () => {
    expect(slimProperties([engine('librnllama_v8.so', false)])).toEqual({
      'expo.useLegacyPackaging': 'true',
    });
  });

  it('leaves published builds and the Hexagon build out', () => {
    const props = slimProperties([engine('librnllama_v8.so'), engine('librnllama_v8_2.so', false)]);
    expect(props['android.packagingOptions.excludes']).toBe(
      '**/librnllama_v8.so,**/librnllama_v8_2_dotprod_i8mm_hexagon_opencl.so',
    );
    expect(props.rnllamaVariants?.split(',')).not.toContain(
      'rnllama_v8_2_dotprod_i8mm_hexagon_opencl',
    );
    expect(props.rnllamaVariants?.split(',')).toContain('rnllama');
  });

  it('never leaves out the generic build the app falls back to', () => {
    const props = slimProperties(
      MANIFEST.models.map((m) => ({
        ...m,
        files: m.files.map((f) => ({ ...f, available: true })),
      })),
    );
    expect(props['android.packagingOptions.excludes']).not.toMatch(/\*\*\/librnllama\.so/);
  });
});
