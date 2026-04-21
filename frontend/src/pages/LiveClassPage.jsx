import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, StopCircle, Radio, Loader2, ArrowLeft, Send, Hand, Video, VideoOff, Monitor, MessageSquare, Brain, Users } from 'lucide-react';
import api from '../api/client';

export default function LiveClassPage() {
  const { id: classroomId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [lecture, setLecture] = useState(null);
  const [loading, setLoading] = useState(true);

  // Teacher state
  const [isRecording, setIsRecording] = useState(false);
  const [title, setTitle] = useState('');

  // Transcription state
  const [transcript, setTranscript] = useState('');
  const [currentTopic, setCurrentTopic] = useState('');
  const recognitionRef = useRef(null);
  const pollingRef = useRef(null);
  const chunkBufferRef = useRef('');
  const topicDetectRef = useRef(null);
  const transcriptEndRef = useRef(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const lastChatIdRef = useRef(0);
  const chatPollingRef = useRef(null);
  const chatEndRef = useRef(null);

  // Hand raise state
  const [raisedHands, setRaisedHands] = useState([]);
  const [myHandRaised, setMyHandRaised] = useState(false);
  const handPollingRef = useRef(null);

  // Active tab in sidebar
  const [sideTab, setSideTab] = useState('chat'); // chat, transcript, ai

  // Jitsi
  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);

  useEffect(() => {
    loadInitData();
    return () => {
      cleanup();
    };
  }, [classroomId]);

  const cleanup = () => {
    stopAllPolling();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (jitsiApiRef.current) {
      try { jitsiApiRef.current.dispose(); } catch (e) {}
    }
  };

  const stopAllPolling = () => {
    [pollingRef, chatPollingRef, handPollingRef, topicDetectRef].forEach(ref => {
      if (ref.current) { clearInterval(ref.current); ref.current = null; }
    });
  };

  const loadInitData = async () => {
    try {
      const [profRes, classRes] = await Promise.all([
        api.get('/settings/profile'),
        api.get(`/classrooms/${classroomId}`)
      ]);
      setProfile(profRes.data);
      setClassroom(classRes.data);

      // Auto-join active lecture if student
      if (profRes.data.role !== 'teacher' && profRes.data.role !== 'admin') {
        const liveLecture = classRes.data.lectures?.find(l => l.is_live);
        if (liveLecture) {
          // Fetch full lecture data
          const liveRes = await api.get(`/lectures/${liveLecture.id}/live`);
          setLecture({ ...liveLecture, ...liveRes.data });
          setTranscript(liveRes.data.transcript || '');
          startStudentPolling(liveLecture.id);
          startChatPolling(liveLecture.id);
          startHandPolling(liveLecture.id);
          initJitsi(liveRes.data.jitsi_room, profRes.data.email, false);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };


  // ═══════════════════════════════════════
  // JITSI MEET INTEGRATION
  // ═══════════════════════════════════════

  const initJitsi = (roomName, userEmail, isModerator) => {
    if (!roomName || jitsiApiRef.current) return;

    // Load Jitsi external API script dynamically
    const existingScript = document.querySelector('script[src*="jitsi"]');
    if (existingScript) {
      createJitsiMeeting(roomName, userEmail, isModerator);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    script.onload = () => createJitsiMeeting(roomName, userEmail, isModerator);
    document.head.appendChild(script);
  };

  const createJitsiMeeting = (roomName, userEmail, isModerator) => {
    if (!jitsiContainerRef.current || !window.JitsiMeetExternalAPI) return;

    try {
      const jitsiApi = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName: roomName,
        parentNode: jitsiContainerRef.current,
        width: '100%',
        height: '100%',
        configOverwrite: {
          startWithAudioMuted: !isModerator,
          startWithVideoMuted: true,
          disableModeratorIndicator: false,
          enableClosePage: false,
          prejoinPageEnabled: false,
          toolbarButtons: [
            'microphone', 'camera', 'desktop', 'fullscreen',
            'chat', 'raisehand', 'tileview', 'hangup'
          ],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_BACKGROUND: '#111827',
          TOOLBAR_ALWAYS_VISIBLE: true,
          FILM_STRIP_MAX_HEIGHT: 120,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        },
        userInfo: {
          email: userEmail,
          displayName: userEmail?.split('@')[0] || 'User'
        }
      });

      jitsiApiRef.current = jitsiApi;
    } catch (e) {
      console.error("Jitsi init failed:", e);
    }
  };


  // ═══════════════════════════════════════
  // TEACHER: START / END CLASS
  // ═══════════════════════════════════════

  const startLiveClass = async () => {
    if (!title) return alert("Please enter a lecture title");
    try {
      const res = await api.post('/lectures/', { classroom_id: parseInt(classroomId), title });
      setLecture(res.data);
      setIsRecording(true);
      startSpeechRecognition(res.data.id);
      startChatPolling(res.data.id);
      startHandPolling(res.data.id);
      startTopicDetection(res.data.id);
      initJitsi(res.data.jitsi_room, profile?.email, true);
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to start session");
    }
  };

  const endLiveClass = async () => {
    if (!confirm("End live class? AI will generate notes, quiz & topics.")) return;

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      setIsRecording(false);
    }

    if (chunkBufferRef.current) await syncChunk(lecture.id);
    stopAllPolling();

    try {
      setLoading(true);
      const res = await api.post(`/lectures/${lecture.id}/end`);
      setLecture(res.data);
      if (jitsiApiRef.current) {
        try { jitsiApiRef.current.dispose(); } catch (e) {}
        jitsiApiRef.current = null;
      }
    } catch (e) {
      alert("Failed to end lecture");
    }
    setLoading(false);
  };


  // ═══════════════════════════════════════
  // SPEECH RECOGNITION
  // ═══════════════════════════════════════

  const startSpeechRecognition = (lectureId) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition not supported. Use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalChunk += event.results[i][0].transcript + ' ';
        }
      }
      if (finalChunk) {
        setTranscript(prev => prev + finalChunk);
        chunkBufferRef.current += finalChunk;
        syncChunk(lectureId);
      }
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') console.error("Speech error:", e);
    };

    recognition.onend = () => {
      // Auto-restart if still recording
      setTimeout(() => {
        if (isRecording && recognitionRef.current) {
          try { recognitionRef.current.start(); } catch (e) {}
        }
      }, 100);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const syncChunk = async (lectureId) => {
    const chunk = chunkBufferRef.current;
    if (!chunk) return;
    chunkBufferRef.current = '';
    try {
      await api.put(`/lectures/${lectureId}/transcript`, { text_chunk: chunk });
    } catch (e) {
      chunkBufferRef.current = chunk + chunkBufferRef.current;
    }
  };


  // ═══════════════════════════════════════
  // STUDENT POLLING
  // ═══════════════════════════════════════

  const startStudentPolling = (lectureId) => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/lectures/${lectureId}/live`);
        setTranscript(res.data.transcript || '');
        if (res.data.detected_topics) {
          try {
            const topics = JSON.parse(res.data.detected_topics);
            if (topics.length > 0) setCurrentTopic(topics[topics.length - 1]);
          } catch (e) {}
        }
        if (!res.data.is_live) {
          stopAllPolling();
          setLecture(prev => ({ ...prev, is_live: false, summary: res.data.summary }));
          if (jitsiApiRef.current) {
            try { jitsiApiRef.current.dispose(); } catch (e) {}
            jitsiApiRef.current = null;
          }
        }
      } catch (e) { console.error(e); }
    }, 2500);
  };


  // ═══════════════════════════════════════
  // CHAT POLLING & SEND
  // ═══════════════════════════════════════

  const startChatPolling = (lectureId) => {
    chatPollingRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/lectures/${lectureId}/chat?after_id=${lastChatIdRef.current}`);
        if (res.data.length > 0) {
          setChatMessages(prev => [...prev, ...res.data]);
          lastChatIdRef.current = res.data[res.data.length - 1].id;
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      } catch (e) {}
    }, 2000);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !lecture) return;
    const msg = chatInput.trim();
    setChatInput('');
    try {
      await api.post(`/lectures/${lecture.id}/chat`, { message: msg });
    } catch (e) {
      console.error(e);
    }
  };

  const askAI = async () => {
    if (!aiQuestion.trim() || !lecture) return;
    const q = aiQuestion.trim();
    setAiQuestion('');
    try {
      const res = await api.post(`/lectures/${lecture.id}/ask-ai`, { question: q });
      // AI response will appear in chat via polling
    } catch (e) {
      console.error(e);
    }
  };


  // ═══════════════════════════════════════
  // RAISE HAND
  // ═══════════════════════════════════════

  const startHandPolling = (lectureId) => {
    handPollingRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/lectures/${lectureId}/hands`);
        setRaisedHands(res.data);
      } catch (e) {}
    }, 3000);
  };

  const toggleHand = async () => {
    if (!lecture) return;
    try {
      const res = await api.post(`/lectures/${lecture.id}/raise-hand`);
      setMyHandRaised(res.data.status === 'raised');
    } catch (e) {
      console.error(e);
    }
  };


  // ═══════════════════════════════════════
  // AI TOPIC DETECTION (teacher-side periodic)
  // ═══════════════════════════════════════

  const startTopicDetection = (lectureId) => {
    topicDetectRef.current = setInterval(async () => {
      try {
        const res = await api.post(`/lectures/${lectureId}/detect-topic`);
        if (res.data.topic && !res.data.topic.includes("Waiting")) {
          setCurrentTopic(res.data.topic);
        }
      } catch (e) {}
    }, 30000); // every 30s
  };


  // ═══════════════════════════════════════
  // AUTO-SCROLL TRANSCRIPT
  // ═══════════════════════════════════════
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);


  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;

  const isTeacher = profile?.role === 'teacher' || profile?.role === 'admin';
  const isLive = lecture?.is_live;
  const isEnded = lecture && !lecture.is_live;

  return (
    <div className="animate-slide-up flex flex-col h-full gap-3" style={{maxHeight: 'calc(100vh - 80px)'}}>

      {/* ═══ HEADER BAR ═══ */}
      <div className="flex items-center justify-between shrink-0 glass-panel p-3 px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/classrooms')} className="p-2 hover:bg-gray-800 rounded-xl transition">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              {classroom?.name}
              {isLive && (
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
            <p className="text-xs text-gray-500">
              {isTeacher ? '👨‍🏫 Teacher' : '👨‍🎓 Student'} • {lecture ? lecture.title : 'No active lecture'}
              {raisedHands.length > 0 && <span className="ml-2 text-yellow-400">✋ {raisedHands.length} hand(s) raised</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Pre-lecture: Title + Go Live */}
          {isTeacher && !lecture && (
            <>
              <input type="text" placeholder="Lecture Title..." value={title} onChange={e => setTitle(e.target.value)} className="input-field text-sm py-2 w-56" />
              <button onClick={startLiveClass} className="primary-btn bg-red-600 hover:bg-red-500 border-red-500/50 text-sm">
                <Video className="w-4 h-4 mr-1" /> Go Live
              </button>
            </>
          )}

          {/* During lecture: Student raise hand */}
          {!isTeacher && isLive && (
            <button onClick={toggleHand} className={`primary-btn text-sm ${myHandRaised ? 'bg-yellow-600 border-yellow-500' : 'bg-gray-700 border-gray-600'}`}>
              <Hand className="w-4 h-4 mr-1" /> {myHandRaised ? 'Lower Hand' : 'Raise Hand'}
            </button>
          )}

          {/* Teacher: End class */}
          {isTeacher && isLive && (
            <button onClick={endLiveClass} className="primary-btn bg-gray-700 hover:bg-gray-600 border-gray-600 text-sm">
              <StopCircle className="w-4 h-4 mr-1" /> End Class
            </button>
          )}

          {/* Post-lecture: Go to review */}
          {isEnded && (
            <button onClick={() => navigate(`/classrooms/review/${lecture.id}`)} className="primary-btn bg-purple-600 hover:bg-purple-500 border-purple-500/50 text-sm">
              <Brain className="w-4 h-4 mr-1" /> Review & Quiz
            </button>
          )}
        </div>
      </div>

      {/* ═══ MAIN CONTENT: 3-PANEL LAYOUT ═══ */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">

        {/* LEFT: Video (Jitsi Meet) */}
        <div className="lg:col-span-5 glass-panel overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-gray-800/50 flex items-center gap-2 shrink-0">
            <Video className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-gray-300">Video Conference</span>
            {raisedHands.length > 0 && (
              <span className="ml-auto text-xs text-yellow-400 flex items-center gap-1">
                <Hand className="w-3 h-3" />
                {raisedHands.map(h => h.email.split('@')[0]).join(', ')}
              </span>
            )}
          </div>
          <div ref={jitsiContainerRef} className="flex-1 bg-gray-950 relative" style={{minHeight: '280px'}}>
            {!lecture && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
                <Video className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">{isTeacher ? 'Start a class to begin video' : 'Waiting for teacher to start...'}</p>
              </div>
            )}
          </div>
        </div>

        {/* CENTER: Live Transcript */}
        <div className="lg:col-span-4 glass-panel flex flex-col overflow-hidden border-emerald-500/10">
          <div className="px-3 py-2 border-b border-gray-800/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-gray-300">Live Transcript</span>
            </div>
            {isTeacher && isRecording && <Mic className="w-3 h-3 text-emerald-400 animate-pulse" />}
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">
            {transcript || (isLive ? "Listening for audio..." : (isTeacher ? "Start the class to begin." : (isEnded ? "Lecture has ended. View full transcript in Review." : "Waiting for teacher to start...")))}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* RIGHT: Chat + AI Doubts */}
        <div className="lg:col-span-3 glass-panel flex flex-col overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-gray-800/50 shrink-0">
            {[{ key: 'chat', icon: MessageSquare, label: 'Chat' }, { key: 'ai', icon: Brain, label: 'Ask AI' }].map(tab => (
              <button key={tab.key} onClick={() => setSideTab(tab.key)}
                className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 transition ${
                  sideTab === tab.key ? 'text-primary-400 border-b-2 border-primary-500' : 'text-gray-500 hover:text-gray-300'
                }`}>
                <tab.icon className="w-3 h-3" /> {tab.label}
              </button>
            ))}
          </div>

          {/* Chat Tab */}
          {sideTab === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {chatMessages.length === 0 && <p className="text-xs text-gray-600 text-center mt-8">No messages yet</p>}
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`p-2 rounded-lg text-xs ${
                    msg.is_ai_response
                      ? 'bg-purple-500/10 border border-purple-500/20 text-purple-200'
                      : 'bg-gray-800/50 text-gray-300'
                  }`}>
                    <span className="font-semibold text-gray-400">{msg.is_ai_response ? '🤖 AI' : msg.user_email?.split('@')[0]}: </span>
                    {msg.message}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              {(isLive || isEnded) && (
                <div className="p-2 border-t border-gray-800/50 flex gap-2 shrink-0">
                  <input
                    type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                    placeholder="Type a message..." className="input-field text-xs py-2 flex-1"
                  />
                  <button onClick={sendChat} className="primary-btn text-xs py-2 px-3">
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Ask AI Tab */}
          {sideTab === 'ai' && (
            <div className="flex-1 flex flex-col min-h-0 p-3">
              <p className="text-xs text-gray-400 mb-3">Ask AI about what's being taught in this lecture. The AI uses the live transcript to answer.</p>
              <div className="flex-1 overflow-y-auto space-y-2 mb-3">
                {chatMessages.filter(m => m.is_ai_response).map(msg => (
                  <div key={msg.id} className="p-3 rounded-lg text-xs bg-purple-500/10 border border-purple-500/20 text-purple-200 whitespace-pre-wrap">
                    {msg.message}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 shrink-0">
                <input
                  type="text" value={aiQuestion} onChange={e => setAiQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && askAI()}
                  placeholder="Ask a doubt..." className="input-field text-xs py-2 flex-1"
                />
                <button onClick={askAI} className="primary-btn text-xs py-2 px-3 bg-purple-600 border-purple-500">
                  <Brain className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
