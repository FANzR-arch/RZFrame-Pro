# Changelog

All notable changes to this project will be documented in this file.

## [2.7.3] - 2026-02-08
### Added
- **Automatic Logo Detection**: Infers brand from Exif `Make` Tag.
- **Logo Cycling**: Support for multiple logo variants (Black, White, etc.) with a dedicated UI button.
- **Custom Logo Persistence**: Allows users to upload a custom logo for a brand and persist it for future imports.
- **Import Folder**: Batch import logo libraries to `userData` directory.

### Improved
- **UI Layout**: Optimized logo controls placement; moved cycle button to the left of preview.
- **Fuzzy Matching**: Enhanced backend brand matching logic to handle corporate suffixes and non-alphanumeric characters.

## [2.7.2] - 2026-02-06
### Added
- Professional EXIF data reading with `exiftool`.
- Support for multiple frame templates (Classic, Cinema, Float).
- Batch processing and export capabilities.
- Support for custom fonts and color pickers.
- Logo management with scaling and inversion.
- Multi-language support (English, Japanese, Chinese).
- Dark/Light mode theme.

### Fixed
- Fixed font display issues on Windows.
- Improved metadata fetching reliability.

### Changed
- Refactored renderer process for better performance and maintainability.
- Updated UI with glassmorphism styles.
