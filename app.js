/* DR.HASNAA SHOKR — core runtime.
 * Sections: utilities · preferences · i18n · content (lazy data files) · store (data-access layer)
 *           · shell (nav, theme, language, save indicator) · router · search · dialogs.
 * Views live in views.js and register themselves on HS.views.
 */
(function () {
  "use strict";
  const HS = (window.HS = { views: {}, charts: [] });

  /* ------------------------------------------------------------------ utilities */
  const $ = (sel, root = document) => root.querySelector(sel);
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "style") el.setAttribute("style", v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const pad2 = (n) => String(n).padStart(2, "0");
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  function isoWeek(d = new Date()) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return `${t.getUTCFullYear()}-W${pad2(Math.ceil(((t - y0) / 864e5 + 1) / 7))}`;
  }
  const fmtPct = (x) => (x == null || isNaN(x) ? "—" : Math.round(x * 100) + "%");
  const fmtDur = (sec) => {
    sec = Math.max(0, Math.round(sec));
    const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
    return hh ? `${hh}:${pad2(mm)}:${pad2(ss)}` : `${mm}:${pad2(ss)}`;
  };
  const fmtHM = (sec) => { const m = Math.round(sec / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
  const fmtDate = (ts) => new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  Object.assign(HS, { $, h, dayKey, isoWeek, fmtPct, fmtDur, fmtHM, fmtDate, shuffle, uid, debounce, css, sleep });

  /* ------------------------------------------------------------------ preferences (UI only, browser storage) */
  const prefs = {
    get(k, d) { try { const v = localStorage.getItem("hs:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("hs:" + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  HS.prefs = prefs;

  /* ------------------------------------------------------------------ i18n (interface labels only; medical content stays English) */
  const I18N = {
    en: {
      subtitle: "Adult Critical Care Fellowship Prep", collapse: "Collapse",
      dashboard: "Dashboard", bank: "Question Bank", exam: "Exam Simulation", topics: "Topics & Explanations", calculators: "Clinical Calculators",
      trials: "Trials Library", references: "References", progress: "My Progress", settings: "Settings & Profile", qa: "Content QA", users: "Users", more: "More", home: "Home",
      bankShort: "Bank", examShort: "Exam", progressShort: "Progress",
      searchPh: "Search questions, topics, trials, references, calculators",
      saved: "Saved", saving: "Saving…", offline: "Offline · will retry", local: "Preview · not saved", error: "Save failed", connecting: "Connecting",
      tutor: "Tutor mode", timed: "Timed practice", review: "Smart review", start: "Start", submit: "Submit", next: "Next", prev: "Previous",
      flag: "Flag", mark: "Mark for review", bookmark: "Bookmark", notes: "My notes", explanation: "Explanation", reference: "Reference",
      correct: "Correct", incorrect: "Incorrect", unanswered: "Unanswered", finish: "Finish", pause: "Pause and save", resume: "Resume",
      filters: "Filters", allSets: "All domains", difficulty: "Difficulty", status: "Status", updated: "Updated 2025–2026",
      easy: "Easy", medium: "Medium", hard: "Hard", unseen: "Unseen", bookmarked: "Bookmarked", flagged: "Flagged",
      theme: "Theme", system: "System", light: "Light", dark: "Dark", language: "Interface language", fontSize: "Font size",
      reset: "Reset my progress", signedOut: "Sign in to save progress",
      notebook: "My Notes", notebookShort: "Notes",
      track: "Study track", trackOne: "Part I", trackTwo: "Part II", trackAll: "All parts",
      trackOneNote: "Part I: applied basic sciences (about 155 questions so far).", trackTwoNote: "Part II: clinical critical care (about 1,180 questions).", trackAllNote: "All 1,335 questions.",
      morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening",
      daysLeft: "days to your exam", setExam: "Set your exam date", examToday: "Your exam is today", examPassed: "Exam date has passed",
      readiness: "Readiness", attempted: "Attempted", accuracy: "Accuracy", streak: "Streak", studyWeek: "Study time · 7 days",
      todayPlan: "Today's plan", startPlan: "Start today's plan", planDone: "Today's plan is complete", dueReviews: "Reviews due", newQs: "New questions", doneToday: "Answered today",
      planHint: "To finish the remaining questions before your exam, aim for about", perDay: "new questions a day",
      qotd: "Question of the day", openExplanation: "Open the explanation", domains: "The 20 domains", weakest: "Weakest topics", recentExams: "Recent exams", activity: "Activity",
      continueTitle: "Continue where you left off", practiseNow: "Practise now", shortcuts: "Keyboard shortcuts", days: "days",
      bookmarksTab: "Bookmarks", notesTab: "Notes", wrongTab: "To retry", reportsTab: "My reports", practise: "Practise these",
    },
    ar: {
      subtitle: "التحضير لزمالة الرعاية الحرجة للبالغين", collapse: "طيّ",
      dashboard: "لوحة المتابعة", bank: "بنك الأسئلة", exam: "محاكاة الامتحان", topics: "الموضوعات والشروح", calculators: "الحاسبات السريرية",
      trials: "مكتبة التجارب", references: "المراجع", progress: "تقدّمي", settings: "الإعدادات والملف", qa: "مراجعة المحتوى", users: "المستخدمين", more: "المزيد", home: "الرئيسية",
      bankShort: "البنك", examShort: "الامتحان", progressShort: "التقدّم",
      searchPh: "ابحث في الأسئلة والموضوعات والتجارب والمراجع والحاسبات",
      saved: "تم الحفظ", saving: "جارٍ الحفظ…", offline: "غير متصل · ستتم إعادة المحاولة", local: "معاينة · لا يتم الحفظ", error: "تعذّر الحفظ", connecting: "جارٍ الاتصال",
      tutor: "وضع التعلّم", timed: "تدريب موقوت", review: "مراجعة ذكية", start: "ابدأ", submit: "إرسال", next: "التالي", prev: "السابق",
      flag: "إبلاغ", mark: "تعليم للمراجعة", bookmark: "حفظ", notes: "ملاحظاتي", explanation: "الشرح", reference: "المرجع",
      correct: "صحيح", incorrect: "خطأ", unanswered: "بلا إجابة", finish: "إنهاء", pause: "إيقاف مؤقت وحفظ", resume: "استئناف",
      filters: "عوامل التصفية", allSets: "كل المجالات", difficulty: "الصعوبة", status: "الحالة", updated: "محدَّث 2025–2026",
      easy: "سهل", medium: "متوسط", hard: "صعب", unseen: "لم يُعرض", bookmarked: "محفوظ", flagged: "مُبلَّغ عنه",
      theme: "المظهر", system: "النظام", light: "فاتح", dark: "داكن", language: "لغة الواجهة", fontSize: "حجم الخط",
      reset: "إعادة ضبط تقدّمي", signedOut: "سجّل الدخول لحفظ التقدّم",
      notebook: "ملاحظاتي", notebookShort: "ملاحظاتي",
      track: "مسار المذاكرة", trackOne: "الجزء الأول", trackTwo: "الجزء الثاني", trackAll: "كل الأجزاء",
      trackOneNote: "الجزء الأول: العلوم الأساسية التطبيقية (حوالي ١٥٥ سؤالًا حاليًا).", trackTwoNote: "الجزء الثاني: العناية المركزة الإكلينيكية (حوالي ١١٨٠ سؤالًا).", trackAllNote: "كل الأسئلة الـ ١٣٣٥.",
      morning: "صباح الخير", afternoon: "مساء الخير", evening: "مساء الخير",
      daysLeft: "يومًا على امتحانك", setExam: "حدّد تاريخ امتحانك", examToday: "امتحانك اليوم", examPassed: "مرّ تاريخ الامتحان",
      readiness: "الجاهزية", attempted: "تمت محاولتها", accuracy: "الدقة", streak: "أيام متتالية", studyWeek: "وقت المذاكرة · ٧ أيام",
      todayPlan: "خطة اليوم", startPlan: "ابدأ خطة اليوم", planDone: "أنهيت خطة اليوم", dueReviews: "مراجعات مستحقة", newQs: "أسئلة جديدة", doneToday: "أجبت اليوم",
      planHint: "لتنهي الأسئلة المتبقية قبل امتحانك، استهدف حوالي", perDay: "سؤالًا جديدًا يوميًا",
      qotd: "سؤال اليوم", openExplanation: "اعرض الشرح", domains: "المجالات العشرون", weakest: "أضعف الموضوعات", recentExams: "آخر الامتحانات", activity: "النشاط",
      continueTitle: "تابع من حيث توقفت", practiseNow: "تدرّب الآن", shortcuts: "اختصارات لوحة المفاتيح", days: "يوم",
      bookmarksTab: "المحفوظة", notesTab: "الملاحظات", wrongTab: "للمراجعة", reportsTab: "بلاغاتي", practise: "تدرّب عليها",
    },
  };
  HS.lang = prefs.get("lang", /^ar\b/i.test(navigator.language || "") ? "ar" : "en");
  HS.t = (k) => (I18N[HS.lang] && I18N[HS.lang][k]) || I18N.en[k] || k;

  /* ------------------------------------------------------------------ content: lazily loaded data files */
  const content = {
    meta: null, lite: null, liteById: new Map(), sets: new Map(), allLoaded: false, changelog: null,
    async loadMeta() {
      if (this.meta) return this.meta;
      const [m, l] = await Promise.all([fetchJSON("data/meta.json"), fetchJSON("data/index.json")]);
      this.meta = m; this.lite = l;
      for (const q of l) this.liteById.set(q.id, q);
      return m;
    },
    // domain of a question: ids 1–1000 are 50 per domain; later banks (1001+) carry their domain in the lite index
    setOf: (id) => { const l = content.liteById.get(Number(id)); return l ? l.s : Math.ceil(id / 50); },
    domainIds(n) { return this.meta.sets[n - 1].ids; },
    letters(id) { const l = content.liteById.get(Number(id)); return l && l.o === 4 ? ["A", "B", "C", "D"] : ["A", "B", "C", "D", "E"]; },
    async loadSet(n) {
      if (!this.sets.has(n)) this.sets.set(n, fetchJSON(`data/set-${pad2(n)}.json`).then((arr) => { const m = new Map(arr.map((q) => [q.id, q])); this.sets.set(n, m); return m; }));
      return this.sets.get(n);
    },
    async q(id) { return (await this.loadSet(this.setOf(id))).get(id); },
    async qs(ids) { const need = [...new Set(ids.map(this.setOf))]; await Promise.all(need.map((n) => this.loadSet(n))); return Promise.all(ids.map((id) => this.q(id))); },
    async loadAll() { await Promise.all(Array.from({ length: 20 }, (_, i) => this.loadSet(i + 1))); this.allLoaded = true; },
    setTitle(n) { return this.meta ? this.meta.sets[n - 1].title : `Set ${n}`; },
    async loadChangelog() { if (!this.changelog) this.changelog = await fetchJSON("data/changelog.json"); return this.changelog; },
  };
  async function fetchJSON(path, tries = 3) {
    for (let i = 0; ; i++) {
      // HS_VER (set by the website build) makes each release fetch fresh data instead of a cached copy
      try { const r = await fetch(window.HS_VER ? `${path}?v=${window.HS_VER}` : path); if (!r.ok) throw new Error(r.status); return await r.json(); }
      catch (e) { if (i >= tries - 1) throw e; await sleep(400 * (i + 1)); }
    }
  }
  HS.content = content;

  /* ------------------------------------------------------------------ store: data-access layer
   * All persistence goes through these functions, so storage can be swapped later.
   * Cloud mode: the artifact `db` capability, private per user under data/users/<id>/.
   * Local mode (signed out / preview): in-memory only, clearly labelled as not saved.
   */
  const DEFAULT_SETTINGS = { theme: "system", lang: HS.lang, fs: "m", examLen: 100, timer: true, shuffle: false, passMark: 60, minPerQ: 1.2, examDate: "", dailyNew: 0, track: "2", tourDone: false };
  const LEITNER_DAYS = [0, 1, 3, 7, 14, 30];
  const store = {
    mode: "local", db: null, user: null, uid: null, isAdmin: false, isOwner: false, me: null, canWriteShared: null,
    settings: { ...DEFAULT_SETTINGS }, bookmarks: new Set(), activity: {}, progress: {}, notes: {}, flags: {}, sessions: new Map(), weekLog: null,
    listeners: new Set(),
    base() { return `data/users/${this.uid}`; },
    onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    emit() { for (const fn of this.listeners) try { fn(); } catch (e) { console.error(e); } },

    async init() {
      const claude = window.claude, be = window.HS_BACKEND;
      if (be) {
        // standalone site: name + PIN accounts (see backend.js)
        const signedIn = await be.ensureSignedIn();
        const lang = prefs.get("lang", HS.lang);
        if (lang !== HS.lang) { HS.lang = lang; }
        document.documentElement.dir = HS.lang === "ar" ? "rtl" : "ltr";
        if (signedIn) {
          this.user = be.user; this.me = await be.user.me(); this.uid = this.me.id;
          this.isAdmin = !!this.me.canEdit; this.isOwner = false; this.canWriteShared = true;
          this.db = be.db; this.mode = "cloud";
        }
      } else if (claude && claude.use) {
        const [db, user] = await Promise.all([claude.use("db"), claude.use("user")]);
        this.user = user;
        if (user) {
          this.me = await user.me();
          this.uid = this.me.id;
          this.isOwner = this.me.isOwner;
          this.isAdmin = !!this.me.canEdit;
          this.canWriteShared = await user.can("data.write");
        }
        if (db && this.uid) { this.db = db; this.mode = "cloud"; }
      }
      if (this.mode === "local") { this.isAdmin = true; setSave("local"); return; }
      setSave("saved");
      await this.getUserProgress();
    },

    /** Load everything this user has saved. */
    async getUserProgress() {
      const b = this.base();
      const [st, pr, no, fl, wk, sess] = await Promise.all([
        this.db.doc(`${b}/state`).get(), this.db.doc(`${b}/progress`).get(), this.db.doc(`${b}/notes`).get(),
        this.db.doc(`flagq/${this.uid}`).get(), this.db.doc(`${b}/log-${isoWeek()}`).get(),
        this.db.collection(b).where("kind", "==", "session").get(),
      ].map((p) => p.catch(() => null)));
      if (st && st.exists) { const d = st.data(); this.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}) }; this.bookmarks = new Set(d.bookmarks || []); this.activity = { ...(d.activity || {}) }; }
      if (pr && pr.exists) this.progress = JSON.parse(JSON.stringify(pr.data().q || {}));
      if (no && no.exists) this.notes = { ...(no.data().n || {}) };
      if (fl && fl.exists) this.flags = JSON.parse(JSON.stringify(fl.data().items || {}));
      this.weekLog = wk && wk.exists ? { week: isoWeek(), items: (wk.data().items || []).slice() } : { week: isoWeek(), items: [] };
      if (sess) for (const d of sess.docs) this.sessions.set(d.id.slice(2), JSON.parse(JSON.stringify(d.data())));
      applySettings(this.settings);
      this.emit();
    },

    stateDoc() { return { kind: "state", settings: this.settings, bookmarks: [...this.bookmarks], activity: this.activity, updatedAt: Date.now() }; },
    saveState() { if (this.mode === "cloud") queue.set(`${this.base()}/state`, () => this.stateDoc()); },

    /** Record one answered question. a = {qid, opt, ok, sec, mode, conf} */
    saveAttempt(a) {
      const now = Date.now();
      const p = this.progress[a.qid] || [0, 0, 0, 0, 0, 0, 0, 0];
      p[0] += 1; if (a.ok) p[1] += 1; p[2] = now; p[3] = a.ok ? 1 : 0;
      const confident = a.conf !== "low";
      p[4] = a.ok && confident ? Math.min(p[4] + 1, 5) : 0;
      p[5] = now + (p[4] === 0 ? 10 * 60e3 : LEITNER_DAYS[p[4]] * 864e5);
      p[6] += Math.round(a.sec || 0); p[7] = a.conf === "low" ? 1 : a.conf === "high" ? 3 : 2;
      this.progress[a.qid] = p;
      const dk = dayKey();
      const act = this.activity[dk] || [0, 0, 0];
      act[0] += 1; if (a.ok) act[1] += 1; act[2] += Math.round(a.sec || 0);
      this.activity[dk] = act;
      const keys = Object.keys(this.activity).sort(); while (keys.length > 200) delete this.activity[keys.shift()];
      const wk = isoWeek();
      if (!this.weekLog || this.weekLog.week !== wk) this.weekLog = { week: wk, items: [] };
      this.weekLog.items.push([a.qid, a.opt || "", a.ok ? 1 : 0, Math.round(a.sec || 0), now, a.mode || "t"]);
      if (this.mode === "cloud") {
        const b = this.base();
        queue.set(`${b}/progress`, () => ({ kind: "progress", q: this.progress, updatedAt: Date.now() }));
        queue.set(`${b}/log-${wk}`, () => ({ kind: "log", week: wk, items: this.weekLog.items }));
        this.saveState();
        this.saveCohort();
      }
      this.emit();
    },
    saveCohort: debounce(function () {
      if (store.mode !== "cloud") return;
      const s = summarize();
      queue.set(`cohort/${store.uid}`, () => ({ ...s, updatedAt: Date.now() }));
    }, 4000),

    toggleBookmark(id) { this.bookmarks.has(id) ? this.bookmarks.delete(id) : this.bookmarks.add(id); this.saveState(); this.emit(); return this.bookmarks.has(id); },
    setNote(id, text) {
      text = (text || "").slice(0, 4000);
      if (text) this.notes[id] = text; else delete this.notes[id];
      if (this.mode === "cloud") queue.set(`${this.base()}/notes`, () => ({ kind: "notes", n: this.notes, updatedAt: Date.now() }));
      this.emit();
    },
    setFlag(id, reason) {
      if (reason) this.flags[id] = { reason: reason.slice(0, 500), ts: Date.now() }; else delete this.flags[id];
      if (this.mode === "cloud") queue.set(`flagq/${this.uid}`, () => ({ items: this.flags, updatedAt: Date.now() }));
      this.emit();
    },
    saveSettings(patch) { Object.assign(this.settings, patch); applySettings(this.settings); this.saveState(); this.emit(); },
    saveSession(s) {
      s.updatedAt = Date.now();
      this.sessions.set(s.id, s);
      if (this.mode === "cloud") queue.set(`${this.base()}/s-${s.id}`, () => ({ ...s, kind: "session" }));
    },
    deleteSession(id) { this.sessions.delete(id); if (this.mode === "cloud") queue.del(`${this.base()}/s-${id}`); this.emit(); },
    async resetProgress() {
      const b = this.base();
      const sessIds = [...this.sessions.keys()];
      this.progress = {}; this.activity = {}; this.bookmarks = new Set(); this.notes = {}; this.flags = {}; this.sessions.clear(); this.weekLog = { week: isoWeek(), items: [] };
      if (this.mode === "cloud") {
        queue.set(`${b}/progress`, () => ({ kind: "progress", q: {}, updatedAt: Date.now() }));
        queue.set(`${b}/notes`, () => ({ kind: "notes", n: {}, updatedAt: Date.now() }));
        queue.set(`flagq/${this.uid}`, () => ({ items: {}, updatedAt: Date.now() }));
        this.saveState();
        for (const id of sessIds) queue.del(`${b}/s-${id}`);
        try {
          const logs = await this.db.collection(b).where("kind", "==", "log").get();
          for (const d of logs.docs) queue.del(`${b}/${d.id}`);
        } catch { /* best effort */ }
        queue.set(`cohort/${this.uid}`, () => ({ ...summarize(), updatedAt: Date.now() }));
      }
      this.emit();
    },
    /** Attempt log items for the last n ISO weeks (cloud), or this session's (local). */
    async loadLogs(nWeeks = 12) {
      if (this.mode !== "cloud") return (this.weekLog && this.weekLog.items) || [];
      try {
        const snap = await this.db.collection(this.base()).where("kind", "==", "log").get();
        const cutoff = Date.now() - nWeeks * 7 * 864e5;
        const items = [];
        for (const d of snap.docs) for (const it of d.data().items || []) if (it[4] >= cutoff) items.push(it);
        return items;
      } catch { return this.weekLog.items; }
    },
    /* admin reads */
    async cohort() { if (this.mode !== "cloud") return []; const s = await this.db.collection("cohort").get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); },
    async flagQueue() {
      if (this.mode !== "cloud") return { reports: Object.entries(this.flags).map(([q, f]) => ({ user: "you", q: Number(q), ...f })), resolved: {} };
      const [fq, fr] = await Promise.all([this.db.collection("flagq").get(), this.db.collection("flagres").get()]);
      const reports = [];
      for (const d of fq.docs) for (const [q, f] of Object.entries(d.data().items || {})) reports.push({ user: d.id, q: Number(q), ...f });
      const resolved = {}; for (const d of fr.docs) resolved[d.id] = d.data();
      return { reports, resolved };
    },
    async resolveFlag(qid, status, note) {
      if (this.mode !== "cloud") return;
      await this.db.doc(`flagres/${qid}`).set({ status, note: note || "", ts: Date.now() });
    },
    async flagResolutions() {
      if (this.mode !== "cloud") return {};
      try { const fr = await this.db.collection("flagres").get(); const o = {}; for (const d of fr.docs) o[d.id] = d.data(); return o; } catch { return {}; }
    },
  };
  HS.store = store;

  /* study track: "2" = Part II (clinical, default), "1" = Part I (applied basic science), "all" */
  HS.track = () => store.settings.track || "2";
  HS.inTrack = (id) => { const tr = HS.track(); if (tr === "all") return true; const l = content.liteById.get(Number(id)); return !!l && l.p === tr; };
  HS.trackIds = () => content.lite.filter((q) => HS.inTrack(q.id)).map((q) => q.id);
  HS.trackLabel = (tr = HS.track()) => (tr === "all" ? HS.t("trackAll") : tr === "1" ? HS.t("trackOne") : HS.t("trackTwo"));

  /** Aggregate summary shared with admins (no notes, no flags text). */
  function summarize() {
    const byDomain = {};
    let att = 0, cor = 0, attempted = 0;
    for (const [id, p] of Object.entries(store.progress)) {
      const s = content.setOf(id); byDomain[s] = byDomain[s] || [0, 0];
      byDomain[s][0] += 1; byDomain[s][1] += p[3];
      attempted += 1; att += p[0]; cor += p[1];
    }
    const exams = [...store.sessions.values()].filter((s) => s.mode === "exam" && s.status === "done").sort((a, b) => a.finishedAt - b.finishedAt).slice(-10)
      .map((s) => ({ score: s.score, n: s.qids.length, at: s.finishedAt }));
    const week = Object.entries(store.activity).filter(([k]) => k >= dayKey(new Date(Date.now() - 6 * 864e5))).reduce((a, [, v]) => a + v[2], 0);
    return { attempted, answers: att, correct: cor, lastCorrect: Object.values(store.progress).reduce((a, p) => a + p[3], 0), byDomain, exams, weekSec: week, streak: streakOf(store.activity) };
  }
  function streakOf(activity) {
    let n = 0; const d = new Date();
    if (!activity[dayKey(d)]) d.setDate(d.getDate() - 1);
    while (activity[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  HS.summarize = summarize; HS.streakOf = streakOf;

  /* write queue: one in-flight write per document, latest value wins, retry with backoff on failure */
  const queue = {
    pending: new Map(), inflight: new Set(), failing: false, fatal: false,
    set(path, build) { this.pending.set(path, { op: "set", build }); this.kick(path); },
    del(path) { this.pending.set(path, { op: "del" }); this.kick(path); },
    busy() { return this.pending.size > 0 || this.inflight.size > 0; },
    async kick(path) {
      if (this.inflight.has(path) || this.fatal) return;
      const job = this.pending.get(path);
      if (!job) return;
      this.pending.delete(path);
      this.inflight.add(path);
      setSave("saving");
      let delay = 800;
      for (;;) {
        try {
          if (job.op === "del") await store.db.doc(path).delete();
          else await store.db.doc(path).set(job.build());
          this.failing = false;
          break;
        } catch (e) {
          const code = e && e.code;
          if (code === "invalid_argument" || code === "transform_error" || code === "quota_exceeded") {
            console.error("Save rejected", path, e); this.fatal = code !== "quota_exceeded" ? true : this.fatal;
            setSave("error", code === "quota_exceeded" ? "Storage is full" : "Saving is not allowed for this account");
            this.inflight.delete(path); return;
          }
          if (code === "revoked" || code === "not_granted") { setSave("error", "Saving is no longer available"); this.inflight.delete(path); this.fatal = true; return; }
          this.failing = true; setSave("offline");
          if (this.pending.has(path)) break; // a newer value supersedes this one
          await sleep(delay + Math.random() * 400); delay = Math.min(delay * 2, 30000);
        }
      }
      this.inflight.delete(path);
      if (this.pending.has(path)) return this.kick(path);
      if (!this.busy()) setSave(this.failing ? "offline" : "saved");
    },
  };
  HS.queue = queue;
  window.addEventListener("online", () => { for (const p of [...queue.pending.keys()]) queue.kick(p); });
  window.addEventListener("beforeunload", (e) => { if (store.mode === "cloud" && queue.busy()) { e.preventDefault(); e.returnValue = ""; } });

  /* ------------------------------------------------------------------ shell */
  const ICON = {
    dashboard: "M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z",
    bank: "M5 4h11l3 3v13H5zM9 9h6M9 13h6M9 17h4",
    exam: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
    topics: "M4 5h7v14H4zM13 5h7v14h-7zM6.5 9h2M15.5 9h2",
    calculators: "M6 3h12v18H6zM9 7h6M9 12h1M12 12h1M15 12h0M9 16h1M12 16h1M15 16h0",
    trials: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3",
    references: "M6 4h9a3 3 0 0 1 3 3v13H9a3 3 0 0 1-3-3zM6 17a3 3 0 0 1 3-3h9",
    progress: "M4 20V10M10 20V4M16 20v-7M22 20H2",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3.1 14H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
    qa: "M9 12l2 2 4-4M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
    users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM22 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    notebook: "M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6zM9 3v18M12 8h3M12 12h3M4 7h2M4 12h2M4 17h2",
    sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
    moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
    close: "M6 6l12 12M18 6L6 18",
  };
  const svg = (name, extra = "") => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "1.8"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round"); s.setAttribute("aria-hidden", "true"); if (extra) s.setAttribute("class", extra); const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", ICON[name] || ""); s.append(p); return s; };
  HS.svg = svg;
  /** The HS monogram (two bars and an S); colours come from --logo-bar / --logo-s so it follows the theme. */
  HS.logoMark = function () {
    const NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 64 64"); s.setAttribute("class", "logo-mark"); s.setAttribute("aria-hidden", "true");
    for (const x of [6, 47]) { const r = document.createElementNS(NS, "rect"); for (const [k, v] of [["class", "lg-bar"], ["x", x], ["y", 4], ["width", 11], ["height", 56], ["rx", 2.2]]) r.setAttribute(k, v); s.append(r); }
    const p = document.createElementNS(NS, "path");
    for (const [k, v] of [["class", "lg-s"], ["d", "M40.4 18.66c-2.18-3.31-5.54-4.88-9.24-4.88-5.29 0-8.9 3.31-8.9 7.91 0 4.78 3.61 6.81 8.99 8.65 6.22 2.12 10.08 4.42 10.08 10.12 0 5.15-4.12 8.83-9.83 8.83-4.45 0-7.98-2.02-10.08-5.7"], ["stroke-width", 7], ["stroke-linecap", "round"]]) p.setAttribute(k, v);
    s.append(p); return s;
  };
  /** Full lockup: monogram | Dr. Hasnaa Shokr */
  HS.logoLockup = () => h("div", { class: "lockup", role: "img", "aria-label": "Dr. Hasnaa Shokr" },
    h("span", { class: "brand-mark" }, HS.logoMark()), h("span", { class: "lockup-sep" }), h("span", { class: "lockup-name" }, "Dr. Hasnaa Shokr"));
  const NAV = ["dashboard", "bank", "exam", "topics", "notebook", "progress", "calculators", "trials", "references", "settings", "users", "qa"];
  function renderNav() {
    // short brand subtitle that also shows the active study track
    for (const el of document.querySelectorAll(".brand-sub")) el.textContent = `ICU Board · ${HS.trackLabel()}`;
    let sw = $("#trackSwitch");
    if (!sw) { sw = h("div", { id: "trackSwitch", class: "track-switch" }); $("#nav").before(sw); }
    sw.replaceChildren(h("div", { class: "eyebrow nav-label", style: "padding:0 8px 4px" }, HS.t("track")),
      h("div", { class: "seg track-seg", role: "group", "aria-label": HS.t("track") }, [["2", "trackTwo"], ["1", "trackOne"], ["all", "trackAll"]].map(([v, k]) =>
        h("button", { type: "button", "aria-pressed": String(HS.track() === v), title: HS.t(k + "Note"), onclick: () => { if (HS.track() !== v) { store.saveSettings({ track: v }); toast(HS.t(v === "all" ? "trackAllNote" : v === "1" ? "trackOneNote" : "trackTwoNote")); render(); } } },
          v === "all" ? (HS.lang === "ar" ? "الكل" : "All") : v === "1" ? "I" : "II"))));
    const nav = $("#nav"); nav.replaceChildren();
    for (const v of NAV) {
      if (v === "qa" && !store.isAdmin) continue;
      if (v === "users" && !(store.isAdmin && window.HS_BACKEND && store.mode === "cloud")) continue; // website accounts only
      if (v === "settings") nav.append(h("div", { class: "rail-sep" }));
      nav.append(h("button", { class: "nav-item", type: "button", "data-view": v, "aria-current": HS.route && HS.route.view === v ? "page" : null, onclick: () => { closeDrawer(); go(v); } },
        svg(v), h("span", { class: "nav-label", text: HS.t(v) })));
    }
    const bb = $("#bottomBar"); bb.replaceChildren();
    for (const v of ["dashboard", "bank", "exam", "progress", "more"]) {
      bb.append(h("button", { type: "button", "aria-current": HS.route && HS.route.view === v ? "page" : null, onclick: () => (v === "more" ? openDrawer() : go(v)) },
        svg(v), h("span", { text: HS.t(v === "dashboard" ? "home" : v === "more" ? "more" : v + "Short") })));
    }
    $("#collapseBtn").onclick = () => { const c = !$("#app").classList.contains("collapsed"); $("#app").classList.toggle("collapsed", c); prefs.set("collapsed", c); };
    for (const el of document.querySelectorAll("[data-i18n]:not(.brand-sub)")) el.textContent = HS.t(el.dataset.i18n);
  }
  function openDrawer() { $("#app").classList.add("drawer"); }
  function closeDrawer() { $("#app").classList.remove("drawer"); }
  $("#scrim").onclick = closeDrawer;
  const mq = matchMedia("(max-width: 900px)");
  const syncMenuBtn = () => { $("#menuBtn").style.display = mq.matches ? "" : "none"; };
  mq.addEventListener("change", syncMenuBtn); syncMenuBtn();
  $("#menuBtn").onclick = openDrawer;

  function setSave(state, msg) {
    const el = $("#saveState"); el.dataset.s = state;
    $(".t", el).textContent = msg || HS.t(state);
    el.title = state === "local" ? (window.HS_BACKEND ? "Progress is kept only until you close this page. Sign in with your name and PIN to save it." : "Progress is kept only until you close this page. Open the published dashboard while signed in to save it.") : msg || HS.t(state);
  }
  HS.setSave = setSave;

  function applySettings(s) {
    const root = document.documentElement;
    if (s.theme === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", s.theme);
    root.setAttribute("data-fs", s.fs || "m");
    prefs.set("theme", s.theme); prefs.set("fs", s.fs);
    if (s.lang && s.lang !== HS.lang) setLang(s.lang, false);
    syncThemeBtn();
    redrawCharts();
  }
  HS.applySettings = applySettings;
  function effectiveDark() { const t = document.documentElement.getAttribute("data-theme"); return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; }
  function syncThemeBtn() { const b = $("#themeBtn"); b.replaceChildren(svg(effectiveDark() ? "sun" : "moon")); b.setAttribute("aria-label", effectiveDark() ? "Switch to light theme" : "Switch to dark theme"); }
  $("#themeBtn").onclick = () => store.saveSettings({ theme: effectiveDark() ? "light" : "dark" });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { syncThemeBtn(); redrawCharts(); });
  function setLang(lang, save = true) {
    HS.lang = lang; prefs.set("lang", lang);
    document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    $("#langBtn").textContent = lang === "ar" ? "EN" : "ع";
    $("#langBtn").setAttribute("aria-label", lang === "ar" ? "Switch to English" : "التبديل إلى العربية");
    if (save) store.saveSettings({ lang });
    renderNav(); if (HS.route) render();
  }
  HS.setLang = setLang;
  $("#langBtn").onclick = () => setLang(HS.lang === "ar" ? "en" : "ar");
  function redrawCharts() { if (HS.route && HS.charts.length) { for (const c of HS.charts) c.destroy(); HS.charts = []; render(); } }

  function renderProfile() {
    const me = store.me;
    $("#avatar").src = me ? me.avatarUrl : "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#8a9ba6"/><circle cx="16" cy="13" r="5" fill="#fff"/><path d="M7 27c2-5 5.5-7 9-7s7 2 9 7" fill="#fff"/></svg>');
    $("#profileName").textContent = (me && me.name) || (store.mode === "local" ? "Preview" : "");
    const btn = $("#profileBtn"), menu = $("#profileMenu");
    btn.onclick = (e) => {
      e.stopPropagation();
      const open = menu.hidden;
      menu.replaceChildren(...[
        h("div", { class: "small muted", style: "padding:8px 10px" }, (me && me.name) || (store.mode === "local" ? "Preview mode (not signed in)" : "Signed in"),
          store.isAdmin ? h("div", { class: "pill neutral", style: "margin-top:4px" }, store.mode === "local" ? "Preview: admin tools visible" : "Administrator") : null),
        h("button", { type: "button", role: "menuitem", onclick: () => { menu.hidden = true; go("progress"); } }, HS.t("progress")),
        h("button", { type: "button", role: "menuitem", onclick: () => { menu.hidden = true; go("settings"); } }, HS.t("settings")),
        store.isAdmin && window.HS_BACKEND && store.mode === "cloud" ? h("button", { type: "button", role: "menuitem", onclick: () => { menu.hidden = true; go("users"); } }, HS.t("users")) : null,
        store.isAdmin ? h("button", { type: "button", role: "menuitem", onclick: () => { menu.hidden = true; go("qa"); } }, HS.t("qa")) : null,
        window.HS_BACKEND && store.mode === "cloud" ? h("button", { type: "button", role: "menuitem", onclick: async () => {
          if (queue.busy()) { toast("Saving your last answers… try again in a moment."); return; }
          await window.HS_BACKEND.signOut();
        } }, HS.lang === "ar" ? "تسجيل الخروج" : "Sign out") : null].filter(Boolean));
      menu.hidden = !open; btn.setAttribute("aria-expanded", String(open));
    };
    document.addEventListener("click", () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); });
  }

  /* ------------------------------------------------------------------ router */
  const TOP = new Set(NAV);
  HS.route = null;
  let leaveHook = null;
  HS.onLeave = (fn) => { leaveHook = fn; };
  function go(view, params = {}, opts = {}) {
    if (leaveHook) { try { leaveHook(); } catch (e) { console.error(e); } leaveHook = null; }
    HS.route = { view, params };
    if (TOP.has(view)) { prefs.set("lastView", view); try { history.replaceState(null, "", "#" + view); } catch { /* sandboxed */ } }
    render(opts);
  }
  HS.go = go;
  async function render() {
    for (const c of HS.charts) c.destroy(); HS.charts = [];
    const { view, params } = HS.route;
    renderNav();
    const main = $("#main");
    main.replaceChildren(h("div", { class: "stack" }, h("div", { class: "skel", style: "height:28px;width:38%" }), h("div", { class: "skel", style: "height:120px" }), h("div", { class: "skel", style: "height:220px" })));
    const fn = HS.views[view] || HS.views.dashboard;
    try {
      const node = await fn(params || {});
      if (HS.route.view !== view || HS.route.params !== params) return; // navigated away meanwhile
      main.replaceChildren(node);
      if (fn.after) fn.after(node);
    } catch (e) {
      console.error(e);
      main.replaceChildren(h("div", { class: "empty" }, h("h3", { text: "This page could not load" }), h("p", { text: "Check your connection and try again." }), h("button", { class: "btn", type: "button", onclick: () => render() }, "Try again")));
    }
    main.scrollTop = 0; window.scrollTo(0, 0);
  }
  HS.render = render;

  /* ------------------------------------------------------------------ dialogs and toast */
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3200); }
  HS.toast = toast;
  /** Modal dialog: confirm({title, body: Node|string, ok, cancel, danger}) -> Promise<boolean> */
  function confirmDlg({ title, body, ok = "OK", cancel = "Cancel", danger = false, okDisabled }) {
    return new Promise((resolve) => {
      const d = $("#dlg");
      const okBtn = h("button", { class: "btn " + (danger ? "danger" : "primary"), type: "button", onclick: () => { d.close(); resolve(true); } }, ok);
      if (okDisabled) okDisabled(okBtn);
      d.replaceChildren(h("div", { class: "dlg-body" }, h("h2", { text: title, style: "margin-bottom:12px" }), typeof body === "string" ? h("p", { text: body }) : body),
        h("div", { class: "dlg-foot" }, cancel ? h("button", { class: "btn", type: "button", onclick: () => { d.close(); resolve(false); } }, cancel) : null, okBtn));
      d.onclose = () => resolve(false);
      d.showModal();
    });
  }
  HS.confirm = confirmDlg;

  /* ------------------------------------------------------------------ search: typo-tolerant inverted index */
  const search = {
    docs: [], inv: new Map(), vocab: [], built: false, building: null,
    tokenize(s) { return (s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 1); },
    add(doc) { const i = this.docs.length; this.docs.push(doc); for (const w of new Set(this.tokenize(doc.title + " " + doc.text))) { let s = this.inv.get(w); if (!s) this.inv.set(w, (s = new Set())); s.add(i); } },
    async build() {
      if (this.building) return this.building;
      this.building = (async () => {
        await content.loadMeta();
        const m = content.meta;
        const full = content.allLoaded;
        this.docs = []; this.inv = new Map();
        for (const q of content.lite) {
          let text = q.x, qq = null;
          if (full) { qq = await content.q(q.id); text = [qq.stem, ...Object.values(qq.options), qq.explanation, qq.topic, qq.subtopic || ""].join(" "); }
          this.add({ type: "Questions", id: q.id, title: `Q${q.id} · ${q.t}${q.u ? " — " + q.u : ""}`, sub: q.x, text, set: q.s, d: q.d, r: q.r });
        }
        const seen = new Set();
        for (const [topic, sub, ids] of m.index) { const k = topic + "|" + (sub || ""); if (seen.has(k)) continue; seen.add(k); this.add({ type: "Topics", id: k, title: sub ? `${topic} — ${sub}` : topic, sub: `${ids.length} question${ids.length > 1 ? "s" : ""}: ${ids.slice(0, 8).join(", ")}`, text: topic + " " + (sub || ""), ids }); }
        for (const t of m.trials) this.add({ type: "Trials", id: t.name, title: `${t.name}${t.year ? " (" + t.year + ")" : ""}`, sub: t.title || t.findings[0] || "", text: [t.name, t.title, ...t.findings].join(" ") });
        for (const [rid, txt] of Object.entries(m.references)) this.add({ type: "References", id: Number(rid), title: `[${rid}] ${txt.split(".")[0]}`, sub: txt, text: txt });
        for (const c of window.HS_CALCS.list) this.add({ type: "Calculators", id: c.id, title: c.name, sub: c.formula, text: c.name + " " + c.formula + " " + c.normal });
        this.vocab = [...this.inv.keys()];
        this.built = full;
        this.building = null;
      })();
      return this.building;
    },
    expand(tok) {
      const out = new Set();
      if (this.inv.has(tok)) out.add(tok);
      const k = tok.length >= 7 ? 2 : tok.length >= 4 ? 1 : 0;
      for (const w of this.vocab) {
        if (w.length >= tok.length && w.startsWith(tok)) { out.add(w); continue; }
        if (k && Math.abs(w.length - tok.length) <= k && editWithin(tok, w, k)) out.add(w);
      }
      return out;
    },
    query(q, filters = {}) {
      const toks = this.tokenize(q);
      if (!toks.length) return { groups: {}, terms: [] };
      let hits = null; const terms = new Set();
      for (const tk of toks) {
        const words = this.expand(tk); words.forEach((w) => terms.add(w));
        const s = new Set(); for (const w of words) for (const i of this.inv.get(w) || []) s.add(i);
        hits = hits ? new Set([...hits].filter((i) => s.has(i))) : s;
        if (!hits.size) break;
      }
      const groups = {};
      for (const i of hits || []) {
        const d = this.docs[i];
        if (d.type === "Questions") {
          if (filters.set && d.set !== filters.set) continue;
          if (filters.d && d.d !== filters.d) continue;
          if (filters.upd && d.r !== "g") continue;
          if (filters.status && !matchStatus(d.id, filters.status)) continue;
        }
        const exact = toks.reduce((a, tk) => a + ((d.title + " " + d.text).toLowerCase().includes(tk) ? 2 : 0), 0) + (d.title.toLowerCase().includes(toks[0]) ? 3 : 0);
        (groups[d.type] = groups[d.type] || []).push({ d, score: exact });
      }
      for (const g of Object.values(groups)) g.sort((a, b) => b.score - a.score || (a.d.id > b.d.id ? 1 : -1));
      return { groups, terms: [...terms] };
    },
  };
  function editWithin(a, b, k) {
    // banded Levenshtein: true if distance(a, b) <= k
    const n = a.length, m = b.length; let prev = Array.from({ length: m + 1 }, (_, j) => j);
    for (let i = 1; i <= n; i++) {
      const cur = [i]; let rowMin = i;
      for (let j = 1; j <= m; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); rowMin = Math.min(rowMin, cur[j]); }
      if (rowMin > k) return false; prev = cur;
    }
    return prev[m] <= k;
  }
  function matchStatus(id, st) {
    const p = store.progress[id];
    if (st === "unseen") return !p; if (st === "correct") return p && p[3] === 1; if (st === "incorrect") return p && p[3] === 0;
    if (st === "bookmarked") return store.bookmarks.has(id); if (st === "flagged") return !!store.flags[id];
    return true;
  }
  HS.search = search; HS.matchStatus = matchStatus;

  /** Text with matched terms wrapped in <mark> (built from text nodes, never innerHTML). */
  function highlight(text, terms) {
    const frag = document.createDocumentFragment();
    if (!terms || !terms.length) { frag.append(text); return frag; }
    const rx = new RegExp("\\b(" + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length).join("|") + ")", "gi");
    let last = 0, m;
    while ((m = rx.exec(text))) { if (m.index > last) frag.append(text.slice(last, m.index)); frag.append(h("mark", { text: m[0] })); last = m.index + m[0].length; if (m[0].length === 0) rx.lastIndex++; }
    frag.append(text.slice(last));
    return frag;
  }
  HS.highlight = highlight;

  /* Closing the search: ✕ button, Esc (native dialog cancel), a click on the backdrop, Ctrl+K again, or the phone's back
     button (an extra history entry is pushed on open). Focus returns to whatever was focused before, unless we navigate. */
  // the dialog's own "close" event is not dispatched reliably in every embedded browser, so closing is driven from here
  const pal = { open: false, pushed: false, popped: false, waitPop: false, after: null, returnTo: null };
  function runPalAfter() { const f = pal.after; pal.after = null; if (f) f(); }
  function finishClose() {
    if (!pal.open) return runPalAfter();
    pal.open = false;
    if (!pal.after && pal.returnTo && document.contains(pal.returnTo)) pal.returnTo.focus();
    if (pal.pushed && !pal.popped) {
      pal.pushed = false; pal.waitPop = true;
      try { history.back(); } catch { pal.waitPop = false; }
      setTimeout(() => { if (pal.waitPop) { pal.waitPop = false; runPalAfter(); } }, 400); // sandboxed frames may not fire popstate
      if (pal.waitPop) return;
    }
    pal.pushed = false; pal.popped = false; runPalAfter();
  }
  function closePalette(after) { if (after) pal.after = after; if ($("#palette").open) $("#palette").close(); finishClose(); }
  HS.closePalette = closePalette;
  $("#palette").addEventListener("close", finishClose); // Esc via the browser, where the event does fire
  $("#palette").addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); closePalette(); } });
  $("#palette").addEventListener("click", (e) => { if (e.target === e.currentTarget) closePalette(); }); // backdrop
  window.addEventListener("popstate", () => {
    if (pal.waitPop) { pal.waitPop = false; runPalAfter(); return; }
    if (pal.open) { pal.popped = true; closePalette(); }
  });

  function openSearchTarget(d) {
    closePalette(() => {
      if (d.type === "Questions") go("single", { id: d.id });
      else if (d.type === "Topics") go("bank", { ids: d.ids, label: d.title });
      else if (d.type === "Trials") go("trials", { q: d.id });
      else if (d.type === "References") go("references", { q: String(d.id), focus: d.id });
      else if (d.type === "Calculators") go("calculators", { id: d.id });
    });
  }
  HS.openSearchTarget = openSearchTarget;

  function openPalette() {
    const dlg = $("#palette");
    pal.returnTo = document.activeElement; pal.popped = false; pal.after = null; pal.open = true;
    try { history.pushState({ hsPalette: 1 }, ""); pal.pushed = true; } catch { pal.pushed = false; }
    const filt = { set: 0, d: "", status: "", upd: false };
    const input = h("input", { class: "palette-input", id: "paletteInput", type: "search", placeholder: HS.t("searchPh"), "aria-label": "Search", autocomplete: "off" });
    const status = h("div", { class: "small faint", style: "padding:6px 18px" });
    const results = h("div", { class: "palette-results", role: "listbox" });
    const setSel = h("select", { class: "input", style: "height:30px;width:auto", "aria-label": "Domain", onchange: (e) => { filt.set = Number(e.target.value); run(); } },
      h("option", { value: "0" }, HS.t("allSets")), content.meta.sets.map((s) => h("option", { value: s.set }, `${s.set}. ${s.title}`)));
    const dSel = h("select", { class: "input", style: "height:30px;width:auto", "aria-label": "Difficulty", onchange: (e) => { filt.d = e.target.value; run(); } },
      h("option", { value: "" }, "Any difficulty"), h("option", { value: "e" }, "Easy"), h("option", { value: "m" }, "Medium"), h("option", { value: "h" }, "Hard"));
    const sSel = h("select", { class: "input", style: "height:30px;width:auto", "aria-label": "Status", onchange: (e) => { filt.status = e.target.value; run(); } },
      h("option", { value: "" }, "Any status"), ["unseen", "correct", "incorrect", "bookmarked", "flagged"].map((s) => h("option", { value: s }, HS.t(s) === s ? s[0].toUpperCase() + s.slice(1) : HS.t(s))));
    const uBtn = h("button", { class: "chip", type: "button", "aria-pressed": "false", onclick: () => { filt.upd = !filt.upd; uBtn.setAttribute("aria-pressed", String(filt.upd)); run(); } }, HS.t("updated"));
    let sel = 0, flat = [];
    function run() {
      const q = input.value.trim();
      results.replaceChildren(); flat = []; sel = 0;
      if (!q) { status.textContent = "Type to search. Tolerates small typos. Enter opens the highlighted result."; return; }
      const { groups, terms } = search.query(q, filt);
      const order = ["Questions", "Topics", "Trials", "References", "Calculators"];
      let total = 0;
      for (const g of order) {
        const list = groups[g]; if (!list || !list.length) continue; total += list.length;
        const box = h("div", { class: "pgroup" }, h("h4", {}, `${g} · ${list.length}`));
        for (const { d } of list.slice(0, g === "Questions" ? 10 : 6)) {
          const idx = flat.length; flat.push(d);
          box.append(h("button", { class: "pitem", type: "button", role: "option", "data-i": idx, onclick: () => openSearchTarget(d) },
            h("div", {}, highlight(d.title, terms)), h("div", { class: "s" }, highlight(d.sub.slice(0, 180), terms))));
        }
        if (g === "Questions" && list.length > 10) box.append(h("button", { class: "pitem small", type: "button", onclick: () => closePalette(() => go("bank", { ids: list.map((x) => x.d.id), label: `Search: “${q}”` })) }, `Show all ${list.length} questions in the Question Bank →`));
        results.append(box);
      }
      status.textContent = total ? `${total} result${total > 1 ? "s" : ""}${search.built ? "" : " · still indexing options and explanations"}` : "No results. Try fewer or different words.";
      mark();
    }
    function mark() { results.querySelectorAll(".pitem[data-i]").forEach((b) => b.setAttribute("aria-selected", String(Number(b.dataset.i) === sel))); const cur = results.querySelector(`.pitem[data-i="${sel}"]`); if (cur) cur.scrollIntoView({ block: "nearest" }); }
    input.addEventListener("input", debounce(run, 90));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { sel = Math.min(sel + 1, flat.length - 1); mark(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); mark(); e.preventDefault(); }
      else if (e.key === "Enter" && flat[sel]) { openSearchTarget(flat[sel]); }
    });
    const closeBtn = h("button", { class: "palette-close", type: "button", "aria-label": HS.lang === "ar" ? "إغلاق البحث" : "Close search", title: HS.lang === "ar" ? "إغلاق (Esc)" : "Close (Esc)", onclick: () => closePalette() }, svg("close"));
    dlg.replaceChildren(h("div", { class: "palette-head" }, input, closeBtn), h("div", { class: "row", style: "padding:8px 18px;gap:8px" }, setSel, dSel, sSel, uBtn), status, results);
    dlg.showModal(); input.focus(); run();
    if (!search.built) search.build().then(() => { if (dlg.open) run(); });
  }
  HS.openPalette = openPalette;
  $("#searchBtn").onclick = openPalette;
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if ($("#palette").open) closePalette(); else openPalette(); }
  });

  /* ------------------------------------------------------------------ keyboard shortcuts overlay (?) */
  function openHelp() {
    const rows = [["Ctrl / ⌘ + K", HS.lang === "ar" ? "البحث في كل شيء" : "Search everything"], ["A–E  ·  1–5", HS.lang === "ar" ? "اختيار إجابة" : "Choose an answer"],
      ["Enter", HS.lang === "ar" ? "إرسال الإجابة / التالي" : "Submit / next"], ["N  ·  P", HS.lang === "ar" ? "السؤال التالي / السابق" : "Next / previous question"],
      ["F", HS.lang === "ar" ? "الإبلاغ عن مشكلة (أو تعليم للمراجعة في الامتحان)" : "Report a problem (mark for review in exams)"], ["?", HS.lang === "ar" ? "عرض هذه القائمة" : "Show this list"]];
    confirmDlg({ title: HS.t("shortcuts"), ok: HS.lang === "ar" ? "تم" : "Done", cancel: null,
      body: h("div", { class: "help-grid" }, rows.map(([k, d]) => [h("kbd", { style: "font-size:.85em;padding:2px 8px;white-space:nowrap" }, k), h("span", {}, d)])) });
  }
  HS.openHelp = openHelp;
  document.addEventListener("keydown", (e) => {
    if (e.key !== "?" || e.ctrlKey || e.metaKey) return;
    if (e.target.closest && e.target.closest("input, textarea, select") || document.querySelector("dialog[open]")) return;
    e.preventDefault(); openHelp();
  });

  /* ------------------------------------------------------------------ capnography trace (signature motif) */
  /** Draws a scrolling EtCO2 waveform: flat baseline, sharp upstroke, alveolar plateau, sharp downstroke. */
  HS.capno = function (canvas, opts = {}) {
    const ctx = canvas.getContext("2d"); if (!ctx) return () => {};
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, x0 = 0, last = performance.now(), dead = false;
    const period = opts.period || 260; // px per breath
    function wave(x) {
      const p = ((x % period) + period) % period / period;
      if (p < 0.38) return 0.04;                       // inspiration: baseline near zero
      if (p < 0.43) return 0.04 + (p - 0.38) / 0.05 * 0.82; // expiratory upstroke
      if (p < 0.82) return 0.86 + (p - 0.43) * 0.22;   // alveolar plateau, slight upslope
      if (p < 0.86) return 0.946 - (p - 0.82) / 0.04 * 0.9; // inspiratory downstroke
      return 0.04;
    }
    function draw(now) {
      if (dead || !canvas.isConnected) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = canvas.clientWidth, hgt = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hgt * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, hgt);
      x0 += reduce ? 0 : (now - last) * 0.06; last = now;
      const color = css("--mon-trace") || "#f2c14e";
      const top = hgt * 0.18, amp = hgt * 0.62, base = top + amp;
      const grad = ctx.createLinearGradient(0, top, 0, base);
      grad.addColorStop(0, color + "40"); grad.addColorStop(1, color + "00");
      ctx.beginPath(); ctx.moveTo(0, base);
      for (let x = 0; x <= w; x += 2) ctx.lineTo(x, base - wave(x + x0) * amp);
      ctx.lineTo(w, base); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) { const y = base - wave(x + x0) * amp; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
      if (!reduce) raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => { dead = true; cancelAnimationFrame(raf); };
  };

  /* ------------------------------------------------------------------ charts (one library, theme-aware) */
  HS.chart = function (canvas, config) {
    if (!window.Chart) { canvas.replaceWith(h("p", { class: "muted small", text: "Charts could not load. Check your connection." })); return null; }
    const fg2 = css("--fg-2"), line = css("--line");
    Chart.defaults.color = fg2; Chart.defaults.borderColor = line; Chart.defaults.font.family = css("--font");
    config.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 300 } }, config.options || {});
    const c = new Chart(canvas, config); HS.charts.push(c); return c;
  };

  /* ------------------------------------------------------------------ first-run tour
   * Spotlights real elements one by one. Shown once (settings.tourDone, synced; prefs fallback for preview mode);
   * Settings can replay it. Esc skips, arrow keys move (direction-aware), the drawer opens on phones when needed. */
  const TOUR = [
    { en: ["Welcome", "A one-minute tour of where everything is. You can skip it at any time and replay it later from Settings."],
      ar: ["أهلًا بك", "جولة سريعة في دقيقة واحدة لتعرف مكان كل شيء. يمكنك تخطيها في أي وقت وإعادتها لاحقًا من الإعدادات."] },
    { sel: "#trackSwitch", drawer: true, en: ["Study track", "Choose Part I, Part II or all questions. The home page, question bank and exams all follow this choice."],
      ar: ["مسار المذاكرة", "اختر الجزء الأول أو الثاني أو كل الأسئلة. الصفحة الرئيسية وبنك الأسئلة والامتحانات كلها تتبع اختيارك."] },
    { sel: '[data-tour="plan"]', view: "dashboard", en: ["Today's plan", "Your due reviews plus a daily share of new questions, sized to your exam date. One click starts it."],
      ar: ["خطة اليوم", "مراجعاتك المستحقة مع حصة يومية من الأسئلة الجديدة، محسوبة حسب تاريخ امتحانك. ضغطة واحدة تبدأها."] },
    { sel: '.nav-item[data-view="bank"]', drawer: true, en: ["Question bank", "Browse and filter every question by domain, topic, difficulty and status, then practise in tutor or timed mode."],
      ar: ["بنك الأسئلة", "تصفّح كل الأسئلة وفلترها حسب المجال والموضوع والصعوبة والحالة، ثم تدرّب بوضع الشرح أو بالوقت."] },
    { sel: '.nav-item[data-view="exam"]', drawer: true, en: ["Exam simulation", "A timed mock paper across all domains. Answers stay hidden until you submit, then you get a full analysis."],
      ar: ["محاكاة الامتحان", "امتحان تجريبي بوقت محدد من كل المجالات. الإجابات لا تظهر حتى التسليم، ثم تحصل على تحليل كامل."] },
    { sel: '.nav-item[data-view="topics"]', drawer: true, en: ["Topics and notes", "Revision notes for each domain: key concepts, high-yield numbers, guideline updates and landmark trials."],
      ar: ["الموضوعات والشروح", "ملخصات مراجعة لكل مجال: المفاهيم الأساسية والأرقام المهمة وتحديثات الإرشادات وأهم التجارب."] },
    { sel: '.nav-item[data-view="notebook"]', drawer: true, en: ["My notes", "Your bookmarked questions, personal notes and questions to review, in one place and saved to your account."],
      ar: ["ملاحظاتي", "أسئلتك المحفوظة وملاحظاتك الشخصية والأسئلة التي تحتاج مراجعة، في مكان واحد ومحفوظة على حسابك."] },
    { sel: "#searchBtn", en: ["Search and settings", "Search questions, topics, trials and calculators with Ctrl+K. Settings (in the menu) holds your exam date, language, theme and this tour."],
      ar: ["البحث والإعدادات", "ابحث في الأسئلة والموضوعات والتجارب والحاسبات بـ Ctrl+K. ومن الإعدادات في القائمة تحدد تاريخ امتحانك واللغة والمظهر وتعيد هذه الجولة."] },
  ];
  let tourEl = null;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(sel, ms = 3000) { const end = Date.now() + ms; while (Date.now() < end) { const n = sel && document.querySelector(sel); if (n && n.getClientRects().length) return n; await sleep2(80); } return null; }
  function tourSeen() { return !!(store.settings.tourDone || prefs.get("tourDone", false)); }
  function endTour(saveDone) {
    if (!tourEl) return;
    tourEl.cleanup(); tourEl.remove(); tourEl = null;
    if (mq.matches) closeDrawer();
    if (saveDone) { prefs.set("tourDone", true); if (!store.settings.tourDone) store.saveSettings({ tourDone: true }); }
  }
  async function startTour() {
    if (tourEl) return;
    if ($("#palette").open) closePalette();
    const AR = () => HS.lang === "ar";
    const spot = h("div", { class: "tour-spot none" });
    const title = h("h2", { id: "tourTitle" }), text = h("p", { id: "tourText" }), count = h("span", { class: "small faint tnum" });
    const dots = h("div", { class: "tour-dots", "aria-hidden": "true" }, TOUR.map(() => h("i")));
    const skip = h("button", { class: "btn ghost sm", type: "button", onclick: () => endTour(true) });
    const back = h("button", { class: "btn sm", type: "button", onclick: () => show(i - 1) });
    const next = h("button", { class: "btn primary sm", type: "button", onclick: () => (i < TOUR.length - 1 ? show(i + 1) : endTour(true)) });
    const card = h("div", { class: "tour-card", role: "dialog", "aria-modal": "true", "aria-labelledby": "tourTitle", "aria-describedby": "tourText" },
      h("div", { class: "row", style: "justify-content:space-between;gap:8px" }, count, dots), title, text,
      h("div", { class: "tour-foot" }, skip, h("span", { class: "spacer" }), back, next));
    const NS = "http://www.w3.org/2000/svg", dim = document.createElementNS(NS, "svg"), dimPath = document.createElementNS(NS, "path");
    dim.setAttribute("class", "tour-dim"); dim.setAttribute("aria-hidden", "true"); dim.append(dimPath);
    tourEl = h("div", { class: "tour" }, dim, spot, card);
    document.body.append(tourEl);
    let i = 0, target = null, token = 0;
    function place() {
      const vw = innerWidth, vh = innerHeight, cw = card.offsetWidth, ch = card.offsetHeight, m = 12;
      dim.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
      const full = `M0 0H${vw}V${vh}H0Z`;
      if (!target) { dimPath.setAttribute("d", full); spot.className = "tour-spot none"; card.style.left = Math.round((vw - cw) / 2) + "px"; card.style.top = Math.round((vh - ch) / 2) + "px"; return; }
      const r = target.getBoundingClientRect(), pad = 6;
      const x = r.left - pad, y = r.top - pad, w = r.width + pad * 2, hh = r.height + pad * 2;
      dimPath.setAttribute("d", `${full}M${x} ${y}h${w}v${hh}h${-w}Z`); // even-odd fill leaves the target uncovered
      spot.className = "tour-spot";
      Object.assign(spot.style, { left: x + "px", top: y + "px", width: w + "px", height: hh + "px" });
      let top, left;
      if (vw < 600) { top = r.bottom + m + ch < vh ? r.bottom + m : Math.max(m, r.top - m - ch); left = (vw - cw) / 2; }
      else {
        const side = AR() ? r.left - m - cw : r.right + m; // beside the target, toward the content
        if (r.width < vw * 0.35 && side >= m && side + cw <= vw - m) { left = side; top = Math.min(Math.max(m, r.top), vh - ch - m); }
        else { top = r.bottom + m + ch < vh ? r.bottom + m : Math.max(m, r.top - m - ch); left = Math.min(Math.max(m, r.left), vw - cw - m); }
      }
      card.style.left = Math.round(left) + "px"; card.style.top = Math.round(top) + "px";
    }
    async function show(n) {
      if (n < 0 || n >= TOUR.length) return;
      i = n; const my = ++token; const st = TOUR[i];
      const [tt, tx] = AR() ? st.ar : st.en;
      title.textContent = tt; text.textContent = tx;
      count.textContent = `${i + 1}/${TOUR.length}`;
      [...dots.children].forEach((d, k) => d.classList.toggle("on", k === i));
      skip.textContent = AR() ? "تخطي" : "Skip"; back.textContent = AR() ? "السابق" : "Back";
      next.textContent = i === TOUR.length - 1 ? (AR() ? "ابدأ" : "Done") : (AR() ? "التالي" : "Next");
      back.disabled = i === 0;
      target = null; place();
      if (st.view && HS.route && HS.route.view !== st.view) go(st.view);
      if (mq.matches) { if (st.drawer) openDrawer(); else closeDrawer(); }
      let node = st.sel ? await waitFor(st.sel) : null;
      if (my !== token || !tourEl) return;
      if (node) { node.scrollIntoView({ block: "center", inline: "nearest" }); await sleep2(mq.matches && st.drawer ? 260 : 120); }
      if (my !== token || !tourEl) return;
      target = node; place(); next.focus();
    }
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); endTour(true); return; }
      const fwd = AR() ? "ArrowLeft" : "ArrowRight", bwd = AR() ? "ArrowRight" : "ArrowLeft";
      if (e.key === fwd) { e.preventDefault(); next.click(); } else if (e.key === bwd) { e.preventDefault(); show(i - 1); }
      else if (e.key === "Tab") { // keep focus inside the card
        const f = [...card.querySelectorAll("button:not([disabled])")]; const a = f.indexOf(document.activeElement);
        e.preventDefault(); f[(a + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    };
    const onMove = () => { if (tourEl) place(); };
    // live views re-render; if the spotlighted node was replaced, find its successor
    const watch = setInterval(() => { if (target && !target.isConnected) { const n = document.querySelector(TOUR[i].sel); target = n && n.getClientRects().length ? n : null; place(); } }, 400);
    document.addEventListener("keydown", onKey, true);
    addEventListener("resize", onMove); addEventListener("scroll", onMove, true);
    tourEl.cleanup = () => { clearInterval(watch); document.removeEventListener("keydown", onKey, true); removeEventListener("resize", onMove); removeEventListener("scroll", onMove, true); };
    show(0);
  }
  HS.startTour = (opts = {}) => { if (opts.home) go("dashboard"); startTour(); };
  HS.tourSeen = tourSeen;

  /* ------------------------------------------------------------------ boot */
  HS.boot = async function () {
    document.documentElement.lang = HS.lang; document.documentElement.dir = HS.lang === "ar" ? "rtl" : "ltr";
    $("#langBtn").textContent = HS.lang === "ar" ? "EN" : "ع";
    const th = prefs.get("theme", "system"); if (th !== "system") document.documentElement.setAttribute("data-theme", th);
    document.documentElement.setAttribute("data-fs", prefs.get("fs", "m"));
    if (prefs.get("collapsed", false)) $("#app").classList.add("collapsed");
    syncThemeBtn(); setSave("local", HS.t("connecting"));
    const metaP = content.loadMeta();
    await Promise.all([store.init().catch((e) => { console.error(e); store.mode = "local"; setSave("local"); }), metaP]);
    renderProfile();
    const hv = (location.hash || "").slice(1);
    go(TOP.has(hv) ? hv : "dashboard");
    store.onChange(debounce(() => { if (HS.route && HS.views[HS.route.view] && HS.views[HS.route.view].live) render(); }, 300));
    content.loadAll().then(() => search.build()).catch((e) => console.warn("background load", e));
    if (!tourSeen()) setTimeout(() => { if (!tourSeen() && !document.querySelector("dialog[open]")) startTour(); }, 900);
  };
})();
