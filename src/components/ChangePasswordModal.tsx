import React, { useState, useEffect } from 'react';
import { KeyRound, Lock, Eye, EyeOff, Check, AlertCircle, Loader2, X, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Criteria
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isDifferent = newPassword.length > 0 && currentPassword.length > 0 && newPassword !== currentPassword;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const validCount = [hasMinLength, hasUppercase, hasNumber, hasSpecial, isDifferent].filter(Boolean).length;
  const isAllValid = hasMinLength && hasUppercase && hasNumber && hasSpecial && isDifferent && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllValid) return;

    setLoading(true);
    setError(null);

    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to update password. Please check your current password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Change Password</h3>
              <p className="text-[11px] text-slate-500">Update your account credentials</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-800">Password Updated Successfully!</h4>
            <p className="text-xs text-slate-500">Your account is now secured with your new password.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Current Password */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  disabled={loading}
                  className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new strong password"
                  required
                  disabled={loading}
                  className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Confirm New Password
              </label>
              <input
                type={showNew ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                required
                disabled={loading}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                  confirmPassword && !passwordsMatch
                    ? 'border-red-300 focus:ring-red-400'
                    : 'border-slate-200 focus:ring-indigo-500'
                }`}
              />
              {confirmPassword && !passwordsMatch && (
                <p className="text-[10px] text-red-500 mt-0.5">Passwords do not match.</p>
              )}
            </div>

            {/* Checklist */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-[10px] space-y-1">
              <div className="font-semibold text-slate-700 mb-0.5">Requirements:</div>
              <div className="grid grid-cols-2 gap-1">
                <div className={`flex items-center space-x-1 ${hasMinLength ? 'text-emerald-700' : 'text-slate-400'}`}>
                  <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] ${hasMinLength ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200'}`}>✓</span>
                  <span>≥8 chars</span>
                </div>
                <div className={`flex items-center space-x-1 ${hasUppercase ? 'text-emerald-700' : 'text-slate-400'}`}>
                  <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] ${hasUppercase ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200'}`}>✓</span>
                  <span>1 uppercase</span>
                </div>
                <div className={`flex items-center space-x-1 ${hasNumber ? 'text-emerald-700' : 'text-slate-400'}`}>
                  <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] ${hasNumber ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200'}`}>✓</span>
                  <span>1 number</span>
                </div>
                <div className={`flex items-center space-x-1 ${hasSpecial ? 'text-emerald-700' : 'text-slate-400'}`}>
                  <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] ${hasSpecial ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200'}`}>✓</span>
                  <span>1 symbol</span>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !isAllValid}
                className="flex-1 py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl text-xs shadow-sm transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Update Password</span>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
