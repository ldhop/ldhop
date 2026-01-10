# Publish ldhop to npm

## 1. Bump version (no commit/tag)

```
yarn lerna version --no-git-tag-version --no-push
```

## 2. Update changelog manually

Add a title `## [version] - YYYY-MM-DD` to [CHANGELOG.md](../CHANGELOG.md) just under `## [Unreleased]`.

## 3. Commit and tag

```
git add .
git commit -m "chore(release): v{version}"
git tag v{version}
```

# 4. Push to github

```
git push
git push --tags
```

And wait for CI checks to pass.

# 5. Publish

```
yarn lerna publish from-git
```
