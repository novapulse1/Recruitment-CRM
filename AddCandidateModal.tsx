import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  UserPlus,
  Building,
  Phone,
  Mail,
  Briefcase,
  IndianRupee,
  CheckCircle2,
  Send
} from 'lucide-react';
import type { Candidate, DropdownOption, User } from '../types';
import { api } from '../services/api';
import { can } from '../services/permissions';

interface AddCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  candidates: Candidate[];
  dropdowns: Record<string, DropdownOption[]>;
  initialData?: Partial<Candidate>;
  onCandidateAdded: () => void;
}

export const AddCandidateModal: React.FC<AddCandidateModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  candidates,
  dropdowns,
  initialData,
  onCandidateAdded
}) => {
  const [formData, setFormData] = useState<Partial<Candidate>>({
    'Candidate Name': '',
    'Mobile Number': '',
    'Alternate Mobile': '',
    'Email ID': '',
    'Designation Applied': '',
    'Current Location': '',
    'Experience': '',
    'Current Salary': '',
    'Expected Salary': '',
    'Notice Period': '',
    'Source': 'Apna',
    'Client Name': '',
    'Industry': '',
    'Remarks': ''
  });

  const [duplicateMatch, setDuplicateMatch] = useState<Candidate | null>(null);
  const [matchField, setMatchField] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [allowOverride, setAllowOverride] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  if (!isOpen) return null;

  // Real-time live duplicate check
  const checkDuplicate = (phone: string, altPhone: string, email: string) => {
    const cleanP = phone ? phone.replace(/\D/g, '').slice(-10) : '';
    const cleanAlt = altPhone ? altPhone.replace(/\D/g, '').slice(-10) : '';
    const cleanE = email ? email.trim().toLowerCase() : '';

    if (!cleanP && !cleanAlt && !cleanE) {
      setDuplicateMatch(null);
      setMatchField('');
      return;
    }

    const match = candidates.find((c) => {
      const cP = String(c['Mobile Number'] || '').replace(/\D/g, '').slice(-10);
      const cAlt = String(c['Alternate Mobile'] || '').replace(/\D/g, '').slice(-10);
      const cE = String(c['Email ID'] || '').trim().toLowerCase();

      if (cleanP && (cleanP === cP || cleanP === cAlt)) {
        setMatchField('Mobile Number');
        return true;
      }
      if (cleanAlt && (cleanAlt === cP || cleanAlt === cAlt)) {
        setMatchField('Alternate Mobile');
        return true;
      }
      if (cleanE && cleanE !== '-' && cleanE === cE) {
        setMatchField('Email ID');
        return true;
      }
      return false;
    });

    if (match) {
      setDuplicateMatch(match);
    } else {
      setDuplicateMatch(null);
      setMatchField('');
    }
  };

  const handleChange = (field: string, value: string) => {
    const next = { ...formData, [field]: value };
    setFormData(next);

    if (field === 'Mobile Number' || field === 'Alternate Mobile' || field === 'Email ID') {
      checkDuplicate(
        field === 'Mobile Number' ? value : formData['Mobile Number'] || '',
        field === 'Alternate Mobile' ? value : formData['Alternate Mobile'] || '',
        field === 'Email ID' ? value : formData['Email ID'] || ''
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData['Candidate Name'] || !formData['Mobile Number']) {
      alert('Candidate Name and Mobile Number are required.');
      return;
    }

    if (duplicateMatch && !allowOverride) {
      alert('Cannot add duplicate candidate. Contact management or admin.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createCandidate(formData, allowOverride);

      if (!res.success && res.isDuplicate) {
        alert(res.message || 'Duplicate detected.');
        setSubmitting(false);
        return;
      }

      alert(
        currentUser.role === 'HR'
          ? 'Lead submitted for management approval!'
          : `Candidate added successfully with ID ${res.candidateId}`
      );
      onCandidateAdded();
      onClose();
    } catch (err: any) {
      alert('Error adding candidate: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const industries = dropdowns['Industry'] || [];
  const sources = ['Apna', 'Naukri', 'Indeed', 'LinkedIn', 'Referral', 'Walk-in', 'Direct Application', 'Vendor'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              {currentUser.role === 'HR' ? 'Submit Candidate Lead' : 'Add Candidate (Direct to Master)'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* HR Notice Banner */}
        {currentUser.role === 'HR' && (
          <div className="px-6 py-2.5 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs">
            <strong>Recruiter Protocol:</strong> Candidates submitted by HR are queued in{' '}
            <strong>Lead Approvals</strong> for admin review before entering Master Data.
          </div>
        )}

        {/* Live Duplicate Warning Card */}
        {duplicateMatch && (
          <div className="px-6 py-3 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold">Duplicate Candidate Match Detected ({matchField})!</div>
              <div className="mt-1 space-y-0.5 text-[11px]">
                <div>
                  Existing Candidate:{' '}
                  <strong>
                    {duplicateMatch['Candidate Name']} ({duplicateMatch['Candidate ID']})
                  </strong>
                </div>
                <div>
                  Owner HR: <strong>{duplicateMatch['Assigned HR']}</strong> ({duplicateMatch['HR Email']})
                </div>
                <div>
                  Client: <strong>{duplicateMatch['Client Name'] || 'None'}</strong> • Stage:{' '}
                  <strong>{duplicateMatch['Pipeline Stage']}</strong>
                </div>
              </div>

              {can(currentUser, 'duplicates.override') ? (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="override"
                    checked={allowOverride}
                    onChange={(e) => setAllowOverride(e.target.checked)}
                    className="rounded border-amber-400 text-primary"
                  />
                  <label htmlFor="override" className="font-semibold cursor-pointer">
                    Super Admin Override (Force-create duplicate and link to existing record)
                  </label>
                </div>
              ) : (
                <div className="mt-1 font-semibold text-red-600 dark:text-red-400">
                  Duplicate candidate detected. Only Super Admin has authority to override duplicate restrictions.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Candidate Name *
              </label>
              <input
                type="text"
                required
                placeholder="Full Name"
                value={formData['Candidate Name']}
                onChange={(e) => handleChange('Candidate Name', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Mobile Number *
              </label>
              <input
                type="text"
                required
                placeholder="10-digit mobile"
                value={formData['Mobile Number']}
                onChange={(e) => handleChange('Mobile Number', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground font-mono outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Alternate Mobile
              </label>
              <input
                type="text"
                placeholder="Optional"
                value={formData['Alternate Mobile']}
                onChange={(e) => handleChange('Alternate Mobile', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground font-mono outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Email ID</label>
              <input
                type="email"
                placeholder="candidate@email.com"
                value={formData['Email ID']}
                onChange={(e) => handleChange('Email ID', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Designation Applied
              </label>
              <input
                type="text"
                placeholder="e.g. MIS Executive"
                value={formData['Designation Applied']}
                onChange={(e) => handleChange('Designation Applied', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Client Name</label>
              <input
                type="text"
                placeholder="e.g. Basecop Luxgery"
                value={formData['Client Name']}
                onChange={(e) => handleChange('Client Name', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Current Location
              </label>
              <input
                type="text"
                placeholder="City / Area"
                value={formData['Current Location']}
                onChange={(e) => handleChange('Current Location', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Experience</label>
              <input
                type="text"
                placeholder="e.g. 2 Years"
                value={formData['Experience']}
                onChange={(e) => handleChange('Experience', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Current Monthly Salary (₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 20000"
                value={formData['Current Salary']}
                onChange={(e) => handleChange('Current Salary', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Expected Monthly Salary (₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 25000"
                value={formData['Expected Salary']}
                onChange={(e) => handleChange('Expected Salary', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Notice Period</label>
              <input
                type="text"
                placeholder="e.g. Immediate / 15 Days"
                value={formData['Notice Period']}
                onChange={(e) => handleChange('Notice Period', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Source</label>
              <select
                value={formData['Source']}
                onChange={(e) => handleChange('Source', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              >
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-foreground mb-1">Industry</label>
              <select
                value={formData['Industry']}
                onChange={(e) => handleChange('Industry', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select Industry</option>
                {industries.map((ind) => (
                  <option key={ind.Option} value={ind.Option}>
                    {ind.Option}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-foreground mb-1">Remarks</label>
              <textarea
                rows={2}
                placeholder="Any special remarks or background information..."
                value={formData['Remarks']}
                onChange={(e) => handleChange('Remarks', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none resize-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (!!duplicateMatch && currentUser.role !== 'ADMIN' && !allowOverride)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-md shadow-primary/20"
            >
              {currentUser.role === 'HR' ? (
                <>
                  <Send className="h-3.5 w-3.5" />
                  {submitting ? 'Submitting...' : 'Submit Lead for Approval'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {submitting ? 'Adding...' : 'Add to Master Data'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
