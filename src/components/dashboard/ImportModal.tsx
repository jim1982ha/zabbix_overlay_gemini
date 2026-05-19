import React, { useState, useRef } from "react";
import { Upload, X, FileJson, ClipboardPaste, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: any) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [pasteContent, setPasteContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        validateAndImport(json);
      } catch (err) {
        setError("Failed to parse JSON file. Please ensure it's a valid JSON.");
      }
    };
    reader.readAsText(file);
  };

  const validateAndImport = (json: any) => {
    if (json.widgets && Array.isArray(json.widgets)) {
      onImport(json);
      onClose();
    } else {
      setError("Invalid dashboard configuration. Missing 'widgets' array.");
    }
  };

  const handlePasteImport = () => {
    setError(null);
    try {
      const json = JSON.parse(pasteContent);
      validateAndImport(json);
    } catch (err) {
      setError("Invalid JSON content. Please check for syntax errors.");
    }
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Import Dashboard</h3>
              <p className="text-xs text-slate-500 font-medium">Load your configuration to get started</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button 
              onClick={() => setActiveTab('file')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'file' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileJson className="w-4 h-4" /> File Upload
            </button>
            <button 
              onClick={() => setActiveTab('paste')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'paste' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ClipboardPaste className="w-4 h-4" /> Paste JSON
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'file' ? (
              <motion.div 
                key="file"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <div 
                  onDragEnter={onDrag}
                  onDragLeave={onDrag}
                  onDragOver={onDrag}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    group relative border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center gap-4
                    ${dragActive ? 'border-blue-400 bg-blue-50/50 scale-[1.02]' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50/50'}
                  `}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    dragActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500'
                  }`}>
                    <Upload className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-900 mb-1">Click to browse or drag & drop</p>
                    <p className="text-xs text-slate-500">Supports .json files only</p>
                  </div>
                  <input 
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".json,application/json,text/plain"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="paste"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="relative group">
                  <textarea 
                    value={pasteContent}
                    onChange={(e) => setPasteContent(e.target.value)}
                    placeholder="Paste your JSON configuration here..."
                    className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none placeholder:text-slate-300"
                  />
                  {pasteContent && (
                    <button 
                      onClick={() => setPasteContent('')}
                      className="absolute top-2 right-2 p-1 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg text-slate-400 hover:text-red-500 transition-colors shadow-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button 
                  onClick={handlePasteImport}
                  disabled={!pasteContent.trim()}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Import from Text
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-red-700">{error}</p>
            </motion.div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
               <AlertCircle className="w-4 h-4 text-amber-500" />
             </div>
             <p className="text-[10px] text-slate-500 font-medium leading-relaxed uppercase">
               Note: Importing a new configuration will overwrite your current widgets. You can always undo or discard changes if they haven't been saved.
             </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
