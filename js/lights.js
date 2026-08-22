(() => {
  const HELP_KEY = "tb-lights-seen-help";
  const BEST_KEY = "tb-lights-best";
  const SIZE = 5;
  const dirs = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  const boardEl = document.getElementById("board");
  const litEl = document.getElementById("lit");
  const totalEl = document.getElementById("total");
  const movesEl = document.getElementById("moves");
  const bestEl = document.getElementById("best");
  const meterFillEl = document.getElementById("meter-fill");
  const toastEl = document.getElementById("toast");
  const howModal = document.getElementById("how-modal");
  const endModal = document.getElementById("end-modal");

  let grid = [];
  let moves = 0;
  let ended = false;
  let rng = Math.random;
  let best = Number(localStorage.getItem(BEST_KEY) || "");
  if (!Number.isFinite(best) || best <= 0) best = 0;

  function applyLayout() {
    boardEl.style.setProperty("--cols", String(SIZE));
    boardEl.style.setProperty("--rows", String(SIZE));
    totalEl.textContent = String(SIZE * SIZE);
  }

  function inBounds(r, c) {
    return r >= 0 && c >= 0 && r < SIZE && c < SIZE;
  }

  function toggle(r, c) {
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc)) grid[nr][nc] = !grid[nr][nc];
    }
  }

  function litCount() {
    let n = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) if (grid[r][c]) n += 1;
    }
    return n;
  }

  function scramble() {
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
    const presses = 8 + Math.floor(rng() * 7);
    for (let i = 0; i < presses; i++) {
      toggle(Math.floor(rng() * SIZE), Math.floor(rng() * SIZE));
    }
    if (litCount() === 0) toggle(2, 2);
    moves = 0;
    ended = false;
  }

  function render() {
    boardEl.innerHTML = "";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = `block ${grid[r][c] ? "on" : "off"}`;
        el.style.setProperty("--r", r);
        el.style.setProperty("--c", c);
        el.innerHTML = '<span class="face"></span>';
        el.setAttribute("aria-label", grid[r][c] ? "On" : "Off");
        el.addEventListener("click", () => press(r, c));
        boardEl.appendChild(el);
      }
    }
    updateHud();
  }

  function updateHud() {
    const lit = litCount();
    const total = SIZE * SIZE;
    litEl.textContent = String(lit);
    movesEl.textContent = String(moves);
    bestEl.textContent = best ? String(best) : "—";
    meterFillEl.style.width = `${Math.round((lit / total) * 100)}%`;
  }

  function starsFor(n) {
    if (n <= 8) return 3;
    if (n <= 12) return 2;
    return 1;
  }

  function press(r, c) {
    if (ended) return;
    toggle(r, c);
    moves += 1;
    render();
    if (litCount() === 0) finish();
  }

  function finish() {
    ended = true;
    if (!best || moves < best) {
      best = moves;
      localStorage.setItem(BEST_KEY, String(best));
    }
    const stars = starsFor(moves);
    document.getElementById("end-stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
    document.getElementById("end-stars").setAttribute("aria-label", `${stars} stars`);
    document.getElementById("end-moves").textContent = String(moves);
    updateHud();
    endModal.hidden = false;
  }

  function newGame(daily) {
    endModal.hidden = true;
    rng = daily ? TB.mulberry32(TB.dailySeed() + 29) : Math.random;
    applyLayout();
    scramble();
    render();
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
