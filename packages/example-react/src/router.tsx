import { createBrowserRouter } from 'react-router-dom'
import { App } from './App'
import { Example } from './Example'
import { Login } from './Login'
import { Logout } from './Logout'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { path: 'example', element: <Example /> },
      { path: 'login', element: <Login /> },
      { path: 'logout', element: <Logout /> },
    ],
  },
])
