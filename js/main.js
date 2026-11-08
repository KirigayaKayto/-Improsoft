/* ============================================================
   Improsoft v4.0 «Impro SaaS» — логика:
   язык (сегмент-контрол), шапка (тень, прячется при прокрутке),
   scroll-reveal, счётчики (hero + дашборд), лента возможностей,
   дафтар (повтор, авто-подсказка), мини-касса (сторно, номер чека,
   способы оплаты, плавающий итог), кухонный экран (тап, автоцикл, часы),
   склад («Сканировать» → остаток), даты партий от текущей даты,
   форма → send.php, липкая панель, scrollspy, наклон устройств,
   магнит кнопок (только мышь)
   ============================================================ */

(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var DEFAULT_LANG = "ru";
  var STORAGE_KEY = "improsoft-lang";
  var currentLang = DEFAULT_LANG;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasIO = "IntersectionObserver" in window;

  /* ---------- Язык ---------- */
  function applyLang(lang) {
    if (!I18N[lang]) lang = DEFAULT_LANG;
    currentLang = lang;
    var dict = I18N[lang];

    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (dict[key] !== undefined) el.textContent = dict[key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      if (dict[key] !== undefined) el.setAttribute("placeholder", dict[key]);
    });
    document.querySelectorAll("[data-i18n-content]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-content");
      if (dict[key] !== undefined) el.setAttribute("content", dict[key]);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria-label");
      if (dict[key] !== undefined) el.setAttribute("aria-label", dict[key]);
    });

    document.title = dict["meta.title"];

    // статусы кухонного экрана живут в data-state — переводим по нему
    document.querySelectorAll(".ticket__state").forEach(function (s) {
      s.textContent = dict[s.getAttribute("data-state") === "done" ? "cafe.served" : "cafe.cooking"];
    });

    // даты партий (Pharm) считаются от сегодняшнего дня
    renderPharmDates(lang);

    // способ оплаты в строке «Чек закрыт» — на новом языке
    if (posPaidMethod) { var pmEl = document.getElementById("posMethod"); if (pmEl) pmEl.textContent = methodLabel(posPaidMethod); }

    // строки чека тоже перепечатываем на новом языке
    if (typeof posOrder !== "undefined" && posOrder && posOrder.length) renderPosRows(dict);

    document.querySelectorAll(".lang__btn[data-lang]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-lang") === lang));
    });

    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* приватный режим */ }

    syncTapeSpeed(); // лента подстраивает скорость под длину текста
  }

  /* даты партий: +17 мес. (OK), +2 (СКОРО), +9 (OK) — никогда не устаревают; голая дата, заголовок столбца «Годен до» */
  function renderPharmDates(lang) {
    var now = new Date();
    document.querySelectorAll(".batch__date[data-months]").forEach(function (el) {
      var d = new Date(now.getFullYear(), now.getMonth() + parseInt(el.getAttribute("data-months"), 10), 1);
      var mm = ("0" + (d.getMonth() + 1)).slice(-2);
      el.textContent = mm + (lang === "en" ? "/" : ".") + d.getFullYear();
    });
  }

  /* подпись способа оплаты по ключу чипа (Наличные / Payme / Click / Uzum Bank / В долг) */
  var posPaidMethod = "";
  function methodLabel(key) {
    var b = document.querySelector('.pmethod[data-method="' + key + '"]');
    if (!b) return "";
    var s = b.querySelector("[data-i18n], span"); // подпись без клавиши F2/F3
    return (s || b).textContent;
  }

  /* сменить ключ элемента: applyLang читает data-i18n, поэтому подпись переживёт смену языка */
  function setKey(el, key) {
    el.setAttribute("data-i18n", key);
    el.textContent = I18N[currentLang][key];
  }

  document.querySelectorAll(".lang__btn[data-lang]").forEach(function (btn) {
    btn.addEventListener("click", function () { applyLang(btn.getAttribute("data-lang")); });
  });

  var saved = DEFAULT_LANG;
  try { saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG; } catch (e) {}
  applyLang(saved);

  /* ---------- Шапка: тень при прокрутке, прячется при прокрутке вниз ---------- */
  var topbar = document.getElementById("topbar");
  var ticking = false;
  var lastY = 0;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      if (topbar) {
        topbar.classList.toggle("is-scrolled", y > 8);
        if (!reducedMotion) {
          if (y > 240 && y > lastY + 4) topbar.classList.add("is-hidden");
          else if (y < lastY - 4 || y <= 240) topbar.classList.remove("is-hidden");
        }
      }
      lastY = y;
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Часы в строках состояния экранов ---------- */
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function setClock() {
    var d = new Date();
    var t = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    var date = pad2(d.getDate()) + "." + pad2(d.getMonth() + 1) + "." + d.getFullYear();
    document.querySelectorAll("[data-clock]").forEach(function (el) { el.textContent = t; });
    document.querySelectorAll("[data-date]").forEach(function (el) { el.textContent = date; });
  }
  setClock();
  setInterval(setClock, 30000);

  /* ---------- Счётчики: число «допечатывается» ---------- */
  function fmtSum(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }
  function countUp(el, target, dur) {
    var fmt = el.getAttribute("data-fmt") === "sum" ? fmtSum : String;
    if (reducedMotion) { el.textContent = fmt(target); return; }
    var start = null;
    var stepFn = function (ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3); // ease-out
      el.textContent = fmt(Math.round(target * e));
      if (p < 1) requestAnimationFrame(stepFn);
    };
    requestAnimationFrame(stepFn);
  }
  function countAll(root, dur) {
    root.querySelectorAll("[data-count]").forEach(function (b) {
      countUp(b, parseInt(b.getAttribute("data-count"), 10) || 0, dur);
    });
  }

  // цифры hero (3 / 7 / 4) — сразу после появления
  var heroStats = document.querySelector(".hero__stats");
  if (heroStats && !reducedMotion) {
    heroStats.querySelectorAll("[data-count]").forEach(function (b) { b.textContent = "0"; });
    setTimeout(function () { countAll(heroStats, 700); }, 300);
  }

  // дашборд владельца: столбики растут (.is-in), KPI считаются — один раз при появлении
  var heroDash = document.getElementById("heroDash");
  if (heroDash) {
    if (!reducedMotion) heroDash.querySelectorAll("[data-count]").forEach(function (b) { b.textContent = "0"; });
    var startDash = function () { heroDash.classList.add("is-in"); countAll(heroDash, 900); };
    if (hasIO && !reducedMotion) {
      var dashIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { dashIO.disconnect(); setTimeout(startDash, 250); } });
      }, { threshold: 0.4 });
      dashIO.observe(heroDash);
    } else {
      startDash();
    }
  }

  // будущая секция .proof: счётчик заведений
  var proofNum = document.getElementById("proofNum");
  if (proofNum && hasIO) {
    var proofIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        proofIO.disconnect();
        countUp(proofNum, parseInt(proofNum.getAttribute("data-target"), 10) || 0, 1200);
      });
    }, { threshold: 0.6 });
    proofIO.observe(proofNum);
  }

  /* ---------- Scroll-reveal: блоки всплывают ---------- */
  var revealEls = document.querySelectorAll("[data-reveal]");
  var revealPending = Array.prototype.slice.call(revealEls);
  function revealNow(el) {
    el.classList.add("is-in");
    var i = revealPending.indexOf(el);
    if (i > -1) revealPending.splice(i, 1);
  }
  if (hasIO) {
    var revealIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        // показываем и то, что уже выше экрана (перезагрузка посреди страницы, переход по якорю)
        if (e.isIntersecting || e.boundingClientRect.bottom < 0) {
          revealNow(e.target);
          revealIO.unobserve(e.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
    revealEls.forEach(function (el) { revealIO.observe(el); });
    // страховка: блок, пролистанный мимо между кадрами, показываем по положению при следующей прокрутке
    window.addEventListener("scroll", function () {
      if (!revealPending.length) return;
      revealPending.slice().forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) revealNow(el);
      });
    }, { passive: true });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- Непрерывные анимации живут только на экране ---------- */
  var liveEls = document.querySelectorAll("[data-live]");
  if (hasIO) {
    var liveIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle("is-live", e.isIntersecting); });
    }, { threshold: 0 });
    liveEls.forEach(function (el) { liveIO.observe(el); });
  } else {
    liveEls.forEach(function (el) { el.classList.add("is-live"); });
  }

  /* ---------- Лента возможностей: дубликат списка для бесшовного цикла, скорость от длины ---------- */
  var tapeBelt = document.getElementById("tapeBelt");
  var tapeList = tapeBelt ? tapeBelt.querySelector(".tape__list") : null;
  if (tapeBelt && tapeList && !tapeBelt.querySelector("[aria-hidden]")) {
    var tapeClone = tapeList.cloneNode(true); // клон хранит data-i18n — переводится вместе со всеми
    tapeClone.setAttribute("aria-hidden", "true");
    tapeBelt.appendChild(tapeClone);
  }
  function syncTapeSpeed() {
    if (!tapeBelt || !tapeList) return;
    var w = tapeList.offsetWidth;
    if (w) tapeBelt.style.animationDuration = Math.max(30, Math.round(w / 42)) + "s"; // ~42px/с
  }
  syncTapeSpeed();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncTapeSpeed);

  /* ---------- Дафтар: тап-реконсиляция ---------- */
  var entries = document.querySelectorAll(".dentry");
  var daftarBoard = document.querySelector(".daftar__board");
  var doneCount = 0;
  var daftarRun = 0;   // токен: «Начать заново» обесценивает отложенные таймеры
  var allBtn = document.getElementById("daftarAll");
  var daftarStamp = document.getElementById("daftarStamp");
  var daftarEmpty = document.getElementById("daftarEmpty");
  var mobileDaftar = window.matchMedia("(max-width: 680px)");

  function inlineClone(row, after) {
    // на мобильном журнал скрыт — строка печатается прямо в тетради
    var clone = row.cloneNode(true);
    clone.hidden = false;
    clone.removeAttribute("id");
    clone.classList.add("lrow--inline");
    after.insertAdjacentElement("afterend", clone);
  }

  function reconcile(entry) {
    if (entry.classList.contains("is-done")) return;
    entry.classList.add("is-done");
    entry.setAttribute("aria-disabled", "true");
    if (daftarBoard) daftarBoard.classList.add("is-touched");
    if (daftarEmpty) daftarEmpty.hidden = true;
    var row = document.querySelector('.daftar__ledger .lrow[data-row="' + entry.getAttribute("data-row") + '"]');
    if (row) {
      row.hidden = false;
      if (mobileDaftar.matches) inlineClone(row, entry);
    }
    doneCount++;
    if (doneCount === entries.length) {
      var run = daftarRun;
      var total = document.getElementById("daftarTotal");
      setTimeout(function () {
        if (run !== daftarRun || doneCount !== entries.length) return; // успели сбросить
        if (total) total.hidden = false;
        if (mobileDaftar.matches && total) {
          var paper = document.getElementById("daftarPaper");
          var clone = total.cloneNode(true);
          clone.hidden = false;
          clone.removeAttribute("id");
          clone.classList.add("lrow--inline");
          paper.insertBefore(clone, paper.querySelector(".daftar__papernote"));
        }
        if (daftarStamp) daftarStamp.hidden = false;
      }, reducedMotion ? 0 : 350);
      if (allBtn) setKey(allBtn, "daftar.again"); // кнопка не гаснет, а предлагает повтор
    }
  }

  function resetDaftar() {
    daftarRun++;
    doneCount = 0;
    entries.forEach(function (e) { e.classList.remove("is-done"); e.removeAttribute("aria-disabled"); });
    document.querySelectorAll(".daftar__ledger .lrow").forEach(function (r) { r.hidden = true; }); // включая итог
    document.querySelectorAll("#daftarPaper .lrow--inline").forEach(function (c) { c.remove(); }); // мобильные клоны
    if (daftarEmpty) daftarEmpty.hidden = false;
    if (daftarStamp) daftarStamp.hidden = true;
    if (allBtn) setKey(allBtn, "daftar.all");
  }

  entries.forEach(function (entry) {
    entry.addEventListener("click", function () { reconcile(entry); });
  });

  if (allBtn) {
    allBtn.addEventListener("click", function () {
      if (allBtn.getAttribute("data-i18n") === "daftar.again") { resetDaftar(); return; }
      var run = daftarRun;
      var delay = 0;
      entries.forEach(function (entry) {
        if (entry.classList.contains("is-done")) return;
        setTimeout(function () { if (run === daftarRun) reconcile(entry); }, delay);
        delay += reducedMotion ? 0 : 260;
      });
    });
  }

  // авто-подсказка (десктоп): тетрадь на экране, никто не нажимал — первая запись проводится сама
  if (daftarBoard && entries.length && hasIO && !reducedMotion) {
    var daftarAutoIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        daftarAutoIO.disconnect();
        setTimeout(function () {
          if (mobileDaftar.matches || daftarBoard.classList.contains("is-touched")) return;
          reconcile(entries[0]);
        }, 1600);
      });
    }, { threshold: 0.6 });
    daftarAutoIO.observe(daftarBoard);
  }

  /* ---------- Кухонный экран: живые статусы, тап «подано» ---------- */
  var ticket = document.getElementById("cafeTicket");
  var ticketTimer = null;
  var ticketNo = 214;

  function serveState(s) {
    s.setAttribute("data-state", "done");
    s.textContent = I18N[currentLang]["cafe.served"];
  }

  function tickTicket() {
    var states = ticket.querySelectorAll(".ticket__state");
    var cooking = [];
    states.forEach(function (s) { if (s.getAttribute("data-state") === "cook") cooking.push(s); });
    var dict = I18N[currentLang];
    if (cooking.length === 0) {
      // всё подано — новый заказ: статусы обратно, номер растёт, строки появляются
      states.forEach(function (s) {
        s.setAttribute("data-state", "cook");
        s.textContent = dict["cafe.cooking"];
      });
      ticketNo++;
      var noEl = document.getElementById("ticketNo");
      if (noEl) noEl.textContent = ("000" + ticketNo).slice(-4);
      if (!reducedMotion) {
        ticket.classList.remove("is-new");
        void ticket.offsetWidth;
        ticket.classList.add("is-new");
      }
    } else {
      serveState(cooking[0]);
    }
  }

  function startTicket() {
    if (ticketTimer) clearInterval(ticketTimer);
    ticketTimer = setInterval(tickTicket, 2400); // пауза за кадром — бережём батарею
  }
  function stopTicket() {
    if (ticketTimer) clearInterval(ticketTimer);
    ticketTimer = null;
  }

  if (ticket && hasIO && !reducedMotion) {
    var ticketIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) startTicket(); else stopTicket(); });
    }, { threshold: 0.4 });
    ticketIO.observe(ticket);
  }

  // тап по «готовится» отдаёт блюдо; если всё подано — открывает новый заказ
  if (ticket) {
    ticket.addEventListener("click", function (e) {
      var s = e.target.closest(".ticket__state");
      if (!s) return;
      if (s.getAttribute("data-state") === "cook") {
        serveState(s);
      } else if (!ticket.querySelector('.ticket__state[data-state="cook"]')) {
        tickTicket();
      }
      ticket.classList.add("is-touched");
      if (ticketTimer) startTicket(); // такт автоцикла с нуля — не перебивает тап
    });
  }

  /* ---------- Предзаполнение типа бизнеса ---------- */
  var bizSelect = document.getElementById("fBiz");
  document.querySelectorAll("[data-product]").forEach(function (link) {
    link.addEventListener("click", function () {
      if (bizSelect) bizSelect.value = link.getAttribute("data-product");
    });
  });

  /* ---------- Форма ---------- */
  var form = document.getElementById("leadForm");
  var done = document.getElementById("formDone");

  function setFieldError(f, bad) {
    f.classList.toggle("is-invalid", bad);
    var err = document.getElementById(f.id + "Err");
    if (err) err.hidden = !bad;
    if (bad) {
      f.setAttribute("aria-invalid", "true");
      if (err) f.setAttribute("aria-describedby", err.id);
    } else {
      f.removeAttribute("aria-invalid");
      f.removeAttribute("aria-describedby");
    }
  }

  if (form) {
    form.setAttribute("novalidate", ""); // без JS работает нативная валидация браузера; с JS — своя

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.elements.name;
      var phone = form.elements.phone;
      var firstBad = null;
      [name, phone].forEach(function (f) {
        var empty = !f.value.trim();
        setFieldError(f, empty);
        if (empty && !firstBad) firstBad = f;
      });
      if (firstBad) { firstBad.focus(); return; }

      var submitBtn = form.querySelector("button[type=submit]");
      var errEl = document.getElementById("formErr");
      submitBtn.disabled = true;
      if (errEl) errEl.hidden = true;

      var data = new FormData(form);
      data.append("lang", currentLang);

      fetch(form.getAttribute("action") || "send.php", {
        method: "POST",
        body: data,
        headers: { "X-Requested-With": "fetch" }
      }).then(function (r) {
        return r.json();
      }).then(function (j) {
        if (!j.ok) throw new Error("send failed");
        if (done) { done.hidden = false; done.classList.add("is-shown"); }
        setTimeout(function () {
          form.reset();
          if (done) { done.hidden = true; done.classList.remove("is-shown"); }
          submitBtn.disabled = false;
        }, 8000);
      }).catch(function () {
        // сервер недоступен (например, превью без PHP) — предлагаем Telegram
        submitBtn.disabled = false;
        if (errEl) errEl.hidden = false;
      });
    });

    [form.elements.name, form.elements.phone].forEach(function (f) {
      if (f) f.addEventListener("input", function () { setFieldError(f, false); });
    });
  }

  /* ---------- Липкая панель: прячем возле формы ---------- */
  var stickybar = document.getElementById("stickybar");
  var zayavka = document.getElementById("zayavka");
  if (stickybar && zayavka && hasIO) {
    var barIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { stickybar.classList.toggle("is-hidden", e.isIntersecting); });
    }, { threshold: 0.15 });
    barIO.observe(zayavka);
  }

  /* ---------- Мини-касса ---------- */
  var posOrder = [];   // [{key, price, qty}] в порядке добавления
  var posShift = 0;    // накопленная «выручка смены»
  var posNo = 215;     // номер чека в шапке
  var posCount = 0;    // чеков за смену
  var posRowsEl = document.getElementById("posRows");
  var posClear = document.getElementById("posClear");

  /* строки чека — «ключевые»: печатается только новая, остальные обновляются на месте */
  function renderPosRows(dict) {
    if (!posRowsEl) return 0;
    var total = 0;
    var keep = {};
    posOrder.forEach(function (it) {
      total += it.price * it.qty;
      keep[it.key] = true;
      var row = posRowsEl.querySelector('.prow[data-key="' + it.key + '"]');
      if (!row) {
        row = document.createElement("div");
        row.className = "prow";
        row.setAttribute("data-key", it.key);
        var name = document.createElement("span");
        name.className = "prow__name";
        var qty = document.createElement("span");
        qty.className = "prow__qty num";
        var sum = document.createElement("span");
        sum.className = "prow__sum num";
        var minus = document.createElement("button"); // сторно: убрать одну
        minus.type = "button";
        minus.className = "prow__minus";
        minus.textContent = "−";
        minus.setAttribute("data-key", it.key);
        row.appendChild(name);
        row.appendChild(qty);
        row.appendChild(sum);
        row.appendChild(minus);
        posRowsEl.appendChild(row);
      }
      row.querySelector(".prow__name").textContent = dict["try." + it.key];
      row.querySelector(".prow__qty").textContent = String(it.qty);
      row.querySelector(".prow__sum").textContent = fmtSum(it.price * it.qty);
      row.querySelector(".prow__minus").setAttribute("aria-label", dict["try.remove"] + ": " + dict["try." + it.key]);
    });
    posRowsEl.querySelectorAll(".prow").forEach(function (r) {
      if (!keep[r.getAttribute("data-key")]) r.remove();
    });
    document.getElementById("posTotal").textContent = fmtSum(total);
    document.getElementById("posEmpty").hidden = posOrder.length > 0;
    document.getElementById("posPay").disabled = total === 0;
    if (posClear) posClear.hidden = posOrder.length === 0;
    updatePosBar(total);
    return total;
  }

  /* бейдж ×N на карточке блюда: пересоздаём элемент — анимация popin запускается заново */
  function syncBadge(key, qty) {
    var btn = document.querySelector('.pos__item[data-name="' + key + '"]');
    if (!btn) return;
    var badge = btn.querySelector(".pos__count");
    if (badge) badge.remove();
    if (qty <= 0) return;
    badge = document.createElement("i");
    badge.className = "pos__count";
    badge.textContent = "×" + qty;
    btn.appendChild(badge);
  }

  function changeQty(key, delta) {
    var idx = -1;
    posOrder.forEach(function (it, i) { if (it.key === key) idx = i; });
    if (idx < 0) return 0;
    var it = posOrder[idx];
    it.qty += delta;
    if (it.qty <= 0) posOrder.splice(idx, 1);
    syncBadge(key, it.qty);
    document.getElementById("posDone").hidden = true;
    renderPosRows(I18N[currentLang]);
    return it.qty;
  }

  /* плавающий итог: виден, когда корзина за экраном, а заказ не пуст */
  var posBar = document.getElementById("posBar");
  var receiptInView = true;
  var cartEl = document.querySelector(".posreceipt");

  function updatePosBar(total) {
    if (!posBar) return;
    if (total === undefined) {
      total = 0;
      posOrder.forEach(function (it) { total += it.price * it.qty; });
    }
    document.getElementById("posBarSum").textContent = fmtSum(total);
    posBar.classList.toggle("is-on", total > 0 && !receiptInView);
  }

  if (posBar && posRowsEl && cartEl) {
    if (hasIO) {
      var receiptIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) { receiptInView = e.isIntersecting; updatePosBar(); });
      }, { threshold: 0.3 });
      receiptIO.observe(cartEl);
    }
    posBar.addEventListener("click", function () {
      cartEl.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    });
  }

  if (posRowsEl) {
    // способ оплаты: наличные / Payme / Click / Uzum Bank / в долг
    var posMethod = "cash";
    document.querySelectorAll(".pmethod").forEach(function (b) {
      b.addEventListener("click", function () {
        posMethod = b.getAttribute("data-method");
        document.querySelectorAll(".pmethod").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      });
    });

    document.querySelectorAll(".pos__item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-name");
        var posPanel = btn.closest(".pos");
        if (posPanel) posPanel.classList.add("is-touched"); // подсказка больше не нужна
        var found = null;
        posOrder.forEach(function (it) { if (it.key === key) found = it; });
        if (found) {
          found.qty++;
        } else {
          found = { key: key, price: parseInt(btn.getAttribute("data-price"), 10), qty: 1 };
          posOrder.push(found);
        }
        syncBadge(key, found.qty);
        document.getElementById("posDone").hidden = true;
        renderPosRows(I18N[currentLang]);
        if (bizSelect) bizSelect.value = "cafe"; // поиграл с кассой кафе — предзаполним форму
      });
    });

    // сторно по «−» в строке; если строка исчезла — фокус на карточку блюда
    posRowsEl.addEventListener("click", function (e) {
      var b = e.target.closest(".prow__minus");
      if (!b) return;
      var key = b.getAttribute("data-key");
      if (changeQty(key, -1) <= 0) {
        var dish = document.querySelector('.pos__item[data-name="' + key + '"]');
        if (dish) dish.focus({ preventScroll: true });
      }
    });

    if (posClear) {
      posClear.addEventListener("click", function () {
        posOrder = [];
        document.querySelectorAll(".pos__count").forEach(function (b) { b.remove(); });
        document.getElementById("posDone").hidden = true;
        renderPosRows(I18N[currentLang]);
        var first = document.querySelector(".pos__item");
        if (first) first.focus({ preventScroll: true });
      });
    }

    document.getElementById("posPay").addEventListener("click", function () {
      var first = document.querySelector(".pos__item");
      if (first) first.focus({ preventScroll: true }); // кнопка сейчас станет disabled — фокус не теряем
      var total = renderPosRows(I18N[currentLang]);
      posShift += total;
      posCount++;
      posOrder = [];
      renderPosRows(I18N[currentLang]);
      document.getElementById("posRevenue").textContent = fmtSum(posShift);
      document.getElementById("posCount").textContent = String(posCount);
      posPaidMethod = posMethod;
      document.getElementById("posMethod").textContent = methodLabel(posPaidMethod);
      document.getElementById("posDone").hidden = false;
      document.querySelectorAll(".pos__count").forEach(function (b) { b.remove(); });
      var noEl = document.getElementById("posNo");
      setTimeout(function () {
        posNo++;
        if (!noEl) return;
        noEl.textContent = ("000" + posNo).slice(-4);
        if (!reducedMotion) { noEl.classList.remove("is-new"); void noEl.offsetWidth; noEl.classList.add("is-new"); }
      }, reducedMotion ? 0 : 350);
      if (!reducedMotion && cartEl) {
        cartEl.classList.remove("is-paid");
        void cartEl.offsetWidth;
        cartEl.classList.add("is-paid");
      }
    });
  }

  /* ---------- Склад магазина: «Сканировать» → остаток уменьшается ---------- */
  var shelf = document.querySelector(".shelf");
  var scanBtn = document.querySelector(".shelf__scan");
  if (shelf && scanBtn) {
    var shelfRows = shelf.querySelectorAll(".shelf__row[data-stock]");
    var shelfStock = document.getElementById("shelfStock");
    var shelfIdx = 0;
    scanBtn.addEventListener("click", function () {
      if (!shelfRows.length) return;
      var dict = I18N[currentLang];
      var row = shelfRows[shelfIdx++ % shelfRows.length];
      var left = parseInt(row.getAttribute("data-stock"), 10);
      var next = Math.max(left - 1, 0);
      row.setAttribute("data-stock", String(next));
      var qty = row.querySelector(".stock__qty");
      if (qty) qty.textContent = String(next);
      shelfRows.forEach(function (r) { r.classList.remove("is-scanned"); });
      row.classList.add("is-scanned");
      shelf.classList.add("is-used"); // подсказка больше не нужна
      if (shelfStock) {
        shelfStock.hidden = false;
        shelfStock.textContent = row.querySelector("[data-i18n]").textContent + " · " + dict["market.stock"] + " " + left + " → " + next;
        if (!reducedMotion) { shelfStock.classList.remove("is-new"); void shelfStock.offsetWidth; shelfStock.classList.add("is-new"); }
      }
      if (!reducedMotion) { shelf.classList.remove("is-scanning"); void shelf.offsetWidth; shelf.classList.add("is-scanning"); }
    });
  }

  /* ---------- Активный пункт меню по прокрутке ---------- */
  var navLinks = document.querySelectorAll(".topbar__nav a[href^='#']");
  if (navLinks.length && hasIO) {
    var spyMap = {
      hero: "", daftar: "", try: "", rules: "",
      cafe: "#cafe", market: "#cafe", pharm: "#cafe",
      platform: "#platform", day: "", ustalik: "",
      route: "#route", days: "", faq: "#zayavka", zayavka: "#zayavka"
    };
    var spyIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var href = spyMap[e.target.id];
        navLinks.forEach(function (a) {
          var on = !!href && a.getAttribute("href") === href;
          a.classList.toggle("is-active", on);
          if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-35% 0px -55% 0px", threshold: 0 });
    Object.keys(spyMap).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) spyIO.observe(s);
    });
  }

  /* ---------- Эффекты для мыши: наклон устройств, магнит кнопок ---------- */
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (finePointer && !reducedMotion) {
    document.querySelectorAll("[data-tilt]").forEach(function (el) {
      var max = parseFloat(el.getAttribute("data-tilt")) || 3;
      var raf = null, lx = 0, ly = 0;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        lx = (e.clientX - r.left) / r.width - 0.5;
        ly = (e.clientY - r.top) / r.height - 0.5;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          el.style.setProperty("--ry", (lx * max * 2).toFixed(2) + "deg");
          el.style.setProperty("--rx", (-ly * max * 2).toFixed(2) + "deg");
          raf = null;
        });
      });
      el.addEventListener("pointerleave", function () {
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
      });
    });

    // магнит: кнопка чуть тянется к курсору (не более ~5px)
    document.querySelectorAll(".btn:not(.btn--full):not(.btn--sm)").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        b.style.translate = (dx * 0.15).toFixed(1) + "px " + (dy * 0.15).toFixed(1) + "px";
      });
      b.addEventListener("pointerleave", function () { b.style.translate = ""; });
    });
  }

  /* ---------- Год ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
