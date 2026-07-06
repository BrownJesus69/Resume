// resume.typ — ATS-safe PDF résumé for Aditya Bidappa M V
// Compiled by: typst compile resume.typ ../resume.pdf --font-path fonts
// Data source: resume.json (generated from index.html by extract-resume-json.cjs)

#let data = json("resume.json")
#let P    = data.profile

// ── Palette ────────────────────────────────────────────────────────────────
#let c-blue    = rgb("#1d4ed8")   // deep blue    — headings, name, rules
#let c-green   = rgb("#15803d")   // forest green — skill chips (6.7:1 on white)
#let c-chip-bg = rgb("#f0fdf4")   // light green  — chip fill
#let c-amber   = rgb("#92400e")   // amber-800    — awards only (7.0:1 on white)
#let c-body    = rgb("#1e293b")   // near-black   — body text
#let c-muted   = rgb("#64748b")   // slate-500    — secondary text
#let c-left-bg = rgb("#f8fafc")   // slate-50     — left column tint

// ── Page ───────────────────────────────────────────────────────────────────
#set page(
  paper: "a4",
  margin: (top: 1.1cm, bottom: 1.1cm, left: 1.5cm, right: 1.5cm),
  fill: white,
)
#set text(font: ("JetBrains Mono", "Courier New"), size: 8pt, fill: c-body, lang: "en")
#set par(leading: 0.55em, justify: false)

// ── Section heading ─────────────────────────────────────────────────────────
#let sec(title) = {
  v(0.5em)
  text(weight: "bold", size: 7.5pt, fill: c-blue, upper(title))
  v(0.08em)
  line(length: 100%, stroke: 1pt + c-blue)
  v(0.25em)
}

// ── Skill chip (green pill) ─────────────────────────────────────────────────
#let chip(label) = box(
  fill: c-chip-bg,
  stroke: 0.5pt + c-green,
  radius: 2.5pt,
  inset: (x: 3.5pt, y: 1.8pt),
  text(fill: c-green, size: 7pt, weight: "medium", label),
)

// ── Bullet row ──────────────────────────────────────────────────────────────
#let bul(items) = {
  for item in items {
    grid(columns: (0.7em, 1fr), gutter: 0.15em,
      text(fill: c-blue, size: 7.5pt, "▸"),
      par(leading: 0.48em, text(size: 7.5pt, item)),
    )
    v(0.06em)
  }
}

// ── Strip HTML tags ──────────────────────────────────────────────────────────
#let dehtml(s) = s.replace(regex("<[^>]+>"), "")

// ══════════════════════════════════════════════════════════════════════════════
//  FULL-WIDTH HEADER
// ══════════════════════════════════════════════════════════════════════════════
#align(center)[
  #text(size: 19pt, weight: "bold", fill: c-blue, P.name)
  #v(0.12em)
  #let cp = data.contact.map(c => {
    if c.icon == "mail"     { c.value }
    else if c.icon == "github"   { "github.com/" + c.value }
    else if c.icon == "linkedin" { "linkedin.com/in/" + c.value }
    else if c.icon == "phone"    { c.value }
    else { c.value }
  })
  #text(size: 7.5pt, fill: c-muted, cp.join("   |   "))
  #v(0.08em)
  #text(size: 7pt, fill: c-muted, P.tagline)
]
#v(0.3em)
#line(length: 100%, stroke: 1.5pt + c-blue)
#v(0.35em)

