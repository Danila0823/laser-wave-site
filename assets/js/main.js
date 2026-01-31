/* Laser Wave - static + content.json renderer
   Replace placeholders in content.json:
   - [YANDEX_METRIKA_ID], [VK_PIXEL_ID]
   - [WEBHOOK_URL]
   - legal links, map embed, VK widget, masters data
*/

let CONTENT = null;
let calcUsed = false;

function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

const PLACEHOLDER_TOKENS = [
    "[УТОЧНИТЬ",
    "[WEBHOOK_URL",
    "[YANDEX_METRIKA_ID",
    "[VK_PIXEL_ID"
];

function isPlaceholder(value) {
    const str = String(value ?? "");
    return PLACEHOLDER_TOKENS.some(token => str.includes(token));
}

function cleanText(value) {
    return isPlaceholder(value) ? "" : String(value ?? "");
}

function rub(n) {
    if (typeof n !== "number" || !isFinite(n)) return "\u2014";
    return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + "\u00A0\u20BD";
}

function getUtm() {
    const url = new URL(window.location.href);
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    const utm = {};
    keys.forEach(k => { const v = url.searchParams.get(k); if (v) utm[k] = v; });
    // persist
    if (Object.keys(utm).length) localStorage.setItem("lw_utm", JSON.stringify(utm));
    try {
        const saved = JSON.parse(localStorage.getItem("lw_utm") || "{}");
        return Object.keys(utm).length ? utm : saved;
    } catch { return utm; }
}

function withUtm(urlStr) {
    try {
        const utm = getUtm();
        const u = new URL(urlStr);
        Object.entries(utm).forEach(([k, v]) => u.searchParams.set(k, v));
        return u.toString();
    } catch {
        return urlStr;
    }
}

function track(name, params = {}) {
    // Yandex Metrika
    if (window.ym && CONTENT?.analytics?.yandexMetrikaId && !String(CONTENT.analytics.yandexMetrikaId).includes("[")) {
        window.ym(CONTENT.analytics.yandexMetrikaId, "reachGoal", name, params);
    }
    // VK Pixel
    if (window.VK && typeof window.VK.Goal === "function") {
        try { window.VK.Goal(name, params); } catch { }
    }
}

async function loadContent() {
    const res = await fetch((window.__ASSET_PREFIX__ || "") + "assets/data/content.json", { cache: "no-store" });
    if (!res.ok) throw new Error("content.json not found");
    CONTENT = await res.json();
    return CONTENT;
}

function setText(id, text) {
    const el = qs(`[data-bind="${id}"]`);
    if (!el) return;
    if (isPlaceholder(text)) {
        el.textContent = "";
        return;
    }
    el.textContent = text;
}

function setHref(id, href) {
    const el = qs(`[data-href="${id}"]`);
    if (!el) return;
    if (!href || isPlaceholder(href)) {
        el.setAttribute("href", "#");
        el.setAttribute("aria-disabled", "true");
        return;
    }
    el.setAttribute("href", href);
}

