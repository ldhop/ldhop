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
import type { LdhopQuery } from '@ldhop/core'
import { useLdhopQuery } from '@ldhop/react'

const query: LdhopQuery<'?start1' | '?start2' | '?variable1' | '?variable2'> = [
  // ... the query
]

const { variables, quads, store, engine, isLoading, isFetching } =
  useLdhopQuery(
    useMemo(() => ({
      query, // LDhop query
      variables: {
        '?start1': new Set([uri1, uri2]),
        '?start2': new Set([uri3]),
      },
      fetch, // default or custom fetch, perhaps authenticated
    })),
  )
```
