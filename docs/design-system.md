# Mesa design system

## Principles and color

Use semantic tokens in components. The visual language is editorial and outdoors-inspired: strong typography, square edges and rules instead of boxes. No rounded corners, shadows or gradients. Sage is decorative only, never text.

| Primitive | Value | Use |
| --- | --- | --- |
| `--ink-900` | `#1E2320` | Text, strong rules, inverse ground |
| `--ink-600` | `#4E5650` | Secondary text |
| `--rust-600` | `#A34A26` | Accent and active navigation |
| `--sage-600` | `#8E8A72` | Near ridge, decoration only |
| `--stone-500` | `#BDB6A2` | Hairline rules |
| `--stone-400` | `#C9C2AE` | Far ridge, muted text on ink |
| `--stone-300` | `#D8D3C3` | Surfaces and callouts |
| `--stone-200` | `#E6E2D6` | Page ground |
| `--stone-100` | `#F4EFE4` | Text on rust |

Semantic mapping: `--bg` = stone-200; `--surface` = stone-300; `--fg` = ink-900; `--fg-muted` = ink-600; `--rule` = stone-500; `--rule-strong` = ink-900; `--accent` = rust-600; `--on-accent` = stone-100; `--inverse-bg` = ink-900; `--inverse-fg` = stone-200. Code uses ink ground, `#E2DDCF` text, `#D99A6C` keywords and `#A9BC94` functions and strings.

## Type and layout

Archivo is the variable display and body face (weight 400–800, width 62–125); use widths 72–80 for display and 100 for body. JetBrains Mono 400/500 is for navigation, metadata, labels and code. Both are self-hosted; licenses are with the files in `public/fonts/`.

| Token | Size / line height | Weight / width |
| --- | --- | --- |
| `--t-display` | clamp(72px, 11vw, 160px) / .88 | 800 / 72; tracking −.02em |
| `--t-h1` | clamp(48px, 6.4vw, 84px) / .95 | 800 / 72; tracking −.015em |
| `--t-h2` | 36px / 1.1 | 800 / 75 |
| `--t-h3` | 24px / 1.2 | 700 / 80 |
| `--t-item` | 20px / 1.3 | 600 / 90 |
| `--t-lead` | 22px / 1.45 | 400 / 95 |
| `--t-prose` | 18px / 1.7 | 400; max 68ch |
| `--t-ui` | 17px / 1.55 | 400 |
| `--t-meta`, dense meta, `--t-code` | 13px, 12px, 14px | JetBrains Mono 400 |

The spacing scale is 4, 8, 12, 16, 24, 32, 48, 56, 72 and 96px. List rows use 18px vertical padding. Typical sections use 80px top and 96px bottom, or 56px on long pages; the home hero starts at 88px.

The centered container is at most 1200px wide, with 32px side gutters and 12 columns separated by 24px. Below 760px use 16px gutters and stack grid children in one column. Contain wide tables and code in horizontally scrollable boxes. The home ridge and facts strip, footer, and trip hero and facts strip may extend full width. Titles generally occupy columns 3–10, prose 3–9, and previous/next links 3–6 and 7–10.

## Components

- Header: brand plus `/writing`, `/work`, `/about`, `/plarea`, `/contact`; mark the current section visually and with `aria-current`. Home and 404 have no current link.
- Rules: 2px ink for section and header divisions; 1px stone-500 for rows; 4px rust for code tops and the ridge baseline. Keyboard focus has a visible 2px rust outline.
- Section heads pair a condensed h2 with a mono text link. Post and role rows use item typography, mono metadata and hairline dividers. Buttons are square, at least 48px tall, with mono labels.
- The home ridge uses stone-400 and sage with a rust baseline; its facts strip uses inverse colors. Accent blocks use rust with stone-100 text, at most one per page.
- Code blocks use the code palette above, a 4px rust top rule and an optional filename caption. Callouts use the surface token. Tables have mono headers, a 2px header rule and 1px row rules.
- The full footer is used on home; inner pages use the compact inverse footer. The public email and other unsupplied elements are omitted rather than represented with placeholders.

## Route templates

| Route | Template and structure |
| --- | --- |
| `/` | Header, display name and lead, ridge, facts strip, latest Writing and three Work roles, Plarea accent block, full footer. |
| `/writing` | Heading, topic filter when posts exist, Latest, remaining posts grouped by year and labeled format · topic; compact footer. An empty collection has an empty state. |
| `/writing/...` | One of five post formats: deep dive (TL;DR, optional contents/code/table), build (numbered steps and optional specs/tools/cut list), trip (hero, stats and day-by-day), review (verdict and optional specs/results/pros/cons), note (title and prose with optional link/photo). |
| `/work` | Résumé heading, static role rows, projects, skills and education; compact footer. Print hides site chrome and buttons on white. |
| `/about` | Existing first-person copy and fishing photo, facts strip, and only topics with real copy or posts; compact footer. |
| `/plarea` | Heading, lead and accent block linking to Plarea. |
| `/contact` | Heading and available elsewhere links as rows; omit unavailable email. |
| 404 | Header, ridge, “Off trail”, home link and compact footer. |

## Approved decisions

- Where a page board and the rules differ, the board wins visually. Rules supply tokens; all pages use the five-link navigation including About.
- Use the full footer on home and the compact footer elsewhere.
- Work uses static role detail; per-role technology sits in columns 10–12 and Skills appears below.
- Omit Weber State student jobs from Work. Use LinkedIn job titles and keep the approved home lead wording.
- Output is fully static for Cloudflare Pages, without a Cloudflare adapter; old blog redirects live in `public/_redirects`.
