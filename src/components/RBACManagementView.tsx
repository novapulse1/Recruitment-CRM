/**
 * NovaPulse Hiring CRM - RBAC Management Interface
 * Dedicated super-admin interface for centrally managing users, roles,
 * permissions matrix, manager-team mappings, and inspecting effective permissions.
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  Users,
  KeyRound,
  Network,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  UserCheck,
  Save,
  Check,
  Lock,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../services/api';
import { PERMISSIONS, ROLE_PERMISSIONS, getCandidateDataScope } from '../services/permissions';
import type { User, UserRole, RBACOverview, RBACUser } from '../types';

interface RBACManagementViewProps {
  currentUser: User;
}

export const RBACManagementView: React.FC<RBACManagementViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'matrix' | 'teams' | 'inspector' | 'logs'>('users');
  const [loading, setLoading] = useState<boolean>(true);
  const [overview, setOverview] = useState<RBACOverview | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inspectorUser, setInspectorUser] = useState<string>('novapulse739@gmail.com');
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<RBACUser | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('HR_RECRUITER');
  const [savingRole, setSavingRole] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Team mapping editing state
  const [selectedManager, setSelectedManager] = useState<string>('manager@novapulse.co.in');
  const [selectedTeamRecruiters, setSelectedTeamRecruiters] = useState<string[]>(['hr@novapulse.co.in', 'gjigyasa11@gmail.com']);
  const [savingTeam, setSavingTeam] = useState<boolean>(false);

  // Security logs
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);

  const fetchRBACData = async () => {
    setLoading(true);
    try {
      const data = await api.getRBAC();
      setOverview(data);
      if (data.teamMapping && data.teamMapping[selectedManager]) {
        setSelectedTeamRecruiters(data.teamMapping[selectedManager]);
      }
      // Fetch security logs from audit log
      try {
        const logsResp = await api.getLogs('AUDIT_LOG', 50);
        setSecurityLogs(logsResp.logs || []);
      } catch (le) {
        // ignore
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load RBAC configuration' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRBACData();
  }, []);

  const handleRoleChange = async () => {
    if (!selectedUserForEdit) return;
    setSavingRole(true);
    setMessage(null);
    try {
      await api.updateUserRole(selectedUserForEdit.email, editRole);
      setMessage({ type: 'success', text: `Role for ${selectedUserForEdit.email} successfully updated to ${editRole}!` });
      setSelectedUserForEdit(null);
      await fetchRBACData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update user role' });
    } finally {
      setSavingRole(false);
    }
  };

  const handleSaveTeamMapping = async () => {
    setSavingTeam(true);
    setMessage(null);
    try {
      await api.updateTeamMapping(selectedManager, selectedTeamRecruiters);
      setMessage({ type: 'success', text: `Team mapping for ${selectedManager} successfully updated!` });
      await fetchRBACData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update team mapping' });
    } finally {
      setSavingTeam(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-200">SUPER ADMIN</span>;
      case 'ADMIN':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">ADMIN</span>;
      case 'RECRUITMENT_MANAGER':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">RECRUITMENT MANAGER</span>;
      case 'HR_RECRUITER':
      case 'HR':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">HR RECRUITER</span>;
      case 'FINANCE':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">FINANCE</span>;
      default:
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 border border-rose-200">DENIED / INACTIVE</span>;
    }
  };

  // Grouped permission matrix categories
  const permissionCategories = [
    {
      category: 'Candidate Master',
      permissions: [
        { key: PERMISSIONS.CANDIDATES_VIEW, label: 'View Candidates', desc: 'Read candidate profiles within authorized scope' },
        { key: PERMISSIONS.CANDIDATES_CREATE, label: 'Create Candidates', desc: 'Directly add or submit new candidate records' },
        { key: PERMISSIONS.CANDIDATES_EDIT, label: 'Edit Candidates', desc: 'Update candidate details within authorized fields' },
        { key: PERMISSIONS.CANDIDATES_ARCHIVE, label: 'Archive Candidates', desc: 'Soft-delete / archive candidates' },
        { key: PERMISSIONS.CANDIDATES_REASSIGN, label: 'Reassign Candidates', desc: 'Bulk reassign candidates to other recruiters' }
      ]
    },
    {
      category: 'Leads & Approvals',
      permissions: [
        { key: PERMISSIONS.LEADS_VIEW, label: 'View Leads', desc: 'View submitted candidate leads queue' },
        { key: PERMISSIONS.LEADS_SUBMIT, label: 'Submit Leads', desc: 'Submit candidate leads for admin approval' },
        { key: PERMISSIONS.LEADS_APPROVE, label: 'Approve Leads', desc: 'Approve leads and convert to MASTER DATA' },
        { key: PERMISSIONS.LEADS_REJECT, label: 'Reject Leads', desc: 'Reject candidate lead submissions' }
      ]
    },
    {
      category: 'Duplicate Prevention',
      permissions: [
        { key: PERMISSIONS.DUPLICATES_CHECK, label: 'Check Duplicates', desc: 'Run real-time phone/email match checks' },
        { key: PERMISSIONS.DUPLICATES_OVERRIDE, label: 'Override Duplicates', desc: 'Force-create record despite duplicate match' }
      ]
    },
    {
      category: 'Interviews & Pipeline',
      permissions: [
        { key: PERMISSIONS.INTERVIEWS_VIEW, label: 'View Interviews', desc: 'Access lineup calendar & interview list' },
        { key: PERMISSIONS.INTERVIEWS_SCHEDULE, label: 'Schedule Interview', desc: 'Set initial interview date and process' },
        { key: PERMISSIONS.INTERVIEWS_RESCHEDULE, label: 'Reschedule Interview', desc: 'Change date and log reschedule reason' }
      ]
    },
    {
      category: 'Clients & Openings',
      permissions: [
        { key: PERMISSIONS.CLIENTS_VIEW, label: 'View Clients', desc: 'Access client directory and hiring terms' },
        { key: PERMISSIONS.CLIENTS_EDIT, label: 'Edit Clients', desc: 'Add/modify client agreements & POCs' },
        { key: PERMISSIONS.OPENINGS_VIEW, label: 'View Openings', desc: 'Browse active job requisitions' },
        { key: PERMISSIONS.OPENINGS_EDIT, label: 'Edit Openings', desc: 'Create and update job vacancies' }
      ]
    },
    {
      category: 'Joinings & Billing',
      permissions: [
        { key: PERMISSIONS.JOININGS_VIEW, label: 'View Joinings', desc: 'Access joined candidates & replacement dates' },
        { key: PERMISSIONS.JOININGS_EDIT, label: 'Edit Joinings', desc: 'Update employment status & exit dates' },
        { key: PERMISSIONS.BILLING_VIEW, label: 'View Billing', desc: 'Access invoice numbers, dates & payment info' },
        { key: PERMISSIONS.BILLING_UPDATE, label: 'Update Billing', desc: 'Mark invoice status & payment received' }
      ]
    },
    {
      category: 'Reports & Analytics',
      permissions: [
        { key: PERMISSIONS.REPORTS_VIEW, label: 'View Recruitment Reports', desc: 'Access funnel, conversion & recruiter reports' },
        { key: PERMISSIONS.REPORTS_FINANCIAL, label: 'View Financial Reports', desc: 'Access revenue, pending billing & fees' }
      ]
    },
    {
      category: 'System & RBAC Administration',
      permissions: [
        { key: PERMISSIONS.HR_REGISTRY_MANAGE, label: 'Manage HR Registry', desc: 'Add recruiters, toggle active status' },
        { key: PERMISSIONS.AUDIT_LOGS_VIEW, label: 'View Audit Logs', desc: 'Access complete audit & conflict queues' },
        { key: PERMISSIONS.SETTINGS_MANAGE, label: 'Manage Dropdowns & Lists', desc: 'Add/toggle disposition and client options' },
        { key: PERMISSIONS.RBAC_MANAGE, label: 'Manage RBAC Engine', desc: 'Assign roles, update teams, security rules' }
      ]
    }
  ];

  const filteredUsers = (overview?.users || []).filter(u => {
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  // Calculate inspector target user
  const inspectorTargetUser = (overview?.users || []).find(u => u.email === inspectorUser) || {
    email: inspectorUser,
    name: 'Selected User',
    role: 'SUPER_ADMIN' as UserRole,
    status: 'Active' as const,
    teamRecruiterEmails: []
  };

  const inspectorDataScope = getCandidateDataScope({
    authenticated: true,
    email: inspectorTargetUser.email,
    name: inspectorTargetUser.name,
    role: inspectorTargetUser.role,
    permissions: ROLE_PERMISSIONS[inspectorTargetUser.role] || [],
    teamRecruiterEmails: inspectorTargetUser.teamRecruiterEmails
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="p-2 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-300">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-300 bg-purple-500/20 px-2.5 py-1 rounded-full border border-purple-400/20">
                Super Admin Control Panel
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-400/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                RBAC Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Role-Based Access Control (RBAC) Management
            </h1>
            <p className="text-purple-200/80 text-sm mt-1 max-w-2xl">
              Centrally manage module permissions, action authorization, recruiter scoping, and team hierarchies.
              All rules are persisted safely into Google Sheets <code className="text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded text-xs">CONFIGURATION</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchRBACData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-medium transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Policy
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {message && (
          <div className={`mt-4 p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
            message.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200' : 'bg-rose-500/20 border border-rose-500/40 text-rose-200'
          }`}>
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-white/60 hover:text-white">✕</button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-1 overflow-x-auto bg-white p-1 rounded-xl shadow-sm">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Users className="w-4 h-4" />
          User Accounts & Roles ({overview?.users?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'matrix'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Role-Permission Matrix
        </button>

        <button
          onClick={() => setActiveTab('teams')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'teams'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Network className="w-4 h-4" />
          Manager Team Mappings
        </button>

        <button
          onClick={() => setActiveTab('inspector')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'inspector'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Eye className="w-4 h-4" />
          Effective Permissions Inspector
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'logs'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Shield className="w-4 h-4" />
          Security Access Audit
        </button>
      </div>

      {/* TAB 1: USERS & ROLE ASSIGNMENT */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">User Identity & Role Directory</h2>
              <p className="text-xs text-gray-500">
                View all registered accounts and assign roles. Super Admin has unrestricted authority to elevate or restrict any user.
              </p>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search user by name, email or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Current Role</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Data Access Scope</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((userItem) => (
                  <tr key={userItem.email} className="hover:bg-purple-50/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{userItem.name}</div>
                      <div className="text-gray-500 font-mono text-[11px]">{userItem.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      {getRoleBadge(userItem.role)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        userItem.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${userItem.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {userItem.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {userItem.role === 'SUPER_ADMIN' || userItem.role === 'ADMIN' ? (
                        <span className="font-medium text-purple-700">All Records (Global Master)</span>
                      ) : userItem.role === 'RECRUITMENT_MANAGER' ? (
                        <span className="text-blue-700 font-medium">Team Mapped ({(userItem.teamRecruiterEmails || []).length} Recruiters)</span>
                      ) : userItem.role === 'HR_RECRUITER' || userItem.role === 'HR' ? (
                        <span className="text-emerald-700 font-medium">Self Pipeline ({userItem.email})</span>
                      ) : userItem.role === 'FINANCE' ? (
                        <span className="text-amber-700 font-medium">Joinings & Billing Only (PII Masked)</span>
                      ) : (
                        <span className="text-rose-600 font-medium">No Access (Denied)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {userItem.email === 'novapulse739@gmail.com' ? (
                        <span className="text-[11px] text-gray-400 italic flex items-center justify-end gap-1">
                          <Lock className="w-3 h-3" /> Root Super Admin
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedUserForEdit(userItem);
                            setEditRole(userItem.role);
                          }}
                          className="px-2.5 py-1 bg-white border border-gray-300 hover:border-purple-500 hover:text-purple-700 rounded-md text-xs font-medium shadow-2xs transition-colors"
                        >
                          Modify Role
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Role Modification Modal */}
      {selectedUserForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                Change User Role
              </h3>
              <button
                onClick={() => setSelectedUserForEdit(null)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            <div>
              <div className="text-xs text-gray-500">Selected User Account</div>
              <div className="font-medium text-gray-900 text-sm">{selectedUserForEdit.name}</div>
              <div className="font-mono text-xs text-purple-700">{selectedUserForEdit.email}</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Assign New Role</label>
              <select
                aria-label="Assign New Role"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="SUPER_ADMIN">SUPER_ADMIN — Complete system access, RBAC management, duplicate override</option>
                <option value="ADMIN">ADMIN — Complete recruitment operations, approvals, registry (cannot manage RBAC)</option>
                <option value="RECRUITMENT_MANAGER">RECRUITMENT_MANAGER — View and manage mapped team recruiters</option>
                <option value="HR_RECRUITER">HR_RECRUITER — Individual recruiter, self candidates only, lead submissions</option>
                <option value="FINANCE">FINANCE — Joinings, billing, invoice tracking, revenue reports (PII masked)</option>
                <option value="DENIED">DENIED — Deactivate access / access restricted</option>
              </select>
            </div>

            <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-xs text-purple-800 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
                Live Google Sheet Sync Note:
              </div>
              <div>
                Changing this role will immediately update the respective list key in the <code>CONFIGURATION</code> tab of the database.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedUserForEdit(null)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleChange}
                disabled={savingRole}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium shadow-xs disabled:opacity-50"
              >
                {savingRole ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Confirm & Save Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROLE-PERMISSION MATRIX */}
      {activeTab === 'matrix' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Role-Permission Authorization Matrix</h2>
              <p className="text-xs text-gray-500">
                Official mapping of all 24 granular permissions (<code className="text-purple-600">module.action</code>) across the 5 CRM roles.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100/75 border-b border-gray-200 text-gray-700 font-semibold">
                  <th className="py-3 px-4 w-72">Permission (module.action)</th>
                  <th className="py-3 px-3 text-center text-purple-800 bg-purple-50/50">SUPER ADMIN</th>
                  <th className="py-3 px-3 text-center text-indigo-800 bg-indigo-50/50">ADMIN</th>
                  <th className="py-3 px-3 text-center text-blue-800 bg-blue-50/50">MANAGER</th>
                  <th className="py-3 px-3 text-center text-emerald-800 bg-emerald-50/50">RECRUITER</th>
                  <th className="py-3 px-3 text-center text-amber-800 bg-amber-50/50">FINANCE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {permissionCategories.map((cat) => (
                  <React.Fragment key={cat.category}>
                    <tr className="bg-gray-50/80 font-bold text-gray-700 text-[11px] uppercase tracking-wider">
                      <td colSpan={6} className="py-2 px-4 bg-gray-50">
                        {cat.category}
                      </td>
                    </tr>
                    {cat.permissions.map((p) => {
                      const superAdminHas = ROLE_PERMISSIONS.SUPER_ADMIN.includes(p.key);
                      const adminHas = ROLE_PERMISSIONS.ADMIN.includes(p.key);
                      const managerHas = ROLE_PERMISSIONS.RECRUITMENT_MANAGER.includes(p.key);
                      const recruiterHas = ROLE_PERMISSIONS.HR_RECRUITER.includes(p.key);
                      const financeHas = ROLE_PERMISSIONS.FINANCE.includes(p.key);

                      return (
                        <tr key={p.key} className="hover:bg-gray-50/50">
                          <td className="py-2 px-4">
                            <div className="font-mono text-gray-900 font-semibold">{p.key}</div>
                            <div className="text-[11px] text-gray-500">{p.desc}</div>
                          </td>
                          <td className="py-2 px-3 text-center bg-purple-50/10">
                            {superAdminHas ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center bg-indigo-50/10">
                            {adminHas ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center bg-blue-50/10">
                            {managerHas ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center bg-emerald-50/10">
                            {recruiterHas ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center bg-amber-50/10">
                            {financeHas ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MANAGER TEAM MAPPINGS */}
      {activeTab === 'teams' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Recruitment Manager Team Mappings</h2>
            <p className="text-xs text-gray-500">
              Map Recruitment Managers to their respective subordinate HR recruiters.
              A manager can view and edit candidate records belonging to their mapped team members.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                  <Network className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-sm text-gray-900">Manage Team Assignment</h3>
                  <div className="text-xs text-gray-500">Select Manager & Recruiters</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Recruitment Manager Email</label>
                <select
                  aria-label="Recruitment Manager Email"
                  value={selectedManager}
                  onChange={(e) => {
                    const mgr = e.target.value;
                    setSelectedManager(mgr);
                    setSelectedTeamRecruiters(overview?.teamMapping?.[mgr] || []);
                  }}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="manager@novapulse.co.in">manager@novapulse.co.in (Default Manager)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">Mapped Recruiters (Team Members)</label>
                <div className="space-y-2 border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {['hr@novapulse.co.in', 'gjigyasa11@gmail.com'].map((email) => {
                    const isChecked = selectedTeamRecruiters.includes(email);
                    return (
                      <label key={email} className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer hover:bg-gray-50 p-1.5 rounded">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTeamRecruiters([...selectedTeamRecruiters, email]);
                            } else {
                              setSelectedTeamRecruiters(selectedTeamRecruiters.filter(e => e !== email));
                            }
                          }}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="font-medium font-mono">{email}</span>
                        <span className="text-[11px] text-gray-400">({email === 'hr@novapulse.co.in' ? 'Anshu' : 'Jigyasha'})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleSaveTeamMapping}
                disabled={savingTeam}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-sm transition-colors disabled:opacity-50"
              >
                {savingTeam ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Team Mapping to Google Sheets
              </button>
            </div>

            {/* Current Active Mappings Preview */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Live Team Hierarchies
              </h3>

              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div className="font-semibold text-xs text-gray-900">manager@novapulse.co.in</div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">MANAGER</span>
                </div>
                <div className="text-xs text-gray-600">Assigned Recruiter Pipeline Scope:</div>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedTeamRecruiters.length > 0 ? selectedTeamRecruiters : ['hr@novapulse.co.in', 'gjigyasa11@gmail.com']).map((m) => (
                    <span key={m} className="px-2 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 font-mono text-[11px] flex items-center gap-1">
                      <Check className="w-3 h-3 text-blue-500" />
                      {m}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                  Total Managed Candidates: <strong>512+</strong> (Anshu + Jigyasha combined)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EFFECTIVE PERMISSIONS INSPECTOR */}
      {activeTab === 'inspector' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Effective Permissions Inspector</h2>
              <p className="text-xs text-gray-500">
                Select any registered account to inspect its calculated data scope, granted actions, and field-level permissions.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Select Persona:</span>
              <select
                aria-label="Select Persona"
                value={inspectorUser}
                onChange={(e) => setInspectorUser(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium bg-white"
              >
                <option value="novapulse739@gmail.com">Super Admin (novapulse739@gmail.com)</option>
                <option value="admin@novapulse.co.in">Management Admin (admin@novapulse.co.in)</option>
                <option value="manager@novapulse.co.in">Recruitment Manager (manager@novapulse.co.in)</option>
                <option value="hr@novapulse.co.in">HR Recruiter - Anshu (hr@novapulse.co.in)</option>
                <option value="gjigyasa11@gmail.com">HR Recruiter - Jigyasha (gjigyasa11@gmail.com)</option>
                <option value="finance@novapulse.co.in">Finance Executive (finance@novapulse.co.in)</option>
                <option value="inactive.hr@novapulse.co.in">Inactive HR (Deactivated)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Identity Card */}
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Evaluated Identity</div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center font-bold text-purple-700 text-sm">
                  {inspectorTargetUser.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{inspectorTargetUser.name}</div>
                  <div className="text-xs font-mono text-gray-500">{inspectorTargetUser.email}</div>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
                <span className="text-gray-500">Resolved Role:</span>
                {getRoleBadge(inspectorTargetUser.role)}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Account Status:</span>
                <span className={`font-semibold ${inspectorTargetUser.status === 'Active' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {inspectorTargetUser.status}
                </span>
              </div>
            </div>

            {/* Data Scope Card */}
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Data Access Scope</div>
              <div className="text-sm font-bold text-gray-900">
                {inspectorDataScope === 'ALL' && '🌐 Unrestricted (All Candidates)'}
                {inspectorDataScope === 'TEAM' && '👥 Team Scoped (Mapped Recruiter Candidates)'}
                {inspectorDataScope === 'SELF' && '👤 Self Pipeline (Assigned HR Email Only)'}
                {inspectorDataScope === 'NONE' && '🚫 Blocked (Zero Candidate Master Access)'}
              </div>
              <p className="text-xs text-gray-500">
                {inspectorDataScope === 'ALL' && 'User can search, query, and edit all candidates across the entire organization.'}
                {inspectorDataScope === 'TEAM' && 'User is restricted to candidates where HR Email matches members of their mapped team.'}
                {inspectorDataScope === 'SELF' && 'User can strictly access records where HR Email equals their authenticated email.'}
                {inspectorDataScope === 'NONE' && 'User is denied access to candidate master. Permitted to access financial and joining records only.'}
              </p>
              <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
                <span className="text-gray-500">Candidate PII:</span>
                <span className={`font-semibold ${inspectorTargetUser.role === 'FINANCE' ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {inspectorTargetUser.role === 'FINANCE' ? 'MASKED (XXXXX-XX300)' : 'UNMASKED (Plaintext)'}
                </span>
              </div>
            </div>

            {/* Quick Stats Card */}
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Permissions Count</div>
              <div className="text-2xl font-bold text-purple-700">
                {(ROLE_PERMISSIONS[inspectorTargetUser.role] || []).length} / 28
              </div>
              <div className="text-xs text-gray-500">
                Active permissions granted in central policy engine.
              </div>
              <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
                <span className="text-gray-500">Duplicate Override:</span>
                <span className={`font-semibold ${inspectorTargetUser.role === 'SUPER_ADMIN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {inspectorTargetUser.role === 'SUPER_ADMIN' ? 'ALLOWED' : 'FORBIDDEN'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Lead Approvals:</span>
                <span className={`font-semibold ${['SUPER_ADMIN', 'ADMIN'].includes(inspectorTargetUser.role) ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {['SUPER_ADMIN', 'ADMIN'].includes(inspectorTargetUser.role) ? 'ALLOWED' : 'FORBIDDEN'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SECURITY AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Security & Access Audit Trail</h2>
              <p className="text-xs text-gray-500">
                Tracks critical role updates, access attempts, and permission enforcement events.
              </p>
            </div>
            <button
              onClick={fetchRBACData}
              className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600 font-medium flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" /> Refresh Logs
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Event / Action</th>
                  <th className="py-2.5 px-4">Actor</th>
                  <th className="py-2.5 px-4">Target / Entity</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                {securityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 font-sans">
                      No security audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  securityLogs.slice(0, 20).map((log, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2.5 px-4 text-gray-500">{log['Timestamp'] || log.timestamp || '-'}</td>
                      <td className="py-2.5 px-4 font-semibold text-purple-700">
                        {log['Action'] || log.action || 'SECURITY_CHECK'}
                      </td>
                      <td className="py-2.5 px-4 text-gray-700">{log['Updated By'] || log.updatedBy || 'System'}</td>
                      <td className="py-2.5 px-4 text-gray-900 font-medium">{log['Candidate ID'] || log.candidateId || '-'}</td>
                      <td className="py-2.5 px-4 text-gray-500 max-w-xs truncate font-sans text-xs">
                        {log['New Value'] || log.newValue || log['Candidate Name'] || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
