# Scenarios

Approved Given/When/Then scenarios for tylerevans.co, S-01 to S-27. Every scenario has a test whose title contains its ID (`tests/site.spec.ts`, `tests/pages.spec.ts`, `tests/writing.spec.ts`; S-23 in `tests/build.test.mjs`). Change a scenario only with the owner's approval, and never edit a test assertion to make it pass. Viewports: desktop 1280, phone 390.

## Site shell

### S-01 Primary navigation

Given any page, When it loads, Then the nav links to /writing, /work, /about, /plarea and /contact. Given a page within one of those sections, including a post under /writing, Then that link is marked as current both visually and to assistive technology. Given home or a 404, Then no link is marked current.

### S-02 Phone layout

Given any page at 390px wide, When it loads, Then there is no horizontal page scroll and the page's main layout sections stack in one column. Wide tables and code blocks scroll inside their own box.

### S-03 No third-party fonts

Given any page, When it loads, Then Archivo and JetBrains Mono come from this site and no request goes to a font service.

### S-04 Works without JavaScript

Given JavaScript is disabled, When any page loads, Then all its content and navigation are available.

### S-05 Accessibility

Given any page, When navigated by keyboard alone, Then every link and control is reachable in reading order and shows a 2px rust focus outline. When an automated accessibility audit runs, Then it finds no serious or critical issues.

## Content honesty

### S-06 No placeholders ship

Given the production build, When any page is inspected, Then it contains none of the design's bracketed placeholder strings, no lorem ipsum and no `TODO` text. Square brackets in legitimate prose or code are allowed.

### S-07 Missing facts are omitted

Given no public email, PDF, portrait or role bullets have been supplied, When /contact, /work and /about load, Then those elements are left out with no broken link, empty box or stub.

### S-08 Gaps are listed

Given content was omitted, When the run finishes, Then `docs/content-gaps.md` lists what Tyler must supply for: public email, résumé summary, role bullets, other projects, PDF, portrait and photos, and the Now section.

## Pages

### S-09 Home

Given the home page, When it loads, Then top to bottom it shows the display name and lead, the ridge, the facts strip, Writing, Work with the three latest roles, the Plarea block, and the full footer.

### S-10 Home with no posts

Given no published posts, When home loads, Then Writing says nothing is published yet and still links to /writing.

### S-11 Résumé

Given /work, When it loads, Then it shows Staff Software Engineer (May 2025 – present) first, and Front End Architect, Senior Software Engineer, Software Engineer at 7 Oaks Group, Web Developer and Help Desk Tech at Desert Mutual in reverse date order, plus Plarea under Projects and the Weber State degree under Education.

### S-12 Résumé print

Given /work, When it is printed, Then the site header, footer and buttons are hidden and the background is white.

### S-13 About

Given /about, When it loads, Then it shows Tyler's existing first-person copy, the fishing photo and the facts strip, And Off the clock lists only topics that have posts or real copy.

### S-14 Plarea

Given /plarea, When it loads, Then it shows a heading, a lead from Plarea's own published copy, and an accent block linking to https://www.plarea.dev.

### S-15 Contact and 404

Given /contact, When it loads, Then GitHub and LinkedIn links appear as rows. Given an unknown URL, When requested, Then the response is 404 with the ridge, the heading "Off trail" and a link home.

### S-16 Old blog URLs

Given /blog, /blog/ or /blog/a/b, When requested, Then the response is a permanent redirect to /writing. Given /blogger, When requested, Then the response is 404.

## Writing

### S-17 Starter posts are gone

Given the production build, When /writing loads, Then it has no starter post, And with no posts it shows an empty state and no topic filter or Latest feature.

### S-18 Writing index

Given test posts from 2025 and 2026, When /writing loads, Then the newest appears only as Latest and the rest are grouped by year, newest first, each labeled "format · topic". Posts on the same date sort by title. Given exactly one post, Then it appears as Latest with no year groups.

### S-19 Topic filter

Given test posts in software and camping, When "camping" is chosen, Then only camping posts are listed by year with no Latest feature, And "all" returns to the full index, And topics with no posts are not offered, And it works without JavaScript.

### S-20 Five post formats

Given one test post per format, When each loads, Then it shows that format's required sections: deep dive (TL;DR), build (numbered steps), trip (day-by-day), review (verdict), note (prose). All formats require a title, date, format and topic.

### S-21 Optional post sections

Given a test post with only required content, When it loads, Then every optional section is absent with no empty space or label. Optional: deep dive on-this-page, code, tradeoffs table; build hero, spec strip, cut list, tools, plans link; trip hero, stats, elevation profile, gear notes; review specs, results, pros and cons; note link and photo.

### S-22 Previous and next

Given three test posts, When the middle one loads, Then it links to both neighbors, And the first and last link only to the one that exists.

### S-23 Invalid post is rejected

Given a non-draft post with an unknown format, a missing date, or a format's required section missing, When the site is built, Then the build fails and names the file. Given a draft post missing a required section, When the site is built, Then the build succeeds and the draft appears nowhere. An unknown format or missing date fails the build even on a draft.

### S-24 Test posts never ship

Given the production build, When its complete output is inspected, Then no test post, route or asset is present.

### S-25 Feeds and metadata

Given the production build, When /rss.xml and the sitemap are requested, Then both are valid and list only real pages and posts, And every page has a unique title, a description and a canonical URL on https://www.tylerevans.co.

### S-26 Drafts and future posts

Given a post marked draft or dated after the build date, When the production site is built, Then it appears nowhere: no page, listing, prev/next link, RSS entry or sitemap entry.

### S-27 Share links

Given a published post (any of the five formats)
When it loads, with or without JavaScript
Then it offers share links to X, Facebook, Reddit, LinkedIn and Email. Each carries the post's canonical `https://www.tylerevans.co/writing/<slug>/` address; X, Reddit and Email also carry the post's title, exactly as written even when it contains characters such as &, #, quotes or non-ASCII letters.

And with JavaScript, a "Copy URL" button appears when the clipboard API exists and a "Share…" button appears when the browser supports native sharing. Clicking Copy puts the canonical URL on the clipboard and announces "Link copied" to assistive technology; if copying fails it announces "Couldn't copy link" instead. Cancelling the native share sheet does nothing and shows no error. The "Share…" button is shown only when the browser does not report that it cannot share this address, and if the share sheet fails for any reason other than being cancelled, "Couldn't share link" is announced. Without JavaScript neither button is visible.

And pages that are not posts (home, /writing, /work, /about, /plarea, /contact, topic pages, 404) have no post-sharing controls; their existing GitHub and LinkedIn profile links are unaffected.

And a post's metadata has `og:type` article and its published time; a post with a hero image exposes it as an absolute `og:image` on https://www.tylerevans.co with `twitter:card` `summary_large_image`; a post without a hero has no `og:image` and keeps `twitter:card` `summary`. Non-post pages keep their current metadata.

## History

- On 2026-10-31 the owner approved S-27, the narrow S-04 test adaptation excluding JavaScript-only controls from the main-text parity comparison, the canShare gate and the "Couldn't share link" announcement.
- S-23 changed on 2026-10-30, approved by the owner in the /goal text (resolves a deferred finding): drafts missing a required section no longer fail the build. Previous wording: "Given a post with an unknown format, a missing date, or a format's required section missing, When the site is built, Then the build fails and names the file."
