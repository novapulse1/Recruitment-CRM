/**
 * ============================================================================
 * NOVAPULSE HIRING CRM - COMPLETE BACKEND BUNDLE (ALL-IN-ONE DEPLOYMENT)
 * ============================================================================
 * Contains complete RBAC Permission Engine, Data Scoping, Optimistic Locking,
 * Duplicate Prevention, Automated Pipeline Calculation, and Web App API Endpoints.
 * 
 * Instructions:
 * 1. Open Google Sheet -> Extensions -> Apps Script
 * 2. Delete any existing Code.gs contents and paste this ENTIRE file.
 * 3. Click 'Deploy' -> 'New Deployment' -> Select type 'Web app'
 *    - Description: NovaPulse Production CRM API
 *    - Execute as: Me (your Google account)
 *    - Who has access: Anyone with Google account (or NovaPulse domain)
 * 4. Click 'Deploy' and copy the Web App URL.
 * 5. Paste the Web App URL into your CRM's Admin Settings or .env file!
 * ============================================================================
 */


/* ==================== MODULE: Utils.gs ==================== */

/**
 * NovaPulse Hiring CRM - Utils
 * Date formatting, string sanitization, and helper utilities (Asia/Kolkata)
 */

var Utils = (function () {
  var TIMEZONE = 'Asia/Kolkata';

  function formatDateTime(date) {
    var d = date ? new Date(date) : new Date();
    return Utilities.formatDate(d, TIMEZONE, 'dd-MMM-yyyy HH:mm');
  }

  function formatDate(date) {
    if (!date) return '';
    var d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return Utilities.formatDate(d, TIMEZONE, 'dd-MMM-yyyy');
  }

  function parseDate(str) {
    if (!str) return null;
    var d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Normalize phone number: strip spaces, hyphens, parentheses, "+91", leading "0"
   */
  function normalizePhone(phone) {
    if (!phone) return '';
    var cleaned = String(phone).replace(/[\s\-\(\)\+]/g, '');
    if (cleaned.startsWith('91') && cleaned.length > 10) {
      cleaned = cleaned.substring(2);
    }
    if (cleaned.startsWith('0') && cleaned.length > 10) {
      cleaned = cleaned.substring(1);
    }
    return cleaned.trim();
  }

  /**
   * Normalize email: trim and lowercase
   */
  function normalizeEmail(email) {
    if (!email) return '';
    var cleaned = String(email).trim().toLowerCase();
    if (cleaned === '-' || cleaned === 'na' || cleaned === 'n/a') return '';
    return cleaned;
  }

  /**
   * Format Indian currency: ₹ 1,23,456
   */
  function formatINR(amount) {
    if (amount === null || amount === undefined || amount === '') return '₹ 0';
    var num = Number(amount);
    if (isNaN(num)) return '₹ ' + amount;
    return '₹ ' + num.toLocaleString('en-IN');
  }

  return {
    TIMEZONE: TIMEZONE,
    formatDateTime: formatDateTime,
    formatDate: formatDate,
    parseDate: parseDate,
    normalizePhone: normalizePhone,
    normalizeEmail: normalizeEmail,
    formatINR: formatINR
  };
})();


/* ==================== MODULE: SheetRepo.gs ==================== */

/**
 * NovaPulse Hiring CRM - SheetRepo
 * Generic repository pattern module for Google Sheets access
 * 
 * Rules:
 * - Never rename, reorder, insert, or delete columns or tabs.
 * - Always look up columns BY HEADER NAME, not by fixed index.
 * - Header row = row 1 on all tabs except OPENINGS (row 4 = headers, data starts row 5).
 * - Read-only tabs: MANAGEMENT DASHBOARD, DASHBOARD, INTERVIEW REPORT, JOINING REPORT,
 *   CANDIDATE SEARCH, ACCESS CONTROL REPORT, _DASH DATA, _SYNC STATE
 */

var SheetRepo = (function () {
  var READ_ONLY_TABS = [
    'MANAGEMENT DASHBOARD',
    'DASHBOARD',
    'INTERVIEW REPORT',
    'JOINING REPORT',
    'CANDIDATE SEARCH',
    'ACCESS CONTROL REPORT',
    '_DASH DATA',
    '_SYNC STATE',
    'FORM RESPONSES (RAW)',
    'MD OLD'
  ];

  function getSpreadsheet() {
    // If bound to sheet, use getActiveSpreadsheet(); otherwise fallback to configured ID
    try {
      var active = SpreadsheetApp.getActiveSpreadsheet();
      if (active) return active;
    } catch (e) {
      // not running in container-bound context
    }
    var configId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!configId) {
      configId = '11j17e5RTG0uLTXg41f_AfKMqAUtGCDXV2DusZ8Muq58'; // default production ID
    }
    return SpreadsheetApp.openById(configId);
  }

  function getHeaderRowNumber(tabName) {
    if (tabName === 'OPENINGS') return 4;
    return 1;
  }

  function getDataStartRowNumber(tabName) {
    if (tabName === 'OPENINGS') return 5;
    return 2;
  }

  function getSheet(tabName) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      throw new Error('Tab not found in spreadsheet: ' + tabName);
    }
    return sheet;
  }

  /**
   * Returns a map of Header Name -> Column 1-based Index
   */
  function getHeaderMap(sheet, tabName) {
    var headerRowNum = getHeaderRowNumber(tabName);
    var lastCol = sheet.getLastColumn();
    if (lastCol < 1) return { map: {}, list: [] };

    var headerValues = sheet.getRange(headerRowNum, 1, 1, lastCol).getDisplayValues()[0];
    var map = {};
    var list = [];
    for (var i = 0; i < headerValues.length; i++) {
      var header = (headerValues[i] || '').trim();
      if (header) {
        map[header] = i + 1; // 1-based index
        list.push(header);
      }
    }
    return { map: map, list: list };
  }

  /**
   * Generic readTable: returns array of row objects
   */
  function readTable(tabName, options) {
    options = options || {};
    var sheet = getSheet(tabName);
    var headerInfo = getHeaderMap(sheet, tabName);
    var startRow = getDataStartRowNumber(tabName);
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    if (lastRow < startRow || lastCol < 1) {
      return [];
    }

    var numRows = lastRow - startRow + 1;
    // Use getDisplayValues to preserve formatted strings, dates, leading zeroes, phone numbers
    var range = sheet.getRange(startRow, 1, numRows, lastCol);
    var displayValues = range.getDisplayValues();
    var rawValues = (options.useRawValues) ? range.getValues() : null;

    var rows = [];
    for (var r = 0; r < displayValues.length; r++) {
      var rowObj = {};
      var isEmpty = true;
      for (var h = 0; h < headerInfo.list.length; h++) {
        var header = headerInfo.list[h];
        var colIdx = headerInfo.map[header] - 1;
        var val = rawValues ? rawValues[r][colIdx] : displayValues[r][colIdx];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          isEmpty = false;
        }
        rowObj[header] = val !== undefined && val !== null ? val : '';
      }

      if (!isEmpty) {
        // Attach 1-based sheet row index for fast targeted updates
        rowObj._rowIndex = startRow + r;
        if (!options.filter || options.filter(rowObj)) {
          rows.push(rowObj);
        }
      }
    }

    if (options.limit && options.limit > 0) {
      var offset = options.offset || 0;
      return rows.slice(offset, offset + options.limit);
    }
    return rows;
  }

  /**
   * Generic findRow: returns matching row object with _rowIndex or null
   */
  function findRow(tabName, keyHeader, value) {
    var sheet = getSheet(tabName);
    var headerInfo = getHeaderMap(sheet, tabName);
    var colIndex = headerInfo.map[keyHeader];
    if (!colIndex) {
      throw new Error('Key header "' + keyHeader + '" not found in tab: ' + tabName);
    }

    var startRow = getDataStartRowNumber(tabName);
    var lastRow = sheet.getLastRow();
    if (lastRow < startRow) return null;

    var numRows = lastRow - startRow + 1;
    var columnValues = sheet.getRange(startRow, colIndex, numRows, 1).getDisplayValues();

    var targetValStr = String(value).trim();
    for (var i = 0; i < columnValues.length; i++) {
      if (String(columnValues[i][0]).trim() === targetValStr) {
        var targetRowIndex = startRow + i;
        var rowRange = sheet.getRange(targetRowIndex, 1, 1, sheet.getLastColumn());
        var rowValues = rowRange.getDisplayValues()[0];
        var rowObj = { _rowIndex: targetRowIndex };
        for (var h = 0; h < headerInfo.list.length; h++) {
          var header = headerInfo.list[h];
          var idx = headerInfo.map[header] - 1;
          rowObj[header] = rowValues[idx] || '';
        }
        return rowObj;
      }
    }
    return null;
  }

  /**
   * Generic appendRow: appends an object matching tab headers
   */
  function appendRow(tabName, obj) {
    if (READ_ONLY_TABS.indexOf(tabName) !== -1) {
      throw new Error('Tab ' + tabName + ' is read-only and cannot be modified.');
    }

    var sheet = getSheet(tabName);
    var headerInfo = getHeaderMap(sheet, tabName);
    var lastCol = sheet.getLastColumn();
    var rowValues = [];

    for (var c = 1; c <= lastCol; c++) {
      // Find header for this column index
      var colHeader = null;
      for (var h = 0; h < headerInfo.list.length; h++) {
        if (headerInfo.map[headerInfo.list[h]] === c) {
          colHeader = headerInfo.list[h];
          break;
        }
      }
      var val = (colHeader && obj[colHeader] !== undefined) ? obj[colHeader] : '';
      rowValues.push(val);
    }

    sheet.appendRow(rowValues);
    var newRowIndex = sheet.getLastRow();
    obj._rowIndex = newRowIndex;
    return { success: true, rowIndex: newRowIndex, data: obj };
  }

  /**
   * Generic updateRow: updates only fields specified in patch by matching keyHeader = value
   */
  function updateRow(tabName, keyHeader, value, patch) {
    if (READ_ONLY_TABS.indexOf(tabName) !== -1) {
      throw new Error('Tab ' + tabName + ' is read-only and cannot be modified.');
    }

    var sheet = getSheet(tabName);
    var headerInfo = getHeaderMap(sheet, tabName);
    var existing = findRow(tabName, keyHeader, value);
    if (!existing) {
      throw new Error('Record not found in tab ' + tabName + ' where ' + keyHeader + ' = ' + value);
    }

    var rowIndex = existing._rowIndex;
    for (var patchField in patch) {
      if (!patch.hasOwnProperty(patchField)) continue;
      if (patchField.startsWith('_')) continue; // skip internal metadata fields

      var colIndex = headerInfo.map[patchField];
      if (colIndex) {
        var newVal = patch[patchField];
        sheet.getRange(rowIndex, colIndex).setValue(newVal !== undefined && newVal !== null ? newVal : '');
      }
    }

    return { success: true, rowIndex: rowIndex, updatedFields: patch };
  }

  return {
    getSpreadsheet: getSpreadsheet,
    getSheet: getSheet,
    getHeaderMap: getHeaderMap,
    readTable: readTable,
    findRow: findRow,
    appendRow: appendRow,
    updateRow: updateRow,
    READ_ONLY_TABS: READ_ONLY_TABS
  };
})();


/* ==================== MODULE: AuditService.gs ==================== */

/**
 * NovaPulse Hiring CRM - AuditService
 * Appends every create/update/archive action to AUDIT LOG
 */

var AuditService = (function () {
  function logChange(candidateId, candidateName, field, oldValue, newValue, user, hrName) {
    var timestamp = Utils.formatDateTime(new Date());
    var auditEntry = {
      'Timestamp': timestamp,
      'Candidate ID': candidateId || '',
      'Candidate Name': candidateName || '',
      'Previous Value': oldValue !== undefined && oldValue !== null ? String(oldValue) : '',
      'New Value': newValue !== undefined && newValue !== null ? String(newValue) : '',
      'Action': 'UPDATE: ' + field,
      'Updated By': user ? user.email : 'System',
      'HR Name': hrName || (user ? user.name : ''),
      'Source Spreadsheet': 'CRM',
      'Action Type': 'CRM'
    };

    SheetRepo.appendRow('AUDIT LOG', auditEntry);
  }

  function logChanges(candidateId, candidateName, oldObj, newObj, user, hrName) {
    for (var key in newObj) {
      if (!newObj.hasOwnProperty(key)) continue;
      if (key.startsWith('_') || key === 'Last Updated' || key === 'Last Updated By' || key === 'Record Version') {
        continue;
      }
      var oldVal = oldObj ? oldObj[key] : '';
      var newVal = newObj[key];
      if (String(oldVal || '') !== String(newVal || '')) {
        logChange(candidateId, candidateName, key, oldVal, newVal, user, hrName);
      }
    }
  }

  function logAction(candidateId, candidateName, actionName, user, hrName, details) {
    var timestamp = Utils.formatDateTime(new Date());
    var auditEntry = {
      'Timestamp': timestamp,
      'Candidate ID': candidateId || '',
      'Candidate Name': candidateName || '',
      'Previous Value': details ? (details.previous || '') : '',
      'New Value': details ? (details.new || '') : '',
      'Action': actionName,
      'Updated By': user ? user.email : 'System',
      'HR Name': hrName || (user ? user.name : ''),
      'Source Spreadsheet': 'CRM',
      'Action Type': 'CRM'
    };

    SheetRepo.appendRow('AUDIT LOG', auditEntry);
  }

  return {
    logChange: logChange,
    logChanges: logChanges,
    logAction: logAction
  };
})();


/* ==================== MODULE: PermissionEngine.gs ==================== */

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


/* ==================== MODULE: AuthService.gs ==================== */

/**
 * NovaPulse Hiring CRM - AuthService
 * Resolves user identity, roles, granular permissions, password authentication,
 * lockout policies, and session token generation server-side.
 * Interacts with USERS, CONFIGURATION, and HR REGISTRY tabs.
 */

