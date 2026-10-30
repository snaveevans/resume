# Repository instructions

Work on the existing branch unless instructed otherwise. Do not commit, push, or deploy without explicit authorization. Do not weaken verification or modify scenario assertions to make them pass.

Use `npm run verify` for the full gate; `VERIFY_GATE=1` or `VERIFY_GATE=2` runs all scenarios while counting only the corresponding staged gate. Browser tests require Chromium and available local ports for the production, fixture and empty sites. Fixture posts are test data and must never ship in `dist/`.

Never invent résumé facts, dates, metrics, or personal copy. Use `docs/content-gaps.md` for content sources and omissions, and `src/data/resume.ts` for the typed résumé facts. Use `docs/design-system.md` for tokens, visual rules, templates and approved decisions. Do not modify `session.md`. Approved behavior scenarios S-01 to S-26 live in `docs/scenarios.md`; change them only with the owner's approval.
