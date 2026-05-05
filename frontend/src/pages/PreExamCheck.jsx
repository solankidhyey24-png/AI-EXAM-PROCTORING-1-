import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, VideoOff, ChevronRight, ShieldCheck } from 'lucide-react'

export default function PreExamCheck() {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  
  const [streamActive, setStreamActive] = useState(false)
  const [permissionError, setPermissionError] = useState(false)

  useEffect(() => {
    // Make sure we have session data
    if (!sessionStorage.getItem('student_id')) {
      navigate('/join')
      return;
    }

    startCamera()

    return () => {
      // Cleanup camera on unmount
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks()
        tracks.forEach(track => track.stop())
      }
    }
  }, [navigate])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: "user" } 
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setStreamActive(true)
        setPermissionError(false)
      }
    } catch (err) {
      console.error("Error accessing webcam:", err)
      setPermissionError(true)
      setStreamActive(false)
    }
  }

  const handleStartExam = () => {
    // IMPORTANT: Release the camera so main.py can access it
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    navigate('/exam')
  }

  return (
    <div className="min-h-screen bg-[#f0ede8] flex flex-col items-center justify-center p-6 sm:p-10 font-sans">

      {/* Header Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 bg-[#3d4a3e] rounded-xl flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <p className="font-bold text-[17px] text-[#1a1a1a]">ProctorAI</p>
      </div>

      <div className="max-w-[960px] w-full mx-auto">
        
        <h1 className="text-[28px] sm:text-[32px] font-bold text-[#1a1a1a] mb-2 tracking-tight">System Readiness Check</h1>
        <p className="text-[#888] text-[15px] mb-8">Verify your setup before starting the exam</p>

        <div className="flex flex-col md:flex-row gap-8 lg:gap-10 items-stretch">
          
          {/* Left Side: Camera & AI Notice */}
          <div className="flex-1 flex flex-col gap-4">
            
            {/* Camera Frame */}
            <div className="relative w-full aspect-[4/3] bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.1)] border border-[#ece9e4]">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300 ${streamActive ? 'opacity-100' : 'opacity-0'}`}
              />
              
              {/* Overlay Status */}
              {streamActive && (
                <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl flex items-center gap-2 border border-white/10 z-20">
                  <div className="w-2 h-2 rounded-full bg-[#4caf50] shadow-[0_0_8px_rgba(76,175,80,0.8)] animate-pulse"></div>
                  <span className="text-white text-[12px] font-bold uppercase tracking-widest">Live</span>
                </div>
              )}
              
              {/* AI Bounding Box Overlay (Decorative) */}
              {streamActive && (
                <>
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-[0_0_8px_rgba(125,186,140,0.6)] z-10">
                    <path d="M 25 35 L 25 25 L 35 25" fill="none" stroke="#7ec8a0" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    <path d="M 75 35 L 75 25 L 65 25" fill="none" stroke="#7ec8a0" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    <path d="M 25 65 L 25 75 L 35 75" fill="none" stroke="#7ec8a0" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    <path d="M 75 65 L 75 75 L 65 75" fill="none" stroke="#7ec8a0" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  </svg>
                  
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none z-10">
                    <circle cx="40" cy="42" r="0.6" fill="white" />
                    <circle cx="34" cy="45" r="0.6" fill="white" />
                    <circle cx="28" cy="42" r="0.6" fill="white" />
                    <circle cx="60" cy="42" r="0.6" fill="white" />
                    <circle cx="66" cy="45" r="0.6" fill="white" />
                    <circle cx="72" cy="42" r="0.6" fill="white" />
                    
                    <circle cx="50" cy="52" r="0.6" fill="white" />
                    <circle cx="46" cy="60" r="0.6" fill="white" />
                    <circle cx="54" cy="60" r="0.6" fill="white" />
                    
                    <circle cx="44" cy="68" r="0.6" fill="white" />
                    <circle cx="56" cy="68" r="0.6" fill="white" />
                    <circle cx="50" cy="72" r="0.6" fill="white" />
                    
                    <path d="M 34 45 L 40 42 L 50 52 L 46 60 L 44 68 L 50 72 L 56 68 L 54 60 L 50 52 L 60 42 L 66 45" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.2" vectorEffect="non-scaling-stroke" />
                    <path d="M 28 42 C 30 50 44 68 44 68" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.2" vectorEffect="non-scaling-stroke" />
                    <path d="M 72 42 C 70 50 56 68 56 68" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.2" vectorEffect="non-scaling-stroke" />
                    <path d="M 50 72 L 50 82" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.2" vectorEffect="non-scaling-stroke" />
                    <circle cx="50" cy="82" r="0.6" fill="white" />
                  </svg>
                </>
              )}

              {/* Loading State */}
              {!streamActive && !permissionError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[#888] space-y-3">
                  <div className="w-10 h-10 border-[3px] border-[#e0dbd4] border-t-[#3d4a3e] rounded-full animate-spin"></div>
                  <p className="text-[13px] font-semibold tracking-wide">Initiating camera...</p>
                </div>
              )}

              {/* Error State */}
              {permissionError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 bg-[#1a1a1a] space-y-3 p-6 text-center">
                  <VideoOff className="w-12 h-12 mb-2 text-red-400" />
                  <p className="font-bold text-white text-[15px]">Camera Access Denied</p>
                  <p className="text-[13px] text-[#888]">Please allow browser camera permissions and refresh the page.</p>
                  <button 
                    onClick={startCamera}
                    className="mt-4 px-5 py-2.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white text-[13px] rounded-xl transition-colors font-semibold border border-[#555]"
                  >
                    Retry Connection
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Card */}
            <div className="bg-white rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ece9e4]">
              <h3 className="text-[#1a1a1a] font-bold mb-1.5 tracking-tight text-[15px]">AI Monitoring Enabled</h3>
              <p className="text-[#888] text-[13px] leading-relaxed">
                Your session will be monitored for integrity. Please remain in view of the camera at all times.
              </p>
            </div>
          </div>

          {/* Vertical Divider (Desktop) */}
          <div className="hidden md:flex flex-col items-center">
            <div className="w-px h-full bg-[#e0dbd4]"></div>
          </div>

          {/* Right Side: Checklist & Button */}
          <div className="w-full md:w-[380px] flex flex-col justify-between py-1 gap-6">
            
            <div className="flex flex-col gap-4">
              <CheckItem label="Camera" active={streamActive} />
              <CheckItem label="Microphone" active={streamActive} />
              <CheckItem label="ID Verification" active={true} />
            </div>

            <button
              onClick={handleStartExam}
              disabled={!streamActive}
              className="w-full h-[64px] bg-[#1a1a1a] hover:bg-[#2d2d2d] disabled:bg-[#e0dbd4] disabled:text-[#aaa] text-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-all flex items-center justify-between px-6 group disabled:cursor-not-allowed disabled:shadow-none mt-4 sm:mt-0"
            >
              <span className="text-[16px] font-bold tracking-wide ml-2">Start Exam</span>
              <div className="flex -space-x-3 text-white/40 group-hover:text-white/80 transition-colors mr-2">
                <ChevronRight className="w-6 h-6 animate-pulse" style={{ animationDelay: "0ms" }} />
                <ChevronRight className="w-6 h-6 animate-pulse" style={{ animationDelay: "150ms" }} />
                <ChevronRight className="w-6 h-6 animate-pulse" style={{ animationDelay: "300ms" }} />
              </div>
            </button>

          </div>

        </div>
      </div>
    </div>
  )
}

function CheckItem({ label, active }) {
  return (
    <div className="bg-white rounded-2xl h-[72px] px-5 flex items-center gap-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ece9e4] transition-all transform hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
      <div className={`w-[36px] h-[36px] rounded-full flex items-center justify-center transition-colors shadow-sm
        ${active ? 'bg-[#3d6b52] text-white' : 'bg-[#e0dbd4] text-[#aaa]'}`}>
        <Check className="w-5 h-5 stroke-[3]" />
      </div>
      <span className="text-[16px] font-semibold text-[#1a1a1a] tracking-tight">{label}</span>
    </div>
  )
}
