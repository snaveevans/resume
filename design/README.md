# Mesa design handoff

Local copy of the Claude Design canvas "tylerevans.co — Look & Feel"
(https://claude.ai/code/artifact/f9926878-335b-4816-bb49-a66c0703d446, version `1793389808-1c53`).
Agents need nothing from that URL. This folder is temporary and gets removed at the end of the rewrite.

## Layout

| Path | Contents |
| --- | --- |
| `claude-design/project/*.dc.html` | One source file per artboard, with exact markup and inline styles |
| `claude-design/project/canvas.json` | Canvas index: board sizes and titles |
| `claude-design/project/support.js` | Design runtime, needed only to render the boards (not site code) |
| `claude-design/artifact-type/reference/` | How to read the `.dc.html` format, plus the design tool's craft and print notes |
| `reference/desktop-1280/` | Full-page render of every board, 1280px viewport |
| `reference/mobile-500/` | Full-page render of every page board, 500px viewport (Chrome's narrowest window; under the 760px breakpoint) |
| `fonts/` | Self-hostable Latin woff2 files, `fonts.css` with the `@font-face` rules, and OFL licenses |
| `content/resume-source.md` | The only permitted résumé facts, plus known gaps |

## Boards to routes

`Mesa-Rules` is the source of truth for tokens, type, spacing, components and page templates. Build against its semantic tokens, never raw hex.

| Board | Route |
| --- | --- |
| `Mesa-Home` | `/` |
| `Writing-Index` | `/writing` |
| `Post-DeepDive`, `Post-Build`, `Post-Trip`, `Post-Review`, `Post-Note` | `/writing/[slug]`, selected by frontmatter `format` |
| `Mesa-Post` | Shared post anatomy (header, title, prose, code block, callout, prev/next); not a sixth format |
| `Page-Resume` | `/work` |
| `Page-About` | `/about` |
| no board | `/plarea`, `/contact`, `404`: build from the page-template table in `Mesa-Rules` |

## Reading the boards

- `[Bracketed text]` is a placeholder, never content.
- `{{accent}}` and `{{showRidge}}` are design tweaks. Use defaults: accent `#A34A26`, ridge shown.
- `<x-dc>`, `<helmet>`, `<sc-if>` and `data-dc-script` are design-tool format, not site code. Do not port the runtime.
- `.dc.html` links between boards stand for the routes above.

To re-render: `python3 -I -m http.server 8931 --bind 127.0.0.1 --directory design/claude-design/project`, then open a board. Boards load Google Fonts; the site must not.

## Conflicts between boards and rules

- Primary nav: `Mesa-Home` and post boards omit `/about`; `Page-Resume` and `Page-About` include it.
- `/work`: the rules call for expandable role detail and skills in columns 10–12; `Page-Resume` shows static detail, per-role tech in columns 10–12, and a Skills section lower down.
- Footer: `Mesa-Rules` says full form on home and compact on inner pages; `Page-About` uses the full form.
- `Mesa-Post` is `/writing/[slug]`, but the rules define five formats. See the table above.
