const { execSync } = require('child_process');
const SPREADSHEET_ID = '11j17e5RTG0uLTXg41f_AfKMqAUtGCDXV2DusZ8Muq58';
const sheets = ['CLIENT MASTER', 'OPENINGS', 'JOINING TRACKER', 'INTERVIEW LOG', 'LEAD APPROVALS', 'HR REGISTRY'];

for (const s of sheets) {
  try {
    const res = execSync(`gsheets readonly read ${SPREADSHEET_ID} "${s}!A1:AZ2"`, { encoding: 'utf-8', shell: 'cmd.exe' });
    console.log(`=== ${s} ===`);
    console.log(res.trim());
  } catch (e) {
    console.error(`Error on sheet ${s}:`, e.message);
  }
}