function renderHeaderFooter() {
    // Contacts
    setText("brandName", CONTENT.brand.name);
    setText("brandCity", CONTENT.brand.city);
    setText("addressLine", CONTENT.contacts.addressLine);
    setText("addressShort", CONTENT.contacts.addressShort);
    setText("hours", CONTENT.contacts.hours);
    setText("phoneDisplay", CONTENT.contacts.phoneDisplay);

    qsa('[data-phone]').forEach(a => a.setAttribute("href", "tel:" + CONTENT.contacts.phoneE164));
    qsa('[data-vk]').forEach(a => a.setAttribute("href", CONTENT.contacts.links.vk));
    qsa('[data-tg]').forEach(a => a.setAttribute("href", CONTENT.contacts.links.telegram));
    qsa('[data-wa]').forEach(a => a.setAttribute("href", CONTENT.contacts.links.whatsapp));
    qsa('[data-max]').forEach(a => {
        const maxLink = CONTENT.contacts.links.max;
        if (!maxLink || isPlaceholder(maxLink)) a.classList.add("hidden");
        else a.setAttribute("href", maxLink);
    });

    // Booking links
    qsa('[data-booking-link]').forEach(a => {
        a.setAttribute("href", withUtm(CONTENT.contacts.links.yclients));
        a.addEventListener("click", () => track("book_click"));
    });

    // Messenger tracking
    qsa('[data-vk]').forEach(a => a.addEventListener("click", () => track("messenger_click_vk")));
    qsa('[data-tg]').forEach(a => a.addEventListener("click", () => track("messenger_click_tg")));
    qsa('[data-wa]').forEach(a => a.addEventListener("click", () => track("messenger_click_wa")));
    qsa('[data-phone]').forEach(a => a.addEventListener("click", () => track("phone_click")));

    // Trust
    setText("trustYandexText", CONTENT.trust.yandex.text);
    const vkRating = cleanText(CONTENT.trust.vk.ratingText);
    const vkCount = cleanText(CONTENT.trust.vk.reviewsCountText);
    const vkBadge = qs('[data-bind="trustVkText"]');
    if (vkBadge && (!vkRating || !vkCount)) vkBadge.classList.add("hidden");
    else if (vkBadge) vkBadge.textContent = `VK: ${vkRating}, ${vkCount}`;

    const replyText = cleanText(CONTENT.trust.replyTime);
    const replyEl = qs('[data-bind="replyTime"]');
    if (replyEl) {
        if (!replyText) {
            const badge = replyEl.closest(".badge");
            if (badge) badge.classList.add("hidden");
        } else {
            replyEl.textContent = replyText;
        }
    }

    setHref("privacy", CONTENT.legal.privacyPolicyUrl);
    setHref("offer", CONTENT.legal.offerUrl);
    setHref("consent", CONTENT.legal.consentUrl);

}

function initThemeToggle() {
    const root = document.documentElement;
    const key = "lw-theme";
    const stored = localStorage.getItem(key);
    if (stored === "light") root.setAttribute("data-theme", "light");
    if (stored === "dark") root.removeAttribute("data-theme");

    const btn = qs("[data-theme-toggle]");
    const icon = qs("[data-theme-icon]");
    if (!btn || !icon) return;

    function updateToggle() {
        const isLight = root.getAttribute("data-theme") === "light";
        btn.setAttribute("aria-checked", isLight ? "true" : "false");
        icon.textContent = isLight ? "☀" : "🌙";
    }

    updateToggle();
    btn.addEventListener("click", () => {
        const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
        if (next === "dark") root.removeAttribute("data-theme");
        else root.setAttribute("data-theme", "light");
        localStorage.setItem(key, next);
        updateToggle();
    });
}

function applyGenderPrices(genderKey) {
    const gender = CONTENT.pricing.gender[genderKey] || CONTENT.pricing.gender.women;
    const m = gender.multiplier;

    qsa("[data-price]").forEach(el => {
        const base = Number(el.getAttribute("data-price"));
        const final = base * m;
        el.textContent = rub(final);
    });

    qsa("[data-price-range]").forEach(el => {
        const from = Number(el.getAttribute("data-from"));
        const to = Number(el.getAttribute("data-to"));
        el.textContent = `${rub(from * m)} - ${rub(to * m)}`;
    });

    // Note for men
    qsa("[data-men-note]").forEach(note => {
        if (genderKey === "men") {
            note.textContent = gender.note || "";
            note.classList.remove("hidden");
        } else {
            note.classList.add("hidden");
        }
    });

    // Persist
    localStorage.setItem("lw_gender", genderKey);
    document.dispatchEvent(new CustomEvent("lw:gender-change", { detail: { genderKey } }));
}

