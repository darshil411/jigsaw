/**
 * ═══════════════════════════════════════════
 * CONSTELLATION CHALLENGE — GAME SCRIPT
 * Single-file, vanilla JS, no dependencies
 * ═══════════════════════════════════════════
 */

'use strict';

/* ══════════════════════════════════════════
   ① CONFIG — CHANGE THESE ANY TIME
══════════════════════════════════════════ */
const CONFIG = {
  GRID_SIZE: 4,               // 3 = easy | 4 = medium | 5 = hard
  IMAGE_SRC: 'sample.png',    // Replace with actual constellation image
  LOGO_SRC: 'logo.png',
  TIMER_SECONDS: 120,         // Countdown seconds
  HINT_TEXT: 'The answer lies in the seventh house — look for the pattern between Orion and Cassiopeia at midnight.',
  SHOW_TIMER: true,
  ALLOW_ROTATION: false,      // Future: piece rotation
};

/* ══════════════════════════════════════════
   ② GAME STATE
══════════════════════════════════════════ */
const STATE = {
  pieces: [],           // { id, correctIndex, currentIndex }
  gridSize: CONFIG.GRID_SIZE,
  timerSeconds: CONFIG.TIMER_SECONDS,
  timerInterval: null,
  imageLoaded: false,
  gameActive: false,
  dragState: {
    active: false,
    pieceId: null,
    sourceType: null,   // 'grid' | 'tray'
    sourceIndex: null,
    ghost: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  },
};

/* ══════════════════════════════════════════
   ③ DOM REFS
══════════════════════════════════════════ */
const DOM = {
  starCanvas:       () => document.getElementById('starCanvas'),
  landingScreen:    () => document.getElementById('landingScreen'),
  gameScreen:       () => document.getElementById('gameScreen'),
  startBtn:         () => document.getElementById('startBtn'),
  restartBtn:       () => document.getElementById('restartBtn'),
  submitBtn:        () => document.getElementById('submitBtn'),
  timerDisplay:     () => document.getElementById('timerDisplay'),
  timerBlock:       () => document.getElementById('timerBlock'),
  puzzleGrid:       () => document.getElementById('puzzleGrid'),
  piecesTray:       () => document.getElementById('piecesTray'),
  dragGhost:        () => document.getElementById('dragGhost'),
  resultModal:      () => document.getElementById('resultModal'),
  successContent:   () => document.getElementById('successContent'),
  failureContent:   () => document.getElementById('failureContent'),
  timeoutContent:   () => document.getElementById('timeoutContent'),
  hintText:         () => document.getElementById('hintText'),
  playAgainBtn:     () => document.getElementById('playAgainBtn'),
  retryBtn:         () => document.getElementById('retryBtn'),
  timeoutRetryBtn:  () => document.getElementById('timeoutRetryBtn'),
  pieceCounter:     () => document.getElementById('pieceCounter'),
  diffBtns:         () => document.querySelectorAll('.diff-btn'),
  gameMain:         () => document.getElementById('gameMain'),
};

/* ══════════════════════════════════════════
   ④ STAR FIELD ANIMATION
══════════════════════════════════════════ */
const StarField = (() => {
  let ctx, width, height, stars = [], animId;

  function createStars(n) {
    stars = [];
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.4 + 0.2,
        alpha: Math.random(),
        speed: Math.random() * 0.004 + 0.001,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Space gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#020510');
    grad.addColorStop(0.5, '#050a1a');
    grad.addColorStop(1, '#030818');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Nebula glow
    const nebulaX = width * 0.65, nebulaY = height * 0.3;
    const nebula = ctx.createRadialGradient(nebulaX, nebulaY, 0, nebulaX, nebulaY, Math.min(width, height) * 0.35);
    nebula.addColorStop(0, 'rgba(61,142,255,0.04)');
    nebula.addColorStop(0.5, 'rgba(124,58,237,0.025)');
    nebula.addColorStop(1, 'transparent');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, width, height);

    const t = Date.now() * 0.001;

    stars.forEach(s => {
      s.twinkle += s.speed;
      const a = (Math.sin(s.twinkle) * 0.4 + 0.6) * s.alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,230,255,${a})`;
      ctx.fill();
    });

    // Occasional bright star cross
    stars.forEach((s, i) => {
      if (i % 30 === 0 && s.r > 1.2) {
        const a = (Math.sin(s.twinkle) * 0.5 + 0.5) * 0.4;
        if (a > 0.2) {
          ctx.strokeStyle = `rgba(0,245,255,${a})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(s.x - 6, s.y); ctx.lineTo(s.x + 6, s.y);
          ctx.moveTo(s.x, s.y - 6); ctx.lineTo(s.x, s.y + 6);
          ctx.stroke();
        }
      }
    });

    animId = requestAnimationFrame(draw);
  }

  function init() {
    const canvas = DOM.starCanvas();
    ctx = canvas.getContext('2d');
    resize();
    createStars(Math.min(200, Math.floor((width * height) / 4000)));
    draw();
    window.addEventListener('resize', resize);
  }

  function resize() {
    const canvas = DOM.starCanvas();
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    if (stars.length) createStars(stars.length);
  }

  return { init };
})();

