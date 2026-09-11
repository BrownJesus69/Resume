"use strict";
/* End-to-end tests for the site: rendering, role tailoring (dropdown, search,
   free text), add-back / hide, PDF download, command palette, URL state.
   Runs against tests/serve.cjs via tests/playwright.config.cjs. */
const { test, expect } = require("playwright/test");
const fs = require("fs");
const { loadResume, pdfText } = require("./helpers.cjs");

const RESUME = loadResume();
const ALL_SKILLS = RESUME.skills.reduce((n, g) => n + g.items.length, 0);
const isMobile = (info) => info.project.name === "mobile";

// Google Fonts is external; keep tests hermetic by answering it with an empty stylesheet.
test.beforeEach(async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", r => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  page.__errors = errors;
});
test.afterEach(async ({ page }) => {
  expect(page.__errors, "no JS errors on the page").toEqual([]);
});

test.describe("full résumé (no tailoring)", () => {
  test("renders every section from RESUME with all content", async ({ page }) => {
    await page.goto("index.html");
    await expect(page.locator("h1")).toHaveText(RESUME.profile.name);
    await expect(page.locator("#headline")).toContainText(RESUME.profile.roles[0]);
    for (const id of ["about", "profile", "skills", "work", "experience", "research", "recognition", "education", "contact"]) await expect(page.locator("#" + id)).toBeVisible();
    await expect(page.locator("#skillset .tag")).toHaveCount(ALL_SKILLS);
    await expect(page.locator("#projects .entry")).toHaveCount(RESUME.projects.length);
    await expect(page.locator("#experienceList .entry")).toHaveCount(RESUME.experience.length);
    await expect(page.locator("#papers .paper")).toHaveCount(RESUME.research.length);
    await expect(page.locator("#roles .row")).toHaveCount(RESUME.leadership.length);
    await expect(page.locator("#awards .row")).toHaveCount(RESUME.awards.length);
    await expect(page.locator("#certs .cert")).toHaveCount(RESUME.certifications.length);
    await expect(page.locator("#interests .tag")).toHaveCount(RESUME.interests.length);
    await expect(page.locator("#otcGrid .otc-tile")).toHaveCount(RESUME.offTheClock.length);
    await expect(page.locator("#tailorState")).toContainText("full résumé");
    await expect(page.locator("#skillset .tag.ghost")).toHaveCount(0);
    await expect(page.locator(".hide-btn")).toHaveCount(0);
    await expect(page.locator(".hidden-box")).toHaveCount(0);
    await expect(page.locator("#masterLink")).toBeHidden();
    await expect(page.locator("#dlLabel")).toContainText("Download résumé");
    await expect(page.locator("#projects .live")).toHaveCount(RESUME.projects.filter(p => p.status && p.status.live).length);
    // project contents
    const first = page.locator("#projects .entry").first();
    await expect(first.locator("h3")).toHaveText(RESUME.projects[0].name);
    await expect(first.locator(".hl li")).toHaveCount(RESUME.projects[0].highlights.length);
    await expect(first.locator(".stat")).toHaveCount(RESUME.projects[0].metrics.length);
    await expect(first.locator(".plink")).toHaveAttribute("target", "_blank");
    // no horizontal overflow
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });

  test("full résumé download points at the CI-built resume.pdf", async ({ page }) => {
    await page.goto("index.html");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("#dlBtn")]);
    expect(download.suggestedFilename()).toBe("resume.pdf");
    const stat = fs.statSync(await download.path());
    expect(stat.size).toBeGreaterThan(10_000);
  });
});

