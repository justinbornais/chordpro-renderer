# ChordPro Playground

A small Preact + TypeScript web application for writing ChordPro, previewing the rendered song sheet live, and exporting the rendered document as a PDF.

## Scripts

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Features

- Live rendering through the ChordSketch WebAssembly engine
- ChordPro validation with line and column error feedback
- Browser preview using the renderer's real HTML output
- PDF export using the renderer's generated PDF bytes instead of a DOM screenshot