(() => {
  const HELP_KEY = "tb-flood-seen-help";
  const BEST_KEY = "tb-flood-best";
  const NUM_COLORS = 5;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  const boardEl = document.getElementById("board");
  const paletteEl = document.getElementById("palette");
  const movesEl = document.getElementById("moves");
  const maxMovesEl = document.getElementById("max-moves");
  const leftEl = document.getElementById("left");
  const bestEl = document.getElementById("best");
  const meterFillEl = document.getElementById("meter-fill");
  const meterNoteEl = document.getElementById("meter-note");
  const hintEl = document.getElementById("hint");
  const toastEl = document.getElementById("toast");
  const howModal = document.getElementById("how-modal");
  const endModal = document.getElementById("end-modal");

  let ROWS = 8;
  let COLS = 8;
  let MAX_MOVES = 16;
  let board = [];
  let moves = 0;
  let ended = false;
  let rng = Math.random;
  const storedBest = localStorage.getItem(BEST_KEY);
  let best = storedBest == null ? -1 : Number(storedBest);

  function applyLayout() {
    const phone = TB.isPhone();
    ROWS = phone ? 8 : 12;
    COLS = phone ? 8 : 12;
    MAX_MOVES = phone ? 16 : 22;
    boardEl.style.setProperty("--cols", String(COLS));
    boardEl.style.setProperty("--rows", String(ROWS));
  }

  function connected(color) {
    const start = board[0][0];
    const want = color ?? start;
    const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const out = [];
    const queue = [[0, 0]];
    seen[0][0] = true;
    while (queue.length) {
      const [r, c] = queue.pop();
      if (board[r][c] !== want) continue;
      out.push([r, c]);
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS || seen[nr][nc]) continue;
        seen[nr][nc] = true;
        if (board[nr][nc] === want) queue.push([nr, nc]);
      }
    }
    return out;
  }

  function fillBoard() {
    board = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => 1 + Math.floor(rng() * NUM_COLORS))
    );
    moves = 0;
    ended = false;
  }

  function won() {
    const color = board[0][0];
    return board.every((row) => row.every((cell) => cell === color));
  }

  function render() {
    boardEl.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const el = document.createElement("div");
        el.className = `block c${board[r][c]}`;
        el.style.setProperty("--r", r);
        el.style.setProperty("--c", c);
        el.innerHTML = '<span class="face"></span>';
        boardEl.appendChild(el);
      }
    }

    const current = board[0][0];
    paletteEl.innerHTML = "";
    for (let color = 1; color <= NUM_COLORS; color++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `block c${color}${color === current ? " current" : ""}`;
      btn.innerHTML = '<span class="face"></span>';
      btn.setAttribute("aria-label", `Flood with color ${color}`);
      btn.addEventListener("click", () => paint(color));
      paletteEl.appendChild(btn);
    }
    updateHud();
  }

  function updateHud() {
    const left = Math.max(0, MAX_MOVES - moves);
    const pct = Math.min(100, Math.round((moves / MAX_MOVES) * 100));
    movesEl.textContent = String(moves);
    maxMovesEl.textContent = String(MAX_MOVES);
    leftEl.textContent = String(left);
    bestEl.textContent = best < 0 ? "—" : String(best);
    meterFillEl.style.width = `${pct}%`;
    meterFillEl.classList.toggle("hot", moves >= MAX_MOVES - 3);
    meterNoteEl.textContent = ended
      ? "Board done."
      : "Tap a color. The top-left region spreads.";
  }

  function paint(color) {
    if (ended || color === board[0][0]) return;
    const patch = connected();
    for (const [r, c] of patch) board[r][c] = color;
    moves += 1;
    render();
    if (won()) finish(true);
    else if (moves >= MAX_MOVES) finish(false);
  }

  function starsFor(win, leftover) {
    if (!win) return 0;
    if (leftover >= 5) return 3;
    if (leftover >= 2) return 2;
    return 1;
  }

  function finish(win) {
    ended = true;
    const leftover = Math.max(0, MAX_MOVES - moves);
    if (win && leftover > best) {
      best = leftover;
      localStorage.setItem(BEST_KEY, String(best));
    }
    const stars = starsFor(win, leftover);
    document.getElementById("end-kicker").textContent = win ? "Flooded" : "Out of moves";
    document.getElementById("end-title").textContent = win ? "One color." : "Almost.";
    document.getElementById("end-stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
    document.getElementById("end-stars").setAttribute("aria-label", `${stars} stars`);
    document.getElementById("end-moves").textContent = String(moves);
    document.getElementById("end-left").textContent = String(leftover);
    updateHud();
    endModal.hidden = false;
  }

  function newGame(daily) {
    endModal.hidden = true;
    rng = daily ? TB.mulberry32(TB.dailySeed() + 17) : Math.random;
    applyLayout();
    fillBoard();
    render();
    hintEl.textContent = "Tap a color to flood from the top-left.";
    if (daily) TB.toast(toastEl, "Daily board");
  }

  document.getElementById("how-btn").addEventListener("click", () => {
    howModal.hidden = false;
  });
  document.getElementById("how-next").addEventListener("click", () => {
    howModal.hidden = true;
    localStorage.setItem(HELP_KEY, "1");
  });
  document.getElementById("new-btn").addEventListener("click", () => newGame(false));
  document.getElementById("daily-btn").addEventListener("click", () => newGame(true));
  document.getElementById("again-btn").addEventListener("click", () => newGame(false));

  newGame(false);
  if (!localStorage.getItem(HELP_KEY)) howModal.hidden = false;
})();
