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
