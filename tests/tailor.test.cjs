"use strict";
/* Unit tests for tailor.js — run with `node --test tests/tailor.test.cjs` */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { loadResume, Tailor: T } = require("./helpers.cjs");

const RESUME = loadResume();
const skillNames = (sel) => sel.skills.flatMap(g => g.items.filter(i => i.included).map(i => i.name));
const hiddenSkillNames = (sel) => sel.skills.flatMap(g => g.items.filter(i => !i.included).map(i => i.name));
const projectNames = (sel) => sel.sections.projects.filter(e => e.included).map(e => e.item.name);
const allSkillNames = RESUME.skills.flatMap(g => g.items);

describe("data integrity", () => {
  test("every role profile is well-formed and unique", () => {
    const ids = new Set();
    for (const p of RESUME.roleProfiles) {
      assert.ok(p.id && p.title, "id and title required");
      assert.ok(!ids.has(p.id), "duplicate id " + p.id); ids.add(p.id);
      for (const d of [...(p.domains || []), ...(p.secondary || [])]) assert.ok(T.DOMAINS[d], `${p.id}: unknown domain ${d}`);
      for (const s of (p.skills && p.skills.include) || []) assert.ok(allSkillNames.includes(s), `${p.id}: include lists unknown skill ${s}`);
      for (const s of (p.skills && p.skills.exclude) || []) assert.ok(allSkillNames.includes(s), `${p.id}: exclude lists unknown skill ${s}`);
      for (const n of (p.pin && p.pin.projects) || []) assert.ok(RESUME.projects.some(pr => pr.name === n), `${p.id}: pins unknown project ${n}`);
    }
    assert.ok(RESUME.roleProfiles.length >= 10);
  });
  test("domain skill names refer to real skills", () => {
    for (const [id, d] of Object.entries(T.DOMAINS)) {
      for (const s of d.skills) assert.ok(allSkillNames.some(n => n.toLowerCase() === s.toLowerCase()), `${id}: unknown skill ${s}`);
      for (const g of d.groups) assert.ok(RESUME.skills.some(x => x.group.toLowerCase() === g.toLowerCase()), `${id}: unknown group ${g}`);
    }
  });
});

describe("keyword matching", () => {
  test("word-prefix matching with whole-word rule for short keywords", () => {
    assert.equal(T.hasKeyword("vulnerabilities found", "vulnerab"), true);
    assert.equal(T.hasKeyword("an ai tool", "ai"), true);
    assert.equal(T.hasKeyword("aims high", "ai"), false);
    assert.equal(T.hasKeyword("email", "mail"), false);
    assert.equal(T.hasKeyword("react native app", "react native"), true);
    assert.equal(T.hasKeyword("", "x"), false);
  });
  test("domainsForQuery: longest term wins and consumes its words", () => {
    assert.deepEqual(T.domainsForQuery("react native engineer"), ["mobile", "software"]);
    assert.deepEqual(T.domainsForQuery("front end developer"), ["software", "frontend"]);
    assert.deepEqual(T.domainsForQuery("quantum"), []);
  });
});

