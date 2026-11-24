import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseCurrency,
  formatINR,
  parseDateIST,
  formatDateIST,
  getTodayIST,
  getDaysDifference,
  normalizePhoneNumber,
  calculateInterviewTimeBucket
} from '../utils/formatters.ts';

describe('Formatters & Normalizers', () => {
  describe('parseCurrency', () => {
    it('parses valid numeric values and Indian rupee formats', () => {
      assert.strictEqual(parseCurrency(2000), 2000);
      assert.strictEqual(parseCurrency('2000'), 2000);
      assert.strictEqual(parseCurrency('₹2,000'), 2000);
      assert.strictEqual(parseCurrency('₹ 50,000'), 50000);
      assert.strictEqual(parseCurrency('₹ 1,50,000.50'), 150000.5);
    });

    it('returns null for empty, undefined or invalid inputs without throwing NaN', () => {
      assert.strictEqual(parseCurrency(''), null);
      assert.strictEqual(parseCurrency(null), null);
      assert.strictEqual(parseCurrency(undefined), null);
      assert.strictEqual(parseCurrency('N/A'), null);
      assert.strictEqual(parseCurrency('TBD'), null);
    });
  });

  describe('formatINR', () => {
    it('formats numbers into Indian Rupee strings', () => {
      assert.strictEqual(formatINR(2000), '₹ 2,000');
      assert.strictEqual(formatINR(50000), '₹ 50,000');
      assert.strictEqual(formatINR('150000'), '₹ 1,50,000');
    });

    it('handles missing values cleanly without displaying "₹ NaN"', () => {
      assert.strictEqual(formatINR(null), 'Fee not set');
      assert.strictEqual(formatINR(undefined), 'Fee not set');
      assert.strictEqual(formatINR(''), 'Fee not set');
      assert.strictEqual(formatINR(null, 'Not set'), 'Not set');
      assert.strictEqual(formatINR('invalid', '-'), '-');
    });
  });

  describe('normalizePhoneNumber', () => {
    it('cleans 10-digit Indian phone numbers', () => {
      assert.strictEqual(normalizePhoneNumber('9876543210'), '9876543210');
      assert.strictEqual(normalizePhoneNumber('+91 9876543210'), '9876543210');
      assert.strictEqual(normalizePhoneNumber('+91-98765-43210'), '9876543210');
      assert.strictEqual(normalizePhoneNumber('09876543210'), '9876543210');
      assert.strictEqual(normalizePhoneNumber('919876543210'), '9876543210');
      assert.strictEqual(normalizePhoneNumber('  98765 43210  '), '9876543210');
    });

    it('returns empty string for missing or non-digit input', () => {
      assert.strictEqual(normalizePhoneNumber(''), '');
      assert.strictEqual(normalizePhoneNumber(null as any), '');
      assert.strictEqual(normalizePhoneNumber(undefined as any), '');
    });
  });

  describe('parseDateIST & formatDateIST', () => {
    it('correctly parses DD-MMM-YYYY dates', () => {
      const d = parseDateIST('16-Oct-2026');
      assert.ok(d instanceof Date);
      assert.ok(!isNaN(d.getTime()));
      assert.strictEqual(d.getFullYear(), 2026);
      assert.strictEqual(d.getMonth(), 9); // October is month 9 (0-indexed)
      assert.strictEqual(d.getDate(), 16);
    });

    it('formats dates consistently', () => {
      const d = new Date(2026, 9, 16);
      const formatted = formatDateIST(d);
      assert.ok(formatted.includes('Oct') && formatted.includes('2026'));
    });
  });

  describe('calculateInterviewTimeBucket', () => {
    it('returns Overdue for past or missing dates without throwing', () => {
      const pastBucket = calculateInterviewTimeBucket('01-Jan-2020');
      assert.strictEqual(pastBucket, 'Overdue');

      const emptyBucket = calculateInterviewTimeBucket('');
      assert.strictEqual(emptyBucket, 'Overdue');

      const nullBucket = calculateInterviewTimeBucket(null);
      assert.strictEqual(nullBucket, 'Overdue');
    });
  });
});