test.describe("tailoring", () => {
  test("pick a role from the dropdown: page filters, counts and URL update", async ({ page }) => {
    await page.goto("index.html");
    const input = page.locator("#roleInput");
    await input.click();
    await expect(page.locator("#roleList")).toBeVisible();
    await expect(page.locator("#roleList .combo-opt")).toHaveCount(RESUME.roleProfiles.length);
    await page.locator("#roleList .combo-opt", { hasText: "Front End Developer" }).click();

    await expect(page.locator("#headline")).toHaveText("Front End Developer");
    await expect(page.locator("#tailorState")).toContainText("Front End Developer");
    await expect(page).not.toHaveURL(/role=/);              // the address bar is never rewritten: a refresh returns to the full résumé
    await expect(page).toHaveTitle(/Front End Developer/);
    const shown = await page.locator("#skillset .tag:not(.ghost)").count();
    const ghosts = await page.locator("#skillset .tag.ghost").count();
    expect(shown + ghosts).toBe(ALL_SKILLS);
    expect(shown).toBeLessThan(ALL_SKILLS / 2);
    await expect(page.locator('#skillset .tag:not(.ghost)[data-name="React"]')).toHaveCount(1);
    await expect(page.locator('#skillset .tag.ghost[data-name="Burp Suite CE"]')).toHaveCount(1);
    await expect(page.locator("#projects .entry")).toHaveCount(4);
    await expect(page.locator("#projects .entry h3", { hasText: "SME-ZT CLI" })).toHaveCount(0);
    await expect(page.locator("#papers .paper")).toHaveCount(0);
    await expect(page.locator("#researchHidden .hidden-box summary")).toContainText("4");
    await expect(page.locator("#counts")).toContainText("Projects");
    await expect(page.locator("#skillsCount")).toContainText(`of ${ALL_SKILLS}`);
    await expect(page.locator("#dlLabel")).toContainText("Front End Developer");
    await expect(page.locator("#masterLink")).toBeVisible();
    // trimmed experience bullets with a "show" control
    await expect(page.locator("#experienceList .hl li")).toHaveCount(3);
    await page.locator("#experienceList .more button").click();
    await expect(page.locator("#experienceList .hl li")).toHaveCount(RESUME.experience[0].highlights.length);
  });

  test("search bar: partial and alias queries resolve, free text builds a custom role", async ({ page }) => {
    await page.goto("index.html");
    const input = page.locator("#roleInput");
    await input.fill("pentest");
    await expect(page.locator("#roleList .combo-opt").first()).toContainText("Penetration Tester");   // strong alias match ranks above the free-text row
    await input.press("Enter");
    await expect(page.locator("#headline")).toHaveText("Penetration Tester");
    await expect(page.locator('#skillset .tag:not(.ghost)[data-name="Burp Suite CE"]')).toHaveCount(1);
    await expect(page.locator('#skillset .tag.ghost[data-name="Expo"]')).toHaveCount(1);

    await input.fill("Quantum Computing Researcher");
    await expect(page.locator("#roleList .combo-opt.free")).toContainText("Quantum Computing Researcher");
    await page.locator("#roleList .combo-opt.free").click();
    await expect(page.locator("#headline")).toHaveText("Quantum Computing Researcher");
    await expect(page.locator("#tailorNotice")).toBeVisible();
    await expect(page.locator("#tailorNotice")).toContainText("Custom role");

    await input.fill("zzz nothing");
    await input.press("Enter");
    await expect(page.locator("#tailorNotice")).toContainText("No role profile matches");
    await expect(page.locator("#projects .entry")).toHaveCount(RESUME.projects.length);
  });

  test("keyboard: arrow keys move through options, Escape closes", async ({ page }) => {
    await page.goto("index.html");
    const input = page.locator("#roleInput");
    await input.focus();
    await input.press("ArrowDown");
    await input.press("ArrowDown");
    await expect(page.locator("#roleList [aria-selected='true']")).toHaveText(new RegExp(RESUME.roleProfiles[2].title));
    await input.press("Enter");
    await expect(page.locator("#headline")).toHaveText(RESUME.roleProfiles[2].title);
    await input.focus();
    await input.press("Escape");
    await expect(page.locator("#roleList")).toBeHidden();
    await expect(input).toHaveValue(RESUME.roleProfiles[2].title);
  });

  test("add a missing skill back, hide a shown one, hide a project, restore a paper, clear edits", async ({ page }) => {
    await page.goto("index.html?role=front-end-developer");
    await expect(page.locator("#headline")).toHaveText("Front End Developer");
    const before = await page.locator("#skillset .tag:not(.ghost)").count();

    // Eg2: "a few skills missing from this selection → add from the master site"
    await page.locator('#skillset .tag.ghost[data-name="Burp Suite CE"]').click();
    await expect(page.locator('#skillset .tag:not(.ghost)[data-name="Burp Suite CE"]')).toHaveCount(1);
    await expect(page.locator("#skillset .tag:not(.ghost)")).toHaveCount(before + 1);
    await expect(page.locator("#edits")).toContainText("1 added");

    // hide a shown skill
    await page.locator('#skillset .tag:not(.ghost)[data-name="React"]').click();
    await expect(page.locator('#skillset .tag.ghost[data-name="React"]')).toHaveCount(1);
    await expect(page.locator("#edits")).toContainText("1 hidden");

    // hide a project via its Hide control
    const entry = page.locator("#projects .entry", { hasText: "PromptGuard" });
    await entry.hover();
    await entry.locator(".hide-btn").click();
    await expect(page.locator("#projects .entry h3", { hasText: "PromptGuard" })).toHaveCount(0);
    await expect(page.locator("#projectsHidden .hidden-list li", { hasText: "PromptGuard" })).toHaveCount(1);

    // add a hidden paper back from the "Hidden for this role" box
    await page.locator("#researchHidden summary").click();
    await page.locator("#researchHidden .hidden-list li").first().locator(".add-btn").click();
    await expect(page.locator("#papers .paper")).toHaveCount(1);
    // "Add all" restores the section
    await page.locator("#researchHidden summary").click();
    await page.locator("#researchHidden [data-act='add-all']").click();
    await expect(page.locator("#papers .paper")).toHaveCount(RESUME.research.length);
    await expect(page.locator("#researchHidden .hidden-box")).toHaveCount(0);

    // edits survive a reload (session storage) and clear on request
    await page.reload();
    await expect(page.locator('#skillset .tag:not(.ghost)[data-name="Burp Suite CE"]')).toHaveCount(1);
    await expect(page.locator("#papers .paper")).toHaveCount(RESUME.research.length);
    await page.locator("#edits [data-act='clear-edits']").click();
    await expect(page.locator('#skillset .tag.ghost[data-name="Burp Suite CE"]')).toHaveCount(1);
    await expect(page.locator("#papers .paper")).toHaveCount(0);
  });

  test("reset returns to the full résumé", async ({ page }) => {
    await page.goto("index.html?role=machine-learning-engineer");
    await expect(page.locator("#headline")).toHaveText("Machine Learning Engineer");
    await page.locator("#tailorState .reset").click();
    await expect(page.locator("#tailorState")).toContainText("full résumé");
    await expect(page.locator("#skillset .tag")).toHaveCount(ALL_SKILLS);
    await expect(page).not.toHaveURL(/role=/);
  });

  test("URL parameter loads a role directly and back/forward is honoured", async ({ page }) => {
    await page.goto("index.html?role=penetration-tester");
    await expect(page.locator("#headline")).toHaveText("Penetration Tester");
    await expect(page.locator("#roleInput")).toHaveValue("Penetration Tester");
    await page.goto("index.html?role=Security%20Researcher");
    await expect(page.locator("#headline")).toHaveText("Security Researcher");
    await page.goBack();
    await expect(page.locator("#headline")).toHaveText("Penetration Tester");
  });
});