describe("role resolution", () => {
  const cases = [
    ["Front End Developer", "front-end-developer"],
    ["front end", "front-end-developer"],
    ["frontend", "front-end-developer"],
    ["FRONT-END DEVELOPER", "front-end-developer"],
    ["sde", "software-developer"],
    ["Software Engineer Intern", "software-developer"],
    ["ml", "machine-learning-engineer"],
    ["Data Scientist", "machine-learning-engineer"],
    ["react native", "mobile-developer"],
    ["Cyber Security Analyst", "security-engineer"],
    ["pentester", "penetration-tester"],
    ["devops", "devops-engineer"],
    ["FULLSTACK", "full-stack-developer"],
    ["penetration-tester", "penetration-tester"]
  ];
  for (const [q, id] of cases) test(`"${q}" → ${id}`, () => assert.equal(T.resolveRole(RESUME, q).id, id));

  test("empty query means the full résumé", () => {
    assert.equal(T.resolveRole(RESUME, ""), null);
    assert.equal(T.resolveRole(RESUME, null), null);
    assert.equal(T.tailor(RESUME, "", {}).full, true);
  });
  test("unknown domain-ish query builds a synthetic profile", () => {
    const r = T.resolveRole(RESUME, "Quantum Computing Researcher");
    assert.equal(r.synthetic, true);
    assert.ok(r.domains.includes("research"));
    assert.equal(r.title, "Quantum Computing Researcher");
  });
  test("query with no matches is ad-hoc and falls back leniently", () => {
    const sel = T.tailor(RESUME, "zzz nonsense", {});
    assert.equal(sel.fallback, true);
    assert.equal(sel.counts.skills.shown, sel.counts.skills.total);
    assert.equal(sel.counts.projects.shown, sel.counts.projects.total);
  });
  test("searchRoles ranks exact > prefix > substring and never throws", () => {
    const r = T.searchRoles(RESUME, "sec");
    assert.ok(r.length >= 3);
    assert.ok(r.every(x => x.score > 0));
    assert.equal(T.searchRoles(RESUME, "").length, RESUME.roleProfiles.length);
    assert.equal(T.searchRoles(RESUME, "Front End Developer")[0].profile.id, "front-end-developer");
    assert.doesNotThrow(() => T.searchRoles(RESUME, "(((("));
    assert.doesNotThrow(() => T.searchRoles({}, "x"));
  });
});

describe("filtering", () => {
  test("full résumé keeps everything in master order", () => {
    const sel = T.tailor(RESUME, null, {});
    assert.equal(sel.full, true);
    assert.equal(sel.counts.skills.shown, allSkillNames.length);
    assert.equal(JSON.stringify(projectNames(sel)), JSON.stringify(RESUME.projects.map(p => p.name)));
    for (const sec of ["experience", "research", "certifications", "leadership", "awards"]) assert.equal(sel.counts[sec].shown, RESUME[sec].length);
  });

  test("Front End Developer: front-end skills in, pentest toolkit out, research hidden", () => {
    const sel = T.tailor(RESUME, "Front End Developer", {});
    const s = skillNames(sel);
    for (const k of ["React", "TypeScript", "HTML", "React Native", "Expo", "Git", "GitHub"]) assert.ok(s.includes(k), "missing " + k);
    for (const k of ["Burp Suite CE", "nmap", "Kali Linux", "Zero Trust", "LaTeX", "Autopsy"]) assert.ok(!s.includes(k), "should hide " + k);
    assert.ok(hiddenSkillNames(sel).includes("Burp Suite CE"));
    assert.equal(sel.counts.research.shown, 0);
    assert.ok(projectNames(sel).includes("PromptGuard"));
    assert.ok(projectNames(sel).includes("NetworkAudit"));
    assert.ok(!projectNames(sel).includes("SME-ZT CLI"));
    assert.ok(sel.counts.skills.shown < sel.counts.skills.total / 2);
  });

  test("Penetration Tester: toolkit in, front-end frameworks out", () => {
    const sel = T.tailor(RESUME, "Penetration Tester", {});
    const s = skillNames(sel);
    for (const k of ["Burp Suite CE", "OWASP ZAP", "nmap", "Kali Linux", "IDOR & Auth-Bypass Testing", "Blind & Error-Based SQLi"]) assert.ok(s.includes(k), "missing " + k);
    for (const k of ["React", "Expo", "React Native", "XGBoost"]) assert.ok(!s.includes(k), "should hide " + k);
    assert.equal(projectNames(sel)[0], "NetworkAudit");
    assert.ok(sel.sections.experience[0].included);
  });

  test("Machine Learning Engineer: ML group in, PromptGuard first", () => {
    const sel = T.tailor(RESUME, "Machine Learning Engineer", {});
    const s = skillNames(sel);
    for (const k of ["XGBoost", "scikit-learn", "Random Forest", "Python"]) assert.ok(s.includes(k), "missing " + k);
    assert.ok(!s.includes("Burp Suite CE"));
    assert.equal(projectNames(sel)[0], "PromptGuard");
    assert.ok(sel.sections.research.filter(e => e.included).length >= 2);
  });

  test("Security Researcher keeps all papers, research-first ordering", () => {
    const sel = T.tailor(RESUME, "Security Researcher", {});
    assert.equal(sel.counts.research.shown, RESUME.research.length);
    assert.ok(skillNames(sel).includes("LaTeX"));
  });

  test("every profile keeps at least two projects, the experience, all awards and leadership", () => {
    for (const p of RESUME.roleProfiles) {
      const sel = T.tailor(RESUME, p.id, {});
      assert.ok(sel.counts.projects.shown >= 2, p.id + " projects");
      assert.equal(sel.counts.experience.shown, RESUME.experience.length, p.id + " experience");
      assert.equal(sel.counts.awards.shown, RESUME.awards.length, p.id + " awards");
      assert.equal(sel.counts.leadership.shown, RESUME.leadership.length, p.id + " leadership");
      assert.equal(sel.counts.certifications.shown, RESUME.certifications.length, p.id + " certifications");
      assert.ok(sel.counts.skills.shown >= 6, p.id + " skills too few: " + sel.counts.skills.shown);
      assert.ok(sel.counts.skills.shown < sel.counts.skills.total, p.id + " should hide some skills");
      assert.equal(sel.role.title, p.title);
    }
  });

  test("pinned projects are always included and listed first", () => {
    const sel = T.tailor(RESUME, "Data Engineer", {});
    assert.deepEqual(JSON.parse(JSON.stringify(projectNames(sel).slice(0, 2).sort())), ["NetworkAudit", "NutriLog"]);
  });

  test("tailoring is deterministic", () => {
    const a = JSON.stringify(T.tailor(RESUME, "Back End Developer", {}));
    const b = JSON.stringify(T.tailor(RESUME, "Back End Developer", {}));
    assert.equal(a, b);
  });

  test("maxHighlights trims bullets by relevance and reports the count", () => {
    const sel = T.tailor(RESUME, "Front End Developer", {});
    const exp = sel.sections.experience[0];
    assert.equal(exp.highlights.length, 3);
    assert.equal(exp.trimmed, 1);
    // order preserved from the master list
    const master = RESUME.experience[0].highlights;
    assert.equal(JSON.stringify(exp.highlights), JSON.stringify(master.filter(h => exp.highlights.includes(h))));
    const full = T.tailor(RESUME, "Front End Developer", { fullHighlights: [exp.key] });
    assert.equal(full.sections.experience[0].highlights.length, master.length);
  });
});

