# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Updated repository URLs in package.json
- Fixed README badge URLs and references
- Clarified that SDK doesn't require environment variables (credentials are passed programmatically)
- Updated documentation to better reflect SDK usage

### Removed
- Removed confusing encryption utilities exports (not needed for SDK functionality)
- Removed misleading `.env.example` file (this is a library, not an application)
- Removed CHANGELOG.md from npm package (development artifact only)

### Improved
- Smaller bundle size (reduced by ~3-4 KB)

## [1.0.12] - 2025-01-09

### Fixed
- Improved error handling for DPD API responses
- Fixed label generation error parsing
- Updated internal documentation and metadata

## [1.0.6] - 2025-01-08

### Fixed
- Properly handle DPD API error responses in generateLabel

## [1.0.0] - 2024-01-04

### Added
- Initial release of DPD Local SDK
- Complete DPD API integration (authentication, shipments, labels, tracking)
- Database-agnostic adapter pattern
- TypeScript-first design with full type definitions
- Address validation using postcodes.io API
- Automatic token management and caching
- Request retry logic with exponential backoff
- Comprehensive error handling
- Detailed logging system
- Encryption utilities for sensitive data
- Configuration factory function
- Helper functions for pricing, dates, and tracking
- Example adapters for Firestore and Firebase Storage
- Complete documentation and usage examples

### Features
- ✅ Create shipments with DPD
- ✅ Generate and upload shipping labels (thermal/A4)
- ✅ Validate UK delivery addresses
- ✅ Save and manage customer addresses
- ✅ Calculate shipping costs and delivery fees
- ✅ Track shipments
- ✅ Multi-parcel support
- ✅ Service selection (Next Day, By 12 PM)
- ✅ Customer notifications (email, SMS via DPD)
- ✅ Comprehensive logging and audit trail

[Unreleased]: https://github.com/TheJazzDev/dpd-local-sdk/compare/v1.0.12...HEAD
[1.0.12]: https://github.com/TheJazzDev/dpd-local-sdk/compare/v1.0.6...v1.0.12
[1.0.6]: https://github.com/TheJazzDev/dpd-local-sdk/compare/v1.0.0...v1.0.6
[1.0.0]: https://github.com/TheJazzDev/dpd-local-sdk/releases/tag/v1.0.0
