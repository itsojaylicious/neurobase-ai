import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Mic, StopCircle, Radio, Loader2, ArrowLeft,
  Send, Hand, Video, Brain, MessageSquare, Users, Sparkles
} from 'lucide-react';
import api from '../api/client';

const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : (import.meta.env.PROD ? window.location.origin + '/_/server' : 'http://localhost:8000');

export default function LiveClassPage() {
  const { id: classroomId } = useParams();
  const navigate = useNavigate();

  // Core state
  const [profile, setProfile]       = useState(null);
  const [classroom, setClassroom]   = useState(null);
  const [lecture, setLecture]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [lectureTitle, setLectureTitle] = useState('');
  const [starting, setStarting]     = useState(false);
  const [ending, setEnding]         = useState(false);

  // Live state
  const [transcript, setTranscript]     = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [raisedHands, setRaisedHands]   = useState([]);
  const [currentTopic, setCurrentTopic] = useState('');
  const [participants, setParticipants] = useState(0);
  const [myHandRaised, setMyHandRaised] = useState(false);
  const [classEnded, setClassEnded]     = useState(false);
  const [isRecording, setIsRecording]   = useState(false);

  // UI state
  const [chatInput, setChatInput]   = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiAnswers, setAiAnswers]   = useState([]);
  const [sideTab, setSideTab]       = useState('chat');

  // Refs
  const socketRef        = useRef(null);
  const recognitionRef   = useRef(null);
  const jitsiRef         = useRef(null);
  const jitsiContainerRef = useRef(null);
  const transcriptEndRef  = useRef(null);
  const chatEndRef        = useRef(null);
  const bufferRef         = useRef('');
  const isRecordingRef    = useRef(false);
  const lectureIdRef      = useRef(null);
  const userRef           = useRef(null);

  useEffect(() => {
    initPage();
    return () => cleanup();
  }, [classroomId]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ─── INIT ────────────────────────────────────────────────────────────────
  const initPage = async () => {
    try {
      const [profRes, classRes] = await Promise.all([
        api.get('/settings/profile'),
        api.get(`/classrooms/${classroomId}`)
      ]);

      const prof = profRes.data;
      const room = classRes.data;
      setProfile(prof);
      setClassroom(room);
      userRef.current = prof;

      // If student, check for active lecture to join
      if (!['teacher', 'admin'].includes(prof.role)) {
        // Look for a live lecture by asking for room detail
        const liveLec = room.lectures?.find(l => l.is_live || l.isLive);
        if (liveLec) {
          const lid = liveLec.id || liveLec._id;
          const liveRes = await api.get(`/lectures/${lid}/live`);
          const fullLec = { ...liveLec, ...liveRes.data, _id: lid, id: lid };
          setLecture(fullLec);
          setTranscript(liveRes.data.transcript || '');
          lectureIdRef.current = lid;
          connectSocket(lid, prof, false);
          initJitsi(liveRes.data.jitsi_room || liveRes.data.jitsiRoom, prof.email, false);
        }
      }
    } catch (e) {
      console.error('LiveClassPage init error:', e);
    }
    setLoading(false);
  };

  const cleanup = () => {
    isRecordingRef.current = false;
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }
    if (socketRef.current)      { socketRef.current.disconnect(); }
    if (jitsiRef.current)       { try { jitsiRef.current.dispose(); } catch (e) {} }
  };

  // ─── SOCKET.IO ───────────────────────────────────────────────────────────
  const connectSocket = (lectureId, user, isTeacher) => {
    if (socketRef.current) { socketRef.current.disconnect(); }

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-lecture', {
        lectureId,
        userId:    user.id || user._id,
        userEmail: user.email,
        role:      isTeacher ? 'teacher' : 'student'
      });
    });

    socket.on('transcript-update', ({ chunk, fullTranscript }) => {
      if (fullTranscript !== undefined) setTranscript(fullTranscript);
      else setTranscript(prev => prev + chunk);
    });

    socket.on('new-chat-message', (msg) => {
      setChatMessages(prev => {
        // Deduplicate by id
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on('hand-update', ({ userId, userEmail, status }) => {
      setRaisedHands(prev => {
        if (status === 'raised') {
          return prev.some(h => h.user_id?.toString() === userId?.toString())
            ? prev
            : [...prev, { user_id: userId, email: userEmail }];
        }
        return prev.filter(h => h.user_id?.toString() !== userId?.toString());
      });
    });

    socket.on('current-topic', ({ topic }) => {
      if (topic && topic.length > 2) setCurrentTopic(topic);
    });

    socket.on('participant-count', (count) => setParticipants(count));

    socket.on('lecture-ended', () => {
      setClassEnded(true);
      setIsRecording(false);
      isRecordingRef.current = false;
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }
      if (jitsiRef.current)       { try { jitsiRef.current.dispose(); } catch (e) {} }
    });

    socket.on('connect_error', (e) => console.error('Socket error:', e.message));
  };

  // ─── JITSI ───────────────────────────────────────────────────────────────
  const initJitsi = (roomName, userEmail, isModerator) => {
    if (!roomName || jitsiRef.current) return;

    const startJitsi = () => {
      if (!jitsiContainerRef.current || !window.JitsiMeetExternalAPI) return;
      try {
        jitsiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
          roomName,
          parentNode: jitsiContainerRef.current,
          width: '100%', height: '100%',
          configOverwrite: {
            startWithAudioMuted: !isModerator,
            startWithVideoMuted: true,
            prejoinPageEnabled: false,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            DEFAULT_BACKGROUND: '#0f1117',
            TOOLBAR_BUTTONS: ['microphone', 'camera', 'desktop', 'fullscreen', 'tileview', 'hangup'],
          },
          userInfo: { email: userEmail, displayName: userEmail?.split('@')[0] }
        });
      } catch (e) { console.error('Jitsi error:', e); }
    };

    if (window.JitsiMeetExternalAPI) { startJitsi(); return; }
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.onload = startJitsi;
    document.head.appendChild(script);
  };

  // ─── TEACHER: START CLASS ─────────────────────────────────────────────────
  const startClass = async () => {
    if (!lectureTitle.trim()) return alert('Please enter a lecture title');
    setStarting(true);
    try {
      const res = await api.post('/lectures', {
        classroom_id: classroomId,
        title: lectureTitle.trim()
      });
      const lec = res.data;
      const lid = lec._id || lec.id;
      lectureIdRef.current = lid;
      setLecture({ ...lec, id: lid });
      connectSocket(lid, userRef.current, true);
      startSpeechRecognition(lid);
      initJitsi(lec.jitsiRoom || lec.jitsi_room, userRef.current.email, true);
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to start class. Make sure you have Teacher role in Settings.');
    }
    setStarting(false);
  };

  // ─── TEACHER: END CLASS ───────────────────────────────────────────────────
  const endClass = async () => {
    if (!confirm('End this live class? AI will generate notes and quiz automatically.')) return;
    const lid = lectureIdRef.current;
    if (!lid) return;

    isRecordingRef.current = false;
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }

    // Flush buffer
    if (bufferRef.current.trim()) {
      try { await api.put(`/lectures/${lid}/transcript`, { text_chunk: bufferRef.current }); } catch (e) {}
      bufferRef.current = '';
    }

    // Tell all students
    if (socketRef.current) {
      socketRef.current.emit('end-lecture', { lectureId: lid });
    }

    setEnding(true);
    try {
      const res = await api.post(`/lectures/${lid}/end`);
      setLecture(res.data);
      setClassEnded(true);
      setIsRecording(false);
      if (jitsiRef.current) { try { jitsiRef.current.dispose(); } catch (e) {} }
    } catch (e) {
      alert('Failed to end lecture: ' + (e.response?.data?.message || e.message));
    }
    setEnding(false);
  };

  // ─── SPEECH RECOGNITION ──────────────────────────────────────────────────
  const startSpeechRecognition = (lectureId) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Speech Recognition not supported. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    const recog = new SR();
    recog.continuous     = true;
    recog.interimResults = true;
    recog.lang           = 'en-US';
    recognitionRef.current = recog;
    isRecordingRef.current = true;
    setIsRecording(true);

    recog.onresult = (event) => {
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalChunk += event.results[i][0].transcript + ' ';
      }
      if (!finalChunk) return;

      // Update local transcript instantly
      setTranscript(prev => {
        const full = (prev + finalChunk).trim();
        // Push to students via socket
        if (socketRef.current) {
          socketRef.current.emit('transcript-chunk', { lectureId, chunk: finalChunk, fullTranscript: full });
        }
        return full;
      });

      bufferRef.current += finalChunk;

      // Sync to DB every ~50 words
      if (bufferRef.current.split(/\s+/).length > 50) {
        const chunk = bufferRef.current;
        bufferRef.current = '';
        api.put(`/lectures/${lectureId}/transcript`, { text_chunk: chunk }).catch(() => {
          bufferRef.current = chunk + bufferRef.current;
        });
      }
    };

    recog.onend = () => {
      if (isRecordingRef.current) {
        setTimeout(() => { try { recog.start(); } catch (e) {} }, 300);
      } else {
        setIsRecording(false);
      }
    };

    recog.onerror = (e) => {
      if (e.error === 'not-allowed') alert('Microphone access denied! Please allow microphone in your browser settings.');
      else if (e.error !== 'no-speech') console.error('Speech error:', e.error);
    };

    try { recog.start(); } catch (e) { console.error('Could not start recognition:', e); }

    // Periodic DB sync every 15s
    const interval = setInterval(() => {
      if (!isRecordingRef.current) { clearInterval(interval); return; }
      if (bufferRef.current.trim()) {
        const chunk = bufferRef.current;
        bufferRef.current = '';
        api.put(`/lectures/${lectureId}/transcript`, { text_chunk: chunk }).catch(() => {
          bufferRef.current = chunk + bufferRef.current;
        });
      }
    }, 15000);
  };

  // ─── CHAT ─────────────────────────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim() || !lectureIdRef.current) return;
    const msg = chatInput.trim();
    setChatInput('');

    // Optimistic update
    const optimistic = { id: 'opt-' + Date.now(), user_email: userRef.current?.email, message: msg, is_ai_response: false };
    setChatMessages(prev => [...prev, optimistic]);

    try {
      const res = await api.post(`/lectures/${lectureIdRef.current}/chat`, { message: msg });
      // Replace optimistic with real
      setChatMessages(prev => prev.map(m => m.id === optimistic.id ? { ...res.data, id: res.data.id || optimistic.id } : m));

      // Broadcast to others
      if (socketRef.current) {
        socketRef.current.emit('chat-message', {
          lectureId: lectureIdRef.current,
          ...res.data, message: msg
        });
      }
    } catch (e) {
      setChatMessages(prev => prev.filter(m => m.id !== optimistic.id));
    }
  };

  const askAI = async () => {
    if (!aiQuestion.trim() || !lectureIdRef.current) return;
    const q = aiQuestion.trim();
    setAiQuestion('');
    setAiLoading(true);
    setAiAnswers(prev => [...prev, { q, a: null }]);

    try {
      const res = await api.post(`/lectures/${lectureIdRef.current}/ask-ai`, { question: q });
      setAiAnswers(prev => prev.map((item, i) => i === prev.length - 1 ? { q, a: res.data.answer } : item));
    } catch (e) {
      setAiAnswers(prev => prev.map((item, i) => i === prev.length - 1 ? { q, a: 'Failed to get answer.' } : item));
    }
    setAiLoading(false);
  };

  // ─── RAISE HAND ───────────────────────────────────────────────────────────
  const toggleHand = async () => {
    if (!lectureIdRef.current) return;
    try {
      const res = await api.post(`/lectures/${lectureIdRef.current}/raise-hand`);
      const raised = res.data.status === 'raised';
      setMyHandRaised(raised);
      if (socketRef.current) {
        socketRef.current.emit('raise-hand', {
          lectureId: lectureIdRef.current,
          userId:    userRef.current?.id || userRef.current?._id,
          userEmail: userRef.current?.email,
          status:    res.data.status
        });
      }
    } catch (e) { console.error(e); }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );

  const isTeacher = profile?.role === 'teacher' || profile?.role === 'admin';
  const isLive    = lecture && (lecture.isLive === true || lecture.is_live === true);

  return (
    <div className="animate-slide-up flex flex-col gap-3" style={{ height: 'calc(100vh - 80px)' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0 glass-panel p-3 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/classrooms')} className="p-2 hover:bg-gray-800 rounded-xl transition shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
              {classroom?.name || 'Classroom'}
              {isLive && !classEnded && (
                <span className="flex items-center text-xs font-semibold px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full animate-pulse">
                  <Radio className="w-3 h-3 mr-1" /> LIVE
                </span>
              )}
              {currentTopic && (
                <span className="text-xs font-medium px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">
                  📡 {currentTopic}
                </span>
              )}
            </h1>
            <p className="text-xs text-gray-500 truncate">
              {isTeacher ? '👨‍🏫 Teacher' : '👨‍🎓 Student'}
              {lecture ? ` · ${lecture.title}` : ' · No active lecture'}
              {participants > 0 && <span className="ml-2"><Users className="w-3 h-3 inline mr-0.5" />{participants}</span>}
              {raisedHands.length > 0 && <span className="ml-2 text-yellow-400">✋ {raisedHands.map(h => h.email?.split('@')[0]).join(', ')}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Teacher: Start class */}
          {isTeacher && !lecture && !classEnded && (
            <div className="flex items-center gap-2">
              <input type="text" placeholder="Lecture title..." value={lectureTitle}
                onChange={e => setLectureTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && startClass()}
                className="input-field text-sm py-2 w-48" />
              <button onClick={startClass} disabled={starting}
                className="primary-btn bg-red-600 hover:bg-red-500 border-red-500/50 text-sm">
                {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Video className="w-4 h-4 mr-1" /> Go Live</>}
              </button>
            </div>
          )}

          {/* Mic status when live */}
          {isTeacher && isLive && !classEnded && (
            <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${isRecording ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400'}`}>
              <Mic className="w-3 h-3" /> {isRecording ? 'Recording' : 'Idle'}
            </span>
          )}

          {/* Student: raise hand */}
          {!isTeacher && isLive && !classEnded && (
            <button onClick={toggleHand}
              className={`primary-btn text-sm ${myHandRaised ? 'bg-yellow-600 border-yellow-500' : 'bg-gray-700 border-gray-600'}`}>
              <Hand className="w-4 h-4 mr-1" /> {myHandRaised ? 'Lower Hand' : 'Raise Hand'}
            </button>
          )}

          {/* Teacher: end class */}
          {isTeacher && isLive && !classEnded && (
            <button onClick={endClass} disabled={ending}
              className="primary-btn bg-gray-700 border-gray-600 text-sm">
              {ending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <StopCircle className="w-4 h-4 mr-1" />}
              End Class
            </button>
          )}

          {/* Review button after class */}
          {classEnded && lecture && (
            <button onClick={() => navigate(`/classrooms/review/${lecture._id || lecture.id}`)}
              className="primary-btn bg-purple-600 hover:bg-purple-500 border-purple-500/50 text-sm">
              <Brain className="w-4 h-4 mr-1" /> Review & Quiz
            </button>
          )}
        </div>
      </div>

      {/* ── 3-PANEL LAYOUT ──────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">

        {/* VIDEO (Jitsi) */}
        <div className="lg:col-span-5 glass-panel overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-gray-800/50 flex items-center gap-2 shrink-0">
            <Video className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-gray-300">Video Conference</span>
            {raisedHands.length > 0 && (
              <span className="ml-auto text-xs text-yellow-400 flex items-center gap-1">
                <Hand className="w-3 h-3" /> {raisedHands.map(h => h.email?.split('@')[0]).join(', ')} raised hand
              </span>
            )}
          </div>
          <div ref={jitsiContainerRef} className="flex-1 bg-gray-950 relative" style={{ minHeight: 280 }}>
            {!lecture && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 p-6 text-center">
                <Video className="w-12 h-12 mb-3 opacity-20" />
                {isTeacher ? (
                  <div>
                    <p className="text-sm text-gray-400 font-medium">Ready to teach?</p>
                    <p className="text-xs text-gray-600 mt-1">Enter a lecture title above and click <strong className="text-red-400">Go Live</strong></p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-400">Waiting for teacher to start class...</p>
                    <p className="text-xs text-gray-600 mt-1">You will see the live stream here</p>
                  </div>
                )}
              </div>
            )}
            {classEnded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/90">
                <StopCircle className="w-10 h-10 mb-2 text-red-400" />
                <p className="text-sm font-medium text-white">Class has ended</p>
                <p className="text-xs text-gray-400 mt-1">AI is generating notes and quiz...</p>
              </div>
            )}
          </div>
        </div>

        {/* TRANSCRIPT */}
        <div className="lg:col-span-4 glass-panel flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-800/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-gray-300">Live Transcript</span>
              <span className="text-xs text-gray-600">{transcript.split(/\s+/).filter(Boolean).length} words</span>
            </div>
            {isRecording && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />}
          </div>
          <div className="flex-1 overflow-y-auto p-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">
            {transcript || (
              <span className="text-gray-600 text-xs">
                {isTeacher && isLive ? '🎙 Microphone active — speak to see transcript' :
                 isTeacher ? 'Start class to begin live transcription.' :
                 isLive ? 'Waiting for teacher to speak...' :
                 'No active class.'}
              </span>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* SIDE PANEL: CHAT + ASK AI */}
        <div className="lg:col-span-3 glass-panel flex flex-col overflow-hidden">
          <div className="flex border-b border-gray-800/50 shrink-0">
            {[
              { key: 'chat',  icon: MessageSquare, label: 'Chat' },
              { key: 'ai',    icon: Sparkles,      label: 'Ask AI' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setSideTab(tab.key)}
                className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                  sideTab === tab.key
                    ? 'text-primary-400 border-b-2 border-primary-500 bg-primary-500/5'
                    : 'text-gray-500 hover:text-gray-300'
                }`}>
                <tab.icon className="w-3 h-3" /> {tab.label}
              </button>
            ))}
          </div>

          {/* CHAT */}
          {sideTab === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-gray-600 text-center mt-8">No messages yet. Say hello! 👋</p>
                )}
                {chatMessages.map((msg, i) => {
                  const isMe = msg.user_email === userRef.current?.email;
                  return (
                    <div key={msg.id || i} className={`flex gap-2 ${isMe ? 'justify-end' : ''}`}>
                      {!isMe && (
                        <span className="text-xs bg-gray-700 rounded-full px-1.5 py-0.5 h-fit text-gray-400 shrink-0 mt-0.5">
                          {msg.user_email?.split('@')[0]?.[0]?.toUpperCase()}
                        </span>
                      )}
                      <div className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-xs leading-relaxed ${
                        isMe
                          ? 'bg-primary-600/30 border border-primary-500/30 text-primary-200'
                          : 'bg-gray-800/70 border border-gray-700/40 text-gray-300'
                      }`}>
                        {!isMe && <p className="text-gray-500 text-xs mb-0.5 font-medium">{msg.user_email?.split('@')[0]}</p>}
                        {msg.message}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <div className="p-2 border-t border-gray-800/50 flex gap-2 shrink-0">
                <input type="text" value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder={isLive ? 'Send a message...' : 'Class not active'}
                  disabled={!isLive && !classEnded}
                  className="input-field text-xs py-2 flex-1" />
                <button onClick={sendChat} disabled={!chatInput.trim()}
                  className="primary-btn text-xs py-2 px-3">
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* ASK AI */}
          {sideTab === 'ai' && (
            <div className="flex-1 flex flex-col min-h-0 p-3">
              <p className="text-xs text-gray-500 mb-3">Ask about lecture content. AI answers using the live transcript.</p>
              <div className="flex-1 overflow-y-auto space-y-3 mb-2">
                {aiAnswers.length === 0 && (
                  <div className="text-center py-8">
                    <Sparkles className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                    <p className="text-xs text-gray-600">Ask a question about what's being taught</p>
                  </div>
                )}
                {aiAnswers.map((item, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="bg-gray-800/50 text-gray-300 text-xs px-2.5 py-1.5 rounded-lg border border-gray-700/40">
                      <span className="font-semibold text-primary-400 mr-1">Q:</span>{item.q}
                    </div>
                    <div className="bg-purple-500/10 text-purple-200 text-xs px-2.5 py-1.5 rounded-lg border border-purple-500/20 whitespace-pre-wrap">
                      {item.a === null ? (
                        <span className="flex items-center gap-1 text-purple-400"><Loader2 className="w-3 h-3 animate-spin" /> Thinking...</span>
                      ) : (
                        <><span className="font-semibold text-purple-400 mr-1">A:</span>{item.a}</>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 shrink-0">
                <input type="text" value={aiQuestion}
                  onChange={e => setAiQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && askAI()}
                  placeholder="Ask a question..."
                  disabled={!isLive && !classEnded}
                  className="input-field text-xs py-2 flex-1" />
                <button onClick={askAI} disabled={aiLoading || !aiQuestion.trim()}
                  className="primary-btn text-xs py-2 px-3 bg-purple-600 border-purple-500">
                  {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