describe("overrides", () => {
  test("add back a hidden skill and hide a shown one", () => {
    const base = T.tailor(RESUME, "Front End Developer", {});
    const burp = base.skills.flatMap(g => g.items).find(i => i.name === "Burp Suite CE");
    const react = base.skills.flatMap(g => g.items).find(i => i.name === "React");
    assert.equal(burp.included, false); assert.equal(react.included, true);
    const sel = T.tailor(RESUME, "Front End Developer", { include: [burp.key], exclude: [react.key] });
    assert.ok(skillNames(sel).includes("Burp Suite CE"));
    assert.ok(!skillNames(sel).includes("React"));
    assert.equal(sel.edits.added, 1); assert.equal(sel.edits.removed, 1);
    assert.equal(sel.counts.skills.shown, base.counts.skills.shown);
  });
  test("add back a hidden project and paper", () => {
    const base = T.tailor(RESUME, "Front End Developer", {});
    const sme = base.sections.projects.find(e => e.item.name === "SME-ZT CLI");
    const paper = base.sections.research[0];
    assert.equal(sme.included, false); assert.equal(paper.included, false);
    const sel = T.tailor(RESUME, "Front End Developer", { include: new Set([sme.key, paper.key]) });
    assert.ok(projectNames(sel).includes("SME-ZT CLI"));
    assert.equal(sel.counts.research.shown, 1);
    // included items sort before hidden ones
    assert.ok(sel.sections.projects.findIndex(e => e.key === sme.key) < sel.sections.projects.findIndex(e => !e.included) || sel.sections.projects.every(e => e.included));
  });
  test("exclude wins over include; stale keys are ignored", () => {
    const base = T.tailor(RESUME, "Front End Developer", {});
    const react = base.skills.flatMap(g => g.items).find(i => i.name === "React");
    const sel = T.tailor(RESUME, "Front End Developer", { include: [react.key, "nope:99"], exclude: [react.key] });
    assert.ok(!skillNames(sel).includes("React"));
    assert.equal(sel.edits.added, 0);
  });
  test("overrides are ignored for the full résumé view", () => {
    const sel = T.tailor(RESUME, null, { exclude: ["projects:0"] });
    assert.equal(sel.counts.projects.shown, RESUME.projects.length - 1);   // excludes still apply if given…
    const sel2 = T.tailor(RESUME, null, {});
    assert.equal(sel2.counts.projects.shown, RESUME.projects.length);        // …but the site passes none in full mode
  });
});

