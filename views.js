/* DR.HASNAA SHOKR — views. Each view is an async function returning a DOM node. */
(function () {
  "use strict";
  const HS = window.HS;
  const { h, store, content, t, fmtPct, fmtDur, fmtHM, fmtDate, shuffle, dayKey } = HS;
  const LET = ["A", "B", "C", "D", "E"];
  const DIFF = { e: "easy", m: "medium", h: "hard" };
  const transient = new Map(); // single-question sessions are not persisted

  /* ------------------------------------------------------------------ shared pieces */
  function pageHead(title, sub, crumbs, actions) {
    return h("div", {},
      crumbs ? h("nav", { class: "crumbs", "aria-label": "Breadcrumb" }, crumbs.map((c, i) => [i ? h("span", { "aria-hidden": "true" }, "›") : null,
        c.view ? h("a", { href: "#" + c.view, onclick: (e) => { e.preventDefault(); HS.go(c.view, c.params || {}); } }, c.label) : h("span", { "aria-current": "page" }, c.label)])) : null,
      h("div", { class: "page-head" }, h("div", {}, h("h1", { text: title }), sub ? h("p", { class: "muted", text: sub }) : null), actions ? h("div", { class: "row" }, actions) : null));
  }
  const homeCrumb = () => ({ label: t("dashboard"), view: "dashboard" });
  const ltr = (node) => { if (HS.lang === "ar") node.setAttribute("dir", "ltr"); return node; };
  function diffPill(d) { const k = DIFF[d] || d; return h("span", { class: "pill " + k, title: "Difficulty" }, h("span", { class: "diff-dots", "aria-hidden": "true" }, k === "easy" ? "●○○" : k === "medium" ? "●●○" : "●●●"), " ", t(k)); }
  function statusOf(id) { const p = store.progress[id]; return !p ? "unseen" : p[3] ? "correct" : "incorrect"; }
  function domainStats() {
    const s = Array.from({ length: 21 }, () => ({ att: 0, cor: 0, seen: 0 }));
    for (const [id, p] of Object.entries(store.progress)) { const d = Math.ceil(id / 50); s[d].seen += 1; s[d].att += p[0]; s[d].cor += p[1]; }
    return s;
  }
  function empty(title, text, action) { return h("div", { class: "empty" }, h("h3", { text: title }), text ? h("p", { text }) : null, action || null); }
  function qChip(id) { return h("button", { class: "chip", type: "button", onclick: () => HS.go("single", { id }), title: "Open question " + id }, "Q" + id); }
  function relatedConflictFree(ids) {
    const meta = content.meta.qa.relatedPairs; const block = new Set(); const out = [];
    for (const id of ids) {
      if (block.has(id)) continue; out.push(id);
      for (const [a, b] of meta) { if (a === id) block.add(b); if (b === id) block.add(a); }
    }
    return out;
  }

  /* ------------------------------------------------------------------ sessions */
  function newSession({ mode, qids, title, limitSec }) {
    const s = {
      id: HS.uid(), mode, title, qids: qids.slice(), idx: 0, answers: {}, secs: {}, marked: [], perm: {},
      limitSec: limitSec || 0, remainSec: limitSec || 0, status: "active", createdAt: Date.now(), updatedAt: Date.now(),
    };
    if (store.settings.shuffle && mode !== "single") for (const id of s.qids) s.perm[id] = shuffle(LET).join("");
    return s;
  }
  function startSession(opts) {
    const s = newSession(opts);
    if (opts.mode === "single") transient.set(s.id, s); else store.saveSession(s);
    HS.go("run", { sid: s.id });
  }
  HS.startSession = startSession;
  function activeSessions() { return [...store.sessions.values()].filter((s) => s.status === "active").sort((a, b) => b.updatedAt - a.updatedAt); }
  function doneExams() { return [...store.sessions.values()].filter((s) => s.status === "done" && (s.mode === "exam" || s.mode === "timed")).sort((a, b) => b.finishedAt - a.finishedAt); }
  const modeLabel = (m) => ({ tutor: t("tutor"), timed: t("timed"), review: t("review"), exam: t("exam"), single: "Question" })[m] || m;

  /* ------------------------------------------------------------------ dashboard */
  HS.views.dashboard = async function () {
    await content.loadMeta();
    const AR = HS.lang === "ar";
    // everything on the home page follows the active study track
    const trackSet = new Set(HS.trackIds());
    const trackTotal = trackSet.size;
    const prog = Object.fromEntries(Object.entries(store.progress).filter(([id]) => trackSet.has(Number(id))));
    const ids = Object.keys(prog);
    const attempted = ids.length;
    const totAtt = ids.reduce((a, k) => a + prog[k][0], 0), totCor = ids.reduce((a, k) => a + prog[k][1], 0);
    const acc = totAtt ? totCor / totAtt : null;
    const streak = HS.streakOf(store.activity);
    const weekStart = dayKey(new Date(Date.now() - 6 * 864e5));
    const weekSec = Object.entries(store.activity).filter(([k]) => k >= weekStart).reduce((a, [, v]) => a + v[2], 0);
    const ds = Array.from({ length: 21 }, () => ({ att: 0, cor: 0, seen: 0, total: 0 }));
    for (const id of trackSet) ds[Math.ceil(id / 50)].total += 1;
    for (const [id, p] of Object.entries(prog)) { const d = ds[Math.ceil(id / 50)]; d.seen += 1; d.att += p[0]; d.cor += p[1]; }
    // readiness: recency-weighted accuracy of latest answers (2-week half-life) blended with domain coverage
    let wSum = 0, wOk = 0; const now = Date.now();
    for (const p of Object.values(prog)) { const w = Math.pow(0.5, (now - p[2]) / (14 * 864e5)); wSum += w; wOk += w * p[3]; }
    const domsInTrack = ds.slice(1).filter((d) => d.total > 0);
    const coverage = domsInTrack.filter((d) => d.seen >= Math.min(5, d.total)).length / Math.max(1, domsInTrack.length);
    const readiness = attempted >= 20 ? Math.round(100 * (0.75 * (wOk / wSum) + 0.25 * coverage)) : null;
    const first = store.me && store.me.name ? (store.me.name.split(/\s+/).find((w) => !/^(dr|prof|د|أ\.?د)\.?$/i.test(w) && !/\.$/.test(w)) || "") : "";
    const hr = new Date().getHours();
    const greet = t(hr < 12 ? "morning" : hr < 18 ? "afternoon" : "evening") + (first ? (AR ? " يا " : ", ") + first : "");

    // exam countdown
    const ex = store.settings.examDate ? new Date(store.settings.examDate + "T00:00:00") : null;
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const daysLeft = ex ? Math.round((ex - today0) / 864e5) : null;

    // today's plan: due reviews + the daily share of unseen questions before the exam
    const due = smartQueue();
    const unseen = []; for (let i = 1; i <= 1000; i++) if (trackSet.has(i) && !prog[i]) unseen.push(i);
    const autoNew = daysLeft && daysLeft > 0 ? Math.ceil(unseen.length / daysLeft) : 40;
    const newTarget = Math.min(unseen.length, store.settings.dailyNew || Math.min(150, autoNew));
    const dueTarget = Math.min(due.length, 40);
    const doneToday = (store.activity[dayKey()] || [0])[0];
    const planTotal = newTarget + dueTarget;
    const planFrac = planTotal ? Math.min(1, doneToday / planTotal) : 1;
    function startPlan() {
      const order = relatedConflictFree(due.slice(0, dueTarget).concat(unseen.slice(0, newTarget)));
      if (!order.length) { HS.toast(t("planDone")); return; }
      startSession({ mode: "tutor", title: t("todayPlan"), qids: order });
    }

    // header monitor band
    const canvas = h("canvas", { class: "capno", "aria-hidden": "true" });
    const examChip = h("button", { class: "mon-chip", type: "button", onclick: examDateDialog },
      h("i"), ex ? `${fmtDate(ex)} · ${daysLeft > 0 ? daysLeft + " " + t("days") : daysLeft === 0 ? t("examToday") : t("examPassed")}` : t("setExam"));
    const readout = (k, v, unit, cls) => h("div", { class: "mon-readout " + (cls || "") }, h("div", { class: "k" }, k), h("div", { class: "v" }, v, unit ? h("small", {}, unit) : null));
    const band = h("section", { class: "monitor", "aria-label": AR ? "ملخص اليوم" : "Today at a glance" }, canvas,
      h("div", { class: "stack", style: "gap:10px;min-width:0" },
        h("div", { class: "eyebrow" }, greet),
        h("h1", {}, daysLeft != null && daysLeft > 0
          ? (AR ? ["باقي ", h("em", {}, String(daysLeft)), " ", t("daysLeft")] : [h("em", {}, String(daysLeft)), " ", t("daysLeft")])
          : (AR ? "جاهز لمذاكرة اليوم؟" : "Ready for today's session?")),
        h("p", { class: "muted", style: "margin:0;max-width:52ch" }, unseen.length
          ? `${t("planHint")} ${newTarget} ${t("perDay")}${due.length ? (AR ? `، مع ${dueTarget} مراجعة مستحقة.` : `, plus ${dueTarget} reviews due.`) : "."}`
          : (AR ? "أنهيت كل الأسئلة. المراجعة الذكية تحافظ على ما تعلّمته." : "You have attempted every question. Smart review keeps it fresh.")),
        h("div", { class: "row", style: "margin-top:6px" }, examChip,
          h("button", { class: "btn mon", type: "button", onclick: startPlan }, planTotal && planFrac < 1 ? `${t("startPlan")} (${Math.max(0, planTotal - doneToday)})` : t("todayPlan")))),
      h("div", { class: "mon-readouts" },
        readout(t("readiness"), readiness == null ? "—" : String(readiness), readiness == null ? "" : "%", "amber"),
        readout(t("accuracy"), acc == null ? "—" : String(Math.round(acc * 100)), acc == null ? "" : "%"),
        readout(t("attempted"), String(attempted), "/" + trackTotal),
        readout(t("streak"), String(streak), AR ? "يوم" : streak === 1 ? "day" : "days"),
        readout(AR ? "اليوم" : "Today", String(doneToday), AR ? "سؤال" : "Qs"),
        readout(AR ? "٧ أيام" : "7 days", String(Math.round(weekSec / 60)), AR ? "دقيقة" : "min")));
    HS.views.dashboard.after = () => { HS.views.dashboard.stopCapno = HS.capno(canvas); };

    // plan card
    const ringSvg = (() => {
      const r = 38, c = 2 * Math.PI * r;
      const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 92 92"); s.setAttribute("class", "plan-ring"); s.setAttribute("role", "img"); s.setAttribute("aria-label", `${doneToday} / ${planTotal}`);
      s.innerHTML = `<circle cx="46" cy="46" r="${r}" fill="none" style="stroke:var(--surface-2)" stroke-width="8"/><circle cx="46" cy="46" r="${r}" fill="none" style="stroke:var(--primary)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c * planFrac} ${c}" transform="rotate(-90 46 46)"/><text x="46" y="51" text-anchor="middle" style="fill:var(--fg);font:600 17px var(--display)">${Math.min(doneToday, planTotal)}/${planTotal}</text>`;
      return s;
    })();
    const active = activeSessions()[0];
    const planCard = h("section", { class: "card c-5 raised" },
      h("div", { class: "card-head" }, h("h2", {}, t("todayPlan")), planFrac >= 1 && planTotal ? h("span", { class: "pill ok" }, t("planDone")) : null),
      h("div", { class: "row", style: "gap:16px;flex-wrap:nowrap;align-items:center" }, ringSvg,
        h("div", { class: "plan-rows", style: "flex:1;min-width:0" },
          h("div", {}, h("span", { class: "muted" }, t("dueReviews")), h("strong", { class: "tnum" }, String(dueTarget))),
          h("div", {}, h("span", { class: "muted" }, t("newQs")), h("strong", { class: "tnum" }, String(newTarget))),
          h("div", { style: "border:0" }, h("span", { class: "muted" }, t("doneToday")), h("strong", { class: "tnum" }, String(doneToday))))),
      h("div", { class: "row", style: "margin-top:14px" },
        h("button", { class: "btn primary", type: "button", onclick: startPlan }, t("startPlan")),
        active ? h("button", { class: "btn", type: "button", onclick: () => HS.go("run", { sid: active.id }) }, `${t("resume")}: ${active.title.length > 26 ? modeLabel(active.mode) : active.title}`) : null,
        h("button", { class: "btn ghost sm", type: "button", onclick: dailyTargetDialog }, AR ? "تعديل الهدف" : "Adjust target")));

    // question of the day (stable for the date; prefers a question not yet answered)
    const seed = [...dayKey()].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const pool = [...trackSet].sort((a, b) => a - b);
    let qi = seed % pool.length; for (let k = 0; k < pool.length && prog[pool[qi]] && attempted < trackTotal; k++) qi = (qi + 1) % pool.length;
    const qid = pool[qi];
    const q = await content.q(qid);
    const qBox = h("div", { class: "opts" });
    const qFoot = h("div", { class: "row", style: "margin-top:10px" });
    const answeredToday = prog[qid] && dayKey(new Date(prog[qid][2])) === dayKey();
    function drawQ(choice) {
      qBox.replaceChildren(...LET.map((L) => {
        const reveal = !!choice;
        const cls = "opt" + (reveal && L === q.correctAnswer ? " correct" : reveal && L === choice && L !== q.correctAnswer ? " wrong" : "");
        return h("button", { class: cls, type: "button", disabled: reveal, onclick: () => answerQ(L) }, h("span", { class: "L" }, L), h("span", {}, q.options[L]), h("span"));
      }));
      qFoot.replaceChildren(...[choice ? h("span", { class: "pill " + (choice === q.correctAnswer ? "ok" : "bad") }, choice === q.correctAnswer ? t("correct") : `${t("incorrect")} · ${q.correctAnswer}`) : h("span", { class: "small faint" }, AR ? "اختر إجابة لترى النتيجة فورًا" : "Choose an answer to see the result"),
        h("span", { class: "spacer" }), h("button", { class: "btn sm", type: "button", onclick: () => HS.go("single", { id: qid }) }, choice ? t("openExplanation") : (AR ? "افتح السؤال" : "Open question"))]);
    }
    function answerQ(L) { store.saveAttempt({ qid, opt: L, ok: L === q.correctAnswer, sec: 0, mode: "d" }); drawQ(L); }
    const lastToday = answeredToday && store.weekLog ? [...store.weekLog.items].reverse().find((it) => it[0] === qid && dayKey(new Date(it[4])) === dayKey()) : null;
    drawQ(lastToday ? lastToday[1] : null);
    const qotd = h("section", { class: "card c-7 qotd" },
      h("div", { class: "card-head" }, h("h2", {}, t("qotd")), h("span", { class: "small faint" }, `Q${qid} · ${q.topic}`)),
      ltr(h("p", { class: "stem" }, q.stem)), ltr(qBox), qFoot);

    // domain board
    const board = h("div", { class: "board" }, content.meta.sets.map((s) => {
      const d = ds[s.set], a = d.att ? d.cor / d.att : null;
      const color = a == null ? "var(--line)" : a >= 0.75 ? "var(--ok)" : a >= 0.55 ? "var(--warn)" : "var(--bad)";
      return h("button", { class: "cell-d", type: "button", onclick: () => HS.go("topic", { n: s.set }), title: s.title },
        h("span", { class: "n" }, h("span", {}, String(s.set).padStart(2, "0")), h("span", { class: "dot", style: `background:${color}` })),
        h("span", { class: "t" }, s.title),
        h("span", { class: "row", style: "justify-content:space-between;gap:4px" }, h("span", { class: "acc small" }, a == null ? "—" : Math.round(a * 100) + "%"), h("span", { class: "small faint tnum" }, `${d.seen}/${d.total}`)),
        h("span", { class: "lvl" }, h("i", { style: `width:${d.total ? (d.seen / d.total) * 100 : 0}%;background:var(--primary)` })));
    }));

    const weak = ds.map((d, i) => ({ i, ...d, acc: d.att ? d.cor / d.att : 0 })).slice(1).filter((d) => d.seen >= 5).sort((a, b) => a.acc - b.acc).slice(0, 3);
    const weakBox = weak.length
      ? h("div", { class: "weak" }, weak.map((d) => [h("div", { style: "min-width:0" }, h("div", { class: "small", style: "font-weight:500" }, `${d.i}. ${content.setTitle(d.i)}`), h("div", { class: "bar", style: "margin-top:4px" }, h("i", { style: `width:${Math.round(d.acc * 100)}%;background:var(--bad)` }))),
          h("span", { class: "tnum small" }, fmtPct(d.acc)), h("button", { class: "btn sm", type: "button", onclick: () => practiseDomain(d.i) }, t("practiseNow"))]))
      : empty(AR ? "لا توجد نقاط ضعف بعد" : "No weak areas yet", AR ? "أجب عن ٥ أسئلة على الأقل في أي مجال ليظهر هنا." : "Answer at least 5 questions in a domain to see it ranked here.");

    const exams = doneExams().slice(0, 4);
    const examBox = exams.length
      ? h("div", { class: "stack", style: "gap:8px" }, exams.map((s) => h("button", { class: "tile", type: "button", style: "flex-direction:row;align-items:center;padding:10px 12px", onclick: () => HS.go("results", { sid: s.id }) },
          h("div", { style: "flex:1;min-width:0" }, h("div", { style: "font-weight:500" }, s.title), h("div", { class: "small faint" }, `${fmtDate(s.finishedAt)} · ${s.qids.length}`)),
          h("span", { class: "pill " + (s.mode === "exam" ? (s.score >= (s.passMark || 60) ? "ok" : "bad") : "neutral") }, `${s.score}%`))))
      : empty(AR ? "لا توجد امتحانات بعد" : "No exams yet", "", h("button", { class: "btn", type: "button", onclick: () => HS.go("exam") }, AR ? "ابدأ امتحانًا" : "Start an exam"));

    const heat = h("div", { class: "heat", role: "img", "aria-label": AR ? "الأسئلة المجابة يوميًا خلال ١٢ أسبوعًا" : "Questions answered per day over the last 12 weeks" });
    const start = new Date(); start.setDate(start.getDate() - 83 - ((start.getDay() + 6) % 7));
    const maxN = Math.max(1, ...Object.values(store.activity).map((v) => v[0]));
    for (let i = 0; i < 84 + ((new Date().getDay() + 6) % 7) + 1; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i); if (d > new Date()) break;
      const a = store.activity[dayKey(d)]; const n = a ? a[0] : 0;
      heat.append(h("i", { "data-l": n ? Math.min(4, Math.ceil((n / maxN) * 4)) : 0, title: `${fmtDate(d)}: ${n}` }));
    }
    const banner = store.mode === "local" ? h("div", { class: "banner warn", style: "margin-bottom:16px" }, h("strong", {}, AR ? "وضع المعاينة. " : "Preview mode. "),
      window.HS_BACKEND ? (AR ? "التقدّم غير محفوظ. أعد تحميل الصفحة وسجّل الدخول باسمك ورمزك." : "Progress is not saved. Reload and sign in with your name and PIN.")
        : (AR ? "التقدّم غير محفوظ. افتح الداش بورد المنشور وأنت مسجّل الدخول." : "Progress is not saved. Open the published dashboard while signed in to claude.ai.")) : null;

    return h("div", { class: "stack", style: "gap:16px" },
      banner, band,
      h("div", { class: "grid" }, planCard, qotd,
        h("section", { class: "card c-12" }, h("div", { class: "card-head" }, h("h2", {}, `${t("domains")} · ${HS.trackLabel()}`), h("span", { class: "legend" }, h("span", {}, h("i", { style: "background:var(--ok);border-radius:50%" }), "≥75%"), h("span", {}, h("i", { style: "background:var(--warn);border-radius:50%" }), "55–74%"), h("span", {}, h("i", { style: "background:var(--bad);border-radius:50%" }), "<55%"))), board),
        h("section", { class: "card c-4" }, h("div", { class: "card-head" }, h("h2", {}, t("weakest"))), weakBox),
        h("section", { class: "card c-4" }, h("div", { class: "card-head" }, h("h2", {}, t("recentExams")), h("button", { class: "btn ghost sm", type: "button", onclick: () => HS.go("progress") }, t("progress"))), examBox),
        h("section", { class: "card c-4" }, h("div", { class: "card-head" }, h("h2", {}, t("activity")), h("span", { class: "small faint" }, AR ? "١٢ أسبوعًا" : "12 weeks")), heat,
          h("div", { class: "legend", style: "margin-top:8px" }, AR ? "أقل" : "Less", [0, 1, 2, 3, 4].map((l) => h("i", { style: `background:var(--heat-${l})` })), AR ? "أكثر" : "More"))));
  };
  HS.views.dashboard.live = true;
  function examDateDialog() {
    const AR = HS.lang === "ar";
    const inp = h("input", { class: "input", id: "examDateIn", type: "date", value: store.settings.examDate || "", min: dayKey() });
    HS.confirm({ title: t("setExam"), ok: AR ? "حفظ" : "Save", cancel: AR ? "إلغاء" : "Cancel",
      body: h("div", { class: "stack" }, h("p", { class: "muted small", style: "margin:0" }, AR ? "يُستخدم لحساب العدّ التنازلي وعدد الأسئلة الجديدة اليومية." : "Used for the countdown and to size your daily plan."), h("div", { class: "field" }, h("label", { for: "examDateIn" }, AR ? "تاريخ الامتحان" : "Exam date"), inp)) })
      .then((ok) => { if (ok) { store.saveSettings({ examDate: inp.value || "" }); HS.render(); } });
  }
  function dailyTargetDialog() {
    const AR = HS.lang === "ar";
    const inp = h("input", { class: "input", id: "dailyIn", type: "number", min: "0", max: "300", value: String(store.settings.dailyNew || "") , placeholder: AR ? "تلقائي" : "Automatic" });
    HS.confirm({ title: AR ? "هدف الأسئلة الجديدة يوميًا" : "Daily new-question target", ok: AR ? "حفظ" : "Save", cancel: AR ? "إلغاء" : "Cancel",
      body: h("div", { class: "stack" }, h("p", { class: "muted small", style: "margin:0" }, AR ? "اتركه فارغًا ليُحسب تلقائيًا من تاريخ الامتحان." : "Leave empty to calculate it from your exam date."), h("div", { class: "field" }, h("label", { for: "dailyIn" }, AR ? "عدد الأسئلة" : "Questions per day"), inp)) })
      .then((ok) => { if (ok) { store.saveSettings({ dailyNew: Math.max(0, Math.min(300, Number(inp.value) || 0)) }); HS.render(); } });
  }
  function stat(label, value, sub, title) { return h("div", { class: "stat", title: title || null }, h("span", { class: "l" }, label), h("span", { class: "v" }, value), h("span", { class: "small faint" }, sub)); }
  function range(a, b) { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; }
  function practiseDomain(n) {
    let ids = range((n - 1) * 50 + 1, n * 50).filter((i) => HS.inTrack(i));
    if (!ids.length) ids = range((n - 1) * 50 + 1, n * 50);
    const order = ids.filter((i) => statusOf(i) === "incorrect").concat(ids.filter((i) => statusOf(i) === "unseen"), ids.filter((i) => statusOf(i) === "correct"));
    startSession({ mode: "tutor", title: `Practise: ${content.setTitle(n)}`, qids: relatedConflictFree(order).slice(0, 20) });
  }

  /* ------------------------------------------------------------------ question bank */
  const bankState = { set: 0, sub: "", d: "", status: "", upd: false, text: "", shown: 50 };
  HS.views.bank = async function (params) {
    await content.loadMeta();
    const m = content.meta;
    const preset = params.ids ? new Set(params.ids) : null;
    const S = bankState; S.shown = 50;
    if (preset) Object.assign(S, { set: 0, sub: "", d: "", status: "", upd: false, text: "" });
    const listEl = h("div", { class: "qlist" });
    const countEl = h("span", { class: "small muted", role: "status" });
    const subSel = h("select", { class: "input", id: "bankSub", "aria-label": "Subtopic", onchange: (e) => { S.sub = e.target.value; refresh(); } });
    function fillSubs() {
      subSel.replaceChildren(h("option", { value: "" }, "All subtopics"));
      if (!S.set) { subSel.disabled = true; return; }
      subSel.disabled = false;
      const lo = (S.set - 1) * 50 + 1, hi = S.set * 50; const seen = new Map();
      for (const [topic, sub, ids] of m.index) { const inSet = ids.filter((i) => i >= lo && i <= hi); if (!inSet.length) continue; const k = sub ? `${topic} — ${sub}` : topic; seen.set(k, (seen.get(k) || []).concat(inSet)); }
      for (const [k, ids] of [...seen.entries()].sort()) subSel.append(h("option", { value: ids.join(","), selected: S.sub === ids.join(",") }, `${k} (${ids.length})`));
    }
    function filtered() {
      const subIds = S.sub ? new Set(S.sub.split(",").map(Number)) : null;
      const tx = S.text.trim().toLowerCase();
      return content.lite.filter((q) => (preset ? preset.has(q.id) : HS.inTrack(q.id)) && (!S.set || q.s === S.set) && (!subIds || subIds.has(q.id)) && (!S.d || q.d === S.d)
        && (!S.upd || q.r === "g") && (!S.status || HS.matchStatus(q.id, S.status)) && (!tx || q.x.toLowerCase().includes(tx) || String(q.id) === tx));
    }
    let current = [];
    function refresh() {
      current = filtered();
      countEl.textContent = `${current.length} question${current.length === 1 ? "" : "s"}`;
      listEl.replaceChildren();
      if (!current.length) { listEl.append(empty("No questions match", "Clear a filter or change the search text.")); return; }
      for (const q of current.slice(0, S.shown)) {
        const st = statusOf(q.id);
        listEl.append(h("div", { class: "qrow", role: "button", tabindex: "0", onclick: () => HS.go("single", { id: q.id, list: current.map((x) => x.id) }), onkeydown: (e) => { if (e.key === "Enter") HS.go("single", { id: q.id, list: current.map((x) => x.id) }); } },
          h("span", { class: "qid" }, h("span", { class: "status-dot " + st, title: st, style: "margin-inline-end:6px" }), q.id),
          ltr(h("div", { style: "min-width:0" }, h("div", { class: "qstem" }, q.x), h("div", { class: "small faint" }, `${q.t}${q.u ? " · " + q.u : ""}`))),
          h("div", { class: "meta" }, diffPill(q.d), q.r === "g" ? h("span", { class: "pill upd" }, t("updated")) : null,
            store.bookmarks.has(q.id) ? h("span", { class: "pill neutral" }, t("bookmarked")) : null, store.flags[q.id] ? h("span", { class: "pill warn" }, t("flagged")) : null)));
      }
      if (current.length > S.shown) listEl.append(h("div", { class: "row", style: "justify-content:center;padding:12px" }, h("button", { class: "btn", type: "button", onclick: () => { S.shown += 100; refresh(); } }, `Show ${Math.min(100, current.length - S.shown)} more`)));
    }
    const setSel = h("select", { class: "input", id: "bankSet", "aria-label": "Domain", onchange: (e) => { S.set = Number(e.target.value); S.sub = ""; fillSubs(); refresh(); } },
      h("option", { value: "0" }, t("allSets")), m.sets.map((s) => h("option", { value: s.set, selected: S.set === s.set }, `${s.set}. ${s.title}`)));
    const dChips = h("div", { class: "chips", role: "group", "aria-label": t("difficulty") }, [["", "Any"], ["e", t("easy")], ["m", t("medium")], ["h", t("hard")]].map(([v, l]) =>
      h("button", { class: "chip", type: "button", "aria-pressed": String(S.d === v), onclick: (e) => { S.d = v; dChips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", "false")); e.currentTarget.setAttribute("aria-pressed", "true"); refresh(); } }, l)));
    const stSel = h("select", { class: "input", id: "bankStatus", "aria-label": t("status"), onchange: (e) => { S.status = e.target.value; refresh(); } },
      [["", "Any status"], ["unseen", t("unseen")], ["correct", t("correct")], ["incorrect", t("incorrect")], ["bookmarked", t("bookmarked")], ["flagged", t("flagged")]].map(([v, l]) => h("option", { value: v, selected: S.status === v }, l)));
    const updChip = h("button", { class: "chip", type: "button", "aria-pressed": String(S.upd), onclick: () => { S.upd = !S.upd; updChip.setAttribute("aria-pressed", String(S.upd)); refresh(); } }, t("updated"));
    const txt = h("input", { class: "input", id: "bankText", type: "search", placeholder: "Filter by words in the question or a number", value: S.text, "aria-label": "Filter text", oninput: HS.debounce((e) => { S.text = e.target.value; S.shown = 50; refresh(); }, 120) });
    fillSubs(); refresh();
    const due = smartQueue();
    const startTutor = () => { if (!current.length) return; startSession({ mode: "tutor", title: params.label || describeFilter(), qids: relatedConflictFree(current.map((q) => q.id)) }); };
    return h("div", {},
      pageHead(t("bank"), "Browse all 1,000 questions, filter them, and start a tutor session, a timed block or a smart review.", [homeCrumb(), { label: t("bank") }],
        [h("button", { class: "btn", type: "button", onclick: () => due.length ? startSession({ mode: "review", title: "Smart review", qids: due.slice(0, 25) }) : HS.toast("Nothing is due for review yet. Answer some questions first.") }, `${t("review")} (${due.length} due)`),
         h("button", { class: "btn", type: "button", onclick: () => timedDialog(current.map((q) => q.id), params.label || describeFilter()) }, t("timed") + "…"),
         h("button", { class: "btn primary", type: "button", onclick: startTutor }, `${t("tutor")}: start`)]),
      preset ? h("div", { class: "banner", style: "margin-bottom:12px" }, h("span", {}, `Showing ${params.label || "a selection"}.`), h("span", { class: "spacer" }), h("button", { class: "btn sm", type: "button", onclick: () => HS.go("bank") }, "Show the whole bank"))
        : HS.track() !== "all" ? h("div", { class: "banner", style: "margin-bottom:12px" }, h("span", { class: "pill upd" }, HS.trackLabel()), h("span", {}, t(HS.track() === "1" ? "trackOneNote" : "trackTwoNote"))) : null,
      h("div", { class: "card sticky-head", style: "margin-bottom:12px" },
        h("div", { class: "grid", style: "gap:12px" },
          h("div", { class: "field c-4" }, h("label", { for: "bankSet" }, "Domain (set)"), setSel),
          h("div", { class: "field c-4" }, h("label", { for: "bankSub" }, "Subtopic"), subSel),
          h("div", { class: "field c-4" }, h("label", { for: "bankStatus" }, t("status")), stSel),
          h("div", { class: "field c-6" }, h("label", { for: "bankText" }, "Quick filter"), txt),
          h("div", { class: "field c-6" }, h("label", {}, t("difficulty")), h("div", { class: "row", style: "gap:8px" }, dChips, updChip)))),
      h("div", { class: "card" }, h("div", { class: "card-head" }, countEl, h("span", { class: "legend" }, h("span", {}, h("i", { style: "background:var(--ok);border-radius:50%" }), t("correct")), h("span", {}, h("i", { style: "background:var(--bad);border-radius:50%" }), t("incorrect")), h("span", {}, h("i", { style: "border-radius:50%" }), t("unseen")))), listEl));
    function describeFilter() {
      const bits = [];
      if (S.set) bits.push(content.setTitle(S.set)); if (S.d) bits.push(t(DIFF[S.d])); if (S.status) bits.push(S.status); if (S.upd) bits.push("updated 2025–2026");
      return bits.length ? bits.join(" · ") : "Mixed questions";
    }
  };
  function smartQueue() {
    const now = Date.now();
    const items = Object.entries(store.progress).map(([id, p]) => ({ id: Number(id), p })).filter(({ id, p }) => HS.inTrack(id) && p[5] <= now && (p[3] === 0 || p[7] === 1 || p[4] < 5));
    items.sort((a, b) => (a.p[3] - b.p[3]) || (a.p[7] - b.p[7]) || (a.p[5] - b.p[5]));
    return relatedConflictFree(items.map((x) => x.id));
  }
  HS.smartQueue = smartQueue;
  function timedDialog(pool, label) {
    if (!pool.length) { HS.toast("No questions match the current filters."); return; }
    const n = h("input", { class: "input", id: "tdN", type: "number", min: "5", max: String(pool.length), value: String(Math.min(20, pool.length)) });
    const mins = h("input", { class: "input", id: "tdM", type: "number", min: "1", max: "600", value: String(Math.round(Math.min(20, pool.length) * store.settings.minPerQ)) });
    n.oninput = () => { mins.value = String(Math.round(Number(n.value || 0) * store.settings.minPerQ)); };
    const timer = h("input", { type: "checkbox", id: "tdT", checked: store.settings.timer });
    HS.confirm({ title: "Timed practice block", ok: t("start"),
      body: h("div", { class: "stack" }, h("p", { class: "muted", style: "margin:0" }, `From: ${label} (${pool.length} available). Feedback is shown at the end.`),
        h("div", { class: "row" }, h("div", { class: "field", style: "flex:1" }, h("label", { for: "tdN" }, "Number of questions"), n), h("div", { class: "field", style: "flex:1" }, h("label", { for: "tdM" }, "Time limit (minutes)"), mins)),
        h("label", { class: "row", style: "gap:8px" }, timer, "Show a countdown timer")) }).then((ok) => {
      if (!ok) return;
      const count = Math.max(1, Math.min(pool.length, Number(n.value) || 20));
      const qids = relatedConflictFree(shuffle(pool)).slice(0, count);
      startSession({ mode: "timed", title: `Timed block: ${label}`, qids, limitSec: timer.checked ? Math.max(60, Number(mins.value) * 60) : 0 });
    });
  }

  /* ------------------------------------------------------------------ single question (from search / bank) */
  HS.views.single = async function ({ id, list }) {
    const s = newSession({ mode: "single", title: `Question ${id}`, qids: list && list.length ? list : [id] });
    s.idx = Math.max(0, s.qids.indexOf(id));
    transient.set(s.id, s);
    return HS.views.run({ sid: s.id });
  };

  /* ------------------------------------------------------------------ session runner: tutor, timed, review, exam */
  HS.views.run = async function ({ sid }) {
    const s = store.sessions.get(sid) || transient.get(sid);
    if (!s) return h("div", {}, pageHead("Session not found"), empty("This session no longer exists", "It may have been reset.", h("button", { class: "btn", type: "button", onclick: () => HS.go("dashboard") }, t("dashboard"))));
    if (s.status === "done") { HS.go("results", { sid }); return h("div"); }
    const qs = new Map((await content.qs(s.qids)).map((q) => [q.id, q]));
    const instant = s.mode === "tutor" || s.mode === "review" || s.mode === "single";
    const persisted = s.mode !== "single";
    const marked = new Set(s.marked || []);
    let selected = null, conf = null, shownAt = performance.now(), timerId = null, lastTick = performance.now(), finished = false;
    const root = h("div", { class: "qscreen" });
    const left = h("div", { style: "min-width:0" }), side = h("aside", { class: "card", "aria-label": "Question navigator", style: "position:sticky;top:calc(var(--header) + 16px)" });
    root.append(left, side);

    const timerEl = h("span", { class: "timer tnum", role: "timer", "aria-label": "Time remaining" });
    function tick() {
      const nowT = performance.now(); const dt = (nowT - lastTick) / 1000; lastTick = nowT;
      if (document.hidden) return;
      s.remainSec = Math.max(0, s.remainSec - dt);
      timerEl.textContent = fmtDur(s.remainSec);
      timerEl.classList.toggle("low", s.remainSec < 300);
      if (s.remainSec <= 0 && !finished) { HS.toast("Time is up. Your answers have been submitted."); submitAll(true); }
    }
    const showTimer = s.limitSec > 0 && (store.settings.timer || s.mode === "exam");
    if (s.limitSec > 0) { timerId = setInterval(tick, 1000); timerEl.textContent = fmtDur(s.remainSec); }
    function accrue() { const q = s.qids[s.idx]; const el = (performance.now() - shownAt) / 1000; s.secs[q] = Math.round((s.secs[q] || 0) + el); shownAt = performance.now(); }
    function persist() { s.marked = [...marked]; if (persisted) store.saveSession(s); }
    const onVis = () => { if (document.hidden) { accrue(); persist(); } else { lastTick = performance.now(); } };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onVis);

    function letterMap(qid) { const p = s.perm[qid]; return p ? p.split("") : LET; } // display index -> original letter
    function draw() {
      const qid = s.qids[s.idx], q = qs.get(qid), ans = s.answers[qid];
      const map = letterMap(qid);
      selected = ans ? ans.o : null; conf = ans ? ans.conf : null;
      const answered = !!ans && (instant ? ans.ok != null : true);
      const reveal = instant && ans && ans.ok != null;
      const nAns = Object.keys(s.answers).length;
      left.replaceChildren(...[
        h("div", { class: "crumbs" }, h("a", { href: "#dashboard", onclick: (e) => { e.preventDefault(); leave(); } }, t("dashboard")), h("span", {}, "›"), h("span", {}, modeLabel(s.mode))),
        h("div", { class: "qtop" },
          h("h1", { style: "font-size:1.2em" }, s.mode === "single" ? `Question ${qid}` : `Question ${s.idx + 1} of ${s.qids.length}`),
          h("span", { class: "pill neutral" }, `Q${qid}`), diffPill(q.difficulty), q.reviewStatus === "updated-guideline" ? h("span", { class: "pill upd", title: "This question was updated to 2025–2026 guidance" }, t("updated")) : null,
          h("span", { class: "spacer" }), showTimer ? timerEl : null),
        h("div", { class: "progress", style: "margin-bottom:8px", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(s.qids.length), "aria-valuenow": String(nAns), "aria-label": "Answered" }, h("i", { style: `width:${(nAns / s.qids.length) * 100}%` })),
        h("div", { class: "small faint" }, `${q.setTitle} · ${q.topic}${q.subtopic ? " — " + q.subtopic : ""}`),
        ltr(h("p", { class: "stem", id: "stem" }, q.stem)),
        ltr(h("div", { class: "opts", role: "radiogroup", "aria-labelledby": "stem" }, map.map((orig, i) => {
          const isSel = selected === orig, isKey = q.correctAnswer === orig;
          const cls = "opt" + (reveal && isKey ? " correct" : "") + (reveal && isSel && !isKey ? " wrong" : "");
          return h("button", { class: cls, type: "button", role: "radio", "aria-checked": String(isSel), disabled: reveal, "data-o": orig, onclick: () => choose(orig) },
            h("span", { class: "L", "aria-hidden": "true" }, LET[i]), h("span", {}, q.options[orig]),
            reveal && isKey ? h("span", { class: "tag", style: "color:var(--ok)" }, t("correct")) : reveal && isSel ? h("span", { class: "tag", style: "color:var(--bad)" }, "Your answer") : h("span"));
        }))),
        instant && !reveal ? h("div", { class: "row", style: "margin-top:16px" }, h("span", { class: "small muted" }, "Confidence (optional):"),
          h("div", { class: "seg", role: "group", "aria-label": "Confidence" }, [["low", "Guess"], ["med", "Unsure"], ["high", "Sure"]].map(([v, l]) => h("button", { type: "button", "aria-pressed": String(conf === v), onclick: (e) => { conf = v; e.currentTarget.parentNode.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false")); e.currentTarget.setAttribute("aria-pressed", "true"); } }, l)))) : null,
        h("div", { class: "row", style: "margin-top:20px" },
          h("button", { class: "btn", type: "button", disabled: s.idx === 0, onclick: () => move(-1) }, "← " + t("prev")),
          instant && !reveal ? h("button", { class: "btn primary", type: "button", id: "submitBtn", onclick: submitOne }, t("submit")) : null,
          !instant ? h("button", { class: "btn", type: "button", "aria-pressed": String(marked.has(qid)), onclick: () => { marked.has(qid) ? marked.delete(qid) : marked.add(qid); persist(); draw(); } }, marked.has(qid) ? "Marked for review ✓" : t("mark")) : null,
          h("button", { class: "btn" + (reveal || !instant ? " primary" : ""), type: "button", onclick: () => (s.idx < s.qids.length - 1 ? move(1) : instant ? leave() : confirmSubmit()) }, s.idx < s.qids.length - 1 ? t("next") + " →" : instant ? t("finish") : "Review and submit"),
          h("span", { class: "spacer" }),
          h("button", { class: "btn ghost sm", type: "button", "aria-pressed": String(store.bookmarks.has(qid)), onclick: () => { const on = store.toggleBookmark(qid); HS.toast(on ? "Bookmarked" : "Bookmark removed"); draw(); } }, store.bookmarks.has(qid) ? "★ Bookmarked" : "☆ " + t("bookmark")),
          instant || s.mode === "single" ? h("button", { class: "btn ghost sm", type: "button", onclick: () => flagDialog(qid) }, store.flags[qid] ? "⚑ Flagged" : "⚑ Report a problem") : null),
        reveal ? feedback(q, ans) : null,
        h("div", { class: "kbd-help" }, h("span", {}, h("kbd", {}, "A–E"), " or ", h("kbd", {}, "1–5"), " select"), h("span", {}, h("kbd", {}, "Enter"), instant ? " submit / next" : " next"), h("span", {}, h("kbd", {}, "N"), " / ", h("kbd", {}, "P"), " next / previous"), h("span", {}, h("kbd", {}, "F"), instant ? " report a problem" : " mark for review"))].filter(Boolean));
      drawSide();
    }
    function drawSide() {
      const qid = s.qids[s.idx];
      const nAns = Object.values(s.answers).filter((a) => a.o).length;
      side.replaceChildren(
        h("div", { class: "card-head" }, h("h2", {}, s.title.length > 40 ? modeLabel(s.mode) : s.title), h("span", { class: "small faint tnum" }, `${nAns}/${s.qids.length}`)),
        h("div", { class: "nav-grid" }, s.qids.map((id, i) => {
          const a = s.answers[id]; let cls = "";
          if (instant && a && a.ok != null) cls = a.ok ? "r-ok" : "r-bad"; else if (a && a.o) cls = "ans";
          if (marked.has(id)) cls += " mark"; if (id === qid) cls += " cur";
          return h("button", { type: "button", class: cls, "aria-label": `Question ${i + 1}${a && a.o ? ", answered" : ", unanswered"}${marked.has(id) ? ", marked" : ""}`, onclick: () => { accrue(); s.idx = i; persist(); draw(); } }, i + 1);
        })),
        h("div", { class: "legend", style: "margin-top:12px" }, instant
          ? [h("span", {}, h("i", { style: "background:var(--ok-soft);border-color:var(--ok)" }), t("correct")), h("span", {}, h("i", { style: "background:var(--bad-soft);border-color:var(--bad)" }), t("incorrect")), h("span", {}, h("i", {}), t("unanswered"))]
          : [h("span", {}, h("i", { style: "background:var(--primary-soft);border-color:var(--primary)" }), "Answered"), h("span", {}, h("i", {}), t("unanswered")), h("span", {}, h("i", { style: "background:var(--warn);border-radius:50%" }), "Marked")]),
        h("div", { class: "stack", style: "margin-top:16px;gap:8px" },
          !instant ? h("button", { class: "btn primary", type: "button", onclick: confirmSubmit }, "Submit " + (s.mode === "exam" ? "exam" : "block")) : null,
          persisted ? h("button", { class: "btn", type: "button", onclick: () => { leave(); HS.toast("Saved. Resume from the dashboard."); } }, t("pause")) : h("button", { class: "btn", type: "button", onclick: () => history.length > 1 ? HS.go("bank") : HS.go("dashboard") }, "Back to the bank")));
    }
    function feedback(q, ans) {
      const ok = ans.ok;
      const noteBox = h("textarea", { class: "input", id: "noteBox", rows: "3", placeholder: "Add a personal note for this question (saved to your account)", "aria-label": t("notes") }, store.notes[q.id] || "");
      noteBox.addEventListener("input", HS.debounce(() => store.setNote(q.id, noteBox.value), 800));
      const refIds = q.referenceIds;
      return h("section", { class: "explain " + (ok ? "ok" : "bad"), "aria-live": "polite" },
        h("h3", { style: `color:var(--${ok ? "ok" : "bad"})` }, ok ? "Correct" : `Incorrect — the answer is ${displayLetter(q.id, q.correctAnswer)}`),
        q.updateNote ? h("div", { class: "upd-box" }, h("strong", {}, "Updated 2025–2026: "), q.updateNote, q.updateSource ? h("div", { class: "small", style: "margin-top:4px" }, "Source: " + q.updateSource) : null) : null,
        ltr(h("p", {}, q.explanation)),
        ltr(h("div", { class: "ref-line" }, h("strong", {}, t("reference") + ": "), q.referenceText || "", refIds.length ? h("div", { class: "row", style: "gap:6px;margin-top:6px" }, refIds.map((r) => h("button", { class: "chip", type: "button", onclick: () => HS.go("references", { q: String(r), focus: r }) }, `[${r}]`))) : null)),
        q.related.length ? h("div", { class: "ref-line" }, h("strong", {}, "Related concept: "), "this idea is also tested in ", q.related.map((r) => qChip(r)), h("span", { class: "small faint" }, " (kept out of the same block so neither gives the other away)")) : null,
        q.trials.length ? h("div", { class: "ref-line" }, h("strong", {}, "Trials: "), q.trials.map((tr) => h("button", { class: "chip", type: "button", onclick: () => HS.go("trials", { q: tr.name }) }, tr.name))) : null,
        h("div", { class: "field", style: "margin-top:12px" }, h("label", { for: "noteBox" }, t("notes")), noteBox));
    }
    function displayLetter(qid, orig) { return LET[letterMap(qid).indexOf(orig)]; }
    function choose(orig) {
      const qid = s.qids[s.idx]; const a = s.answers[qid];
      if (instant) { if (a && a.ok != null) return; selected = orig; left.querySelectorAll(".opt").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.o === orig))); return; }
      s.answers[qid] = { o: orig }; selected = orig; persist(); draw();
    }
    function submitOne() {
      const qid = s.qids[s.idx]; const q = qs.get(qid);
      if (!selected) { HS.toast("Select an answer first (A–E)."); return; }
      accrue();
      const ok = selected === q.correctAnswer;
      s.answers[qid] = { o: selected, ok, sec: s.secs[qid] || 0, conf };
      store.saveAttempt({ qid, opt: selected, ok, sec: s.secs[qid] || 0, mode: s.mode[0], conf });
      if (s.qids.every((id) => s.answers[id] && s.answers[id].ok != null) && persisted) { s.status = "done"; s.finishedAt = Date.now(); s.score = scoreOf(s, qs); }
      persist(); draw();
    }
    function move(d) { accrue(); s.idx = Math.max(0, Math.min(s.qids.length - 1, s.idx + d)); persist(); draw(); window.scrollTo(0, 0); }
    function confirmSubmit() {
      const un = s.qids.map((id, i) => [id, i + 1]).filter(([id]) => !(s.answers[id] && s.answers[id].o));
      const mk = s.qids.map((id, i) => [id, i + 1]).filter(([id]) => marked.has(id));
      HS.confirm({ title: `Submit ${s.mode === "exam" ? "exam" : "block"}?`, ok: "Submit now", cancel: "Keep working",
        body: h("div", { class: "stack" },
          h("p", { style: "margin:0" }, `${s.qids.length - un.length} of ${s.qids.length} answered.` + (s.limitSec ? ` Time left: ${fmtDur(s.remainSec)}.` : "")),
          un.length ? h("div", {}, h("div", { class: "small muted" }, `Unanswered (${un.length}) — these will be scored as incorrect:`), h("div", { class: "chips", style: "margin-top:6px" }, un.slice(0, 60).map(([, n]) => h("span", { class: "pill bad" }, n)), un.length > 60 ? h("span", { class: "small" }, `+${un.length - 60} more`) : null)) : h("p", { class: "small", style: "margin:0;color:var(--ok)" }, "Every question has an answer."),
          mk.length ? h("div", {}, h("div", { class: "small muted" }, `Marked for review (${mk.length}):`), h("div", { class: "chips", style: "margin-top:6px" }, mk.map(([, n]) => h("span", { class: "pill warn" }, n)))) : null) })
        .then((ok) => { if (ok) submitAll(false); });
    }
    function submitAll(auto) {
      if (finished) return; finished = true;
      accrue();
      for (const id of s.qids) {
        const a = s.answers[id]; if (!a || !a.o) continue;
        const ok = a.o === qs.get(id).correctAnswer; a.ok = ok; a.sec = s.secs[id] || 0;
        store.saveAttempt({ qid: id, opt: a.o, ok, sec: a.sec, mode: s.mode === "exam" ? "x" : "m" });
      }
      s.status = "done"; s.finishedAt = Date.now(); s.autoSubmitted = !!auto; s.score = scoreOf(s, qs); s.passMark = store.settings.passMark;
      persist(); cleanup(); HS.onLeave(null); HS.go("results", { sid: s.id });
    }
    function leave() { accrue(); persist(); cleanup(); HS.onLeave(null); HS.go("dashboard"); }
    function cleanup() { clearInterval(timerId); document.removeEventListener("keydown", onKey); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", onVis); }
    function onKey(e) {
      if (e.target.closest && e.target.closest("input, textarea, select, dialog") || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector("dialog[open]")) return;
      const k = e.key.toUpperCase(); const qid = s.qids[s.idx];
      const map = letterMap(qid);
      let i = LET.indexOf(k); if (i < 0 && /^[1-5]$/.test(k)) i = Number(k) - 1;
      if (i >= 0) { choose(map[i]); e.preventDefault(); return; }
      if (k === "ENTER") { const a = s.answers[qid]; if (instant && !(a && a.ok != null)) submitOne(); else if (s.idx < s.qids.length - 1) move(1); else if (!instant) confirmSubmit(); e.preventDefault(); }
      else if (k === "N") move(1); else if (k === "P") move(-1);
      else if (k === "F") { if (instant) flagDialog(qid); else { marked.has(qid) ? marked.delete(qid) : marked.add(qid); persist(); draw(); } }
    }
    document.addEventListener("keydown", onKey);
    HS.onLeave(() => { accrue(); persist(); cleanup(); });
    draw();
    return root;
  };
  function scoreOf(s, qs) { const c = s.qids.filter((id) => s.answers[id] && s.answers[id].o === qs.get(id).correctAnswer).length; return Math.round((c / s.qids.length) * 100); }
  function flagDialog(qid) {
    const cur = store.flags[qid];
    const reason = h("select", { class: "input", id: "flagReason" }, ["Answer key may be wrong", "Explanation unclear or outdated", "Two options could be correct", "Typo or formatting problem", "Other"].map((r) => h("option", { value: r, selected: cur && cur.reason.startsWith(r) }, r)));
    const detail = h("textarea", { class: "input", id: "flagDetail", rows: "3", placeholder: "Optional detail for the reviewer" }, cur && cur.reason.includes(": ") ? cur.reason.split(": ").slice(1).join(": ") : "");
    HS.confirm({ title: `Report a problem with Q${qid}`, ok: cur ? "Update report" : "Send report",
      body: h("div", { class: "stack" }, h("p", { class: "muted small", style: "margin:0" }, "Reports go to the content reviewer (Dr. Hasnaa Shokr). Your notes are never shared."),
        h("div", { class: "field" }, h("label", { for: "flagReason" }, "What is wrong?"), reason), h("div", { class: "field" }, h("label", { for: "flagDetail" }, "Detail"), detail),
        cur ? h("button", { class: "btn sm danger", type: "button", onclick: () => { store.setFlag(qid, null); HS.$("#dlg").close(); HS.toast("Report withdrawn"); } }, "Withdraw my report") : null) })
      .then((ok) => { if (ok) { store.setFlag(qid, reason.value + (detail.value.trim() ? ": " + detail.value.trim() : "")); HS.toast("Report sent. Thank you."); } });
  }

  /* ------------------------------------------------------------------ exam setup */
  HS.views.exam = async function () {
    await content.loadMeta();
    const st = store.settings;
    let len = st.examLen;
    const lenSeg = h("div", { class: "seg", role: "group", "aria-label": "Exam length" }, [50, 100, 200].map((n) => h("button", { type: "button", "aria-pressed": String(len === n), onclick: (e) => { len = n; lenSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false")); e.currentTarget.setAttribute("aria-pressed", "true"); custom.value = ""; upd(); } }, `${n} questions`)));
    const custom = h("input", { class: "input", id: "exCustom", type: "number", min: "20", max: "1000", placeholder: "Custom (20–1000)", style: "max-width:200px", oninput: () => { if (custom.value) { len = Math.max(20, Math.min(1000, Number(custom.value))); lenSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false")); } upd(); } });
    const mpq = h("input", { class: "input", id: "exMpq", type: "number", step: "0.1", min: "0.5", max: "3", value: String(st.minPerQ), style: "max-width:140px", oninput: upd });
    const pass = h("input", { class: "input", id: "exPass", type: "number", min: "1", max: "100", value: String(st.passMark), style: "max-width:140px" });
    const unseenFirst = h("input", { type: "checkbox", id: "exUnseen" });
    const summary = h("p", { class: "muted" });
    const trackN = HS.trackIds().length;
    function upd() { const n = Math.min(len, trackN); summary.textContent = `${HS.trackLabel()} · ${n} questions · ${fmtDur(n * Number(mpq.value || 1.2) * 60)} total · spread across the domains in proportion to the ${trackN} questions in this track.`; }
    upd();
    function begin() {
      // blueprint: questions from the active study track, spread across domains in proportion to what each domain has
      const pools = range(1, 20).map((d) => range((d - 1) * 50 + 1, d * 50).filter((i) => HS.inTrack(i)));
      const available = pools.reduce((a, p) => a + p.length, 0);
      len = Math.min(len, available);
      const quota = pools.map((p) => Math.floor((len * p.length) / available));
      let extra = len - quota.reduce((a, b) => a + b, 0);
      for (const d of shuffle(range(0, 19))) { if (extra <= 0) break; if (quota[d] < pools[d].length) { quota[d]++; extra--; } }
      const pick = [];
      pools.forEach((p, d) => {
        const pool = unseenFirst.checked ? shuffle(p.filter((i) => !store.progress[i])).concat(shuffle(p.filter((i) => store.progress[i]))) : shuffle(p);
        pick.push(...pool.slice(0, quota[d]));
      });
      let qids = relatedConflictFree(shuffle(pick));
      if (qids.length < len) { const have = new Set(qids); for (const i of shuffle(pools.flat())) { if (qids.length >= len) break; if (!have.has(i)) { qids = relatedConflictFree(qids.concat(i)); have.add(i); } } }
      store.saveSettings({ examLen: [50, 100, 200].includes(len) ? len : st.examLen, minPerQ: Number(mpq.value) || 1.2, passMark: Math.max(1, Math.min(100, Number(pass.value) || 60)) });
      startSession({ mode: "exam", title: `${HS.trackLabel()} · ${Math.min(qids.length, len)} questions`, qids: qids.slice(0, len), limitSec: Math.round(len * (Number(mpq.value) || 1.2) * 60) });
    }
    const act = activeSessions().filter((s) => s.mode === "exam" || s.mode === "timed");
    const past = doneExams().filter((s) => s.mode === "exam");
    return h("div", {},
      pageHead(t("exam"), "A full mock paper: blueprint-weighted across all 20 domains, timed, with no feedback until you submit.", [homeCrumb(), { label: t("exam") }]),
      h("div", { class: "grid" },
        h("section", { class: "card c-7 raised" }, h("h2", { style: "margin-bottom:16px" }, "New exam"),
          h("div", { class: "stack" },
            h("div", { class: "field" }, h("label", {}, "Length"), h("div", { class: "row" }, lenSeg, custom)),
            h("div", { class: "row" }, h("div", { class: "field" }, h("label", { for: "exMpq" }, "Minutes per question"), mpq), h("div", { class: "field" }, h("label", { for: "exPass" }, "Pass mark (%)"), pass)),
            h("label", { class: "row small", style: "gap:8px" }, unseenFirst, "Prefer questions I have not seen"),
            summary,
            h("ul", { class: "small muted", style: "margin:0;padding-inline-start:18px" },
              h("li", {}, "Navigator grid shows answered, unanswered and marked questions; press F to mark."),
              h("li", {}, "The exam auto-submits when the countdown reaches zero."),
              h("li", {}, "Pause at any time; the exam resumes exactly where you stopped, with the time remaining.")),
            h("div", {}, h("button", { class: "btn primary", type: "button", onclick: begin }, "Start exam")))),
        h("section", { class: "card c-5" }, h("h2", { style: "margin-bottom:12px" }, "In progress"),
          act.length ? h("div", { class: "stack", style: "gap:8px" }, act.map((s) => h("div", { class: "row", style: "justify-content:space-between;border:1px solid var(--line);border-radius:8px;padding:10px" },
            h("div", {}, h("div", { style: "font-weight:500" }, s.title), h("div", { class: "small faint" }, `${Object.keys(s.answers).length}/${s.qids.length} answered${s.limitSec ? " · " + fmtDur(s.remainSec) + " left" : ""}`)),
            h("div", { class: "row", style: "gap:6px" }, h("button", { class: "btn sm primary", type: "button", onclick: () => HS.go("run", { sid: s.id }) }, t("resume")),
              h("button", { class: "btn sm ghost", type: "button", onclick: async () => { if (await HS.confirm({ title: "Discard this session?", body: "Answers in it will be lost.", ok: "Discard", danger: true })) { store.deleteSession(s.id); HS.render(); } } }, "Discard")))))
            : empty("Nothing in progress", "Paused exams and timed blocks appear here."),
          h("h2", { style: "margin:20px 0 12px" }, "Past exams"),
          past.length ? h("div", { class: "stack", style: "gap:6px" }, past.slice(0, 8).map((s) => h("button", { class: "tile", type: "button", style: "flex-direction:row;align-items:center;padding:10px 12px", onclick: () => HS.go("results", { sid: s.id }) },
            h("div", { style: "flex:1" }, h("div", {}, fmtDate(s.finishedAt)), h("div", { class: "small faint" }, `${s.qids.length} questions`)), h("span", { class: "pill " + (s.score >= (s.passMark || 60) ? "ok" : "bad") }, `${s.score}%`))))
            : empty("No completed exams", ""))));
  };

  /* ------------------------------------------------------------------ results */
  HS.views.results = async function ({ sid }) {
    const s = store.sessions.get(sid);
    if (!s) return h("div", {}, pageHead("Results not found"), empty("This result no longer exists", ""));
    await content.loadMeta();
    const qs = new Map((await content.qs(s.qids)).map((q) => [q.id, q]));
    const n = s.qids.length;
    const correct = s.qids.filter((id) => s.answers[id] && s.answers[id].o === qs.get(id).correctAnswer);
    const unanswered = s.qids.filter((id) => !(s.answers[id] && s.answers[id].o));
    const score = Math.round((correct.length / n) * 100);
    const passMark = s.passMark || store.settings.passMark;
    const pass = score >= passMark;
    const totalSec = s.qids.reduce((a, id) => a + (s.secs[id] || 0), 0);
    const answeredIds = s.qids.filter((id) => s.answers[id] && s.answers[id].o);
    const bySec = answeredIds.slice().sort((a, b) => (s.secs[a] || 0) - (s.secs[b] || 0));
    const wrongIds = answeredIds.filter((id) => !correct.includes(id));
    const avg = (arr) => (arr.length ? arr.reduce((a, id) => a + (s.secs[id] || 0), 0) / arr.length : 0);
    // per-domain
    const dom = {}; for (const id of s.qids) { const d = content.setOf(id); dom[d] = dom[d] || [0, 0]; dom[d][0]++; if (correct.includes(id)) dom[d][1]++; }
    const domKeys = Object.keys(dom).map(Number).sort((a, b) => a - b);
    const chartCanvas = h("canvas", { "aria-label": "Score by domain", role: "img" });
    const prev = doneExams().filter((x) => x.mode === s.mode).sort((a, b) => a.finishedAt - b.finishedAt);
    const trendCanvas = h("canvas", { "aria-label": "Scores of previous attempts", role: "img" });
    let filter = "all";
    const reviewList = h("div", { class: "stack", style: "gap:8px" });
    function drawReview() {
      reviewList.replaceChildren();
      const ids = s.qids.filter((id) => filter === "all" || (filter === "incorrect" && !correct.includes(id) && s.answers[id] && s.answers[id].o) || (filter === "unanswered" && unanswered.includes(id)) || (filter === "marked" && (s.marked || []).includes(id)));
      if (!ids.length) { reviewList.append(empty("Nothing here", "")); return; }
      ids.forEach((id) => {
        const q = qs.get(id), a = s.answers[id], ok = correct.includes(id);
        const det = h("details", { class: "card", style: "padding:0" },
          h("summary", { style: "padding:12px 14px;cursor:pointer;display:flex;gap:10px;align-items:center;flex-wrap:wrap" },
            h("span", { class: "pill " + (ok ? "ok" : a && a.o ? "bad" : "neutral") }, ok ? t("correct") : a && a.o ? t("incorrect") : t("unanswered")),
            h("span", { class: "tnum faint small" }, `#${s.qids.indexOf(id) + 1} · Q${id} · ${fmtDur(s.secs[id] || 0)}`),
            ltr(h("span", { style: "flex:1;min-width:200px" }, q.stem.length > 140 ? q.stem.slice(0, 140) + "…" : q.stem))),
          ltr(h("div", { style: "padding:0 14px 14px" },
            h("p", {}, q.stem),
            h("div", { class: "opts" }, LET.map((L) => h("div", { class: "opt" + (q.correctAnswer === L ? " correct" : a && a.o === L ? " wrong" : ""), style: "cursor:default" }, h("span", { class: "L" }, L), h("span", {}, q.options[L]), h("span", { class: "tag" }, q.correctAnswer === L ? "Answer" : a && a.o === L ? "Yours" : "")))),
            q.updateNote ? h("div", { class: "upd-box" }, h("strong", {}, "Updated 2025–2026: "), q.updateNote) : null,
            h("div", { class: "explain", style: "margin-top:12px" }, h("p", { style: "margin-top:0" }, q.explanation), h("div", { class: "ref-line" }, t("reference") + ": " + q.referenceText)))));
        reviewList.append(det);
      });
    }
    drawReview();
    const node = h("div", {},
      pageHead(s.mode === "exam" ? "Exam results" : "Block results", `${s.title} · ${fmtDate(s.finishedAt)}${s.autoSubmitted ? " · auto-submitted at time-out" : ""}`, [homeCrumb(), { label: t("exam"), view: "exam" }, { label: "Results" }],
        [h("button", { class: "btn", type: "button", onclick: () => wrongIds.concat(unanswered).length ? startSession({ mode: "tutor", title: "Retry: missed questions", qids: relatedConflictFree(wrongIds.concat(unanswered)) }) : HS.toast("No missed questions.") }, "Retry missed questions"),
         h("button", { class: "btn primary", type: "button", onclick: () => HS.go("exam") }, "New exam")]),
      h("div", { class: "grid" },
        h("section", { class: "card c-4 raised" }, h("div", { class: "eyebrow" }, "Score"), h("div", { class: "row", style: "align-items:baseline;gap:12px" }, h("span", { class: "tnum", style: "font-size:2.6em;font-weight:600" }, score + "%"),
          s.mode === "exam" ? h("span", { class: "pill " + (pass ? "ok" : "bad"), style: "font-size:.9em" }, pass ? "Pass" : "Below pass mark") : null),
          h("div", { class: "small muted" }, `${correct.length} correct · ${wrongIds.length} incorrect · ${unanswered.length} unanswered · pass mark ${passMark}%`)),
        h("section", { class: "card c-8" }, h("div", { class: "card-head" }, h("h2", {}, "Time analysis")),
          h("div", { class: "grid", style: "grid-template-columns:repeat(4,minmax(0,1fr));gap:12px" },
            stat("Total time", fmtDur(totalSec), s.limitSec ? `of ${fmtDur(s.limitSec)}` : ""),
            stat("Average", fmtDur(totalSec / n), "per question"),
            stat("On incorrect", fmtDur(avg(wrongIds)), "average"),
            stat("On correct", fmtDur(avg(correct)), "average")),
          bySec.length ? h("div", { class: "small muted", style: "margin-top:12px" }, "Fastest: ", bySec.slice(0, 3).map((id) => `#${s.qids.indexOf(id) + 1} (${fmtDur(s.secs[id] || 0)})`).join(", "), " · Slowest: ", bySec.slice(-3).reverse().map((id) => `#${s.qids.indexOf(id) + 1} (${fmtDur(s.secs[id] || 0)})`).join(", ")) : null),
        h("section", { class: "card c-8" }, h("div", { class: "card-head" }, h("h2", {}, "Score by domain")), h("div", { class: "chart-box tall" }, chartCanvas)),
        h("section", { class: "card c-4" }, h("div", { class: "card-head" }, h("h2", {}, "Compared with previous attempts")),
          prev.length > 1 ? h("div", { class: "chart-box" }, trendCanvas) : empty("First attempt", "Your next attempt will be compared with this one.")),
        h("section", { class: "c-12" }, h("div", { class: "row", style: "margin-bottom:12px" }, h("h2", {}, "Review"), h("span", { class: "spacer" }),
          h("div", { class: "seg", role: "group", "aria-label": "Review filter" }, [["all", "All"], ["incorrect", t("incorrect")], ["unanswered", t("unanswered")], ["marked", "Marked"]].map(([v, l]) =>
            h("button", { type: "button", "aria-pressed": String(filter === v), onclick: (e) => { filter = v; e.currentTarget.parentNode.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false")); e.currentTarget.setAttribute("aria-pressed", "true"); drawReview(); } }, l)))), reviewList)));
    HS.views.results.after = () => {
      const p = HS.css("--primary"), bad = HS.css("--bad");
      HS.chart(chartCanvas, { type: "bar", data: { labels: domKeys.map((d) => `${d}. ${content.setTitle(d).split(/[,:]/)[0]}`), datasets: [{ label: "% correct", data: domKeys.map((d) => Math.round((dom[d][1] / dom[d][0]) * 100)), backgroundColor: domKeys.map((d) => (dom[d][1] / dom[d][0]) * 100 >= passMark ? p : bad), borderRadius: 4 }] },
        options: { indexAxis: "y", scales: { x: { min: 0, max: 100, ticks: { callback: (v) => v + "%" } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.raw}% (${dom[domKeys[c.dataIndex]][1]}/${dom[domKeys[c.dataIndex]][0]})` } } } } });
      if (prev.length > 1) HS.chart(trendCanvas, { type: "line", data: { labels: prev.map((x) => fmtDate(x.finishedAt)), datasets: [{ label: "Score %", data: prev.map((x) => x.score), borderColor: p, backgroundColor: p, pointRadius: prev.map((x) => (x.id === s.id ? 6 : 3)), tension: 0.25 }] },
        options: { scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: false } } } });
    };
    return node;
  };

  /* ------------------------------------------------------------------ topics */
  HS.views.topics = async function () {
    await content.loadMeta();
    const ds = domainStats();
    return h("div", {},
      pageHead(t("topics"), "Structured revision notes for each of the 20 domains, built from the bank's explanations and the cited guidelines.", [homeCrumb(), { label: t("topics") }]),
      h("div", { class: "tile-grid" }, content.meta.sets.map((s) => {
        const d = ds[s.set];
        return h("button", { class: "tile", type: "button", onclick: () => HS.go("topic", { n: s.set }) },
          h("span", { class: "n" }, `DOMAIN ${s.set} · Q${s.range[0]}–${s.range[1]}`), h("h3", {}, s.title),
          h("div", { class: "progress" }, h("i", { style: `width:${d.seen * 2}%` })),
          h("span", { class: "small faint" }, `${d.seen}/50 attempted · accuracy ${d.att ? fmtPct(d.cor / d.att) : "—"}`));
      })));
  };
  HS.views.topic = async function ({ n }) {
    await content.loadMeta();
    const m = content.meta, setQs = [...(await content.loadSet(n)).values()];
    const lo = (n - 1) * 50 + 1, hi = n * 50, inSet = (i) => i >= lo && i <= hi;
    const title = content.setTitle(n);
    // subtopics with a key concept: the first sentence of the explanation of the first question indexed under it
    const subs = new Map();
    for (const [topic, sub, ids] of m.index) { const own = ids.filter(inSet); if (!own.length) continue; const k = sub ? `${topic} — ${sub}` : topic; subs.set(k, [...new Set((subs.get(k) || []).concat(own))]); }
    const byId = new Map(setQs.map((q) => [q.id, q]));
    const firstSentence = (txt) => (txt.match(/^.*?[.](?=\s+[A-Z]|$)/) || [txt])[0];
    const concepts = [...subs.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, ids]) => ({ k, ids, s: firstSentence(byId.get(ids[0]).explanation) }));
    // guideline thresholds / high-yield statements quoted from explanations
    const rx = /\b(recommend|suggest|target|threshold|first[- ]line|contraindicated|should|indicated|within \d)/i;
    const hy = []; const seen = new Set();
    for (const q of setQs) for (const sen of q.explanation.split(/(?<=\.)\s+(?=[A-Z])/)) {
      if (rx.test(sen) && /\d/.test(sen) && sen.length < 320 && !seen.has(sen)) { seen.add(sen); hy.push({ sen, id: q.id }); }
    }
    const updated = setQs.filter((q) => q.reviewStatus === "updated-guideline");
    const trials = m.trials.filter((tr) => tr.questions.some(inSet));
    const calcs = window.HS_CALCS.list.filter((c) => c.set === n);
    const ds = domainStats()[n];
    const extra = n === 3 ? h("section", { class: "hy" }, h("h3", { style: "margin-bottom:6px" }, "New in Surviving Sepsis Campaign 2026 [248]"),
      h("ul", { style: "margin:0;padding-inline-start:18px" },
        h("li", {}, "De-escalation: recommended once a confirmed microbiological diagnosis and susceptibilities are available (strong, very low certainty); suggested when final cultures identify no pathogen (conditional)."),
        h("li", {}, "Anaerobic coverage: an empiric regimen without anaerobic cover is suggested when anaerobic risk factors are absent, and with anaerobic cover when they are present (conditional, very low)."),
        h("li", {}, "Selective decontamination of the digestive tract: suggested for mechanically ventilated adults in units with low antimicrobial resistance (conditional, moderate)."),
        h("li", {}, "Active fluid removal: suggested after the acute resuscitation phase of septic shock (conditional, very low)."),
        h("li", {}, "MAP: initial 65 mmHg target managed as a range; 60–65 mmHg suggested for adults aged 65 or older. Prolonged beta-lactam infusion is now a strong recommendation; crystalloids alone are preferred over adding albumin."),
        h("li", {}, m.sofaNote))) : n === 1 ? h("section", { class: "hy" }, h("h3", { style: "margin-bottom:6px" }, "ERC–ESICM 2025 post-resuscitation care [249] and ERC 2025 ALS [251]"),
      h("ul", { style: "margin:0;padding-inline-start:18px" },
        h("li", {}, "Prevent fever by targeting ≤37.5 °C for 36–72 hours in patients who remain comatose (previously >37.7 °C for at least 72 hours)."),
        h("li", {}, "Avoid hypotension: MAP above 60–65 mmHg (previously above 65 mmHg); SpO2 94–98%, normocapnia."),
        h("li", {}, "Prognosticate at ≥72 hours in patients not obeying commands (GCS motor score below 6); bilaterally absent N20 SSEP waves are valid from 24 hours; two or more predictors are required."),
        h("li", {}, "Regular narrow-complex tachycardia: adenosine 6 mg, then 12 mg, then consider 18 mg if side effects are tolerated."))) : null;
    return h("div", {},
      pageHead(`${n}. ${title}`, `${ds.seen}/50 questions attempted · accuracy ${ds.att ? fmtPct(ds.cor / ds.att) : "—"}`, [homeCrumb(), { label: t("topics"), view: "topics" }, { label: title }],
        [h("button", { class: "btn", type: "button", onclick: () => HS.go("bank", { ids: range(lo, hi), label: `Domain ${n}: ${title}` }) }, "Browse questions"), h("button", { class: "btn primary", type: "button", onclick: () => practiseDomain(n) }, "Practise now")]),
      h("div", { class: "grid" },
        h("div", { class: "c-8 stack", style: "gap:16px" },
          extra,
          h("section", { class: "card" }, h("div", { class: "card-head" }, h("h2", {}, "Key concepts"), h("span", { class: "small faint" }, "one per subtopic, quoted from the explanations")),
            ltr(h("div", { class: "stack", style: "gap:10px" }, concepts.map((c) => h("div", {}, h("div", { style: "font-weight:600" }, c.k), h("p", { style: "margin:2px 0 4px" }, c.s), h("div", { class: "chips" }, c.ids.map(qChip))))))),
          h("section", { class: "hy" }, h("h3", { style: "margin-bottom:6px" }, "High-yield thresholds and recommendations"), h("p", { class: "small muted", style: "margin:0 0 6px" }, "Statements with numeric thresholds, quoted from the explanations; open the question for the full context and reference."),
            ltr(h("ul", { style: "margin:0;padding-inline-start:18px" }, hy.slice(0, 14).map((x) => h("li", {}, x.sen, " ", qChip(x.id)))))),
          updated.length ? h("section", { class: "card" }, h("div", { class: "card-head" }, h("h2", {}, "Updated 2025–2026 in this domain"), h("span", { class: "pill upd" }, `${updated.length}`)),
            h("div", { class: "stack", style: "gap:8px" }, updated.map((q) => h("div", { class: "row", style: "align-items:flex-start;flex-wrap:nowrap" }, qChip(q.id), h("div", {}, h("div", {}, q.updateNote), h("div", { class: "small faint" }, q.updateSource)))))) : null),
        h("div", { class: "c-4 stack", style: "gap:16px" },
          h("section", { class: "card" }, h("div", { class: "card-head" }, h("h2", {}, "Landmark trials"), h("span", { class: "small faint" }, `${trials.length}`)),
            trials.length ? h("div", { class: "stack", style: "gap:10px" }, trials.map((tr) => h("div", {}, h("button", { class: "btn ghost sm", type: "button", style: "padding:0;height:auto;font-weight:600", onclick: () => HS.go("trials", { q: tr.name }) }, `${tr.name}${tr.year ? " (" + tr.year + ")" : ""}`),
              tr.title ? ltr(h("div", { class: "small muted" }, tr.title)) : null, tr.findings[0] ? ltr(h("div", { class: "small" }, tr.findings[0])) : null))) : empty("No named trials", "")),
          h("section", { class: "card" }, h("div", { class: "card-head" }, h("h2", {}, "Formulas and calculators")),
            calcs.length ? h("div", { class: "stack", style: "gap:8px" }, calcs.map((c) => h("div", {}, h("button", { class: "btn ghost sm", type: "button", style: "padding:0;height:auto;font-weight:600", onclick: () => HS.go("calculators", { id: c.id }) }, c.name), h("div", { class: "formula", style: "margin-top:4px" }, c.formula)))) : empty("No calculators for this domain", "")),
          h("section", { class: "card" }, h("h2", { style: "margin-bottom:8px" }, "Subtopics"), h("div", { class: "chips" }, [...subs.entries()].map(([k, ids]) => h("button", { class: "chip", type: "button", onclick: () => HS.go("bank", { ids, label: k }) }, `${k} (${ids.length})`)))))));
  };

  /* ------------------------------------------------------------------ calculators */
  HS.views.calculators = async function ({ id }) {
    const list = window.HS_CALCS.list;
    let cur = list.find((c) => c.id === id) || list[0];
    const panel = h("section", { class: "card", style: "min-width:0" });
    const nav = h("nav", { class: "calc-list card", "aria-label": "Calculators" });
    function drawNav() { nav.replaceChildren(...list.map((c) => h("button", { type: "button", "aria-current": String(c === cur), onclick: () => { cur = c; drawNav(); drawPanel(); } }, c.name))); }
    function drawPanel() {
      const vals = {};
      const out = h("div", { "aria-live": "polite" });
      const inputs = cur.inputs.map((inp) => {
        vals[inp.id] = inp.type === "select" ? inp.def : Number(inp.def);
        const fid = `c-${cur.id}-${inp.id}`;
        const ctl = inp.type === "select"
          ? h("select", { class: "input", id: fid, onchange: (e) => { vals[inp.id] = e.target.value; calc(); } }, inp.options.map(([v, l]) => h("option", { value: v, selected: v === inp.def }, l)))
          : h("input", { class: "input tnum", id: fid, type: "number", step: "any", value: String(inp.def), inputmode: "decimal", oninput: (e) => { vals[inp.id] = e.target.value === "" ? NaN : Number(e.target.value); calc(); } });
        return h("div", { class: "field" }, h("label", { for: fid }, inp.label, inp.unit ? h("span", { class: "faint" }, ` (${inp.unit})`) : null), ctl);
      });
      function calc() {
        const bad = cur.inputs.some((i) => i.type !== "select" && !/optional/i.test(i.label) && !/measured/i.test(i.label) && !isFinite(vals[i.id]));
        if (bad) { out.replaceChildren(h("p", { class: "muted" }, "Enter every required value to see the result.")); return; }
        const v = {}; for (const i of cur.inputs) v[i.id] = i.type === "select" ? vals[i.id] : (isFinite(vals[i.id]) ? vals[i.id] : 0);
        const r = cur.compute(v);
        out.replaceChildren(h("div", { class: "result" }, r.rows.map(([l, val, u]) => h("div", { class: "card" }, h("div", { class: "small faint" }, l), h("div", { class: "tnum", style: "font-size:1.4em;font-weight:600" }, String(val), u ? h("span", { class: "small faint", style: "font-weight:400" }, " " + u) : null)))),
          h("p", { style: "margin:12px 0 0" }, h("span", { class: "pill " + (r.band === "bad" ? "bad" : r.band === "warn" ? "warn" : "ok") }, r.band === "bad" ? "Abnormal" : r.band === "warn" ? "Check" : "Within range"), " ", r.text));
      }
      calc();
      panel.replaceChildren(h("div", { class: "card-head" }, h("h2", {}, cur.name), h("button", { class: "btn ghost sm", type: "button", onclick: () => HS.go("topic", { n: cur.set }) }, `Domain ${cur.set}`)),
        h("div", { class: "calc-inputs" }, inputs), out,
        h("div", { class: "stack", style: "margin-top:16px;gap:8px" },
          h("div", {}, h("div", { class: "eyebrow" }, "Formula"), h("div", { class: "formula" }, cur.formula)),
          cur.normal ? h("div", {}, h("div", { class: "eyebrow" }, "Normal range / target"), h("div", {}, cur.normal)) : null,
          h("div", {}, h("div", { class: "eyebrow" }, "Worked examples (hand-checked)"), h("ul", { class: "small", style: "margin:4px 0 0;padding-inline-start:18px" }, cur.tests.map((ts) => {
            const r = cur.compute({ ...ts.in }); const got = Object.fromEntries(r.rows.map((x) => [x[0], x[1]]));
            return h("li", {}, `${ts.note}: `, Object.entries(ts.expect).map(([k, w]) => `${k} expected ${w}, calculated ${got[k]}`).join("; "));
          })))));
    }
    drawNav(); drawPanel();
    return h("div", {}, pageHead(t("calculators"), `${list.length} bedside tools built from formulas used in the bank. Each shows its formula, normal range and an interpretation.`, [homeCrumb(), { label: t("calculators") }]),
      h("div", { class: "calc-layout" }, nav, panel));
  };

  /* ------------------------------------------------------------------ trials */
  HS.views.trials = async function ({ q }) {
    await content.loadMeta();
    const trials = content.meta.trials;
    const tbody = h("tbody");
    const count = h("span", { class: "small muted", role: "status" });
    const input = h("input", { class: "input", id: "trialQ", type: "search", placeholder: "Search trial name, population, intervention or finding", value: q || "", style: "max-width:520px" });
    const guide = (tr) => tr.findings.find((f) => /\b(SSC|guideline|recommend|suggest|ERC|KDIGO|ESC|IDSA|BTF|ESPEN|ATS)\b/.test(f));
    function draw() {
      const qq = input.value.trim().toLowerCase();
      const rows = trials.filter((tr) => !qq || [tr.name, tr.title, tr.reference, ...tr.findings].join(" ").toLowerCase().includes(qq));
      count.textContent = `${rows.length} of ${trials.length} trials`;
      tbody.replaceChildren(...rows.map((tr) => h("tr", {},
        h("td", {}, h("strong", {}, tr.name)), h("td", { class: "tnum" }, tr.year || "—"),
        ltr(h("td", { style: "min-width:220px" }, tr.title || h("span", { class: "faint" }, "Not cited separately"))),
        ltr(h("td", { style: "min-width:260px" }, tr.findings.filter((f) => f !== guide(tr))[0] || tr.findings[0] || "—")),
        ltr(h("td", { style: "min-width:200px" }, guide(tr) || h("span", { class: "faint" }, "Not stated in the source explanations"))),
        h("td", {}, h("div", { class: "chips" }, tr.questions.map(qChip))))));
      if (!rows.length) tbody.append(h("tr", {}, h("td", { colspan: "6" }, empty("No trials match", ""))));
    }
    input.oninput = HS.debounce(draw, 100); draw();
    return h("div", {}, pageHead(t("trials"), "Every landmark trial named in the bank. The title gives the population and intervention; findings and guideline context are quoted from the explanations.", [homeCrumb(), { label: t("trials") }]),
      h("div", { class: "row", style: "margin-bottom:12px" }, input, count),
      h("div", { class: "card table-wrap", style: "padding:0" }, h("table", { class: "t" }, h("thead", {}, h("tr", {}, ["Trial", "Year", "Population / intervention (title)", "Main finding", "Guideline impact", "Questions"].map((x) => h("th", { scope: "col" }, x)))), tbody)));
  };

  /* ------------------------------------------------------------------ references */
  HS.views.references = async function ({ q, focus }) {
    await content.loadMeta();
    const m = content.meta;
    const list = h("div", { class: "stack", style: "gap:0" });
    const count = h("span", { class: "small muted", role: "status" });
    const input = h("input", { class: "input", id: "refQ", type: "search", placeholder: "Search author, title, journal, year or number", value: q || "", style: "max-width:520px" });
    function draw() {
      const qq = input.value.trim().toLowerCase();
      const rows = Object.entries(m.references).filter(([id, txt]) => !qq || id === qq || txt.toLowerCase().includes(qq));
      count.textContent = `${rows.length} of ${Object.keys(m.references).length} references`;
      list.replaceChildren(...rows.map(([id, txt]) => h("div", { id: "ref-" + id, style: `padding:12px;border-bottom:1px solid var(--line);${Number(id) === focus ? "background:var(--accent-soft);border-radius:6px" : ""}` },
        ltr(h("div", {}, h("span", { class: "tnum", style: "font-weight:600" }, `[${id}] `), txt.replace(" [Added in 2026 content update]", ""), Number(id) > 247 ? h("span", { class: "pill upd", style: "margin-inline-start:6px" }, "Added 2026") : null)),
        h("div", { class: "row small", style: "gap:6px;margin-top:6px" }, h("span", { class: "faint" }, `Cited by ${m.refCites[id].length}:`), m.refCites[id].slice(0, 40).map(qChip), m.refCites[id].length > 40 ? h("button", { class: "btn sm", type: "button", onclick: () => HS.go("bank", { ids: m.refCites[id], label: `Questions citing [${id}]` }) }, `All ${m.refCites[id].length}`) : null))));
      if (!rows.length) list.append(empty("No references match", ""));
    }
    input.oninput = HS.debounce(draw, 100); draw();
    HS.views.references.after = () => { if (focus) { const el = document.getElementById("ref-" + focus); if (el) el.scrollIntoView({ block: "center" }); } };
    return h("div", {}, pageHead(t("references"), "The consolidated reference list (247 items from the source PDF, plus 4 added for the 2025–2026 updates), with links to every citing question.", [homeCrumb(), { label: t("references") }]),
      h("div", { class: "row", style: "margin-bottom:12px" }, input, count), h("div", { class: "card", style: "padding:4px 8px" }, list));
  };

  /* ------------------------------------------------------------------ progress / analytics */
  HS.views.progress = async function () {
    await content.loadMeta();
    const ds = domainStats();
    const logs = await store.loadLogs(12);
    const prog = store.progress;
    const ids = Object.keys(prog).map(Number);
    const c1 = h("canvas", { role: "img", "aria-label": "Accuracy by domain" }), c2 = h("canvas", { role: "img", "aria-label": "Weekly accuracy over time" }),
      c3 = h("canvas", { role: "img", "aria-label": "Time per question distribution" }), c4 = h("canvas", { role: "img", "aria-label": "Questions answered per day" });
    // mastery: domain x difficulty accuracy of latest answers
    const cell = {}; for (const id of ids) { const l = content.liteById.get(id); const k = `${l.s}${l.d}`; cell[k] = cell[k] || [0, 0]; cell[k][0]++; cell[k][1] += prog[id][3]; }
    const mastery = h("div", { class: "mastery", role: "table", "aria-label": "Mastery by domain and difficulty" },
      h("div", { class: "h", role: "columnheader" }, "Domain"), ["e", "m", "h"].map((d) => h("div", { class: "h cell", role: "columnheader" }, t(DIFF[d]))),
      content.meta.sets.map((s) => [h("div", { class: "small", role: "rowheader" }, `${s.set}. ${s.title.split(/[,:]/)[0]}`),
        ["e", "m", "h"].map((d) => { const v = cell[`${s.set}${d}`]; const a = v ? v[1] / v[0] : null; const lv = a == null ? 0 : a < 0.5 ? 1 : a < 0.65 ? 2 : a < 0.8 ? 3 : 4;
          return h("div", { class: "cell", role: "cell", style: `background:var(--heat-${lv});color:${lv >= 3 ? "var(--surface)" : "var(--fg)"}`, title: v ? `${v[1]}/${v[0]} correct` : "Not attempted" }, a == null ? "—" : Math.round(a * 100) + "%"); })]));
    const wrong = ids.filter((id) => prog[id][3] === 0).sort((a, b) => a - b);
    const bms = [...store.bookmarks].sort((a, b) => a - b);
    const notes = Object.entries(store.notes).sort((a, b) => a[0] - b[0]);
    HS.views.progress.after = () => {
      const p = HS.css("--primary"), acc = HS.css("--accent");
      HS.chart(c1, { type: "bar", data: { labels: content.meta.sets.map((s) => String(s.set)), datasets: [{ label: "Accuracy %", data: ds.slice(1).map((d) => (d.att ? Math.round((d.cor / d.att) * 100) : null)), backgroundColor: p, borderRadius: 4 }] },
        options: { scales: { y: { min: 0, max: 100, ticks: { callback: (v) => v + "%" } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { title: (c) => content.setTitle(Number(c[0].label)), label: (c) => { const d = ds[c.dataIndex + 1]; return d.att ? `${c.raw}% (${d.cor}/${d.att} answers)` : "Not attempted"; } } } } } });
      const wk = {}; for (const it of logs) { const k = HS.isoWeek(new Date(it[4])); wk[k] = wk[k] || [0, 0]; wk[k][0]++; wk[k][1] += it[2]; }
      const wkeys = Object.keys(wk).sort();
      HS.chart(c2, { type: "line", data: { labels: wkeys, datasets: [{ label: "Accuracy %", data: wkeys.map((k) => Math.round((wk[k][1] / wk[k][0]) * 100)), borderColor: p, backgroundColor: p, tension: 0.25, fill: false }] },
        options: { scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (c) => `${wk[wkeys[c.dataIndex]][0]} answers` } } } } });
      const bins = [0, 30, 60, 90, 120, 180, 300]; const counts = new Array(bins.length).fill(0);
      for (const id of ids) { const avg = prog[id][6] / prog[id][0]; let b = bins.findIndex((x, i) => avg >= x && (i === bins.length - 1 || avg < bins[i + 1])); counts[b < 0 ? 0 : b]++; }
      HS.chart(c3, { type: "bar", data: { labels: ["<30 s", "30–60 s", "1–1.5 min", "1.5–2 min", "2–3 min", "3–5 min", ">5 min"], datasets: [{ label: "Questions", data: counts, backgroundColor: acc, borderRadius: 4 }] }, options: { plugins: { legend: { display: false } } } });
      const days = []; for (let i = 29; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); days.push(dayKey(d)); }
      HS.chart(c4, { type: "bar", data: { labels: days.map((d) => d.slice(5)), datasets: [{ label: "Answered", data: days.map((d) => (store.activity[d] ? store.activity[d][0] : 0)), backgroundColor: p, borderRadius: 3 }] }, options: { plugins: { legend: { display: false } } } });
    };
    const noData = !ids.length;
    return h("div", {}, pageHead(t("progress"), "How you are doing across domains, difficulty levels and time.", [homeCrumb(), { label: t("progress") }]),
      noData ? h("div", { class: "banner", style: "margin-bottom:16px" }, "No answers yet. The charts fill in as you practise.") : null,
      h("div", { class: "grid" },
        h("section", { class: "card c-8" }, h("div", { class: "card-head" }, h("h2", {}, "Accuracy by domain")), h("div", { class: "chart-box" }, c1)),
        h("section", { class: "card c-4" }, h("div", { class: "card-head" }, h("h2", {}, "Accuracy over time"), h("span", { class: "small faint" }, "weekly")), h("div", { class: "chart-box" }, logs.length ? c2 : empty("No answers in the last 12 weeks", ""))),
        h("section", { class: "card c-6" }, h("div", { class: "card-head" }, h("h2", {}, "Mastery"), h("span", { class: "small faint" }, "domain × difficulty, latest answers")), h("div", { class: "table-wrap" }, mastery)),
        h("section", { class: "card c-6 stack" }, h("div", {}, h("div", { class: "card-head" }, h("h2", {}, "Time per question")), h("div", { class: "chart-box", style: "height:200px" }, c3)),
          h("div", {}, h("div", { class: "card-head" }, h("h2", {}, "Questions answered per day"), h("span", { class: "small faint" }, "last 30 days")), h("div", { class: "chart-box", style: "height:200px" }, c4))),
        h("section", { class: "card c-4" }, h("div", { class: "card-head" }, h("h2", {}, "Incorrect — retry"), h("span", { class: "pill bad" }, String(wrong.length))),
          wrong.length ? h("div", { class: "stack" }, h("div", { class: "chips" }, wrong.slice(0, 60).map(qChip)), h("button", { class: "btn primary", type: "button", onclick: () => startSession({ mode: "tutor", title: "Retry incorrect questions", qids: relatedConflictFree(wrong) }) }, `Retry ${wrong.length} in tutor mode`)) : empty("Nothing to retry", "")),
        h("section", { class: "card c-4" }, h("div", { class: "card-head" }, h("h2", {}, "Bookmarks"), h("span", { class: "pill neutral" }, String(bms.length))),
          bms.length ? h("div", { class: "stack" }, h("div", { class: "chips" }, bms.map(qChip)), h("button", { class: "btn", type: "button", onclick: () => startSession({ mode: "tutor", title: "Bookmarked questions", qids: relatedConflictFree(bms) }) }, "Practise bookmarks")) : empty("No bookmarks", "Use ☆ Bookmark on any question.")),
        h("section", { class: "card c-4" }, h("div", { class: "card-head" }, h("h2", {}, t("notes")), h("span", { class: "pill neutral" }, String(notes.length))),
          notes.length ? h("div", { class: "stack", style: "gap:8px;max-height:320px;overflow-y:auto" }, notes.map(([id, n]) => h("div", {}, qChip(Number(id)), h("div", { class: "small", style: "white-space:pre-wrap;margin-top:4px" }, n)))) : empty("No notes yet", "Add notes under any explanation."))));
  };
  HS.views.progress.live = true;

  /* ------------------------------------------------------------------ notebook: bookmarks, notes, questions to retry, my reports */
  let notebookTab = "bookmarks";
  HS.views.notebook = async function () {
    await content.loadMeta();
    const AR = HS.lang === "ar";
    const lists = {
      bookmarks: [...store.bookmarks].sort((a, b) => a - b),
      notes: Object.keys(store.notes).map(Number).sort((a, b) => a - b),
      wrong: Object.entries(store.progress).filter(([, p]) => p[3] === 0).map(([id]) => Number(id)).sort((a, b) => a - b),
      reports: Object.keys(store.flags).map(Number).sort((a, b) => a - b),
    };
    const resolutions = lists.reports.length ? await store.flagResolutions() : {};
    const body = h("div");
    async function draw() {
      const ids = lists[notebookTab];
      if (!ids.length) {
        body.replaceChildren(empty(AR ? "لا شيء هنا بعد" : "Nothing here yet",
          notebookTab === "bookmarks" ? (AR ? "استخدم ☆ حفظ على أي سؤال." : "Use ☆ Bookmark on any question.") : notebookTab === "notes" ? (AR ? "اكتب ملاحظة تحت شرح أي سؤال." : "Write a note under any explanation.")
            : notebookTab === "wrong" ? (AR ? "الأسئلة التي أخطأت فيها آخر مرة تظهر هنا." : "Questions you last answered incorrectly appear here.") : (AR ? "بلاغاتك عن الأسئلة تظهر هنا." : "Your reports about questions appear here.")));
        return;
      }
      body.replaceChildren(h("div", { class: "skel", style: "height:80px" }));
      const qs = await content.qs(ids);
      body.replaceChildren(
        notebookTab !== "reports" ? h("div", { class: "row", style: "margin-bottom:12px" }, h("span", { class: "small muted" }, `${ids.length}`), h("span", { class: "spacer" }),
          h("button", { class: "btn primary", type: "button", onclick: () => startSession({ mode: "tutor", title: t(notebookTab === "bookmarks" ? "bookmarksTab" : notebookTab === "notes" ? "notesTab" : "wrongTab"), qids: relatedConflictFree(ids) }) }, t("practise"))) : null,
        h("div", { class: "stack", style: "gap:8px" }, qs.map((q) => {
          const res = resolutions[q.id];
          return h("div", { class: "card", style: "padding:12px 14px" },
            h("div", { class: "row", style: "gap:8px;margin-bottom:6px" }, qChip(q.id), h("span", { class: "small faint" }, `${q.topic}${q.subtopic ? " · " + q.subtopic : ""}`), h("span", { class: "spacer" }), diffPill(q.difficulty)),
            ltr(h("div", { class: "qstem", style: "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden" }, q.stem)),
            notebookTab === "notes" ? h("div", { class: "small", style: "white-space:pre-wrap;margin-top:8px;padding:8px 10px;background:var(--surface-2);border-radius:8px" }, store.notes[q.id]) : null,
            notebookTab === "reports" ? h("div", { class: "small", style: "margin-top:8px" }, h("span", { class: "muted" }, store.flags[q.id].reason), " ",
              res ? h("span", { class: "pill ok" }, res.status === "fixed" ? (AR ? "تم التصحيح" : "Fixed") : (AR ? "روجع: لا تغيير" : "Reviewed: no change")) : h("span", { class: "pill warn" }, AR ? "قيد المراجعة" : "Under review")) : null);
        })));
    }
    const tabs = h("div", { class: "tabs", role: "tablist" }, [["bookmarks", "bookmarksTab"], ["notes", "notesTab"], ["wrong", "wrongTab"], ["reports", "reportsTab"]].map(([k, label]) =>
      h("button", { type: "button", role: "tab", "aria-selected": String(notebookTab === k), onclick: (e) => { notebookTab = k; tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", "false")); e.currentTarget.setAttribute("aria-selected", "true"); draw(); } },
        `${t(label)} (${lists[k].length})`)));
    draw();
    return h("div", {}, pageHead(t("notebook"), AR ? "كل ما حفظته وكتبته وأخطأت فيه، في مكان واحد." : "Everything you saved, wrote and got wrong, in one place.", [homeCrumb(), { label: t("notebook") }]), tabs, body);
  };

  /* ------------------------------------------------------------------ settings */
  HS.views.settings = async function () {
    const s = store.settings;
    const seg = (key, opts, label) => h("div", { class: "field" }, h("label", {}, label), h("div", { class: "seg", role: "group", "aria-label": label }, opts.map(([v, l]) => h("button", { type: "button", "aria-pressed": String(s[key] === v), onclick: () => { key === "lang" ? HS.setLang(v) : store.saveSettings({ [key]: v }); HS.render(); } }, l))));
    const num = (key, label, min, max, step) => h("div", { class: "field" }, h("label", { for: "set-" + key }, label), h("input", { class: "input", id: "set-" + key, type: "number", min, max, step: step || "1", value: String(s[key]), style: "max-width:160px", onchange: (e) => { const v = Math.max(min, Math.min(max, Number(e.target.value) || s[key])); store.saveSettings({ [key]: v }); HS.toast("Saved"); } }));
    const tog = (key, label, help) => h("label", { class: "row", style: "gap:10px;align-items:flex-start" }, h("input", { type: "checkbox", id: "set-" + key, checked: !!s[key], onchange: (e) => { store.saveSettings({ [key]: e.target.checked }); HS.toast("Saved"); } }), h("span", {}, h("span", { style: "font-weight:500" }, label), help ? h("div", { class: "small muted" }, help) : null));
    async function reset() {
      let typed = "";
      const inp = h("input", { class: "input", id: "resetConfirm", placeholder: "Type RESET" });
      const ok = await HS.confirm({ title: "Reset all of your progress?", ok: "Reset permanently", danger: true,
        body: h("div", { class: "stack" }, h("p", { style: "margin:0" }, "This deletes your answers, statistics, bookmarks, notes, flags and exam history on every device. It cannot be undone."), h("div", { class: "field" }, h("label", { for: "resetConfirm" }, "Type RESET to confirm"), inp)),
        okDisabled: (btn) => { btn.disabled = true; inp.oninput = () => { typed = inp.value; btn.disabled = typed.trim() !== "RESET"; }; } });
      if (ok && typed.trim() === "RESET") { await store.resetProgress(); HS.toast("Your progress has been reset."); HS.go("dashboard"); }
    }
    const me = store.me;
    return h("div", {}, pageHead(t("settings"), null, [homeCrumb(), { label: t("settings") }]),
      h("div", { class: "grid" },
        h("section", { class: "card c-6 stack" }, h("h2", {}, "Profile"),
          h("div", { class: "row" }, h("img", { class: "avatar", src: HS.$("#avatar").src, alt: "", style: "width:48px;height:48px" }),
            h("div", {}, h("div", { style: "font-weight:600" }, (me && me.name) || (store.mode === "local" ? "Preview (not signed in)" : "Signed-in user")),
              h("div", { class: "small muted" }, store.mode !== "cloud" ? "Progress is not saved in preview mode." : window.HS_BACKEND ? "Signed in with your name and PIN. Your progress is private to you and syncs across devices." : "Signed in with your claude.ai account. Your progress is private to you and syncs across devices."),
              store.isAdmin ? h("span", { class: "pill neutral", style: "margin-top:4px" }, "Administrator: Content QA and cohort statistics") : null))),
        h("section", { class: "card c-6 stack" }, h("h2", {}, "Appearance"),
          seg("theme", [["system", t("system")], ["light", t("light")], ["dark", t("dark")]], t("theme")),
          seg("fs", [["s", "Small"], ["m", "Medium"], ["l", "Large"]], t("fontSize")),
          seg("lang", [["en", "English"], ["ar", "العربية"]], t("language")),
          seg("track", [["2", t("trackTwo")], ["1", t("trackOne")], ["all", t("trackAll")]], t("track")),
          h("p", { class: "small muted", style: "margin:0" }, t(HS.track() === "1" ? "trackOneNote" : HS.track() === "all" ? "trackAllNote" : "trackTwoNote")),
          h("p", { class: "small muted", style: "margin:0" }, "Arabic changes interface labels and layout direction; medical content stays in English.")),
        h("section", { class: "card c-6 stack" }, h("h2", {}, "Practice and exams"),
          h("div", { class: "row" }, num("examLen", "Default exam length", 20, 1000), num("minPerQ", "Minutes per question", 0.5, 3, "0.1"), num("passMark", "Pass mark (%)", 1, 100)),
          h("div", { class: "row" },
            h("div", { class: "field" }, h("label", { for: "set-examDate" }, HS.lang === "ar" ? "تاريخ الامتحان" : "Exam date"), h("input", { class: "input", id: "set-examDate", type: "date", value: s.examDate || "", style: "max-width:200px", onchange: (e) => { store.saveSettings({ examDate: e.target.value || "" }); HS.toast("Saved"); } })),
            num("dailyNew", HS.lang === "ar" ? "أسئلة جديدة يوميًا (٠ = تلقائي)" : "New questions per day (0 = automatic)", 0, 300)),
          tog("timer", "Show the countdown timer in timed practice", "Exams always show the timer."),
          tog("shuffle", "Shuffle option order", "Options appear in a random order per session; scoring follows the original answer key.")),
        h("section", { class: "card c-6 stack" }, h("h2", { style: "color:var(--bad)" }, "Reset"),
          h("p", { class: "muted", style: "margin:0" }, "Start again from zero. Your questions and the bank are not affected, only your personal data."),
          h("div", {}, h("button", { class: "btn danger", type: "button", onclick: reset, disabled: store.mode === "cloud" && HS.queue.fatal }, t("reset"))))));
  };

  /* ------------------------------------------------------------------ content QA (admin) */
  HS.views.qa = async function () {
    if (!store.isAdmin) return h("div", {}, pageHead(t("qa")), empty("Administrators only", "Content QA is available to editors of this dashboard."));
    await content.loadMeta();
    const qa = content.meta.qa;
    const b = qa.lengthCue.before, a = qa.lengthCue.after;
    const keyCanvas = h("canvas", { role: "img", "aria-label": "Answer key distribution before and after" });
    const cohortCanvas = h("canvas", { role: "img", "aria-label": "Cohort accuracy by domain" });
    const tests = window.HS_CALCS.runSelfTests();
    const testsOk = tests.filter((x) => x.ok).length;
    const v = qa.validation;
    const checks = [
      ["Questions extracted", `${v.questionCount}`, v.questionCount === 1000],
      ["Unique ids", `${v.uniqueIds}`, v.uniqueIds === 1000],
      ["Five options each", v.allHaveFiveOptions ? "Yes" : "No", v.allHaveFiveOptions],
      ["Answer grid matches explanation headers", v.answerKeyMatchesExplanationHeaders ? "Yes" : "No", v.answerKeyMatchesExplanationHeaders],
      ["Broken reference ids", `${v.brokenReferences}`, v.brokenReferences === 0],
      ["References", `${v.referenceCountOriginal} original + ${v.referenceCountAdded} added`, true],
      ["Correct option is the longest", `${b.correctLongestPct}% → ${a.correctLongestPct}%`, a.correctLongestPct <= 30],
      ["Correct option >1.3× longest distractor", `${b.over1_3x} → ${a.over1_3x}`, a.over1_3x === 0],
      ["Longest run of identical keys", `${b.maxKeyRun} → ${a.maxKeyRun}`, a.maxKeyRun <= 3],
      ["Calculator worked examples", `${testsOk}/${tests.length} pass`, testsOk === tests.length],
      ["Validation errors", `${v.errors.length}`, v.errors.length === 0],
    ];
    // changelog viewer
    const cl = await content.loadChangelog();
    const clBody = h("tbody"); const clCount = h("span", { class: "small muted" });
    const clQ = h("input", { class: "input", id: "clQ", type: "search", placeholder: "Question number or text", style: "max-width:260px" });
    const clR = h("select", { class: "input", id: "clR", style: "max-width:280px" }, h("option", { value: "" }, "All reasons"), [...new Set(cl.map((x) => x.reason))].map((r) => h("option", { value: r }, r)));
    let clShown = 100;
    function drawCl() {
      const q = clQ.value.trim().toLowerCase(), r = clR.value;
      const rows = cl.filter((x) => (!r || x.reason === r) && (!q || String(x.questionId) === q || (x.oldText + " " + x.newText).toLowerCase().includes(q)));
      clCount.textContent = `${rows.length} of ${cl.length} changes`;
      clBody.replaceChildren(...rows.slice(0, clShown).map((x) => h("tr", {}, h("td", {}, qChip(x.questionId)), h("td", { class: "small" }, x.field), ltr(h("td", { class: "small", style: "min-width:220px;color:var(--fg-2)" }, x.oldText)), ltr(h("td", { class: "small", style: "min-width:220px" }, x.newText)), h("td", { class: "small" }, x.reason), h("td", { class: "small" }, x.source))));
      if (rows.length > clShown) clBody.append(h("tr", {}, h("td", { colspan: "6" }, h("button", { class: "btn sm", type: "button", onclick: () => { clShown += 200; drawCl(); } }, "Show more"))));
    }
    clQ.oninput = HS.debounce(() => { clShown = 100; drawCl(); }, 150); clR.onchange = () => { clShown = 100; drawCl(); }; drawCl();
    async function download(name, path, type) {
      if (!window.claude) { const a = h("a", { href: path, download: name }); document.body.append(a); a.click(); a.remove(); return; } // standalone site
      const dl = window.claude.use ? await window.claude.use("downloads") : null;
      if (!dl) { HS.toast("Downloads are not available in this view."); return; }
      try { const txt = await (await fetch(path)).text(); await dl.save({ filename: name, data: new Blob([txt], { type }) }); }
      catch (e) { if (e && e.code !== "declined") HS.toast("The download did not complete."); }
    }
    // flags and cohort (cloud only)
    const flagsBox = h("div", {}, h("div", { class: "skel", style: "height:60px" }));
    const learnersBox = window.HS_BACKEND && store.mode === "cloud" ? h("div", {}, h("div", { class: "skel", style: "height:60px" })) : null;
    if (learnersBox) (async () => {
      try {
        const rows = (await window.HS_BACKEND.learners()).sort((x, y) => (y.stats ? y.stats.attempted : 0) - (x.stats ? x.stats.attempted : 0));
        const tb = h("tbody", {}, rows.map((r) => {
          const s = r.stats || {};
          return h("tr", {}, h("td", {}, r.name || "—", r.isAdmin ? h("span", { class: "pill neutral", style: "margin-inline-start:6px" }, "Admin") : null),
            h("td", { class: "tnum" }, String(s.attempted || 0)), h("td", { class: "tnum" }, s.answers ? fmtPct(s.correct / s.answers) : "—"),
            h("td", { class: "tnum" }, (s.exams || []).length ? `${s.exams[s.exams.length - 1].score}%` : "—"),
            h("td", { class: "small" }, s.updatedAt ? fmtDate(s.updatedAt) : "—"),
            h("td", {}, h("button", { class: "btn sm", type: "button", onclick: () => resetPinDlg(r) }, "Reset PIN")));
        }));
        learnersBox.replaceChildren(rows.length ? h("div", { class: "table-wrap" }, h("table", { class: "t" }, h("thead", {}, h("tr", {}, ["Learner", "Attempted", "Accuracy", "Last exam", "Last active", ""].map((x) => h("th", {}, x)))), tb)) : empty("No learners yet", ""));
      } catch (e) { learnersBox.replaceChildren(empty("Learners could not load", "")); }
    })();
    function resetPinDlg(r) {
      const pin = h("input", { class: "input", id: "newPin", type: "text", inputmode: "numeric", maxlength: "8", placeholder: "4–8 digits" });
      HS.confirm({ title: `Reset the PIN for ${r.name}`, ok: "Set new PIN",
        body: h("div", { class: "stack" }, h("p", { class: "muted small", style: "margin:0" }, "Give the new PIN to the learner privately. Their progress is kept."), h("div", { class: "field" }, h("label", { for: "newPin" }, "New PIN"), pin)) })
        .then(async (ok) => {
          if (!ok) return;
          try { await window.HS_BACKEND.resetPin(r.id, r.name, pin.value.trim()); HS.toast("PIN updated"); }
          catch (e) { HS.toast((e && e.message) || "The PIN could not be changed."); }
        });
    }
    const cohortBox = h("div", {}, h("div", { class: "skel", style: "height:60px" }));
    let cohort = [];
    (async () => {
      try {
        const { reports, resolved } = await store.flagQueue();
        const byQ = new Map(); for (const r of reports) byQ.set(r.q, (byQ.get(r.q) || []).concat(r));
        const open = [...byQ.entries()].filter(([q, rs]) => !resolved[q] || resolved[q].ts < Math.max(...rs.map((r) => r.ts)));
        flagsBox.replaceChildren(open.length ? h("div", { class: "stack", style: "gap:8px" }, open.sort((x, y) => y[1].length - x[1].length).map(([q, rs]) => h("div", { class: "row", style: "align-items:flex-start;border:1px solid var(--line);border-radius:8px;padding:10px;flex-wrap:nowrap" },
          qChip(q), h("div", { style: "flex:1;min-width:0" }, h("div", { class: "small", style: "font-weight:600" }, `${rs.length} report${rs.length > 1 ? "s" : ""}`), rs.map((r) => h("div", { class: "small muted" }, `“${r.reason}” · ${fmtDate(r.ts)}`))),
          store.mode === "cloud" ? h("div", { class: "stack", style: "gap:4px" }, h("button", { class: "btn sm", type: "button", onclick: async () => { await store.resolveFlag(q, "fixed", "Content corrected"); HS.toast("Marked as fixed"); HS.render(); } }, "Mark fixed"), h("button", { class: "btn sm ghost", type: "button", onclick: async () => { await store.resolveFlag(q, "no-change", "Reviewed; no change needed"); HS.toast("Resolved: no change"); HS.render(); } }, "No change needed")) : null)))
          : empty("No open reports", Object.keys(resolved).length ? `${Object.keys(resolved).length} resolved.` : "Reports from users appear here."));
      } catch (e) { flagsBox.replaceChildren(empty("Reports could not load", "")); }
      try {
        cohort = await store.cohort();
        if (!cohort.length) { cohortBox.replaceChildren(empty(store.mode === "cloud" ? "No learner data yet" : "Available on the published dashboard", "Each learner's totals appear here once they answer questions. Personal notes are never included.")); return; }
        const n = cohort.length, att = cohort.reduce((s, c) => s + (c.attempted || 0), 0), corr = cohort.reduce((s, c) => s + (c.correct || 0), 0), ans = cohort.reduce((s, c) => s + (c.answers || 0), 0);
        const active7 = cohort.filter((c) => c.updatedAt > Date.now() - 7 * 864e5).length;
        const exams = cohort.flatMap((c) => c.exams || []);
        cohortBox.replaceChildren(h("div", { class: "grid", style: "grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:12px" },
          stat("Learners", String(n), `${active7} active in 7 days`), stat("Mean attempted", String(Math.round(att / n)), "questions each"), stat("Cohort accuracy", fmtPct(ans ? corr / ans : null), "all answers"), stat("Exams taken", String(exams.length), exams.length ? `mean ${Math.round(exams.reduce((s, e) => s + e.score, 0) / exams.length)}%` : "")),
          h("div", { class: "chart-box" }, cohortCanvas));
        const dom = Array.from({ length: 21 }, () => [0, 0]); for (const c of cohort) for (const [d, v] of Object.entries(c.byDomain || {})) { dom[d][0] += v[0]; dom[d][1] += v[1]; }
        HS.chart(cohortCanvas, { type: "bar", data: { labels: content.meta.sets.map((s) => String(s.set)), datasets: [{ label: "Latest-answer accuracy %", data: dom.slice(1).map((v) => (v[0] ? Math.round((v[1] / v[0]) * 100) : null)), backgroundColor: HS.css("--accent"), borderRadius: 4 }] },
          options: { scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { title: (c) => content.setTitle(Number(c[0].label)) } } } } });
      } catch (e) { cohortBox.replaceChildren(empty("Cohort statistics could not load", "")); }
    })();
    HS.views.qa.after = () => {
      HS.chart(keyCanvas, { type: "bar", data: { labels: LET, datasets: [{ label: "Before", data: LET.map((L) => b.keyDistribution[L]), backgroundColor: HS.css("--line") }, { label: "After", data: LET.map((L) => a.keyDistribution[L]), backgroundColor: HS.css("--primary") }] }, options: { plugins: { legend: { position: "bottom" } } } });
    };
    const statusCounts = qa.statusCounts;
    return h("div", {}, pageHead(t("qa"), "Validation results, option-length statistics, the full changelog, flagged questions and cohort statistics.", [homeCrumb(), { label: t("qa") }],
      [h("button", { class: "btn", type: "button", onclick: () => download("changelog.csv", "data/changelog.csv", "text/csv") }, "Download changelog (CSV)")]),
      h("div", { class: "grid" },
        h("section", { class: "card c-6" }, h("div", { class: "card-head" }, h("h2", {}, "Validation")),
          h("table", { class: "t" }, h("tbody", {}, checks.map(([l, val, ok]) => h("tr", {}, h("td", {}, l), h("td", { class: "tnum" }, val), h("td", {}, h("span", { class: "pill " + (ok ? "ok" : "bad") }, ok ? "Pass" : "Fail"))))))),
        h("section", { class: "card c-6 stack" }, h("div", { class: "card-head" }, h("h2", {}, "Option-length cue")),
          h("table", { class: "t" }, h("thead", {}, h("tr", {}, h("th", {}, "Measure"), h("th", {}, "Before"), h("th", {}, "After"))),
            h("tbody", {}, [["Correct option longest", `${b.correctLongest} (${b.correctLongestPct}%)`, `${a.correctLongest} (${a.correctLongestPct}%)`], ["Correct ≥1.2× next longest", b.obviousGe1_2x, a.obviousGe1_2x], ["Correct >1.3× longest distractor", b.over1_3x, a.over1_3x], ["Runs of 4+ identical keys", b.runsOver3, a.runsOver3]].map((r) => h("tr", {}, r.map((x) => h("td", { class: "tnum" }, String(x))))))),
          h("div", { class: "small muted" }, `Review status: ${statusCounts.original || 0} original · ${statusCounts["revised-options"] || 0} revised options · ${statusCounts["updated-guideline"] || 0} updated to 2025–2026 guidance · ${qa.changelogEntries} logged changes.`),
          h("div", { class: "chart-box", style: "height:200px" }, keyCanvas)),
        h("section", { class: "card c-6" }, h("div", { class: "card-head" }, h("h2", {}, "Flagged-question queue")), flagsBox),
        h("section", { class: "card c-6" }, h("div", { class: "card-head" }, h("h2", {}, "Cohort statistics"), h("span", { class: "small faint" }, "aggregate only; no personal notes")), cohortBox),
        learnersBox ? h("section", { class: "card c-12" }, h("div", { class: "card-head" }, h("h2", {}, "Learners"), h("span", { class: "small faint" }, "totals only; notes stay private")), learnersBox) : null,
        h("section", { class: "card c-12" }, h("div", { class: "card-head" }, h("h2", {}, "Calculator self-tests"), h("span", { class: "pill " + (testsOk === tests.length ? "ok" : "bad") }, `${testsOk}/${tests.length}`)),
          h("div", { class: "table-wrap" }, h("table", { class: "t" }, h("thead", {}, h("tr", {}, ["Calculator", "Example", "Expected", "Calculated", ""].map((x) => h("th", {}, x)))),
            h("tbody", {}, tests.map((x) => h("tr", {}, h("td", {}, x.name), h("td", { class: "small" }, x.note), h("td", { class: "tnum small" }, Object.entries(x.expect).map(([k, w]) => `${k}: ${w}`).join("; ")), h("td", { class: "tnum small" }, Object.keys(x.expect).map((k) => `${k}: ${x.got[k]}`).join("; ")), h("td", {}, h("span", { class: "pill " + (x.ok ? "ok" : "bad") }, x.ok ? "Pass" : "Fail")))))))),
        h("section", { class: "card c-12" }, h("div", { class: "card-head" }, h("h2", {}, "Changelog"), clCount),
          h("div", { class: "row", style: "margin-bottom:8px" }, clQ, clR),
          h("div", { class: "table-wrap", style: "max-height:560px;overflow:auto" }, h("table", { class: "t" }, h("thead", {}, h("tr", {}, ["Q", "Field", "Old text", "New text", "Reason", "Source"].map((x) => h("th", {}, x)))), clBody)))));
  };

  HS.boot();
})();
