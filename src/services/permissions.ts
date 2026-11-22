/**
 * NovaPulse Hiring CRM - Frontend Permission Engine
 * Centrally manages client-side RBAC validation and data masking.
 */

import type { User, UserRole } from '../types';

export const PERMISSIONS = {
  // Candidates
  CANDIDATES_VIEW: 'candidates.view',
  CANDIDATES_CREATE: 'candidates.create',
  CANDIDATES_EDIT: 'candidates.edit',
  CANDIDATES_ARCHIVE: 'candidates.archive',
  CANDIDATES_REASSIGN: 'candidates.reassign',

  // Leads
  LEADS_VIEW: 'leads.view',
  LEADS_SUBMIT: 'leads.submit',
  LEADS_APPROVE: 'leads.approve',
  LEADS_REJECT: 'leads.reject',

  // Duplicates
  DUPLICATES_CHECK: 'duplicates.check',
  DUPLICATES_OVERRIDE: 'duplicates.override',

  // Interviews
  INTERVIEWS_VIEW: 'interviews.view',
  INTERVIEWS_SCHEDULE: 'interviews.schedule',
  INTERVIEWS_RESCHEDULE: 'interviews.reschedule',

  // Clients & Openings
  CLIENTS_VIEW: 'clients.view',
  CLIENTS_EDIT: 'clients.edit',
  OPENINGS_VIEW: 'openings.view',
  OPENINGS_EDIT: 'openings.edit',

  // Joinings & Billing
  JOININGS_VIEW: 'joinings.view',
  JOININGS_EDIT: 'joinings.edit',
  BILLING_VIEW: 'billing.view',
  BILLING_UPDATE: 'billing.update',

  // Reports & Analytics
  REPORTS_VIEW: 'reports.view',
  REPORTS_FINANCIAL: 'reports.financial',

  // Administration & RBAC
  HR_REGISTRY_MANAGE: 'hr_registry.manage',
  AUDIT_LOGS_VIEW: 'audit_logs.view',
  SETTINGS_MANAGE: 'settings.manage',
  RBAC_MANAGE: 'rbac.manage'
} as const;

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  SUPER_ADMIN: [
    PERMISSIONS.CANDIDATES_VIEW,
    PERMISSIONS.CANDIDATES_CREATE,
    PERMISSIONS.CANDIDATES_EDIT,
    PERMISSIONS.CANDIDATES_ARCHIVE,
    PERMISSIONS.CANDIDATES_REASSIGN,
    PERMISSIONS.LEADS_VIEW,
    PERMISSIONS.LEADS_SUBMIT,
    PERMISSIONS.LEADS_APPROVE,
    PERMISSIONS.LEADS_REJECT,
    PERMISSIONS.DUPLICATES_CHECK,
    PERMISSIONS.DUPLICATES_OVERRIDE,
    PERMISSIONS.INTERVIEWS_VIEW,
    PERMISSIONS.INTERVIEWS_SCHEDULE,
    PERMISSIONS.INTERVIEWS_RESCHEDULE,
    PERMISSIONS.CLIENTS_VIEW,
    PERMISSIONS.CLIENTS_EDIT,
    PERMISSIONS.OPENINGS_VIEW,
    PERMISSIONS.OPENINGS_EDIT,
    PERMISSIONS.JOININGS_VIEW,
    PERMISSIONS.JOININGS_EDIT,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_UPDATE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_FINANCIAL,
    PERMISSIONS.HR_REGISTRY_MANAGE,
    PERMISSIONS.AUDIT_LOGS_VIEW,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.RBAC_MANAGE
  ],

  ADMIN: [
    PERMISSIONS.CANDIDATES_VIEW,
    PERMISSIONS.CANDIDATES_CREATE,
    PERMISSIONS.CANDIDATES_EDIT,
    PERMISSIONS.CANDIDATES_ARCHIVE,
    PERMISSIONS.CANDIDATES_REASSIGN,
    PERMISSIONS.LEADS_VIEW,
    PERMISSIONS.LEADS_SUBMIT,
    PERMISSIONS.LEADS_APPROVE,
    PERMISSIONS.LEADS_REJECT,
    PERMISSIONS.DUPLICATES_CHECK,
    PERMISSIONS.DUPLICATES_OVERRIDE,
    PERMISSIONS.INTERVIEWS_VIEW,
    PERMISSIONS.INTERVIEWS_SCHEDULE,
    PERMISSIONS.INTERVIEWS_RESCHEDULE,
    PERMISSIONS.CLIENTS_VIEW,
    PERMISSIONS.CLIENTS_EDIT,
    PERMISSIONS.OPENINGS_VIEW,
    PERMISSIONS.OPENINGS_EDIT,
    PERMISSIONS.JOININGS_VIEW,
    PERMISSIONS.JOININGS_EDIT,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_UPDATE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_FINANCIAL,
    PERMISSIONS.HR_REGISTRY_MANAGE,
    PERMISSIONS.AUDIT_LOGS_VIEW,
    PERMISSIONS.SETTINGS_MANAGE
    // NO RBAC_MANAGE for regular ADMIN
  ],

  RECRUITMENT_MANAGER: [
    PERMISSIONS.CANDIDATES_VIEW,
    PERMISSIONS.CANDIDATES_CREATE,
    PERMISSIONS.CANDIDATES_EDIT,
    PERMISSIONS.LEADS_VIEW,
    PERMISSIONS.LEADS_SUBMIT,
    PERMISSIONS.DUPLICATES_CHECK,
    PERMISSIONS.INTERVIEWS_VIEW,
    PERMISSIONS.INTERVIEWS_SCHEDULE,
    PERMISSIONS.INTERVIEWS_RESCHEDULE,
    PERMISSIONS.CLIENTS_VIEW,
    PERMISSIONS.OPENINGS_VIEW,
    PERMISSIONS.REPORTS_VIEW
  ],

  HR_RECRUITER: [
    PERMISSIONS.CANDIDATES_VIEW,
    PERMISSIONS.CANDIDATES_EDIT,
    PERMISSIONS.LEADS_VIEW,
    PERMISSIONS.LEADS_SUBMIT,
    PERMISSIONS.DUPLICATES_CHECK,
    PERMISSIONS.INTERVIEWS_VIEW,
    PERMISSIONS.INTERVIEWS_SCHEDULE,
    PERMISSIONS.INTERVIEWS_RESCHEDULE,
    PERMISSIONS.CLIENTS_VIEW,
    PERMISSIONS.OPENINGS_VIEW,
    PERMISSIONS.REPORTS_VIEW
  ],

  HR: [
    PERMISSIONS.CANDIDATES_VIEW,
    PERMISSIONS.CANDIDATES_EDIT,
    PERMISSIONS.LEADS_VIEW,
    PERMISSIONS.LEADS_SUBMIT,
    PERMISSIONS.DUPLICATES_CHECK,
    PERMISSIONS.INTERVIEWS_VIEW,
    PERMISSIONS.INTERVIEWS_SCHEDULE,
    PERMISSIONS.INTERVIEWS_RESCHEDULE,
    PERMISSIONS.CLIENTS_VIEW,
    PERMISSIONS.OPENINGS_VIEW,
    PERMISSIONS.REPORTS_VIEW
  ],

  FINANCE: [
    PERMISSIONS.JOININGS_VIEW,
    PERMISSIONS.JOININGS_EDIT,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_UPDATE,
    PERMISSIONS.CLIENTS_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_FINANCIAL
  ],

  DENIED: []
};

