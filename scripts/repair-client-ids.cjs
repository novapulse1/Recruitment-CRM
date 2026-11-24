/**
 * NovaPulse CRM - Data Repair: Client IDs on Candidates
 * 
 * Maps existing free-text Client Names on candidates to exact Client IDs (CL-xxx)
 * from the master clients list.
 * 
 * DRY-RUN by default. Pass --apply to persist changes.
 * Usage:
 *   node scripts/repair-client-ids.cjs           # Dry run (prints proposed changes)
 *   node scripts/repair-client-ids.cjs --apply   # Commits updates to Firestore
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.resolve(__dirname, '..', 'data', 'masterMigrationData.json');

async function main() {
  const isApply = process.argv.includes('--apply');

  console.log('====================================================');
  console.log(' NovaPulse CRM - Repair Candidate Client IDs');
  console.log(` Mode: ${isApply ? 'APPLY (writing to Firestore)' : 'DRY-RUN (read-only preview)'}`);
  console.log('====================================================\n');

  let candidates = [];
  let clients = [];

  // 1. Try to load from masterMigrationData.json
  if (fs.existsSync(DATA_FILE)) {
    try {
      const master = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      candidates = master.candidates || [];
      clients = master.clients || [];
      console.log(`[Source] Loaded local master dataset (${candidates.length} candidates, ${clients.length} clients).`);
    } catch (e) {
      console.warn('[Source] Error reading masterMigrationData.json:', e.message);
    }
  }

  // Build client lookup map: lowercase trimmed name -> { clientId, clientName }
  const clientMap = new Map();
  clients.forEach((c) => {
    if (c.clientName && c.clientId) {
      clientMap.set(c.clientName.toLowerCase().trim(), {
        clientId: c.clientId,
        clientName: c.clientName
      });
    }
  });

  console.log(`[Clients Master] ${clientMap.size} unique clients registered.\n`);

  // Inspect candidates and propose mappings
  const changes = [];
  let noClientCount = 0;
  let alreadySetCount = 0;
  let unmatchedCount = 0;

  candidates.forEach((c) => {
    const rawClient = (c['Client Name'] || '').trim();
    const existingClientId = c.clientId || '';

    if (!rawClient) {
      noClientCount++;
      return;
    }

    const matched = clientMap.get(rawClient.toLowerCase());
    if (matched) {
      if (existingClientId === matched.clientId) {
        alreadySetCount++;
      } else {
        changes.push({
          candidateId: c['Candidate ID'],
          candidateName: c['Candidate Name'],
          currentClientName: rawClient,
          currentClientId: existingClientId || '(none)',
          targetClientId: matched.clientId,
          canonicalClientName: matched.clientName
        });
      }
    } else {
      unmatchedCount++;
    }
  });

  console.log('--- Summary Statistics ---');
  console.log(`Total Candidates:            ${candidates.length}`);
  console.log(`No Client Assigned:          ${noClientCount}`);
  console.log(`Already Correct Client ID:   ${alreadySetCount}`);
  console.log(`Unmatched Free-text Names:   ${unmatchedCount}`);
  console.log(`Changes Proposed / Needed:   ${changes.length}\n`);

  if (changes.length > 0) {
    console.log('--- Sample Proposed Changes (First 15) ---');
    console.table(
      changes.slice(0, 15).map((ch) => ({
        'Candidate ID': ch.candidateId,
        'Name': ch.candidateName,
        'Client Text': ch.currentClientName,
        'Proposed Client ID': ch.targetClientId,
        'Canonical Name': ch.canonicalClientName
      }))
    );
  }

  if (!isApply) {
    console.log('\n[DRY-RUN COMPLETE] 0 records modified.');
    console.log('To apply these updates to Firestore, run:');
    console.log('  node scripts/repair-client-ids.cjs --apply\n');
    return;
  }

  // Apply to Firestore
  console.log('\n[APPLY MODE] Initializing Firestore connection...');
  try {
    const { db, doc, writeBatch } = require('./firebase-admin-helper.cjs');

    const CHUNK_SIZE = 400;
    const nowStr = new Date().toLocaleString('en-GB');
    let committed = 0;

    for (let i = 0; i < changes.length; i += CHUNK_SIZE) {
      const chunk = changes.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const ch of chunk) {
        const ref = doc(db, 'candidates', ch.candidateId);
        batch.set(
          ref,
          {
            clientId: ch.targetClientId,
            'Client Name': ch.canonicalClientName,
            'Last Updated': nowStr,
            'Last Updated By': 'repair-client-ids-script'
          },
          { merge: true }
        );
      }

      await batch.commit();
      committed += chunk.length;
      console.log(`  Committed batch: ${committed} / ${changes.length}`);
    }

    console.log(`\n[SUCCESS] Successfully updated ${committed} candidate records with Client IDs.\n`);
  } catch (err) {
    console.error('[ERROR] Failed to write to Firestore:', err.message);
    console.log('Ensure valid Firebase credentials and rules are configured.');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