var AuthService = (function () {
  var SESSION_SECRET = 'NP_CRM_SECURE_SALT_2026_SESSION_KEY';

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

  // --- CRYPTO HELPERS (PBKDF2/SHA-256) ---

  function generateRandomSalt() {
    var chars = '0123456789abcdef';
    var salt = '';
    for (var i = 0; i < 32; i++) {
      salt += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return salt;
  }

  function hashPassword(password, saltHex, iterations) {
    var iters = iterations || 10000;
    var saltBytes = [];
    for (var i = 0; i < saltHex.length; i += 2) {
      saltBytes.push(parseInt(saltHex.substr(i, 2), 16));
    }
    // Block 1: Salt + Int32BE(1)
    saltBytes.push(0, 0, 0, 1);

    var u = Utilities.computeHmacSha256Signature(saltBytes, password);
    var xor = u.slice();
    for (var c = 1; c < iters; c++) {
      u = Utilities.computeHmacSha256Signature(u, password);
      for (var k = 0; k < 32; k++) {
        xor[k] ^= u[k];
      }
    }
    var hex = '';
    for (var j = 0; j < 32; j++) {
      var b = xor[j];
      if (b < 0) b += 256;
      var s = b.toString(16);
      if (s.length === 1) hex += '0';
      hex += s;
    }
    return hex;
  }

  function createSessionToken(user, rememberMe) {
    var duration = rememberMe ? (7 * 24 * 3600 * 1000) : (8 * 3600 * 1000);
    var payload = {
      user_id: user.user_id || '',
      email: user.email,
      role: user.role,
      exp: Date.now() + duration
    };
    var payloadStr = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
    var sig = Utilities.computeHmacSha256Signature(payloadStr, SESSION_SECRET);
    var sigStr = Utilities.base64EncodeWebSafe(sig);
    return payloadStr + '.' + sigStr;
  }

  function verifySessionToken(token) {
    if (!token || token.indexOf('.') === -1) return null;
    var parts = token.split('.');
    var payloadStr = parts[0];
    var sigStr = parts[1];
    var expectedSig = Utilities.computeHmacSha256Signature(payloadStr, SESSION_SECRET);
    var expectedSigStr = Utilities.base64EncodeWebSafe(expectedSig);
    if (sigStr !== expectedSigStr) return null;

    try {
      var decoded = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadStr)).getDataAsString());
      if (decoded.exp && Date.now() > decoded.exp) {
        return null; // Expired
      }
      return decoded;
    } catch (e) {
      return null;
    }
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

    // Check USERS table first
    var userRows = SheetRepo.readTable('USERS');
    var foundUserRow = null;
    for (var u = 0; u < userRows.length; u++) {
      var uEmail = String(userRows[u]['email'] || '').trim().toLowerCase();
      var uId = String(userRows[u]['user_id'] || '').trim().toLowerCase();
      if (uEmail === cleanEmail || uId === cleanEmail) {
        foundUserRow = userRows[u];
        break;
      }
    }

    if (foundUserRow) {
      var status = String(foundUserRow['status'] || 'Active').trim();
      if (status !== 'Active') {
        return {
          authenticated: false,
          email: foundUserRow['email'],
          role: 'DENIED',
          permissions: [],
          error: 'Your account is deactivated. Contact Admin.'
        };
      }

      var role = foundUserRow['role'] || 'DENIED';
      var perms = PermissionEngine.getPermissionsForRole(role);
      var teamRecruiterEmails = [];
      if (role === 'RECRUITMENT_MANAGER') {
        var teamMapping = getManagerTeamMapping();
        teamRecruiterEmails = (teamMapping[foundUserRow['email']] || []).map(function (e) {
          return String(e).trim().toLowerCase();
        });
      }

      return {
        authenticated: true,
        user_id: foundUserRow['user_id'],
        email: foundUserRow['email'],
        name: foundUserRow['name'] || foundUserRow['user_id'],
        role: role,
        canEditAll: (role === 'SUPER_ADMIN' || role === 'ADMIN'),
        teamRecruiterEmails: teamRecruiterEmails,
        permissions: perms,
        must_change_password: String(foundUserRow['must_change_password']).toUpperCase() === 'TRUE',
        editableFields: (role === 'HR_RECRUITER' || role === 'RECRUITMENT_MANAGER') ? getHrEditableFields() : []
      };
    }

    // Fallback: 1. Check Super Admin
    var superAdminEmails = getSuperAdminEmails();
    if (superAdminEmails.indexOf(cleanEmail) !== -1) {
      return {
        authenticated: true,
        user_id: 'superadmin',
        email: cleanEmail,
        name: 'Super Administrator',
        role: 'SUPER_ADMIN',
        canEditAll: true,
        permissions: PermissionEngine.getPermissionsForRole('SUPER_ADMIN'),
        editableFields: null
      };
    }

    // Fallback: 2. Check Management Admin
    var adminEmails = getManagementEmails();
    if (adminEmails.indexOf(cleanEmail) !== -1) {
      return {
        authenticated: true,
        user_id: 'admin',
        email: cleanEmail,
        name: 'Management Admin',
        role: 'ADMIN',
        canEditAll: true,
        permissions: PermissionEngine.getPermissionsForRole('ADMIN'),
        editableFields: null
      };
    }

    // Fallback: 3. Check HR Registry
    var hrRows = SheetRepo.readTable('HR REGISTRY');
    for (var h = 0; h < hrRows.length; h++) {
      var hrEmail = String(hrRows[h]['HR Email'] || '').trim().toLowerCase();
      if (hrEmail === cleanEmail) {
        var hrStatus = String(hrRows[h]['Active Status'] || '').trim().toLowerCase();
        if (hrStatus === 'active') {
          return {
            authenticated: true,
            user_id: hrRows[h]['HR ID'] || '',
            email: cleanEmail,
            name: hrRows[h]['HR Name'] || 'Recruiter',
            hrId: hrRows[h]['HR ID'] || '',
            role: 'HR_RECRUITER',
            canEditAll: false,
            permissions: PermissionEngine.getPermissionsForRole('HR_RECRUITER'),
            editableFields: getHrEditableFields()
          };
        }
      }
    }

    return {
      authenticated: false,
      email: cleanEmail,
      role: 'DENIED',
      permissions: [],
      error: 'Access denied: Email is not registered in NovaPulse CRM.'
    };
  }

  /**
   * Secure Login with Identifier (user_id or email) + Password
   */
  function login(identifier, password, rememberMe) {
    if (!identifier || !password) {
      return { success: false, error: 'Invalid User ID or password' };
    }

    var cleanId = String(identifier).trim().toLowerCase();
    var users = SheetRepo.readTable('USERS');
    var userRow = null;

    for (var i = 0; i < users.length; i++) {
      var row = users[i];
      var uId = String(row['user_id'] || '').trim().toLowerCase();
      var uEmail = String(row['email'] || '').trim().toLowerCase();
      if (uId === cleanId || uEmail === cleanId) {
        userRow = row;
        break;
      }
    }

    if (!userRow) {
      AuditService.logAction('AUTH', identifier, 'LOGIN_FAILED', null, 'User not found');
      return { success: false, error: 'Invalid User ID or password' };
    }

    // Check account status
    var status = String(userRow['status'] || 'Active').trim();
    if (status !== 'Active') {
      AuditService.logAction('AUTH', userRow['user_id'], 'LOGIN_BLOCKED_INACTIVE', null, 'Deactivated account');
      return { success: false, error: 'Your account is deactivated. Contact Admin.' };
    }

    // Check account lockout
    var lockedUntil = userRow['locked_until'];
    if (lockedUntil) {
      var lockTime = new Date(lockedUntil).getTime();
      var nowTime = Date.now();
      if (nowTime < lockTime) {
        var remainingMins = Math.ceil((lockTime - nowTime) / 60000);
        AuditService.logAction('AUTH', userRow['user_id'], 'LOGIN_BLOCKED_LOCKED', null, 'Locked for remaining: ' + remainingMins + 'm');
        return {
          success: false,
          error: 'Account is temporarily locked. Please try again in ' + remainingMins + ' minute(s) or contact Admin.',
          isLocked: true
        };
      }
    }

    // Verify password hash
    var storedHash = String(userRow['password_hash'] || '');
    var salt = String(userRow['salt'] || '');
    var computedHash = hashPassword(password, salt, 10000);

    if (computedHash !== storedHash) {
      var failed = (parseInt(userRow['failed_attempts'], 10) || 0) + 1;
      var patch = { 'failed_attempts': String(failed) };

      if (failed >= 5) {
        var lockUntilTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        patch['locked_until'] = lockUntilTime;
        SheetRepo.updateRow('USERS', 'user_id', userRow['user_id'], patch);
        AuditService.logAction('AUTH', userRow['user_id'], 'ACCOUNT_LOCKED', null, 'Locked for 15 minutes after 5 failed attempts');
        return {
          success: false,
          error: 'Invalid User ID or password. Account has been locked for 15 minutes due to 5 consecutive failed attempts.',
          isLocked: true
        };
      }

      SheetRepo.updateRow('USERS', 'user_id', userRow['user_id'], patch);
      AuditService.logAction('AUTH', userRow['user_id'], 'LOGIN_FAILED', null, 'Attempt ' + failed + ' of 5');
      return { success: false, error: 'Invalid User ID or password' };
    }

    // Login successful: reset failed attempts & lockout, update last_login
    var nowIso = new Date().toISOString();
    SheetRepo.updateRow('USERS', 'user_id', userRow['user_id'], {
      'failed_attempts': '0',
      'locked_until': '',
      'last_login': nowIso
    });

    var resolvedUser = resolveUser(userRow['email']);
    resolvedUser.must_change_password = String(userRow['must_change_password']).toUpperCase() === 'TRUE';
    resolvedUser.last_login = nowIso;
    var token = createSessionToken(resolvedUser, rememberMe);

    AuditService.logAction('AUTH', userRow['user_id'], 'LOGIN_SUCCESS', resolvedUser, 'Login successful');

    return {
      success: true,
      user: resolvedUser,
      token: token
    };
  }

  /**
   * User Self-Service Password Change
   */
  function changePassword(user, oldPassword, newPassword) {
    if (!user || !user.authenticated) {
      throw new Error('Unauthorized: Authentication required.');
    }
    if (!oldPassword || !newPassword) {
      throw new Error('Both current and new passwords are required.');
    }
    if (oldPassword === newPassword) {
      throw new Error('New password must be different from current password.');
    }
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    if (!/[A-Z]/.test(newPassword)) {
      throw new Error('Password must contain at least one uppercase letter.');
    }
    if (!/[0-9]/.test(newPassword)) {
      throw new Error('Password must contain at least one number.');
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      throw new Error('Password must contain at least one special character.');
    }

    var users = SheetRepo.readTable('USERS');
    var target = null;
    var cleanEmail = String(user.email).trim().toLowerCase();
    for (var i = 0; i < users.length; i++) {
      if (String(users[i]['email'] || '').trim().toLowerCase() === cleanEmail) {
        target = users[i];
        break;
      }
    }

    if (!target) {
      throw new Error('User record not found in database.');
    }

    var oldComputed = hashPassword(oldPassword, target['salt'], 10000);
    if (oldComputed !== target['password_hash']) {
      throw new Error('Current password is incorrect.');
    }

    var newSalt = generateRandomSalt();
    var newHash = hashPassword(newPassword, newSalt, 10000);
    var nowIso = new Date().toISOString();

    SheetRepo.updateRow('USERS', 'user_id', target['user_id'], {
      'password_hash': newHash,
      'salt': newSalt,
      'must_change_password': 'FALSE',
      'password_updated_at': nowIso,
      'password_updated_by': user.email
    });

    AuditService.logAction('AUTH', target['user_id'], 'PASSWORD_CHANGED', user, 'Password successfully updated');

    return { success: true, message: 'Password changed successfully.' };
  }

  /**
   * Admin Password Reset (sets temporary password and must_change_password = TRUE)
   */
  function adminResetPassword(currentUser, targetEmail, tempPassword) {
    PermissionEngine.assertPermission(currentUser, PermissionEngine.PERMISSIONS.USERS_PASSWORD_MANAGE);
    var cleanTarget = String(targetEmail).trim().toLowerCase();

    var users = SheetRepo.readTable('USERS');
    var target = null;
    for (var i = 0; i < users.length; i++) {
      if (String(users[i]['email'] || '').trim().toLowerCase() === cleanTarget) {
        target = users[i];
        break;
      }
    }

    if (!target) {
      throw new Error('Target user not found: ' + targetEmail);
    }

    // Admin Hierarchy Rule:
    // Admin CANNOT reset Super Admin or other Admin accounts
    if (currentUser.role !== 'SUPER_ADMIN') {
      if (target['role'] === 'SUPER_ADMIN' || target['role'] === 'ADMIN') {
        throw new Error('Forbidden: Admins cannot reset Super Admin or Admin accounts.');
      }
    }

    var temporaryPassword = tempPassword;
    if (!temporaryPassword) {
      var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
      temporaryPassword = 'NP-';
      for (var k = 0; k < 9; k++) {
        temporaryPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }

    var newSalt = generateRandomSalt();
    var newHash = hashPassword(temporaryPassword, newSalt, 10000);
    var nowIso = new Date().toISOString();

    SheetRepo.updateRow('USERS', 'user_id', target['user_id'], {
      'password_hash': newHash,
      'salt': newSalt,
      'must_change_password': 'TRUE',
      'failed_attempts': '0',
      'locked_until': '',
      'password_updated_at': nowIso,
      'password_updated_by': currentUser.email
    });

    AuditService.logAction('AUTH', target['user_id'], 'ADMIN_PASSWORD_RESET', currentUser, 'Reset by ' + currentUser.email + ' (' + currentUser.role + ')');

    return {
      success: true,
      temporaryPassword: temporaryPassword,
      message: 'Temporary password set successfully.'
    };
  }

  /**
   * Admin Unlock Account
   */
  function adminUnlockAccount(currentUser, targetEmail) {
    PermissionEngine.assertPermission(currentUser, PermissionEngine.PERMISSIONS.USERS_PASSWORD_MANAGE);
    var cleanTarget = String(targetEmail).trim().toLowerCase();

    var users = SheetRepo.readTable('USERS');
    var target = null;
    for (var i = 0; i < users.length; i++) {
      if (String(users[i]['email'] || '').trim().toLowerCase() === cleanTarget) {
        target = users[i];
        break;
      }
    }

    if (!target) {
      throw new Error('Target user not found: ' + targetEmail);
    }

    if (currentUser.role !== 'SUPER_ADMIN' && target['role'] === 'SUPER_ADMIN') {
      throw new Error('Forbidden: Only Super Admin can unlock a Super Admin account.');
    }

    SheetRepo.updateRow('USERS', 'user_id', target['user_id'], {
      'failed_attempts': '0',
      'locked_until': ''
    });

    AuditService.logAction('AUTH', target['user_id'], 'ACCOUNT_UNLOCKED', currentUser, 'Unlocked by ' + currentUser.email);

    return { success: true, message: 'Account unlocked successfully.' };
  }

  /**
   * Admin Toggle User Status (Active / Inactive)
   */
  function adminToggleUserStatus(currentUser, targetEmail, newStatus) {
    PermissionEngine.assertPermission(currentUser, PermissionEngine.PERMISSIONS.USERS_PASSWORD_MANAGE);
    var cleanTarget = String(targetEmail).trim().toLowerCase();

    if (cleanTarget === 'novapulse739@gmail.com') {
      throw new Error('Forbidden: Root Super Admin account cannot be deactivated.');
    }

    var users = SheetRepo.readTable('USERS');
    var target = null;
    for (var i = 0; i < users.length; i++) {
      if (String(users[i]['email'] || '').trim().toLowerCase() === cleanTarget) {
        target = users[i];
        break;
      }
    }

    if (!target) {
      throw new Error('Target user not found: ' + targetEmail);
    }

    if (currentUser.role !== 'SUPER_ADMIN') {
      if (target['role'] === 'SUPER_ADMIN' || target['role'] === 'ADMIN') {
        throw new Error('Forbidden: Admins cannot deactivate Super Admin or Admin accounts.');
      }
    }

    var statusVal = (String(newStatus).toLowerCase() === 'active') ? 'Active' : 'Inactive';
    SheetRepo.updateRow('USERS', 'user_id', target['user_id'], { 'status': statusVal });

    // Also sync to HR REGISTRY if recruiter
    var hrs = SheetRepo.readTable('HR REGISTRY');
    for (var h = 0; h < hrs.length; h++) {
      if (String(hrs[h]['HR Email'] || '').trim().toLowerCase() === cleanTarget) {
        SheetRepo.updateRow('HR REGISTRY', 'HR ID', hrs[h]['HR ID'], { 'Active Status': statusVal });
        break;
      }
    }

    AuditService.logAction('AUTH', target['user_id'], 'TOGGLE_USER_STATUS', currentUser, 'Status set to ' + statusVal);

    return { success: true, status: statusVal };
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
    login: login,
    changePassword: changePassword,
    adminResetPassword: adminResetPassword,
    adminUnlockAccount: adminUnlockAccount,
    adminToggleUserStatus: adminToggleUserStatus,
    hashPassword: hashPassword,
    generateRandomSalt: generateRandomSalt,
    createSessionToken: createSessionToken,
    verifySessionToken: verifySessionToken,
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

/* ==================== MODULE: DuplicateService.gs ==================== */

/**
 * NovaPulse Hiring CRM - DuplicateService
 * Real-time duplicate candidate checking across Mobile, Alternate Mobile, and Email ID.
 * Logs matched duplicates to DUPLICATE LOG.
 */

var DuplicateService = (function () {
  /**
   * Checks if incoming candidate data matches any existing candidate in MASTER DATA
   * @param {Object} incoming - { candidateId, candidateName, mobileNumber, alternateMobile, emailId, ... }
   * @param {Object} user - logged in user { email, role, name }
   * @param {boolean} shouldLog - whether to log into DUPLICATE LOG if match found
   * @returns {Object} { isDuplicate: boolean, matches: Array }
   */
  function checkDuplicates(incoming, user, shouldLog) {
    var rawMobile = Utils.normalizePhone(incoming['Mobile Number'] || incoming.mobileNumber);
    var rawAltMobile = Utils.normalizePhone(incoming['Alternate Mobile'] || incoming.alternateMobile);
    var rawEmail = Utils.normalizeEmail(incoming['Email ID'] || incoming.emailId);

    if (!rawMobile && !rawAltMobile && !rawEmail) {
      return { isDuplicate: false, matches: [] };
    }

    var masterCandidates = SheetRepo.readTable('MASTER DATA');
    var matches = [];

    for (var i = 0; i < masterCandidates.length; i++) {
      var existing = masterCandidates[i];
      // Skip comparing against itself if updating
      if (incoming['Candidate ID'] && existing['Candidate ID'] === incoming['Candidate ID']) {
        continue;
      }

      var exMobile = Utils.normalizePhone(existing['Mobile Number']);
      var exAltMobile = Utils.normalizePhone(existing['Alternate Mobile']);
      var exEmail = Utils.normalizeEmail(existing['Email ID']);

      var matchFound = false;
      var matchType = '';
      var matchedValue = '';

      if (rawMobile && (rawMobile === exMobile || rawMobile === exAltMobile)) {
        matchFound = true;
        matchType = 'Mobile Match';
        matchedValue = rawMobile;
      } else if (rawAltMobile && (rawAltMobile === exMobile || rawAltMobile === exAltMobile)) {
        matchFound = true;
        matchType = 'Alternate Mobile Match';
        matchedValue = rawAltMobile;
      } else if (rawEmail && rawEmail === exEmail) {
        matchFound = true;
        matchType = 'Email Match';
        matchedValue = rawEmail;
      }

      if (matchFound) {
        var matchDetail = {
          matchedCandidateId: existing['Candidate ID'] || '',
          matchedCandidateName: existing['Candidate Name'] || '',
          matchedHR: existing['Assigned HR'] || '',
          matchedHREmail: existing['HR Email'] || '',
          clientName: existing['Client Name'] || '',
          designation: existing['Designation Applied'] || '',
          status: existing['Pipeline Stage'] || existing['Calling Disposition'] || '',
          matchType: matchType,
          matchedValue: matchedValue
        };
        matches.push(matchDetail);

        if (shouldLog) {
          logDuplicate(incoming, matchDetail, user);
        }
      }
    }

    return {
      isDuplicate: matches.length > 0,
      matches: matches
    };
  }

  function logDuplicate(incoming, matchDetail, user) {
    var timestamp = Utils.formatDateTime(new Date());
    var logEntry = {
      'Timestamp': timestamp,
      'Candidate ID (new/incoming)': incoming['Candidate ID'] || incoming['Lead ID'] || 'NEW_INTAKE',
      'Candidate Name': incoming['Candidate Name'] || incoming.candidateName || '',
      'Matched Candidate ID': matchDetail.matchedCandidateId,
      'Matched Candidate Name': matchDetail.matchedCandidateName,
      'Match Type': matchDetail.matchType,
      'Matched Value': matchDetail.matchedValue,
      'Detected By': user ? user.email : 'System',
      'Decision': 'Pending Review',
      'Reviewed By': '',
      'Review Date': '',
      'Notes': 'Duplicate detected against ' + matchDetail.matchedCandidateId + ' (' + matchDetail.matchedHR + ')'
    };

    // Populate MOVED fields
    var fieldKeys = [
      'Candidate ID', 'Entry Date', 'Candidate Name', 'Mobile Number', 'Alternate Mobile',
      'Email ID', 'Designation Applied', 'Current Location', 'Experience', 'Current Salary',
      'Expected Salary', 'Notice Period', 'Source', 'Client Name', 'Assigned HR', 'HR Email',
      'Calling Disposition', 'Sub-Disposition', 'Call Status', 'Interview Status', 'Interview Date',
      'Selection Status', 'Joining Status', 'Joining Date', 'Remarks', 'Created By', 'Last Updated',
      'Last Updated By', 'Record Version', 'Pipeline Stage', 'Duplicate Of', 'Record Status', 'Industry'
    ];

    for (var f = 0; f < fieldKeys.length; f++) {
      var key = fieldKeys[f];
      var movedKey = 'MOVED: ' + key;
      logEntry[movedKey] = incoming[key] !== undefined ? incoming[key] : '';
    }

    try {
      SheetRepo.appendRow('DUPLICATE LOG', logEntry);
    } catch (e) {
      Logger.log('Error logging to DUPLICATE LOG: ' + e.message);
    }
  }

  return {
    checkDuplicates: checkDuplicates,
    logDuplicate: logDuplicate
  };
})();


/* ==================== MODULE: InterviewService.gs ==================== */

/**
 * NovaPulse Hiring CRM - InterviewService
 * Handles interview scheduling, logging in INTERVIEW LOG, and updating RESCHEDULE TRACKER.
 */

var InterviewService = (function () {
  function recordInterviewChange(candidate, newInterviewDate, oldInterviewDate, user) {
    if (!newInterviewDate || String(newInterviewDate).trim() === '') return;
    if (String(newInterviewDate).trim() === String(oldInterviewDate || '').trim()) return;

    var candidateId = candidate['Candidate ID'];
    var candidateName = candidate['Candidate Name'];
    var assignedHR = candidate['Assigned HR'];
    var timestamp = Utils.formatDateTime(new Date());

    // 1. Look up RESCHEDULE TRACKER to find attempt count
    var existingReschedule = SheetRepo.findRow('RESCHEDULE TRACKER', 'Candidate ID', candidateId);
    var attemptNumber = 1;
    var eventType = 'Scheduled';

    if (existingReschedule) {
      var currentCount = parseInt(existingReschedule['Reschedule Count'], 10) || 1;
      attemptNumber = currentCount + 1;
      eventType = 'Rescheduled';

      var flag = attemptNumber >= 2 ? 'HIGH RESCHEDULE' : '';
      SheetRepo.updateRow('RESCHEDULE TRACKER', 'Candidate ID', candidateId, {
        'Candidate Name': candidateName,
        'Assigned HR': assignedHR,
        'Current Interview Date': Utils.formatDate(newInterviewDate),
        'Reschedule Count': attemptNumber,
        'Interview Status': candidate['Interview Status'] || 'Rescheduled',
        'Last Change': timestamp,
        'Flag': flag,
        'Last Status (system)': 'Rescheduled'
      });
    } else {
      SheetRepo.appendRow('RESCHEDULE TRACKER', {
        'Candidate ID': candidateId,
        'Candidate Name': candidateName,
        'Assigned HR': assignedHR,
        'First Scheduled For': Utils.formatDate(newInterviewDate),
        'Current Interview Date': Utils.formatDate(newInterviewDate),
        'Reschedule Count': 1,
        'Interview Status': candidate['Interview Status'] || 'Pending',
        'Last Change': timestamp,
        'Flag': '',
        'Last Status (system)': 'Scheduled'
      });
    }

    // 2. Append to INTERVIEW LOG
    SheetRepo.appendRow('INTERVIEW LOG', {
      'Logged At': timestamp,
      'Candidate ID': candidateId,
      'Candidate Name': candidateName,
      'Assigned HR': assignedHR,
      'Event': eventType,
      'From Date': oldInterviewDate ? Utils.formatDate(oldInterviewDate) : '',
      'Interview Date': Utils.formatDate(newInterviewDate),
      'Attempt #': attemptNumber,
      'Changed By': user ? user.email : 'System'
    });
  }

  function getInterviewsList(user, filterOptions) {
    var masterCandidates = SheetRepo.readTable('MASTER DATA');
    var interviews = [];

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    for (var i = 0; i < masterCandidates.length; i++) {
      var row = masterCandidates[i];
      var interviewDateStr = row['Interview Date'];
      if (!interviewDateStr || interviewDateStr.trim() === '' || interviewDateStr.trim() === '-') {
        continue;
      }

      // HR privacy filter
      if (user.role === 'HR' && String(row['HR Email']).toLowerCase() !== user.email.toLowerCase()) {
        continue;
      }

      var iDate = new Date(interviewDateStr);
      var iDateNorm = new Date(iDate);
      iDateNorm.setHours(0, 0, 0, 0);

      var diffDays = Math.round((iDateNorm.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      var timeBucket = 'Upcoming';
      if (diffDays < 0) {
        timeBucket = (row['Interview Status'] === 'Pending') ? 'Overdue' : 'Past';
      } else if (diffDays === 0) {
        timeBucket = 'Today';
      } else if (diffDays === 1) {
        timeBucket = 'Tomorrow';
      } else if (diffDays <= 7) {
        timeBucket = 'This Week';
      }

      interviews.push({
        candidateId: row['Candidate ID'],
        candidateName: row['Candidate Name'],
        mobile: row['Mobile Number'],
        designation: row['Designation Applied'],
        clientName: row['Client Name'],
        assignedHR: row['Assigned HR'],
        hrEmail: row['HR Email'],
        interviewDate: row['Interview Date'],
        interviewStatus: row['Interview Status'],
        timeBucket: timeBucket,
        remarks: row['Remarks']
      });
    }

    // Attach reschedule information
    var rescheduleRows = SheetRepo.readTable('RESCHEDULE TRACKER');
    var rescheduleMap = {};
    for (var r = 0; r < rescheduleRows.length; r++) {
      rescheduleMap[rescheduleRows[r]['Candidate ID']] = rescheduleRows[r];
    }

    for (var j = 0; j < interviews.length; j++) {
      var match = rescheduleMap[interviews[j].candidateId];
      if (match) {
        interviews[j].rescheduleCount = parseInt(match['Reschedule Count'], 10) || 1;
        interviews[j].rescheduleFlag = match['Flag'] || '';
      } else {
        interviews[j].rescheduleCount = 1;
        interviews[j].rescheduleFlag = '';
      }
    }

    return interviews;
  }

  return {
    recordInterviewChange: recordInterviewChange,
    getInterviewsList: getInterviewsList
  };
})();


/* ==================== MODULE: JoiningService.gs ==================== */

/**
 * NovaPulse Hiring CRM - JoiningService
 * Handles joined candidate tracking, billing calculations, replacement periods, and invoicing.
 * Enforces role-based billing access and candidate PII masking for Finance role.
 */

var JoiningService = (function () {
  function recordJoining(candidate, user) {
    var candidateId = candidate['Candidate ID'];
    var joiningDateStr = candidate['Joining Date'];
    if (!joiningDateStr || String(joiningDateStr).trim() === '') return;

    var existing = SheetRepo.findRow('JOINING TRACKER', 'Candidate ID', candidateId);
    if (existing) {
      return existing;
    }

    var clientName = candidate['Client Name'] || '';
    var client = SheetRepo.findRow('CLIENT MASTER', 'Client Name', clientName) || {};

    var feeType = client['Fee Type'] || 'Percentage';
    var feeValue = parseFloat(client['Fee Value']) || 8.33;
    var invoiceAfterDays = parseInt(client['Invoice After Joining (Days)'], 10) || 30;
    var replacementPeriodDays = parseInt(client['Replacement Period (Days)'], 10) || 90;
    var gstPercent = parseFloat(client['GST %']) || 18;

    var joiningDate = new Date(joiningDateStr);
    var now = new Date();
    var daysCompleted = Math.max(0, Math.floor((now.getTime() - joiningDate.getTime()) / (1000 * 60 * 60 * 24)));

    var invoiceDueDate = new Date(joiningDate);
    invoiceDueDate.setDate(invoiceDueDate.getDate() + invoiceAfterDays);

    var replacementEnds = new Date(joiningDate);
    replacementEnds.setDate(replacementEnds.getDate() + replacementPeriodDays);

    // Calculate annual CTC
    var annualCtc = parseFloat(candidate['Annual CTC']);
    if (isNaN(annualCtc) || annualCtc <= 0) {
      var currentSalary = parseFloat(candidate['Current Salary']);
      var expectedSalary = parseFloat(candidate['Expected Salary']);
      var baseMonthly = !isNaN(expectedSalary) && expectedSalary > 0 ? expectedSalary : currentSalary;
      annualCtc = (!isNaN(baseMonthly) && baseMonthly > 0) ? (baseMonthly * 12) : 0;
    }

    // Calculate invoice amount
    var invoiceAmount = 0;
    if (String(feeType).toLowerCase().indexOf('fix') !== -1) {
      var baseFixed = feeValue;
      invoiceAmount = Math.round(baseFixed * (1 + (gstPercent / 100)));
    } else {
      var basePercentage = (annualCtc * feeValue) / 100;
      invoiceAmount = Math.round(basePercentage * (1 + (gstPercent / 100)));
    }

    var joiningRecord = {
      'Candidate ID': candidateId,
      'Candidate Name': candidate['Candidate Name'] || '',
      'Client Name': clientName,
      'Designation': candidate['Designation Applied'] || '',
      'Assigned HR': candidate['Assigned HR'] || '',
      'Joining Date': Utils.formatDate(joiningDate),
      'Annual CTC': annualCtc > 0 ? annualCtc : '',
      'Fee Type': feeType,
      'Fee Value': feeValue,
      'Invoice After (Days)': invoiceAfterDays,
      'Replacement Period (Days)': replacementPeriodDays,
      'Days Completed': daysCompleted,
      'Invoice Due Date': Utils.formatDate(invoiceDueDate),
      'Replacement Ends': Utils.formatDate(replacementEnds),
      'Invoice Amount': invoiceAmount > 0 ? invoiceAmount : '',
      'Employment Status': 'Active',
      'Exit Date': '',
      'Early Exit Decision': '',
      'Invoice Status': 'Pending',
      'Invoice No': '',
      'Invoice Date': '',
      'Payment Received On': '',
      'Replacement Candidate ID': '',
      'Billing Status': 'Pending',
      'Replacement Status': 'Active',
      'Remarks': candidate['Remarks'] || '',
      'System Note': 'Created by CRM on ' + Utils.formatDateTime(new Date())
    };

    SheetRepo.appendRow('JOINING TRACKER', joiningRecord);
    return joiningRecord;
  }

  function getJoiningsList(user) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.JOININGS_VIEW);
    var rows = SheetRepo.readTable('JOINING TRACKER');
    var now = new Date();

    return rows.map(function (row) {
      var jDate = Utils.parseDate(row['Joining Date']);
      var daysCompleted = jDate ? Math.max(0, Math.floor((now.getTime() - jDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
      var replDays = parseInt(row['Replacement Period (Days)'], 10) || 90;
      var replRemaining = Math.max(0, replDays - daysCompleted);

      var invoiceDue = Utils.parseDate(row['Invoice Due Date']);
      var daysUntilInvoiceDue = invoiceDue ? Math.ceil((invoiceDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 999;
      var invoiceDueSoon = (daysUntilInvoiceDue >= 0 && daysUntilInvoiceDue <= 7 && row['Invoice Status'] !== 'Paid');

      return {
        candidateId: row['Candidate ID'],
        candidateName: row['Candidate Name'],
        clientName: row['Client Name'],
        designation: row['Designation'],
        assignedHR: row['Assigned HR'],
        joiningDate: row['Joining Date'],
        annualCtc: row['Annual CTC'],
        feeType: row['Fee Type'],
        feeValue: row['Fee Value'],
        daysCompleted: daysCompleted,
        invoiceDueDate: row['Invoice Due Date'],
        replacementEnds: row['Replacement Ends'],
        invoiceAmount: row['Invoice Amount'],
        employmentStatus: row['Employment Status'] || 'Active',
        exitDate: row['Exit Date'] || '',
        earlyExitDecision: row['Early Exit Decision'] || '',
        invoiceStatus: row['Invoice Status'] || 'Pending',
        invoiceNo: row['Invoice No'] || '',
        invoiceDate: row['Invoice Date'] || '',
        paymentReceivedOn: row['Payment Received On'] || '',
        replacementCandidateId: row['Replacement Candidate ID'] || '',
        billingStatus: row['Billing Status'] || 'Pending',
        replacementStatus: row['Replacement Status'] || 'Active',
        remarks: row['Remarks'] || '',
        daysUntilInvoiceDue: daysUntilInvoiceDue,
        invoiceDueSoon: invoiceDueSoon,
        replacementRemainingDays: replRemaining
      };
    });
  }

  function updateBilling(user, candidateId, patch) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.BILLING_UPDATE);

    var allowedBillingFields = [
      'Employment Status', 'Exit Date', 'Early Exit Decision',
      'Invoice Status', 'Invoice No', 'Invoice Date', 'Payment Received On',
      'Replacement Candidate ID', 'Billing Status', 'Replacement Status',
      'Remarks', 'Invoice Amount', 'Fee Type', 'Fee Value'
    ];

    var safePatch = {};
    for (var f = 0; f < allowedBillingFields.length; f++) {
      var field = allowedBillingFields[f];
      if (patch[field] !== undefined) {
        safePatch[field] = patch[field];
      }
    }

    safePatch['System Note'] = 'Updated by ' + user.email + ' on ' + Utils.formatDateTime(new Date());
    var updated = SheetRepo.updateRow('JOINING TRACKER', 'Candidate ID', candidateId, safePatch);

    // Audit log billing change
    try {
      AuditService.logAction(
        candidateId,
        'BILLING',
        'UPDATE_BILLING',
        user,
        JSON.stringify(safePatch)
      );
    } catch (e) {
      // ignore
    }

    return updated;
  }

  return {
    recordJoining: recordJoining,
    getJoiningsList: getJoiningsList,
    updateBilling: updateBilling
  };
})();


/* ==================== MODULE: LeadService.gs ==================== */

/**
 * NovaPulse Hiring CRM - LeadService
 * Handles lead submission by recruiters and approval/rejection/merging by management.
 * Enforces role-based permissions: Recruiters can view own leads; only Super Admin and Admin can approve/reject.
 */

var LeadService = (function () {
  function generateNextLeadId() {
    var leads = SheetRepo.readTable('LEAD APPROVALS');
    var maxNum = 0;
    var regex = /^NP-LEAD-(\d+)$/i;

    for (var i = 0; i < leads.length; i++) {
      var id = leads[i]['Lead ID'];
      if (id) {
        var match = regex.exec(id.trim());
        if (match && match[1]) {
          var num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }

    var nextNum = maxNum + 1;
    var padded = ('000000' + nextNum).slice(-6);
    return 'NP-LEAD-' + padded;
  }

  function submitLead(user, data, duplicateOfId) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.LEADS_SUBMIT);

    var leadId = generateNextLeadId();
    var timestamp = Utils.formatDateTime(new Date());

    var leadRecord = {
      'Lead ID': leadId,
      'Received': timestamp,
      'Submitted By HR': user.name || user.email,
      'Request Type': data.requestType || 'New Candidate',
      'Candidate Name': data['Candidate Name'] || data.candidateName || '',
      'Mobile Number': String(data['Mobile Number'] || data.mobileNumber || '').replace(/'/g, ''),
      'Alternate Mobile': String(data['Alternate Mobile'] || data.alternateMobile || '').replace(/'/g, ''),
      'Email ID': data['Email ID'] || data.emailId || '',
      'Designation': data['Designation Applied'] || data.designation || '',
      'Location': data['Current Location'] || data.location || '',
      'Experience': data['Experience'] || data.experience || '',
      'Current Salary': data['Current Salary'] || data.currentSalary || '',
      'Expected Salary': data['Expected Salary'] || data.expectedSalary || '',
      'Notice Period': data['Notice Period'] || data.noticePeriod || '',
      'Source': data['Source'] || data.source || '',
      'Client Name': data['Client Name'] || data.clientName || '',
      'Remarks': data['Remarks'] || data.remarks || '',
      'Duplicate Of': duplicateOfId || data.duplicateOf || '',
      'Duplicate With HR': data.duplicateWithHR || '',
      'Status': 'Pending',
      'Decision': 'Pending',
      'Admin Note': '',
      'Processed By': '',
      'Processed At': '',
      'Candidate ID': '',
      'Industry': data['Industry'] || data.industry || '',
      'Assign To HR': user.name || ''
    };

    SheetRepo.appendRow('LEAD APPROVALS', leadRecord);

    return {
      success: true,
      leadId: leadId,
      status: 'Pending',
      message: 'Candidate lead submitted successfully for management approval.'
    };
  }

  function getLeadsList(user, filterStatus) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.LEADS_VIEW);

    var rows = SheetRepo.readTable('LEAD APPROVALS');

    // HR Recruiter only sees leads submitted by them
    if (user.role === 'HR_RECRUITER') {
      var userNameLower = (user.name || '').toLowerCase();
      var userEmailLower = (user.email || '').toLowerCase();
      rows = rows.filter(function (r) {
        var sub = String(r['Submitted By HR'] || '').toLowerCase();
        return sub === userNameLower || sub === userEmailLower;
      });
    }

    if (filterStatus) {
      rows = rows.filter(function (r) {
        return (r['Status'] || '').toLowerCase() === filterStatus.toLowerCase();
      });
    }
    return rows;
  }

  function approveLead(user, leadId, assignToHR, adminNote) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.LEADS_APPROVE);

    var lead = SheetRepo.findRow('LEAD APPROVALS', 'Lead ID', leadId);
    if (!lead) {
      throw new Error('Lead not found: ' + leadId);
    }
    if (lead['Status'] !== 'Pending') {
      throw new Error('Lead is already ' + lead['Status']);
    }

    var targetHRName = assignToHR && assignToHR.name ? assignToHR.name : (lead['Assign To HR'] || lead['Submitted By HR']);
    var targetHREmail = assignToHR && assignToHR.email ? assignToHR.email : '';

    if (!targetHREmail && targetHRName) {
      var hrRows = SheetRepo.readTable('HR REGISTRY');
      for (var h = 0; h < hrRows.length; h++) {
        if (hrRows[h]['HR Name'] === targetHRName) {
          targetHREmail = hrRows[h]['HR Email'];
          break;
        }
      }
    }

    var candidateId = CandidateService.generateNextCandidateId();
    var nowTimestamp = Utils.formatDateTime(new Date());
    var nowDate = Utils.formatDate(new Date());

    var masterRecord = {
      'Candidate ID': candidateId,
      'Entry Date': nowDate,
      'Candidate Name': lead['Candidate Name'] || '',
      'Mobile Number': lead['Mobile Number'] || '',
      'Alternate Mobile': lead['Alternate Mobile'] || '',
      'Email ID': lead['Email ID'] || '',
      'Designation Applied': lead['Designation'] || '',
      'Current Location': lead['Location'] || '',
      'Experience': lead['Experience'] || '',
      'Current Salary': lead['Current Salary'] || '',
      'Expected Salary': lead['Expected Salary'] || '',
      'Notice Period': lead['Notice Period'] || '',
      'Source': lead['Source'] || '',
      'Client Name': lead['Client Name'] || '',
      'Assigned HR': targetHRName,
      'HR Email': targetHREmail,
      'Connect Status': 'Not Connected',
      'Calling Disposition': '',
      'Sub-Disposition': '',
      'Call Status': '',
      'Interview Status': '',
      'Interview Date': '',
      'Selection Status': '',
      'Joining Status': '',
      'Joining Date': '',
      'Remarks': lead['Remarks'] || '',
      'Created By': user.email,
      'Last Updated': nowTimestamp,
      'Last Updated By': user.email,
      'Record Version': 1,
      'Pipeline Stage': 'Sourced',
      'Duplicate Of': lead['Duplicate Of'] || '',
      'Record Status': 'Active',
      'Industry': lead['Industry'] || ''
    };

    SheetRepo.appendRow('MASTER DATA', masterRecord);

    SheetRepo.updateRow('LEAD APPROVALS', 'Lead ID', leadId, {
      'Status': 'Approved',
      'Decision': 'Approved',
      'Admin Note': adminNote || 'Approved by ' + user.email,
      'Processed By': user.email,
      'Processed At': nowTimestamp,
      'Candidate ID': candidateId,
      'Assign To HR': targetHRName
    });

    AuditService.logAction(candidateId, masterRecord['Candidate Name'], 'APPROVE_LEAD', user, targetHRName);

    return {
      success: true,
      leadId: leadId,
      candidateId: candidateId,
      status: 'Approved'
    };
  }

  function rejectLead(user, leadId, adminNote) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.LEADS_REJECT);

    var lead = SheetRepo.findRow('LEAD APPROVALS', 'Lead ID', leadId);
    if (!lead) {
      throw new Error('Lead not found: ' + leadId);
    }
    if (lead['Status'] !== 'Pending') {
      throw new Error('Lead is already ' + lead['Status']);
    }

    var nowTimestamp = Utils.formatDateTime(new Date());

    SheetRepo.updateRow('LEAD APPROVALS', 'Lead ID', leadId, {
      'Status': 'Rejected',
      'Decision': 'Rejected',
      'Admin Note': adminNote || 'Rejected by ' + user.email,
      'Processed By': user.email,
      'Processed At': nowTimestamp
    });

    AuditService.logAction(leadId, lead['Candidate Name'], 'REJECT_LEAD', user, adminNote || '');

    return {
      success: true,
      leadId: leadId,
      status: 'Rejected'
    };
  }

  function mergeLead(user, leadId, targetCandidateId, adminNote) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.LEADS_APPROVE);

    var lead = SheetRepo.findRow('LEAD APPROVALS', 'Lead ID', leadId);
    if (!lead) {
      throw new Error('Lead not found: ' + leadId);
    }
    var target = SheetRepo.findRow('MASTER DATA', 'Candidate ID', targetCandidateId);
    if (!target) {
      throw new Error('Target candidate not found: ' + targetCandidateId);
    }

    var nowTimestamp = Utils.formatDateTime(new Date());

    SheetRepo.updateRow('LEAD APPROVALS', 'Lead ID', leadId, {
      'Status': 'Merged',
      'Decision': 'Merged',
      'Admin Note': adminNote || 'Merged into ' + targetCandidateId + ' by ' + user.email,
      'Processed By': user.email,
      'Processed At': nowTimestamp,
      'Candidate ID': targetCandidateId
    });

    AuditService.logAction(targetCandidateId, target['Candidate Name'], 'MERGE_LEAD', user, 'Lead ' + leadId + ' merged');

    return {
      success: true,
      leadId: leadId,
      targetCandidateId: targetCandidateId,
      status: 'Merged'
    };
  }

  return {
    generateNextLeadId: generateNextLeadId,
    submitLead: submitLead,
    getLeadsList: getLeadsList,
    approveLead: approveLead,
    rejectLead: rejectLead,
    mergeLead: mergeLead
  };
})();


