# Aditya Bidappa M V — Résumé

**Live site:** https://adityabidappa.netlify.app/
**Full résumé PDF (always current):** https://adityabidappa.netlify.app/resume.pdf

A hand-built résumé site with no framework and no build step. All content lives in one place, the `const RESUME = {...}` object in `index.html`, and everything else derives from it:

- the **site** itself (a typeset, document-style page; light and dark),
- the **full PDF**, built by CI with Typst from the same data,
- **curated résumés**: type any job title into the search bar, pick a preset role, or paste a job description; the page filters itself to what matters for that role, you add back or hide anything, and a PDF for that role is generated in the browser and downloaded,
- **search**: the same bar finds any skill, project, paper, experience or certification and scrolls to it (adding it back if the current curation hid it).

A plain visit, or a refresh, always shows the full résumé; a curated view is left with the "Back to the full résumé" button or the pill in the masthead. Deep links such as `?role=front-end-developer` still open curated. The appearance menu (top right) offers system/light/dark, four accent colours and the reactive drafting-grid background; choices are remembered per browser.

---

## Architecture

```mermaid
flowchart TD
    A["index.html<br/>RESUME data object<br/>(content + roleProfiles)"] -->|extract-resume-json.cjs| B["resume.json"]
    B -->|typst compile (CI)| C["resume.pdf — full résumé"]
    A -->|tailor.js| D["role-tailored selection<br/>(skills · projects · experience · research …)"]
    D -->|rendered on the page| E["Tailored view + add-back / hide controls"]
    D -->|resume-pdf.js, in the browser| F["Aditya_Bidappa_M_V_Resume_&lt;Role&gt;.pdf"]
    C --> G["Netlify"]
    A --> G
```

The site and the PDFs are different documents from the same source. Nothing is a screenshot of anything else; both PDF paths emit real, selectable, ATS-parsable text.

### How tailoring works (`tailor.js`)

1. **Resolve the role.** The query is matched against `RESUME.roleProfiles` (title, id, aliases, then word-level matching). Anything else becomes a synthetic profile built from the domain lexicon (`DOMAINS` in `tailor.js`: software, front-end, back-end, security, pentest, ML, data, mobile, research, automation, LLM, cloud, QA, networking, forensics, systems, product, writing) plus `WORD_KEYWORDS` for title words that are not domains on their own ("threat", "quant", "healthcare", …). Fourteen or more words, or the "paste a job description" box, switch to description mode: domains are ranked by how often their terms occur (the title line counts extra), the description's words that exist in the résumé's own vocabulary become keywords, and skills named verbatim are pulled in. A query that matches nothing at all falls back to the full résumé with the closest matches first, and says so.
2. **Score everything.** Each item's text (name, tagline, stack, bullets, notes) is scored against the profile's weighted keyword set: role-specific keywords weigh 3, primary-domain keywords 2, secondary-domain keywords 1. Only distinct hits count, so one repeated word cannot dominate.
3. **Select.** Projects and papers are kept when they score above an absolute floor and at least 35% of the best item in their section; pinned projects are always kept and a minimum of two projects is guaranteed. Skills are kept when they belong to the role's domains, appear in the stack of a selected project, or match a role keyword. Experience, certifications, awards and leadership are never dropped, only re-ordered; a profile can cap experience bullets (`maxHighlights`) to the most relevant ones.
4. **Overrides.** Every item can be added back or hidden on the page. Edits are stored per role in `sessionStorage` and applied on top of the automatic selection, and the PDF reflects exactly what the page shows.
5. **Document.** `buildDocument()` produces a RESUME-shaped object holding only the selection; `resume-pdf.js` lays it out.
6. **Search.** `searchContent()` ranks skills, projects, papers, experience and certifications by name, prefix and body-text match; the page scrolls to the hit and flashes it. Both the sidebar bar and the ⌘K palette use it.

### The in-browser PDF (`resume-pdf.js`)

A small, dependency-free PDF writer: PDF 1.4, the core Helvetica fonts (nothing embedded, so every parser reads the text), WinAnsi encoding with sensible substitutions for typographic characters, word wrapping from real AFM metrics, a two-column layout mirroring the Typst master (blue rules, green skill chips, amber metric strip, tinted left column), keep-together blocks, page numbers and clickable links. It runs in Node too, which is how it is tested.

