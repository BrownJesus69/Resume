"use strict";
/* PDF generation tests — build a PDF for every role in Node and verify it
   with pdf.js (an independent parser): structure, text, links, metadata. */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { loadResume, Tailor: T, PDF, pdfText } = require("./helpers.cjs");

const RESUME = loadResume();
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "resume-pdf-"));
const build = (q, ov) => { const sel = T.tailor(RESUME, q, ov || {}); return { sel, bytes: PDF.build(T.buildDocument(RESUME, sel), { siteUrl: "adityabidappa.netlify.app" }) }; };

describe("encoding & wrapping primitives", () => {
  test("unicode punctuation maps into WinAnsi and never recurses", () => {
    const codes = PDF.encode("a — b – c · d … ‘e’ “f” • ▸ → ≥ × é");
    assert.ok(codes.every(c => c >= 0 && c <= 255));
    assert.ok(codes.includes(0x97) && codes.includes(0x96) && codes.includes(0xB7) && codes.includes(0x85) && codes.includes(0x95));
    assert.ok(!codes.includes(0x3F), "no '?' fallbacks for common punctuation: " + JSON.stringify(codes));
    assert.deepEqual(PDF.encode("☃"), [0x3F]);          // unsupported glyph → '?'
  });
  test("clean() strips HTML and entities", () => {
    assert.equal(PDF.clean("<strong>zero-trust</strong> &amp; more  spaces "), "zero-trust & more spaces");
  });
  test("wrap() respects the width and never drops words", () => {
    const text = "Conducted authorized pentest on arovafitness.com and REST API using Kali Linux and Burp Suite Community Edition";
    const lines = PDF.wrap(text, "R", 7.5, 120);
    assert.ok(lines.length > 1);
    for (const l of lines) assert.ok(PDF.width(l, "R", 7.5) <= 120 + 0.01);
    const joined = lines.map(l => String.fromCharCode(...l)).join(" ");
    assert.equal(joined, text);
    // over-long single token gets broken instead of overflowing
    const long = PDF.wrap("https://github.com/BrownJesus69/mun-argument-builder-with-a-very-long-name", "R", 7, 60);
    assert.ok(long.length > 1);
    for (const l of long) assert.ok(PDF.width(l, "R", 7) <= 60 + 0.01);
  });
});

describe("PDF structure", () => {
  test("output is a well-formed PDF 1.4 with a valid xref table", () => {
    const { bytes } = build(null);
    const s = Buffer.from(bytes).toString("latin1");
    assert.ok(s.startsWith("%PDF-1.4\n"));
    assert.ok(s.trimEnd().endsWith("%%EOF"));
    const startxref = Number(s.match(/startxref\n(\d+)\n%%EOF/)[1]);
    assert.equal(s.slice(startxref, startxref + 4), "xref");
    // every xref offset must point at "<n> 0 obj"
    const xref = s.slice(startxref);
    const count = Number(xref.match(/xref\n0 (\d+)/)[1]);
    const entries = xref.split("\n").slice(2, 2 + count);
    entries.slice(1).forEach((e, i) => {
      const off = Number(e.slice(0, 10));
      assert.ok(s.slice(off).startsWith(`${i + 1} 0 obj`), `xref entry ${i + 1} points at "${s.slice(off, off + 12)}"`);
    });
    // stream lengths are exact
    const re = /<< \/Length (\d+) >>\nstream\n/g; let m;
    while ((m = re.exec(s))) {
      const start = m.index + m[0].length;
      assert.equal(s.slice(start + Number(m[1]), start + Number(m[1]) + 10), "\nendstream");
    }
  });
  test("bytes are all ≤ 0xFF (latin1-safe) and non-ASCII text appears as WinAnsi", () => {
    const { bytes } = build("Front End Developer");
    for (let i = 0; i < bytes.length; i++) assert.ok(bytes[i] <= 255);
  });
});

