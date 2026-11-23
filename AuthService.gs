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