// ══════════════════════════════════════════════════════════════════════════════
//  TWO-COLUMN BODY  (left: reference data  |  right: narrative data)
// ══════════════════════════════════════════════════════════════════════════════
#grid(
  columns: (1fr, 2fr),
  column-gutter: 14pt,

  // ── LEFT COLUMN ────────────────────────────────────────────────────────────
  block(fill: c-left-bg, radius: 4pt, inset: 8pt, width: 100%)[

    // Contact
    #sec("Contact")
    #for c in data.contact {
      let d = if c.icon == "mail"     { c.value }
        else if c.icon == "github"   { "github.com/" + c.value }
        else if c.icon == "linkedin" { "linkedin.com/in/" + c.value }
        else { c.value }
      text(size: 7pt, fill: c-muted, d); linebreak()
    }

    // Skills
    #sec("Skills")
    #for grp in data.skills {
      text(size: 6.5pt, weight: "bold", fill: c-muted, upper(grp.group))
      v(0.15em)
      par(leading: 0.55em)[#for i in grp.items { chip(i); h(2pt) }]
      v(0.28em)
    }

    // Education
    #sec("Education")
    #for ed in data.education {
      text(weight: "bold", size: 7.5pt, ed.degree); linebreak()
      text(size: 7pt, fill: c-muted, ed.org); linebreak()
      text(size: 6.5pt, fill: c-muted, ed.period)
      if "cgpa" in ed {
        linebreak()
        text(size: 7pt, fill: c-blue, ed.cgpa)
      }
      if "coursework" in ed {
        v(0.12em)
        text(size: 6.5pt, fill: c-muted, "Coursework: " + ed.coursework.join(", "))
      }
      v(0.28em)
    }

    // Certifications
    #sec("Certifications")
    #for cert in data.certifications {
      text(weight: "medium", size: 7.5pt, cert.name); linebreak()
      text(size: 6.5pt, fill: c-muted, cert.issuer + "  ·  " + cert.date)
      v(0.22em)
    }

    // Leadership roles (compact list)
    #sec("Roles & Activities")
    #for item in data.leadership {
      text(weight: "medium", size: 7.5pt, item.role); linebreak()
      text(size: 6.5pt, fill: c-muted, item.org)
      v(0.18em)
    }
  ],

  // ── RIGHT COLUMN ───────────────────────────────────────────────────────────
  [
    // Summary
    #sec("Professional Summary")
    #for para in data.aboutParagraphs {
      par(leading: 0.55em, text(size: 7.5pt, dehtml(para)))
      v(0.18em)
    }

    // Projects
    #sec("Projects")
    #for pr in data.projects {
      grid(
        columns: (1fr, auto),
        {
          text(weight: "bold", size: 8pt, pr.name)
          if "status" in pr and pr.status.live {
            h(4pt)
            box(fill: c-chip-bg, stroke: 0.5pt + c-green, radius: 2.5pt,
              inset: (x: 3pt, y: 1.2pt),
              text(fill: c-green, size: 6.5pt, weight: "bold", "LIVE"))
          }
          linebreak()
          text(size: 7pt, fill: c-muted, pr.tagline)
        },
        if "stack" in pr {
          align(right, text(size: 6.5pt, fill: c-muted, pr.stack.join(" · ")))
        },
      )
      v(0.1em)
      if "highlights" in pr { bul(pr.highlights) }
      if "metrics" in pr {
        v(0.08em)
        box(fill: rgb("#fffbeb"), stroke: 0.5pt + c-amber, radius: 2.5pt,
          inset: (x: 4pt, y: 2.5pt),
          pr.metrics.map(m =>
            text(weight: "bold", fill: c-amber, size: 7.5pt, m.value) +
            text(fill: c-muted, size: 7pt, " " + m.label)
          ).join(text(fill: c-muted, "   "))
        )
        v(0.1em)
      }
      if "links" in pr {
        text(size: 6.5pt, fill: c-muted, pr.links.map(l => l.href).join("   "))
      }
      v(0.38em)
    }

    // Research
    #sec("Research & Publications")
    #for paper in data.research {
      grid(
        columns: (1fr, auto),
        gutter: 4pt,
        text(weight: "bold", size: 7.5pt, paper.title),
        box(fill: c-chip-bg, stroke: 0.5pt + c-green, radius: 2.5pt,
          inset: (x: 3pt, y: 1.2pt),
          text(fill: c-green, size: 6.5pt, paper.role)),
      )
      v(0.08em)
      par(leading: 0.48em, text(size: 7pt, fill: c-muted, paper.note))
      v(0.3em)
    }

    // Awards (yellow accent — second of two accent uses)
    #sec("Awards")
    #grid(
      columns: (auto, 1fr),
      column-gutter: 6pt,
      row-gutter: 0.18em,
      ..data.awards.map(a => (
        text(weight: "bold", size: 7.5pt, fill: c-amber, a.title + ":"),
        text(size: 7pt, fill: c-muted, a.detail),
      )).flatten()
    )
  ],
)
