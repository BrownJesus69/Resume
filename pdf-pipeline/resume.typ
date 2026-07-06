// resume.typ — ATS-safe PDF résumé for Aditya Bidappa M V
// Compiled by: typst compile resume.typ ../resume.pdf --font-path fonts
// Data source: resume.json (generated from index.html by extract-resume-json.cjs)

#let data = json("resume.json")
#let P    = data.profile

// ── Page setup ────────────────────────────────────────────────────────────
#set page(
  paper: "a4",
  margin: (top: 1.8cm, bottom: 1.8cm, left: 2cm, right: 2cm),
)

// ── Typography ────────────────────────────────────────────────────────────
#set text(
  font: ("JetBrains Mono", "Courier New"),
  size: 9.5pt,
  fill: rgb("#111827"),
  lang: "en",
)
#set par(leading: 0.65em, justify: false)

// Helpers
#let mono(content, ..args) = text(font: "JetBrains Mono", ..args, content)
#let accent = rgb("#0891b2")   // slate teal — prints well, not garish

// ── Section heading ────────────────────────────────────────────────────────
#let section(title) = {
  v(0.9em)
  text(weight: "bold", size: 9pt, upper(title))
  line(length: 100%, stroke: 0.6pt + rgb("#d1d5db"))
  v(0.3em)
}

// ── Skill strip (comma-separated, wraps naturally) ──────────────────────
#let skill-row(label, items) = {
  grid(
    columns: (3.2cm, 1fr),
    gutter: 0.5em,
    text(fill: rgb("#6b7280"), size: 8.5pt, upper(label)),
    items.join("  ·  "),
  )
  v(0.25em)
}

// ── Bullet list ────────────────────────────────────────────────────────────
#let bullets(items) = {
  for item in items {
    grid(
      columns: (0.9em, 1fr),
      "▸",
      par(leading: 0.55em, item),
    )
    v(0.15em)
  }
}

// ── Strip HTML tags (summary has <strong> tags) ───────────────────────────
// Typst doesn't parse HTML; we strip inline tags with a simple replace.
#let strip-html(s) = {
  s.replace(regex("<[^>]+>"), "")
}

// ══════════════════════════════════════════════════════════════════════════
//  HEADER
// ══════════════════════════════════════════════════════════════════════════
#align(center)[
  #text(size: 22pt, weight: "bold", P.name)
  #v(0.3em)
  #let contact-parts = data.contact.map(c => {
    if c.icon == "mail"     { c.value }
    else if c.icon == "github"   { "github.com/" + c.value }
    else if c.icon == "linkedin" { "linkedin.com/in/" + c.value }
    else if c.icon == "phone"    { c.value }
    else { c.value }
  })
  #text(size: 8.5pt, fill: rgb("#374151"), contact-parts.join("  |  "))
  #v(0.2em)
  #text(size: 8pt, fill: rgb("#6b7280"), P.tagline)
]

// ══════════════════════════════════════════════════════════════════════════
//  SUMMARY
// ══════════════════════════════════════════════════════════════════════════
#section("Summary")
#for para in data.aboutParagraphs {
  par(strip-html(para))
  v(0.3em)
}

// ══════════════════════════════════════════════════════════════════════════
//  SKILLS
// ══════════════════════════════════════════════════════════════════════════
#section("Skills")
#for grp in data.skills {
  skill-row(grp.group, grp.items)
}

// ══════════════════════════════════════════════════════════════════════════
//  PROJECTS
// ══════════════════════════════════════════════════════════════════════════
#section("Projects")
#for pr in data.projects {
  // Project name + tagline + live badge
  grid(
    columns: (1fr, auto),
    gutter: 0.5em,
    [
      #text(weight: "bold", pr.name)
      #h(0.4em)
      #text(fill: rgb("#6b7280"), size: 8.5pt, "— " + pr.tagline)
      #if "status" in pr and pr.status.live [
        #h(0.3em)
        #text(fill: accent, size: 7.5pt, "[LIVE]")
      ]
    ],
    // stack line (right-aligned)
    if "stack" in pr {
      text(fill: rgb("#9ca3af"), size: 7.5pt, pr.stack.join(" · "))
    },
  )
  v(0.2em)
  if "highlights" in pr { bullets(pr.highlights) }
  if "metrics" in pr {
    let m-parts = pr.metrics.map(m => m.value + " " + m.label)
    text(fill: accent, size: 8pt, m-parts.join("  ·  "))
    v(0.2em)
  }
  if "links" in pr {
    let link-parts = pr.links.map(l => l.href)
    text(fill: rgb("#6b7280"), size: 7.5pt, link-parts.join("  ·  "))
  }
  v(0.55em)
}

// ══════════════════════════════════════════════════════════════════════════
//  RESEARCH & PUBLICATIONS
// ══════════════════════════════════════════════════════════════════════════
#section("Research & Publications")
#for paper in data.research {
  grid(
    columns: (1fr, auto),
    text(weight: "medium", paper.title),
    text(fill: rgb("#6b7280"), size: 8pt, "[" + paper.role + "]"),
  )
  v(0.15em)
  text(fill: rgb("#374151"), size: 8.5pt, paper.note)
  v(0.5em)
}

// ══════════════════════════════════════════════════════════════════════════
//  EDUCATION & CERTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════
#section("Education")
#for ed in data.education {
  grid(
    columns: (1fr, auto),
    text(weight: "bold", ed.degree),
    text(fill: rgb("#6b7280"), size: 8.5pt, ed.period),
  )
  text(fill: rgb("#374151"), ed.org)
  if "cgpa" in ed {
    h(1em)
    text(fill: accent, size: 8.5pt, ed.cgpa)
  }
  if "coursework" in ed {
    v(0.15em)
    text(fill: rgb("#6b7280"), size: 8pt, "Coursework: " + ed.coursework.join(", "))
  }
  v(0.45em)
}

#section("Certifications")
#for cert in data.certifications {
  grid(
    columns: (1fr, auto),
    [#cert.name — #text(fill: rgb("#6b7280"), cert.issuer)],
    text(fill: rgb("#6b7280"), size: 8pt, cert.date),
  )
  v(0.2em)
}

// ══════════════════════════════════════════════════════════════════════════
//  LEADERSHIP & AWARDS
// ══════════════════════════════════════════════════════════════════════════
#section("Leadership & Activities")
#grid(
  columns: (1fr, 1fr),
  gutter: 1.5em,
  // Roles
  [
    #for item in data.leadership {
      grid(
        columns: (auto, 1fr),
        gutter: 0.5em,
        text(weight: "medium", item.role + ","),
        text(fill: rgb("#374151"), item.org),
      )
      v(0.15em)
    }
  ],
  // Awards
  [
    #for award in data.awards {
      grid(
        columns: (auto, 1fr),
        gutter: 0.5em,
        text(fill: accent, weight: "medium", award.title + ":"),
        text(fill: rgb("#374151"), award.detail),
      )
      v(0.15em)
    }
  ],
)