/* ==================== MODULE: OpeningsClientsService.gs ==================== */

/**
 * NovaPulse Hiring CRM - OpeningsClientsService
 * Manages OPENINGS (row 4 headers, row 5 data) and CLIENT MASTER
 */

var OpeningsClientsService = (function () {
  // OPENINGS
  function listOpenings(filters) {
    filters = filters || {};
    var rows = SheetRepo.readTable('OPENINGS');

    if (filters.status) {
      rows = rows.filter(function (r) {
        return String(r['Status'] || '').toLowerCase() === String(filters.status).toLowerCase();
      });
    }
    if (filters.clientName) {
      rows = rows.filter(function (r) {
        return r['Client Name'] === filters.clientName;
      });
    }
    if (filters.city) {
      var queryCity = String(filters.city).toLowerCase();
      rows = rows.filter(function (r) {
        return String(r['Job Location (City)'] || '').toLowerCase().indexOf(queryCity) !== -1;
      });
    }
    return rows;
  }

  function generateNextOpeningId() {
    var openings = SheetRepo.readTable('OPENINGS');
    var maxNum = 0;
    var regex = /^OP-(\d+)$/i;
    for (var i = 0; i < openings.length; i++) {
      var id = openings[i]['Opening ID'];
      if (id) {
        var match = regex.exec(id.trim());
        if (match && match[1]) {
          var num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
    }
    return 'OP-' + ('000' + (maxNum + 1)).slice(-3);
  }

  function saveOpening(user, openingData) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.OPENINGS_EDIT);
    var openingId = openingData['Opening ID'];
    var nowDate = Utils.formatDate(new Date());

    if (openingId) {
      // Update existing
      var patch = {};
      for (var k in openingData) {
        if (openingData.hasOwnProperty(k) && !k.startsWith('_')) {
          patch[k] = openingData[k];
        }
      }
      patch['Last Updated'] = nowDate;
      SheetRepo.updateRow('OPENINGS', 'Opening ID', openingId, patch);
      return { success: true, openingId: openingId, opening: patch };
    } else {
      // Create new
      openingId = generateNextOpeningId();
      var newRecord = {
        'Opening ID': openingId,
        'Status': openingData['Status'] || 'Open',
        'Posted On': openingData['Posted On'] ? Utils.formatDate(openingData['Posted On']) : nowDate,
        'Position / Role': openingData['Position / Role'] || '',
        'Client Name': openingData['Client Name'] || '',
        'Job Location (City)': openingData['Job Location (City)'] || '',
        'Office / Interview Address': openingData['Office / Interview Address'] || '',
        'Skills Required': openingData['Skills Required'] || '',
        'Qualification': openingData['Qualification'] || '',
        'Experience Required': openingData['Experience Required'] || '',
        'Salary Slab (₹ / month)': openingData['Salary Slab (₹ / month)'] || '',
        'No. of Vacancies': openingData['No. of Vacancies'] || '1',
        'Shift / Timings': openingData['Shift / Timings'] || '',
        'Working Days': openingData['Working Days'] || '',
        'Interview Mode / Process': openingData['Interview Mode / Process'] || '',
        'Other Details / Perks': openingData['Other Details / Perks'] || '',
        'Last Updated': nowDate
      };
      SheetRepo.appendRow('OPENINGS', newRecord);
      return { success: true, openingId: openingId, opening: newRecord };
    }
  }

  // CLIENTS
  function listClients() {
    var clients = SheetRepo.readTable('CLIENT MASTER');
    var openings = SheetRepo.readTable('OPENINGS');
    var candidates = SheetRepo.readTable('MASTER DATA');

    // Aggregate active openings and candidate pipeline counts per client
    var openingsCountMap = {};
    for (var o = 0; o < openings.length; o++) {
      if (String(openings[o]['Status']).toLowerCase() === 'open') {
        var cName = openings[o]['Client Name'];
        openingsCountMap[cName] = (openingsCountMap[cName] || 0) + 1;
      }
    }

    var linedUpMap = {};
    var selectedMap = {};
    var joinedMap = {};

    for (var c = 0; c < candidates.length; c++) {
      var client = candidates[c]['Client Name'];
      if (!client) continue;

      var pipe = candidates[c]['Pipeline Stage'] || '';
      var sel = candidates[c]['Selection Status'] || '';
      var join = candidates[c]['Joining Status'] || '';

      if (pipe === 'Interview Scheduled' || pipe === 'Interview Attended') {
        linedUpMap[client] = (linedUpMap[client] || 0) + 1;
      }
      if (sel === 'Selected') {
        selectedMap[client] = (selectedMap[client] || 0) + 1;
      }
      if (join === 'Joined') {
        joinedMap[client] = (joinedMap[client] || 0) + 1;
      }
    }

    return clients.map(function (cl) {
      var name = cl['Client Name'] || '';
      return {
        clientId: cl['Client ID'],
        clientName: name,
        status: cl['Status'] || 'Active',
        feeType: cl['Fee Type'] || 'Percentage',
        feeValue: cl['Fee Value'] || '',
        invoiceAfterDays: cl['Invoice After Joining (Days)'] || '30',
        replacementPeriodDays: cl['Replacement Period (Days)'] || '90',
        gstPercent: cl['GST %'] || '18',
        contactPerson: cl['Contact Person'] || '',
        contactEmail: cl['Contact Email'] || '',
        contactPhone: cl['Contact Phone'] || '',
        billingAddress: cl['Billing Address'] || '',
        agreementNotes: cl['Agreement Notes'] || '',
        addedOn: cl['Added On'] || '',
        industry: cl['Industry'] || '',
        hiringStatus: cl['Hiring Status'] || 'Open',
        payrollType: cl['Payroll Type'] || 'Novapulse',
        agreement: cl['Agreement'] || 'No',
        clientRank: cl['Client Rank'] || '-',
        gstNo: cl['GST No'] || '',
        secondaryPOCName: cl['Secondary POC Name'] || '',
        secondaryPOCNumber: cl['Secondary POC Number'] || '',
        remarks: cl['Remarks'] || '',
        activeOpeningsCount: openingsCountMap[name] || 0,
        linedUpCount: linedUpMap[name] || 0,
        selectedCount: selectedMap[name] || 0,
        joinedCount: joinedMap[name] || 0
      };
    });
  }

  function generateNextClientId() {
    var clients = SheetRepo.readTable('CLIENT MASTER');
    var maxNum = 0;
    var regex = /^CL-(\d+)$/i;
    for (var i = 0; i < clients.length; i++) {
      var id = clients[i]['Client ID'];
      if (id) {
        var match = regex.exec(id.trim());
        if (match && match[1]) {
          var num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
    }
    return 'CL-' + ('000' + (maxNum + 1)).slice(-3);
  }

  function saveClient(user, clientData) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.CLIENTS_EDIT);
    var clientId = clientData['Client ID'] || clientData.clientId;
    var nowDate = Utils.formatDate(new Date());

    if (clientId) {
      var patch = {};
      for (var k in clientData) {
        if (clientData.hasOwnProperty(k) && !k.startsWith('_')) {
          patch[k] = clientData[k];
        }
      }
      SheetRepo.updateRow('CLIENT MASTER', 'Client ID', clientId, patch);
      return { success: true, clientId: clientId, client: patch };
    } else {
      clientId = generateNextClientId();
      var newClient = {
        'Client ID': clientId,
        'Client Name': clientData['Client Name'] || '',
        'Status': clientData['Status'] || 'Active',
        'Fee Type': clientData['Fee Type'] || 'Percentage',
        'Fee Value': clientData['Fee Value'] || '8.33',
        'Invoice After Joining (Days)': clientData['Invoice After Joining (Days)'] || '30',
        'Replacement Period (Days)': clientData['Replacement Period (Days)'] || '90',
        'GST %': clientData['GST %'] || '18',
        'Contact Person': clientData['Contact Person'] || '',
        'Contact Email': clientData['Contact Email'] || '',
        'Contact Phone': clientData['Contact Phone'] || '',
        'Billing Address': clientData['Billing Address'] || '',
        'Agreement Notes': clientData['Agreement Notes'] || '',
        'Added On': nowDate,
        'Industry': clientData['Industry'] || '',
        'Hiring Status': clientData['Hiring Status'] || 'Open',
        'Payroll Type': clientData['Payroll Type'] || 'Novapulse',
        'Agreement': clientData['Agreement'] || 'No',
        'Client Rank': clientData['Client Rank'] || '-',
        'GST No': clientData['GST No'] || '',
        'Secondary POC Name': clientData['Secondary POC Name'] || '',
        'Secondary POC Number': clientData['Secondary POC Number'] || '',
        'Remarks': clientData['Remarks'] || ''
      };
      SheetRepo.appendRow('CLIENT MASTER', newClient);
      return { success: true, clientId: clientId, client: newClient };
    }
  }

  return {
    listOpenings: listOpenings,
    saveOpening: saveOpening,
    listClients: listClients,
    saveClient: saveClient
  };
})();


