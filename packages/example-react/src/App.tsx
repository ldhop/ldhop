import {
  ISessionInfo,
  handleIncomingRedirect,
} from '@inrupt/solid-client-authn-browser'
import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import styles from './App.module.scss'

export const App = () => {
  const [info, setInfo] = useState<ISessionInfo>()
  useEffect(() => {
    handleIncomingRedirect({ restorePreviousSession: true }).then(session => {
      setInfo(session)
    })
  }, [])

  return (
    <div className={styles.test}>
      <header>
        <Link to="/">Home</Link> <Link to="/example">Example</Link>{' '}
        <Link to="/example-legacy">Legacy</Link>{' '}
        {!info ? (
          '...'
        ) : info.isLoggedIn ? (
          <>
            {info.webId} <Link to="/logout">Sign out</Link>
          </>
        ) : (
          <Link to="/login">Sign in</Link>
        )}
      </header>
      <Outlet />
    </div>
  )
}
