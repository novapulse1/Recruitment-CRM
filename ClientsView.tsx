import React, { useState } from 'react';
import {
  Building2,
  Phone,
  Mail,
  User,
  Plus,
  Edit2,
  FileText,
  Percent,
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  X
} from 'lucide-react';
import type { Client, User as AuthUser } from '../types';
import { api } from '../services/api';

interface ClientsViewProps {
  clients: Client[];
  currentUser: AuthUser;
  onRefresh: () => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  currentUser,
  onRefresh
}) => {
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [clientFormData, setClientFormData] = useState<Partial<Client>>({});

  const filtered = clients.filter((cl) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      cl.clientName?.toLowerCase().includes(q) ||
      cl.contactPerson?.toLowerCase().includes(q) ||
      cl.industry?.toLowerCase().includes(q) ||
      cl.clientId?.toLowerCase().includes(q)
    );
  });

  const handleOpenAdd = () => {
    setClientFormData({
      clientName: '',
      status: 'Active',
      feeType: 'Percentage',
      feeValue: '8.33',
      invoiceAfterDays: 30,
      replacementPeriodDays: 90,
      gstPercent: 18,
      contactPerson: '',
      contactEmail: '',
      contactPhone: '',
      billingAddress: '',
      agreementNotes: '',
      industry: 'IT / Software',
      hiringStatus: 'Open',
      payrollType: 'Novapulse',
      agreement: 'Yes',
      gstNo: '',
      secondaryPOCName: '',
      secondaryPOCNumber: '',
      remarks: ''
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (cl: Client) => {
    setClientFormData(cl);
    setIsEditModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveClient(clientFormData);
      alert('Client saved successfully.');
      setIsEditModalOpen(false);
      onRefresh();
    } catch (e: any) {
      alert('Failed to save client: ' + e.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Client Accounts & Commercials
          </h1>
          <p className="text-xs text-muted-foreground">
            {filtered.length} corporate partner{filtered.length === 1 ? '' : 's'} with commercial agreements
          </p>
        </div>

        {currentUser.role === 'ADMIN' && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4" /> Add Client
          </button>
        )}
      </div>

      {/* Search */}
      <div className="p-3 rounded-xl border border-border bg-card shadow-sm">
        <div className="relative max-w-md">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by client name, contact, industry..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground outline-none"
          />
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((cl) => (
          <div
            key={cl.clientId}
            className="p-5 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                    {cl.clientId}
                  </span>
                  <h3 className="font-bold text-base text-foreground mt-1 leading-snug">
                    {cl.clientName}
                  </h3>
                  <div className="text-xs text-muted-foreground">{cl.industry || 'General Industry'}</div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    cl.status === 'Active'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {cl.status}
                </span>
              </div>

              {/* Commercial Terms Badge Grid */}
              <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] bg-muted/20 p-2.5 rounded-xl border border-border/50">
                <div>
                  <span className="text-muted-foreground">Fee Model:</span>
                  <div className="font-semibold text-foreground">
                    {cl.feeType === 'Percentage' ? `${cl.feeValue}% CTC` : `₹ ${cl.feeValue} Flat`} (+{cl.gstPercent}% GST)
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Invoice Due:</span>
                  <div className="font-semibold text-foreground">{cl.invoiceAfterDays} Days post-join</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Replacement:</span>
                  <div className="font-semibold text-foreground">{cl.replacementPeriodDays} Days</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Payroll:</span>
                  <div className="font-semibold text-foreground">{cl.payrollType || 'Novapulse'}</div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="flex items-center justify-between mt-3 text-xs border-t border-border pt-3">
                <div className="text-center">
                  <div className="font-bold text-primary">{cl.activeOpeningsCount || 0}</div>
                  <div className="text-[10px] text-muted-foreground">Open Roles</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-blue-600 dark:text-blue-400">{cl.linedUpCount || 0}</div>
                  <div className="text-[10px] text-muted-foreground">Lined up</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-indigo-600 dark:text-indigo-400">{cl.selectedCount || 0}</div>
                  <div className="text-[10px] text-muted-foreground">Selected</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">{cl.joinedCount || 0}</div>
                  <div className="text-[10px] text-muted-foreground">Joined</div>
                </div>
              </div>
            </div>

            {/* POC & Actions */}
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <div className="text-xs">
                <div className="font-medium text-foreground">{cl.contactPerson || 'POC Unassigned'}</div>
                <div className="text-[11px] text-muted-foreground">{cl.contactPhone || '-'}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedClient(cl)}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  Details
                </button>
                {currentUser.role === 'ADMIN' && (
                  <button
                    onClick={() => handleOpenEdit(cl)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                    title="Edit Client"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono text-muted-foreground">{selectedClient.clientId}</span>
                <h2 className="text-lg font-bold text-foreground mt-0.5">{selectedClient.clientName}</h2>
                <div className="text-xs text-muted-foreground">{selectedClient.industry}</div>
              </div>
              <button onClick={() => setSelectedClient(null)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-muted/20 p-4 rounded-xl border border-border text-xs space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-muted-foreground">Commercial Agreement</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>Fee Type: <strong>{selectedClient.feeType}</strong></div>
                <div>Fee Value: <strong>{selectedClient.feeValue}</strong></div>
                <div>GST %: <strong>{selectedClient.gstPercent}%</strong></div>
                <div>GST No: <strong>{selectedClient.gstNo || '-'}</strong></div>
                <div>Invoice After: <strong>{selectedClient.invoiceAfterDays} Days</strong></div>
                <div>Replacement Period: <strong>{selectedClient.replacementPeriodDays} Days</strong></div>
              </div>
              {selectedClient.agreementNotes && (
                <div className="pt-2 border-t border-border mt-2">
                  <strong>Notes:</strong> {selectedClient.agreementNotes}
                </div>
              )}
            </div>

            <div className="bg-muted/20 p-4 rounded-xl border border-border text-xs space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-muted-foreground">Points of Contact (POC)</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-muted-foreground">Primary POC:</div>
                  <strong>{selectedClient.contactPerson || '-'}</strong>
                  <div>{selectedClient.contactPhone}</div>
                  <div>{selectedClient.contactEmail}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Secondary POC:</div>
                  <strong>{selectedClient.secondaryPOCName || '-'}</strong>
                  <div>{selectedClient.secondaryPOCNumber || '-'}</div>
                </div>
              </div>
              {selectedClient.billingAddress && (
                <div className="pt-2 border-t border-border mt-2">
                  <strong>Billing Address:</strong> {selectedClient.billingAddress}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedClient(null)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Add/Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground">
                {clientFormData.clientId ? `Edit Client (${clientFormData.clientId})` : 'New Client'}
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Client Name *</label>
                  <input
                    type="text"
                    required
                    value={clientFormData.clientName || ''}
                    onChange={(e) => setClientFormData({ ...clientFormData, clientName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Industry</label>
                  <input
                    type="text"
                    value={clientFormData.industry || ''}
                    onChange={(e) => setClientFormData({ ...clientFormData, industry: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Fee Type</label>
                  <select
                    value={clientFormData.feeType || 'Percentage'}
                    onChange={(e) => setClientFormData({ ...clientFormData, feeType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  >
                    <option value="Percentage">Percentage (% CTC)</option>
                    <option value="Fixed">Fixed Amount (₹ Flat)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Fee Value (% or ₹)</label>
                  <input
                    type="text"
                    value={clientFormData.feeValue || ''}
                    onChange={(e) => setClientFormData({ ...clientFormData, feeValue: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Invoice After Joining (Days)</label>
                  <input
                    type="number"
                    value={clientFormData.invoiceAfterDays || 30}
                    onChange={(e) => setClientFormData({ ...clientFormData, invoiceAfterDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Replacement Period (Days)</label>
                  <input
                    type="number"
                    value={clientFormData.replacementPeriodDays || 90}
                    onChange={(e) => setClientFormData({ ...clientFormData, replacementPeriodDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">GST %</label>
                  <input
                    type="number"
                    value={clientFormData.gstPercent || 18}
                    onChange={(e) => setClientFormData({ ...clientFormData, gstPercent: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">GST Number</label>
                  <input
                    type="text"
                    value={clientFormData.gstNo || ''}
                    onChange={(e) => setClientFormData({ ...clientFormData, gstNo: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">POC Name</label>
                  <input
                    type="text"
                    value={clientFormData.contactPerson || ''}
                    onChange={(e) => setClientFormData({ ...clientFormData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">POC Phone</label>
                  <input
                    type="text"
                    value={clientFormData.contactPhone || ''}
                    onChange={(e) => setClientFormData({ ...clientFormData, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">POC Email</label>
                  <input
                    type="email"
                    value={clientFormData.contactEmail || ''}
                    onChange={(e) => setClientFormData({ ...clientFormData, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Billing Address</label>
                <textarea
                  rows={2}
                  value={clientFormData.billingAddress || ''}
                  onChange={(e) => setClientFormData({ ...clientFormData, billingAddress: e.target.value })}
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
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
