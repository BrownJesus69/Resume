#!/usr/bin/env node
/**
 * extract-resume-json.cjs
 *
 * Reads index.html, locates the `const RESUME = {...}` object inside the
 * <script> block, evaluates it safely in an isolated VM context, and
 * writes strict JSON to the output path.
 *
 * Usage:
 *   node extract-resume-json.cjs <input-html> <output-json>
 *
 * Depends only on Node.js built-ins (vm, fs, path).
 */

"use strict";

const fs  = require("fs");
const vm  = require("vm");
const path = require("path");

const [,, input, output] = process.argv;
if (!input || !output) {
  console.error("Usage: node extract-resume-json.cjs <input.html> <output.json>");
  process.exit(1);
}

const html = fs.readFileSync(input, "utf8");

// Pull everything between `const RESUME = ` and the closing `};`
// that is followed by a blank line or the render block comment.
const match = html.match(/const RESUME\s*=\s*(\{[\s\S]*?\n\})\s*;/);
if (!match) {
  console.error("Could not locate `const RESUME = {...}` in", input);
  process.exit(1);
}

const src = "(" + match[1] + ")";

let resume;
try {
  const ctx = vm.createContext(Object.create(null));
  resume = vm.runInContext(src, ctx);
} catch (err) {
  console.error("Failed to evaluate RESUME object:", err.message);
  process.exit(1);
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(resume, null, 2) + "\n", "utf8");
console.log("Wrote", output);
