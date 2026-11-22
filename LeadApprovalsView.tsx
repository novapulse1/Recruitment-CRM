import React, { useState } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Merge,
  AlertTriangle,
  User,
  Phone,
  Mail,
  Building,
  Briefcase,
  CheckSquare,
  Square,
  Search,
  RefreshCw,
  Send,
  Lock
} from 'lucide-react';
import type { LeadItem, HRRecord, User as AuthUser } from '../types';
import { api } from '../services/api';
import { can } from '../services/permissions';

interface LeadApprovalsViewProps {
  leads: LeadItem[];
  hrs: HRRecord[];
  currentUser?: AuthUser;
  onRefresh: () => void;
}

export const LeadApprovalsView: React.FC<LeadApprovalsViewProps> = ({
  leads,
  hrs,
  currentUser,
  onRefresh
}) => {
  const canApprove = currentUser ? can(currentUser, 'leads.approve') : true;
  const canReject = currentUser ? can(currentUser, 'leads.reject') : true;
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [targetHR, setTargetHR] = useState<{ name: string; email: string } | null>(null);
  const [targetCandidateId, setTargetCandidateId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'MERGE' | null>(null);

  const pendingLeads = leads.filter((l) => (l.Status || 'Pending') === 'Pending');

  const handleSelectAll = () => {
    if (selectedLeadIds.length === pendingLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(pendingLeads.map((l) => l['Lead ID']));
    }
  };

  const handleToggleLead = (id: string) => {
    setSelectedLeadIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleOpenAction = (lead: LeadItem, type: 'APPROVE' | 'REJECT' | 'MERGE') => {
    setSelectedLead(lead);
    setActionType(type);
    setAdminNote('');
    setTargetCandidateId(lead['Duplicate Of'] || '');
    const matchedHR = hrs.find((h) => h['HR Name'] === lead['Submitted By HR']);
    setTargetHR(matchedHR ? { name: matchedHR['HR Name'], email: matchedHR['HR Email'] } : null);
  };

  const executeAction = async () => {
    if (!selectedLead || !actionType) return;
    try {
      setProcessing(true);
      if (actionType === 'APPROVE') {
        const res = await api.approveLead(selectedLead['Lead ID'], targetHR || undefined, adminNote);
        alert(`Lead ${selectedLead['Lead ID']} approved! Candidate ID ${res.candidateId} generated.`);
      } else if (actionType === 'REJECT') {
        await api.rejectLead(selectedLead['Lead ID'], adminNote);
        alert(`Lead ${selectedLead['Lead ID']} rejected.`);
      } else if (actionType === 'MERGE') {
        if (!targetCandidateId) return alert('Target candidate ID is required for merge.');
        await api.mergeLead(selectedLead['Lead ID'], targetCandidateId, adminNote);
        alert(`Lead ${selectedLead['Lead ID']} merged into ${targetCandidateId}.`);
      }

      setSelectedLead(null);
      setActionType(null);
      onRefresh();
    } catch (e: any) {
      alert('Action failed: ' + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedLeadIds.length === 0) return;
    if (!confirm(`Are you sure you want to bulk approve ${selectedLeadIds.length} lead(s)?`)) return;

    try {
      setProcessing(true);
      for (const id of selectedLeadIds) {
        await api.approveLead(id);
      }
      alert(`Approved ${selectedLeadIds.length} leads successfully!`);
      setSelectedLeadIds([]);
      onRefresh();
    } catch (e: any) {
      alert('Bulk approval error: ' + e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-primary" />
            Lead Approvals Queue
          </h1>
          <p className="text-xs text-muted-foreground">
            {pendingLeads.length} candidate lead{pendingLeads.length === 1 ? '' : 's'} awaiting management decision
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedLeadIds.length > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={processing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/20"
            >
              <CheckCircle2 className="h-4 w-4" /> Bulk Approve ({selectedLeadIds.length})
            </button>
          )}

          <button
            onClick={onRefresh}
            className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground"
            title="Refresh Leads"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Leads Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3 w-10 text-center">
                  <button onClick={handleSelectAll}>
                    {selectedLeadIds.length === pendingLeads.length && pendingLeads.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </th>
                <th className="p-3">Lead ID</th>
                <th className="p-3">Candidate Name</th>
                <th className="p-3">Phone & Email</th>
                <th className="p-3">Role & Client</th>
                <th className="p-3">Submitted By</th>
                <th className="p-3">Duplicate Warning</th>
                <th className="p-3">Received</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pendingLeads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    All clear! No pending leads awaiting approval.
                  </td>
                </tr>
              ) : (
                pendingLeads.map((lead) => {
                  const isSelected = selectedLeadIds.includes(lead['Lead ID']);
                  const hasDuplicate = !!lead['Duplicate Of'];
                  return (
                    <tr
                      key={lead['Lead ID']}
                      className={`hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                    >
                      <td className="p-3 text-center" onClick={() => handleToggleLead(lead['Lead ID'])}>
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold text-foreground whitespace-nowrap">
                        {lead['Lead ID']}
                      </td>
                      <td className="p-3 font-semibold text-foreground whitespace-nowrap">
                        {lead['Candidate Name']}
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        <div>{lead['Mobile Number']}</div>
                        <div className="text-[11px]">{lead['Email ID'] || '-'}</div>
                      </td>
                      <td className="p-3 text-foreground whitespace-nowrap">
                        <div className="font-medium">{lead['Designation'] || 'General'}</div>
                        <div className="text-[11px] text-muted-foreground">{lead['Client Name'] || '-'}</div>
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        <div className="font-semibold text-foreground">{lead['Submitted By HR']}</div>
                        <div className="text-[10px]">HR Recruiter</div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {hasDuplicate ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                            <AlertTriangle className="h-3 w-3 text-amber-600" /> Matches {lead['Duplicate Of']}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Unique
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap text-[11px]">
                        {lead['Received']}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {canApprove ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenAction(lead, 'APPROVE')}
                              className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] flex items-center gap-1 shadow-sm"
                            >
                              <CheckCircle2 className="h-3 w-3" /> Approve
                            </button>
                            {hasDuplicate && (
                              <button
                                onClick={() => handleOpenAction(lead, 'MERGE')}
                                className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[11px] flex items-center gap-1 shadow-sm"
                              >
                                <Merge className="h-3 w-3" /> Merge
                              </button>
                            )}
                            {canReject && (
                              <button
                                onClick={() => handleOpenAction(lead, 'REJECT')}
                                className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium text-[11px] flex items-center gap-1 shadow-sm"
                              >
                                <XCircle className="h-3 w-3" /> Reject
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic flex items-center justify-end gap-1">
                            <Lock className="w-3 h-3" /> Awaiting Admin Approval
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Dialog */}
      {selectedLead && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                {actionType === 'APPROVE' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                {actionType === 'REJECT' && <XCircle className="h-5 w-5 text-red-600" />}
                {actionType === 'MERGE' && <Merge className="h-5 w-5 text-indigo-600" />}
                {actionType} Candidate Lead ({selectedLead['Lead ID']})
              </h2>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs space-y-1">
              <div>Candidate: <strong>{selectedLead['Candidate Name']}</strong></div>
              <div>Phone: <strong>{selectedLead['Mobile Number']}</strong> • Role: <strong>{selectedLead['Designation']}</strong></div>
              <div>Client: <strong>{selectedLead['Client Name']}</strong></div>
              <div>Submitted by HR: <strong>{selectedLead['Submitted By HR']}</strong></div>
              {selectedLead['Remarks'] && (
                <div className="pt-1 text-muted-foreground">Remarks: {selectedLead['Remarks']}</div>
              )}
            </div>

            {/* If Approve: option to assign to different HR */}
            {actionType === 'APPROVE' && (
              <div>
                <label className="block text-xs font-semibold mb-1">Assign to HR</label>
                <select
                  value={targetHR ? targetHR.name : ''}
                  onChange={(e) => {
                    const found = hrs.find((h) => h['HR Name'] === e.target.value);
                    setTargetHR(found ? { name: found['HR Name'], email: found['HR Email'] } : null);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none"
                >
                  {hrs.map((h) => (
                    <option key={h['HR ID']} value={h['HR Name']}>
                      {h['HR Name']} ({h['HR Email']})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* If Merge: target candidate ID */}
            {actionType === 'MERGE' && (
              <div>
                <label className="block text-xs font-semibold mb-1">Target Candidate ID to merge into *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NP-CAN-000043"
                  value={targetCandidateId}
                  onChange={(e) => setTargetCandidateId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1">Admin Decision Note</label>
              <textarea
                rows={3}
                placeholder="Optional notes explaining the decision..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none"
              />
            </div>

            <div className="pt-3 border-t border-border flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeAction}
                disabled={processing}
                className={`px-5 py-2 rounded-lg text-white text-xs font-semibold ${
                  actionType === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : actionType === 'MERGE'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {processing ? 'Processing...' : `Confirm ${actionType}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
