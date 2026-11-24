import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, Database, X } from 'lucide-react';
import { api } from '../services/api';

interface ImportLocalDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportLocalDataModal: React.FC<ImportLocalDataModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    imported: Record<string, number>;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.importLocalDataToFirestore();
      setResult(res);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to import local data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Import Local Data to Firestore</h3>
              <p className="text-xs text-muted-foreground">Migrate legacy browser data (`novapulse_local_db`)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!result ? (
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              This one-time utility will read all records stored in your browser's local mock database and upload them into Cloud Firestore under your authenticated user session.
            </p>

            <div className="p-3.5 rounded-xl bg-muted/50 border border-border text-xs space-y-1.5 text-foreground">
              <div className="font-semibold text-foreground">What will be migrated:</div>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Candidates, Openings & Clients</li>
                <li>Interview Logs & Scheduled Follow-ups</li>
                <li>Joining Tracker & Commercial Details</li>
                <li>Custom Dropdown Options & HR Registry</li>
                <li>User accounts (<strong>passwords & hashes are completely skipped</strong>)</li>
              </ul>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                {loading ? 'Migrating to Cloud...' : 'Start Migration'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Data Migration Completed</h4>
              <p className="text-xs text-muted-foreground mt-1">{result.message}</p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs p-3 rounded-xl bg-muted/40 border border-border">
              <div>
                <span className="block font-bold text-foreground text-sm">{result.imported.candidates || 0}</span>
                <span className="text-muted-foreground text-[10px]">Candidates</span>
              </div>
              <div>
                <span className="block font-bold text-foreground text-sm">{result.imported.openings || 0}</span>
                <span className="text-muted-foreground text-[10px]">Openings</span>
              </div>
              <div>
                <span className="block font-bold text-foreground text-sm">{result.imported.clients || 0}</span>
                <span className="text-muted-foreground text-[10px]">Clients</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-sm"
            >
              Done & Refresh Data
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