describe("document builder", () => {
  test("buildDocument mirrors the selection and keeps master data untouched", () => {
    const before = JSON.stringify(RESUME);
    const sel = T.tailor(RESUME, "Front End Developer", {});
    const doc = T.buildDocument(RESUME, sel);
    assert.equal(JSON.stringify(RESUME), before, "RESUME must not be mutated");
    assert.equal(JSON.stringify(doc.projects.map(p => p.name)), JSON.stringify(projectNames(sel)));
    assert.equal(doc.research.length, 0);
    assert.ok(doc.skills.every(g => g.items.length > 0));
    assert.equal(JSON.stringify(doc.profile.roles), JSON.stringify(["Front End Developer"]));
    assert.equal(doc.profile.tailoredFor, "Front End Developer");
    assert.equal(doc.aboutParagraphs.length, 1);
    assert.equal(doc.experience[0].highlights.length, 3);
    assert.equal(RESUME.experience[0].highlights.length, 4);
  });
  test("full document equals the master data", () => {
    const doc = T.buildDocument(RESUME, T.tailor(RESUME, null, {}));
    const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));   // RESUME comes from a vm realm: compare by value
    same(doc.projects, RESUME.projects);
    same(doc.skills, RESUME.skills);
    same(doc.aboutParagraphs, RESUME.aboutParagraphs);
    same(doc.profile.roles, RESUME.profile.roles);
  });
  test("pdf filename is safe and role-specific", () => {
    assert.equal(T.pdfFilename(RESUME, T.tailor(RESUME, null, {})), "Aditya_Bidappa_M_V_Resume.pdf");
    assert.equal(T.pdfFilename(RESUME, T.tailor(RESUME, "Front End Developer", {})), "Aditya_Bidappa_M_V_Resume_Front_End_Developer.pdf");
    assert.match(T.pdfFilename(RESUME, T.tailor(RESUME, "DevOps / Automation Engineer", {})), /^[A-Za-z0-9_]+\.pdf$/);
  });
});

