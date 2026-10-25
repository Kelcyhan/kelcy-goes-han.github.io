# Graphic Works source notes

This is a local review draft. It combines graphic design technique exercises with a new fictional coffee and leisure concept. Nothing in this project establishes a client, a commercial result or the creation date/software of the earlier exercises.

## Original archive

The supplied document is `平面设计作品.docx`. All 16 embedded PNG files were copied without modifying their pixels.

| Site file | Word embedded image | Page | Presentation |
| --- | --- | --- | --- |
| music-rhythm.png | image1.png | 1 | CSS horizontal reflection matches the Word drawing's flipH setting; file unchanged |
| music-orbit.png | image2.png | 1 | Unchanged |
| line-repetition.png | image3.png | 1 | Unchanged |
| leaf-composite.png | image4.png | 1 | Unchanged |
| floral-layering.png | image5.png | 2 | Unchanged |
| music-space.png | image6.png | 3 | Unchanged |
| texture-vortex.png | image7.png | 4 | Unchanged |
| texture-surface.png | image8.png | 4 | Unchanged |
| texture-radial.png | image9.png | 5 | Unchanged |
| symmetric-pattern.png | image10.png | 5 | Unchanged |
| neon-mosaic.png | image11.png | 6 | Existing-image treatment; credit pending |
| artwork-remix.png | image12.png | 6 | Existing-artwork collage; reference credits pending |
| colour-purple.png | image13.png | 7 | Unchanged |
| colour-pink.png | image14.png | 7 | File unchanged; square inline previews crop the edges slightly; the full-size viewer preserves the original aspect ratio |
| colour-green.png | image15.png | 7 | Unchanged |
| colour-yellow.png | image16.png | 7 | Unchanged |

The owner confirmed these are exercises in different graphic design techniques, including repetition, contrast, colour and mosaic. Creation dates, software and detailed reference credits are unconfirmed. The page includes an authorship note and a review-draft label. The street scene and artwork remix from page 6 are included as image-treatment and collage exercises, without attributing the source photography or paintings to the portfolio owner.

## New concept

OFF HOURS is a fictional coffee and leisure identity developed in September 2026. Codex prepared the proposed name, English copy, typography, two layouts and website code. The user has not yet reviewed this proposal. The supplied illustration is neither repainted nor generated.

- Social: 1080 × 1350 px; the illustration is placed at its native 627 × 627 px.
- Banner: 1600 × 600 px; the illustration is reduced to 488 × 488 px.
- Both exports use the same palette, Georgia/Arial typography and 72 px side margin.
- SVGs retain editable vector text and an embedded, unchanged PNG. Fonts use system Georgia and Arial; no font files are distributed. A system without these fonts may substitute fonts in SVG; the PNGs have fixed appearance.
- The invitation in each graphic is concept copy. No real offer, price, booking link or operating hours is represented.

## Edit and export

`build-artwork.mjs` is the layout source. Edit its text, coordinates or palette, then run:

```sh
node VisualStudies/source/build-artwork.mjs
node VisualStudies/source/export-artwork.mjs
```

The export step needs Playwright and an available Chromium. `STUDIES_PLAYWRIGHT_PATH` can point to a bundled Playwright package; `STUDIES_BROWSER_PATH` can point to a local browser executable. The editable SVGs can also be opened directly in a vector editor. Typography is live text, while the original art stays a raster image.

`design-tokens.json` records the chosen colours, fonts, dimensions and origin note. It is generated from `build-artwork.mjs`, not an independent source of truth.

## Site integration

The React route is `/projects/graphic-works`; the former `/projects/visual-studies` route redirects to it; the standalone page is `/VisualStudies/index.html`. Graphic Works appears as a standard project card in a peer Graphic Design gallery tab. There is no separate archive entry below the gallery. The existing build copies this directory into `dist/VisualStudies`. The study uses native scrolling and a native dialog, with no external network dependencies.

The document archive and pre-existing website backups are kept outside the website repository. No deployment was made for this work. Confirm attribution and review the proposal before deciding whether to publish.
