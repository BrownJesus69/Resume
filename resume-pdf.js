/* ════════════════════════════════════════════════════════════════════════
   resume-pdf.js — dependency-free PDF writer for tailored résumés
   ────────────────────────────────────────────────────────────────────────
   Generates an ATS-safe PDF entirely in the browser (or in Node for tests)
   from a RESUME-shaped document (see tailor.js → buildDocument). Uses the
   PDF core-14 Helvetica fonts, so nothing has to be embedded and every
   parser can read the text. Layout deliberately mirrors pdf-pipeline/
   resume.typ (the master PDF built by CI): blue rules, green skill chips,
   amber metric strip, tinted left column.

   API
     ResumePDF.build(doc, opts) → Uint8Array          opts.siteUrl (string)
     ResumePDF.download(doc, filename, opts)          browser only
   ════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ResumePDF = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ── Helvetica AFM widths, WinAnsi codes 32..255 (index = code − 32) ── */
  const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,0,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,500,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
  const W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,0,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,556,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];
  const W_OBL = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,0,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,500,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
  const W_BOLDOBL = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,0,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,556,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];

  const FONTS = { R: ["Helvetica", W_REG], B: ["Helvetica-Bold", W_BOLD], I: ["Helvetica-Oblique", W_OBL], BI: ["Helvetica-BoldOblique", W_BOLDOBL] };
  const FONT_RES = { R: "F1", B: "F2", I: "F3", BI: "F4" };

  /* ── text encoding: unicode → WinAnsi byte string ───────────────────── */
  const HI = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
               0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91,
               0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98,
               0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
  const SUBST = { "▸": "•", "►": "•", "∙": "•", "→": "-", "←": "-",
                  "−": "-", "≥": ">=", "≤": "<=", "✓": "", "✔": "", " ": " ", " ": " ",
                  " ": " ", "‑": "-", "‐": "-", "′": "'", "″": '"', "≤": "<=", "×": "x" };

  const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
  function clean(s) {
    return String(s == null ? "" : s)
      .replace(/<[^>]+>/g, "")
      .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, m => ENTITIES[m])
      .replace(/\s+/g, " ").trim();
  }
  /** unicode string → array of WinAnsi byte codes */
  function encodeChar(cp) {
    if (cp < 0x80) return cp;
    if (cp >= 0xA0 && cp <= 0xFF) return cp;
    if (HI[cp]) return HI[cp];
    return 0x3F; // "?"
  }
  function encode(s) {
    const out = [];
    for (const ch of String(s)) {
      const sub = SUBST[ch];
      if (sub !== undefined) { for (const c of sub) out.push(encodeChar(c.codePointAt(0))); continue; }
      out.push(encodeChar(ch.codePointAt(0)));
    }
    return out;
  }
  function width(codes, font, size) {
    const tbl = FONTS[font][1];
    let w = 0;
    for (const c of codes) w += c >= 32 ? (tbl[c - 32] || 556) : 0;
    return w / 1000 * size;
  }
  function literal(codes) {
    let s = "(";
    for (const c of codes) {
      if (c === 0x5C) s += "\\\\";
      else if (c === 0x28) s += "\\(";
      else if (c === 0x29) s += "\\)";
      else if (c === 0x0D) s += "\\r";
      else if (c === 0x0A) s += "\\n";
      else s += String.fromCharCode(c);
    }
    return s + ")";
  }
  const f2 = (n) => (Math.round(n * 100) / 100).toString();

  /** greedy word-wrap; returns arrays of byte codes per line */
  function wrap(text, font, size, maxW) {
    const wordsArr = clean(text).split(" ").filter(Boolean);
    const lines = [];
    let line = [], lineW = 0;
    const sp = width([32], font, size);
    for (const w of wordsArr) {
      let codes = encode(w);
      let ww = width(codes, font, size);
      if (ww > maxW) {                       // break an over-long token character by character
        if (line.length) { lines.push(line); line = []; lineW = 0; }
        let chunk = [];
        for (const c of codes) {
          if (width(chunk.concat([c]), font, size) > maxW && chunk.length) { lines.push(chunk); chunk = []; }
          chunk.push(c);
        }
        codes = chunk; ww = width(codes, font, size);
      }
      if (line.length && lineW + sp + ww > maxW) { lines.push(line); line = []; lineW = 0; }
      if (line.length) { line.push(32); lineW += sp; }
      line.push(...codes); lineW += ww;
    }
    if (line.length) lines.push(line);
    return lines;
  }

  /* ── colours (match resume.typ) ─────────────────────────────────────── */
  const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const C = {
    blue: hex("#1d4ed8"), green: hex("#15803d"), chipBg: hex("#f0fdf4"), amber: hex("#92400e"), amberBg: hex("#fffbeb"),
    body: hex("#1e293b"), muted: hex("#64748b"), leftBg: hex("#f8fafc"), white: [1, 1, 1]
  };
  const rgb = (c) => c.map(f2).join(" ");

  /* ── page geometry (A4, margins as in resume.typ) ───────────────────── */
  const PAGE_W = 595.28, PAGE_H = 841.89;
  const M = { top: 31.2, bottom: 31.2, left: 42.5, right: 42.5 };
  const CONTENT_W = PAGE_W - M.left - M.right;
  const GUTTER = 14;
  const LEFT_W = (CONTENT_W - GUTTER) / 3;
  const RIGHT_W = CONTENT_W - GUTTER - LEFT_W;
  const LEFT_INSET = 8;

  /* ── low-level document ─────────────────────────────────────────────── */
  class Doc {
    constructor() { this.pages = []; }
    page(i) {
      while (this.pages.length <= i) this.pages.push({ bg: [], ops: [], links: [] });
      return this.pages[i];
    }
    // top-down y → PDF y
    Y(y) { return PAGE_H - y; }
    text(p, x, yTop, codes, font, size, color) {
      const base = this.Y(yTop + size * 0.76);
      this.page(p).ops.push(`BT /${FONT_RES[font]} ${f2(size)} Tf ${rgb(color)} rg 1 0 0 1 ${f2(x)} ${f2(base)} Tm ${literal(codes)} Tj ET`);
    }
    rect(p, x, yTop, w, h, fill, layer) {
      (layer === "bg" ? this.page(p).bg : this.page(p).ops).push(`${rgb(fill)} rg ${f2(x)} ${f2(this.Y(yTop + h))} ${f2(w)} ${f2(h)} re f`);
    }
    line(p, x1, y1, x2, y2, color, lw) {
      this.page(p).ops.push(`${rgb(color)} RG ${f2(lw)} w ${f2(x1)} ${f2(this.Y(y1))} m ${f2(x2)} ${f2(this.Y(y2))} l S`);
    }
    roundRect(p, x, yTop, w, h, r, fill, stroke, lw) {
      const y0 = this.Y(yTop + h), y1 = this.Y(yTop), k = 0.5523 * r;
      const path = [
        `${f2(x + r)} ${f2(y0)} m`,
        `${f2(x + w - r)} ${f2(y0)} l`,
        `${f2(x + w - r + k)} ${f2(y0)} ${f2(x + w)} ${f2(y0 + r - k)} ${f2(x + w)} ${f2(y0 + r)} c`,
        `${f2(x + w)} ${f2(y1 - r)} l`,
        `${f2(x + w)} ${f2(y1 - r + k)} ${f2(x + w - r + k)} ${f2(y1)} ${f2(x + w - r)} ${f2(y1)} c`,
        `${f2(x + r)} ${f2(y1)} l`,
        `${f2(x + r - k)} ${f2(y1)} ${f2(x)} ${f2(y1 - r + k)} ${f2(x)} ${f2(y1 - r)} c`,
        `${f2(x)} ${f2(y0 + r)} l`,
        `${f2(x)} ${f2(y0 + r - k)} ${f2(x + r - k)} ${f2(y0)} ${f2(x + r)} ${f2(y0)} c`,
        "h"
      ].join(" ");
      this.page(p).ops.push(`${rgb(fill)} rg ${rgb(stroke)} RG ${f2(lw)} w ${path} B`);
    }
    link(p, x, yTop, w, h, uri) {
      this.page(p).links.push({ rect: [x, this.Y(yTop + h), x + w, this.Y(yTop)], uri });
    }
    /** serialise → Uint8Array */
    bytes(meta) {
      const objs = [];
      const add = (body) => { objs.push(body); return objs.length; };
      const catalog = add(null), pagesObj = add(null);
      const fontIds = {};
      for (const k of Object.keys(FONTS)) {
        fontIds[k] = add(`<< /Type /Font /Subtype /Type1 /BaseFont /${FONTS[k][0]} /Encoding /WinAnsiEncoding >>`);
      }
      const info = add(`<< /Title ${literal(encode(meta.title || "Resume"))} /Author ${literal(encode(meta.author || ""))} /Producer (resume-pdf.js) /Creator (adityabidappa.netlify.app) >>`);
      const pageIds = [];
      for (const pg of this.pages) {
        const content = [...pg.bg, ...pg.ops].join("\n");
        const cid = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
        const annots = pg.links.map(l => add(`<< /Type /Annot /Subtype /Link /Rect [${l.rect.map(f2).join(" ")}] /Border [0 0 0] /A << /S /URI /URI ${literal(encode(l.uri))} >> >>`));
        const fonts = Object.keys(FONTS).map(k => `/${FONT_RES[k]} ${fontIds[k]} 0 R`).join(" ");
        pageIds.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${f2(PAGE_W)} ${f2(PAGE_H)}] /Resources << /Font << ${fonts} >> >> /Contents ${cid} 0 R${annots.length ? " /Annots [" + annots.map(a => a + " 0 R").join(" ") + "]" : ""} >>`));
      }
      objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
      objs[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map(i => i + " 0 R").join(" ")}] /Count ${pageIds.length} >>`;

      let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
      const offsets = [];
      objs.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
      const xref = out.length;
      out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
      for (const o of offsets) out += String(o).padStart(10, "0") + " 00000 n \n";
      out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
      const bytes = new Uint8Array(out.length);
      for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xFF;
      return bytes;
    }
  }

  /* ── column flow ─────────────────────────────────────────────────────
     A Flow owns an x/width and a cursor (page, y). It draws top-down and
     starts a new page when a block would cross the bottom margin.
     `dry` flows measure without drawing (used for keep-together blocks). */
  class Flow {
    constructor(doc, x, w, opts) {
      this.doc = doc; this.x = x; this.w = w;
      this.top = opts.top; this.bottom = opts.bottom; this.firstTop = opts.firstTop != null ? opts.firstTop : opts.top;
      this.page = 0; this.y = this.firstTop; this.dry = !!opts.dry; this.onNewPage = opts.onNewPage || null;
      this.used = 0; this.pendingSection = null;
    }
    remaining() { return this.dry ? Infinity : this.bottom - this.y; }
    newPage() { this.page++; this.y = this.top; if (this.onNewPage) this.onNewPage(this.page); }
    ensure(h) { if (!this.dry && this.y + h > this.bottom && this.y > this.top) this.newPage(); }
    advance(h) { this.y += h; this.used += h; }
    gap(h) { if (this.dry || this.y > this.top) this.advance(h); }
    measure(fn) {
      const d = new Flow(this.doc, this.x, this.w, { top: 0, bottom: Infinity, dry: true });
      fn(d); return d.used;
    }
    /** keep-together: measure, ensure, then draw. A pending section heading
        is drawn inside the same block so it can never be orphaned. */
    block(fn) {
      const pend = this.pendingSection; this.pendingSection = null;
      const draw = (f) => { if (pend) f.heading(pend); fn(f); };
      const h = this.measure(draw); this.ensure(h); draw(this);
    }
    flush() { if (this.pendingSection) { const t = this.pendingSection; this.pendingSection = null; this.heading(t); } }
    heading(title) {
      this.gap(6);
      this.text(title.toUpperCase(), { font: "B", size: 7.5, color: C.blue, lead: 9.5, noFlush: true });
      this.rule(C.blue, 1);
      this.advance(3);
    }

    /** wrapped paragraph; returns height */
    text(str, o) {
      if (!o.noFlush) this.flush();
      const font = o.font || "R", size = o.size || 7.5, lead = o.lead || size * 1.32;
      const color = o.color || C.body, indent = o.indent || 0, hang = o.hang || 0;
      const lines = wrap(str, font, size, this.w - indent - (o.rightPad || 0));
      lines.forEach((codes, i) => {
        this.ensure(lead);
        if (!this.dry) {
          let x = this.x + indent + (i > 0 ? hang : 0);
          if (o.align === "center") x = this.x + (this.w - width(codes, font, size)) / 2;
          else if (o.align === "right") x = this.x + this.w - width(codes, font, size);
          this.doc.text(this.page, x, this.y, codes, font, size, color);
          if (o.link) this.doc.link(this.page, x, this.y, width(codes, font, size), lead, o.link);
        }
        this.advance(lead);
      });
      return lines.length * lead;
    }
    /** several runs on one line, e.g. bold value + muted label; no wrapping */
    runs(parts, o) {
      this.flush();
      const lead = o.lead || 10;
      this.ensure(lead);
      let x = this.x + (o.indent || 0);
      for (const r of parts) {
        const codes = encode(String(r.text == null ? "" : r.text).replace(/<[^>]+>/g, "").replace(/\s+/g, " "));
        if (!this.dry) this.doc.text(this.page, x, this.y, codes, r.font || "R", r.size || 7, r.color || C.body);
        x += width(codes, r.font || "R", r.size || 7);
      }
      this.advance(lead);
      return x - this.x;
    }
    rule(color, lw) { this.ensure(lw + 1); if (!this.dry) this.doc.line(this.page, this.x, this.y + lw / 2, this.x + this.w, this.y + lw / 2, color, lw); this.advance(lw + 1); }

    section(title) { this.flush(); this.pendingSection = title; }

    /** inline-wrapping chips (rounded pills) */
    chips(items, o) {
      this.flush();
      const size = o.size || 7, padX = 3.5, padY = 1.8, gapX = 2.5, gapY = 2.5;
      const h = size + padY * 2;
      let x = this.x, rowUsed = false;
      const place = () => { this.ensure(h); rowUsed = true; };
      for (const it of items) {
        const codes = encode(clean(it));
        const w = width(codes, o.font || "R", size) + padX * 2;
        if (rowUsed && x + w > this.x + this.w + 0.01) { this.advance(h + gapY); x = this.x; rowUsed = false; }
        place();
        if (!this.dry) {
          this.doc.roundRect(this.page, x, this.y, Math.min(w, this.w), h, 2.5, o.fill || C.chipBg, o.stroke || C.green, 0.5);
          this.doc.text(this.page, x + padX, this.y + padY, codes, o.font || "R", size, o.color || C.green);
        }
        x += w + gapX;
      }
      if (rowUsed) this.advance(h);
    }
    bullets(items, o) {
      this.flush();
      const size = o.size || 7.5, lead = size * 1.3;
      for (const it of items) {
        const lines = wrap(it, "R", size, this.w - 9);
        this.ensure(Math.min(lines.length, 2) * lead);   // never orphan the bullet glyph
        lines.forEach((codes, i) => {
          this.ensure(lead);
          if (!this.dry) {
            if (i === 0) this.doc.text(this.page, this.x, this.y, encode("•"), "R", size, C.blue);
            this.doc.text(this.page, this.x + 9, this.y, codes, "R", size, o.color || C.body);
          }
          this.advance(lead);
        });
        this.advance(1.2);
      }
    }
  }

  /* ── contact helpers ─────────────────────────────────────────────────── */
  function contactDisplay(c) {
    if (c.icon === "github") return "github.com/" + c.value;
    if (c.icon === "linkedin") return "linkedin.com/in/" + c.value;
    return c.value;
  }

  /* ── the résumé layout ──────────────────────────────────────────────── */
  function build(docData, opts) {
    opts = opts || {};
    const site = opts.siteUrl || (docData.site && docData.site.url) || "adityabidappa.netlify.app";
    const P = docData.profile || {};
    const doc = new Doc();

    // ── header (full width, page 0) ──
    const head = new Flow(doc, M.left, CONTENT_W, { top: M.top, bottom: PAGE_H - M.bottom });
    head.text(P.name || "", { font: "B", size: 19, color: C.blue, align: "center", lead: 22 });
    head.advance(1);
    const rolesLine = (P.roles || []).map(clean).filter(Boolean).join("  ·  ");
    if (rolesLine) head.text(rolesLine, { font: "I", size: 7, color: C.muted, align: "center", lead: 9 });
    const parts = (docData.contact || []).map(contactDisplay).concat([site]);
    head.text(parts.join("   |   "), { size: 7.5, color: C.muted, align: "center", lead: 9.5 });
    if (P.tagline) head.text(P.tagline, { size: 7, color: C.muted, align: "center", lead: 9 });
    head.advance(3);
    head.rule(C.blue, 1.5);
    head.advance(4);
    const bodyTop = head.y;

    // ── two columns ──
    const leftBg = (page) => doc.rect(page, M.left, page === 0 ? bodyTop : M.top, LEFT_W, (PAGE_H - M.bottom) - (page === 0 ? bodyTop : M.top), C.leftBg, "bg");
    leftBg(0);
    const drawnBg = new Set([0]);
    const onNewPage = (pg) => { if (!drawnBg.has(pg)) { drawnBg.add(pg); leftBg(pg); } };

    const L = new Flow(doc, M.left + LEFT_INSET, LEFT_W - LEFT_INSET * 2, { top: M.top + LEFT_INSET, bottom: PAGE_H - M.bottom - LEFT_INSET, firstTop: bodyTop + LEFT_INSET, onNewPage });
    const R = new Flow(doc, M.left + LEFT_W + GUTTER, RIGHT_W, { top: M.top, bottom: PAGE_H - M.bottom, firstTop: bodyTop, onNewPage });

    // ── LEFT: contact ──
    L.section("Contact");
    for (const c of docData.contact || []) {
      L.text(contactDisplay(c), { size: 7, color: C.muted, lead: 9, link: c.href });
    }
    L.text(site, { size: 7, color: C.muted, lead: 9, link: /^https?:/.test(site) ? site : "https://" + site });

    // ── LEFT: skills ──
    const skills = (docData.skills || []).filter(g => g.items && g.items.length);
    if (skills.length) {
      L.section("Skills");
      for (const g of skills) {
        L.block(f => {
          f.text(g.group.toUpperCase(), { font: "B", size: 6.5, color: C.muted, lead: 8.5 });
          f.advance(1.5);
          f.chips(g.items, {});
          f.advance(4);
        });
      }
    }

    // ── LEFT: education ──
    if ((docData.education || []).length) {
      L.section("Education");
      for (const ed of docData.education) {
        L.block(f => {
          f.text(ed.degree, { font: "B", size: 7.5, lead: 9.5 });
          f.text(ed.org, { size: 7, color: C.muted, lead: 9 });
          f.text(ed.period, { size: 6.5, color: C.muted, lead: 8.5 });
          if (ed.cgpa) f.text(ed.cgpa, { size: 7, color: C.blue, lead: 9 });
          if (ed.coursework && ed.coursework.length) { f.advance(1.5); f.text("Coursework: " + ed.coursework.join(", "), { size: 6.5, color: C.muted, lead: 8.5 }); }
          f.advance(4);
        });
      }
    }

    // ── LEFT: certifications ──
    if ((docData.certifications || []).length) {
      L.section("Certifications");
      for (const c of docData.certifications) {
        L.block(f => {
          f.text(c.name, { font: "B", size: 7.5, lead: 9.5 });
          f.text([c.issuer, c.date].filter(Boolean).join("  ·  "), { size: 6.5, color: C.muted, lead: 8.5 });
          f.advance(3);
        });
      }
    }

    // ── LEFT: roles & activities ──
    if ((docData.leadership || []).length) {
      L.section("Roles & Activities");
      for (const it of docData.leadership) {
        L.block(f => {
          f.text(it.role, { font: "B", size: 7.5, lead: 9.5 });
          f.text(it.org, { size: 6.5, color: C.muted, lead: 8.5 });
          f.advance(2.5);
        });
      }
    }

    // ── LEFT: interests ──
    if ((docData.interests || []).length) {
      L.section("Interests");
      L.text(docData.interests.join("  ·  "), { size: 6.5, color: C.muted, lead: 8.5 });
    }

    // ── RIGHT: summary ──
    const paras = (docData.aboutParagraphs || []).map(clean).filter(Boolean);
    if (paras.length) {
      R.section("Professional Summary");
      for (const p of paras) { R.text(p, { size: 7.5, lead: 10 }); R.advance(2.5); }
    }

    // ── RIGHT: projects ──
    if ((docData.projects || []).length) {
      R.section("Projects");
      for (const pr of docData.projects) {
        R.block(f => {
          const stack = (pr.stack || []).join(" · ");
          const stackCodes = encode(clean(stack));
          const stackW = stack ? Math.min(width(stackCodes, "R", 6.5), f.w * 0.45) : 0;
          // title row: name (+LIVE) on the left, stack right-aligned
          const nameCodes = encode(clean(pr.name));
          f.ensure(10);
          if (!f.dry) {
            f.doc.text(f.page, f.x, f.y, nameCodes, "B", 8, C.body);
            if (pr.status && pr.status.live) {
              const lx = f.x + width(nameCodes, "B", 8) + 4;
              const lc = encode("LIVE");
              f.doc.roundRect(f.page, lx, f.y + 0.5, width(lc, "B", 6.5) + 6, 8.5, 2.5, C.chipBg, C.green, 0.5);
              f.doc.text(f.page, lx + 3, f.y + 1.2, lc, "B", 6.5, C.green);
            }
          }
          f.advance(10);
          if (stack) {
            // draw the stack line right-aligned on the title row (one line, truncated with an ellipsis if needed)
            let codes = stackCodes;
            while (width(codes, "R", 6.5) > f.w * 0.45 && codes.length > 4) codes = codes.slice(0, -4).concat([0x85]);
            if (!f.dry) f.doc.text(f.page, f.x + f.w - width(codes, "R", 6.5), f.y - 10, codes, "R", 6.5, C.muted);
          }
          if (pr.tagline) f.text(pr.tagline, { size: 7, color: C.muted, lead: 9, rightPad: stackW ? stackW + 8 : 0 });
          f.advance(1.5);
          if (pr.highlights && pr.highlights.length) f.bullets(pr.highlights, {});
          if (pr.metrics && pr.metrics.length) {
            const runs = [];
            pr.metrics.forEach((m, i) => {
              runs.push({ text: m.value, font: "B", size: 7.5, color: C.amber });
              runs.push({ text: " " + m.label + (i < pr.metrics.length - 1 ? "     " : ""), size: 7, color: C.muted });
            });
            let tw = 0; for (const r of runs) tw += width(encode(clean(r.text)), r.font || "R", r.size);
            f.ensure(12.5);
            if (!f.dry) f.doc.roundRect(f.page, f.x, f.y, Math.min(tw + 8, f.w), 12.5, 2.5, C.amberBg, C.amber, 0.5);
            f.advance(2.4);
            f.runs(runs, { lead: 10.1, indent: 4 });
            f.advance(1.5);
          }
          if (pr.links && pr.links.length) {
            f.ensure(8.5);
            let x = f.x;
            for (const l of pr.links) {
              const codes = encode(clean(l.href));
              const w = width(codes, "R", 6.5);
              if (x + w > f.x + f.w && x > f.x) { f.advance(8.5); x = f.x; f.ensure(8.5); }
              if (!f.dry) { f.doc.text(f.page, x, f.y, codes, "R", 6.5, C.muted); f.doc.link(f.page, x, f.y, w, 8.5, l.href); }
              x += w + 9;
            }
            f.advance(8.5);
          }
          f.advance(5);
        });
      }
    }

    // ── RIGHT: experience ──
    if ((docData.experience || []).length) {
      R.section("Experience");
      for (const ex of docData.experience) {
        R.block(f => {
          const period = ex.current ? `${ex.start} — Present` : `${ex.start} — ${ex.end}`;
          const pc = encode(clean(period));
          f.ensure(10);
          if (!f.dry) {
            f.doc.text(f.page, f.x, f.y, encode(clean(ex.role)), "B", 8, C.body);
            f.doc.text(f.page, f.x + f.w - width(pc, "R", 7), f.y + 0.6, pc, "R", 7, ex.current ? C.blue : C.muted);
          }
          f.advance(10);
          f.text(ex.org, { size: 7, color: C.muted, lead: 9, rightPad: width(pc, "R", 7) + 8 });
          f.advance(1.5);
          if (ex.highlights && ex.highlights.length) f.bullets(ex.highlights, {});
          f.advance(5);
        });
      }
    }

    // ── RIGHT: research ──
    if ((docData.research || []).length) {
      R.section("Research & Publications");
      for (const paper of docData.research) {
        R.block(f => {
          const rc = encode(clean(paper.role || ""));
          const rw = paper.role ? width(rc, "R", 6.5) + 6 : 0;
          const before = f.y, beforePage = f.page;
          f.text(paper.title, { font: "B", size: 7.5, lead: 9.5, rightPad: rw ? rw + 6 : 0, link: paper.href });
          if (paper.role && !f.dry) {
            const ry = f.page === beforePage ? before : f.top;
            f.doc.roundRect(f.page, f.x + f.w - rw, ry + 0.5, rw, 8.5, 2.5, C.chipBg, C.green, 0.5);
            f.doc.text(f.page, f.x + f.w - rw + 3, ry + 1.2, rc, "R", 6.5, C.green);
          }
          f.advance(1);
          if (paper.note) f.text(paper.note, { size: 7, color: C.muted, lead: 9 });
          f.advance(4);
        });
      }
    }

    // ── RIGHT: awards ──
    if ((docData.awards || []).length) {
      R.section("Awards");
      const labelW = Math.min(Math.max(...docData.awards.map(a => width(encode(clean(a.title + ":")), "B", 7.5))) + 6, R.w * 0.45);
      for (const a of docData.awards) {
        R.block(f => {
          const start = f.y, page = f.page;
          if (!f.dry) f.doc.text(page, f.x, start, encode(clean(a.title + ":")), "B", 7.5, C.amber);
          const oldX = f.x, oldW = f.w;
          f.x = oldX + labelW; f.w = oldW - labelW;
          f.text(a.detail, { size: 7, color: C.muted, lead: 9.5 });
          f.x = oldX; f.w = oldW;
          f.advance(1.5);
        });
      }
    }

    L.flush(); R.flush();
    // make sure both columns' pages exist (left may have run longer than right or vice versa)
    doc.page(Math.max(L.page, R.page));
    for (let pg = 0; pg <= Math.max(L.page, R.page); pg++) onNewPage(pg);

    // footer on every page: name + page x/y (small, muted)
    const total = doc.pages.length;
    doc.pages.forEach((pg, i) => {
      if (total > 1) {
        const codes = encode(`${clean(P.name)}  ·  ${i + 1} / ${total}`);
        doc.text(i, PAGE_W - M.right - width(codes, "R", 6), PAGE_H - M.bottom + 8, codes, "R", 6, C.muted);
      }
    });

    return doc.bytes({ title: `${P.name || "Résumé"} — Résumé${P.tailoredFor ? " (" + P.tailoredFor + ")" : ""}`, author: P.name || "" });
  }

  /** browser helper: trigger a download of the generated PDF */
  function download(docData, filename, opts) {
    const bytes = build(docData, opts);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename || "resume.pdf"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return bytes;
  }

  return { build, download, encode, wrap, width, clean, PAGE_W, PAGE_H };
});
