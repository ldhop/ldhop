import {
  KeyPair,
  buildAuthenticatedFetch,
  createDpopHeader,
  generateDpopKeyPair,
} from '@inrupt/solid-client-authn-core'

type Fetch = typeof globalThis.fetch

// https://communitysolidserver.github.io/CommunitySolidServer/6.x/usage/client-credentials/#generating-a-token
export const generateToken = async ({
  provider,
  email,
  password,
  tokenName = 'my-token',
  fetch = globalThis.fetch,
}: {
  provider: string
  email: string
  password: string
  tokenName?: string
  fetch?: Fetch
}) => {
  // This assumes your server is started under http://localhost:3000/.
  // This URL can also be found by checking the controls in JSON responses when interacting with the IDP API,
  // as described in the Identity Provider section.
  const response = await fetch(`${provider}/idp/credentials/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // The email/password fields are those of your account.
    // The name field will be used when generating the ID of your token.
    body: JSON.stringify({ email, password, name: tokenName }),
  })

  if (!response.ok) {
    throw new Error(
      `request failed with ${response.status} ${await response.text()}`,
    )
  }

  // These are the identifier and secret of your token.
  // Store the secret somewhere safe as there is no way to request it again from the server!
  const { id, secret } = (await response.json()) as {
    id: string
    secret: string
  }

  return { id, secret }
}

// https://communitysolidserver.github.io/CommunitySolidServer/6.x/usage/client-credentials/#requesting-an-access-token
export const requestAccessToken = async ({
  provider,
  id,
  secret,
  fetch = globalThis.fetch,
}: {
  provider: string
  id: string
  secret: string
  fetch?: Fetch
}) => {
  // A key pair is needed for encryption.
  // This function from `solid-client-authn` generates such a pair for you.
  const dpopKey = await generateDpopKeyPair()

  // These are the ID and secret generated in the previous step.
  // Both the ID and the secret need to be form-encoded.
  const authString = `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`
  // This URL can be found by looking at the "token_endpoint" field at
  // http://localhost:3000/.well-known/openid-configuration
  // if your server is hosted at http://localhost:3000/.
  const tokenUrl = `${provider}/.oidc/token`
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      // The header needs to be in base64 encoding.
      authorization: `Basic ${Buffer.from(authString).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
      dpop: await createDpopHeader(tokenUrl, 'POST', dpopKey),
    },
    body: 'grant_type=client_credentials&scope=webid',
  })

  if (!response.ok) {
    throw new Error(
      `request failed with ${response.status} ${await response.text()}`,
    )
  }

  // This is the Access token that will be used to do an authenticated request to the server.
  // The JSON also contains an "expires_in" field in seconds,
  // which you can use to know when you need request a new Access token.
  const { access_token: accessToken } = (await response.json()) as {
    access_token: string
  }

  return { accessToken, dpopKey }
}

// https://communitysolidserver.github.io/CommunitySolidServer/6.x/usage/client-credentials/#using-the-access-token-to-make-an-authenticated-request
export const authenticateFetch = async ({
  dpopKey,
  accessToken,
  fetch = globalThis.fetch,
}: {
  dpopKey: KeyPair
  accessToken: string
  fetch?: Fetch
}) => {
  // The DPoP key needs to be the same key as the one used in the previous step.
  // The Access token is the one generated in the previous step.
  const authFetch = await buildAuthenticatedFetch(fetch, accessToken, {
    dpopKey,
  })
  // authFetch can now be used as a standard fetch function that will authenticate as your WebID.
  return authFetch
}

export const getAuthenticatedFetch = async ({
  provider,
  email,
  password,
  fetch = globalThis.fetch,
}: {
  provider: string
  email: string
  password: string
  fetch?: Fetch
}) => {
  const { id, secret } = await generateToken({
    provider,
    email,
    password,
    fetch,
  })
  const { dpopKey, accessToken } = await requestAccessToken({
    provider,
    id,
    secret,
    fetch,
  })

  const authenticatedFetch = authenticateFetch({ dpopKey, accessToken, fetch })

  return authenticatedFetch
}