/* ══════════════════════════════════════════
   ⑤ AUDIO — SOFT SYNTH SOUNDS
══════════════════════════════════════════ */
const Audio = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function playTone(freq, type, duration, gain = 0.15, delay = 0) {
    try {
      const ac = getCtx();
      const osc = ac.createOscillator();
      const gainNode = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ac.currentTime + delay + duration);
      gainNode.gain.setValueAtTime(0, ac.currentTime + delay);
      gainNode.gain.linearRampToValueAtTime(gain, ac.currentTime + delay + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration);
      osc.connect(gainNode);
      gainNode.connect(ac.destination);
      osc.start(ac.currentTime + delay);
      osc.stop(ac.currentTime + delay + duration);
    } catch (_) {}
  }

  function playDrop() {
    playTone(440, 'sine', 0.12, 0.08);
  }

  function playSuccess() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => playTone(f, 'sine', 0.3, 0.12, i * 0.12));
  }

  function playFail() {
    playTone(220, 'sawtooth', 0.3, 0.08);
    playTone(196, 'sawtooth', 0.3, 0.08, 0.15);
  }

  function playClick() {
    playTone(880, 'sine', 0.06, 0.06);
  }

  return { playDrop, playSuccess, playFail, playClick };
})();

/* ══════════════════════════════════════════
   ⑥ PUZZLE PIECE MANAGEMENT
══════════════════════════════════════════ */
function createPieces(gridSize) {
  const total = gridSize * gridSize;
  return Array.from({ length: total }, (_, i) => ({
    id: i,
    correctIndex: i,
    currentIndex: null,  // null = in tray
  }));
}

