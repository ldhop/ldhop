# `css-authn`

Utilities to authenticate to Community Solid Server via its API

Supported versions are 6.x and 7.x

## Usage

```ts
import { getAuthenticatedFetch, createAccount } from 'css-authn/dist/7.x'

// the methods return a Promise, so you can wrap them in async function, and await them...
// get authenticated fetch
const authenticatedFetch = await getAuthenticatedFetch({
  email: 'email@example',
  password: 'password',
  provider: 'https://solidserver.example', // no trailing slash!
  webId: 'https://solidserver.example/person/profile/card#me' // (optional) if there are multiple webIds associated with the account, you need to specify which one to authenticate with
  fetch, // (optional) you can also provide your own fetch compatible with native Node fetch
})

// in version 7, there's also a method to create account and pod
await createAccount({
  username: 'username',
  password: 'password',
  email: 'email@example.com',
  provider: 'https://solidserver.example', // no trailing slash!
  fetch, // (optional) you can also provide your own fetch compatible with native Node fetch
})
```
