# Changelog

All notable changes to DOCX Review Import. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Test status for each version is in [TESTED.md](TESTED.md).

## [0.2.2] - 2026-10-12
### Added
- Comments resolved in Word are marked as resolved in the imported note.

### Fixed
- Tables are imported as Markdown tables instead of one paragraph per cell.
- Strikethrough text is imported as `~~text~~`.

## [0.2.1] - 2026-10-05
### Fixed
- In CriticMarkup style, a reply to a reply was silently dropped; it now joins the thread of its root comment.

### Changed
- The release tag now equals the manifest version.
- Added synthetic Google Docs and Word-for-the-web style test files (no real files saved by those apps were tested).

## [0.2.0] - 2026-10-04
Renamed from "Redline Import". Versions 0.1.x were released in the separate repository `redline-import` and are not tagged here.

### Added
- CriticMarkup output style.
- Batch import is now part of the free version.

### Fixed
- Links to re-imported images with parentheses in the file name now render.

### Known issues
- Tracked changes are accepted silently in the free import.
- Not tested: files saved by Word or LibreOffice, Windows, macOS, mobile. Desktop only.

[0.2.1]: https://github.com/MegatronJeremy/docx-review-import/compare/0.2.0...0.2.1
[0.2.0]: https://github.com/MegatronJeremy/docx-review-import/releases/tag/0.2.0
