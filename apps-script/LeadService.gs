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