function initGenderToggle() {
    const buttons = qsa("[data-gender]");
    if (!buttons.length) return;

    const saved = localStorage.getItem("lw_gender") || "women";
    buttons.forEach(b => {
        b.addEventListener("click", () => {
            buttons.forEach(x => x.setAttribute("aria-pressed", "false"));
            b.setAttribute("aria-pressed", "true");
            applyGenderPrices(b.getAttribute("data-gender"));
        });
    });

    const activeBtn = buttons.find(b => b.getAttribute("data-gender") === saved) || buttons[0];
    buttons.forEach(x => x.setAttribute("aria-pressed", "false"));
    activeBtn.setAttribute("aria-pressed", "true");
    applyGenderPrices(activeBtn.getAttribute("data-gender"));
}

function renderPromos() {
    const wrap = qs("[data-promos]");
    if (!wrap) return;

    wrap.innerHTML = CONTENT.promos
        .filter(p => p.active === true)
        .slice(0, 4)
        .map(p => {
            const priceHtml = (typeof p.price === "number")
                ? `<div class="price" data-price="${p.price}">${rub(p.price)}</div>`
                : `<div class="price">${p.priceText || "—"}</div>`;
            const cond = (p.conditions || []).filter(x => !isPlaceholder(x)).map(x => `<li>${escapeHtml(x)}</li>`).join("");
            return `
      <article class="card promo">
        <div class="card__in">
          <div class="promo__top">
            <div>
              <div class="badge">${escapeHtml(cleanText(p.badge) || "")}</div>
              <h3 style="margin:10px 0 6px">${escapeHtml(cleanText(p.title))}</h3>
              <div class="small">${escapeHtml(cleanText(p.whatIncluded) || "")}</div>
            </div>
            ${priceHtml}
          </div>
          <div class="small" style="margin-top:8px">${escapeHtml(cleanText(p.whoFor) || "")}</div>
          <ul class="list">${cond}</ul>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
            <a class="btn btn--primary" data-booking-link data-promo="${escapeHtml(p.id)}" href="#">Выбрать время</a>
            <a class="btn btn--ghost" href="/promos/">Условия</a>
          </div>
        </div>
      </article>`;
        }).join("");

    // promo click tracking
    qsa('[data-promo]').forEach(a => {
        a.addEventListener("click", () => track("promo_book_click", { promo: a.getAttribute("data-promo") }));
    });
}

function renderPricesTables() {
    // Zones
    const zonesTbody = qs("[data-zones-tbody]");
    if (zonesTbody) {
        zonesTbody.innerHTML = CONTENT.pricing.zones.map(z => {
            const hasFull = z.fullList && z.fullList.trim().length > 0;
            const preview = z.preview || z.fullList || "";
            const full = z.fullList || "";
            const extra = hasFull ? fullListExtra(preview, full) : "";
            const fullListText = hasFull
                ? `${preview}${extra ? ", " : ""}${extra}`
                : preview;
            const detailsHtml = hasFull ? `
        <details class="zone-details">
          <summary class="zone-summary">полный список <span class="zone-caret" aria-hidden="true">▾</span></summary>
          <div class="muted zone-full">${escapeHtml(fullListText)}</div>
        </details>` : "";
            return `
      <tr>
        <td>
          <strong>${escapeHtml(z.label)}</strong>
          <div class="muted">${escapeHtml(preview)}</div>
          ${detailsHtml}
        </td>
        <td style="white-space:nowrap"><span data-price="${z.price}">${rub(z.price)}</span></td>
      </tr>
    `;
        }).join("");
    }

    // One-time packages
    const pkgTbody = qs("[data-packages-tbody]");
    if (pkgTbody) {
        pkgTbody.innerHTML = CONTENT.pricing.packagesOneTime.map(p => `
      <tr>
        <td><strong>${escapeHtml(p.label)}</strong><div class="muted">${escapeHtml(p.includes)}</div></td>
        <td style="white-space:nowrap"><span data-price="${p.price}">${rub(p.price)}</span></td>
      </tr>
    `).join("");
    }

    // Abonements
    const abTbody = qs("[data-abonements-tbody]");
    if (abTbody) {
        abTbody.innerHTML = CONTENT.pricing.packagesAbonements.map(a => `
      <tr>
        <td><strong>${escapeHtml(a.label)}</strong><div class="muted">${escapeHtml(a.range)}</div></td>
        <td style="white-space:nowrap"><span data-price-range data-from="${a.priceFrom}" data-to="${a.priceTo}">${rub(a.priceFrom)} - ${rub(a.priceTo)}</span></td>
      </tr>
    `).join("");
    }
}

