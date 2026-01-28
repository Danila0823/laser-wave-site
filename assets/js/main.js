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

function rub(n) {
    if (typeof n !== "number" || !isFinite(n)) return "—";
    return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
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
    if (el) el.textContent = text;
}

function setHref(id, href) {
    const el = qs(`[data-href="${id}"]`);
    if (el) el.setAttribute("href", href);
}

function renderHeaderFooter() {
    // Contacts
    setText("brandName", CONTENT.brand.name);
    setText("brandCity", CONTENT.brand.city);
    setText("addressLine", CONTENT.contacts.addressLine);
    setText("hours", CONTENT.contacts.hours);
    setText("phoneDisplay", CONTENT.contacts.phoneDisplay);

    qsa('[data-phone]').forEach(a => a.setAttribute("href", "tel:" + CONTENT.contacts.phoneE164));
    qsa('[data-vk]').forEach(a => a.setAttribute("href", CONTENT.contacts.links.vk));
    qsa('[data-tg]').forEach(a => a.setAttribute("href", CONTENT.contacts.links.telegram));
    qsa('[data-wa]').forEach(a => a.setAttribute("href", CONTENT.contacts.links.whatsapp));

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
    setText("trustVkText", `VK: ${CONTENT.trust.vk.ratingText}, ${CONTENT.trust.vk.reviewsCountText}`);
    setText("replyTime", CONTENT.trust.replyTime);
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
    const note = qs("[data-men-note]");
    if (note) {
        if (genderKey === "men") {
            note.textContent = gender.note || "";
            note.classList.remove("hidden");
        } else {
            note.classList.add("hidden");
        }
    }

    // Persist
    localStorage.setItem("lw_gender", genderKey);
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
        .filter(p => p.active === true || String(p.active).includes("["))
        .slice(0, 4)
        .map(p => {
            const priceHtml = (typeof p.price === "number")
                ? `<div class="price" data-price="${p.price}">${rub(p.price)}</div>`
                : `<div class="price">${p.priceText || "—"}</div>`;
            const cond = (p.conditions || []).map(x => `<li>${escapeHtml(x)}</li>`).join("");
            return `
      <article class="card promo">
        <div class="card__in">
          <div class="promo__top">
            <div>
              <div class="badge">${escapeHtml(p.badge || "")}</div>
              <h3 style="margin:10px 0 6px">${escapeHtml(p.title)}</h3>
              <div class="small">${escapeHtml(p.whatIncluded || "")}</div>
            </div>
            ${priceHtml}
          </div>
          <div class="small" style="margin-top:8px">${escapeHtml(p.whoFor || "")}</div>
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
        zonesTbody.innerHTML = CONTENT.pricing.zones.map(z => `
      <tr>
        <td><strong>${escapeHtml(z.label)}</strong><div class="muted">${escapeHtml(z.examples)}</div></td>
        <td style="white-space:nowrap"><span data-price="${z.price}">${rub(z.price)}</span></td>
      </tr>
    `).join("");
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

function renderMasters() {
    const wrap = qs("[data-masters]");
    if (!wrap) return;
    wrap.innerHTML = CONTENT.masters.slice(0, 4).map(m => `
    <article class="card">
      <div class="card__in" style="display:grid;gap:10px">
        <img src="${escapeAttr(m.photo)}" alt="${escapeAttr(m.name)}" loading="lazy" style="border-radius:16px;border:1px solid var(--line);background:rgba(255,255,255,.03)">
        <div>
          <h3 style="margin:0 0 6px">${escapeHtml(m.name)}</h3>
          <ul class="list">
            ${(m.facts || []).map(f => `<li>${escapeHtml(f)}</li>`).join("")}
          </ul>
          <div class="small" style="margin-top:8px"><strong>Сильная сторона:</strong> ${escapeHtml(m.strength || "")}</div>
          <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
            <a class="btn btn--primary" data-booking-link href="#">Записаться</a>
            <a class="btn btn--ghost" href="/masters/">Все мастера</a>
          </div>
        </div>
      </div>
    </article>
  `).join("");
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

    // fill sessions (1, 3, 9 enabled; 4-8 disabled)
    const sessions = [1, 3, 4, 5, 6, 7, 8, 9];
    sessions.forEach(n => {
        const opt = document.createElement("option");
        opt.value = String(n);
        opt.textContent = `${n} ${plural(n, ["сеанс", "сеанса", "сеансов"])}`;
        if (![1, 3, 9].includes(n)) opt.disabled = true;
        sesSel.appendChild(opt);
    });

    function calc() {
        const genderKey = localStorage.getItem("lw_gender") || "women";
        const m = CONTENT.pricing.gender[genderKey]?.multiplier || 1.0;

        const pkgKey = pkgSel.value;
        const sessions = Number(sesSel.value || 1);

        const one = CONTENT.pricing.packagesOneTime.find(p => p.key === pkgKey);
        const ab = CONTENT.pricing.packagesAbonements.find(a => a.key === pkgKey);

        let totalBase = 0;
        let totalAb = null;

        if (sessions === 1) {
            totalBase = one ? one.price : 0;
        } else if (sessions === 3) {
            // exact from abonement "from" (3 sessions)
            totalBase = one ? one.price * 3 : 0;
            totalAb = ab ? ab.priceFrom : null;
        } else if (sessions === 9) {
            totalBase = one ? one.price * 9 : 0;
            totalAb = ab ? ab.priceTo : null;
        }

        const finalBase = totalBase * m;
        const finalAb = (typeof totalAb === "number") ? totalAb * m : null;

        let html = "";
        if (sessions === 1) {
            html = `<div><strong>Итого:</strong> ${rub(finalBase)}</div>`;
        } else {
            const save = (finalAb !== null) ? (finalBase - finalAb) : null;
            html = `
        <div><strong>Разово:</strong> ${rub(finalBase)}</div>
        <div><strong>Абонемент:</strong> ${finalAb !== null ? rub(finalAb) : "—"}</div>
        <div class="small">Экономия: ${save !== null ? rub(save) : "[УТОЧНИТЬ: сетка цен]"}</div>
      `;
        }
        out.innerHTML = html;

        if (!calcUsed) {
            track("calculator_used");
            calcUsed = true;
        }

        note.textContent = CONTENT.pricing.calculator.note || "";
    }

    pkgSel.addEventListener("change", calc);
    sesSel.addEventListener("change", calc);
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
            const isPlaceholder = String(url || "").includes("[");
            const mailto = CONTENT.forms.mailtoFallback;

            try {
                if (!isPlaceholder && url) {
                    await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    });
                } else {
                    // fallback mailto
                    const body = encodeURIComponent(JSON.stringify(payload, null, 2));
                    window.location.href = mailto + "&body=" + body;
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

async function boot() {
    // asset prefix for nested pages
    // set in each page as window.__ASSET_PREFIX__ = "../" etc
    await loadContent();
    renderHeaderFooter();
    setActiveNav();
    renderPromos();
    renderPricesTables();
    renderMasters();
    renderFaq();
    initGenderToggle();
    initCalculator();
    initForms();

    // Map embed
    const map = qs("[data-map]");
    if (map) {
        const embed = CONTENT.contacts.mapEmbed;
        if (embed && !String(embed).includes("[")) map.innerHTML = embed;
        else map.innerHTML = `<div class="card"><div class="card__in"><div class="small">[УТОЧНИТЬ: iframe карты]</div></div></div>`;
    }

    // VK widget placeholder
    const vk = qs("[data-vk-widget]");
    if (vk) {
        const w = CONTENT.reviews?.vkWidget;
        if (w && !String(w).includes("[")) vk.innerHTML = w;
        else vk.innerHTML = `<div class="card"><div class="card__in"><div class="small">[УТОЧНИТЬ: виджет отзывов VK]</div></div></div>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    boot().catch(err => {
        console.error(err);
        const fail = qs("[data-boot-fail]");
        if (fail) fail.classList.remove("hidden");
    });
});
