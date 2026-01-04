# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/your-org/dpd-local-sdk/releases/tag/v1.0.0
