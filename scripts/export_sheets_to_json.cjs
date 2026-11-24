const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '11j17e5RTG0uLTXg41f_AfKMqAUtGCDXV2DusZ8Muq58';

function fetchSheetTsv(range) {
  console.log(`Fetching range: ${range}...`);
  const res = execSync(`gsheets readonly read ${SPREADSHEET_ID} "${range}"`, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
    shell: 'cmd.exe'
  });
  return res;
}

function parseTsv(tsvText) {
  const lines = tsvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split('\t').map(h => h.trim());
  
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] || '').trim();
    });
    records.push(obj);
  }
  return records;
}

async function exportAll() {
  console.log('Starting export from Google Sheets...');

  // 1. MASTER DATA (Candidates)
  console.log('\n--- 1. MASTER DATA ---');
  const candidatesTsv = fetchSheetTsv('MASTER DATA!A1:AH1500');
  const candidateRows = parseTsv(candidatesTsv);
  console.log(`Raw candidates fetched: ${candidateRows.length}`);
  // Filter only real candidates (have Candidate ID like NP-CAN-)
  const candidates = candidateRows.filter(c => c['Candidate ID'] && c['Candidate ID'].startsWith('NP-CAN-'));
  console.log(`Valid candidates filtered: ${candidates.length}`);
  if (candidates.length > 0) {
    console.log(`First candidate: ${candidates[0]['Candidate ID']} (${candidates[0]['Candidate Name']})`);
    console.log(`Last candidate: ${candidates[candidates.length - 1]['Candidate ID']} (${candidates[candidates.length - 1]['Candidate Name']})`);
  }

  // 2. CLIENT MASTER
  console.log('\n--- 2. CLIENT MASTER ---');
  const clientsTsv = fetchSheetTsv('CLIENT MASTER!A1:W50');
  const clientRows = parseTsv(clientsTsv);
  console.log(`Raw clients fetched: ${clientRows.length}`);
  const clients = clientRows.filter(cl => cl['Client ID'] && cl['Client ID'].startsWith('CL-')).map(cl => ({
    clientId: cl['Client ID'],
    clientName: cl['Client Name'] || '',
    status: cl['Status'] || 'Active',
    feeType: cl['Fee Type'] || '',
    feeValue: cl['Fee Value'] || '',
    invoiceAfterDays: cl['Invoice After Joining (Days)'] || '',
    replacementPeriodDays: cl['Replacement Period (Days)'] || '',
    gstPercent: cl['GST %'] || '',
    contactPerson: cl['Contact Person'] || '',
    contactEmail: cl['Contact Email'] || '',
    contactPhone: cl['Contact Phone'] || '',
    billingAddress: cl['Billing Address'] || '',
    agreementNotes: cl['Agreement Notes'] || '',
    addedOn: cl['Added On'] || '',
    industry: cl['Industry'] || '',
    hiringStatus: cl['Hiring Status'] || '',
    payrollType: cl['Payroll Type'] || '',
    agreement: cl['Agreement'] || '',
    clientRank: cl['Client Rank'] || '',
    gstNo: cl['GST No'] || '',
    secondaryPOCName: cl['Secondary POC Name'] || '',
    secondaryPOCNumber: cl['Secondary POC Number'] || '',
    remarks: cl['Remarks'] || ''
  }));
  console.log(`Valid clients mapped: ${clients.length}`);

  // 3. OPENINGS
  console.log('\n--- 3. OPENINGS ---');
  // Openings headers are at row 4
  const openingsTsv = fetchSheetTsv('OPENINGS!A4:Q50');
  const openingRows = parseTsv(openingsTsv);
  console.log(`Raw openings fetched: ${openingRows.length}`);
  const openings = openingRows.filter(o => o['Opening ID'] && o['Opening ID'].startsWith('OP-'));
  console.log(`Valid openings mapped: ${openings.length}`);

  // 4. JOINING TRACKER
  console.log('\n--- 4. JOINING TRACKER ---');
  const joiningsTsv = fetchSheetTsv('JOINING TRACKER!A1:AA50');
  const joiningRows = parseTsv(joiningsTsv);
  console.log(`Raw joinings fetched: ${joiningRows.length}`);
  const joinings = joiningRows.filter(j => j['Candidate ID'] && j['Candidate ID'].startsWith('NP-CAN-')).map(j => ({
    candidateId: j['Candidate ID'],
    candidateName: j['Candidate Name'] || '',
    clientName: j['Client Name'] || '',
    designation: j['Designation'] || '',
    assignedHR: j['Assigned HR'] || '',
    joiningDate: j['Joining Date'] || '',
    annualCtc: j['Annual CTC'] || '',
    feeType: j['Fee Type'] || '',
    feeValue: j['Fee Value'] || '',
    daysCompleted: parseInt(j['Days Completed'] || '0', 10) || 0,
    invoiceDueDate: j['Invoice Due Date'] || '',
    replacementEnds: j['Replacement Ends'] || '',
    invoiceAmount: j['Invoice Amount'] || '',
    employmentStatus: j['Employment Status'] || '',
    exitDate: j['Exit Date'] || '',
    earlyExitDecision: j['Early Exit Decision'] || '',
    invoiceStatus: j['Invoice Status'] || 'Pending',
    invoiceNo: j['Invoice No'] || '',
    invoiceDate: j['Invoice Date'] || '',
    paymentReceivedOn: j['Payment Received On'] || '',
    replacementCandidateId: j['Replacement Candidate ID'] || '',
    billingStatus: j['Billing Status'] || '',
    replacementStatus: j['Replacement Status'] || '',
    remarks: j['Remarks'] || ''
  }));
  console.log(`Valid joinings mapped: ${joinings.length}`);

  // 5. INTERVIEW LOG
  console.log('\n--- 5. INTERVIEW LOG ---');
  const interviewsTsv = fetchSheetTsv('INTERVIEW LOG!A1:I100');
  const interviewRows = parseTsv(interviewsTsv);
  console.log(`Raw interview logs fetched: ${interviewRows.length}`);
  const interviews = interviewRows.filter(i => i['Candidate ID'] && i['Candidate ID'].startsWith('NP-CAN-')).map((i, idx) => ({
    interviewId: `INT-${i['Candidate ID']}-${idx + 1}`,
    candidateId: i['Candidate ID'],
    candidateName: i['Candidate Name'] || '',
    assignedHR: i['Assigned HR'] || '',
    event: i['Event'] || '',
    fromDate: i['From Date'] || '',
    interviewDate: i['Interview Date'] || '',
    attempt: i['Attempt #'] || '1',
    changedBy: i['Changed By'] || '',
    loggedAt: i['Logged At'] || '',
    interviewStatus: 'Attended',
    timeBucket: 'Past'
  }));
  console.log(`Valid interviews mapped: ${interviews.length}`);

  // 6. LEAD APPROVALS
  console.log('\n--- 6. LEAD APPROVALS ---');
  const leadsTsv = fetchSheetTsv('LEAD APPROVALS!A1:AA20');
  const leadRows = parseTsv(leadsTsv);
  console.log(`Raw leads fetched: ${leadRows.length}`);
  const leads = leadRows.filter(l => l['Lead ID'] && l['Lead ID'].startsWith('NP-LEAD-'));
  console.log(`Valid leads mapped: ${leads.length}`);

  // 7. HR REGISTRY
  console.log('\n--- 7. HR REGISTRY ---');
  const hrsTsv = fetchSheetTsv('HR REGISTRY!A1:K20');
  const hrRows = parseTsv(hrsTsv);
  console.log(`Raw HR records fetched: ${hrRows.length}`);
  const hrs = hrRows.filter(h => h['HR ID'] && h['HR ID'].startsWith('NP-HR-'));
  console.log(`Valid HRs mapped: ${hrs.length}`);

  const masterPayload = {
    metadata: {
      exportedAt: new Date().toISOString(),
      sourceSpreadsheet: SPREADSHEET_ID,
      highestCandidateId: candidates[candidates.length - 1]?.['Candidate ID'] || 'NP-CAN-001158',
      highestCandidateNum: 1158,
      nextCandidateId: 'NP-CAN-001159'
    },
    counts: {
      candidates: candidates.length,
      clients: clients.length,
      openings: openings.length,
      joinings: joinings.length,
      interviews: interviews.length,
      leads: leads.length,
      hrs: hrs.length
    },
    candidates,
    clients,
    openings,
    joinings,
    interviews,
    leads,
    hrs
  };

  const outputPath = path.resolve(__dirname, '..', 'frontend', 'src', 'data', 'masterMigrationData.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(masterPayload, null, 2), 'utf-8');
  console.log(`\nSuccessfully saved master migration dataset to ${outputPath}!`);
  console.log(`Counts:`, masterPayload.counts);
}

exportAll().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
