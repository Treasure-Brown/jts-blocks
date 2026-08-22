(() => {
  const HELP_KEY = "tb-pairs-seen-help";
  const BEST_KEY = "tb-pairs-best";
  const PAIR_TYPES = ["c1", "c2", "c3", "c4", "c5", "mixer", "c6", "c7"];

  const boardEl = document.getElementById("board");
  const matchedEl = document.getElementById("matched");
  const pairCountEl = document.getElementById("pair-count");
  const triesEl = document.getElementById("tries");
  const bestEl = document.getElementById("best");
  const meterFillEl = document.getElementById("meter-fill");
  const hintEl = document.getElementById("hint");
  const toastEl = document.getElementById("toast");
  const howModal = document.getElementById("how-modal");
  const endModal = document.getElementById("end-modal");

  const COLS = 4;
  const ROWS = 4;
  const PAIR_COUNT = PAIR_TYPES.length;

  let cards = [];
  let open = [];
  let matched = 0;
  let tries = 0;
  let busy = false;
  let ended = false;
  let rng = Math.random;
  let best = Number(localStorage.getItem(BEST_KEY) || "");
  if (!Number.isFinite(best) || best <= 0) best = 0;

  function deal() {
    const deck = [];
    PAIR_TYPES.forEach((type, i) => {
      deck.push({ id: i * 2, type, pair: i });
      deck.push({ id: i * 2 + 1, type, pair: i });
    });
    TB.shuffle(deck, rng);
    cards = deck.map((card, i) => ({
      ...card,
      r: Math.floor(i / COLS),
      c: i % COLS,
      up: false,
      done: false,
    }));
    open = [];
    matched = 0;
    tries = 0;
    busy = false;
    ended = false;
  }

  function render() {
    boardEl.innerHTML = "";
    boardEl.style.setProperty("--cols", String(COLS));
    boardEl.style.setProperty("--rows", String(ROWS));
    for (const card of cards) {
      const el = document.createElement("button");
      el.type = "button";
      const shown = card.up || card.done;
      el.className = `block ${shown ? card.type : "down"}${card.done ? " matched" : ""}`;
      el.style.setProperty("--r", card.r);
      el.style.setProperty("--c", card.c);
      el.innerHTML = '<span class="face"></span>';
      el.setAttribute("aria-label", shown ? `Tile ${card.type}` : "Face down");
      el.addEventListener("click", () => flip(card.id));
      boardEl.appendChild(el);
    }
    updateHud();
  }

  function updateHud() {
    matchedEl.textContent = String(matched);
    pairCountEl.textContent = String(PAIR_COUNT);
    triesEl.textContent = String(tries);
    bestEl.textContent = best ? String(best) : "—";
    meterFillEl.style.width = `${Math.round((matched / PAIR_COUNT) * 100)}%`;
    meterFillEl.classList.toggle("hot", matched === PAIR_COUNT);
  }

  function find(id) {
    return cards.find((card) => card.id === id);
  }

  async function flip(id) {
    if (busy || ended) return;
    const card = find(id);
    if (!card || card.up || card.done) return;
    card.up = true;
    open.push(card);
    render();

    if (open.length < 2) {
      hintEl.textContent = "Pick a second tile.";
      return;
    }

    tries += 1;
    busy = true;
    const [a, b] = open;
    if (a.pair === b.pair) {
      a.done = true;
      b.done = true;
      matched += 1;
      hintEl.textContent = "Match.";
      TB.toast(toastEl, "Match");
      open = [];
      busy = false;
      render();
      if (matched === PAIR_COUNT) finish();
      return;
    }

    hintEl.textContent = "No match.";
    await TB.wait(700);
    a.up = false;
    b.up = false;
    open = [];
    busy = false;
    hintEl.textContent = "Flip two. Match the marks.";
    render();
  }

  function starsFor(n) {
    if (n <= 12) return 3;
    if (n <= 16) return 2;
    return 1;
  }

  function finish() {
    ended = true;
    if (!best || tries < best) {
      best = tries;
      localStorage.setItem(BEST_KEY, String(best));
    }
    const stars = starsFor(tries);
    document.getElementById("end-stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
    document.getElementById("end-stars").setAttribute("aria-label", `${stars} stars`);
    document.getElementById("end-tries").textContent = String(tries);
    updateHud();
    endModal.hidden = false;
  }

  function newGame(daily) {
    endModal.hidden = true;
    rng = daily ? TB.mulberry32(TB.dailySeed() + 41) : Math.random;
    deal();
    render();
    hintEl.textContent = "Flip two. Match the marks.";
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
