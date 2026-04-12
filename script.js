/**
 * script.js — Snakes & Ladders Frontend Logic
 *
 * Responsibilities:
 *  1. Render the 10×10 board dynamically
 *  2. Draw snake/ladder SVG lines on a canvas overlay
 *  3. Fetch game state from Flask API
 *  4. Handle Roll / Reset / BFS actions
 *  5. Animate player movement and events
 */

// ── Config ──────────────────────────────────────────────────────
const API_BASE = "http://127.0.0.1:5000";

// Dice emoji map: roll value → emoji face
const DICE_EMOJI = {
  1: "⚀", 2: "⚁", 3: "⚂",
  4: "⚃", 5: "⚄", 6: "⚅"
};

// Confetti palette
const CONFETTI_COLORS = [
  "#ff6b6b","#ffd43b","#51cf66","#4dabf7","#cc5de8","#ff8787","#a9e34b"
];

// ── State ───────────────────────────────────────────────────────
let currentPosition = 0;
let snakesMap  = {};  // {head: tail}
let laddersMap = {};  // {bottom: top}

// ── DOM References ──────────────────────────────────────────────
const boardEl       = document.getElementById("board");
const boardSvg      = document.getElementById("board-svg");
const rollBtn       = document.getElementById("roll-btn");
const diceDisplay   = document.getElementById("dice-display");
const diceNumber    = document.getElementById("dice-number");
const statusMsg     = document.getElementById("status-message");
const winModal      = document.getElementById("win-modal");
const winMessage    = document.getElementById("win-message");
const bfsCard       = document.getElementById("bfs-card");
const bfsResult     = document.getElementById("bfs-result");
const snakeListEl   = document.getElementById("snake-list");
const ladderListEl  = document.getElementById("ladder-list");
const statRolls     = document.getElementById("stat-rolls");
const statSnakes    = document.getElementById("stat-snakes");
const statLadders   = document.getElementById("stat-ladders");
const statPosition  = document.getElementById("stat-position");


// ══════════════════════════════════════════════════════════════════
// Board Rendering
// ══════════════════════════════════════════════════════════════════

/**
 * Build the visual 10×10 board.
 * The real board numbers snake row-by-row:
 *   Row 0 (bottom):  1–10 left→right
 *   Row 1:          11–20 right→left
 *   Row 2:          21–30 left→right  …etc.
 * We render from top (row 9) down to match visual layout.
 */
function renderBoard(snakes, ladders) {
  snakesMap  = snakes;
  laddersMap = ladders;

  boardEl.innerHTML = "";

  // Build a 10×10 array of cell numbers (top row = cells 91-100)
  const rows = [];
  for (let row = 9; row >= 0; row--) {
    const nums = [];
    for (let col = 0; col < 10; col++) {
      // Even rows (from bottom, 0-indexed): left→right
      // Odd rows: right→left
      const num = row * 10 + (row % 2 === 0 ? col + 1 : 10 - col);
      nums.push(num);
    }
    rows.push(nums);
  }

  rows.forEach((rowNums) => {
    rowNums.forEach((num) => {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      cell.id = `cell-${num}`;
      cell.dataset.num = num;

      // Number label
      const numSpan = document.createElement("span");
      numSpan.className = "cell-number";
      numSpan.textContent = num;
      cell.appendChild(numSpan);

      // Mark snake heads
      if (snakes[num] !== undefined) {
        cell.classList.add("has-snake");
        const icon = document.createElement("span");
        icon.className = "cell-icon";
        icon.textContent = "🐍";
        cell.appendChild(icon);
      }

      // Mark ladder bottoms
      if (ladders[num] !== undefined) {
        cell.classList.add("has-ladder");
        const icon = document.createElement("span");
        icon.className = "cell-icon";
        icon.textContent = "🪜";
        cell.appendChild(icon);
      }

      boardEl.appendChild(cell);
    });
  });

  // Draw SVG connectors after DOM settles
  requestAnimationFrame(() => {
    drawConnectors(snakes, ladders);
    populateSidePanels(snakes, ladders);
  });
}

