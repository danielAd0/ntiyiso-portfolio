const root = document.documentElement;
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const themeToggle = document.querySelector('#theme-toggle');
function applyTheme(theme, announce = false) {
  root.dataset.theme = theme;
  themeToggle.title = theme === 'evening' ? 'Switch to cream theme' : 'Switch to evening theme';
  themeToggle.setAttribute('aria-pressed', String(theme === 'evening'));
  document.querySelector('meta[name="theme-color"]').content = theme === 'evening' ? '#29101b' : '#fbf6ed';
  if (announce) document.querySelector('#theme-status').textContent = `${theme === 'evening' ? 'Evening' : 'Cream'} theme selected.`;
}
let savedTheme;
try { savedTheme = localStorage.getItem('portfolio-theme'); } catch { /* Theme still works without storage. */ }
applyTheme(savedTheme === 'evening' ? 'evening' : 'cream', true);
themeToggle.hidden = false;
themeToggle.addEventListener('click', () => {
  const theme = root.dataset.theme === 'evening' ? 'cream' : 'evening';
  applyTheme(theme, true);
  try { localStorage.setItem('portfolio-theme', theme); } catch { /* Selection lasts for this page visit. */ }
});

const decorations = [...document.querySelectorAll('[data-decoration]')];
if ('IntersectionObserver' in window && !motion.matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      const decoration = target.matches('[data-decoration]') ? target : target.querySelector('[data-decoration]');
      decoration.classList.remove('decoration-pending');
      decoration.classList.add('decoration-entered');
      observer.unobserve(target);
    });
  }, { threshold: .2 });
  decorations.forEach(el => {
    el.classList.add('decoration-pending');
    // The sweep starts when Contact enters view, rather than waiting for its heading.
    const target = el.matches('.contact-entrance') ? el.closest('section') : el;
    observer.observe(target);
  });
  motion.addEventListener('change', event => {
    if (!event.matches) return;
    observer.disconnect();
    decorations.forEach(el => el.classList.remove('decoration-pending', 'decoration-entered'));
  });
}

// Enhance the existing footer link; no second back-to-top control.
const backTop = document.querySelector('.back-top');
let progressQueued = false;
function updateProgress() {
  progressQueued = false;
  const distance = root.scrollHeight - root.clientHeight;
  const progress = distance > 0 ? Math.max(0, Math.min(1, window.scrollY / distance)) : 1;
  backTop.style.setProperty('--scroll-remaining', String(1 - progress));
}
function queueProgress() {
  if (progressQueued) return;
  progressQueued = true;
  requestAnimationFrame(updateProgress);
}
window.addEventListener('scroll', queueProgress, { passive: true });
window.addEventListener('resize', queueProgress);
const header = document.querySelector('.site-header');
function updateHeaderOffset() {
  root.style.setProperty('--header-offset', (header.getBoundingClientRect().height + 24) + 'px');
}
if ('ResizeObserver' in window) new ResizeObserver(updateHeaderOffset).observe(header);
else window.addEventListener('resize', updateHeaderOffset);
updateHeaderOffset();
document.querySelectorAll('.project-card').forEach(el => el.addEventListener('toggle', queueProgress));
if ('ResizeObserver' in window) new ResizeObserver(queueProgress).observe(document.body);
updateProgress();

