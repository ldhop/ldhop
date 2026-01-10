# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0-alpha.8] - 2026-01-10

### Fixed

- **core** - Fix type inference in concat (`LdhopQueryBuilder`).

## [1.0.0-alpha.7] - 2026-01-10

### Changed

- **core** - Keep track of starting point types `S` in `LdhopQueryBuilder<V, S>`

## [1.0.0-alpha.6] - 2026-01-10

### Added

- **react** - Allow globally configuring the React Query key via `configureQueryKey`. Export `DEFAULT_QUERY_KEY`.
- **core** - Add a query builder.
- **react** - `useLdhopQuery` also accepts `LdhopQueryBuilder`.

## [1.0.0-alpha.5] - 2025-12-30

### Changed

- **core** - Generalize type of input variables to Iterable.

### Removed

- **core** - Remove some unused types.

## [1.0.0-alpha.4] - 2025-12-29

### Added

- **core**, **react** - Support variables without `?` as starting points. This API may change before v1.0.
- **core** - Add method `getAllPlainVariables` to `LdhopEngine` to get the result variables without `?`. This API may change before v1.0.
- **core** - Add a helper method `getVariableNames(query)` that returns set of all variables within a LdhopQuery.

### Changed

- **react** - **BREAKING CHANGE** - Result variables in `useLdhopQuery` are plain variables. This API may change before v1.0.

## [1.0.0-alpha.3] - 2025-12-25

### Added

- **core** - Export additional types.
- **core** - Add `onQuadsChanged` callback to LdhopEngine.
- **react** - Implement `useLdhopQuery` hook.

### Deprecated

- **react** - `useLDhopQuery` is deprecated in favour of `useLdhopQuery` and will be removed in version 1.0.

## [1.0.0-alpha.2] - 2025-12-21

### Fixed

- **core** - Use response url as baseIRI in fetchRdfDocument, to handle relative IRIs correctly when there is a redirect.

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