/* ==================== MODULE: CandidateService.gs ==================== */

/**
 * NovaPulse Hiring CRM - CandidateService
 * Core candidate management: CRUD, optimistic locking, version increments,
 * role-based data scoping, field-level restrictions, and audit logging.
 */

var CandidateService = (function () {
  /**
   * Auto-increments and returns the next formatted Candidate ID: NP-CAN-000001
   */
  function generateNextCandidateId() {
    var candidates = SheetRepo.readTable('MASTER DATA');
    var maxNum = 0;
    var regex = /^NP-CAN-(\d+)$/i;

    for (var i = 0; i < candidates.length; i++) {
      var id = candidates[i]['Candidate ID'];
      if (id) {
        var match = regex.exec(id.trim());
        if (match && match[1]) {
          var num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }

    var nextNum = maxNum + 1;
    var padded = ('000000' + nextNum).slice(-6);
    return 'NP-CAN-' + padded;
  }

  /**
   * Derive Pipeline Stage from disposition and statuses
   */
  function computePipelineStage(data) {
    var joiningStatus = (data['Joining Status'] || '').trim();
    if (joiningStatus === 'Joined') return 'Joined';
    if (joiningStatus === 'Not Joined' || joiningStatus === 'Dropped') return 'Dropped / Not Joined';

    var selectionStatus = (data['Selection Status'] || '').trim();
    if (selectionStatus === 'Selected') return 'Selected';
    if (selectionStatus === 'Rejected') return 'Rejected';
    if (selectionStatus === 'On Hold') return 'On Hold';

    var interviewStatus = (data['Interview Status'] || '').trim();
    if (interviewStatus === 'Attended') return 'Interview Attended';
    if (interviewStatus === 'Rescheduled') return 'Interview Rescheduled';
    if (interviewStatus === 'Drop After Lineup') return 'Dropped After Lineup';
    if (interviewStatus === 'Pending' || (data['Interview Date'] && data['Interview Date'].trim() !== '')) {
      return 'Interview Scheduled';
    }

    var disposition = (data['Calling Disposition'] || '').trim();
    if (disposition === 'Interview Schedule') return 'Interview Scheduled';
    if (disposition === 'Interested') return 'Interested';
    if (disposition === 'Call Back') return 'Call Back';
    if (disposition === 'Not Interested') return 'Not Interested';
    if (disposition === 'Not Connected') return 'Not Connected';
    if (disposition === 'Not Prospect') return 'Not Prospect';

    var connectStatus = (data['Connect Status'] || '').trim();
    if (connectStatus === 'Connect' || connectStatus === 'Connected') return 'Connected';

    return 'Sourced';
  }

  /**
   * List candidates with RBAC data scoping, filtering, and search
   */
  function listCandidates(user, filters) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.CANDIDATES_VIEW);
    filters = filters || {};

    var scopeObj = PermissionEngine.getCandidateDataScope(user);
    if (scopeObj.scope === 'NONE') {
      return []; // Finance or unauthorized roles see 0 candidate records
    }

    var rows = SheetRepo.readTable('MASTER DATA');

    // 1. Data-Level Scoping:
    // HR_RECRUITER -> only assigned to self
    if (scopeObj.scope === 'SELF') {
      var selfEmail = user.email.toLowerCase();
      rows = rows.filter(function (r) {
        return String(r['HR Email'] || '').trim().toLowerCase() === selfEmail;
      });
    } else if (scopeObj.scope === 'TEAM') {
      // RECRUITMENT_MANAGER -> candidates belonging to mapped team recruiters or manager
      var teamEmails = scopeObj.teamEmails;
      var mgrEmail = user.email.toLowerCase();
      rows = rows.filter(function (r) {
        var hrEmail = String(r['HR Email'] || '').trim().toLowerCase();
        return teamEmails.indexOf(hrEmail) !== -1 || hrEmail === mgrEmail;
      });
    }

    // 2. Default: exclude Inactive/Archived unless explicitly requested
    if (!filters.includeArchived) {
      rows = rows.filter(function (r) {
        var status = String(r['Record Status'] || 'Active').trim().toLowerCase();
        return status !== 'inactive' && status !== 'archived';
      });
    }

    // 3. Search filter
    if (filters.search) {
      var query = String(filters.search).trim().toLowerCase();
      rows = rows.filter(function (r) {
        var id = String(r['Candidate ID'] || '').toLowerCase();
        var name = String(r['Candidate Name'] || '').toLowerCase();
        var mobile = Utils.normalizePhone(r['Mobile Number']);
        var altMobile = Utils.normalizePhone(r['Alternate Mobile']);
        var email = String(r['Email ID'] || '').toLowerCase();
        var client = String(r['Client Name'] || '').toLowerCase();
        var role = String(r['Designation Applied'] || '').toLowerCase();

        return id.indexOf(query) !== -1 ||
          name.indexOf(query) !== -1 ||
          mobile.indexOf(query) !== -1 ||
          altMobile.indexOf(query) !== -1 ||
          email.indexOf(query) !== -1 ||
          client.indexOf(query) !== -1 ||
          role.indexOf(query) !== -1;
      });
    }

    // 4. Facet filters
    if (filters.clientName) {
      rows = rows.filter(function (r) { return r['Client Name'] === filters.clientName; });
    }
    if (filters.assignedHR) {
      rows = rows.filter(function (r) { return r['Assigned HR'] === filters.assignedHR; });
    }
    if (filters.designation) {
      rows = rows.filter(function (r) { return r['Designation Applied'] === filters.designation; });
    }
    if (filters.callingDisposition) {
      rows = rows.filter(function (r) { return r['Calling Disposition'] === filters.callingDisposition; });
    }
    if (filters.interviewStatus) {
      rows = rows.filter(function (r) { return r['Interview Status'] === filters.interviewStatus; });
    }
    if (filters.selectionStatus) {
      rows = rows.filter(function (r) { return r['Selection Status'] === filters.selectionStatus; });
    }
    if (filters.joiningStatus) {
      rows = rows.filter(function (r) { return r['Joining Status'] === filters.joiningStatus; });
    }
    if (filters.pipelineStage) {
      rows = rows.filter(function (r) { return r['Pipeline Stage'] === filters.pipelineStage; });
    }
    if (filters.industry) {
      rows = rows.filter(function (r) { return r['Industry'] === filters.industry; });
    }
    if (filters.source) {
      rows = rows.filter(function (r) { return r['Source'] === filters.source; });
    }

    return rows;
  }

  /**
   * Get candidate details including audit history and interview log
   */
  function getCandidate(user, candidateId) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.CANDIDATES_VIEW);

    var candidate = SheetRepo.findRow('MASTER DATA', 'Candidate ID', candidateId);
    if (!candidate) {
      throw new Error('Candidate not found: ' + candidateId);
    }

    if (!PermissionEngine.canAccessCandidate(user, candidate)) {
      var deniedErr = new Error('Access denied: You do not have permission to view this candidate record.');
      deniedErr.statusCode = 403;
      throw deniedErr;
    }

    // Fetch audit timeline
    var audits = SheetRepo.readTable('AUDIT LOG', {
      filter: function (a) { return a['Candidate ID'] === candidateId; }
    });

    // Fetch interview timeline
    var interviews = SheetRepo.readTable('INTERVIEW LOG', {
      filter: function (i) { return i['Candidate ID'] === candidateId; }
    });

    // Fetch reschedule tracker
    var reschedule = SheetRepo.findRow('RESCHEDULE TRACKER', 'Candidate ID', candidateId);

    // Fetch joining tracker if joined
    var joining = SheetRepo.findRow('JOINING TRACKER', 'Candidate ID', candidateId);

    return {
      candidate: candidate,
      audits: audits,
      interviews: interviews,
      reschedule: reschedule,
      joining: joining
    };
  }

  /**
   * Add a new candidate
   * Rule: HR_RECRUITER -> LEAD APPROVALS (Status = Pending)
   *       RECRUITMENT_MANAGER / ADMIN / SUPER_ADMIN -> MASTER DATA directly
   *       Duplicate override requires DUPLICATES_OVERRIDE permission
   */
  function createCandidate(user, data, allowDuplicateOverride) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.CANDIDATES_CREATE);

    // 1. Live duplicate check
    var dupResult = DuplicateService.checkDuplicates(data, user, true);
    if (dupResult.isDuplicate) {
      if (allowDuplicateOverride) {
        // Assert duplicate override permission
        PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.DUPLICATES_OVERRIDE);
      } else {
        return {
          success: false,
          isDuplicate: true,
          matches: dupResult.matches,
          message: 'Duplicate candidate detected on phone/email.'
        };
      }
    }

    // 2. HR submission -> LEAD APPROVALS
    if (user.role === 'HR_RECRUITER') {
      return LeadService.submitLead(user, data, dupResult.isDuplicate ? dupResult.matches[0].matchedCandidateId : '');
    }

    // 3. Direct creation for RECRUITMENT_MANAGER, ADMIN, SUPER_ADMIN
    var candidateId = generateNextCandidateId();
    var nowTimestamp = Utils.formatDateTime(new Date());
    var nowDate = Utils.formatDate(new Date());

    var assignedHR = data['Assigned HR'] || user.name || '';
    var hrEmail = data['HR Email'] || user.email || '';

    // If manager, verify assigned HR belongs to their team or self
    if (user.role === 'RECRUITMENT_MANAGER') {
      var team = user.teamRecruiterEmails || [];
      if (hrEmail && hrEmail.toLowerCase() !== user.email.toLowerCase() && team.indexOf(hrEmail.toLowerCase()) === -1) {
        throw new Error('Forbidden: You can only assign candidates to recruiters within your team.');
      }
    }

    var candidateRecord = {
      'Candidate ID': candidateId,
      'Entry Date': data['Entry Date'] ? Utils.formatDate(data['Entry Date']) : nowDate,
      'Candidate Name': data['Candidate Name'] || '',
      'Mobile Number': String(data['Mobile Number'] || '').replace(/'/g, ''),
      'Alternate Mobile': String(data['Alternate Mobile'] || '').replace(/'/g, ''),
      'Email ID': data['Email ID'] || '',
      'Designation Applied': data['Designation Applied'] || '',
      'Current Location': data['Current Location'] || '',
      'Experience': data['Experience'] || '',
      'Current Salary': data['Current Salary'] || '',
      'Expected Salary': data['Expected Salary'] || '',
      'Notice Period': data['Notice Period'] || '',
      'Source': data['Source'] || '',
      'Client Name': data['Client Name'] || '',
      'Assigned HR': assignedHR,
      'HR Email': hrEmail,
      'Connect Status': data['Connect Status'] || 'Not Connected',
      'Calling Disposition': data['Calling Disposition'] || '',
      'Sub-Disposition': data['Sub-Disposition'] || '',
      'Call Status': data['Call Status'] || '',
      'Interview Status': data['Interview Status'] || '',
      'Interview Date': data['Interview Date'] ? Utils.formatDate(data['Interview Date']) : '',
      'Selection Status': data['Selection Status'] || '',
      'Joining Status': data['Joining Status'] || '',
      'Joining Date': data['Joining Date'] ? Utils.formatDate(data['Joining Date']) : '',
      'Remarks': data['Remarks'] || '',
      'Created By': user.email,
      'Last Updated': nowTimestamp,
      'Last Updated By': user.email,
      'Record Version': 1,
      'Pipeline Stage': computePipelineStage(data),
      'Duplicate Of': (dupResult.isDuplicate && dupResult.matches.length > 0) ? dupResult.matches[0].matchedCandidateId : '',
      'Record Status': 'Active',
      'Industry': data['Industry'] || ''
    };

    SheetRepo.appendRow('MASTER DATA', candidateRecord);
    AuditService.logAction(candidateId, candidateRecord['Candidate Name'], 'CREATE', user, candidateRecord['Assigned HR']);

    if (candidateRecord['Interview Date']) {
      InterviewService.recordInterviewChange(candidateRecord, candidateRecord['Interview Date'], '', user);
    }

    return {
      success: true,
      candidateId: candidateId,
      candidate: candidateRecord
    };
  }

  /**
   * Update candidate with optimistic locking and field-level permissions
   */
  function updateCandidate(user, candidateId, patch, clientRecordVersion) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.CANDIDATES_EDIT);

    var existing = SheetRepo.findRow('MASTER DATA', 'Candidate ID', candidateId);
    if (!existing) {
      throw new Error('Candidate not found: ' + candidateId);
    }

    // Scoping check
    if (!PermissionEngine.canAccessCandidate(user, existing)) {
      var deniedErr = new Error('Forbidden: You can only edit candidates within your assigned scope.');
      deniedErr.statusCode = 403;
      throw deniedErr;
    }

    // Field-level permission validation
    PermissionEngine.validateEditableFields(user, patch, AuthService.getHrEditableFields());

    // Optimistic Locking Check
    if (clientRecordVersion !== undefined && clientRecordVersion !== null) {
      var currentVersionStr = String(existing['Record Version'] || '1').trim();
      var clientVersionStr = String(clientRecordVersion).trim();
      if (currentVersionStr !== clientVersionStr) {
        var err = new Error('This record was updated by someone else — reload');
        err.statusCode = 409;
        throw err;
      }
    }

    var nextVersion = (parseInt(existing['Record Version'], 10) || 1) + 1;
    var nowTimestamp = Utils.formatDateTime(new Date());

    // Prepare patch with metadata
    var appliedPatch = {};
    for (var p in patch) {
      if (patch.hasOwnProperty(p) && !p.startsWith('_')) {
        appliedPatch[p] = patch[p];
      }
    }

    // Format dates in patch if provided
    if (appliedPatch['Interview Date']) {
      appliedPatch['Interview Date'] = Utils.formatDate(appliedPatch['Interview Date']);
    }
    if (appliedPatch['Joining Date']) {
      appliedPatch['Joining Date'] = Utils.formatDate(appliedPatch['Joining Date']);
    }

    appliedPatch['Record Version'] = nextVersion;
    appliedPatch['Last Updated'] = nowTimestamp;
    appliedPatch['Last Updated By'] = user.email;

    // Recalculate pipeline stage if relevant fields changed
    var mergedData = {};
    for (var k in existing) { mergedData[k] = existing[k]; }
    for (var m in appliedPatch) { mergedData[m] = appliedPatch[m]; }
    appliedPatch['Pipeline Stage'] = computePipelineStage(mergedData);

    // Perform atomic update
    SheetRepo.updateRow('MASTER DATA', 'Candidate ID', candidateId, appliedPatch);

    // Log changes to AUDIT LOG
    AuditService.logChanges(candidateId, existing['Candidate Name'], existing, appliedPatch, user, existing['Assigned HR']);

    // Trigger Interview Service if Interview Date changed
    if (appliedPatch['Interview Date'] && appliedPatch['Interview Date'] !== existing['Interview Date']) {
      InterviewService.recordInterviewChange(mergedData, appliedPatch['Interview Date'], existing['Interview Date'], user);
    }

    // Trigger Joining Service if Joining Status changed to Joined
    if (appliedPatch['Joining Status'] === 'Joined' && (existing['Joining Status'] !== 'Joined' || !SheetRepo.findRow('JOINING TRACKER', 'Candidate ID', candidateId))) {
      JoiningService.recordJoining(mergedData, user);
    }

    return {
      success: true,
      candidateId: candidateId,
      newVersion: nextVersion,
      updatedCandidate: mergedData
    };
  }

  /**
   * Bulk actions: Reassign HR, Archive
   */
  function bulkAction(user, actionType, candidateIds, payload) {
    if (!candidateIds || candidateIds.length === 0) {
      throw new Error('No candidate IDs provided for bulk action.');
    }

    if (actionType === 'REASSIGN_HR') {
      PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.CANDIDATES_REASSIGN);
    } else if (actionType === 'ARCHIVE') {
      PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.CANDIDATES_ARCHIVE);
    } else {
      PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.CANDIDATES_EDIT);
    }

    var results = [];
    for (var i = 0; i < candidateIds.length; i++) {
      var id = candidateIds[i];
      try {
        var patch = {};
        if (actionType === 'REASSIGN_HR') {
          patch['Assigned HR'] = payload.assignedHR;
          patch['HR Email'] = payload.hrEmail;
        } else if (actionType === 'CHANGE_CLIENT') {
          patch['Client Name'] = payload.clientName;
        } else if (actionType === 'ARCHIVE') {
          patch['Record Status'] = 'Archived';
        }

        updateCandidate(user, id, patch, null);
        results.push({ candidateId: id, success: true });
      } catch (e) {
        results.push({ candidateId: id, success: false, error: e.message });
      }
    }

    return { success: true, results: results };
  }

  return {
    generateNextCandidateId: generateNextCandidateId,
    computePipelineStage: computePipelineStage,
    listCandidates: listCandidates,
    getCandidate: getCandidate,
    createCandidate: createCandidate,
    updateCandidate: updateCandidate,
    bulkAction: bulkAction
  };
})();


