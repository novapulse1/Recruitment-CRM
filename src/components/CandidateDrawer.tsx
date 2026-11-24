import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  MessageCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Building,
  User,
  History,
  AlertTriangle,
  Save,
  Lock,
  ExternalLink,
  Tag,
  Mail,
  MapPin,
  Briefcase,
  IndianRupee,
  RefreshCw
} from 'lucide-react';
import type { Candidate, Client, DropdownOption, Opening, User as AuthUser, AuditLogEntry } from '../types';
import { PIPELINE_STAGES, type PipelineStage } from '../config';
import { api } from '../services/api';

interface CandidateDrawerProps {
  candidateId: string | null;
  onClose: () => void;
  currentUser: AuthUser;
  dropdowns: Record<string, DropdownOption[]>;
  clients?: Client[];
  openings?: Opening[];
  onCandidateUpdated: (updated: Candidate) => void;
}

export const CandidateDrawer: React.FC<CandidateDrawerProps> = ({
  candidateId,
  onClose,
  currentUser,
  dropdowns = {},
  clients = [],
  openings = [],
  onCandidateUpdated
}) => {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [formData, setFormData] = useState<Partial<Candidate>>({});
  const [audits, setAudits] = useState<AuditLogEntry[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [reschedule, setReschedule] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'calling' | 'interview' | 'timeline'>('calling');

  useEffect(() => {
    if (!candidateId) {
      setCandidate(null);
      setFormData({});
      return;
    }
    loadCandidateData(candidateId);
  }, [candidateId]);

  // Keyboard Escape listener and scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (candidateId) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [candidateId, onClose]);

  const loadCandidateData = async (id: string) => {
    try {
      setLoading(true);
      setConflictError(null);
      const res = await api.getCandidate(id);
      setCandidate(res?.candidate || null);
      setFormData(res?.candidate || {});
      setAudits(res?.audits || []);
      setInterviews(res?.interviews || []);
      setReschedule(res?.reschedule || null);
    } catch (e: any) {
      alert('Failed to load candidate: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!candidateId) return null;

  const isHR = currentUser.role === 'HR_RECRUITER' || currentUser.role === 'HR';
  const isManager = currentUser.role === 'RECRUITMENT_MANAGER';
  const isOwnerHR = candidate && String(candidate['HR Email'] || '').toLowerCase() === currentUser.email.toLowerCase();
  const isTeamHR = candidate && (currentUser.teamRecruiterEmails || []).includes(String(candidate['HR Email'] || '').toLowerCase());
  const canEdit = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN' || (isHR && isOwnerHR) || (isManager && (isTeamHR || isOwnerHR));

  const hrAllowedFields = [
    'Designation Applied', 'Current Location', 'Experience', 'Current Salary',
    'Expected Salary', 'Notice Period', 'Source', 'Client Name', 'Industry',
    'Calling Disposition', 'Sub-Disposition', 'Interview Status', 'Interview Date',
    'Selection Status', 'Joining Status', 'Joining Date', 'Remarks', 'Pipeline Stage'
  ];

  const isFieldEditable = (fieldName: string) => {
    if (!canEdit) return false;
    if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN') return true;
    return hrAllowedFields.includes(fieldName);
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => {
      let sanitizedValue = value;
      if (field === 'Mobile Number' || field === 'Alternate Mobile') {
        sanitizedValue = value.replace(/\D/g, '').slice(0, 10);
      }

      const next = { ...prev, [field]: sanitizedValue };

      // Auto-transition: Assigning an HR moves stage from Unassigned to Assigned – Not Called
      if (field === 'Assigned HR' && sanitizedValue) {
        if (!prev['Pipeline Stage'] || prev['Pipeline Stage'] === 'Unassigned') {
          next['Pipeline Stage'] = 'Assigned – Not Called';
        }
      }

      // If client name selected, match clientId from clients master
      if (field === 'Client Name') {
        const matchedClient = clients.find((c) => c.clientName === sanitizedValue);
        if (matchedClient) {
          next.clientId = matchedClient.clientId;
        }
      }

      // Dynamic sub-disposition logic: selecting sub-disp auto-fills Call Status
      if (field === 'Sub-Disposition') {
        const subList = dropdowns['Sub-Disposition'] || [];
        const match = subList.find((s) => s.Option === sanitizedValue);
        if (match && match['Call Status']) {
          next['Call Status'] = match['Call Status'];
        }
      }

      // If calling disposition changed and sub-disp no longer matches parent, clear sub-disp
      if (field === 'Calling Disposition') {
        const subList = dropdowns['Sub-Disposition'] || [];
        const validSubs = subList.filter((s) => s['Parent Disposition'] === sanitizedValue);
        if (validSubs.length > 0 && !validSubs.some((s) => s.Option === prev['Sub-Disposition'])) {
          next['Sub-Disposition'] = validSubs[0].Option;
          if (validSubs[0]['Call Status']) next['Call Status'] = validSubs[0]['Call Status'];
        }
      }

      return next;
    });
  };

  const handleSave = async () => {
    if (!candidate) return;
    try {
      setSaving(true);
      setConflictError(null);

      // Validation: Interview Scheduled requires Interview Date
      const targetStage = formData['Pipeline Stage'] || candidate['Pipeline Stage'];
      const interviewDate = formData['Interview Date'] !== undefined ? formData['Interview Date'] : candidate['Interview Date'];
      if (targetStage === 'Interview Scheduled') {
        if (!interviewDate || interviewDate.trim() === '-' || interviewDate.trim() === '') {
          alert('Interview Date is required when candidate is in "Interview Scheduled" stage.');
          setSaving(false);
          return;
        }
      }

      // Compute patch diff
      const patch: Partial<Candidate> = {};
      for (const k in formData) {
        if (formData[k] !== candidate[k] && !k.startsWith('_')) {
          patch[k] = formData[k];
        }
      }

      if (Object.keys(patch).length === 0) {
        setSuccessToast('No changes detected.');
        setTimeout(() => setSuccessToast(null), 2500);
        setSaving(false);
        return;
      }

      const res = await api.updateCandidate(candidate['Candidate ID'], patch, candidate['Record Version']);
      setSuccessToast('Changes saved successfully!');
      setTimeout(() => setSuccessToast(null), 3000);

      // Reload fresh candidate
      await loadCandidateData(candidate['Candidate ID']);
      const updated = res.updatedCandidate || res.candidate;
      if (updated) {
        onCandidateUpdated(updated);
      }
    } catch (err: any) {
      if (err.statusCode === 409 || err.message?.includes('someone else')) {
        setConflictError('This record was updated by someone else — reload to get the latest version.');
      } else {
        alert('Error saving candidate: ' + err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  // Quick Action Buttons
  const cleanMobile = String(candidate?.['Mobile Number'] || '').replace(/\D/g, '').slice(-10);

  const callingDispositions = dropdowns?.['Calling Disposition'] || [];
  const allSubDispositions = dropdowns?.['Sub-Disposition'] || [];
  const filteredSubDispositions = (allSubDispositions || []).filter((s) =>
    formData['Calling Disposition'] ? s['Parent Disposition'] === formData['Calling Disposition'] : true
  );
  const interviewStatuses = dropdowns?.['Interview Status'] || [];
  const selectionStatuses = dropdowns?.['Selection Status'] || [];
  const joiningStatuses = dropdowns?.['Joining Status'] || [];

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-2xl bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-foreground">
                {candidate ? candidate['Candidate Name'] : 'Candidate Profile'}
              </h2>
              {candidate && (
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono font-medium">
                  {candidate['Candidate ID']}
                </span>
              )}
              {candidate && (
                <select
                  value={formData['Pipeline Stage'] || candidate['Pipeline Stage'] || 'Unassigned'}
                  onChange={(e) => handleFieldChange('Pipeline Stage', e.target.value)}
                  disabled={!canEdit}
                  className="text-xs px-2.5 py-1 rounded-md border border-border bg-background text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:cursor-not-allowed"
                >
                  {PIPELINE_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              )}
            </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Assigned to: <strong className="text-foreground">{candidate?.['Assigned HR'] || 'Unassigned'}</strong>
            {candidate?.['Client Name'] && <> • Client: <strong className="text-foreground">{candidate['Client Name']}</strong></>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Conflict / Notification Banner */}
      {conflictError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/60 border-b border-red-200 dark:border-red-900 text-red-700 dark:text-red-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{conflictError}</span>
          </div>
          <button
            onClick={() => candidate && loadCandidateData(candidate['Candidate ID'])}
            className="px-2.5 py-1 rounded bg-red-600 text-white font-medium hover:bg-red-700 flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" /> Reload
          </button>
        </div>
      )}

      {successToast && (
        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-200 text-xs flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {successToast}
        </div>
      )}

      {/* Quick Action Floating Bar */}
      {candidate && (
        <div className="px-6 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-2">
            {/* Click-to-call */}
            <a
              href={`tel:${cleanMobile}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Phone className="h-3.5 w-3.5" /> Call
            </a>

            {/* WhatsApp */}
            <a
              href={`https://wa.me/91${cleanMobile}?text=Hello%20${encodeURIComponent(candidate['Candidate Name'])},%20regarding%20your%20application%20at%20NovaPulse...`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>

            {/* Quick Status Pill */}
            <span className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
              <Clock className="h-3.5 w-3.5" /> Version: {candidate['Record Version']}
            </span>
          </div>

          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-border px-6">
        {[
          { id: 'calling', label: 'Calling & Status' },
          { id: 'interview', label: 'Interview & Joining' },
          { id: 'details', label: 'Profile Details' },
          { id: 'timeline', label: 'Audit Timeline' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-3 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="py-20 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" /> Loading candidate details...
          </div>
        ) : !candidate ? (
          <div className="text-center py-20 text-muted-foreground">Candidate not found</div>
        ) : (
          <>
            {/* CALLING & DISPOSITION TAB */}
            {activeTab === 'calling' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Calling Disposition */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Calling Disposition
                    </label>
                    <select
                      value={formData['Calling Disposition'] || ''}
                      onChange={(e) => handleFieldChange('Calling Disposition', e.target.value)}
                      disabled={!isFieldEditable('Calling Disposition')}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none disabled:bg-muted"
                    >
                      <option value="">Select Disposition</option>
                      {callingDispositions.map((d) => (
                        <option key={d.Option} value={d.Option}>
                          {d.Option}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sub-Disposition */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Sub-Disposition
                    </label>
                    <select
                      value={formData['Sub-Disposition'] || ''}
                      onChange={(e) => handleFieldChange('Sub-Disposition', e.target.value)}
                      disabled={!isFieldEditable('Sub-Disposition')}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none disabled:bg-muted"
                    >
                      <option value="">Select Sub-Disposition</option>
                      {filteredSubDispositions.map((s) => (
                        <option key={s.Option} value={s.Option}>
                          {s.Option}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Call Status (Auto-filled) */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1">
                      Call Status (Auto)
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formData['Call Status'] || ''}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-muted/60 text-sm text-muted-foreground font-mono outline-none cursor-not-allowed"
                    />
                  </div>

                  {/* Connect Status */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">Connect Status</label>
                    <select
                      value={formData['Connect Status'] || ''}
                      onChange={(e) => handleFieldChange('Connect Status', e.target.value)}
                      disabled={!isFieldEditable('Connect Status')}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none disabled:bg-muted"
                    >
                      <option value="Not Connected">Not Connected</option>
                      <option value="Connect">Connect</option>
                    </select>
                  </div>
                </div>

                {/* Candidate Remarks */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Calling Remarks / Notes
                  </label>
                  <textarea
                    rows={4}
                    value={formData['Remarks'] || ''}
                    onChange={(e) => handleFieldChange('Remarks', e.target.value)}
                    disabled={!isFieldEditable('Remarks')}
                    placeholder="Enter candidate communication notes, callback time, issues, etc..."
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none resize-none disabled:bg-muted"
                  />
                </div>
              </div>
            )}

            {/* INTERVIEW & JOINING TAB */}
            {activeTab === 'interview' && (
              <div className="space-y-6">
                {/* Reschedule alert banner */}
                {reschedule && parseInt(reschedule['Reschedule Count'], 10) >= 2 && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <strong>High Reschedule Alert:</strong> This candidate has been rescheduled{' '}
                      <strong>{reschedule['Reschedule Count']} times</strong>. (First scheduled for{' '}
                      {reschedule['First Scheduled For']}).
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-border p-4 bg-muted/10 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-primary" /> Interview Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">Interview Date</label>
                      <input
                        type="date"
                        value={formData['Interview Date'] ? formData['Interview Date'].split('T')[0] : ''}
                        onChange={(e) => handleFieldChange('Interview Date', e.target.value)}
                        disabled={!isFieldEditable('Interview Date')}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none disabled:bg-muted"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">Interview Status</label>
                      <select
                        value={formData['Interview Status'] || ''}
                        onChange={(e) => handleFieldChange('Interview Status', e.target.value)}
                        disabled={!isFieldEditable('Interview Status')}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none disabled:bg-muted"
                      >
                        <option value="">Select Status</option>
                        {interviewStatuses.map((i) => (
                          <option key={i.Option} value={i.Option}>
                            {i.Option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4 bg-muted/10 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Selection & Joining Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">Selection Status</label>
                      <select
                        value={formData['Selection Status'] || ''}
                        onChange={(e) => handleFieldChange('Selection Status', e.target.value)}
                        disabled={!isFieldEditable('Selection Status')}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none disabled:bg-muted"
                      >
                        <option value="">Select</option>
                        {selectionStatuses.map((s) => (
                          <option key={s.Option} value={s.Option}>
                            {s.Option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">Joining Status</label>
                      <select
                        value={formData['Joining Status'] || ''}
                        onChange={(e) => handleFieldChange('Joining Status', e.target.value)}
                        disabled={!isFieldEditable('Joining Status')}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none disabled:bg-muted"
                      >
                        <option value="">Select</option>
                        {joiningStatuses.map((j) => (
                          <option key={j.Option} value={j.Option}>
                            {j.Option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">Joining Date</label>
                      <input
                        type="date"
                        value={formData['Joining Date'] ? formData['Joining Date'].split('T')[0] : ''}
                        onChange={(e) => handleFieldChange('Joining Date', e.target.value)}
                        disabled={!isFieldEditable('Joining Date')}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none disabled:bg-muted"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DETAILS TAB */}
            {activeTab === 'details' && (
              <div className="space-y-6">
                {/* Personal Information */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Personal & Contact Info
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Candidate Name</label>
                      <input
                        type="text"
                        value={formData['Candidate Name'] || ''}
                        onChange={(e) => handleFieldChange('Candidate Name', e.target.value)}
                        disabled={!isFieldEditable('Candidate Name')}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none disabled:bg-muted"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Mobile Number</label>
                      <input
                        type="text"
                        value={formData['Mobile Number'] || ''}
                        onChange={(e) => handleFieldChange('Mobile Number', e.target.value)}
                        disabled={!isFieldEditable('Mobile Number')}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground font-mono outline-none disabled:bg-muted"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Alternate Mobile</label>
                      <input
                        type="text"
                        value={formData['Alternate Mobile'] || ''}
                        onChange={(e) => handleFieldChange('Alternate Mobile', e.target.value)}
                        disabled={!isFieldEditable('Alternate Mobile')}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground font-mono outline-none disabled:bg-muted"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Email ID</label>
                      <input
                        type="email"
                        value={formData['Email ID'] || ''}
                        onChange={(e) => handleFieldChange('Email ID', e.target.value)}
                        disabled={!isFieldEditable('Email ID')}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none disabled:bg-muted"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Current Location</label>
                      <input
                        type="text"
                        value={formData['Current Location'] || ''}
                        onChange={(e) => handleFieldChange('Current Location', e.target.value)}
                        disabled={!isFieldEditable('Current Location')}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none disabled:bg-muted"
                      />
                    </div>
                  </div>
                </div>

                {/* Job & Experience */}
                <div className="pt-4 border-t border-border">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" /> Job & Commercials
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Designation Applied</label>
                      {openings && openings.length > 0 && isFieldEditable('Designation Applied') ? (
                        <div className="space-y-1.5">
                          <select
                            value={
                              openings.some((o) => o['Position / Role'] === formData['Designation Applied'])
                                ? formData['Designation Applied']
                                : formData['Designation Applied']
                                ? '__CUSTOM__'
                                : ''
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val !== '__CUSTOM__') {
                                const matchedOp = openings.find((o) => o['Position / Role'] === val);
                                handleFieldChange('Designation Applied', val);
                                if (matchedOp && matchedOp['Client Name'] && !formData['Client Name']) {
                                  handleFieldChange('Client Name', matchedOp['Client Name']);
                                }
                              }
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="">Select from Active Openings</option>
                            {openings.map((op) => (
                              <option key={op['Opening ID']} value={op['Position / Role']}>
                                {op['Position / Role']} {op['Client Name'] ? `(${op['Client Name']})` : ''}
                              </option>
                            ))}
                            <option value="__CUSTOM__">Other / Custom Designation</option>
                          </select>
                          {(!openings.some((o) => o['Position / Role'] === formData['Designation Applied']) || !formData['Designation Applied']) && (
                            <input
                              type="text"
                              placeholder="Custom Designation"
                              value={formData['Designation Applied'] || ''}
                              onChange={(e) => handleFieldChange('Designation Applied', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none disabled:bg-muted"
                            />
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={formData['Designation Applied'] || ''}
                          onChange={(e) => handleFieldChange('Designation Applied', e.target.value)}
                          disabled={!isFieldEditable('Designation Applied')}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none disabled:bg-muted"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Client Name</label>
                      {clients && clients.length > 0 && isFieldEditable('Client Name') ? (
                        <select
                          value={formData['Client Name'] || ''}
                          onChange={(e) => handleFieldChange('Client Name', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none disabled:bg-muted"
                        >
                          <option value="">Select Client (from Master)</option>
                          {clients.map((c) => (
                            <option key={c.clientId || c.clientName} value={c.clientName}>
                              {c.clientName} {c.clientId ? `(${c.clientId})` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={formData['Client Name'] || ''}
                          onChange={(e) => handleFieldChange('Client Name', e.target.value)}
                          disabled={!isFieldEditable('Client Name')}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none disabled:bg-muted"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Experience</label>
                      <input
                        type="text"
                        value={formData['Experience'] || ''}
                        onChange={(e) => handleFieldChange('Experience', e.target.value)}
                        disabled={!isFieldEditable('Experience')}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none disabled:bg-muted"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Notice Period</label>
                      <input
                        type="text"
                        value={formData['Notice Period'] || ''}
                        onChange={(e) => handleFieldChange('Notice Period', e.target.value)}
                        disabled={!isFieldEditable('Notice Period')}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none disabled:bg-muted"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Current Salary (₹)</label>
                      <input
                        type="text"
                        value={formData['Current Salary'] || ''}
                        onChange={(e) => handleFieldChange('Current Salary', e.target.value)}
                        disabled={!isFieldEditable('Current Salary')}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none disabled:bg-muted"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Expected Salary (₹)</label>
                      <input
                        type="text"
                        value={formData['Expected Salary'] || ''}
                        onChange={(e) => handleFieldChange('Expected Salary', e.target.value)}
                        disabled={!isFieldEditable('Expected Salary')}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none disabled:bg-muted"
                      />
                    </div>
                  </div>
                </div>

                {/* System Info */}
                <div className="pt-4 border-t border-border text-xs text-muted-foreground space-y-1 bg-muted/20 p-3 rounded-lg">
                  <div>Entry Date: <strong>{candidate['Entry Date']}</strong></div>
                  <div>Last Updated: <strong>{candidate['Last Updated']}</strong> by {candidate['Last Updated By']}</div>
                  <div>Created By: <strong>{candidate['Created By']}</strong></div>
                  {candidate['Duplicate Of'] && (
                    <div className="text-amber-600 font-semibold">Duplicate Of: {candidate['Duplicate Of']}</div>
                  )}
                </div>
              </div>
            )}

            {/* TIMELINE TAB */}
            {activeTab === 'timeline' && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <History className="h-4 w-4" /> Activity & Audit Log
                </h4>

                {!audits || audits.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-xs">
                    No logged changes recorded for this candidate yet.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {(audits || []).map((a, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-card" />
                        <div className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{a.Action}</span>
                            <span className="text-[10px] text-muted-foreground">{a.Timestamp}</span>
                          </div>
                          <div className="text-muted-foreground mt-0.5">
                            By: <span className="font-medium text-foreground">{a['Updated By']}</span>
                          </div>
                          {a['Previous Value'] && (
                            <div className="mt-1 text-[11px] p-2 rounded bg-muted/60 font-mono text-xs">
                              <span className="text-red-500">- {a['Previous Value']}</span>
                              <br />
                              <span className="text-emerald-500">+ {a['New Value']}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </>
  );
};
