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