test.describe("PDF download", () => {
  test("downloads a role-named PDF whose contents match the tailored page (Eg1)", async ({ page }) => {
    await page.goto("index.html?role=software-developer");
    await expect(page.locator("#headline")).toHaveText("Software Developer");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("#dlBtn")]);
    expect(download.suggestedFilename()).toBe("Aditya_Bidappa_M_V_Resume_Software_Developer.pdf");
    const bytes = fs.readFileSync(await download.path());
    expect(bytes.slice(0, 5).toString()).toBe("%PDF-");
    const r = await pdfText(bytes);
    expect(r.text).toContain("Software Developer");
    expect(r.text).toContain(RESUME.profile.name);
    const shownProjects = await page.locator("#projects .entry h3").allTextContents();
    for (const n of shownProjects) expect(r.text).toContain(n);
    const hiddenProjects = RESUME.projects.map(p => p.name).filter(n => !shownProjects.includes(n));
    for (const n of hiddenProjects) expect(r.text).not.toContain(n);
    // hidden skills must be absent from the PDF — except names that also occur in prose (e.g. "Zero Trust" in a paper title)
    const prose = JSON.stringify([RESUME.projects, RESUME.experience, RESUME.research, RESUME.awards, RESUME.leadership, RESUME.education, RESUME.certifications, RESUME.interests, RESUME.aboutParagraphs, RESUME.roleProfiles.map(p => p.summary)]);
    const ghostSkills = (await page.locator("#skillset .tag.ghost").evaluateAll(els => els.map(e => e.dataset.name))).filter(n => !prose.includes(n));
    expect(ghostSkills.length).toBeGreaterThan(3);
    for (const s of ghostSkills) expect(r.text).not.toContain(s);
    await expect(page.locator("#toast")).toContainText("Downloaded");
  });

  test("custom edits are reflected in the downloaded PDF (Eg2)", async ({ page }) => {
    await page.goto("index.html?role=front-end-developer");
    await page.locator('#skillset .tag.ghost[data-name="Wireshark"]').click();
    await page.locator('#skillset .tag.ghost[data-name="LaTeX"]').click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("#dlBtn")]);
    expect(download.suggestedFilename()).toBe("Aditya_Bidappa_M_V_Resume_Front_End_Developer.pdf");
    const r = await pdfText(fs.readFileSync(await download.path()));
    expect(r.text).toContain("Wireshark");
    expect(r.text).toContain("LaTeX");
    expect(r.text).not.toContain("SME-ZT CLI");
    expect(r.text).toContain("Front End Developer");
    expect(r.numPages).toBeLessThanOrEqual(2);
  });
});

