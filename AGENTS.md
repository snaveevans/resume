# Repository instructions

Work on the existing branch unless instructed otherwise. Do not commit, push, or deploy without explicit authorization. Do not weaken verification or modify scenario assertions to make them pass.

Use `npm run verify` for the full gate; `VERIFY_GATE=1` or `VERIFY_GATE=2` runs all scenarios while counting only the corresponding staged gate. CI in `.github/workflows/ci.yml` runs `npm run verify` on pull requests and deploys on push to `main`, so never push to `main` without authorization. The site is a Cloudflare Worker with static assets (`wrangler.jsonc`); `redirect/` is a second Worker that redirects `tylerevans.co` to `www.tylerevans.co`. Browser tests require Chromium and available local ports for the production, fixture and empty sites. Fixture posts are test data and must never ship in `dist/`.

Never invent résumé facts, dates, metrics, or personal copy. Use `docs/content-gaps.md` for content sources and omissions, and `src/data/resume.ts` for the typed résumé facts. Use `docs/design-system.md` for tokens, visual rules, templates and approved decisions. Do not modify `session.md`. Approved behavior scenarios S-01 to S-27 live in `docs/scenarios.md`; change them only with the owner's approval.
