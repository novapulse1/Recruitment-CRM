import React, { useState } from 'react';
import {
  Briefcase,
  Building2,
  MapPin,
  Clock,
  IndianRupee,
  Users,
  Search,
  Filter,
  Plus,
  Edit2,
  X,
  UserPlus,
  CheckCircle2
} from 'lucide-react';
import type { Opening, User } from '../types';
import { api } from '../services/api';

interface OpeningsViewProps {
  openings: Opening[];
  currentUser: User;
  onLineUpCandidate: (opening: Opening) => void;
  onRefresh: () => void;
}

export const OpeningsView: React.FC<OpeningsViewProps> = ({
  openings,
  currentUser,
  onLineUpCandidate,
  onRefresh
}) => {
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('Open');
  const [selectedOpening, setSelectedOpening] = useState<Opening | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Opening>>({});

  const filtered = openings.filter((op) => {
    if (filterStatus && String(op['Status']).toLowerCase() !== filterStatus.toLowerCase()) return false;
    if (filterCity && !op['Job Location (City)']?.toLowerCase().includes(filterCity.toLowerCase())) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        op['Opening ID']?.toLowerCase().includes(q) ||
        op['Position / Role']?.toLowerCase().includes(q) ||
        op['Client Name']?.toLowerCase().includes(q) ||
        op['Skills Required']?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleOpenAdd = () => {
    setEditFormData({
      'Status': 'Open',
      'Position / Role': '',
      'Client Name': '',
      'Job Location (City)': '',
      'Office / Interview Address': '',
      'Skills Required': '',
      'Qualification': 'Graduate',
      'Experience Required': '1–3 years',
      'Salary Slab (₹ / month)': '',
      'No. of Vacancies': '1',
      'Shift / Timings': 'Day Shift',
      'Working Days': 'Mon–Sat',
      'Interview Mode / Process': 'Face to Face',
      'Other Details / Perks': ''
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (op: Opening) => {
    setEditFormData(op);
    setIsEditModalOpen(true);
  };

  const handleSaveOpening = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveOpening(editFormData);
      alert('Opening saved successfully.');
      setIsEditModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert('Error saving opening: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Active Job Openings
          </h1>
          <p className="text-xs text-muted-foreground">
            {filtered.length} active mandate{filtered.length === 1 ? '' : 's'} across clients
          </p>
        </div>

        {currentUser.role === 'ADMIN' && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4" /> Add Opening
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded-xl border border-border bg-card shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search role, skills, client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground outline-none"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground outline-none"
        >
          <option value="">All Statuses</option>
          <option value="Open">Open Only</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((op) => (
          <div
            key={op['Opening ID']}
            className="p-5 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                    {op['Opening ID']}
                  </span>
                  <h3 className="font-bold text-base text-foreground mt-1.5 leading-snug">
                    {op['Position / Role']}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary mt-0.5">
                    <Building2 className="h-3.5 w-3.5" /> {op['Client Name']}
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    op['Status'] === 'Open'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {op['Status']}
                </span>
              </div>

              {/* Location & Perks */}
              <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{op['Job Location (City)'] || 'Not specified'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <IndianRupee className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-semibold text-foreground">{op['Salary Slab (₹ / month)']}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{op['No. of Vacancies']} Vacanc{op['No. of Vacancies'] === 1 ? 'y' : 'ies'}</span>
                </div>
              </div>

              {/* Skills */}
              {op['Skills Required'] && (
                <div className="mt-3 text-[11px] bg-muted/30 p-2.5 rounded-lg border border-border/50 text-muted-foreground line-clamp-2">
                  <strong>Skills:</strong> {op['Skills Required']}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
              <button
                onClick={() => setSelectedOpening(op)}
                className="text-xs text-muted-foreground hover:text-foreground font-medium"
              >
                View Details
              </button>

              <div className="flex items-center gap-2">
                {currentUser.role === 'ADMIN' && (
                  <button
                    onClick={() => handleOpenEdit(op)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                    title="Edit Opening"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Line Up Candidate Button */}
                <button
                  onClick={() => onLineUpCandidate(op)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Line up
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Opening Details Modal */}
      {selectedOpening && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono text-muted-foreground font-semibold">
                  {selectedOpening['Opening ID']}
                </span>
                <h2 className="text-lg font-bold text-foreground mt-1">
                  {selectedOpening['Position / Role']}
                </h2>
                <div className="text-sm font-semibold text-primary">{selectedOpening['Client Name']}</div>
              </div>
              <button onClick={() => setSelectedOpening(null)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-muted/20 p-4 rounded-xl border border-border">
              <div><strong>Location:</strong> {selectedOpening['Job Location (City)']}</div>
              <div><strong>Salary:</strong> {selectedOpening['Salary Slab (₹ / month)']}</div>
              <div><strong>Experience:</strong> {selectedOpening['Experience Required']}</div>
              <div><strong>Qualification:</strong> {selectedOpening['Qualification']}</div>
              <div><strong>Timings:</strong> {selectedOpening['Shift / Timings']}</div>
              <div><strong>Working Days:</strong> {selectedOpening['Working Days']}</div>
              <div><strong>Vacancies:</strong> {selectedOpening['No. of Vacancies']}</div>
              <div><strong>Process:</strong> {selectedOpening['Interview Mode / Process']}</div>
            </div>

            {selectedOpening['Office / Interview Address'] && (
              <div className="text-xs space-y-1">
                <strong>Interview / Office Address:</strong>
                <p className="text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  {selectedOpening['Office / Interview Address']}
                </p>
              </div>
            )}

            {selectedOpening['Skills Required'] && (
              <div className="text-xs space-y-1">
                <strong>Skills Required:</strong>
                <p className="text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  {selectedOpening['Skills Required']}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setSelectedOpening(null)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const op = selectedOpening;
                  setSelectedOpening(null);
                  onLineUpCandidate(op);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
              >
                <UserPlus className="h-4 w-4" /> Line up Candidate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Add/Edit Opening Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground">
                {editFormData['Opening ID'] ? `Edit Opening (${editFormData['Opening ID']})` : 'New Opening'}
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOpening} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Role / Position *</label>
                  <input
                    type="text"
                    required
                    value={editFormData['Position / Role'] || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, 'Position / Role': e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Client Name *</label>
                  <input
                    type="text"
                    required
                    value={editFormData['Client Name'] || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, 'Client Name': e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Location (City)</label>
                  <input
                    type="text"
                    value={editFormData['Job Location (City)'] || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, 'Job Location (City)': e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Salary Slab (₹ / month)</label>
                  <input
                    type="text"
                    value={editFormData['Salary Slab (₹ / month)'] || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, 'Salary Slab (₹ / month)': e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Status</label>
                  <select
                    value={editFormData['Status'] || 'Open'}
                    onChange={(e) => setEditFormData({ ...editFormData, Status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  >
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                    <option value="Hold">Hold</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">No. of Vacancies</label>
                  <input
                    type="number"
                    value={editFormData['No. of Vacancies'] || '1'}
                    onChange={(e) => setEditFormData({ ...editFormData, 'No. of Vacancies': e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Office / Interview Address</label>
                <textarea
                  rows={2}
                  value={editFormData['Office / Interview Address'] || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, 'Office / Interview Address': e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Skills Required</label>
                <textarea
                  rows={2}
                  value={editFormData['Skills Required'] || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, 'Skills Required': e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none"
                />
              </div>

              <div className="pt-3 border-t border-border flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                >
                  Save Opening
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
