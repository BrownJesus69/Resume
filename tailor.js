/* ════════════════════════════════════════════════════════════════════════
   tailor.js — role-tailoring engine for the résumé site
   ────────────────────────────────────────────────────────────────────────
   Pure functions, no DOM, no dependencies. Loaded by index.html as
   window.ResumeTailor and by the test-suite via require().

   Pipeline
     query ("Front End Developer", "sde", "ml", "quantum", …)
       └─ resolveRole()  → a role profile from RESUME.roleProfiles, or a
                           synthetic profile built from the domain lexicon,
                           or a plain keyword profile from the query words
       └─ tailor()       → every résumé item scored against the profile's
                           keyword set, then included / hidden / re-ordered,
                           with user overrides (add-back / hide) applied
       └─ buildDocument()→ a plain RESUME-shaped object holding only what was
                           selected, which the PDF writer and the page render

   Editing guide
     • Add a role:            RESUME.roleProfiles in index.html (data only)
     • Tune what "frontend"
       or "ml" means:         DOMAINS below (keywords + skill names)
   ════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ResumeTailor = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ── Domain lexicon ──────────────────────────────────────────────────
     terms    : words a user might type that mean this domain
     keywords : matched (word-prefix, case-insensitive) against item text
     skills   : skill names (exact, case-insensitive) that belong here
     groups   : whole skill groups that belong here                       */
  const DOMAINS = {
    software: {
      label: "Software engineering",
      terms: ["software", "developer", "engineer", "programmer", "sde", "swe", "coding", "development"],
      keywords: ["api", "backend", "frontend", "full-stack", "cli", "deploy", "postgresql", "typescript",
                 "python", "fastapi", "express", "react", "schema", "github", "render", "service",
                 "web app", "rest", "endpoint", "pipeline", "automation", "open-source", "correctness"],
      skills: ["Python", "C", "SQL", "Bash", "TypeScript", "HTML", "FastAPI", "Express", "React",
               "PostgreSQL", "MySQL", "JSONB", "MongoDB", "Git", "GitHub", "GitHub Actions"],
      groups: ["Tooling"]
    },
    frontend: {
      label: "Front-end",
      terms: ["frontend", "front-end", "front end", "ui", "ux", "web developer", "react developer", "web", "javascript developer"],
      keywords: ["react", "typescript", "frontend", "ui", "web app", "html", "css", "expo", "react native",
                 "javascript", "client", "custom domain", "deployed", "mobile", "user", "responsive"],
      skills: ["TypeScript", "HTML", "React", "React Native", "Expo", "Git", "GitHub"],
      groups: []
    },
    backend: {
      label: "Back-end",
      terms: ["backend", "back-end", "back end", "api developer", "server", "platform engineer"],
      keywords: ["api", "fastapi", "express", "postgresql", "sql", "schema", "bcnf", "jwt", "endpoint",
                 "rest", "zod", "backend", "openapi", "server", "neon", "database", "auth", "cors", "service"],
      skills: ["Python", "SQL", "TypeScript", "Bash", "FastAPI", "Express", "PostgreSQL", "MySQL", "JSONB",
               "MongoDB", "Git", "GitHub", "GitHub Actions"],
      groups: ["Data"]
    },
    security: {
      label: "Security",
      terms: ["security", "cybersecurity", "cyber", "infosec", "soc", "analyst", "zero trust", "appsec",
              "application security", "grc", "blue team", "defensive"],
      keywords: ["security", "cybersecurity", "zero-trust", "zero trust", "nist", "cisa", "threat", "vulnerab",
                 "pentest", "attack", "injection", "cve", "tls", "dns", "owasp", "idor", "auth", "intrusion",
                 "malware", "ddos", "dos", "deepfake", "risk", "maturity", "breach", "exposed", "audit",
                 "recon", "network", "wireshark", "nmap", "kali", "burp", "findings", "hacker", "trust"],
      skills: ["Python", "Bash", "SQL", "Zero Trust", "NIST SP 800-207", "CISA ZTMM v2", "OWASP Testing Guide v4",
               "IDOR & Auth-Bypass Testing", "Blind & Error-Based SQLi", "Wireshark", "nmap", "Kali Linux",
               "Burp Suite CE", "OWASP ZAP", "Git", "GitHub", "HexStrike AI"],
      groups: ["Security & Standards", "Pentesting Toolkit"]
    },
    pentest: {
      label: "Penetration testing",
      terms: ["pentest", "pentester", "penetration", "pen test", "offensive", "red team", "ethical hacker",
              "ethical hacking", "bug bounty", "vapt", "hacker"],
      keywords: ["pentest", "burp", "kali", "recon", "enumeration", "gobuster", "idor", "sqli", "owasp",
                 "endpoint", "cors", "jwt", "otp", "escalation", "findings", "exploit", "nmap", "nuclei",
                 "subfinder", "zap", "reverse-engineering", "hacker", "authenticated", "unauthenticated",
                 "vulnerab", "critical", "whois", "header", "open ports", "attack"],
      skills: ["Python", "Bash", "SQL", "Kali Linux", "HexStrike AI", "Hoppscotch"],
      groups: ["Pentesting Toolkit", "Security & Standards"]
    },
    ml: {
      label: "Machine learning",
      terms: ["machine learning", "ml", "ai engineer", "data scientist", "data science", "deep learning",
              "nlp", "artificial intelligence", "ai/ml", "applied scientist"],
      keywords: ["xgboost", "scikit", "random forest", "isolation forest", "transformer", "trained",
                 "dataset", "accuracy", "precision", "recall", "classifier", "model", "ml", "machine learning",
                 "federated", "adversarial", "llm", "prompt", "synthetic", "hugging face", "ollama",
                 "detection", "separability", "metrics", "graph neural"],
      skills: ["Python", "SQL", "Whisper", "Claude", "OpenRouter", "Git", "GitHub"],
      groups: ["Machine Learning"]
    },
    data: {
      label: "Data & databases",
      terms: ["data", "database", "dba", "sql developer", "analytics", "data engineer", "data analyst", "etl"],
      keywords: ["postgresql", "sql", "schema", "bcnf", "normalis", "database", "jsonb", "openpyxl",
                 "pipeline", "data", "excel", "rows", "column", "relational", "logging", "spreadsheet", "dbms"],
      skills: ["Python", "SQL", "Bash", "openpyxl", "Google Apps Script", "Git", "GitHub"],
      groups: ["Data"]
    },
    mobile: {
      label: "Mobile",
      terms: ["mobile", "android", "ios", "react native", "app developer", "mobile developer"],
      keywords: ["react native", "expo", "android", "mobile", "eas build", "wi-fi", "hotspot", "app",
                 "typescript", "device"],
      skills: ["TypeScript", "React Native", "Expo", "React", "Express", "Git", "GitHub"],
      groups: []
    },
    research: {
      label: "Research",
      terms: ["research", "researcher", "phd", "academic", "publication", "scientist", "research intern",
              "research assistant", "graduate"],
      keywords: ["research", "paper", "manuscript", "survey", "framework", "published", "latex",
                 "validated", "case stud", "co-author", "author", "standards", "study", "review",
                 "simulation", "baseline", "methodolog", "literature"],
      skills: ["Python", "LaTeX", "Typst", "Git", "GitHub"],
      groups: []
    },
    automation: {
      label: "Automation & DevOps",
      terms: ["devops", "automation", "sre", "platform", "ci/cd", "cloud", "infrastructure", "release engineer"],
      keywords: ["github actions", "deploy", "render", "ci", "automation", "apps script", "pipeline",
                 "typst", "cloudflare", "tls", "let's encrypt", "domain", "bash", "workflow", "bulk",
                 "eas build", "auto-deploy"],
      skills: ["Bash", "Git", "GitHub", "GitHub Actions", "n8n", "openpyxl", "Google Apps Script", "Typst"],
      groups: ["Automation & Reporting", "Tooling", "AI — Agentic / Automation"]
    },
    llm: {
      label: "LLM & AI applications",
      terms: ["llm", "ai", "genai", "generative", "prompt engineer", "agent", "agentic", "ai developer",
              "ai application", "chatbot"],
      keywords: ["llm", "prompt", "groq", "llama", "openrouter", "agent", "mcp", "ollama", "deepseek",
                 "claude", "chatgpt", "synthetic", "argument", "generat", "ai", "injection", "assistant"],
      skills: ["Python", "TypeScript", "FastAPI", "React", "Git", "GitHub"],
      groups: ["AI — LLM Assistants", "AI — Voice / Audio", "AI — Agentic / Automation",
               "AI — Security Research", "AI — Agent Frameworks"]
    }
  };

  /* ── helpers ───────────────────────────────────────────────────────── */
  const norm = (s) => String(s || "").toLowerCase()
    .replace(/[‐-―]/g, "-")           // fancy dashes → hyphen
    .replace(/[^a-z0-9+#./& -]/g, " ")          // strip punctuation we don't match on
    .replace(/\s+/g, " ").trim();

  const words = (s) => norm(s).replace(/[-/&.]/g, " ").split(" ").filter(Boolean);

  const STOP = new Set(["a", "an", "the", "of", "for", "and", "or", "in", "at", "to", "intern",
                        "internship", "role", "position", "job", "junior", "senior", "lead", "entry",
                        "level", "i", "ii", "iii", "trainee", "graduate", "new", "grad"]);

  /** does `text` contain `kw` as a word-prefix? ("vulnerab" hits "vulnerabilities") */
  function hasKeyword(text, kw) {
    kw = kw.toLowerCase();
    if (!kw) return false;
    const whole = kw.length <= 3;                 // short keywords ("ai", "ml", "dos") match whole words only
    let from = 0;
    while (true) {
      const i = text.indexOf(kw, from);
      if (i < 0) return false;
      const before = i === 0 ? " " : text[i - 1];
      const after  = text[i + kw.length] || " ";
      if (!/[a-z0-9]/.test(before) && (!whole || !/[a-z0-9]/.test(after))) return true;
      from = i + 1;
    }
  }

  /** Text bag for scoring one item. */
  function itemText(section, item) {
    if (item == null) return "";
    if (typeof item === "string") return item.toLowerCase();
    switch (section) {
      case "projects":
        return [item.name, item.tagline, ...(item.stack || []), ...(item.highlights || []),
                ...((item.metrics || []).map(m => m.label))].join(" \n ").toLowerCase();
      case "experience":
        return [item.role, item.org, ...(item.highlights || [])].join(" \n ").toLowerCase();
      case "research":
        return [item.title, item.role, item.note].join(" \n ").toLowerCase();
      case "certifications":
        return [item.name, item.issuer].join(" \n ").toLowerCase();
      case "leadership":
        return [item.role, item.org].join(" \n ").toLowerCase();
      case "awards":
        return [item.title, item.detail].join(" \n ").toLowerCase();
      default:
        return Object.values(item).filter(v => typeof v === "string").join(" \n ").toLowerCase();
    }
  }

  /** Score a text bag against weighted keyword lists. Distinct hits only. */
  function scoreText(text, weighted) {
    let score = 0;
    const hits = [];
    for (const [kw, w] of weighted) {
      if (hasKeyword(text, kw)) { score += w; hits.push(kw); }
    }
    return { score, hits };
  }

  /* ── role resolution ───────────────────────────────────────────────── */
  const titleCase = (s) => s.replace(/\b[a-z]/g, c => c.toUpperCase());

  function profileNames(p) {
    return [p.title, p.id, ...(p.aliases || [])].filter(Boolean).map(norm);
  }

  /**
   * Find which domains a free-text query refers to. Longest terms first so
   * "react native" wins over "react"; every match consumes its words.
   */
  function domainsForQuery(query) {
    const q = " " + norm(query).replace(/[-/]/g, " ") + " ";
    const found = [];
    const entries = Object.entries(DOMAINS)
      .flatMap(([id, d]) => d.terms.map(t => [id, " " + norm(t).replace(/[-/]/g, " ") + " "]))
      .sort((a, b) => b[1].length - a[1].length);
    let rest = q;
    for (const [id, term] of entries) {
      if (rest.includes(term)) {
        if (!found.includes(id)) found.push(id);
        rest = rest.split(term).join(" ");
      }
    }
    return found;
  }

  /**
   * Resolve a query to a profile.
   *   1. exact title / id / alias
   *   2. every query word appears in a title/alias (or an alias starts with the query)
   *   3. a synthetic profile from matched domains
   *   4. a plain keyword profile built from the query words
   * Returns null for an empty query (= full résumé).
   */
  function resolveRole(resume, query) {
    const profiles = (resume && resume.roleProfiles) || [];
    if (query && typeof query === "object" && query.id) {           // already a profile
      return profiles.find(p => p.id === query.id) || query;
    }
    const q = norm(query);
    if (!q) return null;

    const byId = profiles.find(p => p.id === q || p.id === q.replace(/ /g, "-"));
    if (byId) return byId;

    let exact = profiles.find(p => profileNames(p).includes(q));
    if (exact) return exact;

    const qw = words(q).filter(w => !STOP.has(w));
    if (qw.length) {
      const scored = profiles.map(p => {
        const names = profileNames(p);
        let best = 0;
        for (const n of names) {
          const nw = words(n);
          const all = qw.every(w => nw.includes(w));
          const starts = n.startsWith(q) || (n.length >= 4 && q.startsWith(n));
          const sub = n.includes(q);
          best = Math.max(best, all ? 3 : starts ? 2 : sub ? 1 : 0);
        }
        return [best, p];
      }).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]);
      if (scored.length && scored[0][0] >= 2) return scored[0][1];
      // "all words present" but the profile has extra words: still a decent match
      if (scored.length && scored[0][0] === 3) return scored[0][1];
    }

    const domains = domainsForQuery(q);
    const title = titleCase(q);
    if (domains.length) {
      return { id: "custom:" + q.replace(/ /g, "-"), title, synthetic: true,
               domains: domains.slice(0, 2), secondary: domains.slice(2), keywords: qw, query: q };
    }
    return { id: "custom:" + q.replace(/ /g, "-"), title, synthetic: true, adhoc: true,
             domains: [], secondary: [], keywords: qw, query: q };
  }

  /** Ranked suggestions for a combobox. Always returns profiles; never throws. */
  function searchRoles(resume, query) {
    const profiles = (resume && resume.roleProfiles) || [];
    const q = norm(query);
    if (!q) return profiles.map(p => ({ profile: p, score: 1 }));
    const qw = words(q).filter(w => !STOP.has(w));
    const doms = domainsForQuery(q);
    return profiles.map(p => {
      const names = profileNames(p);
      let s = 0;
      for (const n of names) {
        if (n === q) s = Math.max(s, 100);
        else if (n.startsWith(q)) s = Math.max(s, 60);
        else if (n.includes(q)) s = Math.max(s, 40);
        else {
          const nw = words(n);
          const hit = qw.filter(w => nw.some(x => x.startsWith(w))).length;
          if (hit && hit === qw.length) s = Math.max(s, 30 + hit);
          else if (hit) s = Math.max(s, 10 + hit);
        }
      }
      const pd = [...(p.domains || []), ...(p.secondary || [])];
      const dHit = doms.filter(d => pd.includes(d)).length;
      if (dHit) s = Math.max(s, 20 + dHit * 2);
      return { profile: p, score: s };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
  }

  /* ── keyword set for a profile ─────────────────────────────────────── */
  function weightedKeywords(profile) {
    const seen = new Map();
    const add = (kw, w) => { const k = kw.toLowerCase(); if (!seen.has(k) || seen.get(k) < w) seen.set(k, w); };
    (profile.keywords || []).forEach(k => add(k, 3));
    (profile.domains || []).forEach(d => (DOMAINS[d] ? DOMAINS[d].keywords : []).forEach(k => add(k, 2)));
    (profile.secondary || []).forEach(d => (DOMAINS[d] ? DOMAINS[d].keywords : []).forEach(k => add(k, 1)));
    return Array.from(seen.entries());
  }

  function domainSkillSet(profile) {
    const names = new Set(), groups = new Set(), names2 = new Set(), groups2 = new Set();
    for (const d of profile.domains || []) {
      const dom = DOMAINS[d]; if (!dom) continue;
      dom.skills.forEach(s => names.add(s.toLowerCase()));
      dom.groups.forEach(g => groups.add(g.toLowerCase()));
    }
    for (const d of profile.secondary || []) {
      const dom = DOMAINS[d]; if (!dom) continue;
      dom.skills.forEach(s => names2.add(s.toLowerCase()));
      dom.groups.forEach(g => groups2.add(g.toLowerCase()));
    }
    const sk = profile.skills || {};
    (sk.include || []).forEach(s => names.add(s.toLowerCase()));
    (sk.groups || []).forEach(g => groups.add(g.toLowerCase()));
    const exclude = new Set((sk.exclude || []).map(s => s.toLowerCase()));
    return { names, groups, names2, groups2, exclude };
  }

  /* ── overrides ─────────────────────────────────────────────────────── */
  const key = (section, idx) => section + ":" + idx;
  const skillKey = (group, name) => "skill:" + group + ":" + name;

  function normOverrides(o) {
    const toSet = (v) => v instanceof Set ? v : new Set(Array.isArray(v) ? v : []);
    return { include: toSet(o && o.include), exclude: toSet(o && o.exclude),
             fullHighlights: toSet(o && o.fullHighlights) };
  }

  /* ── main ──────────────────────────────────────────────────────────── */
  /* threshold = absolute floor; relative = fraction of the best-scoring item
     in the section an item must reach; min = top-up guarantee.            */
  const DEFAULT_RULES = {
    projects:       { threshold: 2, relative: 0.35, min: 2 },
    experience:     { threshold: 0, min: 0 },   // always kept (score orders highlights)
    research:       { threshold: 2, relative: 0.35, min: 0 },
    certifications: { threshold: 0, min: 0 },   // kept; ordered by score
    coursework:     { threshold: 0, min: 0 },
    interests:      { threshold: 1, min: 0, fallbackAll: true },
    leadership:     { threshold: 0, min: 0 },
    awards:         { threshold: 0, min: 0 }
  };

  /**
   * tailor(resume, query, overrides) → selection
   * query: null/"" for the full résumé, a string, or a profile object.
   */
  function tailor(resume, query, overrides) {
    const ov = normOverrides(overrides);
    const profile = resolveRole(resume, query);
    const full = !profile;
    const kws = full ? [] : weightedKeywords(profile);
    const rules = Object.assign({}, DEFAULT_RULES);
    if (profile && profile.rules) for (const k of Object.keys(profile.rules)) rules[k] = Object.assign({}, rules[k], profile.rules[k]);
    const hideSections = new Set((profile && profile.hide) || []);
    // A free-text query that matches no known role or domain: keep everything,
    // but surface the best matches first and tell the caller (sel.fallback).
    const lenient = !!(profile && profile.adhoc);

    const sections = {};
    const counts = {};
    const sectionList = ["projects", "experience", "research", "certifications", "leadership", "awards"];

    // ── list sections ──
    for (const sec of sectionList) {
      const items = resume[sec] || [];
      const rule = rules[sec] || { threshold: 0, min: 0 };
      const pinned = new Set(((profile && profile.pin && profile.pin[sec]) || []).map(norm));
      let entries = items.map((item, index) => {
        const { score, hits } = full ? { score: 0, hits: [] } : scoreText(itemText(sec, item), kws);
        const name = norm(item.name || item.title || item.role || "");
        const isPinned = pinned.has(name);
        return { section: sec, index, key: key(sec, index), item, score, pinned: isPinned, hits, auto: true, included: true };
      });
      if (!full) {
        const top = Math.max(0, ...entries.filter(e => !e.pinned).map(e => e.score));
        const cutoff = lenient ? 0 : Math.max(rule.threshold || 0, (rule.relative || 0) * top);
        const keepAll = !(rule.threshold > 0 || rule.relative > 0);   // sections that are never filtered, only re-ordered
        for (const e of entries) {
          e.cutoff = cutoff;
          e.auto = !hideSections.has(sec) && (lenient || keepAll || e.pinned || (e.score > 0 && e.score >= cutoff));
          e.included = e.auto;
        }
      }
      // minimum guarantee: top-up with best remaining
      if (!full && rule.min > 0 && !hideSections.has(sec)) {
        const have = entries.filter(e => e.auto).length;
        if (have < rule.min) {
          entries.filter(e => !e.auto).sort((a, b) => b.score - a.score || a.index - b.index)
            .slice(0, rule.min - have).forEach(e => { e.auto = true; e.included = true; e.toppedUp = true; });
        }
      }
      // overrides
      for (const e of entries) {
        if (ov.include.has(e.key)) e.included = true;
        if (ov.exclude.has(e.key)) e.included = false;
      }
      // highlight trimming
      const maxH = !full && profile.maxHighlights && profile.maxHighlights[sec];
      for (const e of entries) {
        const hl = e.item.highlights || null;
        e.highlights = hl;
        e.trimmed = 0;
        if (hl && maxH && hl.length > maxH && !ov.fullHighlights.has(e.key)) {
          const ranked = hl.map((h, i) => ({ h, i, s: scoreText(h.toLowerCase(), kws).score }))
            .sort((a, b) => b.s - a.s || a.i - b.i).slice(0, maxH).sort((a, b) => a.i - b.i);
          e.highlights = ranked.map(r => r.h);
          e.trimmed = hl.length - maxH;
        }
      }
      // order: full résumé keeps master order; tailored sorts by score (stable)
      if (!full && sec !== "leadership" && sec !== "awards") {
        entries = entries.slice().sort((a, b) => (b.included - a.included) || (b.pinned - a.pinned) || (b.score - a.score) || (a.index - b.index));
      }
      sections[sec] = entries;
      counts[sec] = { shown: entries.filter(e => e.included).length, total: entries.length };
    }

    // ── skills ──
    const ds = full ? null : domainSkillSet(profile);
    const stackWords = new Set();
    if (!full) {
      for (const sec of ["projects", "experience"]) {
        for (const e of sections[sec]) if (e.included) (e.item.stack || []).forEach(s => stackWords.add(s.toLowerCase()));
      }
    }
    const skills = (resume.skills || []).map(g => {
      const items = g.items.map(name => {
        const k = skillKey(g.group, name);
        const ln = name.toLowerCase();
        let auto = true, reason = "";
        if (!full) {
          if (ds.exclude.has(ln)) { auto = false; reason = "excluded for this role"; }
          else if (ds.names.has(ln)) { auto = true; reason = "core skill for this role"; }
          else if (ds.groups.has(g.group.toLowerCase())) { auto = true; reason = "group relevant to this role"; }
          else if (kws.some(([kw, w]) => w >= 2 && ln === kw)) { auto = true; reason = "matches a role keyword"; }
          else if (stackWords.has(ln) && (ds.names2.has(ln) || ds.groups2.has(g.group.toLowerCase()) || kws.some(([kw]) => ln === kw))) {
            auto = true; reason = "used in a selected project";
          }
          else if (lenient) { auto = true; reason = "kept (no role profile matched)"; }
          else { auto = false; reason = "not matched"; }
        }
        let included = auto;
        if (ov.include.has(k)) included = true;
        if (ov.exclude.has(k)) included = false;
        return { key: k, name, group: g.group, auto, included, reason };
      });
      return { group: g.group, items, shown: items.filter(i => i.included).length, total: items.length };
    });
    counts.skills = { shown: skills.reduce((n, g) => n + g.shown, 0), total: skills.reduce((n, g) => n + g.total, 0) };

    // ── education: coursework filtered, degree always shown ──
    const education = (resume.education || []).map((ed, index) => {
      const cw = ed.coursework || [];
      const items = cw.map((c, i) => {
        const k = key("coursework", index + "." + i);
        const s = full ? 0 : scoreText(c.toLowerCase(), kws).score;
        let included = full ? true : (rules.coursework.threshold ? s >= rules.coursework.threshold : true);
        if (ov.include.has(k)) included = true;
        if (ov.exclude.has(k)) included = false;
        return { key: k, name: c, score: s, included };
      });
      return { index, key: key("education", index), item: ed, coursework: items };
    });

    // ── interests ──
    const interestsAll = (resume.interests || []).map((name, index) => {
      const k = key("interests", index);
      const s = full ? 0 : scoreText(name.toLowerCase(), kws).score;
      return { key: k, name, index, score: s, auto: full ? true : s >= rules.interests.threshold };
    });
    if (!full && (lenient || (rules.interests.fallbackAll && !interestsAll.some(i => i.auto)))) interestsAll.forEach(i => { i.auto = true; });
    for (const i of interestsAll) { i.included = i.auto; if (ov.include.has(i.key)) i.included = true; if (ov.exclude.has(i.key)) i.included = false; }
    counts.interests = { shown: interestsAll.filter(i => i.included).length, total: interestsAll.length };

    const edits = { added: 0, removed: 0 };
    const allKeys = new Set([
      ...sectionList.flatMap(s => sections[s].map(e => e.key)),
      ...skills.flatMap(g => g.items.map(i => i.key)),
      ...education.flatMap(e => e.coursework.map(c => c.key)),
      ...interestsAll.map(i => i.key)
    ]);
    for (const k of ov.include) if (allKeys.has(k) && !ov.exclude.has(k)) edits.added++;
    for (const k of ov.exclude) if (allKeys.has(k)) edits.removed++;

    const role = full ? null : {
      id: profile.id, title: profile.title, synthetic: !!profile.synthetic, adhoc: !!profile.adhoc,
      headline: profile.headline || profile.title,
      summary: profile.summary || null,
      domains: profile.domains || [], secondary: profile.secondary || [],
      query: profile.query || null
    };
    // an ad-hoc query that matched nothing at all falls back to the full résumé content
    const fallback = lenient;

    return { full, role, fallback, profileKeywords: kws.map(([k]) => k), sections, skills, education, interests: interestsAll, counts, edits, overrides: ov };
  }

  /* ── document builder (RESUME-shaped, filtered) ─────────────────────── */
  function buildDocument(resume, sel) {
    const pick = (sec) => (sel.sections[sec] || []).filter(e => e.included).map(e => {
      const it = Object.assign({}, e.item);
      if (e.highlights) it.highlights = e.highlights.slice();
      return it;
    });
    const profile = Object.assign({}, resume.profile);
    if (sel.role) {
      profile.roles = [sel.role.headline];
      if (sel.role.summary) profile.summary = sel.role.summary;
      profile.tailoredFor = sel.role.title;
    }
    return {
      profile,
      contact: (resume.contact || []).slice(),
      aboutParagraphs: (sel.role && sel.role.summary) ? [sel.role.summary] : (resume.aboutParagraphs || []).slice(),
      skills: sel.skills.map(g => ({ group: g.group, items: g.items.filter(i => i.included).map(i => i.name) })).filter(g => g.items.length),
      projects: pick("projects"),
      experience: pick("experience"),
      research: pick("research"),
      leadership: pick("leadership"),
      awards: pick("awards"),
      education: sel.education.map(e => {
        const ed = Object.assign({}, e.item);
        const cw = e.coursework.filter(c => c.included).map(c => c.name);
        if (ed.coursework) ed.coursework = cw;
        return ed;
      }),
      certifications: pick("certifications"),
      interests: sel.interests.filter(i => i.included).map(i => i.name),
      site: resume.site || null
    };
  }

  /** Safe filename for a tailored PDF. */
  function pdfFilename(resume, sel) {
    const base = String(resume.profile.name).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const role = sel && sel.role ? "_" + String(sel.role.title).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") : "";
    return `${base}_Resume${role}.pdf`;
  }

  return { DOMAINS, resolveRole, searchRoles, domainsForQuery, tailor, buildDocument, pdfFilename,
           key, skillKey, hasKeyword, norm, words, itemText, scoreText, weightedKeywords };
});
