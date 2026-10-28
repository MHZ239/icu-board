/* DR.HASNAA SHOKR — standalone-site backend (Supabase).
 * Provides window.HS_BACKEND with:
 *   ensureSignedIn() -> Promise<boolean>   shows the name + PIN screen until the person is signed in
 *   db                                     the same small document API the dashboard's store uses
 *   user                                   me() / can() like the artifact `user` capability
 *   signOut(), resetPin(userId, name, pin), learners(), setSuspended(id, bool), setAdmin(id, bool), deleteUser(id)
 * Accounts: the name is normalised and hashed into a private sign-in address; the PIN becomes the password.
 */
(function () {
  "use strict";
  const cfg = window.HS_CONFIG || {};
  const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
  let session = null, profile = null;

  /* ---------- names, addresses and PINs */
  function normName(name) {
    return (name || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()
      .replace(/[ً-ٰٟـ]/g, "")      // Arabic diacritics and tatweel
      .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
  }
  async function sha256Hex(s) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async function credentials(name, pin) {
    const hx = await sha256Hex("hasnaa-prep|" + normName(name));
    return { email: `n${hx.slice(0, 32)}@learners.hasnaa-prep.app`, password: `hs-${pin}-${hx.slice(0, 10)}` };
  }
  const validPin = (p) => /^\d{4,8}$/.test(p);
  const validName = (n) => normName(n).length >= 3 && normName(n).length <= 60;

  /* ---------- error mapping to the store's codes */
  function fail(error) {
    if (!error) return;
    const msg = String(error.message || error);
    const status = error.status || 0;
    const network = /fetch|network|timeout|Load failed/i.test(msg) || status >= 500;
    // network and server faults are retried by the store; permission (RLS) and malformed requests are not
    const code = network ? "unavailable" : "invalid_argument";
    throw { code, message: msg };
  }
  const snap = (id, row) => ({ id: String(id), exists: !!row, data: () => (row ? row.data : undefined) });

  /* ---------- document API (mirrors the subset of the artifact db the store uses) */
  function route(path) {
    const s = path.split("/");
    if (s[0] === "data" && s[1] === "users") return { table: "user_docs", where: { user_id: s[2] }, key: s.slice(3).join("/"), keyCol: "doc_key" };
    if (s[0] === "cohort") return { table: "cohort", where: {}, key: s[1], keyCol: "user_id" };
    if (s[0] === "flagq") return { table: "flags", where: {}, key: s[1], keyCol: "user_id" };
    if (s[0] === "flagres") return { table: "flag_res", where: {}, key: s[1] == null ? undefined : Number(s[1]), keyCol: "qid" };
    throw new TypeError("Unknown path " + path);
  }
  const db = {
    doc(path) {
      const r = route(path);
      return {
        async get() {
          let q = sb.from(r.table).select("data").eq(r.keyCol, r.key);
          for (const [k, v] of Object.entries(r.where)) q = q.eq(k, v);
          const { data, error } = await q.maybeSingle(); fail(error);
          return snap(r.key, data);
        },
        async set(d) {
          const row = { ...r.where, [r.keyCol]: r.key, data: d, updated_at: new Date().toISOString() };
          const { error } = await sb.from(r.table).upsert(row); fail(error);
        },
        async delete() {
          let q = sb.from(r.table).delete().eq(r.keyCol, r.key);
          for (const [k, v] of Object.entries(r.where)) q = q.eq(k, v);
          const { error } = await q; fail(error);
        },
      };
    },
    collection(path) {
      const r = route(path + "/x");
      const filters = [];
      const api = {
        where(field, op, value) { filters.push([field, value]); return api; },
        async get() {
          let q = sb.from(r.table).select(`${r.keyCol},data`);
          for (const [k, v] of Object.entries(r.where)) q = q.eq(k, v);
          for (const [f, v] of filters) q = q.eq(`data->>${f}`, v);
          const { data, error } = await q.limit(5000); fail(error);
          const docs = (data || []).map((row) => snap(row[r.keyCol], row));
          return { docs, size: docs.length, empty: !docs.length };
        },
      };
      return api;
    },
  };

  /* ---------- viewer identity */
  function initials(name) {
    const parts = (name || "?").trim().split(/\s+/);
    return ((parts[0] || "?")[0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }
  function colorFor(s) { let h = 0; for (const c of s || "") h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 45% 38%)`; }
  function avatar(name) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="${colorFor(name)}"/><text x="16" y="21" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="#fff">${initials(name).replace(/[<&>]/g, "")}</text></svg>`;
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }
  const user = {
    async me() {
      const name = (profile && profile.display_name) || "";
      return { id: session ? session.user.id : null, name, avatarUrl: avatar(name), color: colorFor(name), email: null, isOwner: false, canEdit: !!(profile && profile.is_admin) };
    },
    async can() { return true; },
    async id() { return session ? session.user.id : null; },
  };

  async function loadProfile() {
    const { data, error } = await sb.from("profiles").select("display_name,is_admin,suspended").eq("id", session.user.id).maybeSingle();
    if (error) fail(error);
    profile = data || { display_name: (session.user.user_metadata || {}).display_name || "", is_admin: false, suspended: false };
  }

  /* ---------- admin helpers (each RPC re-checks is_admin() in the database) */
  async function learners() {
    const { data, error } = await sb.rpc("admin_list_users"); fail(error);
    return (data || []).map((r) => ({ id: r.id, name: r.display_name, isAdmin: r.is_admin, suspended: r.suspended, createdAt: r.created_at,
      lastSignIn: r.last_sign_in_at, stats: r.stats || null, statsUpdatedAt: r.stats_updated_at, isMe: !!(session && r.id === session.user.id) }));
  }
  async function setSuspended(userId, value) { const { error } = await sb.rpc("admin_set_suspended", { target: userId, value }); fail(error); }
  async function setAdmin(userId, value) { const { error } = await sb.rpc("admin_set_admin", { target: userId, value }); fail(error); }
  async function deleteUser(userId) { const { error } = await sb.rpc("admin_delete_user", { target: userId }); fail(error); }
  async function resetPin(userId, name, pin) {
    if (!validPin(pin)) throw { code: "invalid_argument", message: "The PIN must be 4 to 8 digits." };
    const { password } = await credentials(name, pin);
    const { error } = await sb.rpc("admin_reset_pin", { target: userId, new_password: password });
    fail(error);
  }
  async function signOut() { if (sb) await sb.auth.signOut(); location.reload(); }

  /* ---------- sign-in screen */
  const L = {
    en: { title: "Sign in", sub: "Use your name and your personal PIN. Your progress is saved to your account and follows you to any device.",
      signin: "Sign in", create: "Create account", name: "Full name", pin: "PIN (4–8 digits)", pin2: "Repeat the PIN", go: "Sign in", make: "Create my account",
      forgot: "Forgot your PIN? Ask Dr. Hasnaa Shokr to reset it for you.", taken: "This name is already registered. Sign in, or add your middle or family name to make it unique.",
      wrong: "Name or PIN is not correct. Check the spelling of your name exactly as you registered it.", badName: "Enter your name (at least 3 letters).", badPin: "The PIN must be 4 to 8 digits.",
      mismatch: "The two PINs do not match.", offline: "Could not reach the server. Check your internet connection and try again.", busy: "Please wait…",
      notConfigured: "The database is not connected yet, so progress cannot be saved. The site owner needs to add the Supabase settings to config.js.", preview: "Continue in preview (not saved)", lang: "العربية",
      suspended: "This account has been suspended. Contact Dr. Hasnaa Shokr if you think this is a mistake." },
    ar: { title: "تسجيل الدخول", sub: "ادخل باسمك ورمزك السري (PIN). يُحفظ تقدّمك على حسابك ويظهر لك على أي جهاز.",
      signin: "تسجيل الدخول", create: "إنشاء حساب", name: "الاسم بالكامل", pin: "الرمز السري (٤–٨ أرقام)", pin2: "أعد كتابة الرمز", go: "دخول", make: "إنشاء حسابي",
      forgot: "نسيت الرمز؟ اطلب من د. حسناء شكر إعادة تعيينه.", taken: "هذا الاسم مسجّل بالفعل. سجّل الدخول، أو أضف اسم الأب أو العائلة ليصبح الاسم مميزًا.",
      wrong: "الاسم أو الرمز غير صحيح. اكتب اسمك بنفس الطريقة التي سجّلت بها.", badName: "اكتب اسمك (٣ أحرف على الأقل).", badPin: "الرمز يجب أن يكون من ٤ إلى ٨ أرقام.",
      mismatch: "الرمزان غير متطابقين.", offline: "تعذّر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.", busy: "انتظر قليلًا…",
      notConfigured: "قاعدة البيانات غير متصلة بعد، لذا لن يُحفظ التقدّم. يجب على مالك الموقع إضافة إعدادات Supabase إلى ملف config.js.", preview: "المتابعة في وضع المعاينة (بدون حفظ)", lang: "English",
      suspended: "تم إيقاف هذا الحساب. تواصل مع د. حسناء شكر لو تعتقد أن هذا خطأ." },
  };
  function showLogin(firstMsgKey) {
    return new Promise((resolve) => {
      let lang = (window.HS && HS.lang) || "en", tab = "signin";
      const ov = document.createElement("div");
      ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-labelledby", "loginTitle");
      ov.style.cssText = "position:fixed;inset:0;z-index:200;background:var(--bg);overflow-y:auto";
      document.body.append(ov);
      let stopTrace = null;
      function draw(msg, keep) {
        const t = L[lang];
        const vals = keep || {};
        document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
        document.documentElement.lang = lang;
        if (stopTrace) stopTrace();
        ov.innerHTML = "";
        // monitor side: brand, headline, the bank in numbers, live capnography trace
        const side = el("section", "login-side");
        side.setAttribute("aria-hidden", "true");
        const trace = el("canvas");
        const brand = el("div", "", "display:flex;align-items:center;gap:12px");
        const mark = el("div", "brand-mark on-dark");
        if (window.HS && HS.logoMark) mark.append(HS.logoMark()); else mark.textContent = "HS";
        brand.append(mark,
          wrap(el("div"), Object.assign(el("div", "brand-name", "color:var(--mon-fg)"), { textContent: "DR.HASNAA SHOKR" }), Object.assign(el("div", "brand-sub", "color:var(--mon-dim)"), { textContent: lang === "ar" ? "ICU Board · الزمالة المصرية" : "ICU Board · Egyptian Fellowship" })));
        const head = el("h2");
        head.innerHTML = lang === "ar" ? "ذاكر بثبات <em>نفَسًا بعد نفَس</em> حتى يوم الامتحان." : "Steady preparation, <em>breath by breath</em>, until exam day.";
        const facts = el("div", "facts");
        for (const [v, k] of lang === "ar" ? [["1335", "سؤال"], ["20", "مجالًا"], ["32", "حاسبة"], ["84", "تجربة"]] : [["1,335", "questions"], ["20", "domains"], ["32", "calculators"], ["84", "trials"]]) {
          const r = el("div", "mon-readout"); r.append(Object.assign(el("div", "v"), { textContent: v }), Object.assign(el("div", "k"), { textContent: k })); facts.append(r);
        }
        side.append(trace, brand, wrap(el("div", "", "display:flex;flex-direction:column;gap:14px"), head,
          Object.assign(el("p", "", "margin:0;color:var(--mon-dim);max-width:46ch"), { textContent: lang === "ar" ? "مُحدَّث وفق إرشادات 2025–2026، مع خطة يومية ومحاكاة امتحان ومراجعة ذكية." : "Updated to 2025–2026 guidance, with a daily plan, exam simulation and smart review." })), facts);
        const formWrap = el("div", "login-form");
        const split = el("div", "login-split");
        split.append(formWrap, side);
        ov.append(split);
        if (window.HS && HS.capno) stopTrace = HS.capno(trace, { period: 300 });
        const card = el("div", "", "width:min(420px,100%);display:flex;flex-direction:column;gap:16px");
        const topBar = el("div", "", "display:flex;justify-content:space-between;align-items:center;gap:12px");
        if (window.HS && HS.logoLockup) topBar.append(HS.logoLockup()); else topBar.append(el("span"));
        const langBtn = Object.assign(el("button", "btn ghost sm"), { type: "button", textContent: t.lang, onclick: () => { lang = lang === "ar" ? "en" : "ar"; try { localStorage.setItem("hs:lang", JSON.stringify(lang)); } catch { /* storage unavailable */ } draw("", configured ? collect() : {}); } });
        topBar.append(langBtn);
        const title = Object.assign(el("h1", "", "font-size:1.9em"), { id: "loginTitle", textContent: t.title });
        const sub = Object.assign(el("p", "muted", "margin:0"), { textContent: t.sub });
        card.append(topBar, title, sub);
        if (!configured) {
          card.append(Object.assign(el("div", "banner warn"), { textContent: t.notConfigured }),
            Object.assign(el("button", "btn"), { type: "button", textContent: t.preview, onclick: () => { if (stopTrace) stopTrace(); ov.remove(); resolve(false); } }));
          formWrap.append(card); return;
        }
        const tabs = el("div", "seg", "align-self:flex-start");
        for (const [k, label] of [["signin", t.signin], ["create", t.create]]) {
          const b = Object.assign(el("button"), { type: "button", textContent: label, onclick: () => { tab = k; draw("", collect()); } });
          b.setAttribute("aria-pressed", String(tab === k)); tabs.append(b);
        }
        const form = el("form", "", "display:flex;flex-direction:column;gap:12px");
        form.noValidate = true;
        const fName = field("lgName", t.name, "text", vals.name, "name");
        const fPin = field("lgPin", t.pin, "password", vals.pin, "current-password");
        fPin.input.inputMode = "numeric"; fPin.input.maxLength = 8;
        form.append(fName.wrap, fPin.wrap);
        let fPin2 = null;
        if (tab === "create") { fPin2 = field("lgPin2", t.pin2, "password", vals.pin2, "new-password"); fPin2.input.inputMode = "numeric"; fPin2.input.maxLength = 8; form.append(fPin2.wrap); fPin.input.autocomplete = "new-password"; }
        const err = Object.assign(el("div", "small", "color:var(--bad);min-height:1.2em"), { textContent: msg || "" });
        err.setAttribute("role", "alert");
        const submit = Object.assign(el("button", "btn primary", "height:44px"), { type: "submit", textContent: tab === "create" ? t.make : t.go });
        form.append(err, submit);
        form.onsubmit = async (e) => {
          e.preventDefault();
          const name = fName.input.value, pin = fPin.input.value.trim();
          if (!validName(name)) return draw(t.badName, collect());
          if (!validPin(pin)) return draw(t.badPin, collect());
          if (tab === "create" && pin !== fPin2.input.value.trim()) return draw(t.mismatch, collect());
          submit.disabled = true; submit.textContent = t.busy;
          try {
            const { email, password } = await credentials(name, pin);
            if (tab === "create") {
              const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: name.trim().replace(/\s+/g, " ") } } });
              if (error) { if (/already|registered|exists/i.test(error.message) || error.code === "user_already_exists") return draw(t.taken, collect()); throw error; }
              if (!data.session) { const r = await sb.auth.signInWithPassword({ email, password }); if (r.error) throw r.error; }
            } else {
              const { error } = await sb.auth.signInWithPassword({ email, password });
              if (error) {
                if (/banned/i.test(error.message) || error.code === "user_banned") return draw(t.suspended, collect());
                if (/invalid|credentials/i.test(error.message) || error.status === 400) return draw(t.wrong, collect());
                throw error;
              }
            }
            const s = await sb.auth.getSession(); session = s.data.session;
            await loadProfile();
            if (profile.suspended) { await sb.auth.signOut(); session = null; return draw(t.suspended, collect()); }
            if (stopTrace) stopTrace(); ov.remove(); resolve(true);
          } catch (ex) { console.error(ex); draw(/fetch|network/i.test(String(ex && ex.message)) ? t.offline : String((ex && ex.message) || t.offline), collect()); }
        };
        card.append(tabs, form, Object.assign(el("p", "small faint", "margin:0"), { textContent: t.forgot }));
        formWrap.append(card);
        (vals.name ? fPin.input : fName.input).focus();
        function collect() { return { name: fName.input.value, pin: fPin.input.value, pin2: fPin2 ? fPin2.input.value : "" }; }
      }
      draw(firstMsgKey ? L[lang][firstMsgKey] : "");
    });
  }
  function el(tag, cls, style) { const e = document.createElement(tag); if (cls) e.className = cls; if (style) e.setAttribute("style", style); return e; }
  function wrap(p, ...kids) { p.append(...kids); return p; }
  function field(id, label, type, value, ac) {
    const w = el("div", "field"); const l = Object.assign(el("label"), { htmlFor: id, textContent: label });
    const i = Object.assign(el("input", "input", "height:44px"), { id, type, value: value || "", autocomplete: ac });
    w.append(l, i); return { wrap: w, input: i };
  }

  async function ensureSignedIn() {
    if (!configured) return showLogin();
    try {
      const s = await sb.auth.getSession(); session = s.data.session;
      if (session) {
        await loadProfile();
        if (!profile.suspended) return true;
        await sb.auth.signOut(); session = null; profile = null;
        return showLogin("suspended");
      }
    } catch (e) { console.warn("session restore failed", e); }
    return showLogin();
  }

  window.HS_BACKEND = { configured, db, user, ensureSignedIn, signOut, learners, resetPin, setSuspended, setAdmin, deleteUser, label: "name and PIN" };
})();