function fullListExtra(preview, full) {
    const norm = s => s.toLowerCase().replace(/\s+/g, " ").trim();
    const previewItems = preview.split(",").map(s => norm(s)).filter(Boolean);
    const fullItems = full.split(",").map(s => s.trim()).filter(Boolean);
    const previewSet = new Set(previewItems);
    const extra = fullItems.filter(item => !previewSet.has(norm(item)));
    return extra.join(", ");
}

function renderMasters() {
    const wrap = qs("[data-masters]");
    if (!wrap) return;
    const list = CONTENT.masters.filter(m => !isPlaceholder(m.name)).slice(0, 4);
    if (!list.length) {
        wrap.innerHTML = `<div class="small">Скоро добавим информацию о мастерах.</div>`;
        return;
    }
    wrap.innerHTML = list.map(m => {
        let photos = Array.isArray(m.photos) ? m.photos : (m.photo ? [m.photo] : []);
        if (!photos.length) {
            photos = ["data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 400 300\"><rect width=\"400\" height=\"300\" fill=\"#1a1a23\"/><text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"#b9b9c6\" font-family=\"Arial\" font-size=\"16\">Фото скоро появится</text></svg>')];
        }
        const slides = photos.map((p, i) => `
            <img class="carousel__img${i === 0 ? " is-active" : ""}" src="${escapeAttr(p)}" alt="${escapeAttr(m.name)}" loading="lazy">
        `).join("");
        const dots = photos.length > 1
            ? `<div class="carousel__dots">${photos.map((_, i) => `<button class="carousel__dot${i === 0 ? " is-active" : ""}" type="button" data-carousel-dot data-index="${i}" aria-label="Фото ${i + 1}"></button>`).join("")}</div>`
            : "";
        const controls = photos.length > 1
            ? `<button class="carousel__btn carousel__btn--prev" type="button" data-carousel-prev aria-label="Предыдущее фото">‹</button>
               <button class="carousel__btn carousel__btn--next" type="button" data-carousel-next aria-label="Следующее фото">›</button>`
            : "";
        const bio = Array.isArray(m.bio) && m.bio.length
            ? m.bio.map(p => `<p class="small" style="margin:8px 0 0">${escapeHtml(p)}</p>`).join("")
            : "";
        return `
    <article class="card">
      <div class="card__in" style="display:grid;gap:10px">
        <div class="carousel" data-carousel data-carousel-index="0" data-carousel-count="${photos.length}">
          <div class="carousel__track">
            ${slides}
          </div>
          ${controls}
          ${dots}
        </div>
        <div>
          <h3 style="margin:0 0 6px">${escapeHtml(m.name)}</h3>
          <ul class="list">
            ${(m.facts || []).filter(f => !isPlaceholder(f)).map(f => `<li>${escapeHtml(f)}</li>`).join("")}
          </ul>
          <div class="small" style="margin-top:8px"><strong>Сильная сторона:</strong> ${escapeHtml(cleanText(m.strength) || "")}</div>
          ${bio}
          <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
            <a class="btn btn--primary" data-booking-link href="#">Записаться</a>
            <a class="btn btn--ghost" href="/masters/">Все мастера</a>
          </div>
        </div>
      </div>
    </article>
  `;
    }).join("");
}

function renderFaq() {
    const wrap = qs("[data-faq]");
    if (!wrap) return;
    wrap.innerHTML = CONTENT.faq.map(item => `
    <details class="card" style="border-radius:16px">
      <summary class="card__in" style="cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:12px">
        <span><strong>${escapeHtml(item.q)}</strong></span>
        <span class="badge">Ответ</span>
      </summary>
      <div class="card__in" style="padding-top:0">
        <p class="small" style="margin:0">${escapeHtml(item.a)}</p>
      </div>
    </details>
  `).join("");
}

function initCalculator() {
    const root = qs("[data-calculator]");
    if (!root) return;

    const modeSel = qs('[data-calc-mode]', root);
    const pkgSel = qs('[data-calc-package]', root);
    const sesSel = qs('[data-calc-sessions]', root);
    const out = qs('[data-calc-out]', root);
    const note = qs('[data-calc-note]', root);

    // fill packages
    CONTENT.pricing.packagesOneTime.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.key;
        opt.textContent = `${p.label} (${p.includes})`;
        pkgSel.appendChild(opt);
    });

    // fill sessions (3/5/7/9)
    const sessions = [3, 5, 7, 9];
    sessions.forEach(n => {
        const opt = document.createElement("option");
        opt.value = String(n);
        opt.textContent = `${n} ${plural(n, ["сеанс", "сеанса", "сеансов"])}`;
        sesSel.appendChild(opt);
    });

    function calc() {
        const genderKey = localStorage.getItem("lw_gender") || "women";
        const m = CONTENT.pricing.gender[genderKey]?.multiplier || 1.0;

        const pkgKey = pkgSel.value;
        const sessions = Number(sesSel.value || 1);

        const one = CONTENT.pricing.packagesOneTime.find(p => p.key === pkgKey);
        const ab = CONTENT.pricing.packagesAbonements.find(a => a.key === pkgKey);

        const abKey = `price${sessions}`;
        const totalAb = ab && typeof ab[abKey] === "number" ? ab[abKey] : null;

        const basePer = one ? one.price * m : 0;
        const totalBase = basePer * sessions;
        const finalAb = (typeof totalAb === "number") ? totalAb * m : null;
        const abPer = (finalAb !== null) ? (finalAb / sessions) : null;
        const save = (finalAb !== null) ? (totalBase - finalAb) : null;

        let html = "";
        html = `
      <div><strong>Разово (за 1 сеанс):</strong> ${rub(basePer)}</div>
      <div><strong>Абонемент (за 1 сеанс):</strong> ${abPer !== null ? rub(abPer) : "—"}</div>
      <div><strong>Экономия за ${sessions} ${plural(sessions, ["сеанс", "сеанса", "сеансов"])}:</strong> ${save !== null ? rub(save) : "—"}</div>
      <div class="small">Итого абонемент за ${sessions} ${plural(sessions, ["сеанс", "сеанса", "сеансов"])}: ${finalAb !== null ? rub(finalAb) : "—"}</div>
    `;
        out.innerHTML = html;

        if (!calcUsed) {
            track("calculator_used");
            calcUsed = true;
        }

        const noteText = CONTENT.pricing.calculator.note || "";
        note.textContent = noteText;
        if (noteText) note.classList.remove("hidden");
        else note.classList.add("hidden");
    }

    pkgSel.addEventListener("change", calc);
    sesSel.addEventListener("change", calc);
    document.addEventListener("lw:gender-change", calc);
    calc();
}