export const SYSTEM_PROTECTED_FIELDS = [
  'Candidate ID',
  'HR Email',
  'Created By',
  'Record Version',
  'Duplicate Of',
  'Record Status',
  'Last Updated By',
  'Client Fee Value',
  'Invoice Amount',
  'System Note'
];

/**
 * Checks if a user has a specific permission
 */
export function can(user: User | null, permission: string): boolean {
  if (!user || !user.authenticated || !user.role) {
    return false;
  }
  // Check user.permissions array first if populated
  if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions.includes(permission);
  }
  // Fallback to role definition
  const rolePerms = ROLE_PERMISSIONS[user.role] || [];
  return rolePerms.includes(permission);
}

/**
 * Determines whether a module tab is accessible for the current user
 */
export function canAccessModule(user: User | null, moduleId: string): boolean {
  if (!user || !user.authenticated || user.role === 'DENIED') {
    return false;
  }

  switch (moduleId) {
    case 'dashboard':
      // Finance has financial reporting, but recruitment dashboard is for recruiters & management
      return user.role !== 'FINANCE';

    case 'candidates':
      return can(user, PERMISSIONS.CANDIDATES_VIEW);

    case 'openings':
      return can(user, PERMISSIONS.OPENINGS_VIEW);

    case 'clients':
      return can(user, PERMISSIONS.CLIENTS_VIEW);

    case 'interviews':
      return can(user, PERMISSIONS.INTERVIEWS_VIEW);

    case 'leads':
      return can(user, PERMISSIONS.LEADS_VIEW);

    case 'joinings':
      return can(user, PERMISSIONS.JOININGS_VIEW) || can(user, PERMISSIONS.BILLING_VIEW);

    case 'reports':
      return can(user, PERMISSIONS.REPORTS_VIEW);

    case 'admin':
      return can(user, PERMISSIONS.HR_REGISTRY_MANAGE) || can(user, PERMISSIONS.SETTINGS_MANAGE);

    case 'rbac':
      return can(user, PERMISSIONS.RBAC_MANAGE);

    default:
      return false;
  }
}

