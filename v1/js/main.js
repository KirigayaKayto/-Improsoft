/* ============================================
   Improsoft — логика сайта:
   переключение языков, меню, анимации, форма
   ============================================ */

(function () {
  "use strict";

  var DEFAULT_LANG = "ru";
  var STORAGE_KEY = "improsoft-lang";

  /* ---------- Переключение языка ---------- */
  function setLang(lang) {
    if (!I18N[lang]) lang = DEFAULT_LANG;
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

    document.querySelectorAll(".lang-switcher__btn").forEach(function (btn) {
      var active = btn.getAttribute("data-lang") === lang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) { /* приватный режим — игнорируем */ }
  }

  function getSavedLang() {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
    } catch (e) {
      return DEFAULT_LANG;
    }
  }

  document.querySelectorAll(".lang-switcher__btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setLang(btn.getAttribute("data-lang"));
    });
  });

  setLang(getSavedLang());

  /* ---------- Шапка при прокрутке ---------- */
  var header = document.getElementById("header");
  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Мобильное меню ---------- */
  var burger = document.getElementById("burger");
  var nav = document.getElementById("nav");

  function closeMenu() {
    nav.classList.remove("is-open");
    burger.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
  }

  burger.addEventListener("click", function () {
    var open = nav.classList.toggle("is-open");
    burger.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll(".nav__link").forEach(function (link) {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("click", function (e) {
    if (nav.classList.contains("is-open") && !nav.contains(e.target) && !burger.contains(e.target)) {
      closeMenu();
    }
  });

  /* ---------- Появление секций ---------- */
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach(function (el) {
      observer.observe(el);
    });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* ---------- Форма заявки ---------- */
  var form = document.getElementById("contactForm");
  var success = document.getElementById("formSuccess");

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var name = form.elements.name;
    var phone = form.elements.phone;
    var valid = true;

    [name, phone].forEach(function (field) {
      var empty = !field.value.trim();
      field.classList.toggle("is-invalid", empty);
      if (empty) valid = false;
    });

    if (!valid) return;

    // TODO: подключите отправку на бэкенд или сервис форм
    // (например, Formspree, Telegram-бот или собственный API):
    // fetch("/api/lead", { method: "POST", body: new FormData(form) })
    success.hidden = false;
    form.querySelector("button[type=submit]").disabled = true;

    setTimeout(function () {
      form.reset();
      success.hidden = true;
      form.querySelector("button[type=submit]").disabled = false;
    }, 6000);
  });

  [form.elements.name, form.elements.phone].forEach(function (field) {
    field.addEventListener("input", function () {
      field.classList.remove("is-invalid");
    });
  });

  /* ---------- Год в подвале ---------- */
  document.getElementById("year").textContent = String(new Date().getFullYear());
})();