test.describe("command palette & navigation", () => {
  test("the Menu button opens the overlay; it can navigate, curate and reset; no shortcut hints anywhere", async ({ page }) => {
    await page.goto("index.html");
    await expect(page.locator("kbd")).toHaveCount(0);
    expect(await page.content()).not.toContain("⌘");
    await page.keyboard.press("Control+k");
    await expect(page.locator("#cmdk")).not.toHaveClass(/open/);
    await page.click("#menuBtn");
    await expect(page.locator("#cmdk")).toHaveClass(/open/);
    await page.fill("#cmdkInput", "penetration");
    await page.keyboard.press("Enter");
    await expect(page.locator("#cmdk")).not.toHaveClass(/open/);
    await expect(page.locator("#headline")).toHaveText("Penetration Tester");

    await page.click("#menuBtn");
    await page.fill("#cmdkInput", "full résumé");
    await page.keyboard.press("Enter");
    await expect(page.locator("#tailorState")).toContainText("full résumé");

    await page.click("#menuBtn");
    await page.fill("#cmdkInput", "research");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(700);
    const y = await page.locator("#research").evaluate(el => el.getBoundingClientRect().top);
    expect(y).toBeLessThan(200);
    await page.click("#menuBtn");
    await page.click("#cmdkClose");
    await expect(page.locator("#cmdk")).not.toHaveClass(/open/);
  });

  test("masthead nav links exist on desktop only", async ({ page }, info) => {
    await page.goto("index.html");
    if (isMobile(info)) await expect(page.locator("#topnav")).toBeHidden();
    else await expect(page.locator("#topnav a")).toHaveCount(9);
    await expect(page.locator("#menuBtn")).toBeVisible();
  });
});

