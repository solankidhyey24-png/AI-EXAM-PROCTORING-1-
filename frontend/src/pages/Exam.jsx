import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Bold, Italic, Underline, Link2, Code, FileCode2, List, ListOrdered, AlignLeft, Image as ImageIcon, ExternalLink, Strikethrough, ShieldCheck } from 'lucide-react'
import { AIProctor } from '../utils/aiProctor'

export default function Exam() {
  const navigate = useNavigate()
  const socketRef = useRef(null)
  const proctorRef = useRef(null)
  const videoRef = useRef(null)
  
  const [studentName, setStudentName] = useState('')
  const [suspicionScore, setSuspicionScore] = useState(0)
  const [warnings, setWarnings] = useState([])
  const [eventLogs, setEventLogs] = useState([])
  const [timeRemaining, setTimeRemaining] = useState(6332)
  const [wsConnected, setWsConnected] = useState(false)
  const [aiLoading, setAiLoading] = useState(true)
  const [sessionInfo, setSessionInfo] = useState({ sid: '?', eid: '?' })
  const [examPaused, setExamPaused] = useState(false)
  const [examTerminated, setExamTerminated] = useState(null) // null | 'kicked' | 'ended'

  useEffect(() => {
    // Keep exact original logic
    let isMounted = true

    const sid   = sessionStorage.getItem('student_id')
    const eid   = sessionStorage.getItem('exam_id')
    const ecode = sessionStorage.getItem('exam_code')
    const sname = sessionStorage.getItem('student_name')

    if (!sid || !eid || !ecode) { navigate('/join'); return }
    if (sname) setStudentName(sname)
    setSessionInfo({ sid, eid })

    const connectWebSocket = () => {
      const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname
      const wsUrl = `ws://${host}:8000/ws/monitor/${ecode}`
      const socket = new WebSocket(wsUrl)
      
      socket.onopen = () => { if (isMounted) setWsConnected(true) }
      socket.onmessage = (event) => {
        if (!isMounted) return
        try {
          const data = JSON.parse(event.data)

          // Handle teacher action broadcasts
          const mySid = parseInt(sid) || 0
          if (data.type === 'kick_student' && data.student_id === mySid) {
            setExamTerminated('kicked'); return
          }
          if (data.type === 'end_student_exam' && data.student_id === mySid) {
            setExamTerminated('ended'); return
          }
          if (data.type === 'pause_exam') {
            setExamPaused(data.paused); return
          }

          if (data.suspicion_score !== undefined) setSuspicionScore(data.suspicion_score)

          const violationMap = {
            'phone_detected': 'Mobile Phone Detected',
            'multiple_faces': 'Multiple People Detected',
            'looking_away': 'User focus lost',
            'head_turned': 'Head turning detected',
            'no_face': 'Face not visible',
            'tab_switch': 'Tab switch / window unfocused'
          }

          const warningMsg = violationMap[data.event_type]
          if (warningMsg) {
             setWarnings(prev => [...prev.filter(w=>w!==warningMsg), warningMsg])
             setTimeout(() => {
               if (isMounted) setWarnings(prev => prev.filter(w => w !== warningMsg))
             }, 4000)
             
             const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
             setEventLogs(prev => [{ time: timeStr, msg: warningMsg, isWarn: true }, ...prev].slice(0, 5))
          }
        } catch (err) {}
      }
      socket.onclose = () => {
        if (!isMounted) return
        setWsConnected(false)
        setTimeout(connectWebSocket, 3000)
      }
      socketRef.current = socket
    }

    connectWebSocket()

    const startAI = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error(e));
        }

        const handleViolation = async (violationData) => {
          try {
            const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
            const parsedSid = parseInt(sid) || 0;
            const parsedEid = parseInt(eid) || 0;

            fetch(`http://${host}:8000/send_event`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                student_id: parsedSid,
                exam_id: parsedEid, 
                event_type: violationData.event_type,
                suspicion_score: Math.round(violationData.suspicion_score)
              })
            }).catch(e => console.error(e));

            if (violationData.image_blob) {
              const formData = new FormData();
              formData.append('student_id', parsedSid);
              formData.append('exam_id', parsedEid);
              formData.append('event_type', violationData.event_type);
              formData.append('image', violationData.image_blob, `violation_${Date.now()}.jpg`);
              fetch(`http://${host}:8000/upload_evidence`, { method: 'POST', body: formData }).catch(e => console.error(e));
            }
          } catch (err) {}
        };

        const proctor = new AIProctor(handleViolation);
        await proctor.initialize();
        if(!isMounted) return;
        proctorRef.current = proctor;
        setAiLoading(false);

        if (videoRef.current) {
          if (videoRef.current.readyState >= 2) {
             if (isMounted) proctor.start(videoRef.current);
          } else {
             videoRef.current.onloadeddata = () => { if (isMounted) proctor.start(videoRef.current); };
          }
        }
      } catch (err) {
         if (isMounted) setWarnings(prev => [...prev, `AI ERROR: ${err.message}`]);
      }
    };

    startAI();

    const timer = setInterval(() => {
      if (isMounted) setTimeRemaining(prev => prev > 0 ? prev - 1 : 0)
    }, 1000)

    return () => {
      isMounted = false
      clearInterval(timer)
      socketRef.current?.close()
      if (proctorRef.current) proctorRef.current.stop()
      if (videoRef.current && videoRef.current.srcObject) {
         videoRef.current.srcObject.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
  }

  const handleFinish = () => {
    if (window.confirm("Submit exam?")) { sessionStorage.clear(); navigate('/join') }
  }

  // Suspicion score visual helpers
  const scoreLevel = suspicionScore >= 70 ? 'high' : suspicionScore >= 30 ? 'medium' : 'low'
  const scoreColors = {
    high:   { text: 'text-[#c5221f]', bg: 'bg-[#fce8e6]', bar: '#ea4335' },
    medium: { text: 'text-[#856404]', bg: 'bg-[#fef3cd]', bar: '#fbbc04' },
    low:    { text: 'text-[#2e7d32]', bg: 'bg-[#e8f5e9]', bar: '#4caf50' },
  }
  const sc = scoreColors[scoreLevel]

  return (
    <div className="h-screen flex flex-col bg-[#f0ede8] font-sans relative overflow-hidden">

      {/* Exam Terminated Overlay */}
      {examTerminated && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center">
          <div className="bg-white rounded-2xl p-10 max-w-md text-center shadow-2xl border border-[#ece9e4]">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${examTerminated === 'kicked' ? 'bg-[#fce8e6]' : 'bg-[#fef3cd]'}`}>
              <span className="text-3xl">{examTerminated === 'kicked' ? '🚫' : '⏹️'}</span>
            </div>
            <h2 className="text-[22px] font-bold text-[#1a1a1a] mb-2">
              {examTerminated === 'kicked' ? 'You Have Been Removed' : 'Your Exam Has Ended'}
            </h2>
            <p className="text-[#888] text-[14px] mb-6">
              {examTerminated === 'kicked'
                ? 'The proctor has removed you from this exam session due to policy violations.'
                : 'The proctor has ended your exam. Your responses have been recorded.'}
            </p>
            <button onClick={() => { sessionStorage.clear(); navigate('/join') }} className="px-8 py-3 bg-[#1a1a1a] hover:bg-[#2d2d2d] text-white font-bold rounded-xl transition-colors">
              Return to Home
            </button>
          </div>
        </div>
      )}

      {/* Exam Paused Overlay */}
      {examPaused && !examTerminated && (
        <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-10 max-w-md text-center shadow-2xl border border-[#ece9e4]">
            <div className="w-16 h-16 bg-[#fef3cd] rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-3xl">⏸️</span>
            </div>
            <h2 className="text-[22px] font-bold text-[#1a1a1a] mb-2">Exam Paused</h2>
            <p className="text-[#888] text-[14px]">The proctor has temporarily paused the exam. Please wait...</p>
            <div className="mt-5 flex items-center justify-center gap-2 text-[#856404]">
              <div className="w-2 h-2 rounded-full bg-[#856404] animate-pulse" />
              <span className="text-[13px] font-bold">Waiting for proctor to resume</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Top Header */}
      <header className="h-[60px] bg-white flex items-center justify-between px-8 shrink-0 relative z-20 border-b border-[#ece9e4]">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#3d4a3e] rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[14px] text-[#1a1a1a]">ProctorAI</span>
          </div>
          <div className="w-px h-4 bg-[#e0dbd4]" />
          {/* Timer */}
          <div className="font-mono text-[22px] font-bold text-[#1a1a1a] tracking-widest tabular-nums leading-none">
            {formatTime(timeRemaining)}
          </div>
          <div className="w-px h-4 bg-[#e0dbd4]" />
          {/* Connection Status */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${wsConnected ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#fce8e6] text-[#c5221f]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-[#4caf50] animate-pulse' : 'bg-[#ea4335] animate-pulse'}`} />
            {wsConnected ? 'Secure' : 'Reconnecting'}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[12px] text-[#888] bg-[#f5f2ec] border border-[#e8e4de] px-3 py-1 rounded-lg font-bold tracking-widest">
            {sessionInfo.sid !== '?' ? `ID: ${studentName || sessionInfo.sid}` : '...'}
          </span>
          <button onClick={handleFinish} className="px-5 py-2 bg-[#c5221f] hover:bg-[#a31b18] text-white rounded-xl text-[12px] font-bold transition-colors uppercase tracking-widest">End Exam</button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 p-6 max-w-[1500px] mx-auto w-full relative z-10 overflow-hidden min-h-0">
        
        {/* Left Panel: Question */}
        <main className="flex-1 bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ece9e4] flex flex-col overflow-hidden min-h-0">
           {/* Question header */}
           <div className="px-8 pt-8 pb-4 border-b border-[#f0ede8]">
             <div className="text-[11px] font-bold text-[#bbb] uppercase tracking-widest mb-3">Question 4 of 25</div>
             <h2 className="text-[18px] font-bold text-[#1a1a1a] leading-[1.5] tracking-tight">
               Analyze the code snippet provided below and explain the core function of the 'optimize_path' algorithm in the context of graph theory. Describe how its efficiency changes with larger datasets.
             </h2>
           </div>

           {/* Scrollable content */}
           <div className="flex-1 overflow-y-auto px-8 py-6">
             {/* Code block */}
             <div className="relative bg-[#fafaf8] rounded-xl p-6 font-mono text-[14px] text-[#1a1a1a] mb-6 border border-[#ece9e4] leading-relaxed">
               <span className="text-[#3d6b52] font-bold">def</span> optimize_path(graph, start, end):<br/>
               &nbsp;&nbsp;&nbsp;&nbsp;...<br/>
               &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#888] italic"># Implementation details</span>
             </div>

             {/* Toolbar */}
             <div className="border border-[#ece9e4] rounded-t-xl bg-white flex items-center px-4 py-2.5 gap-1 overflow-x-auto text-[#888]">
               <button className="p-1.5 hover:bg-[#f5f2ec] rounded-lg text-[#555] transition-colors"><Bold className="w-4 h-4"/></button>
               <button className="p-1.5 hover:bg-[#f5f2ec] rounded-lg text-[#555] transition-colors"><Italic className="w-4 h-4"/></button>
               <button className="p-1.5 hover:bg-[#f5f2ec] rounded-lg text-[#555] transition-colors"><Underline className="w-4 h-4"/></button>
               <button className="p-1.5 hover:bg-[#f5f2ec] rounded-lg text-[#555] transition-colors"><Strikethrough className="w-4 h-4"/></button>
               
               <div className="w-px h-4 bg-[#ece9e4] mx-1.5"></div>
               
               <button className="p-1.5 hover:bg-[#f5f2ec] rounded-lg text-[#555] transition-colors"><Link2 className="w-4 h-4"/></button>
               <button className="p-1.5 hover:bg-[#f5f2ec] rounded-lg text-[#555] transition-colors"><Code className="w-4 h-4"/></button>
               <button className="p-1.5 hover:bg-[#f5f2ec] rounded-lg text-[#555] transition-colors"><FileCode2 className="w-4 h-4"/></button>
               
               <div className="w-px h-4 bg-[#ece9e4] mx-1.5"></div>
               
               <button className="p-1.5 hover:bg-[#f5f2ec] rounded-lg text-[#555] transition-colors"><ListOrdered className="w-4 h-4"/></button>
               <button className="p-1.5 hover:bg-[#f5f2ec] rounded-lg text-[#555] transition-colors"><List className="w-4 h-4"/></button>
               <button className="p-1.5 hover:bg-[#f5f2ec] rounded-lg text-[#555] transition-colors"><AlignLeft className="w-4 h-4"/></button>
               
               <div className="w-px h-4 bg-[#ece9e4] mx-1.5"></div>
               
               <button className="p-1.5 hover:bg-[#f5f2ec] rounded-lg text-[#555] transition-colors"><ImageIcon className="w-4 h-4"/></button>
               <button className="p-1.5 hover:bg-[#f5f2ec] rounded-lg text-[#555] transition-colors"><ExternalLink className="w-4 h-4"/></button>
             </div>
             {/* Text Area */}
             <textarea className="w-full min-h-[200px] p-5 border-x border-b border-[#ece9e4] rounded-b-xl focus:outline-none focus:border-[#3d4a3e] resize-none text-[15px] text-[#1a1a1a] placeholder-[#ccc] bg-white transition-colors" placeholder="Type your detailed explanation here..." />

             {/* Navigation */}
             <div className="mt-6 flex justify-between items-center">
               <div className="flex gap-2">
                 <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#3d4a3e] text-white text-[13px] font-bold shadow-sm">1</button>
                 <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#f5f2ec] text-[#555] text-[13px] font-semibold hover:bg-[#ece9e4] border border-[#e8e4de] transition-colors">2</button>
                 <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#f5f2ec] text-[#555] text-[13px] font-semibold hover:bg-[#ece9e4] border border-[#e8e4de] transition-colors">3</button>
                 <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#f5f2ec] text-[#555] text-[13px] font-semibold hover:bg-[#ece9e4] border border-[#e8e4de] transition-colors">4</button>
                 <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#f5f2ec] text-[#555] text-[13px] font-semibold hover:bg-[#ece9e4] border border-[#e8e4de] transition-colors">5</button>
                 <span className="w-9 h-9 flex items-center justify-end text-[#bbb] font-bold text-[14px]">...</span>
               </div>
               
               <button className="px-6 py-3 bg-[#1a1a1a] hover:bg-[#2d2d2d] text-white font-bold rounded-xl transition-colors text-[14px] shadow-sm">
                 Next Question
               </button>
             </div>
           </div>
        </main>

        {/* Right Panel: Proctor Info */}
        <aside className="w-[340px] flex flex-col gap-4 shrink-0 relative z-10 min-h-0 overflow-hidden">
          <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ece9e4] p-6 flex-1 flex flex-col min-h-0 overflow-y-auto">
             <h2 className="text-[16px] font-bold text-[#1a1a1a] tracking-tight mb-4">AI Monitoring</h2>
             
             {/* Status indicator */}
             <div className="bg-[#f5f2ec] rounded-xl flex items-center px-4 py-3 gap-3 border border-[#e8e4de]">
                <div className="w-6 h-6 rounded-full bg-[#3d6b52] flex items-center justify-center text-white shrink-0">
                   <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                </div>
                <div className="text-[13px] font-bold text-[#1a1a1a]">
                   Status: <span className="text-[#3d6b52]">Secure & Monitored</span>
                </div>
             </div>

             {/* Suspicion Score */}
             <div className="mt-6 border-b border-[#f0ede8] pb-6">
                <div className="flex justify-between items-end mb-3">
                   <span className="text-[13px] font-bold text-[#888] uppercase tracking-widest">Suspicion Score</span>
                   <span className={`text-[28px] font-bold leading-none ${sc.text}`}>{Math.round(suspicionScore)}%</span>
                </div>
                
                {/* Score bar */}
                <div className="relative h-2 w-full rounded-full bg-[#f0ede8] overflow-hidden">
                   <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${Math.min(suspicionScore, 100)}%`, backgroundColor: sc.bar }} />
                </div>
                <div className="flex justify-between mt-2 text-[11px] font-semibold">
                  <span className={`px-2 py-0.5 rounded-md ${sc.bg} ${sc.text}`}>{scoreLevel === 'low' ? 'Normal' : scoreLevel === 'medium' ? 'Suspicious' : 'Alert'}</span>
                  <span className="text-[#bbb]">100%</span>
                </div>
             </div>

             {/* Live Activity Log */}
             <div className="flex-1 mt-5">
               <h3 className="text-[13px] font-bold text-[#888] uppercase tracking-widest mb-4">Live Activity</h3>
               <div className="flex flex-col gap-2.5">
                 {eventLogs.map((log, i) => (
                   <div key={i} className={`text-[12px] font-medium flex gap-2 p-2.5 rounded-xl border ${log.isWarn ? 'bg-[#fce8e6] border-[#fce8e6] text-[#c5221f]' : 'bg-[#e8f5e9] border-[#e8f5e9] text-[#2e7d32]'}`}>
                     <span className="font-bold shrink-0">{log.time}</span>
                     <span className="truncate">{log.msg}</span>
                   </div>
                 ))}
                 {eventLogs.length === 0 && <div className="text-[13px] text-[#bbb] bg-[#f5f2ec] rounded-xl p-3 border border-[#e8e4de] text-center">Monitoring started...</div>}
               </div>
             </div>
             
             {/* Embedded Video Feed */}
             <div className="mt-5 bg-[#1a1a1a] rounded-xl overflow-hidden border border-[#ece9e4] flex-shrink-0 aspect-[16/10] w-full relative group">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100 opacity-90 block" />
                
                {!aiLoading && (
                   <div className="absolute top-2.5 right-2.5 bg-black/50 px-2.5 py-1 rounded-lg flex items-center gap-1.5 backdrop-blur-md border border-white/10">
                      <div className={`w-1.5 h-1.5 rounded-full ${warnings.length > 0 ? 'bg-[#ea4335] animate-pulse' : 'bg-[#4caf50] animate-pulse'}`} />
                      <span className="text-white text-[10px] font-bold uppercase tracking-widest leading-none">Live</span>
                   </div>
                )}
                {warnings.length > 0 && (
                   <div className="absolute inset-x-0 bottom-0 bg-[#c5221f]/90 text-white text-[10px] font-bold py-1.5 px-2 text-center uppercase tracking-widest backdrop-blur-sm z-20">
                     ⚠ Violation Detected
                   </div>
                )}
             </div>
          </div>
        </aside>

      </div>
    </div>
  )
}
