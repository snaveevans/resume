# tylerevans.co

An Astro site for Tyler Evans's work and writing, built as static files for Cloudflare Pages.

Run `npm ci`, then `npm run dev` for local development. `npm run build` writes production output to `dist/`; `npm run build:fixtures` builds the isolated test site. Run `npm run verify` for the full verification suite.

Posts live in `src/content/blog/` as Markdown or MDX. Each post needs a title, date, format and topic. If no description is supplied, the post title is used as its metadata and RSS description. Supported formats are `deep dive`, `build`, `trip`, `review`, and `note`. Deep dives need a TL;DR heading, builds need a numbered step heading, trips need a day heading, reviews need a verdict heading, and notes need prose. Mark unpublished posts with `draft: true`; future-dated posts are excluded until their date.

Future-dated posts appear only after a rebuild on or after their date. Drafts and future posts are still validated at build time.

Post frontmatter rejects unknown fields. Optional frontmatter fields are:

- All formats: `description` (text); `hero: { src, alt }` for a hero image.
- Deep dive: `onThisPage: true`. Write code using fenced Markdown blocks and tradeoffs using a Markdown table under a `## Tradeoffs` heading.
- Build: `specs: [{ label, value }]`, `cutList: [text]`, `tools: [text]`, and `plans` (absolute URL).
- Trip: `stats: [{ label, value }]`, `elevation: { src, alt }`, and `gear: [text]`.
- Review: `specs` and `results`, each `[{ label, value }]`, plus `pros: [text]` and `cons: [text]`.
- Note: `link` (absolute URL) and `photo: { src, alt }`.

Image `src` values should point to a real site asset, and `alt` should describe it. Use `## TL;DR`, `## Verdict`, or `## Day 1` and follow each required heading with content. Build steps are second- or third-level headings followed by content, such as `## Step 1: Cut boards` or `## Milling stock`; headings such as Introduction, Tools, Materials, Cut list, Plans, and Conclusion do not count as steps. A heading inside a code fence is not a required section.

For a build cut list, use `cutList: [{ part, qty, dimensions, material }]`; `steps: [{ photo: { src, alt } }]` attaches an optional photo to each successive Markdown step. `changes: [text]` supplies the “What I’d do differently” callout. Use `specs: [{ label, value }]` for the time, cost, difficulty and material strip.

A trip can supply `stats` as label/value rows for where, distance, gain, nights and rig/mode; `elevation: { src, alt, start, end }` and `map: { src, alt }` supply the route row. `days: [{ meta: [text] }]` adds metadata to successive day headings. Use `gear: { worked: [text], didnt: [text] }` and `nextTime: text` for gear and the closing callout.

Reviews can supply `hero`, `goodFor`, `notFor`, `pricePaid`, `testConditions`, `alternatives` and `disclosure` alongside their `specs`, `results`, `pros` and `cons`. Deep dives can supply `marginNotes: [text]`; when `onThisPage` is true, the navigation is generated from all h2 headings. The `topic/` path prefix is reserved for topic filters and cannot be used as a post path. A fenced code block can supply a filename using `title="filename.ts"` or `filename="filename.ts"` after its language.