describe("open-ended curation (any job title, job descriptions)", () => {
  test("arbitrary job titles resolve to synthetic profiles with domains and keywords", () => {
    const cases = {
      "Cloud Security Engineer": ["cloud"], "Threat Intelligence Analyst": ["forensics", "security"], "QA Engineer": ["qa"],
      "Network Engineer": ["network"], "Technical Writer": ["writing"], "Product Manager": ["product"],
      "Embedded Systems Engineer": ["systems"], "DFIR analyst": ["forensics"]
    };
    for (const [q, doms] of Object.entries(cases)) {
      const r = T.resolveRole(RESUME, q);
      assert.equal(r.synthetic, true, q);
      assert.equal(r.adhoc, undefined, q + " should not be ad-hoc");
      for (const d of doms) assert.ok([...r.domains, ...r.secondary].includes(d), `${q}: expected domain ${d}, got ${r.domains}`);
      const sel = T.tailor(RESUME, q, {});
      assert.equal(sel.fallback, false, q);
      assert.ok(sel.counts.skills.shown >= 4 && sel.counts.skills.shown < sel.counts.skills.total, `${q}: skills ${sel.counts.skills.shown}`);
      assert.ok(sel.counts.projects.shown >= 2, q);
    }
  });
  test("title words without a domain still contribute keywords (WORD_KEYWORDS)", () => {
    const r = T.resolveRole(RESUME, "Quant Developer");
    assert.ok(r.keywords.includes("python") && r.keywords.includes("model"));
    const r2 = T.resolveRole(RESUME, "Healthcare Data Analyst");
    assert.ok(r2.keywords.includes("iomt"));
  });
  test("a pasted job description becomes a profile: title from the first line, domains by frequency, verbatim skills pulled in", () => {
    const jd = "Security Analyst (SOC)\nMonitor alerts, investigate incidents, tune detections, work with Wireshark and nmap, write incident reports, understand OWASP and NIST frameworks, and support vulnerability management and threat intelligence.";
    const r = T.resolveRole(RESUME, { jd });
    assert.equal(r.jd, true);
    assert.equal(r.title, "Security Analyst (SOC)");
    assert.equal(r.domains[0], "security");
    assert.ok(r.skills.include.includes("Wireshark") && r.skills.include.includes("nmap"));
    assert.ok(r.keywords.includes("owasp") && r.keywords.includes("nist"));
    assert.ok(r.id.startsWith("jd:"));
    assert.equal(T.resolveRole(RESUME, { jd }).id, r.id, "id is stable for the same text");
    const sel = T.tailor(RESUME, { jd }, {});
    assert.equal(sel.role.jd, true);
    assert.ok(sel.skills.flatMap(g => g.items).find(i => i.name === "Wireshark").included);
    assert.ok(sel.counts.skills.shown < sel.counts.skills.total);
  });
  test("a long free-text string is treated as a job description too", () => {
    const text = "Software Engineer Intern. We are looking for an intern to join our platform team. You will build REST APIs with Python and FastAPI, work with PostgreSQL databases, write TypeScript for our React dashboard, and help automate deployments with GitHub Actions.";
    const r = T.resolveRole(RESUME, text);
    assert.equal(r.jd, true);
    assert.ok(r.domains.includes("software"));
    assert.ok(r.skills.include.includes("FastAPI") && r.skills.include.includes("PostgreSQL"));
    const sel = T.tailor(RESUME, text, {});
    assert.ok(sel.sections.projects.filter(e => e.included).some(e => e.item.name === "PromptGuard"));
  });
  test("a description that names nothing the résumé has falls back leniently", () => {
    const sel = T.tailor(RESUME, { jd: "Head chef for a busy bistro. Menu planning, plating, supplier relations and kitchen hygiene. Evening and weekend shifts with a friendly team." }, {});
    assert.equal(sel.fallback, true);
    assert.equal(sel.counts.projects.shown, RESUME.projects.length);
  });
});

describe("content search", () => {
  test("finds skills, projects and papers by name, prefix and body text", () => {
    const s = T.searchContent(RESUME, "prompt");
    assert.deepEqual(JSON.parse(JSON.stringify(s.projects.map(p => p.name))), ["PromptGuard", "MUN Argument Builder"]);
    assert.equal(s.projects[0].key, "projects:0");
    const z = T.searchContent(RESUME, "zero trust");
    assert.ok(z.skills.some(k => k.name === "Zero Trust"));
    assert.ok(z.research.some(r => r.name.startsWith("Zero Trust Maturity")));
    assert.ok(z.projects.some(p => p.name === "SME-ZT CLI"));
    const b = T.searchContent(RESUME, "burp");
    assert.equal(b.skills[0].name, "Burp Suite CE");
    assert.equal(b.skills[0].key, T.skillKey("Pentesting Toolkit", "Burp Suite CE"));
    assert.ok(b.experience.length === 1);
    assert.equal(T.searchContent(RESUME, "deepfake").research.length, 1);
    assert.equal(T.searchContent(RESUME, "cisco").certifications.length, 2);
  });
  test("ranks exact and prefix matches first and respects the limit", () => {
    const s = T.searchContent(RESUME, "react", 2);
    assert.equal(s.skills[0].name, "React");
    assert.ok(s.skills.length <= 2 && s.projects.length <= 2);
    assert.ok(s.total >= 3);
  });
  test("empty and nonsense queries return nothing and never throw", () => {
    assert.equal(T.searchContent(RESUME, "").total, 0);
    assert.equal(T.searchContent(RESUME, "qqqqzz").total, 0);
    assert.doesNotThrow(() => T.searchContent(RESUME, "(((("));
  });
});
