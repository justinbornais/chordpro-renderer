type ChordSketchModule = typeof import('@chordsketch/wasm');

let chordSketchPromise: Promise<ChordSketchModule> | null = null;

export async function getChordSketch() {
  if (!chordSketchPromise) {
    chordSketchPromise = import('@chordsketch/wasm').then(async (module) => {
      await module.default();
      return module;
    });
  }

  return chordSketchPromise;
}