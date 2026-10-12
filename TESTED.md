# DOCX Review Import 0.2.2: test record (public copy)

## Version 0.2.2 (2026-10-12)
- Changes: tables now import as Markdown tables (before, every cell became its own paragraph); strikethrough imports as `~~text~~`; comments marked resolved in Word are labelled "Comment (resolved, ...)" in footnote style and prefixed "[resolved] " in CriticMarkup style (before, the resolved state was not shown). New tests: test/tables-images.test.ts (5), test/multi-author.test.ts (2, three reviewers, reply nesting, resolved).
- Automated checks on this source (run_product_checks, 2026-10-12): typecheck PASS, 56 tests in 9 files PASS, production build PASS. main.js contains no `createElement("script")`.
- Release build 0.2.2: main.js sha256 b88f00e468ca8b9d1819d58122f50dd04adfcfe3af8fc76e37c1e66a5a69131c; manifest.json sha256 7d2dc0f432dd4b1572e4a48896bac9c14bdbd062e67dd38f166998d8f9b85c56 (version 0.2.2).
- Not re-run in the real Obsidian app: the real-app run below was on the 0.2.0 build. The changes above are covered by automated tests on synthetic files only; no file saved by Word was tested.

---

Earlier record (0.2.1):

Earlier build (0.2.0 release), the one used for the real-Obsidian run below:
- main.js sha256 b5b6d7ff28495a3b6f1002cb61e14aed33f983b697dc58353653d6ee2db26eca
- manifest.json sha256 6a84cd00ba93e69a3aab9e28b6fb74bb2b05b5805633a039e43b3d5b0d8d4c33 (version 0.2.0)

Build tested for automated checks (the files attached to the 0.2.1 release):
- main.js sha256 a1d3f02b216b56ea7b8b440edfe4358fcaf0b89c398d7635e8dd6d969a824a9b
- manifest.json sha256 94a6840057acc8f23cac71c6f6ad54240a00216a7b6cd907a412019110cc2759 (version 0.2.1)

0.2.1 vs 0.2.0: one fix found by new fixtures (below). The real-Obsidian run described further down was done on the 0.2.0 build (main.js sha256 b5b6d7ff28495a3b6f1002cb61e14aed33f983b697dc58353653d6ee2db26eca) and was NOT repeated on 0.2.1.

Google Docs / Word for the web round-trip fixtures (2026-10-05, test/fixture-hosted.ts, test/hosted.test.ts, 9 tests; 44 tests in 6 files pass in total, typecheck and production build pass). These are synthetic files built by us to mimic the OOXML structure of those apps (invented names); **no file saved by Google Docs or Word for the web was tested**:
- Google Docs style: no commentsExtended and no paraIds; two comments on one range stay two top-level comments; suggestions as w:ins / w:del, one inside a hyperlink; footnote part with separator entries; heading; accept and reject leave no markers.
- Word for the web style: paraIds and commentsExtended with resolved flags, people.xml, a multi-paragraph comment, a comment range across two paragraphs, a reply to a reply, a formatting change (kept as text, change ignored), a paragraph-mark deletion (the two paragraphs are merged in every mode), deletion and insertion inside a hyperlink (marks appear inside the link text), a footnote reference inside an insertion, an insertion carrying a comment.
- Loose ends: comment with no range and no author, reference to a comment that does not exist.
- **Bug found and fixed:** in CriticMarkup style, a reply to a reply (the comment file nests one level deeper than Word normally writes) was silently dropped; it now joins the thread of its root comment. Plain style was not affected. Test: "multi-paragraph comment, threads ... (also reply-to-reply)" and the critic test in hosted.test.ts.
- (0.2.1 behaviour; changed in 0.2.2) Resolved ("done") comments were imported like open ones, with the resolved flag not shown.

Automated checks on 0.2.0 (2026-10-04; on 0.2.1: typecheck PASS, 44 tests PASS, build PASS, 2026-10-05): typecheck PASS, 35 tests in 5 files PASS (vitest), production build PASS. main.js contains no `createElement("script")`, no `eval(` and no `new Function`; the build fails if the patched dynamic-code spots in dependencies disappear. The licence notices of the bundled libraries are in a comment at the top of main.js.

Lint (run on 0.2.0; not re-run on 0.2.1, whose only source change is in src/convert.ts): eslint-plugin-obsidianmd 0.4.2 (recommended rules, type-aware) on src/: 0 errors, 6 warnings (optional Obsidian 1.13 `getSettingDefinitions` settings-search API not adopted, `display()` deprecation note, four sentence-case notes on setting descriptions and dropdown labels).

Real Obsidian 1.13.7 (Linux desktop, fresh vault, no sign-in), exact 0.2.0 build, with Track Changes 2.2.0 as the only other plugin:
- Plugin loads; free import of a synthetic .docx: comments [^c1], [^c2] with the reply threaded, footnote [^1], image extracted, tracked changes accepted silently.
- Re-import of the same file: the second image is saved with a " (1)" suffix and the link, with `(` `)` encoded, renders in reading view. (This run found a bug in the first 0.2.0 build, fixed before this build.)
- Batch import is free ("Imported 2 file(s).").
- Pro paths with **Pro forced on in the test setup (not a real licence key)**: accept, reject and mark gave correct output. Settings headings "Import" and "Pro licence".
- CriticMarkup style with Track Changes 2.2.0 (screenshot and output kept by the authors): insertions and deletions appear as styled marks, the comment with one reply as one thread; panel header "1 comment · 4 suggestions". A moved sentence shows as one delete and one insert card.
- Verify with an invalid key: "Gumroad does not recognise this licence key."; key not saved.
- Network seen during the run: one connection to api.gumroad.com at the Verify click, none during imports. (Obsidian itself connected to raw.githubusercontent.com at startup; the plugin has no such code.)

The CriticMarkup output was also fed to Track Changes 2.2.0's own parser (src/parser.ts) in a separate script: insertions, deletions, highlight, comment and reply parse with author and date.

Fixtures are synthetic OOXML built in test/fixture.ts with invented reviewer names.

Not tested: a valid licence key against live Gumroad (first paying buyers are that test); files saved by Word or LibreOffice; the native file dialog; Windows, macOS, mobile; minAppVersion 1.5.0 (only 1.13.7 used); clicking accept/reject inside Track Changes; a deletion plus insertion substitution through the Track Changes parser; round trip with any exporter plugin (not claimed).

Known limits: see README.
