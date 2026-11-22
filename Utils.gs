/**
 * NovaPulse Hiring CRM - Utils
 * Date formatting, string sanitization, and helper utilities (Asia/Kolkata)
 */

var Utils = (function () {
  var TIMEZONE = 'Asia/Kolkata';

  function formatDateTime(date) {
    var d = date ? new Date(date) : new Date();
    return Utilities.formatDate(d, TIMEZONE, 'dd-MMM-yyyy HH:mm');
  }

  function formatDate(date) {
    if (!date) return '';
    var d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return Utilities.formatDate(d, TIMEZONE, 'dd-MMM-yyyy');
  }

  function parseDate(str) {
    if (!str) return null;
    var d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Normalize phone number: strip spaces, hyphens, parentheses, "+91", leading "0"
   */
  function normalizePhone(phone) {
    if (!phone) return '';
    var cleaned = String(phone).replace(/[\s\-\(\)\+]/g, '');
    if (cleaned.startsWith('91') && cleaned.length > 10) {
      cleaned = cleaned.substring(2);
    }
    if (cleaned.startsWith('0') && cleaned.length > 10) {
      cleaned = cleaned.substring(1);
    }
    return cleaned.trim();
  }

  /**
   * Normalize email: trim and lowercase
   */
  function normalizeEmail(email) {
    if (!email) return '';
    var cleaned = String(email).trim().toLowerCase();
    if (cleaned === '-' || cleaned === 'na' || cleaned === 'n/a') return '';
    return cleaned;
  }

  /**
   * Format Indian currency: ₹ 1,23,456
   */
  function formatINR(amount) {
    if (amount === null || amount === undefined || amount === '') return '₹ 0';
    var num = Number(amount);
    if (isNaN(num)) return '₹ ' + amount;
    return '₹ ' + num.toLocaleString('en-IN');
  }

  return {
    TIMEZONE: TIMEZONE,
    formatDateTime: formatDateTime,
    formatDate: formatDate,
    parseDate: parseDate,
    normalizePhone: normalizePhone,
    normalizeEmail: normalizeEmail,
    formatINR: formatINR
  };
})();
