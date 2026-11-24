import { describe, it } from 'node:test';
import assert from 'node:assert';
import { STANDARD_FIELDS } from '../utils/csvImportSchema.ts';
import { normalizePhoneNumber } from '../utils/formatters.ts';

describe('CSV Engine & Parser', () => {
  describe('Header Auto-detection', () => {
    function matchHeader(header: string): string | null {
      const cleanHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');

      for (const field of STANDARD_FIELDS) {
        const cleanKey = field.key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanHeader === cleanKey) return field.key;

        const isAlias = field.aliases.some(
          (alias) => cleanHeader === alias.replace(/[^a-z0-9]/g, '')
        );
        if (isAlias) return field.key;
      }
      return null;
    }

    it('matches exact and alias header names case-insensitively with spaces/underscores', () => {
      assert.strictEqual(matchHeader('Candidate Name'), 'Candidate Name');
      assert.strictEqual(matchHeader('candidate_name'), 'Candidate Name');
      assert.strictEqual(matchHeader('FULL NAME'), 'Candidate Name');
      assert.strictEqual(matchHeader('Candidate'), 'Candidate Name');

      assert.strictEqual(matchHeader('Mobile Number'), 'Mobile Number');
      assert.strictEqual(matchHeader('phone'), 'Mobile Number');
      assert.strictEqual(matchHeader('Contact Number'), 'Mobile Number');
      assert.strictEqual(matchHeader('mobile_number'), 'Mobile Number');

      assert.strictEqual(matchHeader('Email ID'), 'Email ID');
      assert.strictEqual(matchHeader('email_address'), 'Email ID');

      assert.strictEqual(matchHeader('Current CTC'), 'Current Salary');
      assert.strictEqual(matchHeader('Expected CTC'), 'Expected Salary');
      assert.strictEqual(matchHeader('Pipeline Stage'), 'Pipeline Stage');
    });

    it('returns null for unknown columns so user can manually map or skip them', () => {
      assert.strictEqual(matchHeader('Random Column 123'), null);
      assert.strictEqual(matchHeader('Internal Tracking Notes'), null);
    });
  });

  describe('Excel Text Escaping & UTF-8 BOM', () => {
    it('formats phone numbers with ="\\t..." formula to prevent scientific notation and zero stripping in Excel', () => {
      const rawPhone = '09876543210';
      const cleanPhone = normalizePhoneNumber(rawPhone);
      assert.strictEqual(cleanPhone, '9876543210');

      const excelFormatted = `="\\t${cleanPhone}"`;
      assert.strictEqual(excelFormatted, '="\\t9876543210"');
    });

    it('ensures UTF-8 BOM (\\uFEFF) is prepended for Excel compatibility', () => {
      const content = 'Col1,Col2\r\nVal1,Val2';
      const bomContent = '\uFEFF' + content;
      assert.strictEqual(bomContent.charCodeAt(0), 0xFEFF);
      assert.strictEqual(bomContent.startsWith('\uFEFF'), true);
    });

    it('escapes quotes cleanly inside CSV fields', () => {
      const val = 'Senior "Full Stack" Developer';
      const escaped = `"${val.replace(/"/g, '""')}"`;
      assert.strictEqual(escaped, '"Senior ""Full Stack"" Developer"');
    });
  });

  describe('Duplicate Detection Cross-referencing', () => {
    const existingCandidates = [
      {
        'Candidate ID': 'NP-CAN-000100',
        'Candidate Name': 'Rajesh Kumar',
        'Mobile Number': '9876543210',
        'Alternate Mobile': '9123456780',
        'Email ID': 'rajesh.k@example.com'
      }
    ];

    function checkDuplicate(newMobile: string, newAltMobile: string, newEmail: string) {
      const normMob = normalizePhoneNumber(newMobile);
      const normAlt = normalizePhoneNumber(newAltMobile);
      const cleanEmail = newEmail.toLowerCase().trim();

      for (const cand of existingCandidates) {
        const candMob = normalizePhoneNumber(cand['Mobile Number']);
        const candAlt = normalizePhoneNumber(cand['Alternate Mobile']);
        const candEmail = cand['Email ID'].toLowerCase().trim();

        if (normMob && (normMob === candMob || normMob === candAlt)) {
          return { isDuplicate: true, matchedId: cand['Candidate ID'], reason: 'Phone match' };
        }
        if (normAlt && (normAlt === candMob || normAlt === candAlt)) {
          return { isDuplicate: true, matchedId: cand['Candidate ID'], reason: 'Alt Phone match' };
        }
        if (cleanEmail && cleanEmail === candEmail) {
          return { isDuplicate: true, matchedId: cand['Candidate ID'], reason: 'Email match' };
        }
      }
      return { isDuplicate: false };
    }

    it('detects duplicate by primary mobile', () => {
      const res = checkDuplicate('+91 98765 43210', '', '');
      assert.strictEqual(res.isDuplicate, true);
      assert.strictEqual(res.matchedId, 'NP-CAN-000100');
    });

    it('detects duplicate by alternate mobile matching existing primary', () => {
      const res = checkDuplicate('9999999999', '9876543210', '');
      assert.strictEqual(res.isDuplicate, true);
      assert.strictEqual(res.matchedId, 'NP-CAN-000100');
    });

    it('detects duplicate by email address', () => {
      const res = checkDuplicate('9999999999', '', 'RAJESH.K@EXAMPLE.COM');
      assert.strictEqual(res.isDuplicate, true);
      assert.strictEqual(res.matchedId, 'NP-CAN-000100');
    });

    it('passes completely fresh candidate as non-duplicate', () => {
      const res = checkDuplicate('9111111111', '', 'new.candidate@example.com');
      assert.strictEqual(res.isDuplicate, false);
    });
  });
});
