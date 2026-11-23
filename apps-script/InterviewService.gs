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
