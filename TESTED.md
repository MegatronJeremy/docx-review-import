# DOCX Review Import 0.2.0: test record (public copy)

Build tested (the files attached to the 0.2.0 release):
- main.js sha256 b5b6d7ff28495a3b6f1002cb61e14aed33f983b697dc58353653d6ee2db26eca
- manifest.json sha256 6a84cd00ba93e69a3aab9e28b6fb74bb2b05b5805633a039e43b3d5b0d8d4c33 (version 0.2.0)

Automated checks (2026-10-04, on this source): typecheck PASS, 35 tests in 5 files PASS (vitest), production build PASS. main.js contains no `createElement("script")`, no `eval(` and no `new Function`; the build fails if the patched dynamic-code spots in dependencies disappear. The licence notices of the bundled libraries are in a comment at the top of main.js.

Lint: eslint-plugin-obsidianmd 0.4.2 (recommended rules, type-aware) on src/: 0 errors, 6 warnings (optional Obsidian 1.13 `getSettingDefinitions` settings-search API not adopted, `display()` deprecation note, four sentence-case notes on setting descriptions and dropdown labels).

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
