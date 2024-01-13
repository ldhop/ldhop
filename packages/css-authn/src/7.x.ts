import {
  buildAuthenticatedFetch,
  createDpopHeader,
  generateDpopKeyPair,
} from '@inrupt/solid-client-authn-core'
import tough from 'tough-cookie'

type AccountHandles = {
  controls: {
    password: { login: string; create: string }
    account: { webId: string; pod: string; clientCredentials: string }
  }
}

type Fetch = typeof globalThis.fetch

export const getAuthenticatedFetch = async ({
  provider,
  email,
  password,
  webId,
  fetch = globalThis.fetch,
}: {
  provider: string
  email: string
  password: string
  webId?: string
  fetch?: Fetch
}) => {
  // log in first

  const handlesResponse = await fetch(provider + '/.account/')
  await throwIfResponseNotOk(handlesResponse)

  const handles = (await handlesResponse.json()) as AccountHandles

  const loginResponse = await fetch(handles.controls.password.login, {
    method: 'post',
    body: JSON.stringify({ email, password }),
    headers: { 'content-type': 'application/json' },
  })

  await throwIfResponseNotOk(loginResponse)

  const jar = new tough.CookieJar()
  const accountCookie = loginResponse.headers.get('set-cookie')

  if (!accountCookie)
    throw new Error('unexpectedly authorization cookie not available')
  await jar.setCookie(accountCookie, provider)

  // get cookie
  const cookie = await jar.getCookieString(provider)

  // This assumes your server is started under http://localhost:3000/.
  // It also assumes you have already logged in and `cookie` contains a valid cookie header
  // as described in the API documentation.
  const indexResponse = await fetch(provider + '/.account/', {
    headers: { cookie },
  })

  await throwIfResponseNotOk(indexResponse)

  const { controls } = (await indexResponse.json()) as AccountHandles

  // now let's get all available webIds

  const webIdsResponse = await fetch(controls.account.webId, {
    headers: { cookie },
  })

  await throwIfResponseNotOk(webIdsResponse)

  const webIdsBody = (await webIdsResponse.json()) as { webIdLinks: string }

  const webIds = Object.keys(webIdsBody.webIdLinks)

  // get web id that is linked to this account. We take one of the available, or the one provided in params
  const getWebId = (webIds: string[], webId?: string) => {
    if (webIds.length === 0)
      throw new Error('no webId associated with this account')

    if (!webId) return webIds[0]

    if (!webIds.includes(webId))
      throw new Error("linked webIds don't include provided webId")

    return webId
  }

  const linkedWebId = getWebId(webIds, webId)

  const response = await fetch(controls.account.clientCredentials, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    // The name field will be used when generating the ID of your token.
    // The WebID field determines which WebID you will identify as when using the token.
    // Only WebIDs linked to your account can be used.
    body: JSON.stringify({
      name: 'my-token',
      webId: linkedWebId,
    }),
  })

  await throwIfResponseNotOk(response)

  // These are the identifier and secret of your token.
  // Store the secret somewhere safe as there is no way to request it again from the server!
  // The `resource` value can be used to delete the token at a later point in time.
  const { id, secret /*, resource*/ } = (await response.json()) as {
    id: string
    secret: string
  }

  // **************************************************

  // A key pair is needed for encryption.
  // This function from `solid-client-authn` generates such a pair for you.
  const dpopKey = await generateDpopKeyPair()

  // These are the ID and secret generated in the previous step.
  // Both the ID and the secret need to be form-encoded.
  const authString = `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`
  // This URL can be found by looking at the "token_endpoint" field at
  // http://localhost:3000/.well-known/openid-configuration
  // if your server is hosted at http://localhost:3000/.
  const tokenUrl = provider + '/.oidc/token'
  const response2 = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      // The header needs to be in base64 encoding.
      authorization: `Basic ${Buffer.from(authString).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
      dpop: await createDpopHeader(tokenUrl, 'POST', dpopKey),
    },
    body: 'grant_type=client_credentials&scope=webid',
  })
  await throwIfResponseNotOk(response2)

  // This is the Access token that will be used to do an authenticated request to the server.
  // The JSON also contains an "expires_in" field in seconds,
  // which you can use to know when you need request a new Access token.
  const { access_token: accessToken } = (await response2.json()) as {
    access_token: string
  }

  // *********************************************

  // The DPoP key needs to be the same key as the one used in the previous step.
  // The Access token is the one generated in the previous step.
  const authFetch = await buildAuthenticatedFetch(fetch, accessToken, {
    dpopKey,
  })
  // authFetch can now be used as a standard fetch function that will authenticate as your WebID.
  // This request will do a simple GET for example.
  return authFetch
}

const throwIfResponseNotOk = async (response: Response) => {
  if (!response.ok)
    throw new Error(
      `Query was not successful: ${response.status} ${await response.text()}`,
    )
}

export const createAccount = async ({
  username,
  password,
  email,
  provider,
  fetch = globalThis.fetch,
}: {
  username: string
  password?: string
  email?: string
  provider: string
  fetch?: Fetch
}) => {
  password ??= 'correcthorsebatterystaple'
  email ??= username + '@example.org'
  const config = {
    idp: provider + '/',
    podUrl: `${provider}/${username}/`,
    webId: `${provider}/${username}/profile/card#me`,
    username,
    password,
    email,
  }

  const accountEndpoint = provider + '/.account/account/'

  // create the account
  const response = await fetch(accountEndpoint, { method: 'post' })
  await throwIfResponseNotOk(response)

  const jar = new tough.CookieJar()
  const accountCookie = response.headers.get('set-cookie')

  if (!accountCookie)
    throw new Error('unexpectedly authorization cookie not available')
  await jar.setCookie(accountCookie, provider)

  // get account handles
  const response2 = await fetch(provider + '/.account/', {
    headers: { cookie: await jar.getCookieString(provider) },
  })
  await throwIfResponseNotOk(response2)

  const handles = (await response2.json()) as AccountHandles

  const createLoginResponse = await fetch(handles.controls.password.create, {
    method: 'post',
    body: JSON.stringify({ email, password, confirmPassword: password }),
    headers: {
      'content-type': 'application/json',
      cookie: await jar.getCookieString(handles.controls.password.create),
    },
  })
  await throwIfResponseNotOk(createLoginResponse)

  const response3 = await fetch(handles.controls.account.pod, {
    method: 'post',
    headers: {
      cookie: await jar.getCookieString(handles.controls.account.pod),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ name: username }),
  })

  await throwIfResponseNotOk(response3)

  return config
}