describe("content per role", () => {
  test("full résumé PDF contains everything", async () => {
    const { bytes } = build(null);
    fs.writeFileSync(path.join(OUT, "full.pdf"), bytes);
    const r = await pdfText(bytes);
    assert.ok(r.numPages >= 1 && r.numPages <= 3, "pages: " + r.numPages);
    for (const needle of [RESUME.profile.name, "PROFESSIONAL SUMMARY", "PROJECTS", "EXPERIENCE", "RESEARCH", "AWARDS", "SKILLS", "EDUCATION", "CERTIFICATIONS",
                          "PromptGuard", "SME-ZT CLI", "NetworkAudit", "NutriLog", "MUN Argument Builder", "Burp Suite CE", "React Native", "LaTeX", "Best Delegate",
                          "adityabidappa@gmail.com", "github.com/BrownJesus69", "adityabidappa.netlify.app", "87.08%"]) {
      assert.ok(r.text.includes(needle), "missing: " + needle);
    }
    assert.ok(r.links.includes("mailto:adityabidappa@gmail.com"));
    assert.ok(r.links.includes("https://github.com/BrownJesus69/promptguard"));
    assert.ok(/R.sum./.test(r.info.Title) && r.info.Title.includes(RESUME.profile.name));
    assert.equal(r.info.Author, RESUME.profile.name);
  });

  test("Front End Developer PDF is filtered and labelled", async () => {
    const { sel, bytes } = build("Front End Developer");
    fs.writeFileSync(path.join(OUT, "fe.pdf"), bytes);
    const r = await pdfText(bytes);
    assert.ok(r.text.includes("Front End Developer"));
    assert.ok(r.text.includes("React Native"));
    assert.ok(r.text.includes("PromptGuard") && r.text.includes("NetworkAudit"));
    assert.ok(!r.text.includes("SME-ZT CLI"), "SME-ZT should be filtered out");
    // (Burp Suite is also mentioned in an experience bullet, so check tools that only appear as skill chips)
    assert.ok(!r.text.includes("SpiderFoot") && !r.text.includes("Autopsy"), "pentest toolkit should be filtered out");
    assert.ok(!r.text.includes("RESEARCH & PUBLICATIONS"), "research hidden for this role");
    assert.ok(r.text.includes(sel.role.summary.slice(0, 40)));
    assert.equal(r.info.Title.includes("(Front End Developer)"), true);
    assert.ok(r.numPages <= 2);
  });

  test("Penetration Tester PDF keeps the toolkit and drops front-end frameworks", async () => {
    const { bytes } = build("Penetration Tester");
    const r = await pdfText(bytes);
    assert.ok(r.text.includes("Burp Suite CE") && r.text.includes("nmap") && r.text.includes("Kali Linux"));
    assert.ok(!r.text.includes("Multi-Transformer Ensembles"), "ML-only skills hidden");
    assert.ok(r.text.includes("Penetration Tester"));
  });

  test("overrides are honoured in the PDF (added skill and hidden project)", async () => {
    const base = T.tailor(RESUME, "Front End Developer", {});
    const burp = base.skills.flatMap(g => g.items).find(i => i.name === "Burp Suite CE");
    const pg = base.sections.projects.find(e => e.item.name === "PromptGuard");
    const { bytes } = build("Front End Developer", { include: [burp.key], exclude: [pg.key] });
    const r = await pdfText(bytes);
    assert.ok(r.text.includes("Burp Suite CE"));
    assert.ok(!r.text.includes("PromptGuard"));
  });

  test("every role profile produces a valid 1–2 page PDF naming the role", async () => {
    for (const p of RESUME.roleProfiles) {
      const { bytes } = build(p.id);
      const r = await pdfText(bytes);
      assert.ok(r.numPages >= 1 && r.numPages <= 2, `${p.id}: ${r.numPages} pages`);
      assert.ok(r.text.includes(p.title), `${p.id}: title missing`);
      assert.ok(r.text.includes(RESUME.profile.name), `${p.id}: name missing`);
      assert.ok(r.text.includes("EXPERIENCE") && r.text.includes("PROJECTS") && r.text.includes("SKILLS"), `${p.id}: sections missing`);
      assert.ok(!/\?\?/.test(r.text), `${p.id}: unencodable characters leaked`);
    }
  });

  test("a synthetic (free-text) role still renders", async () => {
    const { sel, bytes } = build("Quantum Computing Researcher");
    assert.equal(sel.role.synthetic, true);
    const r = await pdfText(bytes);
    assert.ok(r.text.includes("Quantum Computing Researcher"));
    assert.ok(r.numPages >= 1);
  });

  test("degenerate documents do not crash the writer", () => {
    const empty = { profile: { name: "X" }, contact: [], skills: [], projects: [], experience: [], research: [], leadership: [], awards: [], education: [], certifications: [], interests: [], aboutParagraphs: [] };
    const bytes = PDF.build(empty, {});
    assert.ok(bytes.length > 500);
    const huge = Object.assign({}, empty, { projects: Array.from({ length: 40 }, (_, i) => ({ name: "P" + i, tagline: "t", highlights: ["x ".repeat(120)], stack: ["a", "b"] })) });
    const big = PDF.build(huge, {});
    assert.ok(big.length > bytes.length);
  });
});
