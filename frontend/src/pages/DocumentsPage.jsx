import { useState, useEffect } from 'react';
import { FileText, UploadCloud, Loader2, Trash2, File, Clock } from 'lucide-react';
import api from '../api/client';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const fetchDocs = () => {
    api.get('/upload/')
      .then(res => setDocuments(res.data.documents || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const fm = new FormData();
    fm.append('file', file);
    try {
      await api.post('/upload/', fm);
      setFile(null);
      const fileInput = document.getElementById('file_input');
      if (fileInput) fileInput.value = '';
      fetchDocs();
    } catch (e) {
      alert(e.response?.data?.detail || 'Upload failed. Please try again.');
    }
    setUploading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this document? This will also remove it from your knowledge base.')) return;
    try {
      await api.delete(`/upload/${id}`);
      setDocuments(documents.filter(d => d.id !== id));
    } catch (e) {
      alert('Failed to delete document.');
    }
  };

  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display bg-gradient-to-r from-primary-200 to-primary-400 bg-clip-text text-transparent">Documents</h1>
        <p className="text-gray-400 mt-1">Upload files to feed your Second Brain</p>
      </div>

      {/* Upload Section */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-4">
          <UploadCloud className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white font-display">Upload Document</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">Supported: PDF, TXT. Content will be extracted, chunked, and stored in your knowledge base for AI search.</p>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="file"
            id="file_input"
            className="hidden"
            accept=".pdf,.txt"
            onChange={e => setFile(e.target.files[0])}
          />
          <button
            onClick={() => document.getElementById('file_input').click()}
            className="secondary-btn flex items-center gap-2"
          >
            <File className="w-4 h-4" />
            {file ? file.name : 'Choose File'}
          </button>
          {file && (
            <>
              <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
              <button id="upload-btn" onClick={handleUpload} disabled={uploading} className="primary-btn">
                {uploading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing...</> : 'Upload & Process'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : documents.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No documents uploaded yet. Upload your first file above!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map(doc => (
            <div key={doc.id} className="glass-panel p-4 flex items-center justify-between group hover:border-primary-500/30 transition-all">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  doc.source_type === 'pdf' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                }`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-200">{doc.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span className="uppercase font-medium">{doc.source_type}</span>
                    <span>{doc.chunk_count} chunks</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                className="p-2 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