---

## Tech stack

- **Site** — vanilla HTML, CSS, and JavaScript; zero runtime dependencies, no build step
- **Tailoring + PDF** — `tailor.js`, `resume-pdf.js` (plain scripts, UMD so the tests can `require()` them)
- **Full-PDF pipeline** — Node.js built-ins + [Typst](https://typst.app/), run by GitHub Actions
- **Tests** — `node --test`, [pdf.js](https://mozilla.github.io/pdf.js/) for independent PDF verification, [Playwright](https://playwright.dev/) for end-to-end (desktop + mobile)
- **Hosting** — Netlify (continuous deploy from `main`)

---

## Repository structure

```
.
├── index.html                          # The site — edit RESUME here (content + roleProfiles)
├── tailor.js                           # Role-tailoring engine (pure functions)
├── resume-pdf.js                       # In-browser PDF writer for tailored résumés
├── resume.pdf                          # Generated full résumé — do not edit manually
├── pdf-pipeline/
│   ├── extract-resume-json.cjs         # Extracts RESUME object → resume.json
│   ├── resume.typ                      # Typst template for the full PDF
│   ├── resume.json                     # Generated; committed for CI caching
│   └── fonts/                          # PT Sans + JetBrains Mono for Typst
├── tests/
│   ├── tailor.test.cjs                 # Engine unit tests
│   ├── pdf.test.cjs                    # PDF writer tests (validated with pdf.js)
│   ├── e2e.spec.cjs                    # Playwright end-to-end tests
│   ├── playwright.config.cjs
│   ├── serve.cjs                       # Tiny static server for the tests
│   └── helpers.cjs
├── .github/workflows/
│   ├── build-resume-pdf.yml            # Runs extractor + Typst on every push to main
│   └── test.yml                        # Runs the three test-suites on branches and PRs
├── scripts/
│   └── pre-commit-check.sh             # Install to .git/hooks/pre-commit
├── package.json                        # Dev dependencies for the tests only
└── README.md
```

---

## Updating content

Edit the `RESUME` object inside `index.html`, commit, and push. The GitHub Action runs automatically and commits the regenerated `resume.pdf` back to the repo, which triggers a Netlify redeploy. Tailored PDFs need no build at all; they are generated from the same object when a visitor clicks download.

### Adding or tuning a role

Roles are data, in `RESUME.roleProfiles`:

```js
{
  id: "front-end-developer",            // URL slug: ?role=front-end-developer
  title: "Front End Developer",         // shown on the page and printed under your name
  aliases: ["frontend developer", "ui developer", "react developer"],
  domains: ["frontend"],                // primary domains from DOMAINS in tailor.js
  secondary: ["software", "mobile"],    // related domains, lower weight
  keywords: ["react", "typescript"],    // extra role-specific terms
  summary: "…",                         // optional: replaces the hero summary / PDF summary
  skills: { include: ["Git"], exclude: [] },   // optional manual adjustments
  pin: { projects: ["PromptGuard"] },   // optional: always keep these
  maxHighlights: { experience: 3 }      // optional: keep the n most relevant bullets
}
```

To change what a domain means (which keywords and skills count as "front-end", "ML", …), edit `DOMAINS` at the top of `tailor.js`. The unit tests check that every name you reference actually exists in `RESUME`.

---

## Local development

```bash
# run the site
npm run serve            # http://127.0.0.1:8080

# tests (needs `npm install` once; Playwright downloads Chromium with `npx playwright install chromium`)
npm test                 # unit + PDF + end-to-end
npm run test:unit
npm run test:pdf
npm run test:e2e

# regenerate the full PDF without waiting for CI (needs typst on PATH)
npm run pdf
```

The site itself has no dependencies; `package.json` exists only for the test-suite.

---

## Pre-commit hook

The `scripts/pre-commit-check.sh` hook blocks commits that accidentally contain secrets or unwanted text. Install it once per clone:

```bash
cp scripts/pre-commit-check.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```
