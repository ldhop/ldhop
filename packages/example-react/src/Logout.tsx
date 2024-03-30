import { logout } from '@inrupt/solid-client-authn-browser'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

export const Logout = () => {
  const queryClient = useQueryClient()
  useEffect(() => {
    logout().then(() => {
      queryClient.clear()
      window.location.href = '/'
    })
  }, [queryClient])
  return null
}
