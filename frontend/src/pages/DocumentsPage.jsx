import { useState, useEffect } from 'react';
import { FileText, UploadCloud, Loader2, Trash2, File, Clock, Eye, EyeOff, BookOpen, Users, Download, AlertCircle } from 'lucide-react';
import api from '../api/client';

const API = 'http://localhost:8000/api';

export default function DocumentsPage() {
  const [documents, setDocuments]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [file, setFile]                 = useState(null);
  const [uploading, setUploading]       = useState(false);
  const [uploadMsg, setUploadMsg]       = useState(null); // { type, text }
  const [openDocId, setOpenDocId]       = useState(null);
  const [textContent, setTextContent]   = useState('');
  const [textLoading, setTextLoading]   = useState(false);
  const [pasteMode, setPasteMode]       = useState(false);
  const [pasteTitle, setPasteTitle]     = useState('');
  const [pasteText, setPasteText]       = useState('');

  const token = localStorage.getItem('token');

  const personalDocs = documents.filter(d => !d.title?.startsWith('['));
  const classDocs    = documents.filter(d =>  d.title?.startsWith('['));

  const fetchDocs = () => {
    setLoading(true);
    api.get('/documents')
      .then(res => setDocuments(res.data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    const fm = new FormData();
    fm.append('file', file);
    try {
      const res = await api.post('/documents/upload', fm);
      setFile(null);
      const input = document.getElementById('file_input');
      if (input) input.value = '';
      fetchDocs();
      if (res.data.warning) {
        setUploadMsg({ type: 'warn', text: `⚠️ ${res.data.warning}` });
      } else {
        setUploadMsg({ type: 'ok', text: `✅ Uploaded! ${res.data.chunks_count} chunks indexed.` });
      }
    } catch (e) {
      setUploadMsg({ type: 'err', text: e.response?.data?.message || 'Upload failed.' });
    }
    setUploading(false);
  };

  const handlePaste = async () => {
    if (!pasteTitle.trim() || !pasteText.trim()) return;
    setUploading(true);
    try {
      await api.post('/documents/text', { title: pasteTitle, content: pasteText });
      setPasteTitle(''); setPasteText(''); setPasteMode(false);
      fetchDocs();
    } catch (e) { alert('Failed to save.'); }
    setUploading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this document from your knowledge base?')) return;
    try {
      await api.delete(`/documents/${id}`);
      setDocuments(prev => prev.filter(d => (d.id || d._id) !== id));
      if (openDocId === id) { setOpenDocId(null); setTextContent(''); }
    } catch (e) { alert('Failed to delete.'); }
  };

  const togglePreview = async (doc) => {
    const did = doc.id || doc._id;

    // Close if already open
    if (openDocId === did) { setOpenDocId(null); setTextContent(''); return; }

    setOpenDocId(did);
    setTextContent('');

    if (doc.source_type === 'pdf' && doc.has_raw_file) {
      // PDF with raw file → use iframe (no extra fetch needed)
      return;
    }

    // Anything else → fetch extracted text
    setTextLoading(true);
    try {
      const res = await api.get(`/documents/${did}`);
      const content = res.data.content;
      if (!content || content.trim().startsWith('%PDF-')) {
        setTextContent('__USE_FILE_ENDPOINT__'); // flag: use /file as plain text
      } else {
        setTextContent(content || 'No text content available.');
      }
    } catch (e) { setTextContent('Failed to load content.'); }
    setTextLoading(false);
  };

  // Authenticated URL for file endpoint
  const fileUrl  = (id, download = false) =>
    `${API}/documents/${id}/file?token=${token}${download ? '&download=1' : ''}`;

  const DocCard = ({ doc }) => {
    const did    = doc.id || doc._id;
    const isOpen = openDocId === did;
    const isPdf  = doc.source_type === 'pdf';

    // Decide what to show in the preview
    const showIframe = isOpen && isPdf && (doc.has_raw_file || textContent === '__USE_FILE_ENDPOINT__');

    return (
      <div className={`glass-panel overflow-hidden transition-all duration-300
        ${isOpen ? 'border-primary-500/40 shadow-xl shadow-primary-500/10' : 'hover:border-gray-600/50'}`}>

        {/* ── Row ── */}
        <div className="p-4 flex items-center justify-between gap-3">
          {/* Icon + info */}
          <div className="flex items-center gap-4 min-w-0">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm
              ${isPdf ? 'bg-red-500/20 text-red-400' :
                doc.source_type === 'lecture' ? 'bg-purple-500/20 text-purple-400' :
                'bg-blue-500/20 text-blue-400'}`}>
              {isPdf ? 'PDF' : doc.source_type === 'lecture' ? '🎙' : 'TXT'}
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-gray-200 truncate">{doc.title}</h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-1">
                {doc.chunks_count > 0
                  ? <span className="text-emerald-500 font-semibold">{doc.chunks_count} chunks ✓ AI-indexed</span>
                  : <span className="text-amber-500 font-semibold">⚠ Scanned – visual only</span>
                }
                <span className="flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(doc.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* View */}
            <button onClick={() => togglePreview(doc)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${isOpen
                  ? 'text-primary-400 bg-primary-500/15'
                  : 'text-gray-400 hover:text-primary-400 hover:bg-primary-500/10'}`}>
              {isOpen ? <><EyeOff className="w-3.5 h-3.5" /> Close</> : <><Eye className="w-3.5 h-3.5" /> View</>}
            </button>
            {/* Download */}
            <a href={fileUrl(did, true)} download={doc.title}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="Download">
              <Download className="w-3.5 h-3.5" /> Save
            </a>
            {/* Delete */}
            <button onClick={() => handleDelete(did)}
              className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Preview Panel ── */}
        {isOpen && (
          <div className="border-t border-gray-700/50 animate-fade-in">
            {showIframe ? (
              /* PDF iframe viewer */
              <div className="relative bg-gray-950" style={{ height: '75vh' }}>
                <iframe
                  key={did}
                  src={fileUrl(did)}
                  title={doc.title}
                  className="w-full h-full border-0"
                  style={{ minHeight: 480 }}
                  onError={() => setTextContent('__USE_FILE_ENDPOINT__')}
                />
              </div>
            ) : textLoading ? (
              <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-10">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading content...
              </div>
            ) : textContent === '__USE_FILE_ENDPOINT__' ? (
              /* Fallback: serve file via /file endpoint as plain text iframe */
              <div className="relative bg-gray-950" style={{ height: '75vh' }}>
                <iframe src={fileUrl(did)} title={doc.title} className="w-full h-full border-0" />
              </div>
            ) : (
              /* Plain text viewer */
              <div className="px-6 py-4 bg-gray-900/20 max-h-[70vh] overflow-y-auto">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                  {textContent}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display bg-gradient-to-r from-primary-200 to-primary-400 bg-clip-text text-transparent">Documents</h1>
        <p className="text-gray-400 mt-1">Your Second Brain — upload files to view and ask AI about them</p>
      </div>

      {/* Upload */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-white font-display">Add Document</h2>
          </div>
          <button onClick={() => setPasteMode(!pasteMode)} className="secondary-btn text-xs">
            {pasteMode ? '📁 Upload File' : '📝 Paste Text'}
          </button>
        </div>

        {!pasteMode ? (
          <>
            <p className="text-sm text-gray-400 mb-4">
              Supports <strong className="text-white">PDF</strong> (any — text or scanned) and <strong className="text-white">TXT</strong>.
              PDFs are always stored for visual viewing. Text-based PDFs are also AI-indexed.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <input type="file" id="file_input" className="hidden" accept=".pdf,.txt,.png,.jpg,.jpeg,.doc,.docx"
                onChange={e => setFile(e.target.files[0])} />
              <button onClick={() => document.getElementById('file_input').click()}
                className="secondary-btn flex items-center gap-2">
                <File className="w-4 h-4" />
                {file ? file.name : 'Choose File'}
              </button>
              {file && (
                <>
                  <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                  <button id="upload-btn" onClick={handleUpload} disabled={uploading} className="primary-btn">
                    {uploading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Processing...</> : '⚡ Upload & Index'}
                  </button>
                </>
              )}
            </div>

            {/* Upload status message */}
            {uploadMsg && (
              <div className={`mt-3 p-3 rounded-xl text-sm flex items-start gap-2 ${
                uploadMsg.type === 'ok'   ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' :
                uploadMsg.type === 'warn' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' :
                                            'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {uploadMsg.text}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <input type="text" placeholder="Document title..." className="input-field"
              value={pasteTitle} onChange={e => setPasteTitle(e.target.value)} />
            <textarea placeholder="Paste your text content here..." className="input-field resize-none h-32 text-sm"
              value={pasteText} onChange={e => setPasteText(e.target.value)} />
            <button onClick={handlePaste} disabled={uploading || !pasteTitle || !pasteText} className="primary-btn text-sm">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save & Index
            </button>
          </div>
        )}

        <div className="mt-4 p-3 bg-primary-500/5 border border-primary-500/20 rounded-xl text-xs text-gray-400">
          <strong className="text-primary-400">💡 AI Chat:</strong> After uploading a text-based PDF or TXT, ask:
          <em className="text-gray-300"> "Summarize JaiResume"</em> or <em className="text-gray-300">"What skills are listed?"</em>
        </div>
      </div>

      {/* Doc lists */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5" /> My Documents ({personalDocs.length})
            </h2>
            {personalDocs.length === 0 ? (
              <div className="glass-panel p-10 text-center">
                <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No documents yet. Upload a file above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {personalDocs.map(doc => <DocCard key={doc.id || doc._id} doc={doc} />)}
              </div>
            )}
          </div>

          {classDocs.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-blue-400" /> Class Materials ({classDocs.length})
              </h2>
              <div className="space-y-3">
                {classDocs.map(doc => <DocCard key={doc.id || doc._id} doc={doc} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
