import React, { useState } from 'react';
import { KeyRound, Lock, Eye, EyeOff, Check, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import type { User } from '../types';

interface ForceChangePasswordViewProps {
  user: User;
  onPasswordChanged: (updatedUser: User) => void;
}

export const ForceChangePasswordView: React.FC<ForceChangePasswordViewProps> = ({ user, onPasswordChanged }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Criteria validation
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isDifferentFromCurrent = newPassword.length > 0 && currentPassword.length > 0 && newPassword !== currentPassword;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const validCount = [hasMinLength, hasUppercase, hasNumber, hasSpecial, isDifferentFromCurrent].filter(Boolean).length;
  const isAllValid = hasMinLength && hasUppercase && hasNumber && hasSpecial && isDifferentFromCurrent && passwordsMatch;

  // Strength score
  const getStrengthMeta = () => {
    if (validCount <= 2) return { text: 'Weak', color: 'bg-red-500', width: '25%', textColor: 'text-red-600' };
    if (validCount <= 4) return { text: 'Moderate', color: 'bg-amber-500', width: '65%', textColor: 'text-amber-600' };
    return { text: 'Strong', color: 'bg-emerald-500', width: '100%', textColor: 'text-emerald-600' };
  };

  const strength = getStrengthMeta();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllValid) return;

    setLoading(true);
    setError(null);

    try {
      await api.changePassword(currentPassword, newPassword);
      const updatedUser: User = {
        ...user,
        must_change_password: false
      };
      onPasswordChanged(updatedUser);
    } catch (err: any) {
      setError(err?.message || 'Failed to update password. Please verify your current temporary password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="pt-8 pb-4 px-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 shadow-sm border border-amber-200/60 mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Password Update Required</h1>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Welcome, <span className="font-semibold text-slate-700">{user.name}</span>. For your security, you must replace your initial temporary password before continuing.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl text-sm bg-red-50 border border-red-200 text-red-800 flex items-start space-x-2.5">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-xs font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {/* Current / Temporary Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Current Temporary Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter temporary password"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create a strong password"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength Meter Bar */}
              {newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Password Strength:</span>
                    <span className={`font-semibold ${strength.textColor}`}>{strength.text}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strength.color}`}
                      style={{ width: strength.width }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  disabled={loading}
                  className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 transition-all ${
                    confirmPassword && !passwordsMatch
                      ? 'border-red-300 focus:ring-red-400'
                      : 'border-slate-200 focus:ring-indigo-500'
                  }`}
                />
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-[11px] text-red-500 mt-1">Passwords do not match.</p>
              )}
            </div>

            {/* Password Policy Checklist */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-700 mb-1 flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Password Requirements</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                <div className={`flex items-center space-x-1.5 ${hasMinLength ? 'text-emerald-700' : 'text-slate-500'}`}>
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasMinLength ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                    {hasMinLength ? <Check className="w-2.5 h-2.5" /> : '•'}
                  </span>
                  <span>At least 8 characters</span>
                </div>

                <div className={`flex items-center space-x-1.5 ${hasUppercase ? 'text-emerald-700' : 'text-slate-500'}`}>
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasUppercase ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                    {hasUppercase ? <Check className="w-2.5 h-2.5" /> : '•'}
                  </span>
                  <span>1 uppercase letter (A-Z)</span>
                </div>

                <div className={`flex items-center space-x-1.5 ${hasNumber ? 'text-emerald-700' : 'text-slate-500'}`}>
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasNumber ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                    {hasNumber ? <Check className="w-2.5 h-2.5" /> : '•'}
                  </span>
                  <span>1 number (0-9)</span>
                </div>

                <div className={`flex items-center space-x-1.5 ${hasSpecial ? 'text-emerald-700' : 'text-slate-500'}`}>
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasSpecial ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                    {hasSpecial ? <Check className="w-2.5 h-2.5" /> : '•'}
                  </span>
                  <span>1 special symbol (!@#$)</span>
                </div>

                <div className={`flex items-center space-x-1.5 sm:col-span-2 ${isDifferentFromCurrent ? 'text-emerald-700' : 'text-slate-500'}`}>
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${isDifferentFromCurrent ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                    {isDifferentFromCurrent ? <Check className="w-2.5 h-2.5" /> : '•'}
                  </span>
                  <span>Different from temporary password</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !isAllValid}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md shadow-indigo-500/20 hover:shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Securing Account...</span>
                </>
              ) : (
                <span>Save New Password & Enter CRM</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
