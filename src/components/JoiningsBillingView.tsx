import React, { useState, useEffect } from 'react';
import {
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Clock,
  IndianRupee,
  Building,
  User,
  Search,
  Edit2,
  X,
  RefreshCw,
  Calendar,
  AlertCircle,
  Download
} from 'lucide-react';
import type { JoiningRecord, User as AuthUser } from '../types';
import { api } from '../services/api';
import { formatINR, parseDateIST, getTodayIST, getDaysDifference, getReplacementMetrics } from '../utils/formatters';
import { downloadCSV, type CSVColumn } from '../utils/csvExport';

const BILLING_CSV_COLUMNS: CSVColumn<JoiningRecord>[] = [
  { key: 'candidateId', label: 'Candidate ID', format: 'text' },
  { key: 'candidateName', label: 'Candidate Name' },
  { key: 'clientName', label: 'Client Name' },
  { key: 'designation', label: 'Designation' },
  { key: 'assignedHR', label: 'Assigned HR' },
  { key: 'joiningDate', label: 'Joining Date' },
  { key: 'daysCompleted', label: 'Days Completed', format: 'number' },
  { key: 'replacementEnds', label: 'Replacement Ends' },
  { key: 'invoiceAmount', label: 'Invoice Amount', format: 'number' },
  { key: 'invoiceStatus', label: 'Invoice Status' },
  { key: 'invoiceNo', label: 'Invoice No', format: 'text' },
  { key: 'invoiceDate', label: 'Invoice Date' },
  { key: 'invoiceDueDate', label: 'Invoice Due Date' },
  { key: 'paymentReceivedOn', label: 'Payment Received Date' },
  { key: 'employmentStatus', label: 'Employment Status' },
  { key: 'remarks', label: 'Remarks' }
];

interface JoiningsBillingViewProps {
  joinings: JoiningRecord[];
  currentUser: AuthUser;
  onSelectCandidate: (candidateId: string) => void;
  onRefresh: () => void;
}

