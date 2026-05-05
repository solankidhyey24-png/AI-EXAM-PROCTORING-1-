/**
 * ProtectedTeacherRoute.jsx
 * -------------------------
 * A route guard component that ensures only authenticated teachers
 * can access wrapped pages.
 *
 * Usage:
 *   <ProtectedTeacherRoute>
 *     <TeacherDashboard />
 *   </ProtectedTeacherRoute>
 *
 * If the user is not authenticated or the token is expired,
 * redirects to /teacher-login automatically.
 */

import { Navigate } from 'react-router-dom'

const TOKEN_KEY   = 'teacher_token'
const TEACHER_KEY = 'teacher_info'

function isTokenValid(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export default function ProtectedTeacherRoute({ children }) {
  const token      = localStorage.getItem(TOKEN_KEY)
  const teacherRaw = localStorage.getItem(TEACHER_KEY)

  // No token at all — redirect to login
  if (!token || !teacherRaw) {
    return <Navigate to="/teacher-login" replace />
  }

  // Token expired or malformed — clean up and redirect
  if (!isTokenValid(token)) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TEACHER_KEY)
    return <Navigate to="/teacher-login" replace />
  }

  return children
}
