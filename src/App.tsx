import { useEffect, useRef, useState } from 'preact/hooks';
import { getChordSketch } from './chordsketch';
import { getSongKey, getTransposeOptions, transposeChordPro } from './transpose';

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

type ValidationError = {
  line: number;
  column: number;
  message: string;
};

export default function App() {
  const [source, setSource] = useState(SAMPLE_CHORDPRO);
  const [targetKey, setTargetKey] = useState('');
  const [previewMarkup, setPreviewMarkup] = useState(buildStatusPreview('Loading the ChordPro renderer...'));
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [rendererVersion, setRendererVersion] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestVersionRef = useRef(0);
  const songKey = getSongKey(source);
  const transposeOptions = songKey ? getTransposeOptions(songKey.minor) : [];
  const appliedTargetKey = songKey && transposeOptions.includes(targetKey) ? targetKey : '';
  const renderedSource = appliedTargetKey ? transposeChordPro(source, appliedTargetKey) : source;

  useEffect(() => {
    if (!songKey || (targetKey && !transposeOptions.includes(targetKey))) {
      setTargetKey('');
    }
  }, [songKey, targetKey, transposeOptions]);

  useEffect(() => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    let disposed = false;

    setIsRendering(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const chordSketch = await getChordSketch();
        if (disposed || requestVersion !== requestVersionRef.current) {
          return;
        }

        const errors = chordSketch.validate(source) as ValidationError[];
        setRendererVersion(chordSketch.version());
        setValidationErrors(errors);

        if (errors.length > 0) {
          setPreviewMarkup(buildValidationPreview(errors));
          return;
        }

        setPreviewMarkup(chordSketch.render_html(renderedSource));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to render the current document.';
        if (disposed || requestVersion !== requestVersionRef.current) {
          return;
        }

        setErrorMessage(message);
        setValidationErrors([]);
        setPreviewMarkup(buildStatusPreview(message));
      } finally {
        if (!disposed && requestVersion === requestVersionRef.current) {
          setIsRendering(false);
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, [renderedSource, source]);

  async function handlePdfExport() {
    if (isExporting) {
      return;
    }

    if (validationErrors.length > 0) {
      setErrorMessage('Fix validation errors before downloading the PDF.');
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);

    try {
      const chordSketch = await getChordSketch();
      const pdfBytes = chordSketch.render_pdf(renderedSource);
      downloadPdf(pdfBytes, toFileName(source));
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
        <div className="hero-heading">
          <h1>ChordPro Playground</h1>
          <p className="hero-copy">
            The editor uses the ChordSketch WASM engine to validate, render, and export your ChordPro sheet with
            the real ChordPro layout pipeline.
          </p>
        </div>
        <div className="hero-actions">
          <div className="hero-action-row">
            <div className="transpose-control">
              <label className="transpose-label" for="transpose-key">
                Transpose
              </label>
              <select
                id="transpose-key"
                className="transpose-select"
                value={appliedTargetKey}
                onInput={(event) => setTargetKey((event.target as HTMLSelectElement).value)}
                disabled={!songKey}
              >
                <option value="">{songKey ? `Original (${songKey.canonical})` : 'Add {key: ...} to enable'}</option>
                {transposeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <button className="secondary-button" type="button" onClick={() => setSource(SAMPLE_CHORDPRO)}>
              Reset sample
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={handlePdfExport}
              disabled={isExporting || isRendering || validationErrors.length > 0}
            >
              {isExporting ? 'Exporting PDF...' : 'Download PDF'}
            </button>
          </div>
          <p className="transpose-note">
            {songKey
              ? appliedTargetKey
                ? `${songKey.canonical} to ${appliedTargetKey}`
                : `Current key ${songKey.canonical}`
              : 'Transposition needs a {key: ...} directive.'}
          </p>
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
              <p className="status">{isRendering ? 'Rendering...' : 'Live render'}</p>
              {rendererVersion ? <p className="status">ChordSketch WASM {rendererVersion}</p> : null}
              {songKey ? <p className="status">Key {appliedTargetKey || songKey.canonical}</p> : null}
            </div>
          </div>

          <div className="song-sheet">
            <iframe className="song-frame" title="Rendered ChordPro preview" sandbox="" srcdoc={previewMarkup} />
          </div>

          {validationErrors.length > 0 ? (
            <ol className="validation-list">
              {validationErrors.map((issue) => (
                <li key={`${issue.line}-${issue.column}-${issue.message}`}>
                  Line {issue.line}, column {issue.column}: {issue.message}
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function downloadPdf(pdfBytes: Uint8Array, fileName: string) {
  const blob = new Blob([Uint8Array.from(pdfBytes).buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildStatusPreview(message: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0;
      padding: 2rem;
      font-family: Georgia, serif;
      color: #3d3327;
    }
  </style>
</head>
<body>
  <p>${escapeHtml(message)}</p>
</body>
</html>`;
}

function buildValidationPreview(issues: ValidationError[]) {
  const items = issues
    .map((issue) => `<li>Line ${issue.line}, column ${issue.column}: ${escapeHtml(issue.message)}</li>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0;
      padding: 2rem;
      font-family: Georgia, serif;
      color: #3d3327;
    }
    h1 {
      margin: 0 0 1rem;
      font-size: 1.25rem;
    }
    ol {
      padding-left: 1.25rem;
      margin: 0;
    }
    li + li {
      margin-top: 0.5rem;
    }
  </style>
</head>
<body>
  <h1>ChordPro validation issues</h1>
  <ol>${items}</ol>
</body>
</html>`;
}

function toFileName(source: string) {
  const titleMatch = source.match(/^\{\s*(?:title|t)\s*:\s*([^}]+)\}$/im);
  const title = titleMatch?.[1]?.trim() ?? DOWNLOAD_NAME_FALLBACK;

  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || DOWNLOAD_NAME_FALLBACK;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}