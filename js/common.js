(() => {
  function isPhone() {
    const shortSide = Math.min(screen.width, screen.height);
    const ua = navigator.userAgent || "";
    return (
      /iPhone|iPod|Android.+Mobile|Mobile.+Android/i.test(ua) ||
      shortSide <= 520 ||
      window.innerWidth <= 760
    );
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

  function shuffle(list, rng = Math.random) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function toast(el, text) {
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      el.hidden = true;
    }, 1400);
  }

  function migrateKey(next, prev) {
    if (localStorage.getItem(next) != null) return;
    const old = localStorage.getItem(prev);
    if (old != null) localStorage.setItem(next, old);
  }

  window.TB = { isPhone, mulberry32, dailySeed, shuffle, wait, toast, migrateKey };
})();
