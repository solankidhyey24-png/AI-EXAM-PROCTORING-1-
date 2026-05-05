import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import JoinExam from './pages/JoinExam'
import PreExamCheck from './pages/PreExamCheck'
import Exam from './pages/Exam'
import TeacherDashboard from './pages/TeacherDashboard'
import TeacherLogin from './pages/TeacherLogin'
import ProtectedTeacherRoute from './components/ProtectedTeacherRoute'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        <Routes>
          {/* ── Student Routes ──────────────────────────────────────────── */}
          <Route path="/" element={<Navigate to="/join" replace />} />
          <Route path="/join" element={<JoinExam />} />
          <Route path="/pre-check" element={<PreExamCheck />} />
          <Route path="/exam" element={<Exam />} />

          {/* ── Teacher Auth ────────────────────────────────────────────── */}
          <Route path="/teacher-login" element={<TeacherLogin />} />

          {/* ── Teacher Protected Routes ────────────────────────────────── */}
          {/* Exam Hub (no exam selected yet) */}
          <Route
            path="/teacher/dashboard"
            element={
              <ProtectedTeacherRoute>
                <TeacherDashboard />
              </ProtectedTeacherRoute>
            }
          />
          {/* Live monitoring for a specific exam */}
          <Route
            path="/teacher/dashboard/:exam_code"
            element={
              <ProtectedTeacherRoute>
                <TeacherDashboard />
              </ProtectedTeacherRoute>
            }
          />

          {/* ── Legacy redirect (old dashboard URL) ─────────────────────── */}
          <Route path="/dashboard/*" element={<Navigate to="/teacher-login" replace />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/join" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
