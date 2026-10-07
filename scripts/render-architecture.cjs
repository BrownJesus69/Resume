#!/usr/bin/env node
"use strict";
/* Renders docs/architecture.html to docs/architecture.png (2x, solid white
   background) using the Playwright that is already a dev dependency.
   Usage: npm run diagram
   Set PW_CHROMIUM_PATH to use an existing Chromium instead of Playwright's. */
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "docs", "architecture.html");
const OUT = path.join(ROOT, "docs", "architecture.png");

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 });
  await page.goto("file://" + SRC);
  await page.locator("#diagram").screenshot({ path: OUT });
  await browser.close();
  console.log("Wrote", path.relative(ROOT, OUT));
})().catch((err) => { console.error(err); process.exit(1); });
