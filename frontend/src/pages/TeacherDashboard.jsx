import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTeacherAuth } from '../hooks/useTeacherAuth'
import {
  ShieldCheck, LayoutDashboard, Eye, Users, BarChart2, Settings,
  LogOut, Bell, FileText, GraduationCap, Radio, Search,
  SlidersHorizontal, Plus, X, Loader2, Clock, AlertTriangle,
  ArrowLeft, Camera, Copy, Check, Activity, Trash2,
  UserX, Pause, Play, ArrowDownWideNarrow, StopCircle, ChevronRight,
} from 'lucide-react'

// ── Shared: Sidebar nav item ──────────────────────────────────────────────────
function SidebarItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-colors text-left ${
        active
          ? 'bg-[#eef5f0] text-[#3d6b52]'
          : 'text-[#777] hover:bg-[#f5f2ec] hover:text-[#1a1a1a]'
      }`}
    >
      <span className={active ? 'text-[#3d6b52]' : 'text-[#bbb]'}>{icon}</span>
      {label}
    </button>
  )
}

// ── Shared: Left Sidebar ──────────────────────────────────────────────────────
function Sidebar({ teacher, logout, activeItem = 'dashboard' }) {
  const navigate = useNavigate()

  const navItems = [
    { id: 'dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
  ]

  return (
    <aside className="w-[210px] bg-white border-r border-[#ece9e4] flex flex-col fixed left-0 top-0 bottom-0 z-20 shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#f0ede8]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#3d4a3e] rounded-lg flex items-center justify-center shrink-0">
            <ShieldCheck size={15} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-[15px] text-[#1a1a1a] leading-none">ProctorAI</p>
            <p className="text-[9px] text-[#bbb] uppercase tracking-widest mt-0.5">Admin Console</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(item => (
          <SidebarItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeItem === item.id}
            onClick={() => item.id === 'dashboard' && navigate('/teacher/dashboard')}
          />
        ))}
      </nav>

      {/* Teacher profile + logout */}
      <div className="px-4 py-4 border-t border-[#f0ede8]">
        <div className="flex items-center gap-2.5 mb-3">
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(teacher?.name || 'T')}&background=3d4a3e&color=fff&bold=true&rounded=true`}
            alt={teacher?.name}
            className="w-9 h-9 rounded-full shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[#1a1a1a] truncate">{teacher?.name}</p>
            <p className="text-[10px] text-[#bbb] uppercase tracking-wide">Chief Proctor</p>
          </div>
        </div>
        <button
          id="logout-btn"
          onClick={logout}
          className="w-full flex items-center gap-2 text-[12px] text-[#aaa] hover:text-red-500 transition-colors font-medium py-1"
        >
          <LogOut size={13} /> Sign Out
        </button>
      </div>
    </aside>
  )
}

// ── Root: decides which view to render ───────────────────────────────────────
export default function TeacherDashboard() {
  const { exam_code } = useParams()
  const { teacher, logout, authHeader } = useTeacherAuth()

  if (!exam_code) {
    return <ExamHub teacher={teacher} logout={logout} authHeader={authHeader} />
  }
  return (
    <MonitoringView
      examCode={exam_code}
      teacher={teacher}
      logout={logout}
      authHeader={authHeader}
    />
  )
}


