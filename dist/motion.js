// Keep the native cursor hotspot immediate; only the decorative halo follows.
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const halo = document.createElement('div');
halo.className = 'cursor-halo';
halo.setAttribute('aria-hidden', 'true');
document.body.append(halo);
let frame = 0;
let x = 0, y = 0, currentX = 0, currentY = 0, size = 1, targetSize = 1;
const enabled = () => finePointer.matches && !reducedMotion.matches;
function hide() {
  halo.classList.remove('is-visible');
  cancelAnimationFrame(frame);
  frame = 0;
}
function draw() {
  currentX += (x - currentX) * .24;
  currentY += (y - currentY) * .24;
  size += (targetSize - size) * .2;
  halo.style.transform = `translate3d(${currentX}px,${currentY}px,0) scale(${size})`;
  frame = Math.abs(x - currentX) + Math.abs(y - currentY) + Math.abs(targetSize - size) > .05 ? requestAnimationFrame(draw) : 0;
}
document.addEventListener('pointermove', event => {
  if (!enabled() || event.pointerType !== 'mouse') { hide(); return; }
  const target = event.target;
  if (target.closest('input,textarea,[contenteditable="true"],iframe')) { hide(); return; }
  x = event.clientX; y = event.clientY;
  if (!halo.classList.contains('is-visible')) { currentX = x; currentY = y; }
  const interactive = !!target.closest('a,button,summary,[role="button"]');
  targetSize = interactive ? 1.5 : 1;
  halo.classList.toggle('is-interactive', interactive);
  halo.classList.add('is-visible');
  if (!frame) frame = requestAnimationFrame(draw);
}, { passive:true });
document.documentElement.addEventListener('pointerleave', hide);
document.addEventListener('pointerdown', hide);
document.addEventListener('keydown', hide);
window.addEventListener('blur', hide);
document.addEventListener('visibilitychange', hide);
finePointer.addEventListener('change', hide);
reducedMotion.addEventListener('change', hide);