/**
 * Data scoping evaluation for candidates
 */
export function getCandidateDataScope(user: User | null): 'ALL' | 'TEAM' | 'SELF' | 'NONE' {
  if (!user || !user.authenticated || user.role === 'DENIED') return 'NONE';
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return 'ALL';
  if (user.role === 'RECRUITMENT_MANAGER') return 'TEAM';
  if (user.role === 'HR_RECRUITER' || user.role === 'HR') return 'SELF';
  return 'NONE';
}

/**
 * Checks whether a candidate field can be edited by the user
 */
export function isFieldEditable(user: User | null, fieldName: string): boolean {
  if (!user || !user.authenticated) return false;

  // System protected fields cannot be edited by normal users
  if (SYSTEM_PROTECTED_FIELDS.includes(fieldName)) {
    return user.role === 'SUPER_ADMIN';
  }

  // Super Admin and Admin can edit all non-protected fields
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
    return true;
  }

  // Recruiter and Manager editable fields
  if (user.role === 'HR_RECRUITER' || user.role === 'HR' || user.role === 'RECRUITMENT_MANAGER') {
    if (user.editableFields && Array.isArray(user.editableFields)) {
      return user.editableFields.some(f => f.trim().toLowerCase() === fieldName.trim().toLowerCase());
    }
    // Default allowed fields
    const defaultAllowed = [
      'designation applied', 'current location', 'experience',
      'current salary', 'expected salary', 'notice period', 'source',
      'client name', 'industry', 'calling disposition', 'sub-disposition',
      'call status', 'connect status', 'interview status', 'interview date',
      'selection status', 'joining status', 'joining date', 'remarks'
    ];
    return defaultAllowed.includes(fieldName.trim().toLowerCase());
  }

  return false;
}

/**
 * Mask mobile number for privacy (e.g. for Finance role)
 * "9876543210" -> "XXXXX-XX210"
 */
export function maskPhone(phone: string | undefined): string {
  if (!phone) return '-';
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length >= 4) {
    return 'XXXXX-XX' + clean.slice(-3);
  }
  return 'XXXXX-XXXX';
}

/**
 * Mask email for privacy (e.g. for Finance role)
 * "deepak.k@example.com" -> "d***k@example.com"
 */
export function maskEmail(email: string | undefined): string {
  if (!email) return '-';
  const clean = String(email).trim();
  const parts = clean.split('@');
  if (parts.length === 2) {
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length <= 2 
      ? name + '***' 
      : name.charAt(0) + '***' + name.charAt(name.length - 1);
    return `${maskedName}@${domain}`;
  }
  return '***@***.com';
}