/**
 * Return the center {x, y} pixel coordinates of a cell element,
 * relative to the board container.
 */
function cellCenter(cellNum) {
  const cell   = document.getElementById(`cell-${cellNum}`);
  const board  = boardEl.getBoundingClientRect();
  const rect   = cell.getBoundingClientRect();
  return {
    x: rect.left - board.left + rect.width  / 2,
    y: rect.top  - board.top  + rect.height / 2,
  };
}

/**
 * Draw SVG lines connecting snake heads→tails and ladder bottoms→tops.
 * Snakes: dashed red curve | Ladders: solid green line
 */
function drawConnectors(snakes, ladders) {
  boardSvg.innerHTML = "";

  // Helper: create an SVG element with attributes
  function svgEl(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  // Draw ladders (green solid lines with circles at ends)
  Object.entries(ladders).forEach(([bottom, top]) => {
    const b = cellCenter(+bottom);
    const t = cellCenter(+top);

    // Line
    boardSvg.appendChild(svgEl("line", {
      x1: b.x, y1: b.y, x2: t.x, y2: t.y,
      stroke: "#51cf66", "stroke-width": 3,
      "stroke-dasharray": "6 3",
      "stroke-linecap": "round",
      opacity: 0.75,
    }));
    // End dots
    [b, t].forEach(pt => {
      boardSvg.appendChild(svgEl("circle", {
        cx: pt.x, cy: pt.y, r: 4,
        fill: "#51cf66", opacity: 0.9,
      }));
    });
  });

  // Draw snakes (red curved paths)
  Object.entries(snakes).forEach(([head, tail]) => {
    const h = cellCenter(+head);
    const t = cellCenter(+tail);

    // Cubic bezier control points for a wiggle
    const midX = (h.x + t.x) / 2;
    const midY = (h.y + t.y) / 2;
    const cx1 = midX + 30, cy1 = midY - 30;
    const cx2 = midX - 30, cy2 = midY + 30;

    const d = `M ${h.x} ${h.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${t.x} ${t.y}`;
    boardSvg.appendChild(svgEl("path", {
      d, fill: "none",
      stroke: "#ff6b6b", "stroke-width": 3,
      "stroke-dasharray": "8 4",
      "stroke-linecap": "round",
      opacity: 0.75,
    }));
    // Head dot
    boardSvg.appendChild(svgEl("circle", {
      cx: h.x, cy: h.y, r: 5,
      fill: "#ff6b6b", opacity: 0.9,
    }));
  });
}

/**
 * Populate the snake/ladder reference lists in the right panel.
 */
function populateSidePanels(snakes, ladders) {
  snakeListEl.innerHTML = "";
  Object.entries(snakes)
    .sort(([a], [b]) => +b - +a)
    .forEach(([head, tail]) => {
      snakeListEl.insertAdjacentHTML("beforeend", `
        <div class="ref-item snake-ref">
          <span>🐍 ${head}</span>
          <span class="ref-arrow">→</span>
          <span>${tail}</span>
        </div>`);
    });

  ladderListEl.innerHTML = "";
  Object.entries(ladders)
    .sort(([a], [b]) => +a - +b)
    .forEach(([bottom, top]) => {
      ladderListEl.insertAdjacentHTML("beforeend", `
        <div class="ref-item ladder-ref">
          <span>🪜 ${bottom}</span>
          <span class="ref-arrow">→</span>
          <span>${top}</span>
        </div>`);
    });
}


// ══════════════════════════════════════════════════════════════════
// Player Marker
// ══════════════════════════════════════════════════════════════════

/**
 * Move the player marker DOM element to the given cell.
 * Removes existing marker first.
 */
function placePlayer(cellNum) {
  // Remove old marker
  const old = document.querySelector(".player-marker");
  if (old) old.remove();

  if (cellNum === 0) return;  // off-board — no marker

  const cell = document.getElementById(`cell-${cellNum}`);
  if (!cell) return;

  const marker = document.createElement("div");
  marker.className = "player-marker";
  marker.textContent = "🧑";
  cell.appendChild(marker);

  cell.classList.add("has-player", "landing-flash");
  setTimeout(() => cell.classList.remove("landing-flash"), 700);
}

/**
 * Highlight / un-highlight a cell.
 */
function clearPlayerHighlight() {
  document.querySelectorAll(".has-player").forEach(el => {
    el.classList.remove("has-player");
  });
}


// ══════════════════════════════════════════════════════════════════
// UI Helpers
// ══════════════════════════════════════════════════════════════════

/** Update the dice display (emoji + number). */
function updateDice(value) {
  diceDisplay.classList.remove("rolling");
  void diceDisplay.offsetWidth; // reflow to restart animation
  diceDisplay.classList.add("rolling");
  diceDisplay.textContent = DICE_EMOJI[value] || "🎲";
  diceNumber.textContent = value;
}

/** Update the status text with styling class. */
function updateStatus(text, cls = "") {
  statusMsg.textContent = text;
  statusMsg.className = "status-message " + cls;
}

/** Update the stats panel. */
function updateStats(data) {
  statRolls.textContent    = data.total_rolls    ?? 0;
  statSnakes.textContent   = data.snakes_hit     ?? 0;
  statLadders.textContent  = data.ladders_used   ?? 0;
  statPosition.textContent = data.position       ?? 0;
}


// ══════════════════════════════════════════════════════════════════
// Win Modal + Confetti
// ══════════════════════════════════════════════════════════════════

function showWinModal(rolls) {
  winMessage.textContent =
    `You reached 100 in ${rolls} roll${rolls === 1 ? "" : "s"}! 🎉`;
  launchConfetti();
  winModal.classList.add("show");
  rollBtn.disabled = true;
}

function hideWinModal() {
  winModal.classList.remove("show");
}

/** Spawn colourful falling confetti pieces inside the modal. */
function launchConfetti() {
  const container = document.getElementById("confetti-container");
  container.innerHTML = "";
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]};
      --dur: ${1.2 + Math.random() * 1.5}s;
      --delay: ${Math.random() * 0.8}s;
      transform: rotate(${Math.random() * 360}deg);
      border-radius: ${Math.random() > 0.5 ? "50%" : "2px"};
    `;
    container.appendChild(piece);
  }
}


// ══════════════════════════════════════════════════════════════════
// API Calls
// ══════════════════════════════════════════════════════════════════

/**
 * Roll dice — GET /roll
 * Handles all events: normal, snake, ladder, blocked, win.
 */
async function rollDice() {
  rollBtn.disabled = true;

  try {
    const res  = await fetch(`${API_BASE}/roll`);
    const data = await res.json();

    // Dice animation
    if (data.dice !== undefined) {
      updateDice(data.dice);
    }

    // Remove old player highlight
    clearPlayerHighlight();

    // Place player at new position
    currentPosition = data.position;
    placePlayer(currentPosition);

    // Status message
    if (data.status === "win") {
      updateStatus("🏆 You reached 100! You WIN!", "win");
      updateStats(data);
      setTimeout(() => showWinModal(data.total_rolls), 600);
      return; // keep button disabled
    }

    if (data.blocked) {
      updateStatus(`🚫 Rolled ${data.dice} — would go past 100. Stay put!`, "blocked");
    } else {
      const lastMove = data.dice !== undefined
        ? buildStatusMessage(data)
        : "Keep rolling!";
      updateStatus(lastMove);
    }

    updateStats(data);
  } catch (err) {
    updateStatus("⚠️ Cannot reach server. Is Flask running on port 5000?", "blocked");
    console.error(err);
  } finally {
    if (rollBtn.disabled) {
      rollBtn.disabled = false;
    }
  }
}

/** Build a human-readable status string based on the move result. */
function buildStatusMessage(data) {
  const from = data.old_position ?? 0;
  const to   = data.position;
  const dice = data.dice;

  if (snakesMap[from + dice] !== undefined && from + dice !== to) {
    return `🎲 Rolled ${dice}. 🐍 Snake! ${from + dice} → ${to}`;
  }
  if (laddersMap[from + dice] !== undefined && from + dice !== to) {
    return `🎲 Rolled ${dice}. 🪜 Ladder! ${from + dice} → ${to}`;
  }
  return `🎲 Rolled ${dice}. Moved to cell ${to}.`;
}

/**
 * Reset game — GET /reset
 */
async function resetGame() {
  hideWinModal();
  rollBtn.disabled = false;

  try {
    const res  = await fetch(`${API_BASE}/reset`);
    const data = await res.json();

    currentPosition = 0;
    clearPlayerHighlight();
    const old = document.querySelector(".player-marker");
    if (old) old.remove();

    updateStatus("Press Roll to start!");
    updateStats({ total_rolls: 0, snakes_hit: 0, ladders_used: 0, position: 0 });
    diceDisplay.textContent = "🎲";
    diceNumber.textContent  = "–";

    // Re-render board with fresh snake/ladder data from server
    if (data.snakes && data.ladders) {
      renderBoard(data.snakes, data.ladders);
    }

    bfsCard.style.display = "none";
  } catch (err) {
    updateStatus("⚠️ Cannot reach server. Is Flask running on port 5000?", "blocked");
    console.error(err);
  }
}

/**
 * BFS endpoint — GET /min-rolls
 */
async function fetchMinRolls() {
  bfsResult.textContent = "Calculating…";
  bfsCard.style.display = "block";

  try {
    const res  = await fetch(`${API_BASE}/min-rolls`);
    const data = await res.json();

    bfsResult.innerHTML = `
      <span class="bfs-number">${data.min_rolls}</span>
      <span style="font-size:0.82rem;color:var(--text-secondary);">${data.explanation}</span>
    `;
  } catch (err) {
    bfsResult.textContent = "⚠️ Server unavailable.";
    console.error(err);
  }
}


// ══════════════════════════════════════════════════════════════════
// Initial Load
// ══════════════════════════════════════════════════════════════════

/**
 * On page load, fetch the current game state from the server.
 * This initialises the board with the correct snake/ladder config.
 */
async function init() {
  try {
    const res  = await fetch(`${API_BASE}/state`);
    const data = await res.json();

    renderBoard(data.snakes, data.ladders);
    currentPosition = data.position;
    placePlayer(currentPosition);
    updateStats(data);

    if (data.status === "win") {
      rollBtn.disabled = true;
      updateStatus("🏆 Previous game won! Click 'New Game'.", "win");
    }
  } catch (err) {
    // Server might not be running yet — render a default board
    console.warn("Backend not reachable — rendering default board layout.");
    renderBoard(
      {99:21,95:75,87:24,62:19,54:34,46:5,17:7},
      {4:25,13:46,33:49,42:63,50:69,74:92,85:95}
    );
    updateStatus("⚠️ Start the Flask server, then refresh.", "blocked");
  }
}

// Redraw SVG connectors when window resizes (board size changes)
window.addEventListener("resize", () => {
  if (Object.keys(snakesMap).length) {
    drawConnectors(snakesMap, laddersMap);
  }
});

// Boot
init();

// ══════════════════════════════════════════════════════════════════
// ENHANCED ADDITIONS
// ══════════════════════════════════════════════════════════════════

// ── Sound engine (Web Audio API) ────────────────────────────────
let audioCtx = null;
let soundEnabled = true;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, type = 'sine', duration = 0.15, gain = 0.2) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    vol.gain.setValueAtTime(gain, ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}

function playDiceRollSound() {
  if (!soundEnabled) return;
  [200, 250, 300, 200, 350].forEach((f, i) => {
    setTimeout(() => playTone(f, 'square', 0.08, 0.12), i * 60);
  });
}

function playSnakeSound() {
  if (!soundEnabled) return;
  [440, 380, 320, 260, 200].forEach((f, i) => {
    setTimeout(() => playTone(f, 'sawtooth', 0.18, 0.15), i * 80);
  });
}

function playLadderSound() {
  if (!soundEnabled) return;
  [300, 400, 500, 650, 800].forEach((f, i) => {
    setTimeout(() => playTone(f, 'sine', 0.15, 0.15), i * 70);
  });
}

function playWinSound() {
  if (!soundEnabled) return;
  const melody = [523, 659, 784, 1047, 784, 1047, 1319];
  melody.forEach((f, i) => {
    setTimeout(() => playTone(f, 'sine', 0.22, 0.2), i * 120);
  });
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('sound-btn');
  if (soundEnabled) {
    btn.innerHTML = '<span class="btn-icon">🔊</span> Sound: On';
    btn.classList.remove('muted');
  } else {
    btn.innerHTML = '<span class="btn-icon">🔇</span> Sound: Off';
    btn.classList.add('muted');
  }
}

// ── Particle canvas background ───────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx2d = canvas.getContext('2d');

  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  class Particle {
    constructor() { this.reset(true); }
    reset(init) {
      this.x    = Math.random() * W;
      this.y    = init ? Math.random() * H : H + 5;
      this.vy   = -(0.2 + Math.random() * 0.5);
      this.vx   = (Math.random() - 0.5) * 0.3;
      this.r    = 1 + Math.random() * 2;
      this.alpha= 0.2 + Math.random() * 0.5;
      const palette = ['#cc5de8','#4dabf7','#51cf66','#ff6b6b','#ffd43b'];
      this.color = palette[Math.floor(Math.random() * palette.length)];
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.y < -5) this.reset(false);
    }
    draw() {
      ctx2d.globalAlpha = this.alpha;
      ctx2d.fillStyle   = this.color;
      ctx2d.beginPath();
      ctx2d.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx2d.fill();
    }
  }

  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < 60; i++) particles.push(new Particle());

  function loop() {
    ctx2d.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    ctx2d.globalAlpha = 1;
    requestAnimationFrame(loop);
  }
  loop();
})();

// ── Progress bar ─────────────────────────────────────────────────
function injectProgressBar() {
  const boardSection = document.querySelector('.board-section');
  if (!boardSection || document.getElementById('progress-wrap')) return;
  const wrap = document.createElement('div');
  wrap.className = 'progress-wrap';
  wrap.id = 'progress-wrap';
  wrap.innerHTML = '<div class="progress-bar" id="progress-bar"></div>';
  boardSection.insertBefore(wrap, boardSection.firstChild);
}

function updateProgressBar(position) {
  const bar = document.getElementById('progress-bar');
  if (bar) bar.style.width = Math.max(0, Math.min(100, position)) + '%';
}

// ── Toast notification ───────────────────────────────────────────
let toastTimer = null;

function injectToast() {
  if (document.getElementById('event-toast')) return;
  const toast = document.createElement('div');
  toast.id = 'event-toast';
  document.body.appendChild(toast);
}

function showToast(text, type = '') {
  injectToast();
  const toast = document.getElementById('event-toast');
  toast.textContent = text;
  toast.className = 'show' + (type ? ' toast-' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = '';
  }, 1800);
}

// ── Move history ─────────────────────────────────────────────────
let moveHistory = [];

function addHistoryItem(dice, from, to, type) {
  const histEl  = document.getElementById('history-list');
  if (!histEl) return;

  const empty = histEl.querySelector('.history-empty');
  if (empty) empty.remove();

  const emoji = { snake: '🐍', ladder: '🪜', normal: '➡️', blocked: '🚫', win: '🏆' }[type] || '➡️';

  const item = document.createElement('div');
  item.className = `history-item type-${type}`;
  item.innerHTML = `
    <span class="history-roll">${dice === null ? '—' : dice}</span>
    <span class="history-move">${emoji} ${from} → ${to}</span>
    <span class="history-num">#${moveHistory.length + 1}</span>
  `;
  histEl.insertBefore(item, histEl.firstChild);
  moveHistory.push({ dice, from, to, type });

  // Keep only last 20
  while (histEl.children.length > 20) histEl.removeChild(histEl.lastChild);
}

function clearHistory() {
  moveHistory = [];
  const histEl = document.getElementById('history-list');
  if (histEl) histEl.innerHTML = '<div class="history-empty">No moves yet</div>';
}

// ── Streak tracker ────────────────────────────────────────────────
let ladderStreak = 0;

function updateStreak(type) {
  if (type === 'ladder') {
    ladderStreak++;
  } else if (type === 'snake' || type === 'normal') {
    ladderStreak = 0;
  }

  const countEl = document.getElementById('streak-count');
  const barEl   = document.getElementById('streak-bar');
  if (!countEl || !barEl) return;

  countEl.textContent = ladderStreak;
  countEl.classList.remove('bump');
  void countEl.offsetWidth;
  if (ladderStreak > 0) countEl.classList.add('bump');

  const maxStreak = 5;
  barEl.style.width = Math.min(100, (ladderStreak / maxStreak) * 100) + '%';
}

// ── Player trail ──────────────────────────────────────────────────
let trailPositions = [];

function updateTrail(pos) {
  // Remove old trail dots
  document.querySelectorAll('.trail-dot').forEach(d => d.remove());

  trailPositions.push(pos);
  if (trailPositions.length > 5) trailPositions.shift();

  trailPositions.forEach((p, i) => {
    if (p === 0 || p === pos) return;
    const cell = document.getElementById(`cell-${p}`);
    if (!cell) return;
    const dot = document.createElement('div');
    dot.className = 'trail-dot';
    dot.style.opacity = (i + 1) / trailPositions.length * 0.6;
    cell.appendChild(dot);
  });
}

// ── Tooltip data on cells ─────────────────────────────────────────
function addCellTooltips(snakes, ladders) {
  Object.entries(snakes).forEach(([head, tail]) => {
    const cell = document.getElementById(`cell-${head}`);
    if (cell) cell.setAttribute('data-tip', `🐍 Snake → ${tail}`);
  });
  Object.entries(ladders).forEach(([bottom, top]) => {
    const cell = document.getElementById(`cell-${bottom}`);
    if (cell) cell.setAttribute('data-tip', `🪜 Ladder → ${top}`);
  });
}

// ── Badge for consecutive same-dice rolls ─────────────────────────
let lastDice = null;
let sameCount = 0;

function updateDiceBadge(value) {
  if (value === lastDice) {
    sameCount++;
  } else {
    sameCount = 1;
    lastDice = value;
  }
  const badge = document.querySelector('.dice-streak-badge');
  if (!badge) return;
  if (sameCount >= 2) {
    badge.textContent = `×${sameCount} streak!`;
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}

function injectDiceBadge() {
  const diceCard = document.querySelector('.dice-card');
  if (!diceCard || diceCard.querySelector('.dice-streak-badge')) return;
  const badge = document.createElement('div');
  badge.className = 'dice-streak-badge';
  diceCard.insertBefore(badge, diceCard.firstChild);
}

// ── Win modal star burst ───────────────────────────────────────────
function addModalStars() {
  const modal = document.querySelector('.modal-box');
  if (!modal || modal.querySelector('.modal-stars')) return;
  const stars = document.createElement('div');
  stars.className = 'modal-stars';
  const emojis = ['⭐','✨','🌟','💫','⭐','✨'];
  const positions = [
    {top:'8%', left:'6%'}, {top:'12%', right:'8%'},
    {top:'55%', left:'4%'}, {top:'60%', right:'5%'},
    {bottom:'12%', left:'10%'}, {bottom:'10%', right:'10%'},
  ];
  positions.forEach((pos, i) => {
    const star = document.createElement('span');
    star.className = 'modal-star';
    star.textContent = emojis[i % emojis.length];
    star.style.cssText = Object.entries(pos).map(([k,v]) => `${k}:${v}`).join(';');
    star.style.setProperty('--dur', (1.5 + Math.random()) + 's');
    star.style.setProperty('--delay', (Math.random() * 0.8) + 's');
    stars.appendChild(star);
  });
  modal.insertBefore(stars, modal.firstChild);
}

// ── Keyboard shortcut (Space = roll) ─────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
    const btn = document.getElementById('roll-btn');
    if (btn && !btn.disabled) rollDice();
  }
  if (e.code === 'KeyR' && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
    resetGame();
  }
});

// ── Patch rollDice to add enhancements ───────────────────────────
const _origRollDice = rollDice;
window.rollDice = async function() {
  playDiceRollSound();
  await _origRollDice();
};

// ── Patch placePlayer for trail + progress ────────────────────────
const _origPlacePlayer = placePlayer;
window.placePlayer = function(cellNum) {
  updateTrail(currentPosition);
  updateProgressBar(cellNum);
  _origPlacePlayer(cellNum);
};

// ── Hook into fetch responses via patching updateStats ─────────────
const _origUpdateStats = updateStats;
window.updateStats = function(data) {
  _origUpdateStats(data);
};

// ── Patch buildStatusMessage to inject toast + sounds + history ───
const _origBuildStatus = buildStatusMessage;
window.buildStatusMessage = function(data) {
  const from = data.old_position ?? 0;
  const to   = data.position;
  const dice = data.dice;
  const landedOn = from + dice;

  let type = 'normal';
  if (snakesMap[landedOn] !== undefined && landedOn !== to) {
    type = 'snake';
    playSnakeSound();
    showToast('🐍 Bitten by a snake!', 'snake');
    const cell = document.getElementById(`cell-${landedOn}`);
    if (cell) { cell.classList.add('snake-event'); setTimeout(() => cell.classList.remove('snake-event'), 800); }
  } else if (laddersMap[landedOn] !== undefined && landedOn !== to) {
    type = 'ladder';
    playLadderSound();
    showToast('🪜 Climbed a ladder!', 'ladder');
    const cell = document.getElementById(`cell-${landedOn}`);
    if (cell) { cell.classList.add('ladder-event'); setTimeout(() => cell.classList.remove('ladder-event'), 800); }
  }

  updateDiceBadge(dice);
  updateStreak(type);
  addHistoryItem(dice, from, to, type);

  return _origBuildStatus(data);
};

// ── Patch showWinModal ─────────────────────────────────────────────
const _origShowWinModal = showWinModal;
window.showWinModal = function(rolls) {
  playWinSound();
  showToast('🏆 You Win!', 'win');
  addModalStars();
  addHistoryItem('—', currentPosition, 100, 'win');
  _origShowWinModal(rolls);
};

// ── Patch resetGame to clear local state ──────────────────────────
const _origResetGame = resetGame;
window.resetGame = async function() {
  trailPositions = [];
  ladderStreak = 0;
  lastDice = null;
  sameCount = 0;
  clearHistory();
  updateStreak('reset');
  updateProgressBar(0);
  document.querySelectorAll('.trail-dot').forEach(d => d.remove());
  await _origResetGame();
  addCellTooltips(snakesMap, laddersMap);
};

// ── Patch renderBoard to add tooltips ─────────────────────────────
const _origRenderBoard = renderBoard;
window.renderBoard = function(snakes, ladders) {
  _origRenderBoard(snakes, ladders);
  requestAnimationFrame(() => addCellTooltips(snakes, ladders));
};

// ── Init enhancements ─────────────────────────────────────────────
(function initEnhancements() {
  injectProgressBar();
  injectDiceBadge();
  injectToast();

  // Add keyboard hint to roll button
  const rollBtn2 = document.getElementById('roll-btn');
  if (rollBtn2) {
    rollBtn2.innerHTML += ' <span class="kbd-hint">Space</span>';
  }
})();
