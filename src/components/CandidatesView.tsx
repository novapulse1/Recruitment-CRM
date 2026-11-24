import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Download,
  Plus,
  LayoutGrid,
  Kanban,
  Columns,
  CheckSquare,
  Square,
  ChevronRight,
  Phone,
  Mail,
  Building,
  UserCheck,
  Calendar,
  AlertCircle,
  MoreHorizontal,
  Archive,
  RefreshCw
} from 'lucide-react';
import type { Candidate, Client, DropdownOption, Opening, User } from '../types';
import { PIPELINE_STAGES, STAGE_DEFINITIONS, type PipelineStage } from '../config';
import { api } from '../services/api';

interface CandidatesViewProps {
  candidates: Candidate[];
  currentUser: User;
  dropdowns: Record<string, DropdownOption[]>;
  clients?: Client[];
  openings?: Opening[];
  onSelectCandidate: (candidateId: string) => void;
  onOpenAddModal: () => void;
  onRefresh: () => void;
  onCandidateUpdated: (c: Candidate) => void;
}

export const CandidatesView: React.FC<CandidatesViewProps> = ({
  candidates = [],
  currentUser,
  dropdowns = {},
  clients = [],
  openings = [],
  onSelectCandidate,
  onOpenAddModal,
  onRefresh,
  onCandidateUpdated
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterHR, setFilterHR] = useState('');
  const [filterDisposition, setFilterDisposition] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [bulkTargetHR, setBulkTargetHR] = useState('');
  const [bulkTargetClient, setBulkTargetClient] = useState('');

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    'Candidate ID': true,
    'Candidate Name': true,
    'Mobile Number': true,
    'Designation Applied': true,
    'Client Name': true,
    'Assigned HR': true,
    'Calling Disposition': true,
    'Pipeline Stage': true,
    'Interview Date': true,
    'Joining Status': true,
    'Last Updated': true
  });
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);

  // Filtered dataset
  const filteredCandidates = useMemo(() => {
    return (candidates || []).filter((c) => {
      // Role enforcement
      if (currentUser?.role === 'FINANCE') {
        return false;
      }
      if (currentUser?.role === 'HR_RECRUITER' || currentUser?.role === 'HR') {
        if (String(c['HR Email'] || '').toLowerCase() !== (currentUser?.email || '').toLowerCase()) {
          return false;
        }
      } else if (currentUser?.role === 'RECRUITMENT_MANAGER') {
        const team = currentUser?.teamRecruiterEmails || ['hr@novapulse.co.in', 'gjigyasa11@gmail.com'];
        const candHREmail = String(c['HR Email'] || '').toLowerCase();
        if (!team.includes(candHREmail) && candHREmail !== (currentUser?.email || '').toLowerCase()) {
          return false;
        }
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          c['Candidate ID']?.toLowerCase().includes(q) ||
          c['Candidate Name']?.toLowerCase().includes(q) ||
          c['Mobile Number']?.includes(q) ||
          c['Email ID']?.toLowerCase().includes(q) ||
          c['Client Name']?.toLowerCase().includes(q) ||
          c['Designation Applied']?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Filters
      if (filterClient && c['Client Name'] !== filterClient) return false;
      if (filterHR && c['Assigned HR'] !== filterHR) return false;
      if (filterDisposition && c['Calling Disposition'] !== filterDisposition) return false;
      if (filterStage && c['Pipeline Stage'] !== filterStage) return false;

      return true;
    });
  }, [candidates, currentUser, searchQuery, filterClient, filterHR, filterDisposition, filterStage]);

  const isAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN';

  // Clients & HRs lists for filter dropdowns
  const uniqueClients = useMemo(() => {
    if (clients && clients.length > 0) {
      const fromClients = clients.map((c) => c.clientName).filter(Boolean);
      return Array.from(new Set(fromClients)).sort();
    }
    const set = new Set<string>();
    (candidates || []).forEach((c) => {
      if (c['Client Name']) set.add(c['Client Name']);
    });
    return Array.from(set).sort();
  }, [clients, candidates]);

  const uniqueHRs = useMemo(() => {
    const set = new Set<string>();
    (candidates || []).forEach((c) => {
      if (c['Assigned HR']) set.add(c['Assigned HR']);
    });
    return Array.from(set).sort();
  }, [candidates]);

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedIds.length === filteredCandidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCandidates.map((c) => c['Candidate ID']));
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Export to CSV (Super Admin & Admin)
  const handleExportCSV = () => {
    if (currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'ADMIN') {
      alert('Export is restricted to Administrators.');
      return;
    }

    const headers = Object.keys(visibleColumns).filter((k) => visibleColumns[k]);
    const csvRows = [headers.join(',')];

    filteredCandidates.forEach((c) => {
      const row = headers.map((h) => {
        const val = String((c as any)[h] || '').replace(/"/g, '""');
        return `"${val}"`;
      });
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `NovaPulse_Candidates_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk action execution
  const executeBulkAction = async (actionType: 'REASSIGN_HR' | 'CHANGE_CLIENT' | 'ARCHIVE') => {
    if (selectedIds.length === 0) return;
    try {
      const payload: any = {};
      if (actionType === 'REASSIGN_HR') {
        if (!bulkTargetHR) return alert('Select target HR');
        payload.assignedHR = bulkTargetHR;
        payload.hrEmail = bulkTargetHR === 'Anshu' ? 'hr@novapulse.co.in' : 'gjigyasa11@gmail.com';
      } else if (actionType === 'CHANGE_CLIENT') {
        if (!bulkTargetClient) return alert('Select target client');
        payload.clientName = bulkTargetClient;
      }

      await api.bulkCandidateAction(actionType, selectedIds, payload);
      alert(`Bulk action "${actionType}" completed on ${selectedIds.length} candidate(s).`);
      setSelectedIds([]);
      setBulkActionOpen(false);
      onRefresh();
    } catch (e: any) {
      alert('Bulk action error: ' + e.message);
    }
  };

  // Move stage directly in Kanban
  const handleStageMove = async (candidate: Candidate, newStage: PipelineStage) => {
    try {
      const res = await api.updateCandidate(
        candidate['Candidate ID'],
        { 'Pipeline Stage': newStage },
        candidate['Record Version']
      );
      onCandidateUpdated(res.updatedCandidate);
    } catch (e: any) {
      alert('Stage update failed: ' + e.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Candidate Master
          </h1>
          <p className="text-xs text-muted-foreground">
            {filteredCandidates.length} candidate{filteredCandidates.length === 1 ? '' : 's'} found
            {currentUser.role === 'HR' && ' (Filtered to your assigned portfolio)'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/40">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Table Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'kanban' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Pipeline Kanban View"
            >
              <Kanban className="h-4 w-4" />
              <span className="hidden sm:inline">Pipeline</span>
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh candidate data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* Column Toggle (Grid view only) */}
          {viewMode === 'grid' && (
            <div className="relative">
              <button
                onClick={() => setColumnMenuOpen(!columnMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                <Columns className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Columns</span>
              </button>

              {columnMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card p-2 shadow-xl z-20 space-y-1">
                  <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1">Toggle Columns</div>
                  {Object.keys(visibleColumns).map((col) => (
                    <label
                      key={col}
                      className="flex items-center gap-2 px-2 py-1 rounded-md text-xs hover:bg-muted cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[col]}
                        onChange={(e) =>
                          setVisibleColumns({ ...visibleColumns, [col]: e.target.checked })
                        }
                        className="rounded border-border text-primary"
                      />
                      <span>{col}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CSV Export (Admin only) */}
          {currentUser.role === 'ADMIN' && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors"
              title="Export filtered records to CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          {/* Add Candidate Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{currentUser.role === 'HR' ? 'Submit Lead' : 'Add Candidate'}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 rounded-xl border border-border bg-card shadow-sm flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ID, Name, Phone, Email, Client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Client Filter */}
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground outline-none"
        >
          <option value="">All Clients</option>
          {uniqueClients.map((cl) => (
            <option key={cl} value={cl}>
              {cl}
            </option>
          ))}
        </select>

        {/* HR Filter (Admin only) */}
        {isAdmin && (
          <select
            value={filterHR}
            onChange={(e) => setFilterHR(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground outline-none"
          >
            <option value="">All HRs</option>
            {uniqueHRs.map((hr) => (
              <option key={hr} value={hr}>
                {hr}
              </option>
            ))}
          </select>
        )}

        {/* Pipeline Stage Filter */}
        <select
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground outline-none"
        >
          <option value="">All Pipeline Stages</option>
          {PIPELINE_STAGES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        {/* Clear Filters */}
        {(searchQuery || filterClient || filterHR || filterStage) && (
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterClient('');
              setFilterHR('');
              setFilterStage('');
            }}
            className="text-xs text-primary hover:underline px-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Bulk Action Bar (Admin only) */}
      {isAdmin && selectedIds.length > 0 && (
        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2 font-semibold text-purple-900 dark:text-purple-200">
            <CheckSquare className="h-4 w-4 text-purple-600" />
            <span>{selectedIds.length} candidate(s) selected</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={bulkTargetHR}
              onChange={(e) => setBulkTargetHR(e.target.value)}
              className="px-2 py-1 rounded border border-border bg-background text-xs"
            >
              <option value="">Reassign HR...</option>
              {uniqueHRs.map((hr) => (
                <option key={hr} value={hr}>
                  {hr}
                </option>
              ))}
            </select>
            <button
              onClick={() => executeBulkAction('REASSIGN_HR')}
              className="px-2.5 py-1 rounded bg-purple-600 text-white font-medium hover:bg-purple-700"
            >
              Apply HR
            </button>

            <button
              onClick={() => executeBulkAction('ARCHIVE')}
              className="px-2.5 py-1 rounded bg-red-600 text-white font-medium hover:bg-red-700 flex items-center gap-1"
            >
              <Archive className="h-3 w-3" /> Archive
            </button>
          </div>
        </div>
      )}

      {/* GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  {currentUser.role === 'ADMIN' && (
                    <th className="p-3 w-10 text-center">
                      <button onClick={handleSelectAll} className="text-muted-foreground hover:text-foreground">
                        {selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0 ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                  )}
                  {visibleColumns['Candidate ID'] && <th className="p-3">ID</th>}
                  {visibleColumns['Candidate Name'] && <th className="p-3">Candidate</th>}
                  {visibleColumns['Mobile Number'] && <th className="p-3">Phone</th>}
                  {visibleColumns['Designation Applied'] && <th className="p-3">Role</th>}
                  {visibleColumns['Client Name'] && <th className="p-3">Client</th>}
                  {visibleColumns['Assigned HR'] && <th className="p-3">Assigned HR</th>}
                  {visibleColumns['Calling Disposition'] && <th className="p-3">Disposition</th>}
                  {visibleColumns['Pipeline Stage'] && <th className="p-3">Stage</th>}
                  {visibleColumns['Interview Date'] && <th className="p-3">Interview Date</th>}
                  {visibleColumns['Joining Status'] && <th className="p-3">Joining Status</th>}
                  {visibleColumns['Last Updated'] && <th className="p-3">Last Updated</th>}
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-muted-foreground">
                      No candidates found matching the active filters.
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((c) => {
                    const isSelected = selectedIds.includes(c['Candidate ID']);
                    return (
                      <tr
                        key={c['Candidate ID']}
                        onClick={() => onSelectCandidate(c['Candidate ID'])}
                        className={`hover:bg-muted/50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/5' : ''
                        }`}
                      >
                        {isAdmin && (
                          <td className="p-3 text-center" onClick={(e) => handleToggleSelect(c['Candidate ID'], e)}>
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground" />
                            )}
                          </td>
                        )}
                        {visibleColumns['Candidate ID'] && (
                          <td className="p-3 font-mono font-medium text-foreground whitespace-nowrap">
                            {c['Candidate ID']}
                          </td>
                        )}
                        {visibleColumns['Candidate Name'] && (
                          <td className="p-3 font-semibold text-foreground whitespace-nowrap">
                            {c['Candidate Name']}
                          </td>
                        )}
                        {visibleColumns['Mobile Number'] && (
                          <td className="p-3 font-mono text-muted-foreground whitespace-nowrap">
                            {c['Mobile Number']}
                          </td>
                        )}
                        {visibleColumns['Designation Applied'] && (
                          <td className="p-3 text-foreground whitespace-nowrap">
                            {c['Designation Applied'] || '-'}
                          </td>
                        )}
                        {visibleColumns['Client Name'] && (
                          <td className="p-3 text-foreground whitespace-nowrap">
                            {c['Client Name'] || '-'}
                          </td>
                        )}
                        {visibleColumns['Assigned HR'] && (
                          <td className="p-3 text-muted-foreground whitespace-nowrap">
                            {c['Assigned HR'] || '-'}
                          </td>
                        )}
                        {visibleColumns['Calling Disposition'] && (
                          <td className="p-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-foreground">
                              {c['Calling Disposition'] || 'Not Called'}
                            </span>
                          </td>
                        )}
                        {visibleColumns['Pipeline Stage'] && (
                          <td className="p-3 whitespace-nowrap">
                            {(() => {
                              const stage = (c['Pipeline Stage'] || 'Unassigned') as PipelineStage;
                              const stageDef = STAGE_DEFINITIONS[stage] || STAGE_DEFINITIONS['Unassigned'];
                              return (
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    stageDef?.badgeClass || 'bg-muted text-muted-foreground border-border'
                                  }`}
                                >
                                  {stageDef?.label || stage}
                                </span>
                              );
                            })()}
                          </td>
                        )}
                        {visibleColumns['Interview Date'] && (
                          <td className="p-3 font-mono text-muted-foreground whitespace-nowrap">
                            {c['Interview Date'] || '-'}
                          </td>
                        )}
                        {visibleColumns['Joining Status'] && (
                          <td className="p-3 whitespace-nowrap">
                            {c['Joining Status'] || '-'}
                          </td>
                        )}
                        {visibleColumns['Last Updated'] && (
                          <td className="p-3 text-muted-foreground text-[11px] whitespace-nowrap">
                            {c['Last Updated'] || '-'}
                          </td>
                        )}
                        <td className="p-3 text-right">
                          <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KANBAN VIEW */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin">
          {PIPELINE_STAGES.map((stage) => {
            const stageCandidates = filteredCandidates.filter((c) => (c['Pipeline Stage'] || 'Unassigned') === stage);
            return (
              <div
                key={stage}
                className="w-72 shrink-0 bg-muted/30 rounded-2xl border border-border flex flex-col max-h-[75vh]"
              >
                {/* Stage Header */}
                <div className="p-3.5 border-b border-border flex items-center justify-between bg-card/60 rounded-t-2xl">
                  <div className="font-bold text-xs text-foreground tracking-tight">{stage}</div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {stageCandidates.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="p-2.5 overflow-y-auto space-y-2.5 flex-1">
                  {stageCandidates.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-[11px]">No candidates</div>
                  ) : (
                    stageCandidates.map((c) => (
                      <div
                        key={c['Candidate ID']}
                        onClick={() => onSelectCandidate(c['Candidate ID'])}
                        className="p-3 rounded-xl bg-card border border-border shadow-sm hover:border-primary/50 transition-all cursor-pointer space-y-2 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                            {c['Candidate Name']}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {c['Candidate ID']}
                          </span>
                        </div>

                        <div className="text-[11px] text-muted-foreground space-y-0.5">
                          <div className="truncate">{c['Designation Applied'] || 'General'}</div>
                          {c['Client Name'] && (
                            <div className="font-medium text-foreground truncate">{c['Client Name']}</div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>HR: {c['Assigned HR']}</span>
                          {c['Interview Date'] && (
                            <span className="font-mono text-blue-600 dark:text-blue-400 font-medium">
                              📅 {c['Interview Date']}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
