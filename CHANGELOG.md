# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0-alpha.1] - 2025-11-30

### Added

- **core** - Implement `LdhopEngine` [callbacks](./packages/core/README.md#callbacks).

## [1.0.0-alpha.0] - 2025-08-24

### Added

- **core** - Implement new `LdhopEngine` API.
- **core** - Detect and remove orphaned cycles.
- **core** - Track resource redirects in graph management.

### Deprecated

- **core** - `QueryAndStore` is deprecated in favor of `LdhopEngine` (will be removed in version 1.0).
- **core** - Type `RdfQuery` is deprecated in favor of `LdhopQuery`.

## [0.1.1] - 2025-02-19

### Fixed

- **core**: Send `Accept` header with supported mime-types when fetching a resource.
- **example-react**: Recreate yarn.lock to get rid of @tanstack/react-query duplicate.

## [0.1.0] - 2025-01-25

### Fixed

- **core**: Fix incorrect move in hop logic when variable is other than subject. [d453752eebf07c83e633634a8477bcc1483ba5a0]
- **core**: Add missing `error` to failed request in `run` helper. [d453752eebf07c83e633634a8477bcc1483ba5a0]

### Documentation

- Start using [Conventional Commits](https://www.conventionalcommits.org).
- Add this changelog following [Keep a Changelog](https://keepachangelog.com). [ff9716f1cc93437f18e7916560f885acea41dc6a]

## [0.0.1-alpha.16] - 2024-10-02

### Added

- All changes until this point
