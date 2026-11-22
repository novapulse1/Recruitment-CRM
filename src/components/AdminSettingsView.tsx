import React, { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  ListFilter,
  History,
  Copy,
  Server,
  ShieldCheck,
  Plus,
  Power,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Database
} from 'lucide-react';
import type { HRRecord, DropdownOption, User } from '../types';
import { APP_CONFIG } from '../config';
import { api } from '../services/api';

interface AdminSettingsViewProps {
  currentUser: User;
  onRefresh: () => void;
}

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({
  currentUser,
  onRefresh
}) => {
  const [activeSection, setActiveSection] = useState<'hrs' | 'dropdowns' | 'logs' | 'connection'>('hrs');
  const [hrs, setHrs] = useState<HRRecord[]>([]);
  const [dropdowns, setDropdowns] = useState<DropdownOption[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedLogType, setSelectedLogType] = useState('AUDIT_LOG');
  const [apiUrl, setApiUrl] = useState(api.getBaseUrl());
  const [loading, setLoading] = useState(false);

  // New HR Modal
  const [isAddHROpen, setIsAddHROpen] = useState(false);
  const [newHRName, setNewHRName] = useState('');
  const [newHREmail, setNewHREmail] = useState('');

  // New Dropdown Option Modal
  const [isAddOptionOpen, setIsAddOptionOpen] = useState(false);
  const [newOptionList, setNewOptionList] = useState('Industry');
  const [newOptionValue, setNewOptionValue] = useState('');
  const [newParentDisp, setNewParentDisp] = useState('');
  const [newCallStatus, setNewCallStatus] = useState('');

  useEffect(() => {
    loadSectionData();
  }, [activeSection, selectedLogType]);

  const loadSectionData = async () => {
    setLoading(true);
    try {
      if (activeSection === 'hrs') {
        const res = await api.getHRs();
        setHrs(res.hrs || []);
      } else if (activeSection === 'dropdowns') {
        const res = await api.getDropdowns();
        setDropdowns(res.all || []);
      } else if (activeSection === 'logs') {
        const res = await api.getLogs(selectedLogType, 50);
        setLogs(res.logs || []);
      }
    } catch (e: any) {
      alert('Failed to load settings data: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleHR = async (hr: HRRecord) => {
    const nextStatus = hr['Active Status'] === 'Active' ? 'Inactive' : 'Active';
    if (!confirm(`Are you sure you want to change ${hr['HR Name']} status to ${nextStatus}?`)) return;
    try {
      await api.toggleHRStatus(hr['HR ID'], nextStatus);
      loadSectionData();
    } catch (e: any) {
      alert('Error updating HR status: ' + e.message);
    }
  };

  const handleAddHR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHRName || !newHREmail) return;
    try {
      await api.addHR({ hrName: newHRName, hrEmail: newHREmail });
      alert(`HR ${newHRName} registered successfully.`);
      setIsAddHROpen(false);
      setNewHRName('');
      setNewHREmail('');
      loadSectionData();
    } catch (e: any) {
      alert('Error adding HR: ' + e.message);
    }
  };

  const handleToggleDropdown = async (opt: DropdownOption) => {
    if (String(opt.System).toUpperCase() === 'TRUE' && opt.Active === 'TRUE') {
      alert('System-reserved options cannot be deactivated.');
      return;
    }
    const nextActive = opt.Active !== 'TRUE';
    try {
      await api.toggleDropdownOption(opt.List, opt.Option, nextActive);
      loadSectionData();
    } catch (e: any) {
      alert('Error updating dropdown: ' + e.message);
    }
  };

  const handleAddDropdownOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOptionValue) return;
    try {
      await api.addDropdownOption(newOptionList, newOptionValue, newParentDisp, newCallStatus);
      alert('Option added successfully.');
      setIsAddOptionOpen(false);
      setNewOptionValue('');
      setNewParentDisp('');
      setNewCallStatus('');
      loadSectionData();
    } catch (e: any) {
      alert('Error adding option: ' + e.message);
    }
  };

  const handleSaveApiUrl = () => {
    api.setBaseUrl(apiUrl);
    alert('API Web App URL saved successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Admin & System Controls
          </h1>
          <p className="text-xs text-muted-foreground">
            HR Registry management, dropdown option lists, audit logs, and backend connection
          </p>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border">
          {[
            { id: 'hrs', label: 'HR Registry', icon: Users },
            { id: 'dropdowns', label: 'Dropdowns', icon: ListFilter },
            { id: 'logs', label: 'System Logs', icon: History },
            { id: 'connection', label: 'Backend Setup', icon: Database }
          ].map((sec) => {
            const Icon = sec.icon;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeSection === sec.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* HR REGISTRY SECTION */}
      {activeSection === 'hrs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">Registered Recruiter Accounts (HR REGISTRY)</h2>
            <button
              onClick={() => setIsAddHROpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> Register HR
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground text-[10px] uppercase">
                <tr>
                  <th className="p-3">HR ID</th>
                  <th className="p-3">Recruiter Name</th>
                  <th className="p-3">Email Address</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Assigned Candidates</th>
                  <th className="p-3">Sync Mode</th>
                  <th className="p-3">Registration Date</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {hrs.map((hr) => (
                  <tr key={hr['HR ID']} className="hover:bg-muted/40">
                    <td className="p-3 font-mono font-bold text-foreground">{hr['HR ID']}</td>
                    <td className="p-3 font-semibold text-foreground">{hr['HR Name']}</td>
                    <td className="p-3 text-muted-foreground">{hr['HR Email']}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          hr['Active Status'] === 'Active'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {hr['Active Status']}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-foreground">{hr['Assigned Candidate Count']}</td>
                    <td className="p-3 text-muted-foreground">{hr['Sync Mode'] || 'EDIT TRIGGER'}</td>
                    <td className="p-3 text-muted-foreground text-[11px]">{hr['Registration Date']}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleToggleHR(hr)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold border ${
                          hr['Active Status'] === 'Active'
                            ? 'border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
                            : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950'
                        }`}
                      >
                        {hr['Active Status'] === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DROPDOWNS SECTION */}
      {activeSection === 'dropdowns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">Dynamic Picklist Options (DROPDOWN LISTS)</h2>
            <button
              onClick={() => setIsAddOptionOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> Add Option
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden max-h-[65vh] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground text-[10px] uppercase sticky top-0 bg-card">
                <tr>
                  <th className="p-3">List Name</th>
                  <th className="p-3">Option Value</th>
                  <th className="p-3">Parent Disposition</th>
                  <th className="p-3">Auto Call Status</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dropdowns.map((opt, i) => (
                  <tr key={i} className="hover:bg-muted/40">
                    <td className="p-3 font-semibold text-foreground">{opt.List}</td>
                    <td className="p-3 font-bold text-primary">{opt.Option}</td>
                    <td className="p-3 text-muted-foreground">{opt['Parent Disposition'] || '-'}</td>
                    <td className="p-3 text-muted-foreground font-mono">{opt['Call Status'] || '-'}</td>
                    <td className="p-3">
                      {String(opt.System).toUpperCase() === 'TRUE' ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                          System
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold">
                          Custom
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          opt.Active === 'TRUE'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {opt.Active === 'TRUE' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleToggleDropdown(opt)}
                        disabled={String(opt.System).toUpperCase() === 'TRUE' && opt.Active === 'TRUE'}
                        className="px-2 py-1 rounded text-[11px] font-medium border border-border hover:bg-muted disabled:opacity-30"
                      >
                        {opt.Active === 'TRUE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SYSTEM LOGS SECTION */}
      {activeSection === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Select Log:</span>
              <select
                value={selectedLogType}
                onChange={(e) => setSelectedLogType(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground outline-none"
              >
                <option value="AUDIT_LOG">Audit Log (Field Changes)</option>
                <option value="DUPLICATE_LOG">Duplicate Detection Log</option>
                <option value="SYNC_QUEUE">Sync Queue</option>
                <option value="CONFLICT_QUEUE">Conflict Queue</option>
              </select>
            </div>

            <button onClick={loadSectionData} className="p-2 rounded-lg border border-border hover:bg-muted">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden max-h-[60vh] overflow-y-auto">
            {logs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs">No records found in {selectedLogType}.</div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground text-[10px] uppercase sticky top-0 bg-card">
                  <tr>
                    {Object.keys(logs[0] || {})
                      .filter((k) => !k.startsWith('_') && !k.startsWith('MOVED:'))
                      .slice(0, 7)
                      .map((h) => (
                        <th key={h} className="p-3 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/40 font-mono text-[11px]">
                      {Object.keys(logs[0] || {})
                        .filter((k) => !k.startsWith('_') && !k.startsWith('MOVED:'))
                        .slice(0, 7)
                        .map((h) => (
                          <td key={h} className="p-3 max-w-[200px] truncate">
                            {String(row[h] || '-')}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* BACKEND CONNECTION SETUP */}
      {activeSection === 'connection' && (
        <div className="space-y-6 max-w-3xl">
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" /> Google Apps Script Web App Deployment
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The CRM communicates directly with your Google Sheet via the Google Apps Script Web App API built in{' '}
              <code className="text-primary font-mono">apps-script/Code.gs</code>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Google Apps Script Web App URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono outline-none"
                  />
                  <button
                    onClick={handleSaveApiUrl}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
                  >
                    Save URL
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-muted/20 p-3 rounded-xl border border-border">
                <div>
                  <span className="text-muted-foreground">Production Spreadsheet ID:</span>
                  <div className="font-mono font-bold text-foreground truncate">{APP_CONFIG.LIVE_SPREADSHEET_ID}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Dev Copy Spreadsheet ID:</span>
                  <div className="font-mono font-bold text-emerald-600 truncate">{APP_CONFIG.DEV_SPREADSHEET_ID}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add HR Modal */}
      {isAddHROpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-foreground">Register New Recruiter (HR)</h3>
            <form onSubmit={handleAddHR} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">HR Recruiter Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priyanshu Sharma"
                  value={newHRName}
                  onChange={(e) => setNewHRName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">HR Google Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. recruiter@novapulse.co.in"
                  value={newHREmail}
                  onChange={(e) => setNewHREmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                />
              </div>
              <div className="pt-3 border-t border-border flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddHROpen(false)}
                  className="px-4 py-2 rounded-lg border border-border font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                >
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Option Modal */}
      {isAddOptionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-foreground">Add Custom Dropdown Option</h3>
            <form onSubmit={handleAddDropdownOption} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Target List</label>
                <select
                  value={newOptionList}
                  onChange={(e) => setNewOptionList(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="Industry">Industry</option>
                  <option value="Calling Disposition">Calling Disposition</option>
                  <option value="Sub-Disposition">Sub-Disposition</option>
                  <option value="Interview Status">Interview Status</option>
                  <option value="Selection Status">Selection Status</option>
                  <option value="Joining Status">Joining Status</option>
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">Option Value *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FinTech / Payments"
                  value={newOptionValue}
                  onChange={(e) => setNewOptionValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                />
              </div>
              {newOptionList === 'Sub-Disposition' && (
                <>
                  <div>
                    <label className="font-semibold block mb-1">Parent Disposition</label>
                    <input
                      type="text"
                      placeholder="e.g. Not Interested"
                      value={newParentDisp}
                      onChange={(e) => setNewParentDisp(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Auto Call Status</label>
                    <input
                      type="text"
                      placeholder="e.g. Salary Issue"
                      value={newCallStatus}
                      onChange={(e) => setNewCallStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    />
                  </div>
                </>
              )}
              <div className="pt-3 border-t border-border flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOptionOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                >
                  Add Option
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
