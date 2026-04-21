import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Loader2, Plus, UserPlus, PlayCircle, BookOpen, FileText, Calendar, Trash2, Clock, Brain, BarChart3, UploadCloud, File } from 'lucide-react';
import api from '../api/client';

export default function ClassroomsPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [classrooms, setClassrooms] = useState({ teaching: [], enrolled: [] });
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassSubject, setNewClassSubject] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [newClassSchedule, setNewClassSchedule] = useState('');
  const [joining, setJoining] = useState(false);

  // Selected classroom detail
  const [selectedClass, setSelectedClass] = useState(null);
  const [classDetail, setClassDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Material add
  const [matTitle, setMatTitle]     = useState('');
  const [matContent, setMatContent] = useState('');
  const [matFile, setMatFile]       = useState(null);
  const [uploadingMat, setUploadingMat] = useState(false);

  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profileRes, classRes] = await Promise.all([
        api.get('/settings/profile'),
        api.get('/classrooms/')
      ]);
      setProfile(profileRes.data);
      setClassrooms(classRes.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newClassName) return;
    setCreating(true);
    try {
      await api.post('/classrooms/', {
        name: newClassName, subject: newClassSubject,
        description: newClassDesc, schedule: newClassSchedule
      });
      setNewClassName(''); setNewClassSubject(''); setNewClassDesc(''); setNewClassSchedule('');
      await loadData();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to create classroom');
    }
    setCreating(false);
  };

  const handleJoin = async () => {
    if (!joinCode) return;
    setJoining(true);
    try {
      await api.post('/classrooms/join', { join_code: joinCode });
      setJoinCode('');
      await loadData();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to join classroom');
    }
    setJoining(false);
  };

  const loadClassDetail = async (classId) => {
    setLoadingDetail(true);
    setSelectedClass(classId);
    try {
      const res = await api.get(`/classrooms/${classId}`);
      setClassDetail(res.data);
    } catch (e) { console.error(e); }
    setLoadingDetail(false);
  };

  const addMaterial = async () => {
    if (!matTitle || !selectedClass) return;
    try {
      await api.post(`/classrooms/${selectedClass}/materials`, { title: matTitle, content: matContent });
      setMatTitle(''); setMatContent('');
      loadClassDetail(selectedClass);
    } catch (e) { alert('Failed to add material'); }
  };

  const uploadMaterial = async () => {
    if (!matFile || !selectedClass) return;
    setUploadingMat(true);
    const fm = new FormData();
    fm.append('file', matFile);
    try {
      const res = await api.post(`/classrooms/${selectedClass}/materials/upload`, fm);
      setMatFile(null);
      const fi = document.getElementById('mat_file_input');
      if (fi) fi.value = '';
      alert(`✅ Uploaded! Pushed to ${res.data.pushed_to}.`);
      loadClassDetail(selectedClass);
    } catch (e) {
      alert(e.response?.data?.message || 'Upload failed');
    }
    setUploadingMat(false);
  };

  const deleteMaterial = async (matId) => {
    try {
      await api.delete(`/classrooms/${selectedClass}/materials/${matId}`);
      loadClassDetail(selectedClass);
    } catch (e) { console.error(e); }
  };


  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;

  const isTeacher = profile?.role === 'teacher' || profile?.role === 'admin';
  const allClasses = [...classrooms.teaching, ...classrooms.enrolled];

  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display bg-gradient-to-r from-primary-200 to-primary-400 bg-clip-text text-transparent">Classrooms</h1>
        <p className="text-gray-400 mt-1">Live classes, shared resources, and collaborative learning</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Class Lists */}
        <div className="lg:col-span-2 space-y-6">

          {/* Teaching */}
          {isTeacher && (
            <div className="glass-panel p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" /> Classes You Teach
              </h2>
              {classrooms.teaching.length === 0 ? (
                <p className="text-sm text-gray-500">No classes created yet.</p>
              ) : (
                <div className="space-y-3">
                  {classrooms.teaching.map(c => {
                    const cid = c._id || c.id;
                    return (
                    <div key={cid} className={`p-4 rounded-xl border transition cursor-pointer ${
                      selectedClass === cid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-gray-800/40 border-gray-700/50 hover:border-gray-600'
                    }`} onClick={() => loadClassDetail(cid)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-white flex items-center gap-2">
                            {c.name}
                            {c.subject && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">{c.subject}</span>}
                          </h3>
                          <p className="text-xs text-gray-400 mt-1">
                            Code: <span className="font-mono text-emerald-400">{c.joinCode || c.join_code}</span>
                            {c.schedule && <span className="ml-2">📅 {c.schedule}</span>}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Link to={`/classrooms/live/${cid}`} className="primary-btn text-xs bg-emerald-600 hover:bg-emerald-500" onClick={e => e.stopPropagation()}>
                            <PlayCircle className="w-4 h-4 mr-1" /> Go Live
                          </Link>
                        </div>
                      </div>
                    </div>)
                  })}
                </div>
              )}
            </div>
          )}

          {/* Enrolled */}
          <div className="glass-panel p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-400" /> Enrolled Classes
            </h2>
            {classrooms.enrolled.length === 0 ? (
              <p className="text-sm text-gray-500">No enrolled classes.</p>
            ) : (
              <div className="space-y-3">
                {classrooms.enrolled.map(c => {
                  const cid = c._id || c.id;
                  return (
                  <div key={cid} className={`p-4 rounded-xl border transition cursor-pointer ${
                    selectedClass === cid ? 'bg-blue-500/10 border-blue-500/30' : 'bg-gray-800/40 border-gray-700/50 hover:border-gray-600'
                  }`} onClick={() => loadClassDetail(cid)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-white">{c.name}</h3>
                        <p className="text-xs text-gray-400">{c.subject || c.description}</p>
                      </div>
                      <Link to={`/classrooms/live/${cid}`} className="primary-btn text-xs bg-blue-600 hover:bg-blue-500" onClick={e => e.stopPropagation()}>
                        <PlayCircle className="w-4 h-4 mr-1" /> Join
                      </Link>
                    </div>
                  </div>)
                })}
              </div>
            )}
          </div>

          {/* CLASS DETAIL PANEL */}
          {selectedClass && classDetail && (
            <div className="glass-panel p-6 border-primary-500/20">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">{classDetail.name}</h2>
                    <span className="text-xs text-gray-400">{classDetail.student_count} student(s)</span>
                  </div>

                  {/* Past Lectures */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> Past Lectures</h3>
                    {classDetail.lectures.filter(l => !l.is_live).length === 0 ? (
                      <p className="text-xs text-gray-500">No completed lectures yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {classDetail.lectures.filter(l => !l.is_live).map(l => (
                          <div key={l.id} className="p-3 bg-gray-800/40 rounded-lg flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-white">{l.title}</p>
                              <p className="text-xs text-gray-500">
                                {l.started_at ? new Date(l.started_at).toLocaleDateString() : ''}
                                {l.has_summary && <span className="ml-2 text-emerald-400">✅ Notes</span>}
                                {l.has_quiz && <span className="ml-2 text-purple-400">📝 Quiz</span>}
                              </p>
                            </div>
                            <button onClick={() => navigate(`/classrooms/review/${l.id}`)} className="primary-btn text-xs bg-purple-600 border-purple-500">
                              <Brain className="w-3 h-3 mr-1" /> Review
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Materials */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Class Materials</h3>
                    {classDetail.materials.length === 0 ? (
                      <p className="text-xs text-gray-500">No materials uploaded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {classDetail.materials.map(m => (
                          <div key={m.id} className="p-3 bg-gray-800/40 rounded-lg flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-white">{m.title}</p>
                              <p className="text-xs text-gray-500">{m.content?.substring(0, 80)}...</p>
                            </div>
                            {isTeacher && (
                              <button onClick={() => deleteMaterial(m._id || m.id)} className="p-1 hover:bg-red-500/20 rounded text-red-400">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add material (teacher only) */}
                    {isTeacher && (
                      <div className="mt-3 p-3 bg-gray-900/50 rounded-lg border border-gray-800 space-y-3">
                        <p className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                          <UploadCloud className="w-3 h-3" /> Add Class Material
                          <span className="ml-auto text-gray-600 font-normal">Pushed to all enrolled students</span>
                        </p>
                        {/* File upload */}
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Upload PDF or TXT (students get it in their Documents)</p>
                          <div className="flex gap-2">
                            <input type="file" id="mat_file_input" className="hidden" accept=".pdf,.txt"
                              onChange={e => setMatFile(e.target.files[0])} />
                            <button onClick={() => document.getElementById('mat_file_input').click()}
                              className="secondary-btn text-xs flex items-center gap-1">
                              <File className="w-3 h-3" /> {matFile ? matFile.name : 'Choose File'}
                            </button>
                            {matFile && (
                              <button onClick={uploadMaterial} disabled={uploadingMat} className="primary-btn text-xs bg-emerald-600 hover:bg-emerald-500 border-emerald-500">
                                {uploadingMat ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UploadCloud className="w-3 h-3 mr-1" />}
                                Upload & Push
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Text note */}
                        <div className="border-t border-gray-800 pt-3">
                          <p className="text-xs text-gray-500 mb-1">Or add a text note / link</p>
                          <input type="text" placeholder="Title" className="input-field text-xs py-1.5 mb-2" value={matTitle} onChange={e => setMatTitle(e.target.value)} />
                          <textarea placeholder="Content or URL" className="input-field text-xs resize-none h-14" value={matContent} onChange={e => setMatContent(e.target.value)} />
                          <button onClick={addMaterial} disabled={!matTitle} className="primary-btn text-xs mt-2">
                            <Plus className="w-3 h-3 mr-1" /> Add Note
                          </button>
                        </div>
                      </div>
                    )}
                  </div>


                  {/* Students */}
                  {isTeacher && classDetail.students.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Enrolled Students</h3>
                      <div className="space-y-1">
                        {classDetail.students.map((s, i) => (
                          <div key={s.id} className="flex items-center gap-2 text-sm text-gray-400 p-2">
                            <span className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center text-xs text-primary-400 font-bold">{i + 1}</span>
                            {s.email}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Analytics link (teacher) */}
                  {isTeacher && (
                    <button onClick={() => navigate(`/classrooms/analytics/${selectedClass}`)} className="primary-btn w-full justify-center bg-indigo-600 border-indigo-500">
                      <BarChart3 className="w-4 h-4 mr-2" /> View Class Analytics
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Actions */}
        <div className="space-y-6">
          <div className="glass-panel p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Join a Classroom</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Enter Join Code" className="input-field uppercase font-mono"
                value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} />
              <button onClick={handleJoin} disabled={joining || !joinCode} className="w-full primary-btn justify-center">
                {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4 mr-2" /> Join Class</>}
              </button>
            </div>
          </div>

          {isTeacher && (
            <div className="glass-panel p-6 border-emerald-500/20 bg-emerald-900/10">
              <h2 className="text-lg font-semibold text-white mb-4">Create Classroom</h2>
              <div className="space-y-3">
                <input type="text" placeholder="Class Name *" className="input-field"
                  value={newClassName} onChange={e => setNewClassName(e.target.value)} />
                <input type="text" placeholder="Subject (e.g., Physics)" className="input-field text-sm"
                  value={newClassSubject} onChange={e => setNewClassSubject(e.target.value)} />
                <input type="text" placeholder="Schedule (e.g., Mon/Wed 10 AM)" className="input-field text-sm"
                  value={newClassSchedule} onChange={e => setNewClassSchedule(e.target.value)} />
                <textarea placeholder="Description" className="input-field resize-none h-16 text-sm"
                  value={newClassDesc} onChange={e => setNewClassDesc(e.target.value)} />
                <button onClick={handleCreate} disabled={creating || !newClassName}
                  className="w-full primary-btn bg-emerald-600 hover:bg-emerald-500 justify-center border-emerald-500/50">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" /> Create Class</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
