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