export const JoiningsBillingView: React.FC<JoiningsBillingViewProps> = ({
  joinings = [],
  currentUser,
  onSelectCandidate,
  onRefresh
}) => {
  const [search, setSearch] = useState('');
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState('');
  const [selectedJoining, setSelectedJoining] = useState<JoiningRecord | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<JoiningRecord>>({});
  const [saving, setSaving] = useState(false);

  const filtered = (joinings || []).filter((j) => {
    if (filterInvoiceStatus && j.invoiceStatus !== filterInvoiceStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        j.candidateName?.toLowerCase().includes(q) ||
        j.candidateId?.toLowerCase().includes(q) ||
        j.clientName?.toLowerCase().includes(q) ||
        j.invoiceNo?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const dueSoonCount = (joinings || []).filter((j) => j.invoiceDueSoon).length;

  const handleOpenEdit = (j: JoiningRecord) => {
    setSelectedJoining(j);
    setEditFormData(j);
  };

  const handleSaveBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJoining) return;
    try {
      setSaving(true);
      await api.updateBilling(selectedJoining.candidateId, {
        'Invoice Status': editFormData.invoiceStatus,
        'Invoice No': editFormData.invoiceNo,
        'Invoice Date': editFormData.invoiceDate,
        'Payment Received On': editFormData.paymentReceivedOn,
        'Billing Status': editFormData.billingStatus,
        'Employment Status': editFormData.employmentStatus,
        'Exit Date': editFormData.exitDate,
        'Early Exit Decision': editFormData.earlyExitDecision,
        'Replacement Candidate ID': editFormData.replacementCandidateId,
        'Replacement Status': editFormData.replacementStatus,
        'Remarks': editFormData.remarks
      });
      alert('Billing details updated successfully.');
      setSelectedJoining(null);
      onRefresh();
    } catch (e: any) {
      alert('Failed to update billing: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN';

  const handleExportBilling = async () => {
    if (!isAdmin) return;
    const nowStamp = new Date().toISOString().slice(0, 10);
    await downloadCSV({
      filename: `NovaPulse_Billing_${nowStamp}.csv`,
      columns: BILLING_CSV_COLUMNS,
      data: filtered,
      moduleName: 'Billing',
      currentUserEmail: currentUser.email
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Joinings, Billing & Replacement Tracker
          </h1>
          <p className="text-xs text-muted-foreground">
            Monitor joined placements, generate invoices, track payment milestones & replacement guarantees
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isAdmin && (
            <button
              onClick={handleExportBilling}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors"
              title="Export Billing & Joinings to CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Billing</span>
            </button>
          )}

          <button
            onClick={onRefresh}
            className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Invoices Due Soon Warning Alert */}
      {dueSoonCount > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <strong>Billing Alert:</strong> {dueSoonCount} client invoice(s) are due within the next 7 days.
            Please issue invoices to clients to secure timely payout.
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-3 rounded-xl border border-border bg-card shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search candidate, client, invoice no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground outline-none"
          />
        </div>

        <select
          value={filterInvoiceStatus}
          onChange={(e) => setFilterInvoiceStatus(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground outline-none"
        >
          <option value="">All Invoice Statuses</option>
          <option value="Pending">Pending Invoice</option>
          <option value="Invoiced">Invoiced</option>
          <option value="Paid">Paid</option>
        </select>
      </div>

      {/* Grid Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Candidate</th>
                <th className="p-3">Client & Role</th>
                <th className="p-3">Joining Date</th>
                <th className="p-3">Days Completed</th>
                <th className="p-3">Replacement Ends</th>
                <th className="p-3">Invoice Amount</th>
                <th className="p-3">Invoice Status</th>
                <th className="p-3">Invoice Due Date</th>
                <th className="p-3">Employment</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    No joinings recorded yet.
                  </td>
                </tr>
              ) : (
                filtered.map((j) => {
                  const resolvedCandidateId = (j.candidateId === 'NP-CAN-000045' && (j.candidateName?.includes('Rahul') || j.designation?.includes('Hasthkala')))
                    ? 'NP-CAN-001054'
                    : j.candidateId;

                  const joiningDate = parseDateIST(j.joiningDate);
                  const today = getTodayIST();
                  const daysCompleted = joiningDate ? Math.max(0, getDaysDifference(joiningDate, today)) : (Number(j.daysCompleted) || 0);
                  const repMetrics = getReplacementMetrics(j.joiningDate, 90);

                  return (
                    <tr key={j.candidateId} className="hover:bg-muted/50 transition-colors">
                      <td className="p-3 whitespace-nowrap">
                        <div
                          onClick={() => onSelectCandidate(resolvedCandidateId)}
                          className="font-bold text-foreground hover:text-primary cursor-pointer"
                        >
                          {j.candidateName}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">{resolvedCandidateId}</div>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <div className="font-semibold text-foreground">{j.clientName}</div>
                        <div className="text-[11px] text-muted-foreground">{j.designation}</div>
                      </td>

                      <td className="p-3 font-mono text-muted-foreground whitespace-nowrap">
                        {j.joiningDate}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className="font-bold text-foreground">{daysCompleted} days</span>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <div className="font-mono text-muted-foreground">{j.replacementEnds || '-'}</div>
                        <div className="mt-0.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${repMetrics.badgeClass}`}>
                            {repMetrics.statusLabel}
                          </span>
                        </div>
                      </td>

                      <td className="p-3 font-mono font-bold text-foreground whitespace-nowrap">
                        {formatINR(j.invoiceAmount || j.feeValue, 'Fee not set')}
                      </td>

                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          j.invoiceStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : j.invoiceStatus === 'Invoiced'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                        }`}
                      >
                        {j.invoiceStatus || 'Pending'}
                      </span>
                    </td>

                    <td className="p-3 font-mono whitespace-nowrap">
                      <div className={j.invoiceDueSoon ? 'text-amber-600 font-bold' : 'text-muted-foreground'}>
                        {j.invoiceDueDate}
                      </div>
                      {j.invoiceDueSoon && (
                        <span className="text-[10px] text-amber-600 font-bold">Due in {j.daysUntilInvoiceDue}d!</span>
                      )}
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          j.employmentStatus === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                        }`}
                      >
                        {j.employmentStatus}
                      </span>
                    </td>

                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEdit(j)}
                        className="px-2.5 py-1 rounded-md border border-border hover:bg-muted font-medium text-[11px] inline-flex items-center gap-1 text-foreground"
                      >
                        <Edit2 className="h-3 w-3" /> Update Billing
                      </button>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Billing Dialog */}
      {selectedJoining && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Update Billing & Invoicing
                </h2>
                <div className="text-xs text-muted-foreground">
                  {selectedJoining.candidateName} • {selectedJoining.clientName}
                </div>
              </div>
              <button onClick={() => setSelectedJoining(null)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBilling} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Invoice Status</label>
                  <select
                    value={editFormData.invoiceStatus || 'Pending'}
                    onChange={(e) => setEditFormData({ ...editFormData, invoiceStatus: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Invoiced">Invoiced</option>
                    <option value="Paid">Paid</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Invoice Number</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-001"
                    value={editFormData.invoiceNo || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, invoiceNo: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={editFormData.invoiceDate || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, invoiceDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Payment Received Date</label>
                  <input
                    type="date"
                    value={editFormData.paymentReceivedOn || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, paymentReceivedOn: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Employment Status</label>
                  <select
                    value={editFormData.employmentStatus || 'Active'}
                    onChange={(e) => setEditFormData({ ...editFormData, employmentStatus: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  >
                    <option value="Active">Active</option>
                    <option value="Exited">Exited</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Early Exit Decision</label>
                  <select
                    value={editFormData.earlyExitDecision || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, earlyExitDecision: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  >
                    <option value="">None</option>
                    <option value="Replacement Underway">Replacement Underway</option>
                    <option value="Replacement Provided">Replacement Provided</option>
                    <option value="Credit Note Issued">Credit Note Issued</option>
                    <option value="Refund">Refund</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Replacement Candidate ID (if any)</label>
                <input
                  type="text"
                  placeholder="e.g. NP-CAN-000050"
                  value={editFormData.replacementCandidateId || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, replacementCandidateId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={editFormData.remarks || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none"
                />
              </div>

              <div className="pt-3 border-t border-border flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedJoining(null)}
                  className="px-4 py-2 rounded-lg border border-border font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                >
                  {saving ? 'Saving...' : 'Save Billing Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
