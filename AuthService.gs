/**
 * NovaPulse Hiring CRM - AuthService
 * Resolves user identity, roles, and granular permissions strictly server-side.
 * Interacts with CONFIGURATION and HR REGISTRY tabs.
 */

var AuthService = (function () {
  function getConfigurationMap() {
    var rows = SheetRepo.readTable('CONFIGURATION');
    var map = {};
    for (var i = 0; i < rows.length; i++) {
      var k = (rows[i]['Setting'] || '').trim();
      var v = (rows[i]['Value'] || '').trim();
      if (k) map[k] = v;
    }
    return map;
  }

  function setConfigurationKey(key, value) {
    var config = getConfigurationMap();
    if (config.hasOwnProperty(key)) {
      SheetRepo.updateRow('CONFIGURATION', 'Setting', key, { 'Value': String(value) });
    } else {
      SheetRepo.appendRow('CONFIGURATION', { 'Setting': key, 'Value': String(value) });
    }
  }

  function parseEmailList(rawStr) {
    if (!rawStr) return [];
    return rawStr.split(',').map(function (e) {
      return e.trim().toLowerCase();
    }).filter(function (e) { return e.length > 0; });
  }

  function getSuperAdminEmails() {
    var config = getConfigurationMap();
    var raw = config['SUPER_ADMIN_EMAILS'] || 'novapulse739@gmail.com';
    return parseEmailList(raw);
  }

  function getManagementEmails() {
    var config = getConfigurationMap();
    var raw = config['MANAGEMENT_EMAILS'] || 'admin@novapulse.co.in';
    return parseEmailList(raw);
  }

  function getRecruitmentManagerEmails() {
    var config = getConfigurationMap();
    var raw = config['RECRUITMENT_MANAGER_EMAILS'] || 'manager@novapulse.co.in';
    return parseEmailList(raw);
  }

  function getFinanceEmails() {
    var config = getConfigurationMap();
    var raw = config['FINANCE_EMAILS'] || 'finance@novapulse.co.in, accounts@novapulse.co.in';
    return parseEmailList(raw);
  }

  function getManagerTeamMapping() {
    var config = getConfigurationMap();
    var raw = config['MANAGER_TEAM_MAPPING'] || '{}';
    try {
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }

  function getHrEditableFields() {
    var config = getConfigurationMap();
    var raw = config['HR_EDITABLE_FIELDS'] || 'Designation Applied, Current Location, Experience, Current Salary, Expected Salary, Notice Period, Source, Client Name, Industry, Calling Disposition, Sub-Disposition, Call Status, Connect Status, Interview Status, Interview Date, Selection Status, Joining Status, Joining Date, Remarks';
    return raw.split(',').map(function (f) {
      return f.trim();
    }).filter(function (f) { return f.length > 0; });
  }

  function isRbacEnabled() {
    var config = getConfigurationMap();
    var val = (config['RBAC_ENABLED'] || 'TRUE').trim().toUpperCase();
    return val === 'TRUE' || val === '1' || val === 'YES';
  }

  /**
   * Resolves user identity, role, and permissions
   */
  function resolveUser(email) {
    if (!email) {
      return {
        authenticated: false,
        role: 'DENIED',
        permissions: [],
        error: 'No email provided'
      };
    }
    var cleanEmail = String(email).trim().toLowerCase();

    // 1. Check Super Admin
    var superAdminEmails = getSuperAdminEmails();
    if (superAdminEmails.indexOf(cleanEmail) !== -1) {
      return {
        authenticated: true,
        email: cleanEmail,
        name: 'Super Administrator',
        role: 'SUPER_ADMIN',
        canEditAll: true,
        permissions: PermissionEngine.getPermissionsForRole('SUPER_ADMIN'),
        editableFields: null
      };
    }

    // 2. Check Management Admin
    var adminEmails = getManagementEmails();
    if (adminEmails.indexOf(cleanEmail) !== -1) {
      return {
        authenticated: true,
        email: cleanEmail,
        name: 'Management Admin',
        role: 'ADMIN',
        canEditAll: true,
        permissions: PermissionEngine.getPermissionsForRole('ADMIN'),
        editableFields: null
      };
    }

    // 3. Check Recruitment Manager
    var managerEmails = getRecruitmentManagerEmails();
    if (managerEmails.indexOf(cleanEmail) !== -1) {
      var teamMapping = getManagerTeamMapping();
      var teamRecruiterEmails = (teamMapping[cleanEmail] || []).map(function (e) {
        return String(e).trim().toLowerCase();
      });

      return {
        authenticated: true,
        email: cleanEmail,
        name: 'Recruitment Manager',
        role: 'RECRUITMENT_MANAGER',
        canEditAll: false,
        teamRecruiterEmails: teamRecruiterEmails,
        permissions: PermissionEngine.getPermissionsForRole('RECRUITMENT_MANAGER'),
        editableFields: getHrEditableFields()
      };
    }

    // 4. Check Finance
    var financeEmails = getFinanceEmails();
    if (financeEmails.indexOf(cleanEmail) !== -1) {
      return {
        authenticated: true,
        email: cleanEmail,
        name: 'Finance Executive',
        role: 'FINANCE',
        canEditAll: false,
        permissions: PermissionEngine.getPermissionsForRole('FINANCE'),
        editableFields: []
      };
    }

    // 5. Check HR Registry
    var hrRows = SheetRepo.readTable('HR REGISTRY');
    for (var h = 0; h < hrRows.length; h++) {
      var hrEmail = String(hrRows[h]['HR Email'] || '').trim().toLowerCase();
      if (hrEmail === cleanEmail) {
        var status = String(hrRows[h]['Active Status'] || '').trim().toLowerCase();
        if (status === 'active') {
          return {
            authenticated: true,
            email: cleanEmail,
            name: hrRows[h]['HR Name'] || 'Recruiter',
            hrId: hrRows[h]['HR ID'] || '',
            role: 'HR_RECRUITER',
            canEditAll: false,
            permissions: PermissionEngine.getPermissionsForRole('HR_RECRUITER'),
            editableFields: getHrEditableFields(),
            assignedCandidateCount: hrRows[h]['Assigned Candidate Count'] || '0'
          };
        } else {
          // Explicitly deactivated recruiter
          return {
            authenticated: false,
            email: cleanEmail,
            role: 'DENIED',
            permissions: [],
            error: 'Account Inactive: Your recruiter account has been disabled. Please contact Management.'
          };
        }
      }
    }

    // 6. Unauthorized / Not Registered
    return {
      authenticated: false,
      email: cleanEmail,
      role: 'DENIED',
      permissions: [],
      error: 'Access denied: Email is not registered in NovaPulse CRM.'
    };
  }

  function assertRole(user, requiredRole) {
    if (!user || !user.authenticated) {
      throw new Error('Unauthorized: Authentication required.');
    }
    if (user.role !== requiredRole && user.role !== 'SUPER_ADMIN') {
      throw new Error('Forbidden: ' + requiredRole + ' access required.');
    }
  }

  return {
    resolveUser: resolveUser,
    assertRole: assertRole,
    getConfigurationMap: getConfigurationMap,
    setConfigurationKey: setConfigurationKey,
    getSuperAdminEmails: getSuperAdminEmails,
    getManagementEmails: getManagementEmails,
    getRecruitmentManagerEmails: getRecruitmentManagerEmails,
    getFinanceEmails: getFinanceEmails,
    getManagerTeamMapping: getManagerTeamMapping,
    getHrEditableFields: getHrEditableFields,
    isRbacEnabled: isRbacEnabled
  };
})();
