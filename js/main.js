/* ============================================================
   Improsoft v3.5 «BIR CHIZIQ» — логика:
   линия-позвоночник, рисуемые узлы, дафтар (с повтором), язык-«печать»,
   мини-касса (сторно, номер чека), кухонный тикет (тап, часы),
   чек магазина («скан» остатка), даты партий от текущей даты,
   форма-чек, липкая панель; v3.5: scroll-reveal, счётчики hero,
   печатная строка, лента-чек, живое вне экрана на паузе (.is-live),
   scrollspy, прячущаяся шапка, кончик пера, авто-подсказки,
   наклон бумаги / магнит кнопок / чернильное пятно (только мышь)
   ============================================================ */

(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var DEFAULT_LANG = "ru";
  var STORAGE_KEY = "improsoft-lang";
  var currentLang = DEFAULT_LANG;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

    // статусы кухонного тикета живут в data-state — переводим по нему
    document.querySelectorAll(".ticket__state").forEach(function (s) {
      s.textContent = dict[s.getAttribute("data-state") === "done" ? "cafe.served" : "cafe.cooking"];
    });

    // даты партий (Pharm) считаются от сегодняшнего дня по шаблону pharm.expiry с {d}
    renderPharmDates(dict, lang);

    // способ оплаты в строке «Чек закрыт» — на новом языке
    if (posPaidMethod) { var pmEl = document.getElementById("posMethod"); if (pmEl) pmEl.textContent = methodLabel(posPaidMethod); }

    // строки мини-чека тоже перепечатываем на новом языке
    if (typeof posOrder !== "undefined" && posOrder && posOrder.length) renderPosRows(dict);

    document.querySelectorAll(".stamp[data-lang]").forEach(function (btn) {
      var active = btn.getAttribute("data-lang") === lang;
      btn.setAttribute("aria-pressed", String(active));
    });

    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* приватный режим */ }

    // v3.5: печатная строка начинает заново на новом языке, лента подстраивает скорость под длину текста
    restartTypewriter();
    syncTapeSpeed();
  }

  /* даты партий: A — через 17 месяцев (OK), B — через 2 (СКОРО); никогда не устаревают */
  function renderPharmDates(dict, lang) {
    var now = new Date();
    document.querySelectorAll(".batch__date[data-months]").forEach(function (el) {
      var d = new Date(now.getFullYear(), now.getMonth() + parseInt(el.getAttribute("data-months"), 10), 1);
      var mm = ("0" + (d.getMonth() + 1)).slice(-2);
      el.textContent = dict["pharm.expiry"].replace("{d}", mm + (lang === "en" ? "/" : ".") + d.getFullYear());
    });
  }

  /* подпись способа оплаты по ключу чипа (Наличные / Payme / Click / Uzum Bank / В долг) */
  var posPaidMethod = "";
  function methodLabel(key) {
    var b = document.querySelector('.pmethod[data-method="' + key + '"]');
    return b ? b.textContent : "";
  }

  /* сменить ключ элемента: applyLang читает data-i18n, поэтому подпись переживёт смену языка */
  function setKey(el, key) {
    el.setAttribute("data-i18n", key);
    el.textContent = I18N[currentLang][key];
  }

  function setLang(lang, withSweep) {
    if (withSweep && !reducedMotion) {
      var head = document.getElementById("printhead");
      head.classList.remove("is-sweeping");
      void head.offsetWidth; // перезапуск анимации
      head.classList.add("is-sweeping");
      setTimeout(function () { applyLang(lang); }, 130);
    } else {
      applyLang(lang);
    }
  }

  document.querySelectorAll(".stamp[data-lang]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      // «шлепок» штампа: новый запуск анимации
      if (!reducedMotion) { btn.classList.remove("is-stamped"); void btn.offsetWidth; btn.classList.add("is-stamped"); }
      setLang(btn.getAttribute("data-lang"), true);
    });
  });

  var saved = DEFAULT_LANG;
  try { saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG; } catch (e) {}
  applyLang(saved);

  /* ---------- Шапка ---------- */
  var topbar = document.getElementById("topbar");
  var ticking = false;

  /* ---------- Позвоночник: заполнение по прокрутке ---------- */
  var spineFill = document.getElementById("spineFill");
  var spineDot = document.getElementById("spineDot"); // кончик пера на конце линии
  var lastY = 0;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 0 ? window.scrollY / max : 0;
      // квантуем до 1%, чтобы не дёргать стиль каждый пиксель
      p = Math.round(p * 100) / 100;
      spineFill.style.transform = "scaleY(" + p + ")";
      if (spineDot) spineDot.style.top = (p * 100) + "%";
      var y = window.scrollY;
      topbar.classList.toggle("is-scrolled", y > 8);
      // шапка прячется при прокрутке вниз и возвращается при прокрутке вверх
      if (!reducedMotion) {
        if (y > 240 && y > lastY + 4) topbar.classList.add("is-hidden");
        else if (y < lastY - 4 || y <= 240) topbar.classList.remove("is-hidden");
      }
      lastY = y;
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Рисуемые линии: измеряем длины путей ---------- */
  document.querySelectorAll(".drawline, .drawknot").forEach(function (path) {
    try {
      var len = Math.ceil(path.getTotalLength()) + 2;
      path.style.setProperty("--len", len);
    } catch (e) { /* элемент не path — пропускаем */ }
  });

  /* один одноразовый наблюдатель: секция вошла — узел рисуется */
  if ("IntersectionObserver" in window) {
    var drawIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-drawn");
          drawIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.35 });
    document.querySelectorAll(".hero__line, .knot, .dome__visual, .route__map, .tamom__mark").forEach(function (el) {
      drawIO.observe(el);
    });
  } else {
    document.querySelectorAll(".hero__line, .knot, .dome__visual, .route__map, .tamom__mark").forEach(function (el) {
      el.classList.add("is-drawn");
    });
  }
  // hero рисуется сразу при загрузке
  var heroLine = document.querySelector(".hero__line");
  if (heroLine) setTimeout(function () { heroLine.classList.add("is-drawn"); }, 250);

  /* ---------- Дафтар: тап-реконсиляция ---------- */
  var entries = document.querySelectorAll(".dentry");
  var daftarBoard = document.querySelector(".daftar__board");
  var doneCount = 0;
  var daftarRun = 0;   // токен: «Начать заново» обесценивает отложенные таймеры
  var allBtn = document.getElementById("daftarAll");
  var daftarStamp = document.getElementById("daftarStamp");

  var mobileDaftar = window.matchMedia("(max-width: 680px)");

  function inlineClone(row, after) {
    // на мобильном журнал скрыт — строка печатается прямо в дафтаре
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
    if (daftarBoard) daftarBoard.classList.add("is-touched"); // подсказка-пульс больше не нужна
    document.getElementById("daftarEmpty").hidden = true;
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
        total.hidden = false;
        if (mobileDaftar.matches) {
          var paper = document.getElementById("daftarPaper");
          var clone = total.cloneNode(true);
          clone.hidden = false;
          clone.removeAttribute("id");
          clone.classList.add("lrow--inline");
          paper.insertBefore(clone, paper.querySelector(".daftar__papernote"));
        }
        if (daftarStamp) daftarStamp.hidden = false; // штамп «ПРОВЕДЕНО»
      }, reducedMotion ? 0 : 350);
      // кнопка не гаснет, а предлагает повтор
      setKey(allBtn, "daftar.again");
    }
  }

  function resetDaftar() {
    daftarRun++;
    doneCount = 0;
    entries.forEach(function (e) { e.classList.remove("is-done"); e.removeAttribute("aria-disabled"); });
    document.querySelectorAll(".daftar__ledger .lrow").forEach(function (r) { r.hidden = true; }); // включая итог
    document.querySelectorAll("#daftarPaper .lrow--inline").forEach(function (c) { c.remove(); }); // мобильные клоны
    document.getElementById("daftarEmpty").hidden = false;
    if (daftarStamp) daftarStamp.hidden = true;
    setKey(allBtn, "daftar.all");
  }

  entries.forEach(function (entry) {
    entry.addEventListener("click", function () { reconcile(entry); });
  });

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

  // авто-подсказка (десктоп): дафтар на экране, никто не нажимал — первая запись проводится сама
  if (daftarBoard && entries.length && "IntersectionObserver" in window && !reducedMotion) {
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

  /* ---------- Кухонный тикет: живые статусы, тап «подано», часы ---------- */
  var ticket = document.getElementById("cafeTicket");
  var ticketTimer = null;
  var ticketNo = 214;
  var ticketClock = document.getElementById("ticketClock");

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function setClock() {
    if (!ticketClock) return;
    var d = new Date();
    ticketClock.textContent = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  setClock();
  setInterval(setClock, 30000); // живое время посетителя — это смена текста, не движение

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
      // всё подано — новый тикет: статусы обратно, номер растёт, строки допечатываются
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

  if (ticket && "IntersectionObserver" in window && !reducedMotion) {
    var ticketIO = new IntersectionObserver(function (entries2) {
      entries2.forEach(function (entry) {
        if (entry.isIntersecting) startTicket(); else stopTicket();
      });
    }, { threshold: 0.4 });
    ticketIO.observe(ticket);
  }

  // тап по «готовится» отдаёт блюдо; если всё подано — открывает новый тикет
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
      bizSelect.value = link.getAttribute("data-product");
    });
  });

  /* ---------- Форма-чек ---------- */
  var form = document.getElementById("leadForm");
  var done = document.getElementById("formDone");
  // без JS работает нативная валидация браузера; с JS — своя
  form.setAttribute("novalidate", "");

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
    errEl.hidden = true;

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
      done.hidden = false;
      if (!reducedMotion) {
        var line = document.getElementById("doneLine");
        line.style.animation = "printrow .9s ease";
      }
      setTimeout(function () {
        form.reset();
        done.hidden = true;
        submitBtn.disabled = false;
      }, 8000);
    }).catch(function () {
      // сервер недоступен (например, превью без PHP) — предлагаем Telegram
      submitBtn.disabled = false;
      errEl.hidden = false;
    });
  });

  /* ошибка поля: подчёркивание + текст + aria — видно и слышно */
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

  [form.elements.name, form.elements.phone].forEach(function (f) {
    f.addEventListener("input", function () { setFieldError(f, false); });
  });

  /* ---------- Липкая панель: прячем возле формы ---------- */
  var stickybar = document.getElementById("stickybar");
  var zayavka = document.getElementById("zayavka");
  if ("IntersectionObserver" in window) {
    var barIO = new IntersectionObserver(function (entries3) {
      entries3.forEach(function (entry) {
        stickybar.classList.toggle("is-hidden", entry.isIntersecting);
      });
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

  function fmtSum(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

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
        var dots = document.createElement("span");
        dots.className = "prow__dots";
        var sum = document.createElement("span");
        sum.className = "mono prow__sum";
        var minus = document.createElement("button"); // сторно: убрать одну
        minus.type = "button";
        minus.className = "prow__minus mono";
        minus.textContent = "−";
        minus.setAttribute("data-key", it.key);
        row.appendChild(name);
        row.appendChild(dots);
        row.appendChild(sum);
        row.appendChild(minus);
        posRowsEl.appendChild(row);
      }
      row.querySelector(".prow__name").textContent = dict["try." + it.key] + (it.qty > 1 ? " ×" + it.qty : "");
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

  /* бейдж ×N на кнопке блюда: пересоздаём элемент — анимация popin запускается заново */
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

  /* плавающий итог: виден, когда чек за экраном, а заказ не пуст */
  var posBar = document.getElementById("posBar");
  var receiptInView = true;

  function updatePosBar(total) {
    if (!posBar) return;
    if (total === undefined) {
      total = 0;
      posOrder.forEach(function (it) { total += it.price * it.qty; });
    }
    document.getElementById("posBarSum").textContent = fmtSum(total);
    posBar.classList.toggle("is-on", total > 0 && !receiptInView);
  }

  if (posBar && posRowsEl) {
    if ("IntersectionObserver" in window) {
      var receiptIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          receiptInView = e.isIntersecting;
          updatePosBar();
        });
      }, { threshold: 0.3 });
      receiptIO.observe(document.querySelector(".posreceipt"));
    }
    posBar.addEventListener("click", function () {
      document.querySelector(".posreceipt").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
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
        if (posPanel) posPanel.classList.add("is-touched"); // подсказка-пульс больше не нужна
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
        bizSelect.value = "cafe"; // поиграл с кассой кафе — предзаполним форму
      });
    });

    // сторно по «−» в строке; если строка исчезла — фокус на кнопку блюда
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
      // чек «отрывается», бейджи очищаются, следующий номер допечатывается после отрыва
      document.querySelectorAll(".pos__count").forEach(function (b) { b.remove(); });
      var noEl = document.getElementById("posNo");
      setTimeout(function () {
        posNo++;
        if (!noEl) return;
        noEl.textContent = ("000" + posNo).slice(-4);
        if (!reducedMotion) { noEl.classList.remove("is-new"); void noEl.offsetWidth; noEl.classList.add("is-new"); }
      }, reducedMotion ? 0 : 450);
      if (!reducedMotion) {
        var receipt = document.querySelector(".posreceipt");
        receipt.classList.remove("is-paid");
        void receipt.offsetWidth;
        receipt.classList.add("is-paid");
      }
    });
  }

  /* ---------- Чек магазина: тап — «скан» товара и живой остаток ---------- */
  var shelf = document.querySelector(".shelf");
  if (shelf) {
    var shelfRows = shelf.querySelectorAll(".shelf__row[data-stock]");
    var shelfStock = document.getElementById("shelfStock");
    var shelfIdx = 0;
    var scanShelf = function () {
      if (!shelfRows.length) return;
      var dict = I18N[currentLang];
      var row = shelfRows[shelfIdx++ % shelfRows.length];
      var left = parseInt(row.getAttribute("data-stock"), 10);
      var next = Math.max(left - 1, 0);
      row.setAttribute("data-stock", String(next));
      shelfRows.forEach(function (r) { r.classList.remove("is-scanned"); });
      row.classList.add("is-scanned");
      shelf.classList.add("is-used"); // подсказка больше не нужна
      if (shelfStock) {
        shelfStock.hidden = false;
        shelfStock.textContent = row.querySelector("[data-i18n]").textContent + " · " + dict["market.stock"] + " " + left + " → " + next;
        if (!reducedMotion) { shelfStock.classList.remove("is-new"); void shelfStock.offsetWidth; shelfStock.classList.add("is-new"); }
      }
      if (!reducedMotion) {
        // большой штрих-код над главой «сканирует» ещё раз
        var big = document.querySelector(".knot--barcode .scanline");
        if (big) { big.style.animation = "none"; void big.offsetWidth; big.style.animation = "scan .6s ease"; }
      }
    };
    shelf.addEventListener("click", scanShelf);
    shelf.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); scanShelf(); }
    });
  }

  /* ---------- Счётчики: число «допечатывается» (цифры hero и будущая секция .proof) ---------- */
  function countUp(el, target, dur) {
    if (reducedMotion) { el.textContent = String(target); return; }
    var start = null;
    var stepFn = function (ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3); // ease-out
      el.textContent = String(Math.round(target * e));
      if (p < 1) requestAnimationFrame(stepFn);
    };
    requestAnimationFrame(stepFn);
  }

  var proofNum = document.getElementById("proofNum");
  if (proofNum && "IntersectionObserver" in window) {
    var proofTarget = parseInt(proofNum.getAttribute("data-target"), 10) || 0;
    var proofIO = new IntersectionObserver(function (entries4) {
      entries4.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        proofIO.disconnect();
        countUp(proofNum, proofTarget, 1200);
      });
    }, { threshold: 0.6 });
    proofIO.observe(proofNum);
  }

  // цифры hero (3 / 7 / 4) допечатываются, когда линия дорисовала насечки (~1.15 с после загрузки)
  var heroCounts = document.querySelectorAll(".hero [data-count]");
  if (heroCounts.length && !reducedMotion) {
    heroCounts.forEach(function (b) { b.textContent = "0"; });
    setTimeout(function () {
      heroCounts.forEach(function (b) { countUp(b, parseInt(b.getAttribute("data-count"), 10) || 0, 600); });
    }, 1150);
  }

  /* ---------- v3.5: scroll-reveal — блоки всплывают, как строки на чековой ленте ---------- */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window) {
    var revealIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        // показываем и то, что уже выше экрана (перезагрузка посреди страницы, переход по якорю)
        if (e.isIntersecting || e.boundingClientRect.bottom < 0) {
          e.target.classList.add("is-in");
          revealIO.unobserve(e.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
    revealEls.forEach(function (el) { revealIO.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- v3.5: непрерывные анимации живут только на экране (бережём батарею) ---------- */
  var liveEls = document.querySelectorAll("[data-live]");
  if ("IntersectionObserver" in window) {
    var liveIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle("is-live", e.isIntersecting); });
    }, { threshold: 0 });
    liveEls.forEach(function (el) { liveIO.observe(el); });
  } else {
    liveEls.forEach(function (el) { el.classList.add("is-live"); });
  }

  /* ---------- v3.5: печатная строка hero — касса для кафе → учёт для магазина → партии для аптеки ---------- */
  var typeEl = document.getElementById("heroType");
  var heroSec = document.querySelector(".hero");
  var typeTimer = null;
  function restartTypewriter() {
    if (!typeEl) return;
    if (typeTimer) { clearTimeout(typeTimer); typeTimer = null; }
    var dict = I18N[currentLang];
    var phrases = [dict["hero.type1"], dict["hero.type2"], dict["hero.type3"]].filter(Boolean);
    if (!phrases.length) return;
    typeEl.textContent = phrases[0]; // первая фраза уже напечатана
    if (reducedMotion) return;
    var pi = 0, ci = phrases[0].length, deleting = false;
    function tick() {
      var wait;
      if (document.hidden || (heroSec && !heroSec.classList.contains("is-live"))) {
        wait = 600; // вкладка или hero за кадром — просто ждём
      } else if (!deleting && ci === phrases[pi].length) {
        deleting = true; wait = 1900; // пауза, чтобы прочитать
      } else if (deleting && ci === 0) {
        deleting = false; pi = (pi + 1) % phrases.length; wait = 350;
      } else {
        ci += deleting ? -1 : 1;
        typeEl.textContent = phrases[pi].slice(0, ci);
        wait = deleting ? 28 : 58;
      }
      typeTimer = setTimeout(tick, wait);
    }
    typeTimer = setTimeout(tick, 2200);
  }
  restartTypewriter();

  /* ---------- v3.5: лента-чек — дубликат списка для бесшовного цикла, скорость от длины текста ---------- */
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

  /* ---------- v3.5: активный пункт меню по прокрутке ---------- */
  var navLinks = document.querySelectorAll(".topbar__nav a[href^='#']");
  if (navLinks.length && "IntersectionObserver" in window) {
    var spyMap = {
      chizma: "", daftar: "", try: "", rules: "",
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

  /* ---------- v3.5: эффекты для мыши — наклон бумаги, магнит кнопок, чернильное пятно, параллакс линии ---------- */
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (finePointer && !reducedMotion) {
    // 3D-наклон: бумага поворачивается к курсору (углы — CSS-переменные, transform в styles.css)
    document.querySelectorAll("[data-tilt]").forEach(function (el) {
      var max = parseFloat(el.getAttribute("data-tilt")) || 6;
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

    // магнит: кнопка чуть тянется к курсору (не более ~6px)
    document.querySelectorAll(".btn:not(.btn--full)").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        b.style.translate = (dx * 0.18).toFixed(1) + "px " + (dy * 0.18).toFixed(1) + "px";
      });
      b.addEventListener("pointerleave", function () { b.style.translate = ""; });
    });

    // чернильное пятно в тёмных главах: мягкий свет следует за курсором
    document.querySelectorAll(".inkglow").forEach(function (g) {
      var sec = g.parentNode, raf2 = null, px = 0, py = 0;
      sec.addEventListener("pointermove", function (e) {
        var r = sec.getBoundingClientRect();
        px = e.clientX - r.left; py = e.clientY - r.top;
        if (raf2) return;
        raf2 = requestAnimationFrame(function () {
          g.style.transform = "translate3d(" + Math.round(px) + "px," + Math.round(py) + "px,0)";
          g.classList.add("is-on");
          raf2 = null;
        });
      });
      sec.addEventListener("pointerleave", function () { g.classList.remove("is-on"); });
    });

    // линия hero чуть смещается за курсором
    var heroLineSvg = document.querySelector(".hero__line svg");
    if (heroSec && heroLineSvg) {
      var hraf = null, hx = 0, hy = 0;
      heroSec.addEventListener("pointermove", function (e) {
        hx = e.clientX / window.innerWidth - 0.5;
        hy = e.clientY / window.innerHeight - 0.5;
        if (hraf) return;
        hraf = requestAnimationFrame(function () {
          heroLineSvg.style.translate = (hx * 12).toFixed(1) + "px " + (hy * 8).toFixed(1) + "px";
          hraf = null;
        });
      });
      heroSec.addEventListener("pointerleave", function () { heroLineSvg.style.translate = ""; });
    }
  }


  /* ---------- Год ---------- */
  document.getElementById("year").textContent = String(new Date().getFullYear());
})();
