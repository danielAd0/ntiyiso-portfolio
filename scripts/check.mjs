import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { server } from '../server.mjs';

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../dist/styles.css', import.meta.url), 'utf8');
const utilities = await readFile(new URL('../dist/tailwind.css', import.meta.url), 'utf8');
const tailwindInput = await readFile(new URL('../src/tailwind.css', import.meta.url), 'utf8');
assert.ok(html.includes('href="/tailwind.css"'), 'Generated utilities must be linked');
assert.ok(!tailwindInput.includes('@import "tailwindcss";') && !tailwindInput.includes('preflight.css'), 'Preflight must remain disabled');
for (const file of ['index.html', 'app.js', 'enhancements.js']) assert.ok(tailwindInput.includes(`@source "../dist/${file}"`));
assert.ok(/background-color:\s*var\(--page-bg\)/.test(utilities) && /color:\s*var\(--ink\)/.test(utilities), 'Theme utilities must reference the live palette');
assert.ok(/prefers-reduced-motion:\s*no-preference/.test(utilities), 'Motion utilities must respect reduced motion');
const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique');
for (const section of ['home', 'about', 'experience', 'projects', 'contact']) assert.ok(ids.includes(section));
for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(match[1]), `Missing anchor: ${match[1]}`);
for (const match of html.matchAll(/(?:for|aria-controls|aria-labelledby)="([^"]+)"/g)) {
  for (const id of match[1].split(' ')) assert.ok(ids.includes(id), `Missing label target: ${id}`);
}
assert.ok(!/hobby-football|football-turn/.test(html + css));
assert.equal([...html.matchAll(/mafori_screenshot[123][.]png/g)].length, 3);
assert.equal([...html.matchAll(/<details class="project-card\b/g)].length, 3);
assert.ok(html.includes('Mafori Group') && html.includes('IT / Software Developer'));
assert.ok(html.includes('datetime="2026-09"') && html.includes('Diploma in Computer Science'));
assert.ok(!/Budget Tracker|Inventory System|Task Manager|Dan Adoration/.test(html));
assert.ok(css.includes('max-width:900px') && css.includes('max-width:560px'));
assert.ok(css.includes('prefers-reduced-motion:reduce') && css.includes('animation:none !important'));

function mockBrowser({ reduced = false, observers = true } = {}) {
  const elements = new Map();
  const observerList = [];
  const media = new Map();
  let copied = '';
  let downloaded = null;
  let revoked = false;
  let selected = false;
  let rejectCopy = false;
  function element() {
    const attrs = new Map();
    const classes = new Set();
    const handlers = new Map();
    return {
      textContent: '', hidden: false, disabled: false, focused: false,
      classList: { add: value => classes.add(value), remove: value => classes.delete(value),
        contains: value => classes.has(value), toggle(value, enabled) { if (enabled) classes.add(value); else classes.delete(value); } },
      setAttribute: (key, value) => attrs.set(key, value),
      getAttribute: key => attrs.get(key),
      removeAttribute: key => attrs.delete(key),
      addEventListener(type, handler) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(handler); },
      async fire(type, event = {}) { for (const handler of handlers.get(type) || []) await handler(event); },
      focus() { this.focused = true; },
      reportValidity() { return this.valid !== false; },
      append() {}, remove() {},
      click() { downloaded = this; },
      querySelector() { return this.child; }
    };
  }
  for (const id of ids) elements.set('#' + id, element());
  const menu = element();
  menu.child = element();
  menu.setAttribute('aria-expanded', 'false');
  elements.set('.menu-toggle', menu);
  const links = ['home', 'about', 'experience', 'projects', 'contact'].map(id => {
    const link = element(); link.setAttribute('href', '#' + id); return link;
  });
  const sections = links.map((link, index) => ({ id: link.getAttribute('href').slice(1), top: index * 1000, getBoundingClientRect() { return { top: this.top }; } }));
  const reveal = [element(), element()];
  const document = Object.assign(element(), {
    documentElement: element(), body: element(),
    querySelector(selector) { assert.ok(elements.has(selector), `JS selector must exist: ${selector}`); return elements.get(selector); },
    querySelectorAll(selector) { return ({ '#main-nav a': links, 'main > section': sections, '[data-reveal]': reveal })[selector] || []; },
    createElement: element,
    createRange: () => ({ selectNodeContents() { selected = true; } })
  });
  const window = {
    addEventListener() {},
    requestAnimationFrame(callback) { callback(); },
    getComputedStyle() { return { scrollPaddingTop:'120px' }; },
    scrollY:0,
    matchMedia(query) {
      if (!media.has(query)) media.set(query, Object.assign(element(), { matches: query.includes('reduced-motion') && reduced }));
      return media.get(query);
    },
    setTimeout(callback) { callback(); },
    getSelection: () => ({ removeAllRanges() {}, addRange() {} })
  };
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = new Set(); observerList.push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
  }
  if (observers) window.IntersectionObserver = Observer;
  const context = {
    document, window, Blob, IntersectionObserver: Observer,
    navigator: { clipboard: { async writeText(text) { if (rejectCopy) throw Error('Clipboard unavailable'); copied = text; } } },
    URL: { createObjectURL: () => 'blob:local-draft', revokeObjectURL() { revoked = true; } },
    FormData: class { constructor(form) { return new Map(Object.entries(form.data)); } }
  };
  runInNewContext(app, context, { filename: 'dist/app.js' });
  return { elements, document, media, links, sections, reveal, observerList,
    get copied() { return copied; }, get downloaded() { return downloaded; },
    get revoked() { return revoked; }, get selected() { return selected; },
    failClipboard() { rejectCopy = true; } };
}

const browser = mockBrowser();
const get = selector => browser.elements.get(selector);
assert.equal(get('#contact-submit').disabled, false);
await get('.menu-toggle').fire('click');
assert.equal(get('.menu-toggle').getAttribute('aria-expanded'), 'true');
assert.ok(get('#main-nav').classList.contains('is-open'));
await browser.document.fire('keydown', { key: 'Escape' });
assert.equal(get('.menu-toggle').getAttribute('aria-expanded'), 'false');
assert.ok(get('.menu-toggle').focused);
await get('.menu-toggle').fire('click');
await get('#main-nav').fire('click', { target: { closest: () => browser.links[2] } });
assert.equal(get('.menu-toggle').getAttribute('aria-expanded'), 'false');

const form = get('#contact-form');
get('#message-result').hidden = true;
form.valid = false;
let prevented = false;
await form.fire('submit', { preventDefault() { prevented = true; } });
assert.ok(prevented && get('#message-result').hidden);
form.valid = true;
form.data = { name: ' Alex ', email: ' alex@example.com ', topic: 'Collaboration', message: ' <script>hello</script> ' };
await form.fire('submit', { preventDefault() {} });
assert.equal(get('#message-result').hidden, false);
assert.equal(get('#contact-submit').textContent, 'Draft prepared ?');
assert.ok(get('#message-preview').textContent.includes('From: Alex <alex@example.com>'));
assert.ok(get('#message-preview').textContent.includes('\n<script>hello</script>\n'));
await get('#copy-message').fire('click');
assert.equal(browser.copied, get('#message-preview').textContent);
assert.equal(get('#copy-message').textContent, 'Note copied ?');
await get('#download-message').fire('click');
assert.equal(browser.downloaded.download, 'message-for-ntiyiso.txt');
assert.ok(browser.revoked);
browser.failClipboard();
await get('#copy-message').fire('click');
assert.ok(browser.selected);
assert.ok(!get('#copy-message').classList.contains('is-success'));
await form.fire('change');
assert.ok(get('#message-result').hidden);
assert.equal(get('#contact-status').textContent, '');
form.data.name = '  ';
await form.fire('submit', { preventDefault() {} });
assert.ok(get('#message-result').hidden);
assert.ok(get('#contact-status').textContent.includes('Please add'));

assert.equal(browser.observerList.length, 1);
browser.observerList[0].callback([{ isIntersecting: true, target: browser.reveal[0] }]);
assert.ok(browser.reveal[0].classList.contains('is-revealed'));
await browser.media.get('(prefers-reduced-motion: reduce)').fire('change', { matches: true });
assert.equal(browser.observerList[0].targets.size, 0);
assert.equal(mockBrowser({ reduced: true }).observerList.length, 0);
assert.equal(mockBrowser({ observers: false }).observerList.length, 0);

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [path, type] of [['/', 'text/html'], ['/styles.css', 'text/css'], ['/tailwind.css', 'text/css'], ['/app.js', 'text/javascript']]) {
    const result = await fetch(base + path);
    assert.equal(result.status, 200, `${path} must load`);
    assert.ok(result.headers.get('content-type').includes(type));
    assert.ok((await result.text()).length > 100);
  }
  assert.equal((await fetch(base + '/missing-file')).status, 404);
  assert.equal((await fetch(base + '/.openai/hosting.json')).status, 404);
  assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
  const head = await fetch(base + '/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  console.log('PASS: structure, experience, placeholders, navigation, composer, motion preferences and Node HTTP routes. Interaction checks use a DOM simulation; run scripts/browser-audit.mjs for browser verification.');
} finally {
  await new Promise(resolve => server.close(resolve));
}
