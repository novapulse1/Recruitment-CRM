/**
 * NovaPulse CRM - Data Repair: Candidate Pipeline Stages & Data Inconsistencies
 * 
 * Resolves:
 *   1. 40 candidates in stage "Unassigned" but an Assigned HR is set -> moves to "Assigned – Not Called".
 *   2. 76 candidates in stage "Interview Scheduled" with no interview date -> flags them and moves to
 *      "Assigned – Not Called" or adds a flag for recruiter follow-up.
 * 
 * DRY-RUN by default. Pass --apply to persist changes.
 * Usage:
 *   node scripts/repair-candidate-stages.cjs           # Dry run (prints proposed changes)
 *   node scripts/repair-candidate-stages.cjs --apply   # Commits updates to Firestore
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.resolve(__dirname, '..', 'data', 'masterMigrationData.json');

async function main() {
  const isApply = process.argv.includes('--apply');

  console.log('====================================================');
  console.log(' NovaPulse CRM - Repair Candidate Pipeline Stages');
  console.log(` Mode: ${isApply ? 'APPLY (writing to Firestore)' : 'DRY-RUN (read-only preview)'}`);
  console.log('====================================================\n');

  let candidates = [];

  if (fs.existsSync(DATA_FILE)) {
    try {
      const master = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      candidates = master.candidates || [];
      console.log(`[Source] Loaded local master dataset (${candidates.length} candidates).`);
    } catch (e) {
      console.warn('[Source] Error reading masterMigrationData.json:', e.message);
    }
  }

  const unassignedWithHRChanges = [];
  const scheduledWithoutDateChanges = [];

  candidates.forEach((c) => {
    const stage = c['Pipeline Stage'] || 'Unassigned';
    const assignedHR = (c['Assigned HR'] || '').trim();
    const interviewDate = (c['Interview Date'] || '').trim();

    // Issue 1: Unassigned stage with assigned HR
    if (stage === 'Unassigned' && assignedHR) {
      unassignedWithHRChanges.push({
        candidateId: c['Candidate ID'],
        candidateName: c['Candidate Name'],
        assignedHR,
        currentStage: stage,
        proposedStage: 'Assigned – Not Called',
        reason: `HR assigned (${assignedHR}) while in Unassigned stage`
      });
    }

    // Issue 2: Interview Scheduled without interview date
    if (stage === 'Interview Scheduled' && !interviewDate) {
      scheduledWithoutDateChanges.push({
        candidateId: c['Candidate ID'],
        candidateName: c['Candidate Name'],
        assignedHR: assignedHR || '(none)',
        currentStage: stage,
        proposedStage: 'Assigned – Not Called',
        remarksAddition: '[Audit: Reset from Interview Scheduled to Assigned – Not Called due to missing interview date]',
        reason: 'Missing interview date'
      });
    }
  });

  console.log('--- Summary of Inconsistencies Detected ---');
  console.log(`Total Candidates Inspected:                     ${candidates.length}`);
  console.log(`1. 'Unassigned' with Assigned HR set:           ${unassignedWithHRChanges.length} candidates`);
  console.log(`2. 'Interview Scheduled' with missing Date:     ${scheduledWithoutDateChanges.length} candidates`);
  console.log(`Total Proposed Stage Repairs:                   ${unassignedWithHRChanges.length + scheduledWithoutDateChanges.length}\n`);

  if (unassignedWithHRChanges.length > 0) {
    console.log('--- Sample Issue 1: Unassigned with HR -> Assigned – Not Called (First 10) ---');
    console.table(
      unassignedWithHRChanges.slice(0, 10).map((u) => ({
        'Candidate ID': u.candidateId,
        'Name': u.candidateName,
        'Assigned HR': u.assignedHR,
        'Current Stage': u.currentStage,
        'Proposed Stage': u.proposedStage
      }))
    );
  }

  if (scheduledWithoutDateChanges.length > 0) {
    console.log('\n--- Sample Issue 2: Interview Scheduled without Date (First 10) ---');
    console.table(
      scheduledWithoutDateChanges.slice(0, 10).map((s) => ({
        'Candidate ID': s.candidateId,
        'Name': s.candidateName,
        'Assigned HR': s.assignedHR,
        'Current Stage': s.currentStage,
        'Proposed Action': `Move to ${s.proposedStage} & add note`
      }))
    );
  }

  if (!isApply) {
    console.log('\n[DRY-RUN COMPLETE] 0 records modified.');
    console.log('To apply these stage repairs to Firestore, run:');
    console.log('  node scripts/repair-candidate-stages.cjs --apply\n');
    return;
  }

  // Apply to Firestore
  console.log('\n[APPLY MODE] Initializing Firestore connection...');
  try {
    const { db, doc, writeBatch } = require('./firebase-admin-helper.cjs');

    const allChanges = [
      ...unassignedWithHRChanges.map((ch) => ({
        id: ch.candidateId,
        patch: {
          'Pipeline Stage': ch.proposedStage,
          'Last Updated': new Date().toLocaleString('en-GB'),
          'Last Updated By': 'repair-candidate-stages-script'
        }
      })),
      ...scheduledWithoutDateChanges.map((ch) => ({
        id: ch.candidateId,
        patch: {
          'Pipeline Stage': ch.proposedStage,
          Remarks: ch.remarksAddition,
          'Last Updated': new Date().toLocaleString('en-GB'),
          'Last Updated By': 'repair-candidate-stages-script'
        }
      }))
    ];

    const CHUNK_SIZE = 400;
    let committed = 0;

    for (let i = 0; i < allChanges.length; i += CHUNK_SIZE) {
      const chunk = allChanges.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const item of chunk) {
        const ref = doc(db, 'candidates', item.id);
        batch.set(ref, item.patch, { merge: true });
      }

      await batch.commit();
      committed += chunk.length;
      console.log(`  Committed batch: ${committed} / ${allChanges.length}`);
    }

    console.log(`\n[SUCCESS] Successfully repaired ${committed} candidate stage records in Firestore.\n`);
  } catch (err) {
    console.error('[ERROR] Failed to write to Firestore:', err.message);
    console.log('Ensure valid Firebase credentials and rules are configured.');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