test.describe("universal search bar", () => {
  test("empty query lists every role under a group header", async ({ page }) => {
    await page.goto("index.html");
    await page.locator("#roleInput").click();
    await expect(page.locator("#roleList .combo-group")).toHaveCount(1);
    await expect(page.locator("#roleList .combo-opt")).toHaveCount(RESUME.roleProfiles.length);
  });

  test("finds a skill, a project and a paper and scrolls to them", async ({ page }) => {
    await page.goto("index.html");
    const input = page.locator("#roleInput");
    await input.fill("burp");
    await expect(page.locator("#roleList .combo-group", { hasText: "On the résumé" })).toBeVisible();
    const hit = page.locator("#roleList .combo-opt:not(.free)", { hasText: "Burp Suite CE" });
    await expect(hit).toContainText("Skill");
    await hit.click();
    await expect(page.locator('#skillset .tag[data-name="Burp Suite CE"]')).toHaveClass(/flash/);
    await expect(page.locator("#toast")).toContainText("Burp Suite CE");
    await expect.poll(() => page.locator('#skillset .tag[data-name="Burp Suite CE"]').evaluate(el => el.getBoundingClientRect().top), { timeout: 5000 })
      .toBeLessThan(900);

    await input.fill("promptguard");
    await expect(page.locator("#roleList .combo-opt").first()).toContainText("PromptGuard");   // a name match outranks the free-text row
    await page.locator("#roleList .combo-opt:not(.free)", { hasText: "PromptGuard" }).click();
    await expect(page.locator('#projects .entry[data-key="projects:0"]')).toHaveClass(/flash/);

    await input.fill("deepfake");
    const paper = page.locator("#roleList .combo-opt:not(.free)", { hasText: "Deepfake Media Analysis" });
    await expect(paper).toContainText("Paper");
    await paper.click();
    await expect(page.locator('#papers .paper[data-key="research:2"]')).toHaveClass(/flash/);
  });

  test("searching for a hidden skill while curated adds it back (Eg2 via search)", async ({ page }) => {
    await page.goto("index.html?role=front-end-developer");
    await expect(page.locator('#skillset .tag.ghost[data-name="Kali Linux"]')).toHaveCount(1);
    await page.locator("#roleInput").fill("kali");
    await page.locator("#roleList .combo-opt:not(.free)", { hasText: "Kali Linux" }).click();
    await expect(page.locator('#skillset .tag:not(.ghost)[data-name="Kali Linux"]')).toHaveCount(1);
    await expect(page.locator("#edits")).toContainText("1 added");
    await expect(page.locator("#headline")).toHaveText("Front End Developer");
  });

  test("curates for any job title, not only the preset roles", async ({ page }) => {
    await page.goto("index.html");
    const input = page.locator("#roleInput");
    await input.fill("Cloud Security Engineer");
    await expect(page.locator("#roleList .combo-opt.free")).toContainText("Cloud Security Engineer");
    await input.press("Enter");
    await expect(page.locator("#headline")).toHaveText("Cloud Security Engineer");
    await expect(page.locator("#tailorNotice")).toContainText("Custom role");
    await expect(page.locator("#tailorNotice")).not.toContainText("No role profile");
    const shown = await page.locator("#skillset .tag:not(.ghost)").count();
    expect(shown).toBeGreaterThan(4);
    expect(shown).toBeLessThan(ALL_SKILLS);
    await expect(page.locator("#dlLabel")).toContainText("Cloud Security Engineer");

    await input.fill("Technical Writer");
    await input.press("Enter");
    await expect(page.locator("#headline")).toHaveText("Technical Writer");
    await expect(page.locator('#skillset .tag:not(.ghost)[data-name="LaTeX"]')).toHaveCount(1);
  });

  test("curates from a pasted job description and keeps it across a reload", async ({ page }) => {
    await page.goto("index.html");
    await page.click("#jdToggle");
    await expect(page.locator("#jdBox")).toBeVisible();
    await page.fill("#jdText", "Security Analyst (SOC)\nMonitor alerts, investigate incidents, tune detections, work with Wireshark and nmap, write incident reports, understand OWASP and NIST frameworks, and support vulnerability management and threat intelligence.");
    await page.click("#jdCurate");
    await expect(page.locator("#headline")).toHaveText("Security Analyst (SOC)");
    await expect(page.locator("#tailorState")).toContainText("from a job description");
    await expect(page.locator('#skillset .tag:not(.ghost)[data-name="Wireshark"]')).toHaveCount(1);
    await expect(page.locator('#skillset .tag:not(.ghost)[data-name="nmap"]')).toHaveCount(1);
    await expect(page.locator('#skillset .tag.ghost[data-name="Expo"]')).toHaveCount(1);
    await expect(page.locator("#jdBox")).toBeHidden();
    await expect(page.locator("#backBtn")).toBeVisible();
    await page.reload();                                                  // a refresh always lands on the full résumé…
    await expect(page.locator("#tailorState")).toContainText("full résumé");
    await page.click("#jdToggle");
    await expect(page.locator("#jdText")).toHaveValue(/Security Analyst/);   // …but the pasted text is kept for re-use
    await page.click("#jdCurate");
    await expect(page.locator("#headline")).toHaveText("Security Analyst (SOC)");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("#dlBtn")]);
    expect(download.suggestedFilename()).toBe("Aditya_Bidappa_M_V_Resume_Security_Analyst_SOC.pdf");
    const r = await pdfText(fs.readFileSync(await download.path()));
    expect(r.text).toContain("Security Analyst (SOC)");
    expect(r.text).toContain("Wireshark");
  });

  test("too-short description is rejected with a message", async ({ page }) => {
    await page.goto("index.html");
    await page.click("#jdToggle");
    await page.fill("#jdText", "SOC analyst");
    await page.click("#jdCurate");
    await expect(page.locator("#toast")).toContainText("fuller description");
    await expect(page.locator("#tailorState")).toContainText("full résumé");
  });

  test("⌘K also finds résumé items and curates for free text", async ({ page }) => {
    await page.goto("index.html");
    await page.click("#menuBtn");
    await page.fill("#cmdkInput", "nutrilog");
    await expect(page.locator("#cmdkList .cmdk-item", { hasText: "NutriLog" }).first()).toContainText("Project");
    await page.keyboard.press("Enter");
    await expect(page.locator('#projects .entry[data-key="projects:4"]')).toHaveClass(/flash/);
    await page.click("#menuBtn");
    await page.fill("#cmdkInput", "Game Developer");
    await page.locator("#cmdkList .cmdk-item", { hasText: "Curate for" }).click();
    await expect(page.locator("#headline")).toHaveText("Game Developer");
  });
});

