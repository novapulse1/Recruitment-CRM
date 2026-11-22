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