/* ==================== MODULE: DashboardService.gs ==================== */

/**
 * NovaPulse Hiring CRM - DashboardService
 * Computes recruitment funnels, leaderboards, revenue metrics,
 * and calling analytics directly from raw tabs.
 */

var DashboardService = (function () {
  function getDashboardMetrics(user, monthFilter) {
    var candidates = SheetRepo.readTable('MASTER DATA');
    var joinings = SheetRepo.readTable('JOINING TRACKER');
    var rescheduleRows = SheetRepo.readTable('RESCHEDULE TRACKER');

    var now = new Date();
    var currentMonthStr = Utilities.formatDate(now, Utils.TIMEZONE, 'MMM-yyyy');
    var targetMonthStr = monthFilter || currentMonthStr;

    // Filter by HR if role is HR
    var isHR = (user.role === 'HR');
    var hrEmailLower = user.email.toLowerCase();

    if (isHR) {
      candidates = candidates.filter(function (c) {
        return String(c['HR Email'] || '').toLowerCase() === hrEmailLower;
      });
      joinings = joinings.filter(function (j) {
        return String(j['Assigned HR'] || '').toLowerCase() === user.name.toLowerCase();
      });
    }

    // Active records only
    candidates = candidates.filter(function (c) {
      var s = String(c['Record Status'] || 'Active').toLowerCase();
      return s !== 'inactive' && s !== 'archived';
    });

    // Funnel counts
    var funnel = {
      sourced: 0,
      connected: 0,
      interested: 0,
      interviewScheduled: 0,
      interviewAttended: 0,
      selected: 0,
      joined: 0
    };

    var todayStr = Utils.formatDate(now);
    var callsToday = 0;
    var interviewsToday = 0;
    var interviewsThisWeek = 0;
    var selectionsThisMonth = 0;
    var joiningsThisMonth = 0;

    var dropReasons = {};
    var clientCounts = {};
    var sourceCounts = {};
    var hrStats = {};

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      funnel.sourced++;

      var connect = c['Connect Status'] || '';
      var disp = c['Calling Disposition'] || '';
      var subDisp = c['Sub-Disposition'] || '';
      var intStatus = c['Interview Status'] || '';
      var intDateStr = c['Interview Date'] || '';
      var selStatus = c['Selection Status'] || '';
      var joinStatus = c['Joining Status'] || '';
      var joinDateStr = c['Joining Date'] || '';
      var hrName = c['Assigned HR'] || 'Unassigned';
      var client = c['Client Name'] || 'Unassigned';
      var source = c['Source'] || 'Other';
      var lastUpdated = c['Last Updated'] || '';

      // Tally HR stats
      if (!hrStats[hrName]) {
        hrStats[hrName] = {
          hrName: hrName,
          sourced: 0,
          connected: 0,
          interviews: 0,
          selected: 0,
          joined: 0
        };
      }
      hrStats[hrName].sourced++;

      // Connected
      if (connect === 'Connect' || connect === 'Connected' || disp || intDateStr || selStatus || joinStatus) {
        funnel.connected++;
        hrStats[hrName].connected++;
      }

      // Interested
      if (disp === 'Interested' || disp === 'Interview Schedule' || intDateStr || selStatus || joinStatus) {
        funnel.interested++;
      }

      // Interview Scheduled
      if (intDateStr && intDateStr.trim() !== '' && intDateStr.trim() !== '-') {
        funnel.interviewScheduled++;
        hrStats[hrName].interviews++;

        var iDate = new Date(intDateStr);
        iDate.setHours(0, 0, 0, 0);
        var diffDays = Math.round((iDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) interviewsToday++;
        if (diffDays >= 0 && diffDays <= 7) interviewsThisWeek++;
      }

      // Interview Attended
      if (intStatus === 'Attended' || selStatus || joinStatus) {
        funnel.interviewAttended++;
      }

      // Selected
      if (selStatus === 'Selected') {
        funnel.selected++;
        hrStats[hrName].selected++;
        selectionsThisMonth++;
      }

      // Joined
      if (joinStatus === 'Joined') {
        funnel.joined++;
        hrStats[hrName].joined++;
        joiningsThisMonth++;
      }

      // Calls today
      if (lastUpdated && lastUpdated.indexOf(todayStr) === 0) {
        callsToday++;
      }

      // Drop reasons
      if (disp === 'Not Interested' || disp === 'Not Connected' || intStatus === 'Drop After Lineup') {
        var reason = subDisp || disp || 'Unknown';
        dropReasons[reason] = (dropReasons[reason] || 0) + 1;
      }

      // Client distribution
      if (client) {
        clientCounts[client] = (clientCounts[client] || 0) + 1;
      }

      // Source distribution
      if (source) {
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      }
    }

    // Revenue calculations from JOINING TRACKER
    var totalRevenue = 0;
    var pendingInvoiceAmount = 0;
    var receivedRevenue = 0;

    for (var j = 0; j < joinings.length; j++) {
      var amount = parseFloat(joinings[j]['Invoice Amount']) || 0;
      var invStatus = String(joinings[j]['Invoice Status'] || '').toLowerCase();
      totalRevenue += amount;
      if (invStatus === 'paid') {
        receivedRevenue += amount;
      } else {
        pendingInvoiceAmount += amount;
      }
    }

    // Conversion rates
    var conversionRates = {
      sourcedToConnected: funnel.sourced ? Math.round((funnel.connected / funnel.sourced) * 100) : 0,
      connectedToInterested: funnel.connected ? Math.round((funnel.interested / funnel.connected) * 100) : 0,
      interestedToInterview: funnel.interested ? Math.round((funnel.interviewScheduled / funnel.interested) * 100) : 0,
      interviewToAttended: funnel.interviewScheduled ? Math.round((funnel.interviewAttended / funnel.interviewScheduled) * 100) : 0,
      attendedToSelected: funnel.interviewAttended ? Math.round((funnel.selected / funnel.interviewAttended) * 100) : 0,
      selectedToJoined: funnel.selected ? Math.round((funnel.joined / funnel.selected) * 100) : 0,
      overallConversion: funnel.sourced ? Math.round((funnel.joined / funnel.sourced) * 100 * 10) / 10 : 0
    };

    // Convert objects to sorted arrays
    var leaderboard = [];
    for (var hr in hrStats) {
      leaderboard.push(hrStats[hr]);
    }
    leaderboard.sort(function (a, b) { return b.joined - a.joined || b.interviews - a.interviews; });

    var dropReasonsList = [];
    for (var r in dropReasons) {
      dropReasonsList.push({ reason: r, count: dropReasons[r] });
    }
    dropReasonsList.sort(function (a, b) { return b.count - a.count; });

    var clientBreakdown = [];
    for (var cl in clientCounts) {
      clientBreakdown.push({ client: cl, count: clientCounts[cl] });
    }
    clientBreakdown.sort(function (a, b) { return b.count - a.count; });

    var sourceBreakdown = [];
    for (var s in sourceCounts) {
      sourceBreakdown.push({ source: s, count: sourceCounts[s] });
    }
    sourceBreakdown.sort(function (a, b) { return b.count - a.count; });

    return {
      funnel: funnel,
      conversionRates: conversionRates,
      quickStats: {
        totalCandidates: candidates.length,
        callsToday: callsToday,
        interviewsToday: interviewsToday,
        interviewsThisWeek: interviewsThisWeek,
        selectionsThisMonth: selectionsThisMonth,
        joiningsThisMonth: joiningsThisMonth,
        totalRevenue: totalRevenue,
        pendingInvoiceAmount: pendingInvoiceAmount,
        receivedRevenue: receivedRevenue
      },
      leaderboard: leaderboard,
      dropReasons: dropReasonsList,
      clientBreakdown: clientBreakdown.slice(0, 10),
      sourceBreakdown: sourceBreakdown
    };
  }

  return {
    getDashboardMetrics: getDashboardMetrics
  };
})();


