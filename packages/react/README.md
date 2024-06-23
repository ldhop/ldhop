# `@ldhop/react`

Follow your nose through linked data resources with React

## Installation

Install the package

```bash
yarn add @ldhop/react
# or
npm install --save @ldhop/react
```

Install peer dependencies

```bash
yarn add react @tanstack/react-query
# or
npm install --save react @tanstack/react-query
```

## Usage

[Learn how to write a LDhop query](https://npmjs.com/package/@ldhop/core#query)

```ts
import { useLDhopQuery } from '@ldhop/react'

const query: RdfQuery = [
  // ... the query
]

const { isLoading, variables, quads } = useLDhopQuery({
  query, // LDhop query
  variables: useMemo(() => ({ person: [webId] }), [webId]), // starting points (memoized)
  fetch, // default or custom fetch, perhaps authenticated
})
```
