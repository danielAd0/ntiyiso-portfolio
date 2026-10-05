# Ntiyiso Adoration | Portfolio

A cream-white and burgundy portfolio built with separate HTML, CSS and JavaScript. The home page presents Ntiyiso’s name, a short introduction and simple text links. Work history appears in Experience. Projects remain unframed expandable placeholders, and the burgundy contact section uses underlined fields.

## Run locally

Requires Node.js 22 or later. No package installation is required.

```sh
npm start
npm run check
```

On Windows PowerShell, use `npm.cmd start` and `npm.cmd run check`. Open http://localhost:3000.

## Files

- `dist/index.html`: Home, About, Experience, Projects and Contact.
- `dist/styles.css`: responsive layout, typography, focus styles and reduced-motion support.
- `dist/app.js`: mobile navigation, section highlighting, scroll reveals and the message composer.
- `dist/enhancements.js`: one-time decorations, remembered evening theme, scroll progress and real-image preview dialogs.
- `server.mjs`: dependency-free Node.js server for local use.
- `scripts/check.mjs`: structural, interaction and HTTP checks.

## Content and contact

Experience lists IT / Software Developer at Mafori Group, September 2026 – Present, and a Diploma in Computer Science in progress. September 2026 is the assumed start year; no institution, completion date, job duties or performance claims have been invented.

Projects remain three clearly labelled placeholders. They use native details/summary controls, which also work without JavaScript.

The contact composer prepares a copyable or downloadable draft. It does not send email, submit messages or store visitor details. Its submit button stays disabled until the local event handlers load.

Mobile navigation stays visible without JavaScript. Animations are finite and disabled when reduced motion is requested; content is never hidden while waiting for a scroll observer.

## Hosting and validation

Sites hosts the static `dist` directory privately. Node.js supplies the local development server, not a production backend. Access remains owner-private unless Ntiyiso explicitly approves a change.

`npm.cmd run check` verifies sections, internal anchors, labels, placeholder content, navigation, composer interactions, reduced-motion handling and local HTTP routes.

`npm.cmd run check:browser` uses local headless Microsoft Edge with an isolated temporary profile. It verifies 320px, 375px, 768px and 1440px widths, 200% text sizing, both themes, touch and keyboard navigation, form validation, preview focus containment and Escape, scroll progress after project expansion, reduced motion and JavaScript-disabled content. Screenshots are saved to the temporary audit directory. No deployment is performed.

## Visual enhancements and screenshots

Cream is the default theme. The accessible moon/sun theme toggle remembers an explicit selection when local storage is available and works without storage. The About marker fills once, and Contact has a shallow curved edge with a short heading sweep. Reduced motion displays their final states immediately. The existing footer link includes a scroll progress ring.

Projects remain Coming soon. Three supplied Mafori FC screenshots are bundled with the first project. A wide browser-style preview and side rail of Home, Squad and Newsletter thumbnails keep the gallery compact; the rail moves below on mobile; without JavaScript all screenshots remain visible. When a genuine screenshot is ready, add an image inside its existing `.project-content`, with descriptive `alt` text and intrinsic `width` and `height` to reserve space. Use an actual local asset path; `loading="lazy"` is optional. Successfully loaded images receive the photograph styling and an Open larger preview button automatically, including images inserted later. The native modal dialog contains keyboard focus, closes with Escape or its Close preview button, and returns focus to the opener.

## Layout polish

The theme icon sits on the right; regular navigation remains available. Social links use icons with accessible names. The original burgundy footer keeps the name, copyright year and existing scroll-progress control. Header height updates the anchor offset so section headings remain visible. Gallery captions and enlargement controls flow normally at large text sizes.