/* ==================== MODULE: AdminService.gs ==================== */

/**
 * NovaPulse Hiring CRM - AdminService
 * Handles HR Registry management, Dropdown lists, system queue viewing,
 * duplicate review processing, and Super Admin RBAC management.
 */

var AdminService = (function () {
  // HR Registry
  function listHRs(user) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.HR_REGISTRY_MANAGE);
    return SheetRepo.readTable('HR REGISTRY');
  }

  function generateNextHRId() {
    var hrs = SheetRepo.readTable('HR REGISTRY');
    var maxNum = 0;
    var regex = /^NP-HR-(\d+)$/i;
    for (var i = 0; i < hrs.length; i++) {
      var id = hrs[i]['HR ID'];
      if (id) {
        var m = regex.exec(id.trim());
        if (m && m[1]) {
          var num = parseInt(m[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
    }
    return 'NP-HR-' + ('000' + (maxNum + 1)).slice(-3);
  }

  function addHR(user, hrData) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.HR_REGISTRY_MANAGE);
    var hrEmail = String(hrData.hrEmail || hrData['HR Email'] || '').trim().toLowerCase();
    if (!hrEmail) throw new Error('HR Email is required');

    var hrId = generateNextHRId();
    var nowDate = Utils.formatDateTime(new Date());

    var newHR = {
      'HR ID': hrId,
      'HR Name': hrData.hrName || hrData['HR Name'] || '',
      'HR Email': hrEmail,
      'HR Spreadsheet ID': '',
      'HR Spreadsheet URL': '',
      'Active Status': 'Active',
      'Registration Date': nowDate,
      'Last Sync': '',
      'Assigned Candidate Count': '0',
      'Sharing Status': 'PENDING_INVITE',
      'Sync Mode': 'EDIT TRIGGER'
    };

    SheetRepo.appendRow('HR REGISTRY', newHR);
    AuditService.logAction(hrId, newHR['HR Name'], 'ADD_HR', user, hrEmail);
    return { success: true, hr: newHR };
  }

  function toggleHRStatus(user, hrId, newStatus) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.HR_REGISTRY_MANAGE);
    var statusVal = (String(newStatus).toLowerCase() === 'active') ? 'Active' : 'Inactive';
    SheetRepo.updateRow('HR REGISTRY', 'HR ID', hrId, { 'Active Status': statusVal });
    AuditService.logAction(hrId, 'HR_STATUS', 'TOGGLE_HR_STATUS', user, statusVal);
    return { success: true, hrId: hrId, status: statusVal };
  }

  // Dropdown Lists
  function listDropdowns() {
    var rows = SheetRepo.readTable('DROPDOWN LISTS');
    var activeOnly = rows.filter(function (r) {
      return String(r['Active']).toUpperCase() === 'TRUE';
    });

    // Group options by List
    var grouped = {};
    for (var i = 0; i < activeOnly.length; i++) {
      var listName = activeOnly[i]['List'];
      if (!grouped[listName]) grouped[listName] = [];
      grouped[listName].push(activeOnly[i]);
    }

    return { all: rows, grouped: grouped };
  }

  function addDropdownOption(user, listName, option, parentDisp, callStatus) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.SETTINGS_MANAGE);
    var newRow = {
      'List': listName,
      'Option': option,
      'Parent Disposition': parentDisp || '',
      'Call Status': callStatus || '',
      'Active': 'TRUE',
      'System': 'FALSE'
    };
    SheetRepo.appendRow('DROPDOWN LISTS', newRow);
    AuditService.logAction('DROPDOWN', listName, 'ADD_OPTION', user, option);
    return { success: true, option: newRow };
  }

  function toggleDropdownOption(user, listName, option, activeState) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.SETTINGS_MANAGE);
    var rows = SheetRepo.readTable('DROPDOWN LISTS');
    var target = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i]['List'] === listName && rows[i]['Option'] === option) {
        target = rows[i];
        break;
      }
    }
    if (!target) throw new Error('Dropdown option not found');
    if (String(target['System']).toUpperCase() === 'TRUE' && !activeState) {
      throw new Error('System options cannot be deactivated.');
    }

    var sheet = SheetRepo.getSheet('DROPDOWN LISTS');
    var headerInfo = SheetRepo.getHeaderMap(sheet, 'DROPDOWN LISTS');
    var activeCol = headerInfo.map['Active'];
    sheet.getRange(target._rowIndex, activeCol).setValue(activeState ? 'TRUE' : 'FALSE');

    AuditService.logAction('DROPDOWN', listName, 'TOGGLE_OPTION', user, option + ' -> ' + (activeState ? 'TRUE' : 'FALSE'));
    return { success: true, list: listName, option: option, active: activeState };
  }

  // System Queues & Logs Viewer
  function getSystemLogs(user, logType, limit) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.AUDIT_LOGS_VIEW);
    limit = limit || 200;

    if (logType === 'AUDIT_LOG') {
      return SheetRepo.readTable('AUDIT LOG', { limit: limit });
    } else if (logType === 'DUPLICATE_LOG') {
      return SheetRepo.readTable('DUPLICATE LOG', { limit: limit });
    } else if (logType === 'SYNC_QUEUE') {
      return SheetRepo.readTable('SYNC QUEUE', { limit: limit });
    } else if (logType === 'CONFLICT_QUEUE') {
      return SheetRepo.readTable('CONFLICT QUEUE', { limit: limit });
    } else if (logType === 'SYNC_LOG') {
      return SheetRepo.readTable('SYNC LOG', { limit: limit });
    }
    throw new Error('Unknown log type: ' + logType);
  }

  function reviewDuplicate(user, timestamp, incomingCandidateId, decision, notes) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.DUPLICATES_OVERRIDE);
    var rows = SheetRepo.readTable('DUPLICATE LOG');
    var target = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i]['Timestamp'] === timestamp && rows[i]['Candidate ID (new/incoming)'] === incomingCandidateId) {
        target = rows[i];
        break;
      }
    }
    if (!target) throw new Error('Duplicate log entry not found');

    var sheet = SheetRepo.getSheet('DUPLICATE LOG');
    var headerInfo = SheetRepo.getHeaderMap(sheet, 'DUPLICATE LOG');
    var nowStr = Utils.formatDate(new Date());

    if (headerInfo.map['Decision']) sheet.getRange(target._rowIndex, headerInfo.map['Decision']).setValue(decision);
    if (headerInfo.map['Reviewed By']) sheet.getRange(target._rowIndex, headerInfo.map['Reviewed By']).setValue(user.email);
    if (headerInfo.map['Review Date']) sheet.getRange(target._rowIndex, headerInfo.map['Review Date']).setValue(nowStr);
    if (headerInfo.map['Notes'] && notes) sheet.getRange(target._rowIndex, headerInfo.map['Notes']).setValue(notes);

    AuditService.logAction(incomingCandidateId, 'DUPLICATE_REVIEW', decision, user, notes || '');
    return { success: true };
  }

  // ================= RBAC MANAGEMENT (SUPER_ADMIN ONLY) =================

  function getRBACOverview(user) {
    if (!PermissionEngine.hasPermission(user, PermissionEngine.PERMISSIONS.RBAC_MANAGE) &&
        !PermissionEngine.hasPermission(user, PermissionEngine.PERMISSIONS.USERS_PASSWORD_MANAGE)) {
      throw new Error('Forbidden: RBAC or User Management permission required.');
    }

    var config = AuthService.getConfigurationMap();
    var superAdmins = AuthService.getSuperAdminEmails();
    var admins = AuthService.getManagementEmails();
    var managers = AuthService.getRecruitmentManagerEmails();
    var finance = AuthService.getFinanceEmails();
    var teamMapping = AuthService.getManagerTeamMapping();
    var hrRegistry = SheetRepo.readTable('HR REGISTRY');

    // Read from USERS table as primary source of truth
    var userRows = SheetRepo.readTable('USERS');
    var userList = [];
    var nowMs = Date.now();

    if (userRows && userRows.length > 0) {
      for (var u = 0; u < userRows.length; u++) {
        var r = userRows[u];
        var em = String(r['email'] || '').trim().toLowerCase();
        var lockUntil = r['locked_until'] || '';
        var isLocked = false;
        if (lockUntil) {
          isLocked = (new Date(lockUntil).getTime() > nowMs);
        }

        userList.push({
          user_id: r['user_id'] || '',
          email: em,
          name: r['name'] || r['user_id'] || em.split('@')[0],
          role: r['role'] || 'DENIED',
          status: r['status'] || 'Active',
          must_change_password: String(r['must_change_password']).toUpperCase() === 'TRUE',
          failed_attempts: parseInt(r['failed_attempts'], 10) || 0,
          locked_until: lockUntil,
          isLocked: isLocked,
          last_login: r['last_login'] || '',
          password_updated_at: r['password_updated_at'] || '',
          password_updated_by: r['password_updated_by'] || '',
          teamRecruiterEmails: teamMapping[em] || []
        });
      }
    } else {
      // Fallback: Aggregate from CONFIGURATION and HR REGISTRY
      var usersMap = {};
      function addUser(email, role, name, status) {
        var clean = String(email).trim().toLowerCase();
        if (!clean) return;
        if (!usersMap[clean]) {
          usersMap[clean] = {
            user_id: clean.split('@')[0],
            email: clean,
            name: name || clean.split('@')[0],
            role: role,
            status: status || 'Active',
            must_change_password: false,
            failed_attempts: 0,
            locked_until: '',
            isLocked: false,
            teamRecruiterEmails: teamMapping[clean] || []
          };
        }
      }

      superAdmins.forEach(function (e) { addUser(e, 'SUPER_ADMIN', 'Super Admin'); });
      admins.forEach(function (e) { addUser(e, 'ADMIN', 'Management Admin'); });
      managers.forEach(function (e) { addUser(e, 'RECRUITMENT_MANAGER', 'Recruitment Manager'); });
      finance.forEach(function (e) { addUser(e, 'FINANCE', 'Finance Executive'); });

      hrRegistry.forEach(function (hr) {
        var email = (hr['HR Email'] || '').trim().toLowerCase();
        var active = (hr['Active Status'] || '').toLowerCase() === 'active' ? 'Active' : 'Inactive';
        if (!usersMap[email]) {
          addUser(email, 'HR_RECRUITER', hr['HR Name'], active);
        } else {
          usersMap[email].name = hr['HR Name'] || usersMap[email].name;
        }
      });

      for (var k in usersMap) {
        userList.push(usersMap[k]);
      }
    }

    return {
      users: userList,
      rolePermissions: PermissionEngine.ROLE_PERMISSIONS,
      allPermissions: PermissionEngine.PERMISSIONS,
      teamMapping: teamMapping,
      rbacEnabled: AuthService.isRbacEnabled()
    };
  }

  function updateUserRole(user, targetEmail, newRole) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.RBAC_MANAGE);
    var cleanEmail = String(targetEmail).trim().toLowerCase();

    // Prevent changing the primary root Super Admin
    if (cleanEmail === 'novapulse739@gmail.com') {
      throw new Error('Forbidden: Root Super Admin account cannot be modified.');
    }

    var validRoles = ['SUPER_ADMIN', 'ADMIN', 'RECRUITMENT_MANAGER', 'HR_RECRUITER', 'FINANCE', 'DENIED'];
    if (validRoles.indexOf(newRole) === -1) {
      throw new Error('Invalid role: ' + newRole);
    }

    var superAdmins = AuthService.getSuperAdminEmails().filter(function (e) { return e !== cleanEmail; });
    var admins = AuthService.getManagementEmails().filter(function (e) { return e !== cleanEmail; });
    var managers = AuthService.getRecruitmentManagerEmails().filter(function (e) { return e !== cleanEmail; });
    var finance = AuthService.getFinanceEmails().filter(function (e) { return e !== cleanEmail; });

    if (newRole === 'SUPER_ADMIN') {
      superAdmins.push(cleanEmail);
    } else if (newRole === 'ADMIN') {
      admins.push(cleanEmail);
    } else if (newRole === 'RECRUITMENT_MANAGER') {
      managers.push(cleanEmail);
    } else if (newRole === 'FINANCE') {
      finance.push(cleanEmail);
    }

    AuthService.setConfigurationKey('SUPER_ADMIN_EMAILS', superAdmins.join(', '));
    AuthService.setConfigurationKey('MANAGEMENT_EMAILS', admins.join(', '));
    AuthService.setConfigurationKey('RECRUITMENT_MANAGER_EMAILS', managers.join(', '));
    AuthService.setConfigurationKey('FINANCE_EMAILS', finance.join(', '));

    try {
      SheetRepo.updateRow('USERS', 'email', cleanEmail, { 'role': newRole });
    } catch (ue) {
      // ignore if user not in USERS sheet yet
    }

    AuditService.logAction('RBAC', cleanEmail, 'CHANGE_USER_ROLE', user, 'New Role: ' + newRole);

    return {
      success: true,
      email: cleanEmail,
      newRole: newRole
    };
  }

  function updateTeamMapping(user, managerEmail, teamRecruiterEmails) {
    PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.RBAC_MANAGE);
    var cleanMgr = String(managerEmail).trim().toLowerCase();
    var currentMapping = AuthService.getManagerTeamMapping();

    currentMapping[cleanMgr] = (teamRecruiterEmails || []).map(function (e) {
      return String(e).trim().toLowerCase();
    });

    var serialized = JSON.stringify(currentMapping);
    AuthService.setConfigurationKey('MANAGER_TEAM_MAPPING', serialized);

    AuditService.logAction('RBAC', cleanMgr, 'UPDATE_TEAM_MAPPING', user, serialized);

    return {
      success: true,
      managerEmail: cleanMgr,
      teamRecruiterEmails: currentMapping[cleanMgr]
    };
  }

  return {
    listHRs: listHRs,
    addHR: addHR,
    toggleHRStatus: toggleHRStatus,
    listDropdowns: listDropdowns,
    addDropdownOption: addDropdownOption,
    toggleDropdownOption: toggleDropdownOption,
    getSystemLogs: getSystemLogs,
    reviewDuplicate: reviewDuplicate,
    getRBACOverview: getRBACOverview,
    updateUserRole: updateUserRole,
    updateTeamMapping: updateTeamMapping
  };
})();


