const fs = require('fs');
const path = require('path');

const appsScriptDir = path.join(__dirname, '..', 'apps-script');

const order = [
  'Utils.gs',
  'SheetRepo.gs',
  'AuditService.gs',
  'PermissionEngine.gs',
  'AuthService.gs',
  'DuplicateService.gs',
  'InterviewService.gs',
  'JoiningService.gs',
  'LeadService.gs',
  'OpeningsClientsService.gs',
  'CandidateService.gs',
  'DashboardService.gs',
  'AdminService.gs',
  'Code.gs'
];

let bundle = `/**
 * ============================================================================
 * NOVAPULSE HIRING CRM - COMPLETE BACKEND BUNDLE (ALL-IN-ONE DEPLOYMENT)
 * ============================================================================
 * Contains complete RBAC Permission Engine, Data Scoping, Optimistic Locking,
 * Duplicate Prevention, Automated Pipeline Calculation, and Web App API Endpoints.
 * 
 * Instructions:
 * 1. Open Google Sheet -> Extensions -> Apps Script
 * 2. Delete any existing Code.gs contents and paste this ENTIRE file.
 * 3. Click 'Deploy' -> 'New Deployment' -> Select type 'Web app'
 *    - Description: NovaPulse Production CRM API
 *    - Execute as: Me (your Google account)
 *    - Who has access: Anyone with Google account (or NovaPulse domain)
 * 4. Click 'Deploy' and copy the Web App URL.
 * 5. Paste the Web App URL into your CRM's Admin Settings or .env file!
 * ============================================================================
 */\n\n`;

for (const file of order) {
  const filePath = path.join(appsScriptDir, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    bundle += `\n/* ==================== MODULE: ${file} ==================== */\n\n`;
    bundle += content;
    bundle += '\n';
  } else {
    console.warn(`Warning: File not found: ${file}`);
  }
}

const outputPath = path.join(appsScriptDir, 'NovaPulse_Complete_Backend.gs');
fs.writeFileSync(outputPath, bundle, 'utf8');
const rootOutputPath = path.join(__dirname, '..', 'NovaPulse_Complete_Backend.gs');
if (fs.existsSync(path.dirname(rootOutputPath))) {
  fs.writeFileSync(rootOutputPath, bundle, 'utf8');
}
console.log(`Bundle successfully generated at: ${outputPath} (${(bundle.length / 1024).toFixed(1)} KB)`);