test.describe("appearance & personalisation", () => {
  test("theme choice persists; accent colour changes the palette and the favicon", async ({ page }) => {
    await page.goto("index.html");
    const bgBefore = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.click("#appearanceBtn");
    await expect(page.locator("#appearanceMenu")).toBeVisible();
    await page.click('[data-theme-choice="dark"]');
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const bgAfter = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bgAfter).not.toBe(bgBefore);
    const accentBefore = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
    await page.click('[data-accent-choice="teal"]');
    await expect(page.locator("html")).toHaveAttribute("data-accent", "teal");
    const accentAfter = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
    expect(accentAfter).not.toBe(accentBefore);
    const icon = await page.locator("link[rel='icon']").getAttribute("href");
    expect(icon).toContain("data:image/svg+xml");
    expect(decodeURIComponent(icon)).toContain(accentAfter);
    await expect(page.locator("#monogram")).toHaveText("AB");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("data-accent", "teal");
    await page.click("#appearanceBtn");
    await page.click('[data-theme-choice="system"]');
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /./);
    await page.click('[data-accent-choice="orange"]');
    await expect(page.locator("html")).not.toHaveAttribute("data-accent", /./);
  });
  test("follows the system preference when no choice is stored", async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: "dark", baseURL: "http://127.0.0.1:8317/" });
    const page = await ctx.newPage();
    await page.route("https://fonts.googleapis.com/**", r => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
    await page.goto("index.html");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(15, 27, 42)");
    await ctx.close();
  });
  test("the drafting-grid background draws, reacts to the pointer, and can be switched off", async ({ page }, info) => {
    await page.goto("index.html");
    const cv = page.locator("#bg");
    await expect(cv).toBeVisible();
    const size = await cv.evaluate(el => [el.width, el.height]);
    expect(size[0]).toBeGreaterThan(100); expect(size[1]).toBeGreaterThan(100);
    const painted = await cv.evaluate(el => { const d = el.getContext("2d").getImageData(0, 0, el.width, el.height).data; let n = 0; for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) n++; return n; });
    expect(painted).toBeGreaterThan(0);
    if (!isMobile(info)) {
      await page.mouse.move(300, 400); await page.waitForTimeout(400);
      const near = await cv.evaluate(el => { const d = el.getContext("2d").getImageData(Math.round(300 * devicePixelRatio) - 40, Math.round(400 * devicePixelRatio) - 40, 80, 80).data; let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i]; return a; });
      await page.mouse.move(1300, 850); await page.waitForTimeout(700);
      const far = await cv.evaluate(el => { const d = el.getContext("2d").getImageData(Math.round(300 * devicePixelRatio) - 40, Math.round(400 * devicePixelRatio) - 40, 80, 80).data; let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i]; return a; });
      expect(near).toBeGreaterThan(far);
    }
    await page.click("#appearanceBtn");
    await page.uncheck("#bgToggle");
    await expect(cv).toBeHidden();
    await page.reload();
    await expect(page.locator("#bg")).toBeHidden();
    await page.click("#appearanceBtn");
    await page.check("#bgToggle");
    await expect(page.locator("#bg")).toBeVisible();
  });
  test("hero shows a live local time", async ({ page }) => {
    await page.goto("index.html");
    await expect(page.locator("#clock")).toHaveText(/\d{2}:\d{2}/);
  });
});