// Real screenshots can be added as <img> elements inside .project-content.
// Only successfully loaded images receive an enlargement control.
const dialog = document.querySelector('#preview-dialog');
let previewTrigger;
document.querySelector('#close-preview').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  document.querySelector('#preview-image-container').replaceChildren();
  if (previewTrigger?.isConnected) previewTrigger.focus({ preventScroll: true });
});
function activatePreview(image) {
  if (!image.naturalWidth || image.dataset.previewReady || typeof dialog.showModal !== 'function') return;
  image.dataset.previewReady = 'true';
  const figure = document.createElement('figure');
  figure.className = 'project-preview';
  figure.hidden = image.hidden;
  image.hidden = false;
  image.before(figure);
  figure.append(image);
  const caption = document.createElement('figcaption');
  caption.textContent = image.closest('.project-gallery') ? ['Home / Club introduction', 'Squad / Meet the team', 'Newsletter / News & publications'][[...image.closest('.project-gallery').querySelectorAll('img:not([data-gallery-thumbnail])')].indexOf(image)] : image.alt;
  figure.append(caption);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button-secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent enabled:hover:bg-soft motion-safe:transition-colors motion-safe:duration-200 disabled:opacity-50 disabled:cursor-default motion-safe:enabled:active:scale-[.98]';
  button.textContent = 'Open larger preview';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', dialog.id);
  const title = image.closest('.project-card').querySelector('h3').textContent;
  button.setAttribute('aria-label', `Open larger preview: ${image.alt}`);
  figure.append(button);
  if (image.closest('.project-gallery')) button.textContent = 'Enlarge \u2197';
  button.addEventListener('click', () => {
    if (!image.naturalWidth || dialog.open) return;
    previewTrigger = button;
    document.querySelector('#preview-title').textContent = `${title}: ${image.alt}`;
    const largeImage = image.cloneNode();
    largeImage.loading = 'eager';
    document.querySelector('#preview-image-container').replaceChildren(largeImage);
    dialog.showModal();
  });
}
const observedImages = new WeakSet();
function observePreview(image) {
  if (image.hasAttribute('data-gallery-thumbnail') || observedImages.has(image)) return;
  observedImages.add(image);
  image.addEventListener('load', () => activatePreview(image));
  image.addEventListener('error', () => {
    const figure = image.closest('.project-preview');
    // A removed or failed screenshot must not retain an active enlargement control.
    if (figure) {
      figure.before(image);
      figure.remove();
      delete image.dataset.previewReady;
    }
  });
  if (image.complete) activatePreview(image);
}
// A steady featured frame with small, labelled page selectors.
document.querySelectorAll('.project-gallery').forEach((gallery, galleryIndex) => {
  const images = [...gallery.querySelectorAll('img')];
  const labels = ['Home', 'Squad', 'Newsletter'];
  const controls = document.createElement('div');
  controls.className = 'gallery-thumbnails';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Choose a Mafori FC screenshot');
  gallery.id ||= 'project-gallery-' + galleryIndex;
  function choose(index) {
    images.forEach((image, i) => {
      (image.closest('.project-preview') || image).hidden = i !== index;
      controls.children[i].setAttribute('aria-pressed', String(i === index));
    });
    queueProgress();
  }
  images.forEach((image, index) => {
    image.loading = 'eager';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gallery-thumbnail focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-safe:transition-colors motion-safe:duration-200 motion-safe:active:scale-[.98]';
    button.setAttribute('aria-controls', gallery.id);
    button.setAttribute('aria-label', 'Show ' + labels[index] + ' screenshot');
    const thumbnail = image.cloneNode();
    thumbnail.alt = '';
    thumbnail.setAttribute('data-gallery-thumbnail', '');
    const label = document.createElement('span');
    label.textContent = labels[index];
    button.append(thumbnail, label);
    controls.append(button);
    button.addEventListener('click', () => choose(index));
  });
  gallery.append(controls);
  gallery.classList.add('has-gallery-controls');
  choose(0);
});
document.querySelectorAll('.project-content img').forEach(observePreview);
// Also support screenshots inserted later without duplicating controls.
if ('MutationObserver' in window) {
  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.matches('img') && node.closest('.project-content')) observePreview(node);
      node.querySelectorAll('.project-content img, img').forEach(image => {
        if (image.closest('.project-content')) observePreview(image);
      });
    }));
  }).observe(document.querySelector('.project-list'), { childList: true, subtree: true });
}

// Animate only the disclosure body. Native details remains the no-JS fallback.
document.querySelectorAll('.project-card').forEach(card => {
  const summary = card.querySelector('summary');
  const content = card.querySelector('.project-content');
  let animation;
  let expanded = card.open;
  function settle() {
    animation?.cancel();
    animation = null;
    card.open = expanded;
    card.classList.remove('is-expanding', 'is-collapsing');
    content.style.removeProperty('overflow');
    content.inert = !expanded;
    queueProgress();
  }
  summary.addEventListener('click', event => {
    if (motion.matches || typeof content.animate !== 'function') return;
    event.preventDefault();
    const wasOpen = card.open;
    const from = wasOpen ? content.getBoundingClientRect().height : 0;
    expanded = animation ? !expanded : !card.open;
    animation?.cancel();
    card.open = true;
    content.inert = !expanded;
    content.style.overflow = 'hidden';
    card.classList.toggle('is-expanding', expanded);
    card.classList.toggle('is-collapsing', !expanded);
    animation = content.animate([{ height: from + 'px', paddingBottom: wasOpen ? getComputedStyle(content).paddingBottom : '0px', opacity: expanded ? .6 : 1 }, { height: (expanded ? content.scrollHeight : 0) + 'px', paddingBottom: expanded ? getComputedStyle(content).paddingBottom : '0px', opacity: expanded ? 1 : 0 }], { duration: 200, easing: 'ease-out' });
    animation.onfinish = settle;
  });
  card.addEventListener('toggle', () => { if (!animation) { expanded = card.open; content.inert = !expanded; } });
  motion.addEventListener('change', () => { if (motion.matches && animation) settle(); });
});
