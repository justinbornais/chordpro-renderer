const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

const SHARP_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const MAJOR_KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEY_NAMES = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

export type SongKey = {
  tonic: number;
  minor: boolean;
  canonical: string;
  preferFlats: boolean;
};

export function getSongKey(source: string): SongKey | null {
  const match = source.match(/^\{\s*(?:key|k)\s*:\s*([^}]+)\}$/im);
  if (!match) {
    return null;
  }

  return parseKey(match[1]);
}

export function getTransposeOptions(minor: boolean): string[] {
  return minor ? MINOR_KEY_NAMES : MAJOR_KEY_NAMES;
}

export function transposeChordPro(source: string, targetKeyName: string): string {
  const sourceKey = getSongKey(source);
  const targetKey = parseKey(targetKeyName);

  if (!sourceKey || !targetKey || sourceKey.minor !== targetKey.minor) {
    return source;
  }

  const semitoneDelta = mod(targetKey.tonic - sourceKey.tonic, 12);
  const normalizedSource = source.replace(/\r\n/g, '\n');

  return normalizedSource
    .split('\n')
    .map((line) => {
      const updatedKeyLine = updateKeyDirective(line, targetKey.canonical);
      if (updatedKeyLine) {
        return updatedKeyLine;
      }

      return line.replace(/\[([^\]]+)\]/g, (_, chord: string) => {
        return `[${transposeChordSymbol(chord, semitoneDelta, targetKey.preferFlats)}]`;
      });
    })
    .join('\n');
}

function parseKey(value: string): SongKey | null {
  const normalized = value.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  const match = normalized.match(/^([A-Ga-g])([#b]?)(.*)$/);
  if (!match) {
    return null;
  }

  const tonic = parseNote(`${match[1].toUpperCase()}${match[2]}`);
  if (tonic === null) {
    return null;
  }

  const suffix = match[3].trim().toLowerCase();
  const minor = parseMinorFlag(suffix);
  if (minor === null) {
    return null;
  }

  const canonical = minor ? MINOR_KEY_NAMES[tonic] : MAJOR_KEY_NAMES[tonic];
  return {
    tonic,
    minor,
    canonical,
    preferFlats: FLAT_KEYS.has(canonical),
  };
}

function parseMinorFlag(suffix: string): boolean | null {
  if (suffix === '' || suffix === 'maj' || suffix === 'major') {
    return false;
  }

  if (suffix === 'm' || suffix === 'min' || suffix === 'minor') {
    return true;
  }

  return null;
}

function updateKeyDirective(line: string, nextKey: string): string | null {
  const match = line.match(/^(\{\s*(?:key|k)\s*:\s*)([^}]+)(\s*\})$/i);
  if (!match) {
    return null;
  }

  return `${match[1]}${nextKey}${match[3]}`;
}

function transposeChordSymbol(chord: string, semitoneDelta: number, preferFlats: boolean): string {
  const match = chord.match(/^(\s*)([A-Ga-g])([#b♭♯]?)(.*?)(\s*)$/);
  if (!match) {
    return chord;
  }

  const leadingWhitespace = match[1];
  const rootSemitone = parseNote(`${match[2].toUpperCase()}${normalizeAccidental(match[3])}`);
  if (rootSemitone === null) {
    return chord;
  }

  const trailingWhitespace = match[5];
  const body = match[4].replace(/\/([A-Ga-g])([#b♭♯]?)/g, (_, note: string, accidental: string) => {
    const bassSemitone = parseNote(`${note.toUpperCase()}${normalizeAccidental(accidental)}`);
    if (bassSemitone === null) {
      return `/${note}${accidental}`;
    }

    return `/${formatNote(bassSemitone + semitoneDelta, preferFlats)}`;
  });

  return `${leadingWhitespace}${formatNote(rootSemitone + semitoneDelta, preferFlats)}${body}${trailingWhitespace}`;
}

function parseNote(note: string): number | null {
  const semitone = NOTE_TO_SEMITONE[note];
  return semitone === undefined ? null : semitone;
}

function formatNote(semitone: number, preferFlats: boolean): string {
  const normalizedSemitone = mod(semitone, 12);
  return preferFlats ? FLAT_NOTE_NAMES[normalizedSemitone] : SHARP_NOTE_NAMES[normalizedSemitone];
}

function normalizeAccidental(value: string): string {
  return value.replace('♯', '#').replace('♭', 'b');
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}