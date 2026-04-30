const METADATA_DIRECTIVES = new Set([
  'title',
  'subtitle',
  'artist',
  'album',
  'key',
  'tempo',
  'capo',
  'year',
]);

const SECTION_LABELS: Record<string, string> = {
  chorus: 'Chorus',
  verse: 'Verse',
  bridge: 'Bridge',
  tab: 'Tab',
};

const DIRECTIVE_ALIASES: Record<string, string> = {
  t: 'title',
  st: 'subtitle',
  c: 'comment',
  soc: 'start_of_chorus',
  eoc: 'end_of_chorus',
  sov: 'start_of_verse',
  eov: 'end_of_verse',
  sob: 'start_of_bridge',
  eob: 'end_of_bridge',
  sot: 'start_of_tab',
  eot: 'end_of_tab',
};

export type ChordSegment = {
  chord?: string;
  lyric: string;
  width: number;
};

export type SongLineBlock = {
  type: 'line';
  variant: 'plain' | 'chorded';
  text?: string;
  segments?: ChordSegment[];
};

export type SongCommentBlock = {
  type: 'comment';
  text: string;
};

export type SongDirectiveBlock = {
  type: 'directive';
  text: string;
};

export type SongSpacerBlock = {
  type: 'spacer';
};

export type SongSectionBlock = {
  type: 'section';
  label: string;
  lines: SongBlock[];
};

export type SongBlock =
  | SongLineBlock
  | SongCommentBlock
  | SongDirectiveBlock
  | SongSpacerBlock
  | SongSectionBlock;

export type SongDocument = {
  title: string;
  subtitle?: string;
  metadata: Record<string, string>;
  blocks: SongBlock[];
};

type BlockCollector = {
  label: string;
  lines: SongBlock[];
};

type ParsedDirective = {
  name: string;
  value: string;
};

export function parseChordPro(source: string): SongDocument {
  const document: SongDocument = {
    title: 'Untitled Song',
    metadata: {},
    blocks: [],
  };

  const collectors: BlockCollector[] = [];

  const pushBlock = (block: SongBlock) => {
    const currentCollector = collectors[collectors.length - 1];
    if (currentCollector) {
      currentCollector.lines.push(block);
      return;
    }
    document.blocks.push(block);
  };

  for (const rawLine of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.replace(/\t/g, '    ');

    if (line.trim() === '') {
      pushBlock({ type: 'spacer' });
      continue;
    }

    const directive = parseDirective(line);
    if (directive) {
      if (applyDirective(document, collectors, directive, pushBlock)) {
        continue;
      }
    }

    const segments = parseChordLine(line);
    if (segments) {
      pushBlock({ type: 'line', variant: 'chorded', segments });
    } else {
      pushBlock({ type: 'line', variant: 'plain', text: line });
    }
  }

  while (collectors.length > 0) {
    const dangling = collectors.pop() as BlockCollector;
    pushBlock({ type: 'section', label: dangling.label, lines: dangling.lines });
  }

  return document;
}

function parseDirective(line: string): ParsedDirective | null {
  const match = line.match(/^\{\s*([^:}]+?)\s*(?::\s*([^}]*))?\}$/);
  if (!match) {
    return null;
  }

  const rawName = match[1].trim().toLowerCase().replace(/\s+/g, '_');
  const name = DIRECTIVE_ALIASES[rawName] ?? rawName;
  return {
    name,
    value: (match[2] ?? '').trim(),
  };
}

function applyDirective(
  document: SongDocument,
  collectors: BlockCollector[],
  directive: ParsedDirective,
  pushBlock: (block: SongBlock) => void,
): boolean {
  if (METADATA_DIRECTIVES.has(directive.name)) {
    if (directive.name === 'title' && directive.value) {
      document.title = directive.value;
    } else if (directive.name === 'subtitle' && directive.value) {
      document.subtitle = directive.value;
    } else if (directive.value) {
      document.metadata[directive.name] = directive.value;
    }
    return true;
  }

  if (directive.name === 'comment') {
    pushBlock({ type: 'comment', text: directive.value });
    return true;
  }

  const startMatch = directive.name.match(/^start_of_(chorus|verse|bridge|tab)$/);
  if (startMatch) {
    const sectionName = startMatch[1];
    collectors.push({
      label: SECTION_LABELS[sectionName] ?? capitalize(sectionName),
      lines: [],
    });
    return true;
  }

  const endMatch = directive.name.match(/^end_of_(chorus|verse|bridge|tab)$/);
  if (endMatch) {
    const section = collectors.pop();
    if (section) {
      pushBlock({ type: 'section', label: section.label, lines: section.lines });
    }
    return true;
  }

  if (directive.name === 'new_page') {
    pushBlock({ type: 'directive', text: 'Page break' });
    return true;
  }

  return false;
}

function parseChordLine(line: string): ChordSegment[] | null {
  if (!line.includes('[') || !line.includes(']')) {
    return null;
  }

  const matcher = /\[([^\]]+)\]/g;
  const segments: ChordSegment[] = [];
  let previousIndex = 0;
  let pendingChord: string | undefined;

  for (const match of line.matchAll(matcher)) {
    const lyric = line.slice(previousIndex, match.index);
    if (pendingChord) {
      segments.push(createSegment(pendingChord, lyric));
    } else if (lyric.length > 0) {
      segments.push(createSegment(undefined, lyric));
    }

    pendingChord = match[1].trim();
    previousIndex = (match.index ?? 0) + match[0].length;
  }

  const tail = line.slice(previousIndex);
  if (pendingChord || tail.length > 0) {
    segments.push(createSegment(pendingChord, tail));
  }

  return segments.length > 0 ? segments : null;
}

function createSegment(chord: string | undefined, lyric: string): ChordSegment {
  return {
    chord,
    lyric,
    width: Math.max(chord?.length ?? 0, lyric.length, 1),
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}