function initForms() {
    qsa("form[data-form]").forEach(form => {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const type = form.getAttribute("data-form");
            const fd = new FormData(form);
            const payload = Object.fromEntries(fd.entries());
            payload.formType = type;
            payload.page = window.location.pathname;
            payload.utm = getUtm();

            const url = CONTENT.forms.webhookUrl;
            const mailto = CONTENT.forms.mailtoFallback;
            const urlPlaceholder = isPlaceholder(url);
            const mailtoPlaceholder = isPlaceholder(mailto);

            try {
                if (!urlPlaceholder && url) {
                    await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    });
                } else if (!mailtoPlaceholder && mailto) {
                    // fallback mailto
                    const body = encodeURIComponent(JSON.stringify(payload, null, 2));
                    window.location.href = mailto + "&body=" + body;
                } else {
                    throw new Error("form endpoint missing");
                }

                track(type === "lead" ? "form_submit_lead" : "form_submit_question");
                form.reset();

                const ok = qs("[data-form-ok]", form) || qs("[data-form-ok]");
                if (ok) ok.classList.remove("hidden");
            } catch (err) {
                const fail = qs("[data-form-fail]", form) || qs("[data-form-fail]");
                if (fail) fail.classList.remove("hidden");
            }
        });
    });
}

function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }

