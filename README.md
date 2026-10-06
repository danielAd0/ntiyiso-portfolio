# Ntiyiso Adoration | Portfolio

A cream-white and burgundy portfolio built with separate HTML, CSS and JavaScript. The home page presents Ntiyiso’s name, a short introduction and simple text links. Work history appears in Experience. Projects remain unframed expandable placeholders, and the burgundy contact section uses underlined fields.

## Run locally

Requires Node.js 22 or later. Install the pinned development dependencies with `npm.cmd ci`.

```sh
npm start
npm run check
```

On Windows PowerShell, use `npm.cmd start` and `npm.cmd run check`. Open http://localhost:3000.

Tailwind v4 development uses two PowerShell terminals:

```powershell
# Terminal 1: rebuild utilities as HTML, JavaScript or the input CSS changes
npm.cmd run css:watch
# Terminal 2: serve the dist folder
npm.cmd start
```

Before a production handoff, generate the minified stylesheet and validate it:

```powershell
npm.cmd run css:build
npm.cmd run check
npm.cmd run check:browser
```

These commands only build and check local files; they do not publish. `src/tailwind.css` explicitly scans `dist/index.html`, `dist/app.js` and `dist/enhancements.js`. Keep utility names complete in JavaScript class strings so the CLI can detect them. The generated `dist/tailwind.css` is served at `/tailwind.css`; do not edit it directly. Preflight is omitted. Semantic colours use `@theme inline` to follow the existing cream/evening variables. Custom CSS lives in the components layer, below utilities, retaining the original fonts, decorative underlines, curved edge and animations. Mobile menu CSS remains at 900px, paired with JavaScript's 901px desktop media query.

## Files

- `dist/index.html`: Home, About, Experience, Projects and Contact.
- `dist/styles.css`: responsive layout, typography, focus styles and reduced-motion support.
- `dist/app.js`: mobile navigation, section highlighting, scroll reveals and the message composer.
- `dist/enhancements.js`: one-time decorations, remembered evening theme, scroll progress and real-image preview dialogs.
- `dist/motion.css` and `dist/motion.js`: themed pen cursor, pointer halo, hero ornaments and project hover accents.
- `server.mjs`: dependency-free Node.js server for local use.
- `scripts/check.mjs`: structural, interaction and HTTP checks.

## Content and contact

Experience lists IT / Software Developer at Mafori Group, September 2026 – Present, and a Diploma in Computer Science in progress. September 2026 is the assumed start year; no institution, completion date, job duties or performance claims have been invented.

Education and employment details appear in Experience; Core skills is the single list of technical and analytical skills. About focuses on personal interests.

The contact composer prepares a copyable or downloadable draft. It does not send email, submit messages or store visitor details. Its submit button stays disabled until the local event handlers load.

Mobile navigation stays visible without JavaScript. Motion respects reduced-motion preferences; content is never hidden while waiting for a scroll observer.

## Hosting and validation

Sites hosts the static `dist` directory privately. Node.js supplies the local development server, not a production backend. Access remains owner-private unless Ntiyiso explicitly approves a change.

`npm.cmd run check` verifies sections, internal anchors, labels, placeholder content, navigation, composer interactions, reduced-motion handling and local HTTP routes.

`npm.cmd run check:browser` uses local headless Microsoft Edge with an isolated temporary profile. It verifies 320px, 375px, 768px and 1440px widths, 200% text sizing, both themes, touch and keyboard navigation, form validation, preview focus containment and Escape, scroll progress after project expansion, reduced motion and JavaScript-disabled content. Screenshots are saved to the temporary audit directory. No deployment is performed.

## Visual enhancements and screenshots

Cream is the default theme. The accessible moon/sun theme toggle remembers an explicit selection when local storage is available and works without storage. The About marker fills once, and Contact has a shallow curved edge with a short heading sweep. Reduced motion displays their final states immediately. The existing footer link includes a scroll progress ring.

Three supplied Mafori FC screenshots are bundled with the first project. A wide browser-style preview and side rail of thumbnails keep the gallery compact; the rail moves below on mobile. Each image defines its selector name with `data-gallery-label` and its caption with descriptive `alt` text, keeping gallery content in the HTML. Without JavaScript all screenshots remain visible. Add new screenshots inside `.project-content` with intrinsic `width` and `height` to reserve space and actual local asset paths. Successfully loaded images receive an enlargement button automatically. The native modal dialog contains keyboard focus, closes with Escape or its Close preview button, and returns focus to the opener.

## Layout polish

Projects use native details/summary controls and retain their individual Coming soon statuses. Their direct links are `#mafori-fc`, `#project-two`, and `#project-three`. Opening a link expands that project and aligns its summary below the sticky header, including initial loads and browser Back/Forward. Each expanded project has a Copy project link control that preserves the current page path and query string; clipboard failure reveals a selectable read-only URL.


The theme icon sits on the right; regular navigation remains available. Social links use icons with accessible names. The original burgundy footer keeps the name, copyright year and existing scroll-progress control. Header height updates the anchor offset so section headings remain visible. Gallery captions and enlargement controls flow normally at large text sizes.
