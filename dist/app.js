const select = selector => document.querySelector(selector);
const selectAll = selector => [...document.querySelectorAll(selector)];
const menu = select('.menu-toggle');
const nav = select('#main-nav');

// One moving underline, with the original CSS underline as a no-JS fallback.
function updateNavIndicator() {
  if (typeof nav.getBoundingClientRect !== 'function') return;
  const active = nav.querySelector('a.active');
  if (!active || !nav.getClientRects().length) return;
  nav.style.setProperty('--nav-x', `${active.offsetLeft}px`);
  nav.style.setProperty('--nav-y', `${active.offsetTop + active.offsetHeight - 7}px`);
  nav.style.setProperty('--nav-width', `${active.offsetWidth}px`);
  nav.classList.add('has-indicator');
}

function closeMenu() {
  menu.setAttribute('aria-expanded', 'false');
  nav.classList.remove('is-open');
  menu.querySelector('span').textContent = '+';
}
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('is-open', open);
  updateNavIndicator();
});
nav.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menu.focus();
  }
});
window.matchMedia('(min-width: 901px)').addEventListener('change', event => {
  if (event.matches) closeMenu();
});
// Collapse the mobile index only after its controls are working.
document.documentElement.classList.add('js');
updateNavIndicator();
if ('ResizeObserver' in window) {
  new ResizeObserver(updateNavIndicator).observe(nav);
}

const form = select('#contact-form');
const status = select('#contact-status');
let currentDraft = '';
let draftRevision = 0;
function clearSuccess() {
  ['#contact-submit', '#copy-message'].forEach(selector => {
    const button = select(selector);
    button.classList.remove('is-success');
    button.textContent = selector === '#contact-submit' ? 'Prepare my draft' : 'Copy note';
  });
}
function showSuccess(selector, label) {
  const button = select(selector);
  button.classList.add('is-success');
  button.textContent = label;
}

function buildDraft({ name, email, topic, message }) {
  const cleanName = name.trim();
  const cleanEmail = email.trim();
  const cleanMessage = message.trim();
  if (!cleanName || !cleanEmail || !cleanMessage) return '';
  return `To: Ntiyiso Adoration\nFrom: ${cleanName} <${cleanEmail}>\nSubject: ${topic}\n\nHi Ntiyiso,\n\n${cleanMessage}\n\nRegards,\n${cleanName}`;
}
function invalidateDraft() {
  clearSuccess();
  currentDraft = '';
  draftRevision++;
  select('#message-result').hidden = true;
  status.textContent = '';
}
form.addEventListener('input', invalidateDraft);
form.addEventListener('change', invalidateDraft);
form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  currentDraft = buildDraft(Object.fromEntries(new FormData(form)));
  draftRevision++;
  if (!currentDraft) {
    status.textContent = 'Please add your name, email, and message before preparing a draft.';
    return;
  }
  clearSuccess();
  showSuccess('#contact-submit', 'Draft prepared ?');
  select('#message-preview').textContent = currentDraft;
  select('#message-result').hidden = false;
  status.textContent = 'Draft prepared. Copy or download it; no message has been sent.';
});
select('#copy-message').addEventListener('click', async () => {
  if (!currentDraft) return;
  const revision = draftRevision;
  try {
    await navigator.clipboard.writeText(currentDraft);
    if (revision === draftRevision) {
      showSuccess('#copy-message', 'Note copied ?');
      status.textContent = 'Note copied. Paste it into your preferred messaging app.';
    }
  } catch {
    if (revision !== draftRevision) return;
    select('#copy-message').classList.remove('is-success');
    select('#copy-message').textContent = 'Copy note';
    const range = document.createRange();
    range.selectNodeContents(select('#message-preview'));
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    status.textContent = 'Use your device’s Copy command on the selected draft, or download it.';
  }
});
select('#download-message').addEventListener('click', () => {
  if (!currentDraft) return;
  const url = URL.createObjectURL(new Blob([currentDraft], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'message-for-ntiyiso.txt';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = 'Your draft download is ready. No message has been sent.';
});
// Prevent submission until the local-only composer is ready.
select('#contact-submit').disabled = false;

if ('IntersectionObserver' in window) {
  const navObserver = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (!visible.length) return;
    const id = visible[0].target.id;
    selectAll('#main-nav a').forEach(link => {
      const active = link.getAttribute('href') === `#${id}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    updateNavIndicator();
  }, { rootMargin: '-10% 0px -55% 0px', threshold: [0, 0.15, 0.4] });
  selectAll('main > section').forEach(section => navObserver.observe(section));

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!motion.matches) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    selectAll('[data-reveal]').forEach(element => revealObserver.observe(element));
    motion.addEventListener('change', event => {
      if (event.matches) revealObserver.disconnect();
    });
  }
}
