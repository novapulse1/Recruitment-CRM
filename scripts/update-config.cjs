const { execSync } = require('child_process');

function updateSpreadsheetConfig(spreadsheetId) {
  console.log(`Updating CONFIGURATION for spreadsheet: ${spreadsheetId}`);
  
  // Format rows to write: A11 to B15
  const superAdminRow = 'SUPER_ADMIN_EMAILS,novapulse739@gmail.com';
  const managerRow = 'RECRUITMENT_MANAGER_EMAILS,manager@novapulse.co.in';
  const financeRow = 'FINANCE_EMAILS,finance@novapulse.co.in\\, accounts@novapulse.co.in';
  
  const teamMappingObj = {
    'manager@novapulse.co.in': ['hr@novapulse.co.in', 'gjigyasa11@gmail.com']
  };
  const jsonStr = JSON.stringify(teamMappingObj).replace(/,/g, '\\,');
  const teamMappingRow = `MANAGER_TEAM_MAPPING,${jsonStr}`;
  const rbacRow = 'RBAC_ENABLED,TRUE';

  const rows = [superAdminRow, managerRow, financeRow, teamMappingRow, rbacRow].join('|');

  const cmd = `gsheets mutate write ${spreadsheetId} "CONFIGURATION!A11:B15" "${rows.replace(/"/g, '\\"')}"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log('Successfully written RBAC keys!');
}

const targetId = process.argv[2] || '162bNBPeryLIJ-M6yBt8uSK3YbKc8tN3qP1DkF4PwAd0';
updateSpreadsheetConfig(targetId);
