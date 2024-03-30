export const getContainer = (uri: string): string => {
  const url = new URL(uri)
  url.hash = ''
  url.search = ''
  if (url.pathname.length === 0 || url.pathname === '/') return url.toString()
  const pathPieces = url.pathname.split('/').slice(0, -1)
  pathPieces.push('')
  url.pathname = pathPieces.join('/')

  return url.toString()
}

/**
 * Convert (http) uri to uri with https://
 */
export const https = (uri: string): string => {
  const url = new URL(uri)
  url.protocol = 'https'
  return url.toString()
}
