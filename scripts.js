const poster = document.getElementById('poster');
const maskCanvas = document.getElementById('maskCanvas');
const ctx = maskCanvas.getContext('2d');
const cellSize = 20;
const cells = new Map();
let width = 0;
let height = 0;
let rect = null;

function resizeCanvas() {
  rect = poster.getBoundingClientRect();
  width = Math.floor(rect.width);
  height = Math.floor(rect.height);
  const ratio = window.devicePixelRatio || 1;
  maskCanvas.width = width * ratio;
  maskCanvas.height = height * ratio;
  maskCanvas.style.width = `${width}px`;
  maskCanvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function revealAt(x, y) {
  const col = Math.floor(x / cellSize);
  const row = Math.floor(y / cellSize);

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const key = `${col + dx}:${row + dy}`;
      cells.set(key, { alpha: 1, lastSeen: performance.now() });
    }
  }
}

function updateMask() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.96)';
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(255, 255, 255, 1)';

  const now = performance.now();
  const holdTime = 2000;

  cells.forEach((cell, key) => {
    const [col, row] = key.split(':').map(Number);
    const x = col * cellSize;
    const y = row * cellSize;

    const decay = 0.03;
    if (now - cell.lastSeen > holdTime) {
      cell.alpha = Math.max(0, cell.alpha - decay);
    }

    if (cell.alpha <= 0) {
      cells.delete(key);
      return;
    }

    ctx.globalAlpha = cell.alpha;
    ctx.fillRect(x, y, cellSize, cellSize);
  });

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  updateNegativeText();
  requestAnimationFrame(updateMask);
}

window.addEventListener('resize', resizeCanvas);

function initAnimations() {
  if (typeof gsap === 'undefined') return;

  gsap.set('.poster__badge .badge, .line, .poster__info p', { opacity: 0, y: 24 });

  const intro = gsap.timeline({ defaults: { duration: 0.85, ease: 'power3.out' } });
  intro
    .to('.poster__badge .badge', { opacity: 1, y: 0, stagger: 0.12 })
    .to('.line', { opacity: 1, y: 0, stagger: 0.14 }, '-=0.5')
    .to('.poster__info p', { opacity: 1, y: 0, stagger: 0.12 }, '-=0.45');

  gsap.to('.poster__image', { scale: 1.06, duration: 18, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  gsap.to('.poster', { boxShadow: '0 45px 120px rgba(0, 0, 0, 0.55)', duration: 3, repeat: -1, yoyo: true, ease: 'sine.inOut' });

  poster.addEventListener('mouseenter', () => {
    gsap.to(poster, { scale: 1.012, duration: 0.3, ease: 'power2.out' });
  });

  poster.addEventListener('mouseleave', () => {
    gsap.to(poster, { scale: 1, duration: 0.3, ease: 'power2.out' });
    document.querySelectorAll('.type-copy--negative').forEach((copy) => {
      copy.style.clipPath = 'inset(100% 0 0 0)';
    });
  });
}

poster.addEventListener('pointermove', (event) => {
  if (!rect) resizeCanvas();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  revealAt(x, y);
});

poster.addEventListener('pointerdown', (event) => {
  if (!rect) resizeCanvas();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  revealAt(x, y);
});

function updateNegativeText() {
  if (!rect) return;
  const posterLeft = rect.left;
  const posterTop = rect.top;
  const activeCells = Array.from(cells.entries())
    .filter(([, cell]) => cell.alpha > 0)
    .map(([key]) => {
      const [col, row] = key.split(':').map(Number);
      return {
        left: col * cellSize,
        top: row * cellSize,
        right: (col + 1) * cellSize,
        bottom: (row + 1) * cellSize,
      };
    });

  document.querySelectorAll('.type-copy--negative').forEach((negativeSpan) => {
    const parentCopy = negativeSpan.parentElement;
    if (!parentCopy || !parentCopy.classList.contains('type-copy')) return;

    const copyRect = parentCopy.getBoundingClientRect();
    const relativeBlock = {
      left: copyRect.left - posterLeft,
      top: copyRect.top - posterTop,
      right: copyRect.right - posterLeft,
      bottom: copyRect.bottom - posterTop,
    };

    const overlaps = activeCells
      .map((cellRect) => {
        const left = Math.max(cellRect.left, relativeBlock.left);
        const right = Math.min(cellRect.right, relativeBlock.right);
        const top = Math.max(cellRect.top, relativeBlock.top);
        const bottom = Math.min(cellRect.bottom, relativeBlock.bottom);
        if (left < right && top < bottom) {
          return {
            left: left - relativeBlock.left,
            right: right - relativeBlock.left,
            top: top - relativeBlock.top,
            bottom: bottom - relativeBlock.top,
          };
        }
        return null;
      })
      .filter(Boolean);

    if (overlaps.length === 0) {
      negativeSpan.style.clipPath = 'inset(100% 0 0 0)';
      negativeSpan.style.opacity = '0';
      return;
    }

    const path = overlaps
      .map((rect) => `M${rect.left} ${rect.top} H${rect.right} V${rect.bottom} H${rect.left} Z`)
      .join(' ');

    negativeSpan.style.clipPath = `path('${path}')`;
    negativeSpan.style.opacity = '1';
  });
}

resizeCanvas();
updateMask();
initAnimations();
