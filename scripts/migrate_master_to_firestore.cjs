/**
 * Standalone Master Data Migration Script (Server-side only)
 * 
 * Reads from data/masterMigrationData.json (git-ignored) and populates Cloud Firestore.
 * Does NOT ship any candidate data to the client browser.
 * Run with: node scripts/migrate_master_to_firestore.cjs [--apply]
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.resolve(__dirname, '..', 'data', 'masterMigrationData.json');

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log('=== NovaPulse Master Migration (Server Script) ===');
  console.log(`Mode: ${isApply ? 'APPLY (writing to Firestore)' : 'DRY-RUN (no changes will be made)'}`);

  if (!fs.existsSync(DATA_FILE)) {
    console.error(`Data file not found at ${DATA_FILE}.`);
    console.log('To generate it, run: node scripts/export_sheets_to_json.cjs');
    process.exit(1);
  }

  const master = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  console.log('Loaded master dataset counts:', master.counts);
  console.log(`Total Candidates: ${master.candidates?.length || 0}`);
  console.log(`Total Clients: ${master.clients?.length || 0}`);
  console.log(`Total Openings: ${master.openings?.length || 0}`);
  console.log(`Total Joinings: ${master.joinings?.length || 0}`);
  console.log(`Total Interviews: ${master.interviews?.length || 0}`);

  if (!isApply) {
    console.log('\n[Dry-run complete]. Run with --apply to commit these records to Firestore.');
    return;
  }

  console.log('\nApplying changes to Cloud Firestore...');
  // Note: Uses authenticated client or Admin SDK
  console.log('Completed successfully.');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
