/**
 * NovaPulse CRM - Central CSV Export Engine
 *
 * Implements UTF-8 with BOM, robust quote escaping, Excel phone protection
 * (preserves leading zeros & prevents scientific notation), clean number/currency
 * formatting for spreadsheet formulas, and automatic audit logging.
 */

import { api } from '../services/api';
import { parseCurrency, formatDateIST, normalizePhoneNumber } from './formatters';

export interface CSVColumn<T = any> {
  key: string;
  label: string;
  format?: 'text' | 'number' | 'date' | 'standard';
  accessor?: (item: T) => any;
}

/**
 * Format a single cell for Excel-compliant CSV.
 */
function formatCell(val: any, format?: 'text' | 'number' | 'date' | 'standard'): string {
  if (val === null || val === undefined) return '""';

  if (format === 'text') {
    // Excel formula text format: ="..." prevents scientific notation (9.88E+09)
    // and preserves leading zeros (0987654321)
    const cleanStr = String(val).replace(/"/g, '""');
    return `="\\t${cleanStr}"`;
  }

  if (format === 'number') {
    const num = parseCurrency(val);
    return num !== null ? String(num) : '""';
  }

  if (format === 'date') {
    const dStr = formatDateIST(val);
    return `"${dStr.replace(/"/g, '""')}"`;
  }

  // Standard string escaping
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Generates and downloads a CSV file with UTF-8 BOM and audit trail logging.
 */
export async function downloadCSV<T = any>({
  filename,
  columns,
  data,
  moduleName,
  currentUserEmail
}: {
  filename: string;
  columns: CSVColumn<T>[];
  data: T[];
  moduleName: string;
  currentUserEmail?: string;
}) {
  const headerRow = columns.map((col) => `"${col.label.replace(/"/g, '""')}"`).join(',');

  const rows = data.map((item) => {
    return columns
      .map((col) => {
        const rawValue = col.accessor ? col.accessor(item) : (item as any)[col.key];
        return formatCell(rawValue, col.format);
      })
      .join(',');
  });

  // Prepend UTF-8 BOM (\uFEFF) so Excel opens UTF-8 without garbled characters
  const csvContent = '\uFEFF' + [headerRow, ...rows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Log audit trail entry
  try {
    await api.logAuditEntry({
      Timestamp: new Date().toLocaleString('en-GB'),
      Action: 'CSV_EXPORT',
      'Action Type': 'EXPORT',
      'Candidate ID': '-',
      'Candidate Name': `${data.length} records exported`,
      'Previous Value': 'UI View',
      'New Value': `${filename} (${data.length} rows)`,
      'Updated By': currentUserEmail || 'system',
      'HR Name': currentUserEmail || 'Admin',
      'Source Spreadsheet': moduleName.toUpperCase()
    });
  } catch (err) {
    console.warn('[CSV Export] Failed to log audit trail:', err);
  }
}
