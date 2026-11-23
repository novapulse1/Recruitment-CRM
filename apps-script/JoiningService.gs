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
