import { getAuthToken } from '@/lib/api.ts'

export function useAuth() {
  return { token: getAuthToken() }
}
