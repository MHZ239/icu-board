/* Clinical calculators.
 * Each entry: id, name, set (domain number), inputs, compute(v) -> {rows:[[label, value, unit]], band, text},
 * formula, normal, and tests: two hand-checked examples (most taken from questions in the bank).
 * compute() receives numbers for number inputs and the option value for selects.
 */
(function () {
  "use strict";
  const r1 = (x) => Math.round(x * 10) / 10;
  const r2 = (x) => Math.round(x * 100) / 100;
  const r0 = (x) => Math.round(x);
  const fio2 = (f) => (f > 1 ? f / 100 : f);

  const yesno = [["0", "No"], ["1", "Yes"]];

  const CALCS = [
    {
      id: "pf", name: "P/F ratio", set: 5,
      inputs: [{ id: "pao2", label: "PaO2", unit: "mmHg", def: 80 }, { id: "fio2", label: "FiO2", unit: "0.21–1 or %", def: 0.4 }],
      formula: "P/F = PaO2 ÷ FiO2",
      normal: "Above 400 mmHg on room air",
      compute(v) {
        const pf = v.pao2 / fio2(v.fio2);
        let band = "ok", text = "No oxygenation criterion for ARDS.";
        if (pf <= 100) { band = "bad"; text = "≤100: severe range (Berlin, with PEEP ≥5 cmH2O)."; }
        else if (pf <= 200) { band = "warn"; text = "101–200: moderate range (Berlin, with PEEP ≥5 cmH2O)."; }
        else if (pf <= 300) { band = "warn"; text = "201–300: mild range (Berlin, with PEEP ≥5 cmH2O)."; }
        return { rows: [["P/F ratio", r0(pf), "mmHg"]], band, text };
      },
      tests: [{ in: { pao2: 80, fio2: 0.4 }, expect: { "P/F ratio": 200 }, note: "80 ÷ 0.4" },
              { in: { pao2: 90, fio2: 100 }, expect: { "P/F ratio": 90 }, note: "FiO2 entered as %" }],
    },
    {
      id: "aa", name: "A–a gradient", set: 4,
      inputs: [{ id: "fio2", label: "FiO2", unit: "0.21–1 or %", def: 0.21 }, { id: "pao2", label: "PaO2", unit: "mmHg", def: 55 },
               { id: "paco2", label: "PaCO2", unit: "mmHg", def: 40 }, { id: "patm", label: "Barometric pressure", unit: "mmHg", def: 760 },
               { id: "rq", label: "Respiratory quotient", unit: "", def: 0.8 }],
      formula: "PAO2 = FiO2 × (Patm − 47) − PaCO2 ÷ RQ;  A–a = PAO2 − PaO2",
      normal: "Roughly age ÷ 4 + 4 mmHg on room air (5–20 mmHg in young adults)",
      compute(v) {
        const PAO2 = fio2(v.fio2) * (v.patm - 47) - v.paco2 / v.rq;
        const g = PAO2 - v.pao2;
        return { rows: [["Alveolar PO2", r1(PAO2), "mmHg"], ["A–a gradient", r0(g), "mmHg"]],
                 band: g > 20 ? "warn" : "ok",
                 text: g > 20 ? "Raised gradient: V/Q mismatch, shunt or diffusion limitation." : "Normal gradient: hypoxaemia, if present, is explained by hypoventilation or low inspired O2." };
      },
      tests: [{ in: { fio2: 0.21, pao2: 55, paco2: 40, patm: 760, rq: 0.8 }, expect: { "A–a gradient": 45 }, note: "Q168" },
              { in: { fio2: 0.21, pao2: 55, paco2: 76, patm: 760, rq: 0.8 }, expect: { "A–a gradient": 0 }, note: "Q198: pure hypoventilation (≈0)" }],
    },
    {
      id: "ag", name: "Anion gap (albumin-corrected)", set: 8,
      inputs: [{ id: "na", label: "Na+", unit: "mmol/L", def: 138 }, { id: "cl", label: "Cl−", unit: "mmol/L", def: 108 },
               { id: "hco3", label: "HCO3−", unit: "mmol/L", def: 14 }, { id: "alb", label: "Albumin", unit: "g/L", def: 20 }],
      formula: "AG = Na − (Cl + HCO3);  corrected AG = AG + 0.25 × (40 − albumin g/L)",
      normal: "About 8–12 mmol/L (laboratory-dependent)",
      compute(v) {
        const ag = v.na - (v.cl + v.hco3);
        const c = ag + 0.25 * (40 - v.alb);
        return { rows: [["Anion gap", r1(ag), "mmol/L"], ["Corrected anion gap", r1(c), "mmol/L"]],
                 band: c > 12 ? "warn" : "ok",
                 text: c > 12 ? "Raised anion gap: consider lactate, ketones, toxic alcohols, salicylate, uraemia." : "Normal anion gap." };
      },
      tests: [{ in: { na: 138, cl: 108, hco3: 14, alb: 20 }, expect: { "Corrected anion gap": 21 }, note: "Q351" },
              { in: { na: 140, cl: 104, hco3: 24, alb: 40 }, expect: { "Corrected anion gap": 12 }, note: "Normal values" }],
    },
    {
      id: "delta", name: "Delta ratio", set: 8,
      inputs: [{ id: "ag", label: "Anion gap", unit: "mmol/L", def: 30 }, { id: "hco3", label: "HCO3−", unit: "mmol/L", def: 20 },
               { id: "nag", label: "Normal AG", unit: "mmol/L", def: 12 }, { id: "nhco3", label: "Normal HCO3−", unit: "mmol/L", def: 24 }],
      formula: "Δ ratio = (AG − normal AG) ÷ (normal HCO3 − HCO3)",
      normal: "0.8–2 in a pure raised anion gap acidosis",
      compute(v) {
        const d = (v.ag - v.nag) / (v.nhco3 - v.hco3);
        let text = "0.8–2: pure raised anion gap metabolic acidosis.", band = "ok";
        if (!isFinite(d)) { text = "HCO3 equals normal: ratio undefined; a raised AG with normal HCO3 suggests coexisting metabolic alkalosis."; band = "warn"; }
        else if (d < 0.4) { text = "<0.4: hyperchloraemic normal anion gap acidosis."; band = "warn"; }
        else if (d < 0.8) { text = "0.4–0.8: mixed raised and normal anion gap acidosis."; band = "warn"; }
        else if (d > 2) { text = ">2: raised anion gap acidosis with coexisting metabolic alkalosis (or chronic respiratory acidosis)."; band = "warn"; }
        return { rows: [["Delta ratio", isFinite(d) ? r1(d) : "—", ""]], band, text };
      },
      tests: [{ in: { ag: 30, hco3: 20, nag: 12, nhco3: 24 }, expect: { "Delta ratio": 4.5 }, note: "Q353: coexisting alkalosis" },
              { in: { ag: 24, hco3: 12, nag: 12, nhco3: 24 }, expect: { "Delta ratio": 1 }, note: "Pure HAGMA" }],
    },
    {
      id: "winter", name: "Winter's formula", set: 8,
      inputs: [{ id: "hco3", label: "HCO3−", unit: "mmol/L", def: 12 }, { id: "paco2", label: "Measured PaCO2 (optional)", unit: "mmHg", def: 38 }],
      formula: "Expected PaCO2 = 1.5 × HCO3 + 8 (± 2)",
      normal: "Measured PaCO2 within the expected range = appropriate compensation",
      compute(v) {
        const e = 1.5 * v.hco3 + 8;
        let text = "Compare the measured PaCO2 with this range.", band = "ok";
        if (v.paco2) {
          if (v.paco2 > e + 2) { text = "Measured PaCO2 above range: concomitant respiratory acidosis."; band = "warn"; }
          else if (v.paco2 < e - 2) { text = "Measured PaCO2 below range: concomitant respiratory alkalosis."; band = "warn"; }
          else text = "Appropriate respiratory compensation.";
        }
        return { rows: [["Expected PaCO2", r1(e), "mmHg"], ["Range", `${r1(e - 2)}–${r1(e + 2)}`, "mmHg"]], band, text };
      },
      tests: [{ in: { hco3: 12, paco2: 38 }, expect: { "Expected PaCO2": 26 }, note: "Q352: inadequate compensation" },
              { in: { hco3: 16, paco2: 32 }, expect: { "Expected PaCO2": 32 }, note: "Appropriate" }],
    },
    {
      id: "osm", name: "Osmolar gap", set: 8,
      inputs: [{ id: "meas", label: "Measured osmolality", unit: "mOsm/kg", def: 330 }, { id: "na", label: "Na+", unit: "mmol/L", def: 140 },
               { id: "glu", label: "Glucose", unit: "mmol/L", def: 5.5 }, { id: "urea", label: "Urea", unit: "mmol/L", def: 5 },
               { id: "etoh", label: "Ethanol (optional)", unit: "mmol/L", def: 0 }],
      formula: "Calculated = 2Na + glucose + urea (+ ethanol);  gap = measured − calculated;  effective osmolality = 2Na + glucose",
      normal: "Gap below about 10 mOsm/kg",
      compute(v) {
        const calc = 2 * v.na + v.glu + v.urea + (v.etoh || 0);
        const gap = v.meas - calc;
        return { rows: [["Calculated osmolality", r1(calc), "mOsm/kg"], ["Osmolar gap", r0(gap), "mOsm/kg"], ["Effective osmolality", r0(2 * v.na + v.glu), "mOsm/kg"]],
                 band: gap > 10 ? "warn" : "ok",
                 text: gap > 10 ? "Raised gap: unmeasured osmoles such as methanol, ethylene glycol, mannitol or isopropanol." : "Normal osmolar gap." };
      },
      tests: [{ in: { meas: 330, na: 140, glu: 5.5, urea: 5, etoh: 0 }, expect: { "Osmolar gap": 40 }, note: "Q354" },
              { in: { meas: 360, na: 150, glu: 50, urea: 10, etoh: 0 }, expect: { "Effective osmolality": 350 }, note: "Q659" }],
    },
    {
      id: "nacorr", name: "Corrected sodium (hyperglycaemia)", set: 14,
      inputs: [{ id: "na", label: "Measured Na+", unit: "mmol/L", def: 128 }, { id: "glu", label: "Glucose", unit: "mg/dL", def: 900 },
               { id: "factor", label: "Correction factor", type: "select", def: "1.6", options: [["1.6", "1.6 per 100 mg/dL (Katz)"], ["2.4", "2.4 per 100 mg/dL (Hillier)"]] }],
      formula: "Corrected Na = Na + factor × (glucose − 100) ÷ 100   (glucose mmol/L × 18 = mg/dL)",
      normal: "135–145 mmol/L",
      compute(v) {
        const c = v.na + Number(v.factor) * (v.glu - 100) / 100;
        return { rows: [["Corrected Na+", r1(c), "mmol/L"]], band: c > 145 || c < 135 ? "warn" : "ok",
                 text: c > 145 ? "Corrected value is hypernatraemic: free water deficit is larger than it looks." : c < 135 ? "True hyponatraemia persists after correction." : "Hyponatraemia is translocational (glucose-related)." };
      },
      tests: [{ in: { na: 128, glu: 900, factor: "1.6" }, expect: { "Corrected Na+": 140.8 }, note: "Q371 (about 141)" },
              { in: { na: 130, glu: 600, factor: "2.4" }, expect: { "Corrected Na+": 142 }, note: "Hillier factor" }],
    },
    {
      id: "fwd", name: "Free water deficit", set: 8,
      inputs: [{ id: "na", label: "Serum Na+", unit: "mmol/L", def: 160 }, { id: "wt", label: "Weight", unit: "kg", def: 70 },
               { id: "tbw", label: "Total body water fraction", type: "select", def: "0.6", options: [["0.6", "Adult male (0.6)"], ["0.5", "Adult female / elderly male (0.5)"], ["0.45", "Elderly female (0.45)"]] }],
      formula: "Deficit (L) = TBW fraction × weight × (Na ÷ 140 − 1)",
      normal: "Correct chronic hypernatraemia by about 10–12 mmol/L per 24 h",
      compute(v) {
        const d = Number(v.tbw) * v.wt * (v.na / 140 - 1);
        return { rows: [["Free water deficit", r1(d), "L"]], band: d > 0 ? "warn" : "ok", text: "Add ongoing losses; replace gradually and recheck sodium frequently." };
      },
      tests: [{ in: { na: 160, wt: 70, tbw: "0.6" }, expect: { "Free water deficit": 6 }, note: "42 L × 0.143" },
              { in: { na: 154, wt: 60, tbw: "0.5" }, expect: { "Free water deficit": 3 }, note: "30 L × 0.1" }],
    },
    {
      id: "pbw", name: "Predicted body weight and tidal volume", set: 5,
      inputs: [{ id: "h", label: "Height", unit: "cm", def: 160 }, { id: "sex", label: "Sex", type: "select", def: "f", options: [["m", "Male"], ["f", "Female"]] },
               { id: "mlkg", label: "Target", unit: "mL/kg PBW", def: 6 }],
      formula: "PBW male = 50 + 0.91 × (height cm − 152.4);  female = 45.5 + 0.91 × (height cm − 152.4)",
      normal: "Lung-protective VT 4–8 mL/kg PBW (start at 6)",
      compute(v) {
        const pbw = (v.sex === "m" ? 50 : 45.5) + 0.91 * (v.h - 152.4);
        return { rows: [["Predicted body weight", r1(pbw), "kg"], ["Tidal volume", r0(pbw * v.mlkg), "mL"]], band: "ok",
                 text: "Set VT from PBW, never actual weight; keep plateau ≤30 cmH2O." };
      },
      tests: [{ in: { h: 160, sex: "f", mlkg: 6 }, expect: { "Predicted body weight": 52.4 }, note: "Q165 (about 52 kg)" },
              { in: { h: 175, sex: "m", mlkg: 6 }, expect: { "Tidal volume": 423 }, note: "PBW 70.6 kg" }],
    },
    {
      id: "comp", name: "Static compliance and driving pressure", set: 4,
      inputs: [{ id: "vt", label: "Tidal volume", unit: "mL", def: 420 }, { id: "pplat", label: "Plateau pressure", unit: "cmH2O", def: 26 }, { id: "peep", label: "PEEP", unit: "cmH2O", def: 10 }],
      formula: "Driving pressure = Pplat − PEEP;  Cstat = VT ÷ driving pressure",
      normal: "Cstat 50–100 mL/cmH2O; driving pressure below about 15 cmH2O",
      compute(v) {
        const dp = v.pplat - v.peep, c = v.vt / dp;
        return { rows: [["Driving pressure", r1(dp), "cmH2O"], ["Static compliance", r1(c), "mL/cmH2O"]], band: dp > 15 ? "warn" : "ok",
                 text: dp > 15 ? "Driving pressure above 15 cmH2O is associated with higher mortality in ARDS (Amato 2015)." : "Driving pressure within the lung-protective range." };
      },
      tests: [{ in: { vt: 420, pplat: 26, peep: 10 }, expect: { "Static compliance": 26.3 }, note: "420 ÷ 16" },
              { in: { vt: 500, pplat: 20, peep: 10 }, expect: { "Driving pressure": 10 }, note: "Cstat 50" }],
    },
    {
      id: "rsbi", name: "Rapid shallow breathing index", set: 6,
      inputs: [{ id: "rr", label: "Respiratory rate", unit: "/min", def: 30 }, { id: "vt", label: "Tidal volume", unit: "mL", def: 300 }],
      formula: "RSBI = RR ÷ VT (litres)",
      normal: "Below 105 breaths/min/L predicts weaning success",
      compute(v) {
        const x = v.rr / (v.vt / 1000);
        return { rows: [["RSBI", r0(x), "breaths/min/L"]], band: x >= 105 ? "bad" : "ok", text: x >= 105 ? "≥105: weaning failure likely." : "<105: favours weaning success (use with clinical assessment)." };
      },
      tests: [{ in: { rr: 30, vt: 300 }, expect: { RSBI: 100 }, note: "Q265" }, { in: { rr: 35, vt: 250 }, expect: { RSBI: 140 }, note: "Failure range" }],
    },
    {
      id: "rox", name: "ROX index", set: 5,
      inputs: [{ id: "spo2", label: "SpO2", unit: "%", def: 92 }, { id: "fio2", label: "FiO2", unit: "0.21–1 or %", def: 0.6 }, { id: "rr", label: "Respiratory rate", unit: "/min", def: 32 }],
      formula: "ROX = (SpO2 ÷ FiO2) ÷ RR",
      normal: "≥4.88 at 2, 6 or 12 h of HFNO predicts success",
      compute(v) {
        const x = (v.spo2 / fio2(v.fio2)) / v.rr;
        let band = "ok", text = "≥4.88: lower risk of HFNO failure.";
        if (x < 3.85) { band = "bad"; text = "<3.85: high risk of HFNO failure; consider intubation."; }
        else if (x < 4.88) { band = "warn"; text = "3.85–4.88: borderline; reassess closely."; }
        return { rows: [["ROX index", r2(x), ""]], band, text };
      },
      tests: [{ in: { spo2: 92, fio2: 0.6, rr: 32 }, expect: { "ROX index": 4.79 }, note: "Q228 (≈4.8)" },
              { in: { spo2: 96, fio2: 0.4, rr: 24 }, expect: { "ROX index": 10 }, note: "Low risk" }],
    },
    {
      id: "sofa", name: "SOFA score (original)", set: 3,
      inputs: [
        { id: "pf", label: "PaO2/FiO2", unit: "mmHg", def: 250 },
        { id: "vent", label: "Respiratory support (ventilation/CPAP)", type: "select", def: "0", options: yesno },
        { id: "plt", label: "Platelets", unit: "×10⁹/L", def: 200 },
        { id: "bili", label: "Bilirubin", unit: "µmol/L", def: 15 },
        { id: "cv", label: "Cardiovascular", type: "select", def: "0", options: [["0", "MAP ≥70 mmHg"], ["1", "MAP <70 mmHg"], ["2", "Dopamine ≤5 or any dobutamine"], ["3", "Dopamine >5, or adrenaline/noradrenaline ≤0.1 µg/kg/min"], ["4", "Dopamine >15, or adrenaline/noradrenaline >0.1 µg/kg/min"]] },
        { id: "gcs", label: "GCS", unit: "3–15", def: 13 },
        { id: "cr", label: "Creatinine", unit: "µmol/L", def: 180 },
        { id: "uo", label: "Urine output (optional)", unit: "mL/day", def: 0 },
      ],
      formula: "Sum of six organ subscores (0–4 each). Sepsis-3: acute rise of ≥2 points",
      normal: "0 (baseline assumed 0 without known organ dysfunction)",
      compute(v) {
        let resp = v.pf < 400 ? 1 : 0; if (v.pf < 300) resp = 2;
        if (v.vent === "1" && v.pf < 200) resp = 3; if (v.vent === "1" && v.pf < 100) resp = 4;
        const coag = v.plt < 20 ? 4 : v.plt < 50 ? 3 : v.plt < 100 ? 2 : v.plt < 150 ? 1 : 0;
        const liver = v.bili > 204 ? 4 : v.bili >= 102 ? 3 : v.bili >= 33 ? 2 : v.bili >= 20 ? 1 : 0;
        const cv = Number(v.cv);
        const cns = v.gcs < 6 ? 4 : v.gcs <= 9 ? 3 : v.gcs <= 12 ? 2 : v.gcs <= 14 ? 1 : 0;
        let renal = v.cr > 440 ? 4 : v.cr >= 300 ? 3 : v.cr >= 171 ? 2 : v.cr >= 110 ? 1 : 0;
        if (v.uo > 0 && v.uo < 200) renal = 4; else if (v.uo > 0 && v.uo < 500) renal = Math.max(renal, 3);
        const tot = resp + coag + liver + cv + cns + renal;
        return { rows: [["Respiratory", resp, ""], ["Coagulation", coag, ""], ["Liver", liver, ""], ["Cardiovascular", cv, ""], ["CNS", cns, ""], ["Renal", renal, ""], ["Total SOFA", tot, "/24"]],
                 band: tot >= 2 ? "warn" : "ok", text: "Original SOFA (Vincent 1996), as used by Sepsis-3. SOFA-2 (JAMA 2025) revises thresholds and organ-support variables; it is not used for this calculation." };
      },
      tests: [{ in: { pf: 250, vent: "0", plt: 200, bili: 15, cv: "0", gcs: 13, cr: 180, uo: 0 }, expect: { "Total SOFA": 5 }, note: "Q148" },
              { in: { pf: 180, vent: "1", plt: 45, bili: 15, cv: "0", gcs: 15, cr: 80, uo: 0 }, expect: { "Total SOFA": 6 }, note: "Q104 + Q105 subscores (3 + 3)" }],
    },
    {
      id: "curb", name: "CURB-65", set: 7,
      inputs: [{ id: "c", label: "New confusion", type: "select", def: "0", options: yesno }, { id: "u", label: "Urea", unit: "mmol/L", def: 8.5 },
               { id: "rr", label: "Respiratory rate", unit: "/min", def: 24 }, { id: "sbp", label: "Systolic BP", unit: "mmHg", def: 95 },
               { id: "dbp", label: "Diastolic BP", unit: "mmHg", def: 60 }, { id: "age", label: "Age", unit: "years", def: 70 }],
      formula: "1 point each: confusion, urea >7 mmol/L, RR ≥30, SBP <90 or DBP ≤60, age ≥65",
      normal: "0–1 low risk",
      compute(v) {
        const s = Number(v.c) + (v.u > 7 ? 1 : 0) + (v.rr >= 30 ? 1 : 0) + (v.sbp < 90 || v.dbp <= 60 ? 1 : 0) + (v.age >= 65 ? 1 : 0);
        return { rows: [["CURB-65", s, "/5"]], band: s >= 3 ? "bad" : s === 2 ? "warn" : "ok",
                 text: s >= 3 ? "3–5: severe pneumonia; consider ICU review." : s === 2 ? "2: consider hospital treatment." : "0–1: low risk." };
      },
      tests: [{ in: { c: "0", u: 8.5, rr: 24, sbp: 95, dbp: 60, age: 70 }, expect: { "CURB-65": 3 }, note: "Q330" },
              { in: { c: "1", u: 5, rr: 32, sbp: 120, dbp: 80, age: 40 }, expect: { "CURB-65": 2 }, note: "Confusion + RR" }],
    },
    {
      id: "gcs", name: "Glasgow Coma Scale", set: 11,
      inputs: [{ id: "e", label: "Eye opening", type: "select", def: "4", options: [["4", "4 Spontaneous"], ["3", "3 To sound"], ["2", "2 To pressure"], ["1", "1 None"]] },
               { id: "v", label: "Verbal", type: "select", def: "5", options: [["5", "5 Oriented"], ["4", "4 Confused"], ["3", "3 Words"], ["2", "2 Sounds"], ["1", "1 None"]] },
               { id: "m", label: "Motor", type: "select", def: "6", options: [["6", "6 Obeys commands"], ["5", "5 Localising"], ["4", "4 Normal flexion"], ["3", "3 Abnormal flexion"], ["2", "2 Extension"], ["1", "1 None"]] }],
      formula: "GCS = E + V + M (3–15)",
      normal: "15",
      compute(v) {
        const s = Number(v.e) + Number(v.v) + Number(v.m);
        return { rows: [["GCS", s, "/15"], ["Motor score", Number(v.m), "/6"]], band: s <= 8 ? "bad" : s <= 12 ? "warn" : "ok",
                 text: (s <= 8 ? "≤8: severe; airway protection usually needed. " : s <= 12 ? "9–12: moderate. " : "13–15: mild. ") + (Number(v.m) < 6 ? "Motor <6 at ≥72 h after ROSC triggers prognostication (ERC–ESICM 2025)." : "") };
      },
      tests: [{ in: { e: "2", v: "2", m: "4" }, expect: { GCS: 8 }, note: "E2V2M4" }, { in: { e: "4", v: "4", m: "6" }, expect: { GCS: 14 }, note: "Confused" }],
    },
    {
      id: "cpp", name: "Cerebral perfusion pressure", set: 11,
      inputs: [{ id: "map", label: "MAP", unit: "mmHg", def: 85 }, { id: "icp", label: "ICP", unit: "mmHg", def: 25 }],
      formula: "CPP = MAP − ICP", normal: "BTF target 60–70 mmHg; treat ICP above 22 mmHg",
      compute(v) {
        const c = v.map - v.icp;
        return { rows: [["CPP", r0(c), "mmHg"]], band: c < 60 ? "bad" : c > 70 ? "warn" : "ok", text: c < 60 ? "Below 60 mmHg: risk of cerebral ischaemia." : c > 70 ? "Above 70 mmHg: avoid aggressive elevation (ARDS risk)." : "Within the BTF target." };
      },
      tests: [{ in: { map: 85, icp: 25 }, expect: { CPP: 60 }, note: "Lower target" }, { in: { map: 90, icp: 15 }, expect: { CPP: 75 }, note: "Above target" }],
    },
    {
      id: "si", name: "Shock index", set: 2,
      inputs: [{ id: "hr", label: "Heart rate", unit: "/min", def: 120 }, { id: "sbp", label: "Systolic BP", unit: "mmHg", def: 100 }],
      formula: "SI = heart rate ÷ systolic BP", normal: "0.5–0.7",
      compute(v) {
        const s = v.hr / v.sbp;
        return { rows: [["Shock index", r2(s), ""]], band: s >= 1 ? "bad" : s > 0.9 ? "warn" : "ok", text: s >= 1 ? "≥1: significant hypovolaemia likely; transfusion more likely in trauma." : s > 0.9 ? ">0.9: associated with peri-intubation collapse." : "Normal range." };
      },
      tests: [{ in: { hr: 120, sbp: 100 }, expect: { "Shock index": 1.2 }, note: "Q99" }, { in: { hr: 80, sbp: 120 }, expect: { "Shock index": 0.67 }, note: "Normal" }],
    },
    {
      id: "do2", name: "Oxygen delivery (DO2)", set: 2,
      inputs: [{ id: "co", label: "Cardiac output", unit: "L/min", def: 5 }, { id: "hb", label: "Haemoglobin", unit: "g/dL", def: 15 },
               { id: "sao2", label: "SaO2", unit: "%", def: 98 }, { id: "pao2", label: "PaO2", unit: "mmHg", def: 100 }],
      formula: "CaO2 = 1.34 × Hb × SaO2 + 0.003 × PaO2;  DO2 = CO × CaO2 × 10",
      normal: "CaO2 about 20 mL/dL; DO2 about 1000 mL/min",
      compute(v) {
        const ca = 1.34 * v.hb * (v.sao2 / 100) + 0.003 * v.pao2;
        const d = v.co * ca * 10;
        return { rows: [["CaO2", r1(ca), "mL/dL"], ["DO2", r0(d), "mL/min"]], band: d < 600 ? "warn" : "ok", text: "Hb and SaO2 dominate; dissolved O2 contributes little." };
      },
      tests: [{ in: { co: 5, hb: 15, sao2: 98, pao2: 100 }, expect: { DO2: 1000 }, note: "CaO2 20.0" },
              { in: { co: 4, hb: 10, sao2: 90, pao2: 60 }, expect: { DO2: 490 }, note: "CaO2 12.2" }],
    },
    {
      id: "svr", name: "Systemic vascular resistance", set: 2,
      inputs: [{ id: "map", label: "MAP", unit: "mmHg", def: 90 }, { id: "cvp", label: "CVP", unit: "mmHg", def: 10 }, { id: "co", label: "Cardiac output", unit: "L/min", def: 5 }],
      formula: "SVR = 80 × (MAP − CVP) ÷ CO", normal: "800–1200 dyn·s·cm⁻⁵",
      compute(v) {
        const s = 80 * (v.map - v.cvp) / v.co;
        return { rows: [["SVR", r0(s), "dyn·s·cm⁻⁵"]], band: s < 800 || s > 1200 ? "warn" : "ok", text: s < 800 ? "Low: vasodilatory state (sepsis, anaphylaxis, vasoplegia)." : s > 1200 ? "High: vasoconstriction (cardiogenic or hypovolaemic shock)." : "Normal." };
      },
      tests: [{ in: { map: 90, cvp: 10, co: 5 }, expect: { SVR: 1280 }, note: "80 × 80 ÷ 5" }, { in: { map: 65, cvp: 5, co: 8 }, expect: { SVR: 600 }, note: "Vasodilated" }],
    },
    {
      id: "parkland", name: "Parkland formula", set: 17,
      inputs: [{ id: "wt", label: "Weight", unit: "kg", def: 70 }, { id: "tbsa", label: "Burn TBSA (partial + full thickness)", unit: "%", def: 30 }],
      formula: "24-h crystalloid = 4 mL × weight (kg) × %TBSA; half in the first 8 h from the time of burn",
      normal: "Titrate to urine output 0.5 mL/kg/h (about 30–50 mL/h)",
      compute(v) {
        const t = 4 * v.wt * v.tbsa;
        return { rows: [["24-hour volume", r0(t), "mL"], ["First 8 hours", r0(t / 2), "mL"], ["Next 16 hours", r0(t / 2), "mL"]], band: "ok", text: "A starting estimate only: avoid fluid creep and abdominal compartment syndrome." };
      },
      tests: [{ in: { wt: 70, tbsa: 30 }, expect: { "24-hour volume": 8400 }, note: "4 × 70 × 30" }, { in: { wt: 80, tbsa: 28 }, expect: { "First 8 hours": 4480 }, note: "Q819 TBSA" }],
    },
    {
      id: "fena", name: "FENa and FEurea", set: 9,
      inputs: [{ id: "una", label: "Urine Na+", unit: "mmol/L", def: 10 }, { id: "pna", label: "Plasma Na+", unit: "mmol/L", def: 140 },
               { id: "ucr", label: "Urine creatinine", unit: "same unit as plasma", def: 150 }, { id: "pcr", label: "Plasma creatinine", unit: "same unit as urine", def: 3 },
               { id: "uurea", label: "Urine urea (optional)", unit: "mmol/L", def: 0 }, { id: "purea", label: "Plasma urea (optional)", unit: "mmol/L", def: 0 }],
      formula: "FENa = (UNa × PCr) ÷ (PNa × UCr) × 100;  FEurea = (Uurea × PCr) ÷ (Purea × UCr) × 100",
      normal: "FENa <1% prerenal, >2% intrinsic; FEurea <35% prerenal (useful on diuretics)",
      compute(v) {
        const fe = (v.una * v.pcr) / (v.pna * v.ucr) * 100;
        const rows = [["FENa", r2(fe), "%"]];
        let text = fe < 1 ? "<1%: favours a prerenal state." : fe > 2 ? ">2%: favours intrinsic renal injury (e.g. ATN)." : "1–2%: indeterminate.";
        if (v.uurea && v.purea) {
          const fu = (v.uurea * v.pcr) / (v.purea * v.ucr) * 100;
          rows.push(["FEurea", r1(fu), "%"]);
          text += fu < 35 ? " FEurea <35%: prerenal." : " FEurea >50%: intrinsic.";
        }
        return { rows, band: fe < 1 ? "ok" : "warn", text };
      },
      tests: [{ in: { una: 10, pna: 140, ucr: 150, pcr: 3, uurea: 0, purea: 0 }, expect: { FENa: 0.14 }, note: "Q404" },
              { in: { una: 60, pna: 140, ucr: 50, pcr: 3, uurea: 200, purea: 20 }, expect: { FEurea: 60 }, note: "Intrinsic pattern" }],
    },
    {
      id: "crcl", name: "Creatinine clearance", set: 9,
      inputs: [{ id: "mode", label: "Method", type: "select", def: "cg", options: [["cg", "Cockcroft–Gault"], ["urine", "Measured (timed urine)"]] },
               { id: "age", label: "Age", unit: "years", def: 60 }, { id: "wt", label: "Weight", unit: "kg", def: 70 },
               { id: "sex", label: "Sex", type: "select", def: "m", options: [["m", "Male"], ["f", "Female"]] },
               { id: "pcr", label: "Plasma creatinine", unit: "µmol/L", def: 100 },
               { id: "ucr", label: "Urine creatinine (measured)", unit: "mmol/L", def: 8 }, { id: "uvol", label: "Urine volume (measured)", unit: "mL", def: 2400 },
               { id: "hours", label: "Collection period (measured)", unit: "h", def: 24 }],
      formula: "Cockcroft–Gault = (140 − age) × weight × (1.23 male / 1.04 female) ÷ creatinine µmol/L;  measured = (Ucr × V) ÷ (Pcr × time)",
      normal: "About 90–120 mL/min; above 130 mL/min/1.73 m² = augmented renal clearance",
      compute(v) {
        let c;
        if (v.mode === "urine") c = (v.ucr * 1000 * (v.uvol / (v.hours * 60))) / v.pcr;
        else c = (140 - v.age) * v.wt * (v.sex === "m" ? 1.23 : 1.04) / v.pcr;
        return { rows: [["Creatinine clearance", r0(c), "mL/min"]], band: c < 30 || c > 130 ? "warn" : "ok",
                 text: c > 130 ? "Augmented clearance: risk of subtherapeutic beta-lactam levels." : c < 30 ? "Severely reduced: adjust renally cleared drugs." : "Use for drug dosing; unreliable when creatinine is changing." };
      },
      tests: [{ in: { mode: "urine", age: 0, wt: 0, sex: "m", pcr: 100, ucr: 8, uvol: 2400, hours: 24 }, expect: { "Creatinine clearance": 133 }, note: "Q435" },
              { in: { mode: "cg", age: 60, wt: 70, sex: "m", pcr: 100, ucr: 0, uvol: 0, hours: 24 }, expect: { "Creatinine clearance": 69 }, note: "80 × 70 × 1.23 ÷ 100" }],
    },
    {
      id: "crrt", name: "CRRT dose and filtration fraction", set: 9,
      inputs: [{ id: "wt", label: "Weight", unit: "kg", def: 80 }, { id: "eff", label: "Effluent rate", unit: "mL/h", def: 2000 },
               { id: "qb", label: "Blood flow (optional)", unit: "mL/min", def: 200 }, { id: "hct", label: "Haematocrit (optional)", unit: "%", def: 30 },
               { id: "uf", label: "Post-dilution UF rate (optional)", unit: "mL/h", def: 2000 }],
      formula: "Dose = effluent ÷ weight;  FF (post-dilution) = UF ÷ (Qb × 60 × (1 − Hct))",
      normal: "Deliver 20–25 mL/kg/h (prescribe 25–30); keep FF below 20–25%",
      compute(v) {
        const dose = v.eff / v.wt;
        const rows = [["Effluent dose", r1(dose), "mL/kg/h"], ["Effluent for 25 mL/kg/h", r0(25 * v.wt), "mL/h"]];
        let text = dose < 20 ? "Below the KDIGO delivered target of 20–25 mL/kg/h." : "Within or above the delivered target.";
        if (v.qb && v.hct && v.uf) {
          const ff = v.uf / (v.qb * 60 * (1 - v.hct / 100)) * 100;
          rows.push(["Filtration fraction", r0(ff), "%"]);
          if (ff > 25) text += " FF above 25%: high filter clotting risk; consider pre-dilution or higher blood flow.";
        }
        return { rows, band: dose < 20 ? "warn" : "ok", text };
      },
      tests: [{ in: { wt: 80, eff: 2000, qb: 0, hct: 0, uf: 0 }, expect: { "Effluent dose": 25 }, note: "Q413" },
              { in: { wt: 80, eff: 2000, qb: 200, hct: 30, uf: 2000 }, expect: { "Filtration fraction": 24 }, note: "Q418" }],
    },
    {
      id: "4ts", name: "4Ts score (HIT)", set: 15,
      inputs: [{ id: "t", label: "Thrombocytopenia", type: "select", def: "2", options: [["2", "2: fall >50% and nadir ≥20"], ["1", "1: fall 30–50% or nadir 10–19"], ["0", "0: fall <30% or nadir <10"]] },
               { id: "ti", label: "Timing", type: "select", def: "2", options: [["2", "2: day 5–10, or ≤1 day with heparin in past 30 days"], ["1", "1: consistent but unclear, or after day 10"], ["0", "0: ≤4 days without recent heparin"]] },
               { id: "th", label: "Thrombosis", type: "select", def: "2", options: [["2", "2: new thrombosis, skin necrosis, systemic reaction"], ["1", "1: progressive or suspected thrombosis"], ["0", "0: none"]] },
               { id: "o", label: "Other causes", type: "select", def: "1", options: [["2", "2: none apparent"], ["1", "1: possible"], ["0", "0: definite"]] }],
      formula: "Sum of four categories (0–2 each)", normal: "0–3 low probability",
      compute(v) {
        const s = Number(v.t) + Number(v.ti) + Number(v.th) + Number(v.o);
        return { rows: [["4Ts score", s, "/8"]], band: s >= 6 ? "bad" : s >= 4 ? "warn" : "ok",
                 text: s >= 6 ? "6–8: high probability; stop heparin and start a non-heparin anticoagulant." : s >= 4 ? "4–5: intermediate; stop heparin and test for anti-PF4 antibodies." : "0–3: low probability; HIT unlikely." };
      },
      tests: [{ in: { t: "2", ti: "2", th: "2", o: "1" }, expect: { "4Ts score": 7 }, note: "Q704 (score 7)" },
              { in: { t: "1", ti: "0", th: "0", o: "1" }, expect: { "4Ts score": 2 }, note: "Low" }],
    },
    {
      id: "dic", name: "ISTH overt DIC score", set: 15,
      inputs: [{ id: "plt", label: "Platelets", unit: "×10⁹/L", def: 40 },
               { id: "dd", label: "D-dimer / fibrin markers", type: "select", def: "3", options: [["0", "No increase"], ["2", "Moderate increase"], ["3", "Strong increase"]] },
               { id: "pt", label: "PT prolongation", unit: "seconds", def: 7 }, { id: "fib", label: "Fibrinogen", unit: "g/L", def: 0.9 }],
      formula: "Platelets (>100: 0, 50–100: 1, <50: 2) + fibrin markers (0/2/3) + PT (<3 s: 0, 3–6 s: 1, >6 s: 2) + fibrinogen (≤1 g/L: 1)",
      normal: "≥5 compatible with overt DIC",
      compute(v) {
        const s = (v.plt < 50 ? 2 : v.plt <= 100 ? 1 : 0) + Number(v.dd) + (v.pt > 6 ? 2 : v.pt >= 3 ? 1 : 0) + (v.fib <= 1 ? 1 : 0);
        return { rows: [["ISTH DIC score", s, "/8"]], band: s >= 5 ? "bad" : "ok", text: s >= 5 ? "≥5: compatible with overt DIC; repeat daily and treat the cause." : "<5: suggestive of non-overt DIC; repeat in 1–2 days." };
      },
      tests: [{ in: { plt: 40, dd: "3", pt: 7, fib: 0.9 }, expect: { "ISTH DIC score": 8 }, note: "Q701" },
              { in: { plt: 120, dd: "2", pt: 2, fib: 2 }, expect: { "ISTH DIC score": 2 }, note: "Non-overt" }],
    },
    {
      id: "nnt", name: "NNT, ARR and RRR", set: 20,
      inputs: [{ id: "cer", label: "Control event rate", unit: "%", def: 30 }, { id: "eer", label: "Treatment event rate", unit: "%", def: 25 }],
      formula: "ARR = CER − EER;  RRR = ARR ÷ CER;  NNT = 100 ÷ ARR(%)", normal: "Smaller NNT = more effective",
      compute(v) {
        const arr = v.cer - v.eer, rrr = arr / v.cer * 100, nnt = 100 / arr;
        return { rows: [["ARR", r1(arr), "%"], ["RRR", r1(rrr), "%"], [arr >= 0 ? "NNT" : "NNH", isFinite(nnt) ? Math.ceil(Math.abs(nnt) - 1e-9) : "—", ""]],
                 band: "ok", text: arr < 0 ? "Treatment increases events: the number is a number needed to harm." : "Round NNT up to the next whole patient." };
      },
      tests: [{ in: { cer: 30, eer: 25 }, expect: { NNT: 20, RRR: 16.7 }, note: "Q973 and Q974" }, { in: { cer: 20, eer: 10 }, expect: { NNT: 10, RRR: 50 }, note: "Halved risk" }],
    },
    {
      id: "lr", name: "Likelihood ratios and predictive values", set: 20,
      inputs: [{ id: "sens", label: "Sensitivity", unit: "%", def: 90 }, { id: "spec", label: "Specificity", unit: "%", def: 90 }, { id: "prev", label: "Prevalence / pre-test probability", unit: "%", def: 33.3 }],
      formula: "LR+ = sens ÷ (1 − spec);  LR− = (1 − sens) ÷ spec;  PPV = sens·p ÷ (sens·p + (1 − spec)(1 − p))",
      normal: "LR+ >10 or LR− <0.1 change probability substantially",
      compute(v) {
        const se = v.sens / 100, sp = v.spec / 100, p = v.prev / 100;
        const lrp = se / (1 - sp), lrn = (1 - se) / sp;
        const ppv = se * p / (se * p + (1 - sp) * (1 - p)), npv = sp * (1 - p) / (sp * (1 - p) + (1 - se) * p);
        return { rows: [["LR+", isFinite(lrp) ? r1(lrp) : "∞", ""], ["LR−", r2(lrn), ""], ["PPV", r1(ppv * 100), "%"], ["NPV", r1(npv * 100), "%"]],
                 band: "ok", text: "Predictive values depend on prevalence: PPV falls and NPV rises as prevalence falls." };
      },
      tests: [{ in: { sens: 90, spec: 90, prev: 33.3 }, expect: { PPV: 81.8 }, note: "Q970 (about 82%)" }, { in: { sens: 80, spec: 95, prev: 10 }, expect: { "LR+": 16 }, note: "0.8 ÷ 0.05" }],
    },
    {
      id: "ca", name: "Albumin-corrected calcium", set: 8,
      inputs: [{ id: "ca", label: "Total calcium", unit: "mmol/L", def: 2.0 }, { id: "alb", label: "Albumin", unit: "g/L", def: 20 }],
      formula: "Corrected Ca = Ca + 0.02 × (40 − albumin g/L)", normal: "2.2–2.6 mmol/L (ionised 1.1–1.3)",
      compute(v) {
        const c = v.ca + 0.02 * (40 - v.alb);
        return { rows: [["Corrected calcium", r2(c), "mmol/L"]], band: c < 2.2 || c > 2.6 ? "warn" : "ok", text: "Measure ionised calcium in critical illness where possible; the correction is unreliable." };
      },
      tests: [{ in: { ca: 2.0, alb: 20 }, expect: { "Corrected calcium": 2.4 }, note: "Q377" }, { in: { ca: 2.5, alb: 40 }, expect: { "Corrected calcium": 2.5 }, note: "No correction" }],
    },
    {
      id: "oi", name: "Oxygenation index", set: 4,
      inputs: [{ id: "paw", label: "Mean airway pressure", unit: "cmH2O", def: 20 }, { id: "fio2", label: "FiO2", unit: "0.21–1 or %", def: 0.8 }, { id: "pao2", label: "PaO2", unit: "mmHg", def: 80 }],
      formula: "OI = (FiO2 × 100 × mean airway pressure) ÷ PaO2", normal: "Higher = worse; above about 25–40 indicates severe failure",
      compute(v) {
        const o = fio2(v.fio2) * 100 * v.paw / v.pao2;
        return { rows: [["Oxygenation index", r1(o), ""]], band: o > 25 ? "bad" : o > 15 ? "warn" : "ok", text: "Accounts for airway pressure as well as FiO2." };
      },
      tests: [{ in: { paw: 20, fio2: 0.8, pao2: 80 }, expect: { "Oxygenation index": 20 }, note: "Q170" }, { in: { paw: 15, fio2: 0.5, pao2: 100 }, expect: { "Oxygenation index": 7.5 }, note: "Mild" }],
    },
    {
      id: "vdvt", name: "Dead space fraction (Bohr–Enghoff)", set: 4,
      inputs: [{ id: "paco2", label: "PaCO2", unit: "mmHg", def: 50 }, { id: "peco2", label: "Mixed expired PCO2", unit: "mmHg", def: 20 }],
      formula: "VD/VT = (PaCO2 − PECO2) ÷ PaCO2", normal: "0.2–0.35",
      compute(v) {
        const d = (v.paco2 - v.peco2) / v.paco2;
        return { rows: [["VD/VT", r2(d), ""]], band: d > 0.5 ? "warn" : "ok", text: d > 0.5 ? "High dead space: associated with mortality in ARDS." : "Normal to mildly raised." };
      },
      tests: [{ in: { paco2: 50, peco2: 20 }, expect: { "VD/VT": 0.6 }, note: "Q167" }, { in: { paco2: 40, peco2: 28 }, expect: { "VD/VT": 0.3 }, note: "Normal" }],
    },
    {
      id: "echoco", name: "Cardiac output by LVOT VTI", set: 2,
      inputs: [{ id: "d", label: "LVOT diameter", unit: "cm", def: 2.0 }, { id: "vti", label: "LVOT VTI", unit: "cm", def: 20 }, { id: "hr", label: "Heart rate", unit: "/min", def: 80 }],
      formula: "SV = π × (d ÷ 2)² × VTI;  CO = SV × HR", normal: "SV 60–100 mL; CO 4–8 L/min; VTI 18–22 cm",
      compute(v) {
        const sv = Math.PI * (v.d / 2) ** 2 * v.vti, co = sv * v.hr / 1000;
        return { rows: [["Stroke volume", r0(sv), "mL"], ["Cardiac output", r1(co), "L/min"]], band: co < 4 ? "warn" : "ok", text: "LVOT diameter errors are squared: measure carefully." };
      },
      tests: [{ in: { d: 2.0, vti: 20, hr: 80 }, expect: { "Cardiac output": 5 }, note: "Q92" }, { in: { d: 2.2, vti: 15, hr: 100 }, expect: { "Stroke volume": 57 }, note: "Low VTI" }],
    },
    {
      id: "mv", name: "Ventilator rate for a target PaCO2", set: 4,
      inputs: [{ id: "rr", label: "Current rate", unit: "/min", def: 15 }, { id: "paco2", label: "Current PaCO2", unit: "mmHg", def: 60 }, { id: "target", label: "Target PaCO2", unit: "mmHg", def: 45 }],
      formula: "New rate = current rate × current PaCO2 ÷ target PaCO2 (constant VT, VCO2 and VD/VT)", normal: "",
      compute(v) {
        const n = v.rr * v.paco2 / v.target;
        return { rows: [["New respiratory rate", r0(n), "/min"]], band: "ok", text: "Watch for intrinsic PEEP when the rate rises." };
      },
      tests: [{ in: { rr: 15, paco2: 60, target: 45 }, expect: { "New respiratory rate": 20 }, note: "Q166" }, { in: { rr: 20, paco2: 30, target: 40 }, expect: { "New respiratory rate": 15 }, note: "Reduce rate" }],
    },
  ];

  /** Run every calculator's two worked examples; returns [{id, name, note, ok, got, expect}]. */
  function runSelfTests() {
    const out = [];
    for (const c of CALCS) {
      for (const t of c.tests) {
        const res = c.compute(Object.assign({}, t.in));
        const got = Object.fromEntries(res.rows.map((r) => [r[0], r[1]]));
        let ok = true;
        for (const [k, want] of Object.entries(t.expect)) {
          const g = Number(got[k]);
          if (!(Math.abs(g - want) <= Math.max(0.05, Math.abs(want) * 0.01))) ok = false;
        }
        out.push({ id: c.id, name: c.name, note: t.note, ok, got, expect: t.expect });
      }
    }
    return out;
  }

  window.HS_CALCS = { list: CALCS, runSelfTests };
})();