/* ==================== MODULE: Code.gs ==================== */

/**
 * NovaPulse Hiring CRM - Code.gs
 * Main entry point for Google Apps Script Web App (doGet / doPost).
 * Provides secure JSON API endpoints, LockService serialization for writes,
 * centralized RBAC enforcement, and CacheService for read caching.
 */

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'ping';

    if (action === 'ping') {
      return jsonResponse({ status: 'ok', service: 'NovaPulse CRM API', timestamp: new Date().toISOString() });
    }

    if (action === 'verifySession') {
      var session = AuthService.verifySessionToken(params.token);
      if (!session) {
        return jsonResponse({ success: false, error: 'Session expired or invalid' }, 401);
      }
      var sessUser = AuthService.resolveUser(session.email);
      return jsonResponse({ success: true, user: sessUser });
    }

    // Resolve user server-side
    var userEmail = params.userEmail || (Session.getActiveUser() ? Session.getActiveUser().getEmail() : '');
    var user = AuthService.resolveUser(userEmail);

    if (action === 'auth') {
      return jsonResponse({ success: true, user: user });
    }

    if (!user.authenticated) {
      return jsonResponse({ success: false, error: 'Unauthorized: ' + (user.error || 'User not recognized') }, 401);
    }

    // Cache key for read caching (60s)
    var cacheKey = 'NP_' + user.role + '_' + action + '_' + Utilities.base64Encode(JSON.stringify(params));
    var cache = CacheService.getScriptCache();
    var cached = cache.get(cacheKey);
    if (cached && !params.nocache) {
      return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
    }

    var result = {};

    switch (action) {
      case 'getBootstrap':
        result = {
          user: user,
          dropdowns: AdminService.listDropdowns().grouped,
          config: AuthService.getConfigurationMap()
        };
        break;

      case 'getCandidates':
        result = { candidates: CandidateService.listCandidates(user, params) };
        break;

      case 'getCandidate':
        if (!params.candidateId) throw new Error('Missing candidateId');
        result = CandidateService.getCandidate(user, params.candidateId);
        break;

      case 'getOpenings':
        PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.OPENINGS_VIEW);
        result = { openings: OpeningsClientsService.listOpenings(params) };
        break;

      case 'getClients':
        PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.CLIENTS_VIEW);
        result = { clients: OpeningsClientsService.listClients() };
        break;

      case 'getInterviews':
        PermissionEngine.assertPermission(user, PermissionEngine.PERMISSIONS.INTERVIEWS_VIEW);
        result = { interviews: InterviewService.getInterviewsList(user, params) };
        break;

      case 'getJoinings':
        result = { joinings: JoiningService.getJoiningsList(user) };
        break;

      case 'getLeads':
        result = { leads: LeadService.getLeadsList(user, params.status) };
        break;

      case 'getDashboard':
        result = DashboardService.getDashboardMetrics(user, params.month);
        break;

      case 'getHRs':
        result = { hrs: AdminService.listHRs(user) };
        break;

      case 'getDropdowns':
        result = AdminService.listDropdowns();
        break;

      case 'getLogs':
        result = { logs: AdminService.getSystemLogs(user, params.logType, parseInt(params.limit, 10) || 100) };
        break;

      case 'getRBAC':
        result = AdminService.getRBACOverview(user);
        break;

      default:
        throw new Error('Unknown GET action: ' + action);
    }

    var outputJson = JSON.stringify({ success: true, data: result });
    // Cache for 60 seconds
    try {
      if (outputJson.length < 100000) {
        cache.put(cacheKey, outputJson, 60);
      }
    } catch (ce) {
      // ignore cache put errors for large responses
    }

    return ContentService.createTextOutput(outputJson).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      statusCode: error.statusCode || 500
    }, error.statusCode || 500);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Acquire lock for thread-safe serialized write operations (timeout 30s)
    lock.waitLock(30000);

    var body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (pe) {
        throw new Error('Malformed JSON body: ' + pe.message);
      }
    }

    var action = (e && e.parameter && e.parameter.action) || body.action;

    // Public / Pre-auth action: login
    if (action === 'login') {
      var loginResult = AuthService.login(body.identifier || body.username || body.email, body.password, body.rememberMe);
      return jsonResponse(loginResult, loginResult.success ? 200 : 401);
    }

    var userEmail = (e && e.parameter && e.parameter.userEmail) || body.userEmail || (Session.getActiveUser() ? Session.getActiveUser().getEmail() : '');

    var user = AuthService.resolveUser(userEmail);
    if (!user.authenticated) {
      return jsonResponse({ success: false, error: 'Unauthorized: ' + (user.error || 'Access denied') }, 401);
    }

    var result = {};

    switch (action) {
      case 'changePassword':
        result = AuthService.changePassword(user, body.oldPassword, body.newPassword);
        break;

      case 'adminResetPassword':
        result = AuthService.adminResetPassword(user, body.targetEmail, body.temporaryPassword);
        break;

      case 'adminUnlockAccount':
        result = AuthService.adminUnlockAccount(user, body.targetEmail);
        break;

      case 'adminToggleUserStatus':
        result = AuthService.adminToggleUserStatus(user, body.targetEmail, body.newStatus);
        break;

      case 'createCandidate':
        result = CandidateService.createCandidate(user, body.candidateData || body, body.allowDuplicateOverride || false);
        break;

      case 'updateCandidate':
        if (!body.candidateId) throw new Error('Missing candidateId');
        result = CandidateService.updateCandidate(user, body.candidateId, body.patch, body.recordVersion);
        break;

      case 'bulkCandidateAction':
        result = CandidateService.bulkAction(user, body.actionType, body.candidateIds, body.payload);
        break;

      case 'checkDuplicate':
        result = DuplicateService.checkDuplicates(body.candidateData || body, user, false);
        break;

      case 'submitLead':
        result = LeadService.submitLead(user, body.leadData || body, body.duplicateOf);
        break;

      case 'approveLead':
        if (!body.leadId) throw new Error('Missing leadId');
        result = LeadService.approveLead(user, body.leadId, body.assignToHR, body.adminNote);
        break;

      case 'rejectLead':
        if (!body.leadId) throw new Error('Missing leadId');
        result = LeadService.rejectLead(user, body.leadId, body.adminNote);
        break;

      case 'mergeLead':
        if (!body.leadId || !body.targetCandidateId) throw new Error('Missing leadId or targetCandidateId');
        result = LeadService.mergeLead(user, body.leadId, body.targetCandidateId, body.adminNote);
        break;

      case 'saveOpening':
        result = OpeningsClientsService.saveOpening(user, body.openingData || body);
        break;

      case 'saveClient':
        result = OpeningsClientsService.saveClient(user, body.clientData || body);
        break;

      case 'updateBilling':
        if (!body.candidateId) throw new Error('Missing candidateId');
        result = JoiningService.updateBilling(user, body.candidateId, body.patch);
        break;

      case 'addHR':
        result = AdminService.addHR(user, body.hrData || body);
        break;

      case 'toggleHRStatus':
        result = AdminService.toggleHRStatus(user, body.hrId, body.status);
        break;

      case 'addDropdownOption':
        result = AdminService.addDropdownOption(user, body.list, body.option, body.parentDisposition, body.callStatus);
        break;

      case 'toggleDropdownOption':
        result = AdminService.toggleDropdownOption(user, body.list, body.option, body.active);
        break;

      case 'reviewDuplicate':
        result = AdminService.reviewDuplicate(user, body.timestamp, body.candidateId, body.decision, body.notes);
        break;

      case 'updateUserRole':
        if (!body.targetEmail || !body.newRole) throw new Error('Missing targetEmail or newRole');
        result = AdminService.updateUserRole(user, body.targetEmail, body.newRole);
        break;

      case 'updateTeamMapping':
        if (!body.managerEmail || !body.teamRecruiterEmails) throw new Error('Missing managerEmail or teamRecruiterEmails');
        result = AdminService.updateTeamMapping(user, body.managerEmail, body.teamRecruiterEmails);
        break;

      default:
        throw new Error('Unknown POST action: ' + action);
    }

    // Invalidate script cache on any write
    try {
      CacheService.getScriptCache().removeAll(['NP_']);
    } catch (clearErr) {
      // ignore
    }

    return jsonResponse({ success: true, data: result });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      statusCode: error.statusCode || 500
    }, error.statusCode || 500);
  } finally {
    try {
      lock.releaseLock();
    } catch (le) {
      // ignore lock release errors
    }
  }
}

function jsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