function plural(n, forms) {
    const x = Math.abs(n) % 100;
    const y = x % 10;
    if (x > 10 && x < 20) return forms[2];
    if (y > 1 && y < 5) return forms[1];
    if (y === 1) return forms[0];
    return forms[2];
}

function setActiveNav() {
    const path = window.location.pathname;
    qsa(".nav a").forEach(a => {
        const href = a.getAttribute("href");
        if (href === "/" && path === "/") a.setAttribute("aria-current", "page");
        else if (href !== "/" && path.startsWith(href)) a.setAttribute("aria-current", "page");
    });
}

function setExternalTargets() {
    qsa("a[href]").forEach(a => {
        const href = a.getAttribute("href") || "";
        if (href.startsWith("#")) return;
        if (href.startsWith("tel:") || href.startsWith("mailto:")) return;
        let url;
        try { url = new URL(href, window.location.origin); }
        catch { return; }
        if (url.origin !== window.location.origin) {
            a.setAttribute("target", "_blank");
            a.setAttribute("rel", "noopener noreferrer");
        }
    });
}

function renderHowToFind() {
    const list = qs("[data-howto]");
    if (!list) return;
    const items = (CONTENT.contacts.howToFind || []).filter(x => !isPlaceholder(x));
    if (!items.length) {
        list.classList.add("hidden");
        return;
    }
    list.innerHTML = items.map(x => `<li>${escapeHtml(x)}</li>`).join("");
}

function initCarousels() {
    qsa("[data-carousel]").forEach(root => {
        const imgs = qsa(".carousel__img", root);
        const dots = qsa("[data-carousel-dot]", root);
        if (!imgs.length) return;
        let index = 0;

        function setIndex(next) {
            index = (next + imgs.length) % imgs.length;
            imgs.forEach((img, i) => img.classList.toggle("is-active", i === index));
            dots.forEach((dot, i) => dot.classList.toggle("is-active", i === index));
            root.setAttribute("data-carousel-index", String(index));
        }

        const prev = qs("[data-carousel-prev]", root);
        const next = qs("[data-carousel-next]", root);
        if (prev) prev.addEventListener("click", () => setIndex(index - 1));
        if (next) next.addEventListener("click", () => setIndex(index + 1));
        dots.forEach(dot => {
            dot.addEventListener("click", () => setIndex(Number(dot.getAttribute("data-index")) || 0));
        });
    });
}

async function boot() {
    // asset prefix for nested pages
    // set in each page as window.__ASSET_PREFIX__ = "../" etc
    await loadContent();
    initThemeToggle();
    renderHeaderFooter();
    setActiveNav();
    setExternalTargets();
    renderHowToFind();
    renderPromos();
    renderPricesTables();
    renderMasters();
    initCarousels();
    renderFaq();
    initGenderToggle();
    initCalculator();
    initForms();

    // Map embed
    const map = qs("[data-map]");
    if (map) {
        const embed = CONTENT.contacts.mapEmbed;
        if (embed && !isPlaceholder(embed)) map.innerHTML = embed;
        else {
            const card = map.closest(".card");
            if (card) card.classList.add("hidden");
        }
    }

    // VK widget placeholder
    const vk = qs("[data-vk-widget]");
    if (vk) {
        const w = CONTENT.reviews?.vkWidget;
        if (w && !isPlaceholder(w)) vk.innerHTML = w;
        else {
            const card = vk.closest(".card");
            if (card) card.classList.add("hidden");
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    boot().catch(err => {
        console.error(err);
        const fail = qs("[data-boot-fail]");
        if (fail) fail.classList.remove("hidden");
    });
});
