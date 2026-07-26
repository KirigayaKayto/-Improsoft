/* ============================================================
   Improsoft v2 «BIR CHIZIQ» — логика:
   линия-позвоночник, рисуемые узлы, дафтар, язык-«печать»,
   форма-чек, липкая панель
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

    // строки демо-чека тоже перепечатываем на новом языке
    if (typeof posOrder !== "undefined" && posOrder && posOrder.length) renderPosRows(dict);

    document.querySelectorAll(".stamp[data-lang]").forEach(function (btn) {
      var active = btn.getAttribute("data-lang") === lang;
      btn.setAttribute("aria-pressed", String(active));
    });

    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* приватный режим */ }
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
      topbar.classList.toggle("is-scrolled", window.scrollY > 8);
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
    document.querySelectorAll(".hero__line, .knot, .dome__visual, .route__map").forEach(function (el) {
      drawIO.observe(el);
    });
  } else {
    document.querySelectorAll(".hero__line, .knot, .dome__visual, .route__map").forEach(function (el) {
      el.classList.add("is-drawn");
    });
  }
  // hero рисуется сразу при загрузке
  var heroLine = document.querySelector(".hero__line");
  if (heroLine) setTimeout(function () { heroLine.classList.add("is-drawn"); }, 250);

  /* ---------- Дафтар: тап-реконсиляция ---------- */
  var entries = document.querySelectorAll(".dentry");
  var doneCount = 0;

  var mobileDaftar = window.matchMedia("(max-width: 680px)");

  function inlineClone(row, after) {
    // на мобильном журнал скрыт — строка печатается прямо в дафтаре
    var clone = row.cloneNode(true);
    clone.hidden = false;
    clone.classList.add("lrow--inline");
    after.insertAdjacentElement("afterend", clone);
  }

  function reconcile(entry) {
    if (entry.classList.contains("is-done")) return;
    entry.classList.add("is-done");
    entry.setAttribute("aria-disabled", "true");
    document.getElementById("daftarEmpty").hidden = true;
    var row = document.querySelector('.daftar__ledger .lrow[data-row="' + entry.getAttribute("data-row") + '"]');
    if (row) {
      row.hidden = false;
      if (mobileDaftar.matches) inlineClone(row, entry);
    }
    doneCount++;
    if (doneCount === entries.length) {
      var total = document.getElementById("daftarTotal");
      setTimeout(function () {
        total.hidden = false;
        if (mobileDaftar.matches) {
          var paper = document.getElementById("daftarPaper");
          var note = paper.querySelector(".daftar__papernote");
          var clone = total.cloneNode(true);
          clone.hidden = false;
          clone.removeAttribute("id");
          clone.classList.add("lrow--inline");
          paper.insertBefore(clone, note);
        }
      }, 350);
      var allBtn = document.getElementById("daftarAll");
      allBtn.disabled = true;
      allBtn.style.opacity = ".4";
    }
  }

  entries.forEach(function (entry) {
    entry.addEventListener("click", function () { reconcile(entry); });
  });

  document.getElementById("daftarAll").addEventListener("click", function () {
    var delay = 0;
    entries.forEach(function (entry) {
      if (entry.classList.contains("is-done")) return;
      setTimeout(function () { reconcile(entry); }, delay);
      delay += reducedMotion ? 0 : 260;
    });
  });

  /* ---------- Кухонный тикет: живые статусы ---------- */
  var ticket = document.getElementById("cafeTicket");
  var ticketTimer = null;

  function tickTicket() {
    var states = ticket.querySelectorAll(".ticket__state");
    var cooking = [];
    states.forEach(function (s) { if (s.getAttribute("data-state") === "cook") cooking.push(s); });
    var dict = I18N[currentLang];
    if (cooking.length === 0) {
      // всё подано — новая «смена»: все обратно в готовится
      states.forEach(function (s) {
        s.setAttribute("data-state", "cook");
        s.textContent = dict["cafe.cooking"];
      });
    } else {
      var next = cooking[0];
      next.setAttribute("data-state", "done");
      next.textContent = dict["cafe.served"];
    }
  }

  if (ticket && "IntersectionObserver" in window && !reducedMotion) {
    var ticketIO = new IntersectionObserver(function (entries2) {
      entries2.forEach(function (entry) {
        if (entry.isIntersecting && !ticketTimer) {
          ticketTimer = setInterval(tickTicket, 2400); // пауза за кадром — бережём батарею
        } else if (!entry.isIntersecting && ticketTimer) {
          clearInterval(ticketTimer);
          ticketTimer = null;
        }
      });
    }, { threshold: 0.4 });
    ticketIO.observe(ticket);
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
    var valid = true;
    [name, phone].forEach(function (f) {
      var empty = !f.value.trim();
      f.classList.toggle("is-invalid", empty);
      if (empty) valid = false;
    });
    if (!valid) return;

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

  [form.elements.name, form.elements.phone].forEach(function (f) {
    f.addEventListener("input", function () { f.classList.remove("is-invalid"); });
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

  /* ---------- Демо-касса ---------- */
  var posOrder = [];   // [{key, price, qty}] в порядке добавления
  var posShift = 0;    // накопленная «выручка смены»
  var posRowsEl = document.getElementById("posRows");

  function fmtSum(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  function renderPosRows(dict) {
    if (!posRowsEl) return 0;
    posRowsEl.innerHTML = "";
    var total = 0;
    posOrder.forEach(function (it) {
      total += it.price * it.qty;
      var row = document.createElement("div");
      row.className = "prow";
      var name = document.createElement("span");
      name.textContent = dict["try." + it.key] + (it.qty > 1 ? " ×" + it.qty : "");
      var dots = document.createElement("span");
      dots.className = "prow__dots";
      var sum = document.createElement("span");
      sum.className = "mono";
      sum.textContent = fmtSum(it.price * it.qty);
      row.appendChild(name);
      row.appendChild(dots);
      row.appendChild(sum);
      posRowsEl.appendChild(row);
    });
    document.getElementById("posTotal").textContent = fmtSum(total);
    document.getElementById("posEmpty").hidden = posOrder.length > 0;
    document.getElementById("posPay").disabled = total === 0;
    updatePosBar(total);
    return total;
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
    document.querySelectorAll(".pos__item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-name");
        var found = null;
        posOrder.forEach(function (it) { if (it.key === key) found = it; });
        if (found) {
          found.qty++;
        } else {
          found = { key: key, price: parseInt(btn.getAttribute("data-price"), 10), qty: 1 };
          posOrder.push(found);
        }
        // бейдж ×N на самой кнопке: обратная связь в точке касания
        var badge = btn.querySelector(".pos__count");
        if (!badge) {
          badge = document.createElement("i");
          badge.className = "pos__count";
          btn.appendChild(badge);
        }
        badge.textContent = "×" + found.qty;
        if (!reducedMotion) {
          badge.style.animation = "none";
          void badge.offsetWidth;
          badge.style.animation = "";
        }
        document.getElementById("posDone").hidden = true;
        renderPosRows(I18N[currentLang]);
        bizSelect.value = "cafe"; // поиграл с кассой кафе — предзаполним форму
      });
    });

    document.getElementById("posPay").addEventListener("click", function () {
      var total = renderPosRows(I18N[currentLang]);
      posShift += total;
      posOrder = [];
      renderPosRows(I18N[currentLang]);
      document.getElementById("posRevenue").textContent = fmtSum(posShift);
      document.getElementById("posDone").hidden = false;
      // чек «отрывается», бейджи очищаются
      document.querySelectorAll(".pos__count").forEach(function (b) { b.remove(); });
      if (!reducedMotion) {
        var receipt = document.querySelector(".posreceipt");
        receipt.classList.remove("is-paid");
        void receipt.offsetWidth;
        receipt.classList.add("is-paid");
      }
    });
  }

  /* ---------- Счётчик клиентов (оживёт вместе с секцией .proof) ---------- */
  var proofNum = document.getElementById("proofNum");
  if (proofNum && "IntersectionObserver" in window) {
    var proofTarget = parseInt(proofNum.getAttribute("data-target"), 10) || 0;
    var proofIO = new IntersectionObserver(function (entries4) {
      entries4.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        proofIO.disconnect();
        if (reducedMotion) { proofNum.textContent = String(proofTarget); return; }
        var start = null;
        var stepFn = function (ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / 1200, 1);
          proofNum.textContent = String(Math.round(proofTarget * p));
          if (p < 1) requestAnimationFrame(stepFn);
        };
        requestAnimationFrame(stepFn);
      });
    }, { threshold: 0.6 });
    proofIO.observe(proofNum);
  }

  /* ---------- Год ---------- */
  document.getElementById("year").textContent = String(new Date().getFullYear());
})();
