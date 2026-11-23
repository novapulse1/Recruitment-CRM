/**
 * NovaPulse Hiring CRM - PermissionEngine
 * Centralized Role-Based Access Control (RBAC) Engine.
 * Enforces module-level, action-level, record-level, and field-level permissions.
 */

var PermissionEngine = (function () {
  // Master definition of all permissions in module.action format
  var PERMISSIONS = {
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
    RBAC_MANAGE: 'rbac.manage',
    USERS_PASSWORD_MANAGE: 'users.password_manage'
  };

  // Role -> Permissions mapping
  var ROLE_PERMISSIONS = {
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
      PERMISSIONS.RBAC_MANAGE,
      PERMISSIONS.USERS_PASSWORD_MANAGE
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
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.USERS_PASSWORD_MANAGE
      // NOTE: ADMIN does NOT have PERMISSIONS.RBAC_MANAGE
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

  // Protected fields that non-admin roles CANNOT modify
  var SYSTEM_PROTECTED_FIELDS = [
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
   * Returns list of permissions for a role
   */
  function getPermissionsForRole(role) {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Check if a user possesses a specific permission
   */
  function hasPermission(user, permission) {
    if (!user || !user.authenticated || !user.role) {
      return false;
    }
    var perms = ROLE_PERMISSIONS[user.role] || [];
    return perms.indexOf(permission) !== -1;
  }

  /**
   * Asserts permission, throwing 403 Forbidden error if missing
   */
  function assertPermission(user, permission) {
    if (!user || !user.authenticated) {
      var unauthErr = new Error('Unauthorized: Authentication required.');
      unauthErr.statusCode = 401;
      throw unauthErr;
    }
    if (!hasPermission(user, permission)) {
      var forbiddenErr = new Error('Forbidden: User does not have permission "' + permission + '" for role "' + user.role + '".');
      forbiddenErr.statusCode = 403;
      // Log access denial to Audit Log
      try {
        AuditService.logAction(
          'SECURITY',
          user.name || user.email,
          'PERMISSION_DENIED',
          user,
          'Attempted: ' + permission
        );
      } catch (logErr) {
        // ignore logging failure
      }
      throw forbiddenErr;
    }
  }

  /**
   * Evaluates record access scope for candidates
   * @param {Object} user 
   * @returns {Object} { scope: 'ALL'|'TEAM'|'SELF'|'NONE', teamEmails: [] }
   */
  function getCandidateDataScope(user) {
    if (!user || !user.authenticated) {
      return { scope: 'NONE', teamEmails: [] };
    }
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
      return { scope: 'ALL', teamEmails: [] };
    }
    if (user.role === 'RECRUITMENT_MANAGER') {
      var team = user.teamRecruiterEmails || [];
      return { scope: 'TEAM', teamEmails: team };
    }
    if (user.role === 'HR_RECRUITER') {
      return { scope: 'SELF', teamEmails: [user.email.toLowerCase()] };
    }
    // FINANCE and others have no candidate master access
    return { scope: 'NONE', teamEmails: [] };
  }

  /**
   * Check if a candidate record can be accessed by the user
   */
  function canAccessCandidate(user, candidate) {
    var scopeObj = getCandidateDataScope(user);
    if (scopeObj.scope === 'ALL') return true;
    if (scopeObj.scope === 'NONE') return false;

    var candHREmail = String(candidate['HR Email'] || '').trim().toLowerCase();
    if (scopeObj.scope === 'SELF') {
      return candHREmail === user.email.toLowerCase();
    }
    if (scopeObj.scope === 'TEAM') {
      return scopeObj.teamEmails.indexOf(candHREmail) !== -1 || candHREmail === user.email.toLowerCase();
    }
    return false;
  }

  /**
   * Validates whether fields in a patch are allowed for the user's role
   */
  function validateEditableFields(user, patch, allowedFields) {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
      return true; // Admins can edit all candidate fields
    }

    // Protect system-critical fields from being tampered with
    for (var i = 0; i < SYSTEM_PROTECTED_FIELDS.length; i++) {
      var sysField = SYSTEM_PROTECTED_FIELDS[i];
      if (patch.hasOwnProperty(sysField)) {
        throw new Error('Forbidden: Field "' + sysField + '" is a protected system field and cannot be updated.');
      }
    }

    if (user.role === 'HR_RECRUITER' || user.role === 'RECRUITMENT_MANAGER') {
      var allowed = allowedFields || [];
      for (var f in patch) {
        if (!patch.hasOwnProperty(f) || f.startsWith('_')) continue;
        if (allowed.indexOf(f) === -1) {
          throw new Error('Forbidden: You are not authorized to edit field "' + f + '".');
        }
      }
    }
    return true;
  }

  /**
   * Mask sensitive candidate PII (e.g. for Finance role)
   */
  function maskSensitivePII(candidate) {
    if (!candidate) return candidate;
    var masked = {};
    for (var k in candidate) {
      masked[k] = candidate[k];
    }
    // Mask mobile: "XXXXX-XX300"
    if (masked['Mobile Number']) {
      var phone = String(masked['Mobile Number']).replace(/\D/g, '');
      if (phone.length >= 4) {
        masked['Mobile Number'] = 'XXXXX-XX' + phone.slice(-3);
      } else {
        masked['Mobile Number'] = 'XXXXX-XXXX';
      }
    }
    if (masked['Alternate Mobile']) {
      masked['Alternate Mobile'] = 'XXXXX-XXXX';
    }
    // Mask email: "d***k@***.com"
    if (masked['Email ID']) {
      var em = String(masked['Email ID']).trim();
      var parts = em.split('@');
      if (parts.length === 2) {
        var namePart = parts[0];
        var domainPart = parts[1];
        var maskedName = namePart.length <= 2 ? namePart + '***' : namePart.charAt(0) + '***' + namePart.charAt(namePart.length - 1);
        masked['Email ID'] = maskedName + '@***.' + domainPart.split('.').pop();
      }
    }
    return masked;
  }

  return {
    PERMISSIONS: PERMISSIONS,
    ROLE_PERMISSIONS: ROLE_PERMISSIONS,
    SYSTEM_PROTECTED_FIELDS: SYSTEM_PROTECTED_FIELDS,
    getPermissionsForRole: getPermissionsForRole,
    hasPermission: hasPermission,
    assertPermission: assertPermission,
    getCandidateDataScope: getCandidateDataScope,
    canAccessCandidate: canAccessCandidate,
    validateEditableFields: validateEditableFields,
    maskSensitivePII: maskSensitivePII
  };
})();
