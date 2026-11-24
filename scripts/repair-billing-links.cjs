/**
 * NovaPulse CRM - Data Repair: Joinings & Billing Links
 * 
 * Resolves:
 *   Re-links joining/billing record for candidate Rahul (Hasthkala, SEO, fee ₹5,000)
 *   from erroneous legacy ID NP-CAN-000045 to canonical ID NP-CAN-001054.
 * 
 * DRY-RUN by default. Pass --apply to persist changes.
 * Usage:
 *   node scripts/repair-billing-links.cjs           # Dry run (prints proposed changes)
 *   node scripts/repair-billing-links.cjs --apply   # Commits updates to Firestore
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.resolve(__dirname, '..', 'data', 'masterMigrationData.json');

async function main() {
  const isApply = process.argv.includes('--apply');

  console.log('====================================================');
  console.log(' NovaPulse CRM - Repair Joinings & Billing Links');
  console.log(` Mode: ${isApply ? 'APPLY (writing to Firestore)' : 'DRY-RUN (read-only preview)'}`);
  console.log('====================================================\n');

  let joinings = [];
  let candidates = [];

  if (fs.existsSync(DATA_FILE)) {
    try {
      const master = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      joinings = master.joinings || [];
      candidates = master.candidates || [];
      console.log(`[Source] Loaded local master dataset (${joinings.length} joinings, ${candidates.length} candidates).`);
    } catch (e) {
      console.warn('[Source] Error reading masterMigrationData.json:', e.message);
    }
  }

  const rahulLegacyId = 'NP-CAN-000045';
  const rahulCanonicalId = 'NP-CAN-001054';

  const rahulCandidate = candidates.find((c) => c['Candidate ID'] === rahulCanonicalId);
  const legacyCandidate = candidates.find((c) => c['Candidate ID'] === rahulLegacyId);

  console.log(`[Target Candidate] Canonical ID: ${rahulCanonicalId} (${rahulCandidate ? rahulCandidate['Candidate Name'] : 'Not found in master'})`);
  console.log(`[Legacy Reference] Legacy ID:    ${rahulLegacyId} (${legacyCandidate ? legacyCandidate['Candidate Name'] : 'Not found in master'})\n`);

  // Check joinings for matches
  const joiningsToFix = joinings.filter((j) => {
    return (
      j.candidateId === rahulLegacyId ||
      (j.candidateName?.toLowerCase().includes('rahul') && j.clientName?.toLowerCase().includes('hasthkala'))
    );
  });

  console.log(`Matching joining records found: ${joiningsToFix.length}`);

  if (joiningsToFix.length > 0) {
    console.table(
      joiningsToFix.map((j) => ({
        'Current Candidate ID': j.candidateId,
        'Candidate Name': j.candidateName,
        'Client': j.clientName,
        'Designation': j.designation,
        'Proposed ID': rahulCanonicalId,
        'Fee Value': j.feeValue || j.invoiceAmount
      }))
    );
  }

  if (!isApply) {
    console.log('\n[DRY-RUN COMPLETE] 0 records modified.');
    console.log('To apply these billing link updates to Firestore, run:');
    console.log('  node scripts/repair-billing-links.cjs --apply\n');
    return;
  }

  console.log('\n[APPLY MODE] Initializing Firestore connection...');
  try {
    const { db, doc, setDoc, getDoc } = require('./firebase-admin-helper.cjs');

    // 1. Check if legacy doc exists in joinings collection
    const legacyRef = doc(db, 'joinings', rahulLegacyId);
    const legacySnap = await getDoc(legacyRef);

    const canonicalRef = doc(db, 'joinings', rahulCanonicalId);

    const nowStr = new Date().toLocaleString('en-GB');

    if (legacySnap.exists()) {
      const data = legacySnap.data();
      const updatedData = {
        ...data,
        candidateId: rahulCanonicalId,
        candidateName: rahulCandidate?.['Candidate Name'] || 'Rahul',
        lastUpdated: nowStr,
        lastUpdatedBy: 'repair-billing-links-script'
      };

      await setDoc(canonicalRef, updatedData, { merge: true });
      console.log(`[SUCCESS] Migrated joinings/${rahulLegacyId} -> joinings/${rahulCanonicalId}`);
    } else {
      // Create canonical joining record from master
      const masterJoining = joiningsToFix[0] || {
        candidateId: rahulCanonicalId,
        candidateName: 'Rahul',
        clientName: 'Hasthkala',
        designation: 'SEO',
        assignedHR: 'Anshu',
        joiningDate: '16-Oct-2026',
        feeType: 'Fixed Amount',
        feeValue: '5000',
        invoiceAmount: '₹5,000',
        employmentStatus: 'Working'
      };

      await setDoc(
        canonicalRef,
        {
          ...masterJoining,
          candidateId: rahulCanonicalId,
          lastUpdated: nowStr,
          lastUpdatedBy: 'repair-billing-links-script'
        },
        { merge: true }
      );
      console.log(`[SUCCESS] Ensured canonical record at joinings/${rahulCanonicalId}`);
    }

    console.log('\n[DONE] Billing link repair completed successfully.\n');
  } catch (err) {
    console.error('[ERROR] Failed to write to Firestore:', err.message);
    console.log('Ensure valid Firebase credentials and rules are configured.');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
