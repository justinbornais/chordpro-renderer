import { useMemo, useRef, useState } from 'preact/hooks';
import { parseChordPro, type SongBlock, type SongDocument, type SongSectionBlock } from './chordpro';

const SAMPLE_CHORDPRO = `{title: Midnight Train}
{subtitle: Practice Draft}
{artist: Rowan Hale}
{key: Em}
{tempo: 92}

{comment: Keep the verse restrained and let the chorus lift.}

[Em]Headlights blur across the [C]river
[G]Signals shake the station [D]glass
[Em]Every mile gets lighter than the [C]winter
[G]Every promise says this fear will [D]pass

{start_of_chorus}
[C]Carry me home on a [G]midnight train
[D]Back to the words I could [Em]never explain
[C]Hold the line till the [G]morning breaks
[D]I will be there when the [Em]city wakes
{end_of_chorus}

This last line has no chords, just lyrics.`;

const DOWNLOAD_NAME_FALLBACK = 'chordpro-song';

export default function App() {
  const [source, setSource] = useState(SAMPLE_CHORDPRO);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);

  const document = useMemo(() => parseChordPro(source), [source]);

  async function handlePdfExport() {
    if (!previewRef.current || isExporting) {
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);

    try {
      const { exportElementToPdf } = await import('./pdf');
      await exportElementToPdf(previewRef.current, toFileName(document));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to export the current document.';
      setErrorMessage(message);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">ChordPro Playground</p>
          <h1>Write, preview, and export songs in one page.</h1>
          <p className="hero-copy">
            The editor understands common ChordPro directives, renders chord sheets instantly, and exports the
            current preview to PDF.
          </p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={() => setSource(SAMPLE_CHORDPRO)}>
            Reset sample
          </button>
          <button className="primary-button" type="button" onClick={handlePdfExport} disabled={isExporting}>
            {isExporting ? 'Exporting PDF...' : 'Download PDF'}
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="panel editor-panel" aria-labelledby="editor-heading">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Source</p>
              <h2 id="editor-heading">ChordPro</h2>
            </div>
            <p className="panel-note">Use directives like {'{title: ...}'} and inline chords like [Am].</p>
          </div>

          <label className="editor-label" for="chordpro-editor">
            Song source
          </label>
          <textarea
            id="chordpro-editor"
            className="editor"
            spellcheck={false}
            value={source}
            onInput={(event) => setSource((event.target as HTMLTextAreaElement).value)}
          />
        </section>

        <section className="panel preview-panel" aria-labelledby="preview-heading">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Preview</p>
              <h2 id="preview-heading">Rendered sheet</h2>
            </div>
            <div className="status-cluster">
              {errorMessage ? <p className="status error">{errorMessage}</p> : null}
              <p className="status">Live render</p>
            </div>
          </div>

          <article className="song-sheet" ref={previewRef}>
            <header className="song-header">
              <h3>{document.title}</h3>
              {document.subtitle ? <p className="song-subtitle">{document.subtitle}</p> : null}
              <dl className="song-meta">
                {Object.entries(document.metadata).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </header>

            <div className="song-body">{document.blocks.map((block, index) => renderBlock(block, `${block.type}-${index}`))}</div>
          </article>
        </section>
      </main>
    </div>
  );
}

function renderBlock(block: SongBlock, key: string) {
  switch (block.type) {
    case 'line':
      if (block.variant === 'plain') {
        return (
          <p className="song-line plain-line" key={key}>
            {block.text}
          </p>
        );
      }

      return (
        <p className="song-line chord-line" key={key}>
          {block.segments?.map((segment, index) => (
            <span className="segment" key={`${key}-${index}`} style={{ width: `${segment.width}ch` }}>
              <span className="segment-chord">{segment.chord ?? '\u00a0'}</span>
              <span className="segment-lyric">{segment.lyric || '\u00a0'}</span>
            </span>
          ))}
        </p>
      );

    case 'comment':
      return (
        <p className="song-comment" key={key}>
          {block.text}
        </p>
      );

    case 'directive':
      return (
        <p className="song-directive" key={key}>
          {block.text}
        </p>
      );

    case 'spacer':
      return <div className="song-spacer" key={key} aria-hidden="true" />;

    case 'section':
      return <SectionBlock block={block} key={key} />;
  }
}

function SectionBlock({ block }: { block: SongSectionBlock }) {
  return (
    <section className="song-section">
      <div className="section-label">{block.label}</div>
      <div className="section-lines">{block.lines.map((line, index) => renderBlock(line, `${block.label}-${index}`))}</div>
    </section>
  );
}

function toFileName(document: SongDocument) {
  const sanitized = document.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || DOWNLOAD_NAME_FALLBACK;
}