// ══════════════════════════════════════════════════════════════════════════════
// EXAM HUB — light theme matching the reference design
// ══════════════════════════════════════════════════════════════════════════════
function ExamHub({ teacher, logout, authHeader }) {
  const navigate = useNavigate()

  const [exams, setExams]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [showCreate, setShowCreate]   = useState(false)
  const [newExam, setNewExam]         = useState({ exam_name: '', duration: 60 })
  const [creating, setCreating]       = useState(false)
  const [createError, setCreateError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab]     = useState('live')
  const [copiedCode, setCopiedCode]   = useState(null)

  useEffect(() => { fetchExams() }, [])

  const fetchExams = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/teacher/exams', {
        headers: { 'Content-Type': 'application/json', ...authHeader() },
      })
      if (res.status === 401) { logout(); return }
      if (!res.ok) throw new Error('Failed to load exams')
      setExams(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateExam = async (e) => {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('http://127.0.0.1:8000/create_exam', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body:    JSON.stringify(newExam),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to create exam')
      setExams(prev => [...prev, {
        id: data.exam_id, exam_name: newExam.exam_name,
        exam_code: data.exam_code, duration: newExam.duration, student_count: 0,
      }])
      setNewExam({ exam_name: '', duration: 60 })
      setShowCreate(false)
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteExam = async (exam_code) => {
    if (!window.confirm("Are you sure you want to delete this exam? All associated data will be lost.")) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/delete_exam/${exam_code}`, {
        method: 'DELETE',
        headers: { ...authHeader() },
      })
      if (!res.ok) throw new Error('Failed to delete exam')
      setExams(prev => prev.filter(e => e.exam_code !== exam_code))
    } catch (err) {
      console.error(err)
      alert("Failed to delete exam: " + err.message)
    }
  }

  const copyCode = (code) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const totalStudents = exams.reduce((a, e) => a + (e.student_count || 0), 0)
  const filtered = exams.filter(e =>
    e.exam_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.exam_code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex min-h-screen bg-[#f0ede8] font-sans">
      <Sidebar teacher={teacher} logout={logout} activeItem="dashboard" />

      <main className="ml-[210px] flex-1 min-h-screen flex flex-col">

        {/* ── Top Header ─────────────────────────────────────────────────── */}
        <header className="bg-white border-b border-[#ece9e4] px-8 h-[60px] flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-8">
            <h1 className="text-[20px] font-bold text-[#1a1a1a] tracking-tight">Exam Hub</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="ml-1 px-4 py-1.5 bg-[#1a1a1a] hover:bg-[#2d2d2d] text-white text-[12px] font-bold rounded-full transition-colors tracking-wide"
            >
              CREATE NEW EXAM
            </button>
          </div>
        </header>

        <div className="flex-1 px-8 py-6 space-y-6">

          {/* ── Stats Row ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">

            {/* Total Exams */}
            <div className="bg-white rounded-2xl p-6 border border-[#ece9e4] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-start justify-between mb-5">
                <div className="w-11 h-11 bg-[#f0faf4] rounded-xl flex items-center justify-center">
                  <FileText size={20} className="text-[#3d6b52]" />
                </div>
                {!loading && (
                  <span className="text-[11px] font-bold text-[#3d6b52] bg-[#eef7f1] px-2.5 py-1 rounded-full">
                    +12% this week
                  </span>
                )}
              </div>
              <p className="text-[11px] font-bold text-[#bbb] uppercase tracking-widest mb-1">Total Exams</p>
              <p className="text-[40px] font-bold text-[#1a1a1a] leading-none tracking-tight">
                {loading ? '—' : exams.length}
              </p>
            </div>

            {/* Total Students */}
            <div className="bg-white rounded-2xl p-6 border border-[#ece9e4] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="mb-5">
                <div className="w-11 h-11 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                  <GraduationCap size={20} className="text-[#5c73c4]" />
                </div>
              </div>
              <p className="text-[11px] font-bold text-[#bbb] uppercase tracking-widest mb-1">Total Students</p>
              <p className="text-[40px] font-bold text-[#1a1a1a] leading-none tracking-tight">
                {loading ? '—' : totalStudents.toLocaleString()}
              </p>
            </div>

            {/* Active Sessions — dark card */}
            <div className="bg-[#3d3d35] rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
              <div className="flex items-start justify-between mb-5">
                <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                  <Radio size={20} className="text-white" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6bcf8a] animate-pulse" />
                  <span className="text-[10px] font-bold text-[#888] uppercase tracking-widest">Live Now</span>
                </div>
              </div>
              <p className="text-[11px] font-bold text-[#888] uppercase tracking-widest mb-1">Active Sessions</p>
              <p className="text-[40px] font-bold text-white leading-none tracking-tight">
                {loading ? '—' : exams.length}
              </p>
            </div>
          </div>

          {/* ── Sessions Section ──────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[17px] font-bold text-[#1a1a1a]">Upcoming & Ongoing Sessions</h2>
                <p className="text-[13px] text-[#aaa] mt-0.5">Monitor real-time academic integrity across all departments.</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="flex items-center gap-2 bg-white border border-[#ddd8d2] rounded-xl px-3 py-2 w-44 shadow-sm">
                  <Search size={13} className="text-[#bbb] shrink-0" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search exams..."
                    className="flex-1 bg-transparent outline-none text-[13px] text-[#1a1a1a] placeholder-[#ccc]"
                  />
                </div>
                {/* Filters */}
                <button className="flex items-center gap-2 bg-white border border-[#ddd8d2] rounded-xl px-3 py-2 text-[13px] text-[#666] hover:bg-[#f5f2ec] transition-colors shadow-sm font-medium">
                  <SlidersHorizontal size={13} className="text-[#aaa]" />
                  Filters
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-48 text-[#bbb] gap-3 text-[14px]">
                <Loader2 size={20} className="animate-spin" /> Loading sessions...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((exam, index) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    index={index}
                    copiedCode={copiedCode}
                    onCopy={() => copyCode(exam.exam_code)}
                    onMonitor={() => navigate(`/teacher/dashboard/${exam.exam_code}`)}
                    onDelete={() => handleDeleteExam(exam.exam_code)}
                  />
                ))}

                {/* Schedule New Exam card */}
                <div
                  onClick={() => setShowCreate(true)}
                  className="border-2 border-dashed border-[#d8d4ce] rounded-2xl min-h-[240px] flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#3d6b52] hover:bg-white transition-all group relative"
                >
                  <div className="w-10 h-10 rounded-full border-2 border-[#d8d4ce] group-hover:border-[#3d6b52] flex items-center justify-center transition-colors">
                    <Plus size={18} className="text-[#bbb] group-hover:text-[#3d6b52] transition-colors" />
                  </div>
                  <p className="text-[14px] font-semibold text-[#bbb] group-hover:text-[#3d6b52] transition-colors">
                    Schedule New Exam
                  </p>
                  {/* Green circular button (bottom right, like in image) */}
                  <div className="absolute bottom-4 right-4 w-9 h-9 bg-[#3d6b52] rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                    <Plus size={16} className="text-white" />
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* ── Create Exam Modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] w-full max-w-md border border-[#ece9e4] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0ede8]">
              <h2 className="text-[16px] font-bold text-[#1a1a1a]">Schedule New Exam</h2>
              <button onClick={() => { setShowCreate(false); setCreateError(null) }} className="text-[#bbb] hover:text-[#555] transition-colors p-1 rounded-lg hover:bg-[#f5f2ec]">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateExam} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-wider mb-2">Exam Name</label>
                <input
                  id="new-exam-name"
                  type="text" required
                  placeholder="e.g. Computer Science Final"
                  value={newExam.exam_name}
                  onChange={(e) => setNewExam({ ...newExam, exam_name: e.target.value })}
                  className="w-full border border-[#e0dbd4] focus:border-[#3d4a3e] focus:ring-2 focus:ring-[#3d4a3e]/10 rounded-xl px-4 py-3 text-[#1a1a1a] placeholder-[#ccc] text-[14px] outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-wider mb-2">Duration (minutes)</label>
                <input
                  id="new-exam-duration"
                  type="number" required min="1" max="480"
                  value={newExam.duration}
                  onChange={(e) => setNewExam({ ...newExam, duration: parseInt(e.target.value) })}
                  className="w-full border border-[#e0dbd4] focus:border-[#3d4a3e] focus:ring-2 focus:ring-[#3d4a3e]/10 rounded-xl px-4 py-3 text-[#1a1a1a] text-[14px] outline-none transition-all"
                />
              </div>
              {createError && (
                <p className="text-red-600 text-[13px] bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{createError}</p>
              )}
              <button
                id="confirm-create-exam"
                type="submit" disabled={creating}
                className="w-full py-3 bg-[#1a1a1a] hover:bg-[#2d2d2d] text-white font-bold text-[14px] rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
              >
                {creating ? <><Loader2 size={15} className="animate-spin" /> Scheduling...</> : 'Schedule Exam'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Exam Card Component ───────────────────────────────────────────────────────
function ExamCard({ exam, index, copiedCode, onCopy, onMonitor, onDelete }) {
  // Mark exams with many students as "attention needed" to demonstrate the state
  const isAttention = exam.student_count >= 100
  const progressPct = Math.min(80, 20 + (exam.student_count || 0) * 1.5)

  if (isAttention) {
    return (
      <div className="bg-[#fff8f5] border border-[#ffd5c2] rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="px-2.5 py-1 bg-[#ffe0cc] text-[#c04010] text-[10px] font-bold uppercase tracking-widest rounded-full">
            Attention Needed
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[#ccc] font-medium">{exam.duration} min</span>
            <button onClick={onDelete} className="text-[#ccc] hover:text-red-500 transition-colors" title="Delete Exam">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <h3 className="text-[17px] font-bold text-[#1a1a1a] leading-tight mb-0.5">{exam.exam_name}</h3>
        <p className="text-[12px] text-[#bbb] font-mono mb-4">{exam.exam_code}</p>
        <div className="flex items-center gap-3 text-[12px] text-[#999] mb-4">
          <span className="flex items-center gap-1.5"><Users size={12} /> {exam.student_count} Students</span>
        </div>
        <div className="flex items-center gap-2 bg-[#fde8d8] border border-[#ffc4a8] rounded-xl px-3 py-2.5 mb-3">
          <AlertTriangle size={13} className="text-[#c04010] shrink-0" />
          <span className="text-[12px] font-bold text-[#c04010]">High Violations Detected</span>
        </div>
        <button
          onClick={onMonitor}
          className="w-full py-2.5 bg-[#c04010] hover:bg-[#a03000] text-white font-bold text-[12px] rounded-xl transition-colors uppercase tracking-wide"
        >
          Review Alerts
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#ece9e4] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-shadow">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="px-2.5 py-1 bg-[#e8f5e9] text-[#2e7d32] text-[10px] font-bold uppercase tracking-widest rounded-full">
          Active Session
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#bbb] font-medium">{exam.duration} min</span>
          <button onClick={onDelete} className="text-[#ccc] hover:text-red-500 transition-colors" title="Delete Exam">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Exam name + code */}
      <h3 className="text-[17px] font-bold text-[#1a1a1a] leading-tight mb-0.5">{exam.exam_name}</h3>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[12px] text-[#bbb] font-mono">{exam.exam_code}</span>
        <button onClick={onCopy} className="text-[#ccc] hover:text-[#3d6b52] transition-colors">
          {copiedCode === exam.exam_code
            ? <Check size={12} className="text-[#3d6b52]" />
            : <Copy size={12} />
          }
        </button>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-[12px] text-[#999] mb-3">
        <span className="flex items-center gap-1.5">
          <Users size={12} className="text-[#ccc]" />
          {exam.student_count || 0} Students
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={12} className="text-[#ccc]" />
          {exam.duration}m left
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-[#f0ede8] rounded-full h-1.5 mb-4">
        <div
          className="bg-[#4caf50] h-1.5 rounded-full transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Monitor button */}
      <button
        id={`monitor-${exam.exam_code}`}
        onClick={onMonitor}
        className="w-full py-2.5 bg-[#1a1a1a] hover:bg-[#2d2d2d] text-white font-bold text-[13px] rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <Radio size={13} />
        Monitor Live
      </button>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
// MONITORING VIEW — light theme
// ══════════════════════════════════════════════════════════════════════════════
const EVENT_LABELS = {
  phone_detected: '📱 Phone Detected',
  multiple_faces: '👥 Multiple Faces',
  no_face:        '👻 Face Not Visible',
  head_turned:    '👀 Head Turned Away',
  looking_away:   '👀 Looking Away',
  tab_switch:     '🔀 Tab Switch Detected',
}

function MonitoringView({ examCode, teacher, logout, authHeader }) {
  const navigate    = useNavigate()
  const socketRef   = useRef(null)
  const host        = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname

  const [students,    setStudents]    = useState([])
  const [alerts,      setAlerts]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [wsConnected, setWsConnected] = useState(false)
  const [accessError, setAccessError] = useState(null)

  const [selectedStudent,   setSelectedStudent]   = useState(null)
  const [evidenceList,      setEvidenceList]       = useState([])
  const [loadingEvidence,   setLoadingEvidence]   = useState(false)
  const [fullScreenImage,   setFullScreenImage]   = useState(null)

  // Teacher controls state
  const [examPaused,      setExamPaused]      = useState(false)
  const [sortBySuspicion, setSortBySuspicion] = useState(false)
  const [kickedStudents,  setKickedStudents]  = useState(new Set())
  const [endedStudents,   setEndedStudents]   = useState(new Set())
  const [detailStudent,   setDetailStudent]   = useState(null)
  const [studentViolations, setStudentViolations] = useState([])
  const [loadingViolations, setLoadingViolations] = useState(false)

  const handleViewEvidence = async (student) => {
    setSelectedStudent(student)
    setLoadingEvidence(true)
    setEvidenceList([])
    try {
      const res = await fetch(`http://${host}:8000/evidence/${examCode}/${student.id}`, {
        headers: { ...authHeader() },
      })
      if (res.ok) setEvidenceList(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoadingEvidence(false) }
  }

  // ── Teacher action handlers ─────────────────────────────────────────────
  const handleKickStudent = async (student) => {
    if (!window.confirm(`Kick ${student.name} from the exam?`)) return
    try {
      const res = await fetch(`http://${host}:8000/teacher/kick_student/${examCode}/${student.id}`, {
        method: 'POST', headers: { ...authHeader() },
      })
      if (!res.ok) throw new Error('Failed')
      setKickedStudents(prev => new Set([...prev, student.id]))
    } catch (err) { alert('Failed to kick student: ' + err.message) }
  }

  const handleEndStudentExam = async (student) => {
    if (!window.confirm(`End exam for ${student.name}?`)) return
    try {
      const res = await fetch(`http://${host}:8000/teacher/end_student_exam/${examCode}/${student.id}`, {
        method: 'POST', headers: { ...authHeader() },
      })
      if (!res.ok) throw new Error('Failed')
      setEndedStudents(prev => new Set([...prev, student.id]))
    } catch (err) { alert('Failed to end student exam: ' + err.message) }
  }

  const handlePauseExam = async () => {
    try {
      const newPaused = !examPaused
      const res = await fetch(`http://${host}:8000/teacher/pause_exam/${examCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ paused: newPaused }),
      })
      if (!res.ok) throw new Error('Failed')
      setExamPaused(newPaused)
    } catch (err) { alert('Failed to toggle pause: ' + err.message) }
  }

  const handleViewDetails = async (student) => {
    setDetailStudent(student)
    setLoadingViolations(true)
    try {
      const res = await fetch(`http://${host}:8000/violations/${examCode}`, {
        headers: { ...authHeader() },
      })
      if (res.ok) {
        const all = await res.json()
        setStudentViolations(all.filter(v => v.student_id === student.id))
      }
    } catch (err) { console.error(err) }
    finally { setLoadingViolations(false) }
  }

  // Fetch students
  useEffect(() => {
    if (!examCode) return
    const fetch_ = async () => {
      try {
        const res = await fetch(`http://${host}:8000/exam_students/${examCode}`, {
          headers: { ...authHeader() },
        })
        if (res.status === 401) { logout(); return }
        if (res.status === 403) { setAccessError('Access denied. This exam belongs to another teacher.'); setLoading(false); return }
        if (!res.ok) throw new Error()
        const data = await res.json()
        setStudents(data.map(s => ({ ...s, status: 'Normal', suspicion_score: 0, last_update: Date.now() })))
      } catch { } finally { setLoading(false) }
    }
    fetch_()
  }, [examCode])

  // WebSocket
  useEffect(() => {
    if (!examCode) return
    let mounted = true
    const connect = () => {
      const ws = new WebSocket(`ws://${host}:8000/ws/monitor/${examCode}`)
      ws.onopen  = () => { if (mounted) setWsConnected(true) }
      ws.onmessage = (e) => {
        if (!mounted) return
        try {
          const d = JSON.parse(e.data)
          // Handle teacher action broadcasts
          if (d.type === 'kick_student') { setKickedStudents(prev => new Set([...prev, d.student_id])); return }
          if (d.type === 'end_student_exam') { setEndedStudents(prev => new Set([...prev, d.student_id])); return }
          if (d.type === 'pause_exam') { setExamPaused(d.paused); return }
          // Batch violation state updates together to minimize re-renders
          const now = Date.now()
          const label = EVENT_LABELS[d.event_type] || d.event_type
          setStudents(prev => prev.map(s =>
            s.id === d.student_id
              ? { ...s, status: label, suspicion_score: d.suspicion_score, last_update: now }
              : s
          ))
          setAlerts(prev => [{
            id: now + Math.random(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            student_id: d.student_id, event: label, score: d.suspicion_score,
          }, ...prev].slice(0, 50))
        } catch { }
      }
      ws.onclose = () => { if (!mounted) return; setWsConnected(false); setTimeout(connect, 3000) }
      socketRef.current = ws
    }
    connect()
    const decay = setInterval(() => {
      if (!mounted) return
      const now = Date.now()
      setStudents(prev => prev.map(s => s.status !== 'Normal' && now - s.last_update > 15000 ? { ...s, status: 'Normal' } : s))
    }, 5000)
    return () => { mounted = false; clearInterval(decay); socketRef.current?.close() }
  }, [examCode])

  const level = (score, status) => score >= 70 || status !== 'Normal' ? 'high' : score >= 30 ? 'medium' : 'low'
  const styles = {
    high:   { badge: 'bg-[#fce8e6] text-[#c5221f]', sparkline: '#ea4335', statusText: 'Alert',      marker: 'bg-[#ea4335]' },
    medium: { badge: 'bg-[#fef3cd] text-[#856404]', sparkline: '#fbbc04', statusText: 'Suspicious', marker: 'bg-[#fbbc04]' },
    low:    { badge: 'bg-[#e8f5e9] text-[#2e7d32]', sparkline: '#4caf50', statusText: 'Normal',     marker: 'bg-[#4caf50]' },
  }

  // Memoize sorted student list — only re-sort when students or sortBySuspicion changes
  const sortedStudents = useMemo(() => {
    if (!sortBySuspicion) return students
    return [...students].sort((a, b) => (b.suspicion_score || 0) - (a.suspicion_score || 0))
  }, [students, sortBySuspicion])

  if (accessError) {
    return (
      <div className="flex min-h-screen bg-[#f0ede8] font-sans">
        <Sidebar teacher={teacher} logout={logout} />
        <main className="ml-[210px] flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm p-8 bg-white rounded-2xl border border-[#ece9e4] shadow-sm">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-2">Access Denied</h2>
            <p className="text-[#888] text-[14px] mb-5">{accessError}</p>
            <button onClick={() => navigate('/teacher/dashboard')} className="px-5 py-2.5 bg-[#1a1a1a] text-white rounded-xl font-semibold text-[14px] hover:bg-[#2d2d2d] transition-colors">
              Back to My Exams
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#f0ede8] font-sans">
      <Sidebar teacher={teacher} logout={logout} activeItem="proctoring" />

      <main className="ml-[210px] flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-white border-b border-[#ece9e4] px-8 h-[60px] flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/teacher/dashboard')} className="flex items-center gap-1.5 text-[#888] hover:text-[#1a1a1a] text-[13px] font-semibold transition-colors">
              <ArrowLeft size={15} /> Exams
            </button>
            <div className="w-px h-4 bg-[#e0dbd4]" />
            <h1 className="text-[18px] font-bold text-[#1a1a1a]">Live Monitor</h1>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${wsConnected ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#fce8e6] text-[#c5221f]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-[#4caf50] animate-pulse' : 'bg-[#ea4335] animate-pulse'}`} />
              {wsConnected ? 'Live' : 'Reconnecting'}
            </div>
            <span className="font-mono text-[12px] text-[#888] bg-[#f5f2ec] border border-[#e8e4de] px-3 py-1 rounded-lg font-bold tracking-widest">
              {examCode}
            </span>
            {examPaused && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-[#fef3cd] text-[#856404]">⏸ Paused</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSortBySuspicion(p => !p)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-colors ${
              sortBySuspicion ? 'bg-[#eef5f0] text-[#3d6b52] border-[#3d6b52]/30' : 'bg-[#f5f2ec] text-[#666] border-[#e8e4de] hover:bg-[#ece9e4]'
            }`}>
              <ArrowDownWideNarrow size={13} /> Sort by Score
            </button>
            <button onClick={handlePauseExam} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold border transition-colors ${
              examPaused ? 'bg-[#e8f5e9] text-[#2e7d32] border-[#2e7d32]/30 hover:bg-[#d4edda]' : 'bg-[#fef3cd] text-[#856404] border-[#856404]/30 hover:bg-[#fde8a8]'
            }`}>
              {examPaused ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause Exam</>}
            </button>
            <button
              id="monitoring-logout-btn"
              onClick={logout}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-[#bbb] hover:text-red-500 transition-colors ml-2"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 flex gap-6 p-6 min-h-0">
          {/* Student table */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Column headers */}
            <div className="flex items-center px-5 mb-3 text-[11px] font-bold text-[#bbb] tracking-widest uppercase">
              <div className="w-[26%]">Student</div>
              <div className="w-[16%]">Status</div>
              <div className="flex-1">Suspicion Score</div>
              <div className="w-[220px]">Actions</div>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pb-6 pr-1">
              {loading ? (
                <div className="flex items-center justify-center h-40 text-[#bbb] gap-2.5 text-[14px]">
                  <Loader2 size={18} className="animate-spin" /> Loading roster...
                </div>
              ) : students.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-2xl border border-[#ece9e4]">
                  <Users className="w-9 h-9 text-[#ddd]" />
                  <p className="text-[#bbb] text-[14px]">No students have joined yet.</p>
                </div>
              ) : (
                sortedStudents.map(student => {
                  const isKicked = kickedStudents.has(student.id)
                  const isEnded = endedStudents.has(student.id)
                  const isDisabled = isKicked || isEnded
                  const lv = level(student.suspicion_score, student.status)
                  const st = styles[lv]
                  return (
                    <div key={student.id} className={`bg-white border rounded-2xl flex items-center px-5 py-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-shadow ${isDisabled ? 'opacity-50 border-[#e0dbd4]' : 'border-[#ece9e4] hover:shadow-[0_2px_10px_rgba(0,0,0,0.07)]'}`}>
                      {/* Name — clickable for details */}
                      <div className="w-[26%] flex items-center gap-3 cursor-pointer group" onClick={() => handleViewDetails(student)}>
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=e8e4de&color=555&bold=true&rounded=true`}
                          alt={student.name} className="w-9 h-9 rounded-full border border-[#f0ede8]"
                        />
                        <div className="min-w-0">
                          <span className="font-semibold text-[15px] text-[#1a1a1a] truncate pr-3 group-hover:text-[#3d6b52] transition-colors block">{student.name}</span>
                          {isKicked && <span className="text-[10px] font-bold text-red-500 uppercase">Kicked</span>}
                          {isEnded && <span className="text-[10px] font-bold text-[#856404] uppercase">Exam Ended</span>}
                        </div>
                        <ChevronRight size={14} className="text-[#ddd] group-hover:text-[#3d6b52] transition-colors shrink-0" />
                      </div>
                      {/* Status */}
                      <div className="w-[16%]">
                        <span className={`px-3 py-1 rounded-lg text-[12px] font-bold ${st.badge}`}>{st.statusText}</span>
                      </div>
                      {/* Sparkline + score */}
                      <div className="flex-1 flex items-center gap-3 pr-3">
                        <div className="flex-1 h-9 relative overflow-hidden">
                          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 20">
                            {lv === 'high' ? (
                              <>
                                <path d="M0,17 Q10,15 20,13 T40,12 T60,8 T80,5 T100,4" fill="none" stroke={st.sparkline} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                                <path d="M0,17 Q10,15 20,13 T40,12 T60,8 T80,5 T100,4 L100,20 L0,20 Z" fill={st.sparkline} fillOpacity="0.1" />
                              </>
                            ) : lv === 'medium' ? (
                              <>
                                <path d="M0,18 T30,15 T60,14 T90,13 T100,12" fill="none" stroke={st.sparkline} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                                <path d="M0,18 T30,15 T60,14 T90,13 T100,12 L100,20 L0,20 Z" fill={st.sparkline} fillOpacity="0.1" />
                              </>
                            ) : (
                              <>
                                <path d="M0,18.5 L25,17.5 L50,18 L75,17 L100,18" fill="none" stroke={st.sparkline} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                                <path d="M0,18.5 L25,17.5 L50,18 L75,17 L100,18 L100,20 L0,20 Z" fill={st.sparkline} fillOpacity="0.1" />
                              </>
                            )}
                          </svg>
                        </div>
                        <span className="font-bold text-[16px] text-[#1a1a1a] w-10 text-right">
                          {Math.round(student.suspicion_score || 0)}%
                        </span>
                      </div>
                      {/* Actions */}
                      <div className="w-[220px] flex justify-end gap-1.5">
                        <button
                          onClick={() => handleViewEvidence(student)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#555] bg-[#f5f2ec] hover:bg-[#ece9e4] border border-[#e8e4de] rounded-lg transition-colors"
                        >
                          <Camera size={12} className="opacity-60" /> Evidence
                        </button>
                        <button
                          onClick={() => handleEndStudentExam(student)}
                          disabled={isDisabled}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#856404] bg-[#fef3cd] hover:bg-[#fde8a8] border border-[#856404]/20 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <StopCircle size={12} /> End
                        </button>
                        <button
                          onClick={() => handleKickStudent(student)}
                          disabled={isDisabled}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-[#c5221f] bg-[#fce8e6] hover:bg-[#f9d0cc] border border-[#c5221f]/20 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <UserX size={12} /> Kick
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Live Alerts sidebar */}
          <div className="w-[320px] bg-white rounded-2xl border border-[#ece9e4] shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col p-5 shrink-0">
            <h2 className="text-[16px] font-bold text-[#1a1a1a] mb-4">Live Alerts</h2>
            <div className="flex-1 overflow-y-auto space-y-3 pb-4">
              {alerts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[#ccc] gap-2 text-[13px]">
                  <Clock className="w-7 h-7 text-[#e8e4de]" />
                  No alerts yet.
                </div>
              ) : (
                alerts.map(alert => {
                  const lv = level(alert.score, '')
                  const st = styles[lv]
                  const sName = students.find(s => s.id === alert.student_id)?.name || `#${alert.student_id}`
                  return (
                    <div key={alert.id} className={`rounded-xl p-3.5 border border-black/[0.04] relative overflow-hidden animate-in fade-in slide-in-from-right-2 duration-200 ${
                      lv === 'high' ? 'bg-[#fef7f7]' : lv === 'medium' ? 'bg-[#fefdf6]' : 'bg-[#f6fbf7]'
                    }`}>
                      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${st.marker}`} />
                      <div className="ml-2">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[11px] text-[#bbb] font-medium">{alert.time}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${st.badge}`}>{st.statusText}</span>
                        </div>
                        <p className="text-[13px] font-semibold text-[#1a1a1a] leading-snug">
                          {alert.event} — {sName}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Evidence Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-[#ece9e4] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-6 border-b border-[#f0ede8]">
              <div className="flex items-center gap-3">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedStudent.name)}&background=e8e4de&color=555&bold=true&rounded=true`}
                  alt={selectedStudent.name} className="w-10 h-10 rounded-full border border-[#f0ede8]"
                />
                <div>
                  <h2 className="text-[16px] font-bold text-[#1a1a1a]">Evidence: {selectedStudent.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-semibold text-[#888] bg-[#f5f2ec] border border-[#e8e4de] px-2 py-0.5 rounded-full">ID: #{selectedStudent.id}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${selectedStudent.suspicion_score >= 70 ? 'text-[#c5221f] bg-[#fce8e6]' : selectedStudent.suspicion_score >= 30 ? 'text-[#856404] bg-[#fef3cd]' : 'text-[#2e7d32] bg-[#e8f5e9]'}`}>
                      Score: {Math.round(selectedStudent.suspicion_score || 0)}%
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="text-[#bbb] hover:text-[#555] bg-[#f5f2ec] hover:bg-[#ece9e4] p-2 rounded-xl transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-[#fafaf8]">
              {loadingEvidence ? (
                <div className="flex flex-col items-center justify-center h-48 text-[#bbb] gap-3 animate-pulse">
                  <div className="w-7 h-7 border-4 border-[#e8e4de] border-t-[#888] rounded-full animate-spin" />
                  Loading evidence...
                </div>
              ) : evidenceList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-2xl border border-[#ece9e4]">
                  <div className="w-14 h-14 bg-[#f5f2ec] rounded-full flex items-center justify-center border border-[#e8e4de]">
                    <Camera className="w-7 h-7 text-[#ddd]" />
                  </div>
                  <p className="text-[#bbb] font-medium text-[14px]">No snapshots recorded for this student.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {evidenceList.map(ev => (
                    <div key={ev.id} className="bg-white border border-[#ece9e4] rounded-2xl overflow-hidden group hover:shadow-md transition-shadow">
                      <div className="aspect-video bg-[#1a1a1a] relative cursor-pointer overflow-hidden" onClick={() => setFullScreenImage(ev)}>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors z-10 flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 text-white text-[12px] font-bold bg-black/50 px-3 py-1.5 rounded-full transition-all">
                            Click to Enlarge
                          </span>
                        </div>
                        <img
                          src={`http://${host}:8000/${ev.file_path.replace('evidence/', 'evidence-files/')}`}
                          alt="Evidence" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-4">
                        <span className="text-[10px] font-bold text-[#c5221f] bg-[#fce8e6] px-2.5 py-1 rounded-full">
                          {EVENT_LABELS[ev.event_type] || ev.event_type}
                        </span>
                        <p className="text-[12px] text-[#aaa] font-medium mt-2">
                          {new Date(ev.timestamp + 'Z').toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Student Details Modal */}
      {detailStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-[#ece9e4] w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-[#f0ede8]">
              <div className="flex items-center gap-3">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(detailStudent.name)}&background=e8e4de&color=555&bold=true&rounded=true`}
                  alt={detailStudent.name} className="w-10 h-10 rounded-full border border-[#f0ede8]"
                />
                <div>
                  <h2 className="text-[16px] font-bold text-[#1a1a1a]">{detailStudent.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-semibold text-[#888] bg-[#f5f2ec] border border-[#e8e4de] px-2 py-0.5 rounded-full">ID: #{detailStudent.id}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${detailStudent.suspicion_score >= 70 ? 'text-[#c5221f] bg-[#fce8e6]' : detailStudent.suspicion_score >= 30 ? 'text-[#856404] bg-[#fef3cd]' : 'text-[#2e7d32] bg-[#e8f5e9]'}`}>
                      Score: {Math.round(detailStudent.suspicion_score || 0)}%
                    </span>
                    {kickedStudents.has(detailStudent.id) && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">KICKED</span>}
                    {endedStudents.has(detailStudent.id) && <span className="text-[10px] font-bold text-[#856404] bg-[#fef3cd] px-2 py-0.5 rounded-full">ENDED</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => setDetailStudent(null)} className="text-[#bbb] hover:text-[#555] bg-[#f5f2ec] hover:bg-[#ece9e4] p-2 rounded-xl transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 px-5 py-3 border-b border-[#f0ede8] bg-[#fafaf8]">
              <button onClick={() => { setDetailStudent(null); handleViewEvidence(detailStudent) }} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-[#555] bg-white hover:bg-[#f5f2ec] border border-[#e8e4de] rounded-xl transition-colors">
                <Camera size={13} /> View Evidence
              </button>
              <button onClick={() => handleEndStudentExam(detailStudent)} disabled={kickedStudents.has(detailStudent.id) || endedStudents.has(detailStudent.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-[#856404] bg-[#fef3cd] hover:bg-[#fde8a8] border border-[#856404]/20 rounded-xl transition-colors disabled:opacity-40">
                <StopCircle size={13} /> End Exam
              </button>
              <button onClick={() => handleKickStudent(detailStudent)} disabled={kickedStudents.has(detailStudent.id) || endedStudents.has(detailStudent.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-[#c5221f] bg-[#fce8e6] hover:bg-[#f9d0cc] border border-[#c5221f]/20 rounded-xl transition-colors disabled:opacity-40">
                <UserX size={13} /> Kick
              </button>
            </div>

            {/* Violation Timeline */}
            <div className="flex-1 overflow-y-auto p-5">
              <h3 className="text-[13px] font-bold text-[#888] uppercase tracking-widest mb-3">Violation Timeline</h3>
              {loadingViolations ? (
                <div className="flex items-center justify-center h-32 text-[#bbb] gap-2 text-[13px]">
                  <Loader2 size={16} className="animate-spin" /> Loading...
                </div>
              ) : studentViolations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-[#ccc]">
                  <Check size={24} />
                  <p className="text-[13px]">No violations recorded.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {studentViolations.map(v => (
                    <div key={v.id} className="flex items-start gap-3 p-3 bg-[#fafaf8] border border-[#ece9e4] rounded-xl">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#ea4335] mt-1.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[#1a1a1a]">{EVENT_LABELS[v.event_type] || v.event_type}</p>
                        <p className="text-[11px] text-[#aaa] mt-0.5">{v.timestamp ? new Date(v.timestamp + 'Z').toLocaleString() : 'Unknown time'}</p>
                      </div>
                      <span className="text-[11px] font-bold text-[#888] bg-[#f0ede8] px-2 py-0.5 rounded-full shrink-0">{Math.round(v.suspicion_score)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {fullScreenImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm cursor-zoom-out" onClick={() => setFullScreenImage(null)}>
          <img
            src={`http://${host}:8000/${fullScreenImage.file_path.replace('evidence/', 'evidence-files/')}`}
            alt="Full screen" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl border border-white/10"
          />
          <button className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 border border-white/20 text-white p-3 rounded-full transition-colors" onClick={() => setFullScreenImage(null)}>
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
