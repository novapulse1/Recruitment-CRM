/**
 * NovaPulse CRM - Initial Admin & Team Seeding Script
 * 
 * Securely hashes passwords with PBKDF2/SHA-256 (10,000 iterations, 16-byte random salt)
 * and seeds initial user accounts into Google Sheets USERS tab.
 */

const crypto = require('crypto');
const { execSync } = require('child_process');

function hashPassword(password, saltHex = null) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  return {
    salt: salt.toString('hex'),
    hash
  };
}

const INITIAL_ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@NovaPulse2026!';
const INITIAL_TEAM_PASSWORD = process.env.INITIAL_TEAM_PASSWORD || 'NovaPulse@2026!';

const USERS_TO_SEED = [
  {
    user_id: 'superadmin',
    email: 'novapulse739@gmail.com',
    name: 'Super Administrator',
    password: INITIAL_ADMIN_PASSWORD,
    role: 'SUPER_ADMIN',
    status: 'Active',
    must_change_password: 'TRUE',
    failed_attempts: '0',
    locked_until: '',
    last_login: '',
    password_updated_at: new Date().toISOString(),
    password_updated_by: 'system_seed'
  },
  {
    user_id: 'admin',
    email: 'admin@novapulse.co.in',
    name: 'Recruitment Admin',
    password: INITIAL_TEAM_PASSWORD,
    role: 'ADMIN',
    status: 'Active',
    must_change_password: 'TRUE',
    failed_attempts: '0',
    locked_until: '',
    last_login: '',
    password_updated_at: new Date().toISOString(),
    password_updated_by: 'system_seed'
  },
  {
    user_id: 'manager',
    email: 'manager@novapulse.co.in',
    name: 'Recruitment Manager',
    password: INITIAL_TEAM_PASSWORD,
    role: 'RECRUITMENT_MANAGER',
    status: 'Active',
    must_change_password: 'TRUE',
    failed_attempts: '0',
    locked_until: '',
    last_login: '',
    password_updated_at: new Date().toISOString(),
    password_updated_by: 'system_seed'
  },
  {
    user_id: 'anshu',
    email: 'hr@novapulse.co.in',
    name: 'Anshu (Recruiter)',
    password: INITIAL_TEAM_PASSWORD,
    role: 'HR_RECRUITER',
    status: 'Active',
    must_change_password: 'TRUE',
    failed_attempts: '0',
    locked_until: '',
    last_login: '',
    password_updated_at: new Date().toISOString(),
    password_updated_by: 'system_seed'
  },
  {
    user_id: 'jigyasa',
    email: 'gjigyasa11@gmail.com',
    name: 'Jigyasha (Recruiter)',
    password: INITIAL_TEAM_PASSWORD,
    role: 'HR_RECRUITER',
    status: 'Active',
    must_change_password: 'TRUE',
    failed_attempts: '0',
    locked_until: '',
    last_login: '',
    password_updated_at: new Date().toISOString(),
    password_updated_by: 'system_seed'
  },
  {
    user_id: 'finance',
    email: 'finance@novapulse.co.in',
    name: 'Finance Officer',
    password: INITIAL_TEAM_PASSWORD,
    role: 'FINANCE',
    status: 'Active',
    must_change_password: 'TRUE',
    failed_attempts: '0',
    locked_until: '',
    last_login: '',
    password_updated_at: new Date().toISOString(),
    password_updated_by: 'system_seed'
  }
];

function seedSpreadsheet(spreadsheetId) {
  console.log(`\n=== Seeding USERS for Spreadsheet: ${spreadsheetId} ===`);
  
  const rows = USERS_TO_SEED.map(u => {
    const { salt, hash } = hashPassword(u.password);
    return [
      u.user_id,
      u.email,
      u.name,
      hash,
      salt,
      u.role,
      u.status,
      u.must_change_password,
      u.failed_attempts,
      u.locked_until,
      u.last_login,
      u.password_updated_at,
      u.password_updated_by
    ];
  });

  const range = `USERS!A2:M${rows.length + 1}`;
  const valuesString = rows.map(r => r.join(',')).join('|');
  
  console.log(`Writing ${rows.length} users to ${range}...`);
  try {
    const cmd = `gsheets mutate write ${spreadsheetId} "${range}" "${valuesString}"`;
    const res = execSync(cmd, { encoding: 'utf-8', env: { ...process.env, Path: 'C:\\Users\\Admin\\nodejs;' + process.env.Path } });
    console.log(`Output:`, res.trim());
    console.log(`Successfully seeded ${rows.length} users into ${spreadsheetId}.`);
  } catch (err) {
    console.error(`Failed to write to ${spreadsheetId}:`, err.message);
    if (err.stdout) console.error(err.stdout);
    if (err.stderr) console.error(err.stderr);
  }
}

const targetSheets = process.argv[2] ? [process.argv[2]] : [
  '162bNBPeryLIJ-M6yBt8uSK3YbKc8tN3qP1DkF4PwAd0', // Dev
  '11j17e5RTG0uLTXg41f_AfKMqAUtGCDXV2DusZ8Muq58'  // Prod
];

targetSheets.forEach(id => seedSpreadsheet(id));

console.log('\nInitial user accounts summary:');
USERS_TO_SEED.forEach(u => {
  console.log(`- ${u.role}: ${u.user_id} (${u.email}) [Default temp password: ${u.role === 'SUPER_ADMIN' ? 'INITIAL_ADMIN_PASSWORD' : 'INITIAL_TEAM_PASSWORD'}]`);
});
