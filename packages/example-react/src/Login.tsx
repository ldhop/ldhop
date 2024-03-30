import { login } from '@inrupt/solid-client-authn-browser'
import { ChangeEventHandler, FormEventHandler, useState } from 'react'

export const Login = () => {
  const [issuer, setIssuer] = useState(
    localStorage.getItem('issuerInput') ?? '',
  )

  const handleSubmit: FormEventHandler<HTMLFormElement> = async e => {
    e.preventDefault()

    const previous = localStorage.getItem('issuerInput') ?? ''
    localStorage.setItem('issuerInput', issuer)
    try {
      await login({
        oidcIssuer: issuer,
        redirectUrl: new URL('/', window.location.href).toString(),
        clientName: 'react ldhop example',
      })
    } catch {
      localStorage.setItem('issuerInput', previous)
    }
  }

  const handleChange: ChangeEventHandler<HTMLInputElement> = e => {
    setIssuer(e.target.value)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" value={issuer} onChange={handleChange} />
      <input type="submit" value="Continue" />
    </form>
  )
}