test.describe("leaving a curated view", () => {
  test("back button and masthead pill return to the full résumé; plain visit is always the full résumé", async ({ page }) => {
    await page.goto("index.html");
    await expect(page.locator("#tailorState")).toContainText("full résumé");
    await expect(page.locator("#backBtn")).toBeHidden();
    await expect(page.locator("#curatedPill")).toBeHidden();
    await page.locator("#roleInput").fill("Front End Developer");
    await page.locator("#roleInput").press("Enter");
    await expect(page.locator("#headline")).toHaveText("Front End Developer");
    await expect(page.locator("#backBtn")).toBeVisible();
    await expect(page.locator("#curatedPill")).toBeVisible();
    await expect(page.locator("#curatedPillRole")).toHaveText("Front End Developer");
    await page.click("#backBtn");
    await expect(page.locator("#tailorState")).toContainText("full résumé");
    await expect(page.locator("#skillset .tag")).toHaveCount(ALL_SKILLS);
    await page.locator("#roleInput").fill("Penetration Tester");
    await page.locator("#roleInput").press("Enter");
    await expect(page.locator("#headline")).toHaveText("Penetration Tester");
    await page.click("#curatedPill");
    await expect(page.locator("#tailorState")).toContainText("full résumé");
    await page.reload();
    await expect(page.locator("#tailorState")).toContainText("full résumé");
    await expect(page).not.toHaveURL(/role=/);
    // a deep link still works, and resetting it clears the parameter
    await page.goto("index.html?role=machine-learning-engineer");
    await expect(page.locator("#headline")).toHaveText("Machine Learning Engineer");
    await page.click("#backBtn");
    await expect(page).not.toHaveURL(/role=/);
    await page.reload();
    await expect(page.locator("#tailorState")).toContainText("full résumé");
  });
});

test.describe("touch handling in the search list", () => {
  test("touch-down does not select (so the list can scroll); a tap does", async ({ page }, info) => {
    test.skip(!isMobile(info), "touch only");
    await page.goto("index.html");
    await page.locator("#roleInput").fill("react");
    const opt = page.locator("#roleList .combo-opt").first();
    await expect(opt).toContainText("React");                      // exact skill name outranks the "react developer" alias
    await opt.dispatchEvent("pointerdown", { pointerType: "touch", isPrimary: true, bubbles: true });
    await page.waitForTimeout(300);
    await expect(page.locator("#roleList")).toBeVisible();        // still open: nothing was chosen
    await expect(page.locator("#tailorState")).toContainText("full résumé");
    const box = await opt.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('#skillset .tag[data-name="React"]')).toHaveClass(/flash/);
    await expect(page.locator("#roleList")).toBeHidden();
  });
});
