# DOCX Review Import

Import `.docx` files into your vault as Markdown notes. Comments, footnotes and images come along in the free version. Pro adds tracked changes shown as marked-up text.

Formerly "Redline Import" (the earlier GitHub repository `redline-import` is not this one).

> **AI-assisted.** This plugin and this README were written with AI assistance (Claude) by Quillfern (AI-assisted), a small AI-assisted studio, and reviewed before release. The code is open source under the MIT licence.

> **Payment required for some features.** Single-file and batch import are free. Tracked-changes marking needs **DOCX Review Import Pro**, a separate one-time purchase on Gumroad. Buy it here: https://xparhyx.gumroad.com/l/krpith ($12, one-time; the Gumroad page may still show the earlier name "Redline Import Pro", it is the same product). The free version is not time-limited.

## Free version

Run **Import a .docx file** from the command palette and pick one `.docx`, or **Import several .docx files** to pick up to 100 at once (each file is converted independently; a file that fails is reported and the rest continue; files over 50 MB are skipped). The note is created in the output folder you set (default: vault root); an existing note is never overwritten.

- Headings, lists, tables, bold/italic and links become Markdown.
- **Comments** become footnotes named `[^c1]`, `[^c2]` and so on, with author and date (or CriticMarkup comments if you choose that style in settings). A reply to a comment says which comment it answers (this needs the reply information that Word writes in `commentsExtended.xml`).
- **Footnotes** become Markdown footnotes (`[^1]`).
- **Images** are saved as separate files in your attachments folder and linked from the note. Importing the same file twice saves the images again under new names.
- **Tracked changes in the free version are accepted silently**: inserted text is kept and deleted text is dropped, with no markers.

## Pro version (optional, paid)

Pro unlocks one feature, covered by automated tests: **tracked changes shown in the note.** Choose one of three modes in settings:

- *Mark*: insertions and deletions are written with author and date, in the markup style you pick:
  - *Plain markdown*: insertions become `==inserted text==` and deletions become `~~deleted text~~`, each followed by an HTML comment with the author and date.
  - *CriticMarkup*: `{author="Ann" date="2026-09-01T10:00:00Z"++inserted++}` and `{--deleted--}`, a deletion plus insertion by the same reviewer as one `{~~old~>new~~}`, and comments as `{==text==}{author="Ann">>comment<<}` with replies as adjacent blocks. This is the syntax of the free [Track Changes](https://github.com/philphilphil/obsidian-track-changes) community plugin (version 2.2.0 checked), which displays the marks and lets you review them (its accept/reject buttons were not clicked in our test). Track Changes is a separate plugin; this one only writes text it can read.
- *Accept all*: keep insertions, drop deletions.
- *Reject all*: restore deleted text, drop insertions.

Not included: exporting notes back to Word. This plugin only imports, and no round trip with any other plugin is claimed or tested.

### Buying and activating Pro

1. Buy DOCX Review Import Pro on Gumroad: https://xparhyx.gumroad.com/l/krpith ($12, one-time). The page may still carry the earlier name "Redline Import Pro"; it is the same product.
2. Gumroad emails you a licence key.
3. In Obsidian: Settings → Community plugins → DOCX Review Import → paste the key → **Verify**.

If Pro doesn't work for you, or isn't what you expected, reply to your Gumroad receipt email within 30 days and we will refund you in full. Keys from refunded or charged-back purchases fail verification. Pro stays active offline until you press **Re-check**; the plugin never re-checks by itself.

## Network use, privacy and data

- **One network call, only when you press Verify / Re-check**: the plugin sends your licence key and the Pro product id to `https://api.gumroad.com/v2/licenses/verify` (Gumroad's licence API). It does not increase the licence's use count. Nothing else is sent.
- The settings tab has a "Get a licence key" link to this README. It opens in your browser only when you click it; the plugin loads nothing for it.
- **No network call at startup, in the background, or during import.** Importing works fully offline.
- **No telemetry, analytics, ads or tracking.** No server of ours is involved.
- Your licence key and settings are stored locally in the plugin's `data.json` inside your vault. Your documents never leave your computer.
- The plugin reads only the `.docx` files you pick, and writes notes and images into your vault.

## Install

- **From the community directory**: not listed yet. This line will change only after the directory accepts the plugin.
- **Manually**: download `main.js` and `manifest.json` from the latest GitHub release into `<your vault>/.obsidian/plugins/docx-review-import/`, then enable the plugin under Community plugins. Desktop only.

## Known limits (honest status)

- **Tracked changes:**
  - Changes to a paragraph mark (a merged or split paragraph) are ignored.
  - Formatting changes that Word tracks (bold, style, paragraph format) are ignored.
  - Changes inside text boxes are not handled.
  - In Mark mode, an insertion nested inside a deletion is shown as part of the deletion.
  - Moved text is shown as a deletion at the old place plus an insertion at the new place, not as a "move".
- **Tests used synthetic files**: documents built by us for the tests, with invented reviewer names. **No file saved by Microsoft Word or LibreOffice was tested**, so real-world files may behave differently.
- **Real-app testing: Obsidian 1.13.7 on Linux desktop, exact 0.2.0 build** (`main.js` sha256 b5b6d7ff…6eca, 35 automated tests pass), together with Track Changes 2.2.0 as the only other plugin. Plugin loads; free import (comments with a reply thread, footnote, image extraction, re-import with an image-name collision, whose link renders); batch import is free; Pro mark, accept and reject give correct output with **Pro forced on in the test setup, not unlocked with a real licence key**; Verify with an invalid key shows "Gumroad does not recognise this licence key." and saves nothing. With the CriticMarkup style, Track Changes showed the insertions and deletions as styled marks and the comment with its reply as one thread (panel header "1 comment · 4 suggestions"). Clicking accept/reject in Track Changes was not tested. The operating-system file picker was bypassed (the plugin's own import code ran, the dialog did not).
- **A valid licence key has not been verified against the live Gumroad service yet**; only the rejection of an invalid key was observed. The first buyers are that test: if your key does not verify, reply to your Gumroad receipt and the purchase is refunded in full.
- Not tested on Windows, macOS or mobile (the plugin is desktop-only). The minimum Obsidian version, 1.5.0, is an estimate; only 1.13.7 was used (Track Changes itself needs Obsidian 1.13).
- Password-protected files and old `.doc` files are not supported.
- See TESTED.md for the full record.

## Credits and licences

Built on open-source libraries, with thanks to their authors:
- [mammoth.js](https://github.com/mwilliamson/mammoth.js), BSD-2-Clause, by Michael Williamson.
- [turndown](https://github.com/mixmark-io/turndown), MIT, by Dom Christie.
- [JSZip](https://github.com/Stuk/jszip), MIT or GPL-3.0 (used under MIT).
- [@xmldom/xmldom](https://github.com/xmldom/xmldom), MIT.

Their licence notices are in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). This plugin is MIT licensed (see `LICENSE`).

## Support

Report problems on the GitHub issues page of this repository. Made by Quillfern (AI-assisted).

"Word" and "Obsidian" are trademarks of their respective owners. Not affiliated with Microsoft or Obsidian.
