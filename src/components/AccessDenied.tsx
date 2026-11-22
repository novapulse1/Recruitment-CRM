/**
 * NovaPulse Hiring CRM - AccessDenied (403 Forbidden Screen)
 * Displayed when a user attempts to access a module or action outside their RBAC permissions.
 */

import React from 'react';
import { ShieldAlert, ArrowLeft, Users, AlertTriangle } from 'lucide-react';
import type { User, UserRole } from '../types';

interface AccessDeniedProps {
  user: User | null;
  moduleName?: string;
  requiredPermission?: string;
  onGoToAllowed: () => void;
  onSwitchPersona?: (email: string) => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  user,
  moduleName,
  requiredPermission,
  onGoToAllowed,
  onSwitchPersona
}) => {
  const getRoleBadge = (role?: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-200">SUPER ADMIN</span>;
      case 'ADMIN':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">MANAGEMENT ADMIN</span>;
      case 'RECRUITMENT_MANAGER':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">RECRUITMENT MANAGER</span>;
      case 'HR_RECRUITER':
      case 'HR':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">HR RECRUITER</span>;
      case 'FINANCE':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">FINANCE</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 border border-rose-200">DENIED / INACTIVE</span>;
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
      <div className="w-20 h-20 bg-rose-50 border-2 border-rose-200 rounded-2xl flex items-center justify-center text-rose-600 shadow-lg shadow-rose-100 mb-6">
        <ShieldAlert className="w-10 h-10" />
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold uppercase tracking-wider mb-3">
        <AlertTriangle className="w-3.5 h-3.5" />
        403 Access Denied
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-2">
        Restricted Area — Authorization Required
      </h1>

      <p className="text-gray-600 max-w-lg text-sm sm:text-base mb-6 leading-relaxed">
        Your authenticated account does not have sufficient RBAC permissions to access 
        {moduleName ? <span className="font-semibold text-gray-900"> the "{moduleName}" module</span> : ' this resource'}.
      </p>

      {/* Account Info Box */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm max-w-md w-full mb-8 text-left space-y-2.5">
        <div className="flex items-center justify-between text-xs text-gray-500 border-b border-gray-100 pb-2">
          <span>Current Session Identity</span>
          {getRoleBadge(user?.role)}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Email:</span>
          <span className="font-mono font-medium text-gray-800">{user?.email || 'Unauthenticated'}</span>
        </div>
        {requiredPermission && (
          <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
            <span className="text-gray-500">Required Permission:</span>
            <span className="font-mono text-rose-600 font-semibold">{requiredPermission}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onGoToAllowed}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Go to Permitted Workspace
        </button>

        {onSwitchPersona && (
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg p-1">
            <span className="text-xs text-gray-500 px-2 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Switch Persona:
            </span>
            <select
              aria-label="Switch Persona"
              onChange={(e) => onSwitchPersona(e.target.value)}
              value={user?.email || ''}
              className="bg-white border border-gray-300 text-gray-700 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer"
            >
              <option value="novapulse739@gmail.com">Super Admin (novapulse739@...)</option>
              <option value="admin@novapulse.co.in">Admin (admin@novapulse.co.in)</option>
              <option value="manager@novapulse.co.in">Recruitment Manager (manager@...)</option>
              <option value="hr@novapulse.co.in">HR Recruiter - Anshu (hr@...)</option>
              <option value="gjigyasa11@gmail.com">HR Recruiter - Jigyasha (gjigyasa11@...)</option>
              <option value="finance@novapulse.co.in">Finance (finance@...)</option>
              <option value="inactive.hr@novapulse.co.in">Inactive HR (Denied)</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
};