function shufflePieces(pieces) {
  const arr = [...pieces];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getPieceStyle(pieceId, gridSize, containerW, containerH) {
  const col = pieceId % gridSize;
  const row = Math.floor(pieceId / gridSize);
  const bgW = containerW * gridSize;
  const bgH = containerH * gridSize;
  const bgX = -(col * containerW);
  const bgY = -(row * containerH);
  return {
    backgroundImage: `url('${CONFIG.IMAGE_SRC}')`,
    backgroundSize: `${bgW}px ${bgH}px`,
    backgroundPosition: `${bgX}px ${bgY}px`,
  };
}

/* ══════════════════════════════════════════
   ⑦ GRID & TRAY RENDERING
══════════════════════════════════════════ */
function getPieceSize() {
  // Compute actual rendered piece dimensions from grid
  const grid = DOM.puzzleGrid();
  const cell = grid.querySelector('.drop-cell');
  if (!cell) return { w: 80, h: 80 };
  const r = cell.getBoundingClientRect();
  return { w: r.width, h: r.height };
}

function buildGrid() {
  const grid = DOM.puzzleGrid();
  const g = STATE.gridSize;
  grid.style.gridTemplateColumns = `repeat(${g}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${g}, 1fr)`;
  grid.innerHTML = '';

  for (let i = 0; i < g * g; i++) {
    const cell = document.createElement('div');
    cell.className = 'drop-cell';
    cell.dataset.cellIndex = i;
    cell.setAttribute('data-index', i);
    setupDropTarget(cell);
    grid.appendChild(cell);
  }
}

function buildTray() {
  const tray = DOM.piecesTray();
  tray.innerHTML = '';

  // CSS tray columns: auto-fit based on tray pieces count
  const g = STATE.gridSize;
  const cols = Math.min(g * g, parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tray-cols')) || 5);
  tray.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  // Find pieces still in tray (currentIndex === null)
  const trayPieces = STATE.pieces.filter(p => p.currentIndex === null);

  trayPieces.forEach(piece => {
    const slot = document.createElement('div');
    slot.className = 'tray-slot';
    slot.dataset.pieceId = piece.id;
    renderPieceInTray(slot, piece.id);
    tray.appendChild(slot);
  });
}

function renderPieceInTray(slot, pieceId) {
  slot.innerHTML = '';
  slot.dataset.pieceId = pieceId;

  const el = document.createElement('div');
  el.className = 'tray-piece';
  el.dataset.pieceId = pieceId;
  el.dataset.source = 'tray';

  // Get tray slot size
  const tray = DOM.piecesTray();
  const trayRect = tray.getBoundingClientRect();
  const cols = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tray-cols')) || 5;
  const approxW = Math.floor(trayRect.width / cols) - 8;
  const approxH = approxW;

  applyPieceBackground(el, pieceId, approxW || 60, approxH || 60);
  setupDraggable(el);
  slot.appendChild(el);
}

function renderPieceInCell(cell, pieceId) {
  cell.innerHTML = '';
  cell.dataset.pieceId = pieceId;
  cell.classList.add('occupied');

  const el = document.createElement('div');
  el.className = 'puzzle-piece';
  el.dataset.pieceId = pieceId;
  el.dataset.source = 'grid';
  el.dataset.cellIndex = cell.dataset.cellIndex;

  const rect = cell.getBoundingClientRect();
  applyPieceBackground(el, pieceId, rect.width || 80, rect.height || 80);
  setupDraggable(el);
  cell.appendChild(el);
}

function applyPieceBackground(el, pieceId, w, h) {
  const g = STATE.gridSize;
  const col = pieceId % g;
  const row = Math.floor(pieceId / g);
  const bgW = w * g;
  const bgH = h * g;
  const bgX = -(col * w);
  const bgY = -(row * h);
  el.style.backgroundImage = `url('${CONFIG.IMAGE_SRC}')`;
  el.style.backgroundSize = `${bgW}px ${bgH}px`;
  el.style.backgroundPosition = `${bgX}px ${bgY}px`;
}

function refreshPieceCounter() {
  const placed = STATE.pieces.filter(p => p.currentIndex !== null).length;
  const total = STATE.pieces.length;
  const counter = DOM.pieceCounter();
  if (counter) counter.textContent = `${placed} / ${total} placed`;
}

/* ══════════════════════════════════════════
   ⑧ DRAG & DROP — UNIFIED MOUSE + TOUCH
══════════════════════════════════════════ */
function setupDraggable(el) {
  el.addEventListener('mousedown', onDragStart, { passive: false });
  el.addEventListener('touchstart', onDragStart, { passive: false });
}

function setupDropTarget(cell) {
  cell.addEventListener('mouseup', onDropOnCell);
  cell.addEventListener('touchend', onDropOnCell);
}

let lastScrollY = 0;

function onDragStart(e) {
  if (!STATE.gameActive) return;
  e.preventDefault();

  const el = e.currentTarget;
  const pieceId = parseInt(el.dataset.pieceId);
  const source = el.dataset.source; // 'tray' | 'grid'
  const sourceIndex = source === 'grid' ? parseInt(el.dataset.cellIndex) : null;

  const point = getEventPoint(e);

  // Ghost setup
  const ghost = DOM.dragGhost();
  const elRect = el.getBoundingClientRect();

  ghost.style.width  = elRect.width + 'px';
  ghost.style.height = elRect.height + 'px';

  // Copy piece background to ghost
  const g = STATE.gridSize;
  const col = pieceId % g;
  const row = Math.floor(pieceId / g);
  const bgW = elRect.width * g;
  const bgH = elRect.height * g;
  ghost.style.backgroundImage = `url('${CONFIG.IMAGE_SRC}')`;
  ghost.style.backgroundSize  = `${bgW}px ${bgH}px`;
  ghost.style.backgroundPosition = `${-(col * elRect.width)}px ${-(row * elRect.height)}px`;

  ghost.style.left = point.x + 'px';
  ghost.style.top  = point.y + 'px';
  ghost.classList.add('visible');

  el.classList.add('dragging');

  Object.assign(STATE.dragState, {
    active: true,
    pieceId,
    sourceType: source,
    sourceIndex,
    ghost,
    startX: point.x,
    startY: point.y,
  });

  lastScrollY = DOM.gameScreen().scrollTop;

  document.addEventListener('mousemove', onDragMove, { passive: false });
  document.addEventListener('mouseup',   onDragEnd,   { passive: false });
  document.addEventListener('touchmove', onDragMove,  { passive: false });
  document.addEventListener('touchend',  onDragEnd,   { passive: false });
}

function onDragMove(e) {
  if (!STATE.dragState.active) return;
  e.preventDefault();

  const point = getEventPoint(e);
  const ghost = STATE.dragState.ghost;
  ghost.style.left = point.x + 'px';
  ghost.style.top  = point.y + 'px';

  // Highlight target cell under cursor
  ghost.style.display = 'none';
  const el = document.elementFromPoint(point.x, point.y);
  ghost.style.display = '';

  document.querySelectorAll('.drop-cell').forEach(c => c.classList.remove('drag-over'));
  if (el) {
    const cell = el.closest('.drop-cell');
    if (cell) cell.classList.add('drag-over');
  }

  // Auto-scroll: when ghost is near top of viewport, scroll gameScreen up
  const screenEl = DOM.gameScreen();
  const threshold = 100;
  const speed = 8;

  if (point.y < threshold) {
    screenEl.scrollTop -= speed;
  } else if (point.y > window.innerHeight - threshold) {
    screenEl.scrollTop += speed;
  }
}

function onDragEnd(e) {
  if (!STATE.dragState.active) return;
  e.preventDefault();

  const point = getEventPoint(e);
  const ghost = DOM.dragGhost();
  ghost.classList.remove('visible');

  document.querySelectorAll('.drop-cell').forEach(c => c.classList.remove('drag-over'));

  // Find drop target under cursor
  ghost.style.display = 'none';
  const el = document.elementFromPoint(point.x, point.y);
  ghost.style.display = '';

  if (el) {
    const cell = el.closest('.drop-cell');
    if (cell) {
      performDrop(cell);
    } else {
      // Dropped on tray area?
      const trayEl = el.closest('.pieces-tray') || el.closest('.tray-slot');
      if (trayEl) {
        returnPieceToTray(STATE.dragState.pieceId, STATE.dragState.sourceType, STATE.dragState.sourceIndex);
      } else {
        // Cancelled — restore
        cancelDrag();
      }
    }
  } else {
    cancelDrag();
  }

  // Remove dragging class from source
  document.querySelectorAll('.dragging').forEach(d => d.classList.remove('dragging'));

  resetDragState();

  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup',   onDragEnd);
  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('touchend',  onDragEnd);
}

function onDropOnCell(e) {
  // Handled in onDragEnd via elementFromPoint
}

function performDrop(targetCell) {
  const targetCellIndex = parseInt(targetCell.dataset.cellIndex);
  const { pieceId, sourceType, sourceIndex } = STATE.dragState;

  const existingPieceId = targetCell.dataset.pieceId !== undefined && targetCell.classList.contains('occupied')
    ? parseInt(targetCell.dataset.pieceId)
    : null;

  // If target has a piece → swap
  if (existingPieceId !== null && !isNaN(existingPieceId)) {
    const existingPiece = STATE.pieces.find(p => p.id === existingPieceId);
    const draggedPiece = STATE.pieces.find(p => p.id === pieceId);

    if (sourceType === 'grid' && sourceIndex !== null) {
      // Grid → Grid swap
      const sourceCell = document.querySelector(`.drop-cell[data-cell-index="${sourceIndex}"]`);

      draggedPiece.currentIndex = targetCellIndex;
      existingPiece.currentIndex = sourceIndex;

      renderPieceInCell(targetCell, pieceId);
      if (sourceCell) renderPieceInCell(sourceCell, existingPieceId);

    } else {
      // Tray → Grid (occupied): put existing piece in tray
      draggedPiece.currentIndex = targetCellIndex;
      existingPiece.currentIndex = null;

      renderPieceInCell(targetCell, pieceId);
      removeFromTray(pieceId);
      addToTray(existingPieceId);
    }
  } else {
    // Target cell is empty
    const draggedPiece = STATE.pieces.find(p => p.id === pieceId);

    if (sourceType === 'grid' && sourceIndex !== null) {
      // Grid → empty cell
      const sourceCell = document.querySelector(`.drop-cell[data-cell-index="${sourceIndex}"]`);
      if (sourceCell) {
        sourceCell.innerHTML = '';
        sourceCell.classList.remove('occupied');
        delete sourceCell.dataset.pieceId;
      }
    } else {
      // Tray → empty cell
      removeFromTray(pieceId);
    }

    draggedPiece.currentIndex = targetCellIndex;
    renderPieceInCell(targetCell, pieceId);
  }

  Audio.playDrop();
  refreshPieceCounter();
}

function returnPieceToTray(pieceId, sourceType, sourceIndex) {
  if (sourceType === 'grid' && sourceIndex !== null) {
    // Clear from grid cell
    const sourceCell = document.querySelector(`.drop-cell[data-cell-index="${sourceIndex}"]`);
    if (sourceCell) {
      sourceCell.innerHTML = '';
      sourceCell.classList.remove('occupied');
      delete sourceCell.dataset.pieceId;
    }
    const piece = STATE.pieces.find(p => p.id === pieceId);
    piece.currentIndex = null;
    addToTray(pieceId);
    refreshPieceCounter();
  }
  // If already in tray, nothing to do
}

function cancelDrag() {
  // Piece stays where it was — no action needed
}

function removeFromTray(pieceId) {
  const tray = DOM.piecesTray();
  const slot = tray.querySelector(`.tray-slot[data-piece-id="${pieceId}"]`);
  if (slot) slot.remove();
}

function addToTray(pieceId) {
  const tray = DOM.piecesTray();
  const slot = document.createElement('div');
  slot.className = 'tray-slot';
  slot.dataset.pieceId = pieceId;
  renderPieceInTray(slot, pieceId);
  tray.appendChild(slot);
}

function resetDragState() {
  Object.assign(STATE.dragState, {
    active: false,
    pieceId: null,
    sourceType: null,
    sourceIndex: null,
    ghost: null,
  });
}

function getEventPoint(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  if (e.changedTouches && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

/* ══════════════════════════════════════════
   ⑨ TIMER
══════════════════════════════════════════ */
function startTimer() {
  if (!CONFIG.SHOW_TIMER) {
    DOM.timerBlock().style.display = 'none';
    return;
  }
  STATE.timerSeconds = CONFIG.TIMER_SECONDS;
  updateTimerDisplay();
  clearInterval(STATE.timerInterval);
  STATE.timerInterval = setInterval(tickTimer, 1000);
}

function tickTimer() {
  if (!STATE.gameActive) return;
  STATE.timerSeconds--;
  updateTimerDisplay();

  if (STATE.timerSeconds <= 0) {
    clearInterval(STATE.timerInterval);
    onTimeOut();
  }
}

function updateTimerDisplay() {
  const mins = Math.floor(STATE.timerSeconds / 60).toString().padStart(2, '0');
  const secs = (STATE.timerSeconds % 60).toString().padStart(2, '0');
  const disp = DOM.timerDisplay();
  disp.textContent = `${mins}:${secs}`;

  disp.classList.remove('warning', 'danger');
  if (STATE.timerSeconds <= 10) {
    disp.classList.add('danger');
  } else if (STATE.timerSeconds <= 30) {
    disp.classList.add('warning');
  }
}

function stopTimer() {
  clearInterval(STATE.timerInterval);
}

function onTimeOut() {
  STATE.gameActive = false;
  Audio.playFail();
  showModal('timeout');
}

/* ══════════════════════════════════════════
   ⑩ VALIDATION
══════════════════════════════════════════ */
function validateSolution() {
  // All pieces must be placed and in correct cells
  for (const piece of STATE.pieces) {
    if (piece.currentIndex !== piece.correctIndex) return false;
  }
  return true;
}

function onSubmit() {
  if (!STATE.gameActive) return;
  Audio.playClick();

  const correct = validateSolution();
  if (correct) {
    stopTimer();
    STATE.gameActive = false;
    DOM.hintText().textContent = CONFIG.HINT_TEXT;
    Audio.playSuccess();
    spawnConfetti();
    setTimeout(() => showModal('success'), 200);
  } else {
    Audio.playFail();
    showModal('failure');
  }
}

/* ══════════════════════════════════════════
   ⑪ MODAL
══════════════════════════════════════════ */
function showModal(type) {
  const overlay = DOM.resultModal();
  DOM.successContent().style.display = 'none';
  DOM.failureContent().style.display = 'none';
  DOM.timeoutContent().style.display = 'none';

  if (type === 'success')  DOM.successContent().style.display = '';
  if (type === 'failure')  DOM.failureContent().style.display = '';
  if (type === 'timeout')  DOM.timeoutContent().style.display = '';

  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
}

function hideModal() {
  const overlay = DOM.resultModal();
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
}

/* ══════════════════════════════════════════
   ⑫ CONFETTI
══════════════════════════════════════════ */
function spawnConfetti() {
  const symbols = ['✦', '★', '✧', '◆', '⬡', '✺', '✻'];
  const colors  = ['#00f5ff', '#3d8eff', '#a855f7', '#ffd700', '#10ffc4'];
  const count = 40;

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti-star';
      el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      el.style.cssText = `
        left: ${Math.random() * 100}vw;
        top: -20px;
        color: ${colors[Math.floor(Math.random() * colors.length)]};
        animation-duration: ${1.5 + Math.random() * 2}s;
        animation-delay: 0s;
        font-size: ${10 + Math.random() * 14}px;
      `;
      document.body.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }, i * 60);
  }
}

/* ══════════════════════════════════════════
   ⑬ SCREEN TRANSITIONS
══════════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
    // Scroll to top
    if (target.id === 'gameScreen') target.scrollTop = 0;
  }
}

/* ══════════════════════════════════════════
   ⑭ IMAGE PRELOAD
══════════════════════════════════════════ */
function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Fallback: create a placeholder canvas image
      resolve(createFallbackImage());
    };
    img.src = src;
  });
}

