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
    var userEmail = (e && e.parameter && e.parameter.userEmail) || body.userEmail || (Session.getActiveUser() ? Session.getActiveUser().getEmail() : '');

    var user = AuthService.resolveUser(userEmail);
    if (!user.authenticated) {
      return jsonResponse({ success: false, error: 'Unauthorized: ' + (user.error || 'Access denied') }, 401);
    }

    var result = {};

    switch (action) {
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
