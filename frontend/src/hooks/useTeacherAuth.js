/**
 * useTeacherAuth.js
 * -----------------
 * Custom React hook for teacher authentication state management.
 *
 * Provides:
 *   teacher        — decoded teacher object { id, name, email } or null
 *   isAuthenticated — boolean
 *   login(token, teacherInfo) — persists credentials to localStorage
 *   logout()       — clears credentials and redirects to /teacher-login
 *   authHeader()   — returns { Authorization: "Bearer <token>" } for fetch calls
 *   getToken()     — returns the raw JWT string
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const TOKEN_KEY   = 'teacher_token'
const TEACHER_KEY = 'teacher_info'

/**
 * Checks if a JWT token is still valid based on its exp claim.
 * Returns true if valid, false if expired or malformed.
 */
function isTokenValid(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export function useTeacherAuth() {
  const navigate = useNavigate()

  // Hydrate teacher info from localStorage on mount
  const [teacher, setTeacher] = useState(() => {
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const info  = localStorage.getItem(TEACHER_KEY)
      if (token && info && isTokenValid(token)) {
        return JSON.parse(info)
      }
    } catch { /* ignore parse errors */ }
    return null
  })

  const isAuthenticated = !!teacher

  /** Called after a successful /teacher/login API response */
  const login = (token, teacherInfo) => {
    localStorage.setItem(TOKEN_KEY,   token)
    localStorage.setItem(TEACHER_KEY, JSON.stringify(teacherInfo))
    setTeacher(teacherInfo)
  }

  /** Clears all auth state and redirects to login */
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TEACHER_KEY)
    setTeacher(null)
    navigate('/teacher-login', { replace: true })
  }

  /** Returns the Authorization header object for authenticated fetch calls */
  const authHeader = () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token && isTokenValid(token)) {
      return { Authorization: `Bearer ${token}` }
    }
    // Token expired — force logout
    logout()
    return {}
  }

  /** Returns the raw JWT string */
  const getToken = () => localStorage.getItem(TOKEN_KEY)

  return { teacher, isAuthenticated, login, logout, authHeader, getToken }
}
