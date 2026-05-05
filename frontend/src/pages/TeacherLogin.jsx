import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTeacherAuth } from '../hooks/useTeacherAuth'
import { ShieldCheck, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'

export default function TeacherLogin() {
  const navigate = useNavigate()
  const { login } = useTeacherAuth()
  const [formData, setFormData]         = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('http://127.0.0.1:8000/teacher/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Login failed. Please check your credentials.')
      login(data.access_token, { id: data.teacher_id, name: data.name, email: data.email })
      navigate('/teacher/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0ede8] flex font-sans">

      {/* ── Left Panel — Branding ─────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[45%] bg-[#3d4a3e] flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-[17px] leading-none">ProctorAI</p>
            <p className="text-white/50 text-[10px] uppercase tracking-widest mt-0.5">Admin Console</p>
          </div>
        </div>

        {/* Center copy */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7ec8a0] animate-pulse" />
            <span className="text-[11px] font-semibold text-white/70 uppercase tracking-widest">Secure Monitoring</span>
          </div>
          <h1 className="text-[38px] font-bold text-white leading-tight mb-4">
            AI-Powered<br />Exam Integrity
          </h1>
          <p className="text-white/60 text-[15px] leading-relaxed max-w-xs">
            Monitor student activity in real-time with advanced AI proctoring and violation detection.
          </p>

          {/* Feature pills */}
          <div className="mt-8 flex flex-col gap-3">
            {[
              { label: 'Live face & gaze detection' },
              { label: 'Phone & device detection' },
              { label: 'Timestamped evidence capture' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3 text-[13px] text-white/70">
                <div className="w-5 h-5 rounded-full bg-[#7ec8a0]/20 border border-[#7ec8a0]/40 flex items-center justify-center shrink-0">
                  <span className="text-[#7ec8a0] text-[10px]">✓</span>
                </div>
                {f.label}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-white/30 text-[12px]">© 2026 ProctorAI Platform</p>
      </div>

      {/* ── Right Panel — Login Form ──────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[400px]">

          {/* Mobile-only logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 bg-[#3d4a3e] rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <p className="font-bold text-[16px] text-[#1a1a1a]">ProctorAI</p>
          </div>

          <h2 className="text-[28px] font-bold text-[#1a1a1a] mb-1 tracking-tight">Welcome back</h2>
          <p className="text-[#888] text-[15px] mb-8">Sign in to your teacher dashboard</p>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.07)] border border-[#ece9e4] p-8">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-[12px] font-semibold text-[#555] uppercase tracking-wide mb-2">
                  Email Address
                </label>
                <div className="group flex items-center gap-3 border border-[#e0dbd4] hover:border-[#b0aba4] focus-within:border-[#3d4a3e] focus-within:ring-2 focus-within:ring-[#3d4a3e]/10 rounded-xl px-4 py-3 transition-all bg-white">
                  <Mail className="w-[17px] h-[17px] text-[#bbb] group-focus-within:text-[#3d4a3e] transition-colors shrink-0" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="teacher@exam.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="flex-1 bg-transparent outline-none text-[#1a1a1a] text-[14px] font-medium placeholder-[#ccc]"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-[12px] font-semibold text-[#555] uppercase tracking-wide mb-2">
                  Password
                </label>
                <div className="group flex items-center gap-3 border border-[#e0dbd4] hover:border-[#b0aba4] focus-within:border-[#3d4a3e] focus-within:ring-2 focus-within:ring-[#3d4a3e]/10 rounded-xl px-4 py-3 transition-all bg-white">
                  <Lock className="w-[17px] h-[17px] text-[#bbb] group-focus-within:text-[#3d4a3e] transition-colors shrink-0" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="flex-1 bg-transparent outline-none text-[#1a1a1a] text-[14px] font-medium placeholder-[#ccc]"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[#bbb] hover:text-[#555] transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-600 text-[13px]">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                id="teacher-login-btn"
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#1a1a1a] hover:bg-[#2d2d2d] text-white text-[14px] font-bold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
                ) : (
                  'Sign In to Dashboard'
                )}
              </button>

            </form>

            {/* Demo credentials */}
            <div className="mt-6 pt-5 border-t border-[#f0ede4]">
              <p className="text-center text-[11px] font-semibold text-[#bbb] uppercase tracking-widest mb-3">Demo Credentials</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#fafaf8] border border-[#f0ede4] rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-[#bbb] uppercase tracking-wide mb-1">Email</p>
                  <p className="text-[13px] text-[#555] font-mono font-medium">teacher@exam.com</p>
                </div>
                <div className="bg-[#fafaf8] border border-[#f0ede4] rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-[#bbb] uppercase tracking-wide mb-1">Password</p>
                  <p className="text-[13px] text-[#555] font-mono font-medium">admin123</p>
                </div>
              </div>
            </div>
          </div>

          {/* Back to student portal */}
          <p className="mt-5 text-center text-[13px] text-[#aaa]">
            Looking for the student portal?{' '}
            <button onClick={() => navigate('/join')} className="text-[#3d4a3e] font-semibold hover:underline transition-colors">
              Join Exam →
            </button>
          </p>
        </div>
      </div>

    </div>
  )
}
