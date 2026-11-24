import React, { useState } from 'react';
import { AlertTriangle, Copy, Check, ExternalLink, RefreshCw, Database, ShieldCheck } from 'lucide-react';
import { getMissingFirebaseEnvVars, firebaseConfig } from '../services/firebase';

export const FirebaseConfigMissing: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const missingVars = getMissingFirebaseEnvVars();

  const envTemplate = `# NovaPulse CRM - Firebase Production Configuration
VITE_FIREBASE_API_KEY=${firebaseConfig.apiKey || 'your_api_key_here'}
VITE_FIREBASE_AUTH_DOMAIN=${firebaseConfig.authDomain || 'your_project_id.firebaseapp.com'}
VITE_FIREBASE_PROJECT_ID=${firebaseConfig.projectId || 'your_project_id'}
VITE_FIREBASE_STORAGE_BUCKET=${firebaseConfig.storageBucket || 'your_project_id.appspot.com'}
VITE_FIREBASE_MESSAGING_SENDER_ID=${firebaseConfig.messagingSenderId || 'your_messaging_sender_id'}
VITE_FIREBASE_APP_ID=${firebaseConfig.appId || 'your_app_id'}
VITE_FIREBASE_MEASUREMENT_ID=${firebaseConfig.measurementId || 'G-XXXXXXXXXX'}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(envTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-3xl bg-slate-800/90 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-sm">
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-slate-700 bg-slate-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/25">
              NP
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                NovaPulse CRM
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Setup Required
                </span>
              </h1>
              <p className="text-sm text-slate-400">Cloud Database & Authentication Configuration</p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-medium text-white transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Check Again
          </button>
        </div>

        {/* Notice Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-300">Firebase Configuration Missing:</span> Local mock mode (`novapulse_local_db`) has been permanently retired. All logins now require Firebase Auth and all CRM data is stored in Cloud Firestore to ensure real multi-browser and multi-device synchronization.
            </div>
          </div>

          {/* Missing Variables Table */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              Required Environment Variables ({missingVars.length} Missing)
            </h2>
            <div className="bg-slate-900/80 rounded-xl border border-slate-700/80 overflow-hidden">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700 font-semibold">
                  <tr>
                    <th className="p-3">Variable Name</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 hidden sm:table-cell">Firebase Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-xs">
                  {[
                    { key: 'VITE_FIREBASE_API_KEY', src: 'apiKey' },
                    { key: 'VITE_FIREBASE_AUTH_DOMAIN', src: 'authDomain' },
                    { key: 'VITE_FIREBASE_PROJECT_ID', src: 'projectId' },
                    { key: 'VITE_FIREBASE_STORAGE_BUCKET', src: 'storageBucket' },
                    { key: 'VITE_FIREBASE_MESSAGING_SENDER_ID', src: 'messagingSenderId' },
                    { key: 'VITE_FIREBASE_APP_ID', src: 'appId' },
                    { key: 'VITE_FIREBASE_MEASUREMENT_ID', src: 'measurementId (optional)' }
                  ].map((item) => {
                    const isMissing = missingVars.includes(item.key);
                    return (
                      <tr key={item.key} className={isMissing ? 'bg-amber-950/20' : 'bg-emerald-950/20'}>
                        <td className="p-3 font-semibold text-slate-200">{item.key}</td>
                        <td className="p-3 font-sans">
                          {isMissing ? (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                              Missing
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                              <Check className="w-3.5 h-3.5" />
                              Configured
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-400 hidden sm:table-cell">{item.src}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Copy Code Block */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Environment Variables Format
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-all shadow-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied to Clipboard!' : 'Copy Template'}
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-indigo-300 font-mono text-xs overflow-x-auto leading-relaxed">
              {envTemplate}
            </pre>
          </div>

          {/* Setup Guide */}
          <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/80 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              How to Add in Vercel & Firebase:
            </h3>
            <ol className="text-xs sm:text-sm text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                Open the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline font-semibold inline-flex items-center gap-0.5">Firebase Console <ExternalLink className="w-3 h-3" /></a>, select your project, go to <strong>Project Settings → General → Your Apps → Web App (`&lt;/&gt;`)</strong>, and copy your config.
              </li>
              <li>
                In the Firebase Console, go to <strong>Authentication → Settings → Authorized domains</strong> and add:
                <code className="ml-1 px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 font-mono text-xs">novapulse-hiring-crm.vercel.app</code>
              </li>
              <li>
                Open <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline font-semibold inline-flex items-center gap-0.5">Vercel Dashboard <ExternalLink className="w-3 h-3" /></a> → <strong>novapulse-hiring-crm</strong> → <strong>Settings → Environment Variables</strong>.
              </li>
              <li>
                Add each <code className="px-1 py-0.5 rounded bg-slate-900 text-indigo-300 font-mono text-xs">VITE_FIREBASE_*</code> variable, then trigger a new deployment or push a commit.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