function createFallbackImage() {
  // Generate a beautiful constellation-like canvas image as fallback
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Background
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#020816');
  bg.addColorStop(0.5, '#081428');
  bg.addColorStop(1, '#04101e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Nebula glow
  const nebs = [
    { x: 0.3, y: 0.4, r: 0.3, c: 'rgba(61,142,255,0.15)' },
    { x: 0.7, y: 0.6, r: 0.25, c: 'rgba(168,85,247,0.1)' },
    { x: 0.5, y: 0.2, r: 0.2, c: 'rgba(0,245,255,0.08)' },
  ];
  nebs.forEach(n => {
    const g = ctx.createRadialGradient(n.x*size, n.y*size, 0, n.x*size, n.y*size, n.r*size);
    g.addColorStop(0, n.c);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });

  // Stars
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.5 + 0.3;
    const a = Math.random() * 0.8 + 0.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,230,255,${a})`;
    ctx.fill();
  }

  // Constellation lines & key stars
  const conStars = [
    [0.2, 0.3], [0.35, 0.25], [0.5, 0.35], [0.65, 0.28],
    [0.75, 0.45], [0.6, 0.55], [0.45, 0.62], [0.3, 0.58],
    [0.55, 0.75], [0.4, 0.8],  [0.7, 0.72], [0.15, 0.65],
  ];

  const lines = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[2,5],[6,8],[8,9],[5,10]];

  ctx.strokeStyle = 'rgba(0,245,255,0.25)';
  ctx.lineWidth = 0.8;
  lines.forEach(([a, b]) => {
    ctx.beginPath();
    ctx.moveTo(conStars[a][0]*size, conStars[a][1]*size);
    ctx.lineTo(conStars[b][0]*size, conStars[b][1]*size);
    ctx.stroke();
  });

  const starColors = ['rgba(0,245,255,', 'rgba(200,230,255,', 'rgba(168,85,247,'];
  conStars.forEach(([sx, sy], i) => {
    const c = starColors[i % starColors.length];
    const r = 3 + (i % 3);
    // Glow
    const sg = ctx.createRadialGradient(sx*size, sy*size, 0, sx*size, sy*size, r*4);
    sg.addColorStop(0, c + '0.6)');
    sg.addColorStop(1, 'transparent');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sx*size, sy*size, r*4, 0, Math.PI * 2);
    ctx.fill();
    // Core
    ctx.beginPath();
    ctx.arc(sx*size, sy*size, r, 0, Math.PI * 2);
    ctx.fillStyle = c + '1)';
    ctx.fill();
  });

  // Convert to data URL and return fake img
  const img = new Image();
  img.src = canvas.toDataURL();
  CONFIG.IMAGE_SRC = img.src; // Override src to data URL
  return img;
}

/* ══════════════════════════════════════════
   ⑮ GAME INIT / START / RESTART
══════════════════════════════════════════ */
function startGame() {
  STATE.gameActive = false;
  stopTimer();
  hideModal();

  const btn = DOM.startBtn();
  btn.disabled = true;
  btn.querySelector('.btn-text').textContent = 'Loading…';

  showScreen('gameScreen');

  preloadImage(CONFIG.IMAGE_SRC).then(() => {
    STATE.pieces = shufflePieces(createPieces(STATE.gridSize));

    buildGrid();

    // Wait a frame for layout, then size pieces
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        buildTray();
        refreshPieceCounter();
        STATE.gameActive = true;
        startTimer();

        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Launch Puzzle';
      });
    });
  });
}

function restartGame() {
  hideModal();
  STATE.gameActive = false;
  stopTimer();

  // Re-init
  STATE.pieces = shufflePieces(createPieces(STATE.gridSize));
  buildGrid();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      buildTray();
      refreshPieceCounter();
      STATE.gameActive = true;
      startTimer();
    });
  });
}

function goToLanding() {
  hideModal();
  STATE.gameActive = false;
  stopTimer();
  showScreen('landingScreen');
}

/* ══════════════════════════════════════════
   ⑯ RESIZE HANDLING
══════════════════════════════════════════ */
let resizeTimer = null;

function onResize() {
  if (!STATE.gameActive) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    // Re-render all placed pieces with new sizes
    const cells = document.querySelectorAll('.drop-cell.occupied');
    cells.forEach(cell => {
      const pieceId = parseInt(cell.dataset.pieceId);
      if (!isNaN(pieceId)) {
        renderPieceInCell(cell, pieceId);
      }
    });
    // Re-render tray pieces
    const traySlots = document.querySelectorAll('.tray-slot');
    traySlots.forEach(slot => {
      const pieceId = parseInt(slot.dataset.pieceId);
      if (!isNaN(pieceId)) {
        renderPieceInTray(slot, pieceId);
      }
    });
  }, 150);
}

/* ══════════════════════════════════════════
   ⑰ BOOT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  // Star field
  StarField.init();

  // Difficulty buttons
  DOM.diffBtns().forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.diffBtns().forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.gridSize = parseInt(btn.dataset.grid);
      CONFIG.GRID_SIZE = STATE.gridSize;
    });
  });

  // Start
  DOM.startBtn().addEventListener('click', () => {
    Audio.playClick();
    startGame();
  });

  // Submit
  DOM.submitBtn().addEventListener('click', onSubmit);

  // Restart (top bar)
  DOM.restartBtn().addEventListener('click', () => {
    Audio.playClick();
    restartGame();
  });

  // Modal buttons
  DOM.playAgainBtn().addEventListener('click', () => {
    Audio.playClick();
    goToLanding();
  });
  DOM.retryBtn().addEventListener('click', () => {
    Audio.playClick();
    hideModal();
  });
  DOM.timeoutRetryBtn().addEventListener('click', () => {
    Audio.playClick();
    restartGame();
  });

  // Resize
  window.addEventListener('resize', onResize, { passive: true });

  // Prevent scroll bounce on iOS during drag
  document.body.addEventListener('touchmove', e => {
    if (STATE.dragState.active) e.preventDefault();
  }, { passive: false });

  // Show landing
  showScreen('landingScreen');
});