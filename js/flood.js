(() => {
  const HELP_KEY = "tb-flood-seen-help";
  const BEST_KEY = "tb-flood-run-best";
  const MAX_CHARGES = 3;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const STYLES = ["blobs", "blobs", "mixed", "mixed", "speckled", "stripes", "islands", "speckled", "stripes", "islands"];
  const STYLE_NOTE = {
    blobs: "Big patches. Plan two colors ahead.",
    mixed: "A mix of blobs and speckles.",
    speckled: "Noisy board. Don't chase tiny islands.",
    stripes: "Bands with ragged edges.",
    islands: "Fat blocks of color. Commit, then clean up.",
  };

  const boardEl = document.getElementById("board");
  const paletteEl = document.getElementById("palette");
  const movesEl = document.getElementById("moves");
  const maxMovesEl = document.getElementById("max-moves");
  const levelEl = document.getElementById("level");
  const careerEl = document.getElementById("career");
  const chargesEl = document.getElementById("charges");
  const bestEl = document.getElementById("best");
  const meterFillEl = document.getElementById("meter-fill");
  const meterNoteEl = document.getElementById("meter-note");
  const hintEl = document.getElementById("hint");
  const toastEl = document.getElementById("toast");
  const howModal = document.getElementById("how-modal");
  const endModal = document.getElementById("end-modal");
  const continueBtn = document.getElementById("continue-btn");
  const againBtn = document.getElementById("again-btn");

  let ROWS = 8;
  let COLS = 8;
  let COLORS = 5;
  let MAX_MOVES = 16;
  let STYLE = "blobs";
  let SLACK = 6;
  let board = [];
  let moves = 0;
  let ended = false;
  let level = 1;
  let charges = MAX_CHARGES;
  let career = 0;
  let daily = false;
  let rng = Math.random;
  const storedBest = localStorage.getItem(BEST_KEY);
  let best = storedBest == null ? 0 : Number(storedBest);

  function specFor(lvl, phone) {
    const i = Math.min(lvl, 10) - 1;
    const phoneSizes = [6, 6, 7, 7, 8, 8, 8, 9, 9, 9];
    const deskSizes = [8, 9, 10, 11, 12, 12, 13, 14, 14, 14];
    const colorTiers = [4, 4, 5, 5, 5, 6, 6, 6, 6, 6];
    const size = phone ? phoneSizes[i] : deskSizes[i];
    const colors = colorTiers[i];
    const style = STYLES[(lvl - 1) % STYLES.length];
    const slack = lvl > 10 ? 2 : Math.max(2, 7 - Math.floor((lvl - 1) / 2));
    return {
      size: lvl > 10 ? (phone ? 9 : 14) : size,
      colors: lvl > 10 ? 6 : colors,
      style,
      slack,
    };
  }

  function applyLayout() {
    const spec = specFor(level, TB.isPhone());
    ROWS = spec.size;
    COLS = spec.size;
    COLORS = spec.colors;
    STYLE = spec.style;
    SLACK = spec.slack;
    boardEl.style.setProperty("--cols", String(COLS));
    boardEl.style.setProperty("--rows", String(ROWS));
    paletteEl.style.gridTemplateColumns = `repeat(${COLORS}, 1fr)`;
  }

  function inBounds(r, c) {
    return r >= 0 && c >= 0 && r < ROWS && c < COLS;
  }

  function connectedOn(grid, want = grid[0][0]) {
    const rows = grid.length;
    const cols = grid[0].length;
    const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
    const out = [];
    const queue = [[0, 0]];
    seen[0][0] = true;
    while (queue.length) {
      const [r, c] = queue.pop();
      if (grid[r][c] !== want) continue;
      out.push([r, c]);
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || seen[nr][nc]) continue;
        seen[nr][nc] = true;
        if (grid[nr][nc] === want) queue.push([nr, nc]);
      }
    }
    return out;
  }

  function cloneBoard(grid) {
    return grid.map((row) => row.slice());
  }

  function paintOn(grid, color) {
    const cur = grid[0][0];
    if (color === cur) return grid;
    for (const [r, c] of connectedOn(grid, cur)) grid[r][c] = color;
    return grid;
  }

  function isWon(grid) {
    const color = grid[0][0];
    return grid.every((row) => row.every((cell) => cell === color));
  }

  function expansionSize(grid, color) {
    const next = cloneBoard(grid);
    paintOn(next, color);
    return connectedOn(next).length;
  }

  function greedyMoves(grid) {
    const play = cloneBoard(grid);
    let n = 0;
    while (!isWon(play) && n < 80) {
      const cur = play[0][0];
      let bestColor = -1;
      let bestGain = -1;
      for (let color = 1; color <= COLORS; color++) {
        if (color === cur) continue;
        const gain = expansionSize(play, color);
        if (gain > bestGain) {
          bestGain = gain;
          bestColor = color;
        }
      }
      if (bestColor < 0) break;
      paintOn(play, bestColor);
      n += 1;
    }
    return n;
  }

  function noiseBoard() {
    return Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => 1 + Math.floor(rng() * COLORS))
    );
  }

  function smooth(grid, chance) {
    const next = cloneBoard(grid);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (rng() > chance) continue;
        const nbs = [];
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          if (inBounds(nr, nc)) nbs.push(grid[nr][nc]);
        }
        if (nbs.length) next[r][c] = nbs[Math.floor(rng() * nbs.length)];
      }
    }
    return next;
  }

  function stripeBoard() {
    const vertical = rng() < 0.5;
    const band = Math.max(1, Math.round((vertical ? COLS : ROWS) / COLORS));
    const grid = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => {
        const t = vertical ? c : r;
        return 1 + (Math.floor(t / band) % COLORS);
      })
    );
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (rng() < 0.16) grid[r][c] = 1 + Math.floor(rng() * COLORS);
      }
    }
    return grid;
  }

  function islandBoard() {
    const grid = noiseBoard();
    const blobs = 3 + COLORS;
    for (let i = 0; i < blobs; i++) {
      const color = 1 + Math.floor(rng() * COLORS);
      const h = 2 + Math.floor(rng() * 3);
      const w = 2 + Math.floor(rng() * 3);
      const r0 = Math.floor(rng() * ROWS);
      const c0 = Math.floor(rng() * COLS);
      for (let r = r0; r < Math.min(ROWS, r0 + h); r++) {
        for (let c = c0; c < Math.min(COLS, c0 + w); c++) grid[r][c] = color;
      }
    }
    return grid;
  }

  function makeBoard() {
    if (STYLE === "stripes") return stripeBoard();
    if (STYLE === "islands") return islandBoard();
    let grid = noiseBoard();
    if (STYLE === "blobs") {
      grid = smooth(grid, 0.62);
      grid = smooth(grid, 0.5);
      grid = smooth(grid, 0.4);
    } else if (STYLE === "mixed") {
      grid = smooth(grid, 0.42);
    }
    return grid;
  }

  function fillBoard() {
    let tries = 0;
    let greedy = 1;
    do {
      board = makeBoard();
      greedy = greedyMoves(board);
      tries += 1;
    } while ((isWon(board) || greedy < 3 || greedy > 40) && tries < 24);

    MAX_MOVES = greedy + SLACK;
    moves = 0;
    ended = false;
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
    for (let color = 1; color <= COLORS; color++) {
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
    levelEl.textContent = String(level);
    careerEl.textContent = String(career);
    bestEl.textContent = best ? String(best) : "—";
    meterFillEl.style.width = `${pct}%`;
    meterFillEl.classList.toggle("hot", moves >= MAX_MOVES - 3);
    meterNoteEl.textContent = ended
      ? "Board done."
      : `Level ${level} · ${STYLE}. ${STYLE_NOTE[STYLE]}`;

    chargesEl.innerHTML = "";
    chargesEl.setAttribute("aria-label", `${charges} charges`);
    for (let i = 0; i < MAX_CHARGES; i++) {
      const pip = document.createElement("span");
      pip.className = `pip${i < charges ? " on" : ""}`;
      chargesEl.appendChild(pip);
    }
  }

  function paint(color) {
    if (ended || color === board[0][0]) return;
    paintOn(board, color);
    moves += 1;
    render();
    if (isWon(board)) finish(true);
    else if (moves >= MAX_MOVES) finish(false);
  }

  function starsFor(win, leftover) {
    if (!win) return 0;
    if (leftover >= SLACK) return 3;
    if (leftover >= 2) return 2;
    return 1;
  }

  function finish(win) {
    ended = true;
    const leftover = Math.max(0, MAX_MOVES - moves);
    if (win) {
      career += leftover;
      if (career > best) {
        best = career;
        localStorage.setItem(BEST_KEY, String(best));
      }
    } else {
      charges -= 1;
    }

    const stars = starsFor(win, leftover);
    const runOver = !win && charges <= 0;
    document.getElementById("end-kicker").textContent = runOver
      ? "Run over"
      : win
        ? "Flooded"
        : "Out of moves";
    document.getElementById("end-title").textContent = runOver
      ? "Out of charges"
      : win
        ? "One color."
        : "Shake it off";
    document.getElementById("end-stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
    document.getElementById("end-stars").setAttribute("aria-label", `${stars} stars`);
    document.getElementById("end-level").textContent = String(level);
    document.getElementById("end-moves").textContent = String(moves);
    document.getElementById("end-left").textContent = String(leftover);
    document.getElementById("end-total").textContent = String(career);
    continueBtn.hidden = runOver;
    againBtn.hidden = !runOver;
    updateHud();
    endModal.hidden = false;
  }

  function seedFor(lvl) {
    return daily ? TB.mulberry32(TB.dailySeed() + 17 + lvl * 9973) : Math.random;
  }

  function nextBoard() {
    endModal.hidden = true;
    rng = seedFor(level);
    applyLayout();
    fillBoard();
    render();
    hintEl.textContent = `Level ${level} · ${STYLE}. Tap a color to flood.`;
  }

  function startRun(isDaily) {
    endModal.hidden = true;
    daily = isDaily;
    level = 1;
    charges = MAX_CHARGES;
    career = 0;
    nextBoard();
    if (daily) TB.toast(toastEl, "Daily board");
  }

  function newGame(isDaily) {
    if ((career || level > 1) && !ended && !confirm("Start a new run?")) return;
    startRun(isDaily);
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
  continueBtn.addEventListener("click", () => {
    level += 1;
    nextBoard();
  });
  againBtn.addEventListener("click", () => startRun(false));

  startRun(false);
  if (!localStorage.getItem(HELP_KEY)) howModal.hidden = false;
})();
