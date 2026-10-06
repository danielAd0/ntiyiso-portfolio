import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { server } from '../server.mjs';

// Local Edge audit: no packages, external services, or profile data required.
const profile = await mkdtemp(join(tmpdir(), 'portfolio-browser-audit-'));
const chrome = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
let socket;
let nextId = 0;
let sessionId;
const pending = new Map();
const errors = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function send(method, params = {}, session = sessionId) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(Error(`Timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }).catch(error => { throw Error(`${error.message}: ${expression.slice(0,140)}`); });
  if (result.exceptionDetails) throw Error(`${result.exceptionDetails.exception?.description || result.exceptionDetails.text}: ${expression.slice(0,200)}`);
  return result.result.value;
}
async function key(key, code, windowsVirtualKeyCode) {
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode });
  if (key === 'Enter' || key === ' ') await send('Input.dispatchKeyEvent', { type: 'char', key, code, text: key === 'Enter' ? '\r' : ' ', unmodifiedText: key === 'Enter' ? '\r' : ' ', windowsVirtualKeyCode });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
  await delay(100);
}
try {
  let port;
  for (let i = 0; i < 40; i++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await delay(250); }
  }
  if (!port) throw Error('Chrome did not expose its headless debugging interface');
  const info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const request = pending.get(msg.id); pending.delete(msg.id); clearTimeout(request.timeout);
      if (msg.error) request.reject(Error(msg.error.message)); else request.resolve(msg.result);
    }
    if (msg.method === 'Runtime.exceptionThrown' || (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') || (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error')) errors.push(msg);
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  ({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }, null));
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('DOM.enable'); await send('CSS.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Page.bringToFront');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  await send('Page.navigate', { url: base });
  for (let i = 0; i < 40; i++) { if (await evaluate('document.readyState === "complete" && document.documentElement.classList.contains("js")')) break; await delay(100); }
  const report = { layouts: [], keyboard: {}, menu: {}, form: {}, reducedMotion: {}, consoleErrors: errors };
  report.navHighlight = [];
  for (const width of [1440,375]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height:900, deviceScaleFactor:1, mobile:false });
    for (const id of ['home','about','experience','projects','contact']) {
      if (width <= 900) await evaluate('if (document.querySelector(".menu-toggle").getAttribute("aria-expanded") !== "true") document.querySelector(".menu-toggle").click()');
      await evaluate(`[...document.querySelectorAll("#main-nav a")].find(a => a.hash === ${JSON.stringify("#" + id)}).click()`);
      await delay(1000);
      report.navHighlight.push(await evaluate('({width:innerWidth, target:' + JSON.stringify(id) + ', active:document.querySelector("#main-nav a[aria-current]").getAttribute("href")})'));
    }
    await evaluate('window.scrollTo({top:document.querySelector("#experience").offsetTop + 250,behavior:"instant"})');
    await delay(100);
    report.navHighlight.push(await evaluate('({width:innerWidth,target:"experience",active:document.querySelector("#main-nav a[aria-current]").getAttribute("href")})'));
  }
  await evaluate('window.scrollTo({top:0,behavior:"instant"})');
  for (const width of [320, 375, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const fontSize of [16, 32]) {
      await evaluate(`document.documentElement.style.fontSize = '${fontSize}px'; document.querySelectorAll('details').forEach(d => d.open = true)`);
      await delay(150);
      report.layouts.push(await evaluate(`(() => {
        const out = [...document.querySelectorAll('body *')].filter(el => {
          const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
          return r.width && s.position !== 'absolute' && s.position !== 'fixed' && (r.right > innerWidth + 1 || r.left < -1);
        }).map(el => ({ tag: el.tagName, class: el.className.baseVal ?? el.className, text: el.textContent.trim().slice(0,45) }));
        const brand = document.querySelector('.brand').getBoundingClientRect();
        const nav = document.querySelector('#main-nav').getBoundingClientRect();
        const crampedSocialLinks = [...document.querySelectorAll('.social-icon')].filter(el => { const icon = el.querySelector('svg').getBoundingClientRect(); const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44 || icon.width + 16 > r.width || icon.height + 16 > r.height; }).map(el => el.getAttribute('aria-label'));
        const overlaps = (a,b) => { const x=a.getBoundingClientRect(),y=b.getBoundingClientRect(); return x.width && y.width && x.left < y.right - 1 && x.right > y.left + 1 && x.top < y.bottom - 1 && x.bottom > y.top + 1; };
        const tools = document.querySelector('.header-tools');
        const controlsOverlap = overlaps(document.querySelector('.brand'),tools) || overlaps(document.querySelector('#main-nav'),tools);
        const galleryOverlap = [...document.querySelectorAll('.project-gallery .project-preview:not([hidden])')].some(figure => overlaps(figure.querySelector('figcaption'),figure.querySelector('button')));
        const iconOnlySocials = [...document.querySelectorAll('.social-icon')].every(a => !a.textContent.trim() && a.getAttribute('aria-label'));
        const footerOverlap = overlaps(document.querySelector('.footer-inner > p'),document.querySelector('.back-top'));
        return { width: innerWidth, textPercent: ${fontSize / 16 * 100}, horizontalOverflow: document.documentElement.scrollWidth > innerWidth, overflowingElements: out, crampedSocialLinks, controlsOverlap, galleryOverlap, iconOnlySocials, footerOverlap, navigationOverlap: nav.width > 0 && brand.right > nav.left && brand.bottom > nav.top };
      })()`));
      if ([375,1440].includes(width) && fontSize === 16) {
        await delay(250);
        const layoutShot = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:true });
        await writeFile(join(profile, 'layout-' + width + '.png'), Buffer.from(layoutShot.data, 'base64'));
      }
      if (width <= 900) {
        await evaluate('document.querySelector(".menu-toggle").click()');
        report.layouts.at(-1).openMenu = await evaluate('({ horizontalOverflow: document.documentElement.scrollWidth > innerWidth, headerHeight: document.querySelector(".site-header").getBoundingClientRect().height, linksVisible: [...document.querySelectorAll("#main-nav a")].every(a => a.getBoundingClientRect().width > 0) })');
        await evaluate('document.querySelector(".menu-toggle").click()');
      }
    }
  }
  report.features = {};
  await evaluate('document.querySelector("#theme-toggle").click()');
  report.features.eveningTheme = await evaluate('document.documentElement.dataset.theme === "evening" && document.querySelector("#theme-toggle").getAttribute("aria-pressed") === "true" && document.querySelector("#theme-status").textContent.includes("Evening")');
  await delay(250);
  report.features.eveningLayouts = [];
  for (const width of [320, 375, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height:900, deviceScaleFactor:1, mobile:false });
    await delay(100);
    report.features.eveningLayouts.push(await evaluate('({width:innerWidth, horizontalOverflow:document.documentElement.scrollWidth > innerWidth, background:getComputedStyle(document.body).backgroundColor, text:getComputedStyle(document.body).color})'));
  }
  await send('Page.reload');
  await delay(400);
  report.features.themeRemembered = await evaluate('document.documentElement.dataset.theme === "evening"');
  await evaluate('document.querySelector("#theme-toggle").click(); window.scrollTo({top:0,behavior:"instant"})');
  await delay(100);
  report.features.progressAtTop = await evaluate('parseFloat(document.querySelector(".back-top").style.getPropertyValue("--scroll-remaining")) === 1');
  await evaluate('window.scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"})');
  await delay(100);
  report.features.progressAtBottom = await evaluate('parseFloat(document.querySelector(".back-top").style.getPropertyValue("--scroll-remaining")) < .001');
  report.features.previewsInactive = await evaluate('document.querySelectorAll(".project-preview").length === 3 && !document.querySelector("#preview-dialog").open');
  await evaluate('document.querySelector("details").open = true; document.querySelectorAll(".gallery-thumbnail")[1].click()');
  report.features.gallerySelection = await evaluate('document.querySelectorAll(".project-gallery .project-preview:not([hidden])").length === 1 && document.querySelectorAll(".gallery-thumbnail")[1].getAttribute("aria-pressed") === "true" && !document.querySelectorAll(".project-gallery .project-preview")[1].hidden');
  await evaluate('document.querySelector(".gallery-thumbnail").click()');
  // Exercise screenshot support with an actual capture of this page, in memory only.
  const previewShot = await send('Page.captureScreenshot', { format: 'png' });
  await evaluate(`(() => { const image = new Image(); image.alt = 'Local portfolio browser verification screenshot'; image.src = ${JSON.stringify('data:image/png;base64,' + previewShot.data)}; document.querySelector('.project-content').append(image); document.querySelector('details').open = true; })()`);
  await delay(200);
  report.features.dynamicPreview = await evaluate('document.querySelectorAll(".project-preview button").length === 4');
  await evaluate('document.querySelector(".project-preview button").focus()');
  await key('Enter', 'Enter', 13);
  report.features.dialogOpened = await evaluate('document.querySelector("#preview-dialog").open && document.activeElement.id === "close-preview"');
  await key('Tab', 'Tab', 9);
  await key('Tab', 'Tab', 9);
  report.features.dialogFocusContained = await evaluate('document.activeElement.closest("#preview-dialog") !== null');
  await key('Escape', 'Escape', 27);
  report.features.dialogEscapeAndFocus = await evaluate('!document.querySelector("#preview-dialog").open && document.activeElement.matches(".project-preview button")');
  await evaluate('document.querySelector(".project-preview").remove(); document.querySelectorAll("details").forEach(d => d.open = false)');
  await delay(100);
  report.features.progressAfterCollapse = await evaluate('(() => { const root = document.documentElement; const expected = 1 - Math.max(0,Math.min(1,scrollY / (root.scrollHeight - root.clientHeight))); return Math.abs(expected - parseFloat(document.querySelector(".back-top").style.getPropertyValue("--scroll-remaining"))) < .001; })()');
  await evaluate('Storage.prototype.setItem = () => { throw Error("Storage unavailable"); }; document.querySelector("#theme-toggle").click()');
  report.features.themeWithoutStorage = await evaluate('document.documentElement.dataset.theme === "evening"');
  await evaluate('document.querySelector("#theme-toggle").click()');
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: false });
  await evaluate('document.documentElement.style.fontSize = "16px"; document.querySelector(".menu-toggle").focus()');
  await key('Enter', 'Enter', 13);
  report.menu.opened = await evaluate('document.querySelector(".menu-toggle").getAttribute("aria-expanded") === "true" && getComputedStyle(document.querySelector("#main-nav")).display !== "none"');
  await key('Tab', 'Tab', 9);
  report.menu.tabEntersNavigation = await evaluate('document.activeElement.matches("#main-nav a")');
  await key('Escape', 'Escape', 27);
  report.menu.escapeClosesAndRestoresFocus = await evaluate('document.querySelector(".menu-toggle").getAttribute("aria-expanded") === "false" && document.activeElement.matches(".menu-toggle")');
  await key('Enter', 'Enter', 13); await key('Tab', 'Tab', 9); await key('Enter', 'Enter', 13);
  report.menu.navigationCloses = await evaluate('document.querySelector(".menu-toggle").getAttribute("aria-expanded") === "false"');
  await evaluate('document.querySelectorAll("details").forEach(d => d.open = false); document.querySelector("summary").focus()');
  await key('Enter', 'Enter', 13);
  report.keyboard.disclosureEnter = await evaluate('document.querySelector("details").open');
  await delay(250);
  await key(' ', 'Space', 32);
  await delay(250);
  report.keyboard.disclosureSpace = await evaluate('!document.querySelector("details").open');
  report.keyboard.projectFeedback = await evaluate('({ underline: getComputedStyle(document.querySelector("summary h3"), "::after").transform, arrow: getComputedStyle(document.querySelector("summary .project-plus")).transform })');
  await evaluate('document.querySelector(".menu-toggle").focus()');
  await key('Enter', 'Enter', 13);
  await delay(700);
  report.menu.rotatedIcon = await evaluate('getComputedStyle(document.querySelector(".menu-toggle span")).transform !== "none"');
  report.menu.slidingIndicator = await evaluate('document.querySelector("#main-nav").classList.contains("has-indicator") && Math.abs(parseFloat(getComputedStyle(document.querySelector(".nav-indicator")).width) - document.querySelector("#main-nav a.active").getBoundingClientRect().width) < 1');
  report.indicatorMeasurements = await evaluate('({ ready:document.querySelector("#main-nav").classList.contains("has-indicator"), width:getComputedStyle(document.querySelector(".nav-indicator")).width, expected:document.querySelector("#main-nav a.active").getBoundingClientRect().width, variable:document.querySelector("#main-nav").style.getPropertyValue("--nav-width") })');
  await key('Escape', 'Escape', 27);
  await evaluate('document.querySelector("summary").scrollIntoView({block:"center",behavior:"instant"})');
  await delay(100);
  const touchPoint = await evaluate('(() => { const r = document.querySelector("summary").getBoundingClientRect(); return {x:r.x + r.width / 2,y:r.y + r.height / 2}; })()');
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(150);
  report.keyboard.touchDisclosure = await evaluate('document.querySelector("details").open');
  await key('Tab', 'Tab', 9);
  await evaluate('document.querySelector(".menu-toggle").click()');
  report.keyboard.focusStyles = await evaluate(`(() => {
    return [...document.querySelectorAll('#main-nav a, summary, .social-links a, .cv-download a, input, select, textarea, #contact-submit')].map(el => {
      if (!el.getClientRects().length) return null;
      el.focus(); const s = getComputedStyle(el);
      return { element: el.id || el.getAttribute('aria-label') || el.textContent.trim().slice(0,35), focusable: document.activeElement === el, visibleOutline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 };
    }).filter(Boolean);
  })()`);
  report.form.requiredLabels = await evaluate('[...document.querySelectorAll("[required]")].map(el => ({ id: el.id, label: document.querySelector(`label[for="${el.id}"]`).textContent }))');
  await evaluate('document.querySelector("#contact-submit").click()');
  report.form.emptySubmission = await evaluate('({ invalidField: document.activeElement.id, validationMessage: document.querySelector("#contact-name").validationMessage, draftHidden: document.querySelector("#message-result").hidden })');
  await evaluate('document.querySelector("#contact-name").value = "Alex"; document.querySelector("#contact-email").value = "bad-email"; document.querySelector("#contact-submit").click()');
  report.form.invalidEmail = await evaluate('({ invalidField: document.activeElement.id, validationMessage: document.querySelector("#contact-email").validationMessage })');
  await evaluate('document.querySelector("#contact-email").value = "alex@example.com"; document.querySelector("#contact-message").value = "Hello"; document.querySelector("#contact-submit").click()');
  report.form.validDraft = await evaluate('({ draftVisible: !document.querySelector("#message-result").hidden, status: document.querySelector("#contact-status").textContent })');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  report.reducedMotion = await evaluate('({ matches: matchMedia("(prefers-reduced-motion: reduce)").matches, smoothScrollDisabled: getComputedStyle(document.documentElement).scrollBehavior === "auto", animatedElements: [...document.querySelectorAll("body *")].filter(el => getComputedStyle(el).animationName !== "none").length })');
  const { root } = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '.social-icon' });
  await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
  report.reducedMotion.socialHoverTransform = await evaluate('getComputedStyle(document.querySelector(".social-icon")).transform');
  report.reducedMotion.flourishVisible = await evaluate('parseFloat(getComputedStyle(document.querySelector(".name-flourish path")).strokeDashoffset) === 0');
  await evaluate('document.querySelector(".menu-toggle").setAttribute("aria-expanded", "false"); document.querySelector("#main-nav").classList.remove("is-open"); window.scrollTo(0,0); document.activeElement.blur()');
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(join(profile, 'mobile.png'), Buffer.from(shot.data, 'base64'));
  await send('Page.navigate', { url: base + '/?share=1#mafori-fc' });
  await delay(800);
  const linkedProjectVisible = id => evaluate(`(() => {
    const card = document.getElementById('${id}');
    const top = card.querySelector('summary').getBoundingClientRect().top;
    const headerBottom = document.querySelector('.site-header').getBoundingClientRect().bottom;
    return card.open && !card.querySelector('.project-content').inert && top >= headerBottom && top < innerHeight && document.querySelector('#main-nav a[aria-current]').hash === '#projects';
  })()`);
  assert.ok(await linkedProjectVisible('mafori-fc'), 'Initial deep link must open the project below the header');
  for (const preference of ['no-preference', 'reduce']) {
    await send('Emulation.setEmulatedMedia', { features:[{name:'prefers-reduced-motion',value:preference}] });
    for (const id of ['project-two', 'project-three', 'mafori-fc']) {
      await evaluate(`document.getElementById('${id}').open = false; location.hash = '${id}'`);
      await delay(350);
      assert.ok(await linkedProjectVisible(id), 'Hash changes must expand the requested disclosure');
    }
  }
  await evaluate('location.hash = "project-two"'); await delay(250);
  await evaluate('location.hash = "project-three"'); await delay(250);
  await evaluate('document.querySelector("#project-two").open = false; history.back()'); await delay(350);
  assert.ok(await linkedProjectVisible('project-two'), 'Back must reopen the previous project');
  await evaluate('document.querySelector("#project-three").open = false; history.forward()'); await delay(350);
  assert.ok(await linkedProjectVisible('project-three'), 'Forward must reopen the next project');
  await evaluate(`window.linkClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text => { window.projectCopied = text; }}});`);
  for (const id of ['mafori-fc', 'project-two', 'project-three']) {
    await evaluate(`document.querySelector('#${id} .project-link-button').click()`);
    await delay(100);
    assert.ok(await evaluate(`window.projectCopied === new URL('/?share=1#${id}', location.origin).href && document.querySelector('#${id} .project-link-controls [role="status"]').textContent === 'Project link copied to clipboard.'`));
  }
  await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async () => {throw Error('Denied');}}}); document.querySelector('#project-three .project-link-button').click()`);
  await delay(100);
  assert.ok(await evaluate(`(() => {
    const field = document.querySelector('#project-three-link'); field.focus();
    return field.getClientRects().length > 0 && field.readOnly && field.value.endsWith('/?share=1#project-three') && field.selectionEnd === field.value.length && document.querySelector('#project-three .project-link-controls [role="status"]').textContent.startsWith('Could not copy');
  })()`), 'Clipboard failure must expose a selectable, accurate fallback URL');
  await evaluate(`if (window.linkClipboard) Object.defineProperty(navigator,'clipboard',window.linkClipboard); else delete navigator.clipboard; location.hash = 'about';`);
  await delay(300);
  assert.ok(await evaluate('document.querySelector("#main-nav a[aria-current]").hash === "#about"'), 'Section navigation must still work');
  report.projectLinks = 'PASS: initial deep link, hash changes, Back/Forward, sticky-header offset, section navigation, both motion preferences, all copied URLs and clipboard fallback.';
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await send('Page.reload');
  await delay(500);
  report.withoutJavaScript = await evaluate('({ readable: document.querySelector("h1").textContent.includes("Adoration") && document.querySelector("#about").textContent.includes("Computer Science"), navigationVisible: getComputedStyle(document.querySelector("#main-nav")).display !== "none", disclosureAvailable: !!document.querySelector("details summary"), flourishVisible: parseFloat(getComputedStyle(document.querySelector(".name-flourish path")).strokeDashoffset) === 0 })');
  console.log(JSON.stringify(report, null, 2));
  console.log('Navigation regression: ' + JSON.stringify(report.navHighlight));
  console.log(`Screenshot: ${join(profile, 'mobile.png')}`);
  assert.ok(report.navHighlight.every(result => result.active === '#' + result.target), 'Clicked and manually scrolled sections must match the highlight');
  assert.ok(report.layouts.every(l => !l.horizontalOverflow && !l.navigationOverlap && !l.crampedSocialLinks.length && !l.controlsOverlap && !l.galleryOverlap && l.iconOnlySocials && !l.footerOverlap && (!l.openMenu || (!l.openMenu.horizontalOverflow && l.openMenu.linksVisible))));
  assert.ok(Object.values(report.menu).every(Boolean));
  assert.ok(report.keyboard.disclosureEnter && report.keyboard.disclosureSpace && report.keyboard.focusStyles.every(f => f.focusable && f.visibleOutline));
  assert.ok(report.keyboard.touchDisclosure && Object.values(report.withoutJavaScript).every(Boolean) && report.reducedMotion.flourishVisible);
  assert.ok(report.form.requiredLabels.every(l => l.label.includes('(required)')));
  assert.ok(report.form.emptySubmission.draftHidden && report.form.invalidEmail.invalidField === 'contact-email' && report.form.validDraft.draftVisible);
  assert.ok(report.reducedMotion.matches && report.reducedMotion.smoothScrollDisabled && report.reducedMotion.animatedElements === 0 && report.reducedMotion.socialHoverTransform === 'none');
  assert.equal(errors.length, 0);
  assert.ok(report.features.eveningTheme && report.features.themeRemembered && report.features.themeWithoutStorage && report.features.progressAtTop && report.features.progressAtBottom && report.features.previewsInactive);
  assert.ok(report.features.eveningLayouts.every(l => !l.horizontalOverflow));
  assert.ok(report.features.gallerySelection && report.features.dynamicPreview && report.features.dialogOpened && report.features.dialogFocusContained && report.features.dialogEscapeAndFocus && report.features.progressAfterCollapse);
  console.log('PASS: browser layout, keyboard, validation, reduced motion and console audit.');
} finally {
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close', {}, null).catch(() => {}); socket.close(); }
  chrome.kill();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
