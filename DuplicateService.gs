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
