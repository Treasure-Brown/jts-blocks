(() => {
  const ROWS = 9;
  const COLS = 14;
  const NUM_COLORS = 5;
  const NUM_MIXERS = 5;
  const MIXER = 6;
  const MAX_CHARGES = 3;
  const UNDOS_PER_BOARD = 1;
  const BEST_KEY = "jts-blocks-best";
  const HELP_KEY = "jts-blocks-seen-help-v2";

  const HOW_STEPS = [
    {
      title: "Tap, then tap again",
      body: "Clear groups of two or more that touch on their sides. Bigger groups explode in value — 5 × n². The first tap is a preview.",
    },
    {
      title: "Beat this board",
      body: "Fill the quota on the meter. Stars come from leftover blocks: 1 if you hit quota, 2 if the board is tidy, 3 if you almost wipe it. Miss the quota and you lose a charge, not the whole run.",
    },
    {
      title: "Mixers and undo",
      body: "Checkered mixers scramble a 5×5. Use one to set up a huge group. You get one undo per board. Daily is the same seed for everyone today.",
    },
  ];

  const boardEl = document.getElementById("board");
  const roundScoreEl = document.getElementById("round-score");
  const quotaEl = document.getElementById("quota");
  const meterFillEl = document.getElementById("meter-fill");
  const meterNoteEl = document.getElementById("meter-note");
  const chargesEl = document.getElementById("charges");
  const mixerCountEl = document.getElementById("mixer-count");
  const levelEl = document.getElementById("level");
  const careerEl = document.getElementById("career");
  const undoBtn = document.getElementById("undo-btn");
  const hintEl = document.getElementById("hint");
  const moveChip = document.getElementById("move-chip");
  const toastEl = document.getElementById("toast");
  const howModal = document.getElementById("how-modal");
  const howStepEl = document.getElementById("how-step");
  const howKicker = document.getElementById("how-kicker");
  const howNext = document.getElementById("how-next");
  const howBack = document.getElementById("how-back");
  const endModal = document.getElementById("end-modal");
  const endTitle = document.getElementById("end-title");
  const endKicker = document.getElementById("end-kicker");
  const endStars = document.getElementById("end-stars");
  const continueBtn = document.getElementById("continue-btn");
  const againBtn = document.getElementById("again-btn");

  let rng = Math.random;
  let board = [];
  let nextId = 1;
  let roundScore = 0;
  let career = 0;
  let level = 1;
  let charges = MAX_CHARGES;
  let undos = UNDOS_PER_BOARD;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let selected = [];
  let mixerSelected = null;
  let busy = false;
  let ended = false;
  let snapshot = null;
  let mixerJustUsed = false;
  let biggestGroup = 0;
  let howIndex = 0;
  let lastResult = null;

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  function groupScore(n) {
    return n < 2 ? 0 : 5 * n * n;
  }

  function quotaFor(lvl) {
    return 1800 + 280 * (lvl - 1);
  }

  function clearBonus(percent) {
    if (percent <= 85) return 0;
    const leftover = 100 - percent;
    return 25 * (15 - leftover) ** 2;
  }

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dailySeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function cell(r, c) {
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return null;
    return board[r][c];
  }

  function flood(r, c) {
    const start = cell(r, c);
    if (!start) return [];
    if (start.color === MIXER) return [start];

    const seen = new Set([start.id]);
    const out = [start];
    const queue = [start];

    while (queue.length) {
      const cur = queue.pop();
      for (const [dr, dc] of dirs) {
        const next = cell(cur.r + dr, cur.c + dc);
        if (!next || seen.has(next.id) || next.color !== start.color) continue;
        seen.add(next.id);
        out.push(next);
        queue.push(next);
      }
    }
    return out;
  }

  function mixerNeighbors(block) {
    const around = [];
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (dr === 0 && dc === 0) continue;
        const next = cell(block.r + dr, block.c + dc);
        if (next) around.push(next);
      }
    }
    return around;
  }

  function mixerCount() {
    let n = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]?.color === MIXER) n += 1;
      }
    }
    return n;
  }

  function hasMoves() {
    if (mixerCount() > 0) return true;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const block = board[r][c];
        if (!block || block.color === MIXER) continue;
        for (const [dr, dc] of dirs) {
          const next = cell(r + dr, c + dc);
          if (next && next.color === block.color) return true;
        }
      }
    }
    return false;
  }

  function remainingCount() {
    let n = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) n += 1;
      }
    }
    return n;
  }

  function applyGravity() {
    for (let c = 0; c < COLS; c++) {
      const stack = [];
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][c]) stack.push(board[r][c]);
      }
      for (let r = ROWS - 1; r >= 0; r--) {
        const block = stack[ROWS - 1 - r] || null;
        board[r][c] = block;
        if (block) {
          block.r = r;
          block.c = c;
        }
      }
    }
  }

  function packLeft() {
    const columns = [];
    for (let c = 0; c < COLS; c++) {
      const col = [];
      let any = false;
      for (let r = 0; r < ROWS; r++) {
        col.push(board[r][c]);
        if (board[r][c]) any = true;
      }
      if (any) columns.push(col);
    }
    while (columns.length < COLS) columns.push(Array(ROWS).fill(null));
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const block = columns[c][r];
        board[r][c] = block;
        if (block) {
          block.r = r;
          block.c = c;
        }
      }
    }
  }

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function cloneBoard() {
    return board.map((row) =>
      row.map((b) => (b ? { id: b.id, color: b.color, r: b.r, c: b.c } : null))
    );
  }

  function takeSnapshot() {
    snapshot = {
      cells: cloneBoard(),
      nextId,
      roundScore,
      mixerJustUsed,
      biggestGroup,
    };
  }

  function restoreSnapshot() {
    if (!snapshot) return false;
    board = snapshot.cells.map((row) =>
      row.map((b) => (b ? { id: b.id, color: b.color, r: b.r, c: b.c } : null))
    );
    nextId = snapshot.nextId;
    roundScore = snapshot.roundScore;
    mixerJustUsed = snapshot.mixerJustUsed;
    biggestGroup = snapshot.biggestGroup;
    snapshot = null;
    selected = [];
    mixerSelected = null;
    boardEl.querySelectorAll(".block").forEach((el) => el.remove());
    render(false);
    return true;
  }

  function fillBoard() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    selected = [];
    mixerSelected = null;
    ended = false;
    mixerJustUsed = false;
    biggestGroup = 0;
    snapshot = null;

    const blocks = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const block = {
          id: nextId++,
          r,
          c,
          color: 1 + Math.floor(rng() * NUM_COLORS),
        };
        board[r][c] = block;
        blocks.push(block);
      }
    }

    let placed = 0;
    while (placed < NUM_MIXERS) {
      const pick = blocks[Math.floor(rng() * blocks.length)];
      if (pick.color === MIXER) continue;
      pick.color = MIXER;
      placed += 1;
    }
  }

  function colorClass(color) {
    return color === MIXER ? "mixer" : `c${color}`;
  }

  function clearHighlights() {
    boardEl.querySelectorAll(".selected, .mix-range").forEach((el) => {
      el.classList.remove("selected", "mix-range");
    });
  }

  function render(animate = true) {
    const existing = new Map(
      [...boardEl.querySelectorAll(".block")].map((el) => [Number(el.dataset.id), el])
    );
    const keep = new Set();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const block = board[r][c];
        if (!block) continue;
        keep.add(block.id);
        let el = existing.get(block.id);
        if (!el) {
          el = document.createElement("button");
          el.type = "button";
          el.className = "block";
          el.dataset.id = String(block.id);
          el.innerHTML = '<span class="face"></span>';
          el.addEventListener("click", () => onBlockClick(block.id));
          el.addEventListener("mouseenter", () => onBlockHover(block.id));
          boardEl.appendChild(el);
        }
        el.className = `block ${colorClass(block.color)}`;
        el.dataset.id = String(block.id);
        el.style.setProperty("--r", block.r);
        el.style.setProperty("--c", block.c);
        el.setAttribute(
          "aria-label",
          block.color === MIXER
            ? `Mixer at column ${block.c + 1}, row ${block.r + 1}`
            : `Color ${block.color} block`
        );
        if (!animate) el.style.transition = "none";
      }
    }

    for (const [id, el] of existing) {
      if (!keep.has(id) && !el.classList.contains("removing")) el.remove();
    }

    if (!animate) {
      requestAnimationFrame(() => {
        boardEl.querySelectorAll(".block").forEach((el) => {
          el.style.transition = "";
        });
      });
    }
  }

  function showToast(text) {
    toastEl.hidden = false;
    toastEl.textContent = text;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toastEl.hidden = true;
    }, 1400);
  }

  function placeChip(blocks, text) {
    if (!blocks.length) {
      moveChip.hidden = true;
      return;
    }
    const avgR = blocks.reduce((s, b) => s + b.r, 0) / blocks.length;
    const avgC = blocks.reduce((s, b) => s + b.c, 0) / blocks.length;
    moveChip.hidden = false;
    moveChip.textContent = text;
    moveChip.style.setProperty("--r", avgR);
    moveChip.style.setProperty("--c", avgC);
  }

  function updateHud() {
    const quota = quotaFor(level);
    const pct = Math.min(100, Math.round((roundScore / quota) * 100));
    roundScoreEl.textContent = String(roundScore);
    quotaEl.textContent = String(quota);
    meterFillEl.style.width = `${pct}%`;
    meterFillEl.classList.toggle("hot", roundScore >= quota);
    meterNoteEl.textContent =
      roundScore >= quota
        ? "Quota locked. Clean leftovers for extra stars."
        : "Hit the quota. Leftovers decide your stars.";

    chargesEl.innerHTML = "";
    chargesEl.setAttribute("aria-label", `${charges} charges`);
    for (let i = 0; i < MAX_CHARGES; i++) {
      const pip = document.createElement("span");
      pip.className = `pip${i < charges ? " on" : ""}`;
      chargesEl.appendChild(pip);
    }

    mixerCountEl.textContent = String(mixerCount());
    levelEl.textContent = String(level);
    careerEl.textContent = String(career);
    undoBtn.textContent = `Undo · ${undos}`;
    undoBtn.disabled = undos <= 0 || !snapshot || busy || ended;
  }

  function setSelection(blocks, mixer = null) {
    selected = blocks;
    mixerSelected = mixer;
    clearHighlights();
    if (mixer) {
      document.querySelector(`[data-id="${mixer.id}"]`)?.classList.add("selected");
      for (const n of mixerNeighbors(mixer)) {
        document.querySelector(`[data-id="${n.id}"]`)?.classList.add("mix-range");
      }
      hintEl.textContent = "Tap the mixer again to scramble.";
      placeChip([mixer], "Mix");
    } else if (blocks.length > 1) {
      for (const b of blocks) {
        document.querySelector(`[data-id="${b.id}"]`)?.classList.add("selected");
      }
      const pts = groupScore(blocks.length);
      hintEl.textContent = `${blocks.length} blocks · tap again to clear`;
      placeChip(blocks, `+${pts}`);
    } else {
      hintEl.textContent = "Tap a group, tap again to clear.";
      placeChip([]);
    }
    updateHud();
  }

  function findById(id) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]?.id === id) return board[r][c];
      }
    }
    return null;
  }

  function onBlockHover(id) {
    if (busy || ended || selected.length || mixerSelected) return;
    const block = findById(id);
    if (!block) return;
    if (block.color === MIXER) {
      hintEl.textContent = "Mixer: scramble a 5×5.";
      return;
    }
    const group = flood(block.r, block.c);
    if (group.length > 1) hintEl.textContent = `${group.length} · ${groupScore(group.length)} pts`;
  }

  function sameGroup(a, b) {
    if (a.length !== b.length) return false;
    const ids = new Set(a.map((x) => x.id));
    return b.every((x) => ids.has(x.id));
  }

  async function onBlockClick(id) {
    if (busy || ended) return;
    const block = findById(id);
    if (!block) return;

    if (block.color === MIXER) {
      if (mixerSelected && mixerSelected.id === block.id) {
        await useMixer(block);
      } else {
        setSelection([], block);
      }
      return;
    }

    const group = flood(block.r, block.c);
    if (group.length < 2) {
      setSelection([]);
      return;
    }

    if (selected.length && sameGroup(selected, group)) {
      await clearGroup(group);
    } else {
      setSelection(group);
    }
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function clearGroup(group) {
    takeSnapshot();
    busy = true;
    const pts = groupScore(group.length);
    let extra = 0;
    if (mixerJustUsed && group.length >= 8) {
      extra = 150;
      showToast("Style +150");
    } else if (group.length >= 10) {
      showToast(`+${pts}`);
    }
    mixerJustUsed = false;
    biggestGroup = Math.max(biggestGroup, group.length);
    roundScore += pts + extra;
    career += pts + extra;
    if (career > best) {
      best = career;
      localStorage.setItem(BEST_KEY, String(best));
    }

    const ids = new Set(group.map((b) => b.id));
    for (const b of group) {
      const el = document.querySelector(`[data-id="${b.id}"]`);
      if (el) {
        el.classList.add("removing");
        el.style.setProperty("--r", b.r);
        el.style.setProperty("--c", b.c);
      }
      board[b.r][b.c] = null;
    }

    selected = [];
    mixerSelected = null;
    placeChip([]);
    updateHud();
    await wait(180);

    ids.forEach((id) => document.querySelector(`[data-id="${id}"]`)?.remove());
    applyGravity();
    packLeft();
    render();
    await wait(280);
    busy = false;
    setSelection([]);
    if (!hasMoves()) finishBoard();
  }

  async function useMixer(mixer) {
    takeSnapshot();
    busy = true;
    const neighbors = mixerNeighbors(mixer);
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const n of neighbors) {
      if (n.color <= NUM_COLORS) counts[n.color] += 1;
    }
    let popular = 1;
    for (let c = 2; c <= NUM_COLORS; c++) {
      if (counts[c] > counts[popular]) popular = c;
    }
    mixer.color = popular;

    const positions = neighbors.map((n) => ({ r: n.r, c: n.c }));
    shuffle(neighbors);
    for (let i = 0; i < neighbors.length; i++) {
      const n = neighbors[i];
      n.r = positions[i].r;
      n.c = positions[i].c;
      board[n.r][n.c] = n;
    }
    board[mixer.r][mixer.c] = mixer;
    mixerJustUsed = true;

    setSelection([]);
    render();
    await wait(300);
    busy = false;
    if (!hasMoves()) finishBoard();
    else updateHud();
  }

  function starCount(quota, remaining) {
    if (roundScore < quota) return 0;
    let stars = 1;
    if (remaining <= 18) stars = 2;
    if (remaining <= 6 || biggestGroup >= 12) stars = 3;
    return stars;
  }

  function finishBoard() {
    ended = true;
    const remaining = remainingCount();
    const percent = Math.floor(((ROWS * COLS - remaining) / (ROWS * COLS)) * 100);
    const bonus = clearBonus(percent);
    roundScore += bonus;
    career += bonus;
    if (career > best) {
      best = career;
      localStorage.setItem(BEST_KEY, String(best));
    }

    const quota = quotaFor(level);
    const stars = starCount(quota, remaining);
    const hit = roundScore >= quota;
    if (!hit) charges -= 1;

    lastResult = { hit, stars, remaining, quota };
    updateHud();

    endStars.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
    endStars.setAttribute("aria-label", `${stars} stars`);
    document.getElementById("end-quota").textContent = String(quota);
    document.getElementById("end-round").textContent = String(roundScore);
    document.getElementById("end-remaining").textContent = String(remaining);
    document.getElementById("end-total").textContent = String(career);

    if (charges <= 0 && !hit) {
      endKicker.textContent = "Run over";
      endTitle.textContent = "Out of charges";
      continueBtn.hidden = true;
      againBtn.hidden = false;
    } else if (!hit) {
      endKicker.textContent = "Quota missed";
      endTitle.textContent = "Shake it off";
      continueBtn.hidden = false;
      continueBtn.textContent = "Next board";
      againBtn.hidden = true;
    } else {
      endKicker.textContent = stars === 3 ? "That's the stuff" : "Board complete";
      endTitle.textContent = stars === 3 ? "Clean sweep" : "Nice.";
      continueBtn.hidden = false;
      continueBtn.textContent = "Next board";
      againBtn.hidden = true;
    }
    endModal.hidden = false;
  }

  function newBoard(resetRun, seeded) {
    if (resetRun) {
      career = 0;
      level = 1;
      charges = MAX_CHARGES;
      rng = seeded ? mulberry32(dailySeed()) : Math.random;
    } else if (seeded) {
      rng = mulberry32(dailySeed() + level * 9973);
    } else if (rng === Math.random) {
      rng = Math.random;
    }

    roundScore = 0;
    undos = UNDOS_PER_BOARD;
    fillBoard();
    boardEl.querySelectorAll(".block").forEach((el) => el.remove());
    render(false);
    setSelection([]);
    hintEl.textContent = "Tap a group, tap again to clear.";
  }

  function newGame(daily) {
    endModal.hidden = true;
    newBoard(true, daily);
    if (daily) showToast("Daily board");
  }

  function renderHow() {
    const step = HOW_STEPS[howIndex];
    howKicker.textContent = `${howIndex + 1} / ${HOW_STEPS.length}`;
    howStepEl.innerHTML = `<h2>${step.title}</h2><p>${step.body}</p>`;
    howBack.hidden = howIndex === 0;
    howNext.textContent = howIndex === HOW_STEPS.length - 1 ? "Play" : "Next";
  }

  function openHow() {
    howIndex = 0;
    renderHow();
    howModal.hidden = false;
  }

  document.getElementById("how-btn").addEventListener("click", openHow);
  howNext.addEventListener("click", () => {
    if (howIndex >= HOW_STEPS.length - 1) {
      howModal.hidden = true;
      localStorage.setItem(HELP_KEY, "1");
      return;
    }
    howIndex += 1;
    renderHow();
  });
  howBack.addEventListener("click", () => {
    howIndex = Math.max(0, howIndex - 1);
    renderHow();
  });
  document.getElementById("new-btn").addEventListener("click", () => {
    if (career && !ended && !confirm("Start a new run?")) return;
    newGame(false);
  });
  document.getElementById("daily-btn").addEventListener("click", () => {
    if (career && !ended && !confirm("Start today's daily?")) return;
    newGame(true);
  });
  undoBtn.addEventListener("click", () => {
    if (undos <= 0 || !snapshot || busy || ended) return;
    if (restoreSnapshot()) {
      undos -= 1;
      setSelection([]);
      showToast("Undone");
    }
  });
  continueBtn.addEventListener("click", () => {
    endModal.hidden = true;
    level += 1;
    newBoard(false, rng !== Math.random);
  });
  againBtn.addEventListener("click", () => newGame(false));

  boardEl.addEventListener("mouseleave", () => {
    if (!selected.length && !mixerSelected) {
      hintEl.textContent = "Tap a group, tap again to clear.";
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      setSelection([]);
      howModal.hidden = true;
    }
    if ((e.key === "z" || e.key === "Z") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      undoBtn.click();
    }
  });

  newBoard(true, false);
  if (!localStorage.getItem(HELP_KEY)) openHow();
})();
