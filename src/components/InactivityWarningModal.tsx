import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, AlertTriangle, LogOut, CheckCircle2 } from 'lucide-react';

interface InactivityWarningModalProps {
  onLogout: () => void;
  inactivityLimitMs?: number; // defaults to 29 mins (1,740,000 ms)
  warningDurationSeconds?: number; // defaults to 60s
}

export const InactivityWarningModal: React.FC<InactivityWarningModalProps> = ({
  onLogout,
  inactivityLimitMs = 29 * 60 * 1000,
  warningDurationSeconds = 60
}) => {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(warningDurationSeconds);
  const lastActivityRef = useRef<number>(Date.now());
  const countdownIntervalRef = useRef<any>(null);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showWarning) {
      setShowWarning(false);
      setSecondsRemaining(warningDurationSeconds);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
  }, [showWarning, warningDurationSeconds]);

  // Activity listeners
  useEffect(() => {
    const handleActivity = () => {
      if (!showWarning) {
        lastActivityRef.current = Date.now();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, handleActivity));

    // Periodic check for inactivity threshold
    const interval = setInterval(() => {
      if (!showWarning) {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= inactivityLimitMs) {
          setShowWarning(true);
          setSecondsRemaining(warningDurationSeconds);
        }
      }
    }, 5000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      clearInterval(interval);
    };
  }, [inactivityLimitMs, showWarning, warningDurationSeconds]);

  // Countdown timer when warning modal is active
  useEffect(() => {
    if (showWarning) {
      countdownIntervalRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            onLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [showWarning, onLogout]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 text-center animate-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Clock className="w-7 h-7" />
        </div>

        <h3 className="text-lg font-bold text-slate-800 mb-1">Session Inactivity Warning</h3>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          You have been inactive for nearly 30 minutes. To protect sensitive recruitment records, your session will automatically expire.
        </p>

        {/* Circular Countdown Display */}
        <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200/60 text-center">
          <div className="text-3xl font-black text-indigo-600 font-mono tracking-tight">
            00:{secondsRemaining < 10 ? `0${secondsRemaining}` : secondsRemaining}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Seconds remaining until auto-logout</div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={resetTimer}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Stay Logged In</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-colors flex items-center justify-center space-x-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span>Logout Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
