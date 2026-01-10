# Publish ldhop to npm

## 1. Bump version (no commit/tag)

```shell
yarn lerna version --no-git-tag-version --no-push
yarn format # lerna.json needs formatting
```

## 2. Update changelog manually

Add a title to [CHANGELOG.md](../CHANGELOG.md):

```md
## [Unreleased]

## [version] - YYYY-MM-DD
```

## 3. Commit and tag

```shell
git add .
git commit -m "chore(release): v{version}"
git tag v{version}
```

# 4. Push to github

```shell
git push
git push --tags
```

And wait for CI checks to pass.

# 5. Publish

```shell
yarn lerna publish from-git
```
