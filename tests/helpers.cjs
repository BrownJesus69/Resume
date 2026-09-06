"use strict";
/* Shared test helpers: load the RESUME object straight out of index.html
   (same extraction the PDF pipeline uses) and expose the two site modules. */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function loadResume() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const match = html.match(/const RESUME\s*=\s*(\{[\s\S]*?\n\})\s*;/);
  if (!match) throw new Error("RESUME object not found in index.html");
  return vm.runInContext("(" + match[1] + ")", vm.createContext(Object.create(null)));
}

const Tailor = require(path.join(ROOT, "tailor.js"));
const PDF = require(path.join(ROOT, "resume-pdf.js"));

/** Extract all text from a PDF buffer using pdf.js (independent parser). */
async function pdfText(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, disableFontFace: true }).promise;
  const pages = [];
  const links = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(it => it.str).join(" "));
    const annots = await page.getAnnotations();
    for (const a of annots) if (a.subtype === "Link" && a.url) links.push(a.url);
  }
  return { numPages: doc.numPages, text: pages.join("\n"), pages, links, info: (await doc.getMetadata()).info };
}

module.exports = { ROOT, loadResume, Tailor, PDF, pdfText };
