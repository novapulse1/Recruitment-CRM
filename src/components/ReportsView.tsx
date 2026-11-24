import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Receipt,
  Users,
  Building,
  AlertTriangle,
  Download,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  IndianRupee,
  Briefcase,
  Layers,
  Table,
  PieChart as PieIcon,
  RotateCcw,
  TrendingUp,
  FileSpreadsheet,
  Printer
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import type { Candidate, Client, JoiningRecord, InterviewItem, HRRecord, User } from '../types';

interface ReportsViewProps {
  candidates: Candidate[];
  clients: Client[];
  joinings: JoiningRecord[];
  interviews: InterviewItem[];
  hrs: HRRecord[];
  currentUser: User;
}

type ReportType =
  | 'interviews'
  | 'joinings'
  | 'recruiters'
  | 'clients'
  | 'dropoffs';

type ViewMode = 'visual' | 'table' | 'summary';

export const ReportsView: React.FC<ReportsViewProps> = ({
  candidates = [],
  clients = [],
  joinings = [],
  interviews = [],
  hrs = [],
  currentUser
}) => {
  const safeCandidates = candidates || [];
  const safeClients = clients || [];
  const safeJoinings = joinings || [];
  const safeInterviews = interviews || [];
  const safeHrs = hrs || [];

  const [activeReport, setActiveReport] = useState<ReportType>('interviews');
  const [viewMode, setViewMode] = useState<ViewMode>('visual');
  const [filterHR, setFilterHR] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [search, setSearch] = useState('');

  const reportTabs = [
    { id: 'interviews', label: 'Interview Report', icon: Calendar, desc: 'Date-wise lineups, attendance & reschedules' },
    { id: 'joinings', label: 'Joining & Billing', icon: Receipt, desc: 'Placements, fees, replacement countdown' },
    { id: 'recruiters', label: 'Recruiter Scorecard', icon: Users, desc: 'HR productivity, conversion & metrics' },
    { id: 'clients', label: 'Client Conversion', icon: Building, desc: 'Hiring funnel & efficiency per client' },
    { id: 'dropoffs', label: 'Drop & Rejection Analysis', icon: AlertTriangle, desc: 'Sub-disposition root causes' }
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

  // Filter HR / Client lists
  const hrNames = useMemo(() => {
    const set = new Set<string>();
    safeCandidates.forEach((c) => { if (c && c['Assigned HR']) set.add(c['Assigned HR']); });
    return Array.from(set).sort();
  }, [safeCandidates]);

  const clientNames = useMemo(() => {
    const set = new Set<string>();
    safeClients.forEach((c) => { if (c && c.clientName) set.add(c.clientName); });
    return Array.from(set).sort();
  }, [safeClients]);

  // Export current report dataset to CSV
  const exportToCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `NovaPulse_${activeReport}_report.csv`;

    if (activeReport === 'interviews') {
      headers = ['Candidate ID', 'Candidate Name', 'Phone', 'Role', 'Client', 'Assigned HR', 'Interview Date', 'Status', 'Timeframe', 'Reschedule Count'];
      rows = safeInterviews.map((i) => [
        i.candidateId,
        `"${i.candidateName}"`,
        `"${i.mobile}"`,
        `"${i.designation}"`,
        `"${i.clientName}"`,
        `"${i.assignedHR}"`,
        `"${i.interviewDate}"`,
        `"${i.interviewStatus}"`,
        `"${i.timeBucket}"`,
        String(i.rescheduleCount || 1)
      ]);
    } else if (activeReport === 'joinings') {
      headers = ['Candidate ID', 'Candidate Name', 'Client', 'Designation', 'Joining Date', 'Annual CTC', 'Fee Type', 'Fee Value', 'Invoice Amount', 'Invoice Status', 'Days Completed', 'Replacement Ends'];
      rows = safeJoinings.map((j) => [
        j.candidateId,
        `"${j.candidateName}"`,
        `"${j.clientName}"`,
        `"${j.designation}"`,
        `"${j.joiningDate}"`,
        String(j.annualCtc),
        `"${j.feeType}"`,
        String(j.feeValue),
        String(j.invoiceAmount),
        `"${j.invoiceStatus}"`,
        String(j.daysCompleted),
        `"${j.replacementEnds}"`
      ]);
    } else if (activeReport === 'recruiters') {
      headers = ['Recruiter Name', 'Total Candidates', 'Connected', 'Interviews', 'Selected', 'Joined', 'Conversion %'];
      rows = hrNames.map((name) => {
        const hrCands = safeCandidates.filter((c) => c && c['Assigned HR'] === name);
        const sourced = hrCands.length;
        const joined = hrCands.filter((c) => c && c['Joining Status'] === 'Joined').length;
        const selected = hrCands.filter((c) => c && c['Selection Status'] === 'Selected').length;
        const conv = sourced ? Math.round((joined / sourced) * 100) : 0;
        return [`"${name}"`, String(sourced), String(hrCands.filter((c) => c && c['Connect Status'] === 'Connect').length), String(hrCands.filter((c) => c && c['Interview Date']).length), String(selected), String(joined), `${conv}%`];
      });
    } else if (activeReport === 'clients') {
      headers = ['Client Name', 'Industry', 'Lined Up', 'Selected', 'Joined', 'Fee Model', 'Invoice Terms'];
      rows = safeClients.map((cl) => [
        `"${cl.clientName}"`,
        `"${cl.industry}"`,
        String(cl.linedUpCount || 0),
        String(cl.selectedCount || 0),
        String(cl.joinedCount || 0),
        `"${cl.feeType}: ${cl.feeValue}"`,
        `"${cl.invoiceAfterDays} days / ${cl.replacementPeriodDays}d repl."`
      ]);
    } else if (activeReport === 'dropoffs') {
      headers = ['Drop Reason (Sub-Disposition)', 'Count', 'Category'];
      const reasons: Record<string, number> = {};
      safeCandidates.forEach((c) => {
        if (!c) return;
        if (c['Calling Disposition'] === 'Not Interested' || c['Calling Disposition'] === 'Not Connected' || c['Interview Status'] === 'Drop After Lineup') {
          const r = c['Sub-Disposition'] || c['Calling Disposition'] || 'Unknown';
          reasons[r] = (reasons[r] || 0) + 1;
        }
      });
      rows = Object.keys(reasons).map((r) => [`"${r}"`, String(reasons[r]), 'Calling / Interview Drop']);
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. INTERVIEWS DATA
  const interviewData = useMemo(() => {
    let list = interviews;
    if (filterHR) list = list.filter((i) => i.assignedHR === filterHR);
    if (filterClient) list = list.filter((i) => i.clientName === filterClient);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.candidateName?.toLowerCase().includes(q) || i.candidateId?.toLowerCase().includes(q));
    }

    const byBucket = {
      Today: list.filter((i) => i.timeBucket === 'Today').length,
      Tomorrow: list.filter((i) => i.timeBucket === 'Tomorrow').length,
      'This Week': list.filter((i) => i.timeBucket === 'This Week').length,
      Overdue: list.filter((i) => i.timeBucket === 'Overdue').length,
      Upcoming: list.filter((i) => i.timeBucket === 'Upcoming').length,
      Past: list.filter((i) => i.timeBucket === 'Past').length
    };

    const highRescheduleCount = list.filter((i) => (i.rescheduleCount || 1) >= 2).length;
    const attendedCount = list.filter((i) => i.interviewStatus === 'Attended').length;

    return { list, byBucket, highRescheduleCount, attendedCount };
  }, [interviews, filterHR, filterClient, search]);

  // 2. JOININGS DATA
  const joiningData = useMemo(() => {
    let list = joinings;
    if (filterClient) list = list.filter((j) => j.clientName === filterClient);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((j) => j.candidateName?.toLowerCase().includes(q) || j.candidateId?.toLowerCase().includes(q));
    }

    const totalRevenue = list.reduce((acc, j) => acc + (Number(j.invoiceAmount) || 0), 0);
    const paidRevenue = list.filter((j) => j.invoiceStatus === 'Paid').reduce((acc, j) => acc + (Number(j.invoiceAmount) || 0), 0);
    const pendingRevenue = list.filter((j) => j.invoiceStatus !== 'Paid').reduce((acc, j) => acc + (Number(j.invoiceAmount) || 0), 0);
    const activeGuarantees = list.filter((j) => (j.replacementRemainingDays || 0) > 0 && j.employmentStatus === 'Active').length;
    const dueSoon = list.filter((j) => j.invoiceDueSoon).length;

    return { list, totalRevenue, paidRevenue, pendingRevenue, activeGuarantees, dueSoon };
  }, [joinings, filterClient, search]);

  // 3. RECRUITER DATA
  const recruiterData = useMemo(() => {
    return hrNames.map((name) => {
      const hrCands = candidates.filter((c) => c['Assigned HR'] === name);
      const totalSourced = hrCands.length;
      const connected = hrCands.filter((c) => c['Connect Status'] === 'Connect' || c['Calling Disposition'] || c['Interview Date']).length;
      const scheduled = hrCands.filter((c) => c['Interview Date']).length;
      const attended = hrCands.filter((c) => c['Interview Status'] === 'Attended').length;
      const selected = hrCands.filter((c) => c['Selection Status'] === 'Selected').length;
      const joined = hrCands.filter((c) => c['Joining Status'] === 'Joined').length;
      const conversionRate = totalSourced ? Math.round((joined / totalSourced) * 100 * 10) / 10 : 0;

      return {
        name,
        totalSourced,
        connected,
        scheduled,
        attended,
        selected,
        joined,
        conversionRate
      };
    });
  }, [hrNames, candidates]);

  // 4. CLIENT CONVERSION DATA
  const clientData = useMemo(() => {
    return clients.map((cl) => {
      const cands = candidates.filter((c) => c['Client Name'] === cl.clientName);
      const total = cands.length;
      const linedUp = cl.linedUpCount || 0;
      const selected = cl.selectedCount || 0;
      const joined = cl.joinedCount || 0;
      const rate = linedUp ? Math.round((joined / linedUp) * 100) : 0;

      return {
        clientName: cl.clientName,
        industry: cl.industry,
        feeType: cl.feeType,
        feeValue: cl.feeValue,
        activeOpenings: cl.activeOpeningsCount || 0,
        totalCandidates: total,
        linedUp,
        selected,
        joined,
        conversionRate: rate
      };
    });
  }, [clients, candidates]);

  // 5. DROP-OFFS DATA
  const dropoffData = useMemo(() => {
    const map: Record<string, number> = {};
    candidates.forEach((c) => {
      const disp = c['Calling Disposition'] || '';
      const intStat = c['Interview Status'] || '';
      if (disp === 'Not Interested' || disp === 'Not Connected' || intStat === 'Drop After Lineup') {
        const reason = c['Sub-Disposition'] || disp || 'Other';
        map[reason] = (map[reason] || 0) + 1;
      }
    });

    return Object.keys(map).map((k) => ({ reason: k, count: map[k] })).sort((a, b) => b.count - a.count);
  }, [candidates]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            NovaPulse Intelligence & Reporting Center
          </h1>
          <p className="text-xs text-muted-foreground">
            Multi-perspective analytical reports with visual dashboards, summary cards & exportable data
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher */}
          <div className="flex items-center rounded-xl border border-border p-0.5 bg-muted/40">
            <button
              onClick={() => setViewMode('visual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'visual' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <PieIcon className="h-3.5 w-3.5" />
              <span>Visuals</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Table className="h-3.5 w-3.5" />
              <span>Data Grid</span>
            </button>
            <button
              onClick={() => setViewMode('summary')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'summary' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Cards</span>
            </button>
          </div>

          {/* Export to CSV */}
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground shadow-sm transition-all"
            title="Download Report as CSV"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Report Selection Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {reportTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id as ReportType)}
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                isActive
                  ? 'border-primary bg-primary/5 text-primary shadow-sm'
                  : 'border-border bg-card hover:bg-muted/60 text-muted-foreground'
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {isActive && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </div>
              <div className="mt-2.5">
                <div className={`text-xs font-bold ${isActive ? 'text-foreground' : 'text-foreground'}`}>
                  {tab.label}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{tab.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Global Report Filters Bar */}
      <div className="p-3 rounded-2xl border border-border bg-card shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search within report..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground outline-none"
          />
        </div>

        {(activeReport === 'interviews' || activeReport === 'recruiters') && (
          <select
            value={filterHR}
            onChange={(e) => setFilterHR(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-medium"
          >
            <option value="">All Recruiters</option>
            {hrNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}

        {(activeReport === 'interviews' || activeReport === 'joinings' || activeReport === 'clients') && (
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-medium"
          >
            <option value="">All Clients</option>
            {clientNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        {(filterHR || filterClient || search) && (
          <button
            onClick={() => {
              setFilterHR('');
              setFilterClient('');
              setSearch('');
            }}
            className="text-xs text-primary hover:underline px-2 font-medium"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* REPORT 1: INTERVIEW REPORT (Date-wise, Attendance, Reschedule Tracker)    */}
      {/* ========================================================================= */}
      {activeReport === 'interviews' && (
        <div className="space-y-4">
          {/* Top Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
              <span className="text-xs font-semibold text-muted-foreground">Today's Lineups</span>
              <div className="text-2xl font-bold text-foreground mt-1">{interviewData.byBucket.Today}</div>
              <div className="text-[10px] text-muted-foreground">{interviewData.byBucket.Tomorrow} scheduled tomorrow</div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
              <span className="text-xs font-semibold text-muted-foreground">This Week Total</span>
              <div className="text-2xl font-bold text-foreground mt-1">{interviewData.byBucket['This Week']}</div>
              <div className="text-[10px] text-emerald-600 font-semibold">{interviewData.attendedCount} Attended</div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
              <span className="text-xs font-semibold text-muted-foreground">Overdue / Action Needed</span>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{interviewData.byBucket.Overdue}</div>
              <div className="text-[10px] text-muted-foreground">Passed date with pending status</div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
              <span className="text-xs font-semibold text-muted-foreground">High Reschedule Candidates</span>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{interviewData.highRescheduleCount}</div>
              <div className="text-[10px] text-muted-foreground">Rescheduled ≥ 2 times</div>
            </div>
          </div>

          {/* VISUAL CHARTS VIEW */}
          {viewMode === 'visual' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Interview Schedule Distribution
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Today', count: interviewData.byBucket.Today },
                        { name: 'Tomorrow', count: interviewData.byBucket.Tomorrow },
                        { name: 'This Week', count: interviewData.byBucket['This Week'] },
                        { name: 'Overdue', count: interviewData.byBucket.Overdue },
                        { name: 'Upcoming', count: interviewData.byBucket.Upcoming }
                      ]}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} />
                      <YAxis stroke="#888888" fontSize={11} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-amber-500" /> Reschedule & Attendance Velocity
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Candidates rescheduled multiple times have a 68% drop rate. Track them to reduce drop-after-lineup.
                  </p>

                  <div className="mt-5 space-y-3">
                    {interviewData.list.filter((i) => (i.rescheduleCount || 1) >= 2).map((item) => (
                      <div key={item.candidateId} className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs flex items-center justify-between">
                        <div>
                          <div className="font-bold text-foreground">{item.candidateName}</div>
                          <div className="text-[11px] text-muted-foreground">{item.clientName} • {item.designation}</div>
                        </div>
                        <span className="font-bold px-2 py-1 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 text-[10px]">
                          {item.rescheduleCount} Attempts
                        </span>
                      </div>
                    ))}
                    {interviewData.highRescheduleCount === 0 && (
                      <div className="py-8 text-center text-muted-foreground text-xs">No high reschedule warnings currently!</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TABLE VIEW */}
          {viewMode === 'table' && (
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">Candidate</th>
                      <th className="p-3">Client & Role</th>
                      <th className="p-3">Assigned HR</th>
                      <th className="p-3">Interview Date</th>
                      <th className="p-3">Timeframe</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Reschedule #</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {interviewData.list.map((item) => (
                      <tr key={item.candidateId} className="hover:bg-muted/40">
                        <td className="p-3 font-mono font-medium text-foreground">{item.candidateId}</td>
                        <td className="p-3 font-semibold text-foreground">{item.candidateName}</td>
                        <td className="p-3 text-foreground">{item.clientName} ({item.designation})</td>
                        <td className="p-3 text-muted-foreground">{item.assignedHR}</td>
                        <td className="p-3 font-mono text-primary font-bold">{item.interviewDate}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.timeBucket === 'Today' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
                            item.timeBucket === 'Overdue' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-muted text-muted-foreground'
                          }`}>
                            {item.timeBucket}
                          </span>
                        </td>
                        <td className="p-3">{item.interviewStatus || 'Pending'}</td>
                        <td className="p-3 text-right font-bold">{item.rescheduleCount || 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUMMARY CARDS VIEW */}
          {viewMode === 'summary' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {interviewData.list.map((item) => (
                <div key={item.candidateId} className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground">{item.candidateId}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-foreground">{item.timeBucket}</span>
                  </div>
                  <div className="font-bold text-base text-foreground">{item.candidateName}</div>
                  <div className="text-xs text-muted-foreground">{item.designation} at <strong className="text-foreground">{item.clientName}</strong></div>
                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                    <span>📅 {item.interviewDate}</span>
                    <span className="text-muted-foreground">HR: {item.assignedHR}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* REPORT 2: JOINING & BILLING REPORT (Commercials, Replacement Guarantee)   */}
      {/* ========================================================================= */}
      {activeReport === 'joinings' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
              <span className="text-xs font-semibold text-muted-foreground">Total Invoiced Amount</span>
              <div className="text-2xl font-bold text-foreground mt-1">₹ {joiningData.totalRevenue.toLocaleString('en-IN')}</div>
              <div className="text-[10px] text-muted-foreground">{joiningData.list.length} successful placements</div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
              <span className="text-xs font-semibold text-muted-foreground">Pending Collection</span>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">₹ {joiningData.pendingRevenue.toLocaleString('en-IN')}</div>
              <div className="text-[10px] text-muted-foreground">Awaiting client payment</div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
              <span className="text-xs font-semibold text-muted-foreground">Active Guarantees</span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{joiningData.activeGuarantees}</div>
              <div className="text-[10px] text-muted-foreground">Under replacement warranty</div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
              <span className="text-xs font-semibold text-muted-foreground">Invoices Due in 7 Days</span>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{joiningData.dueSoon}</div>
              <div className="text-[10px] text-muted-foreground">Approaching payment milestone</div>
            </div>
          </div>

          {/* TABLE VIEW */}
          {viewMode === 'table' ? (
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Candidate</th>
                      <th className="p-3">Client</th>
                      <th className="p-3">Joining Date</th>
                      <th className="p-3">Annual CTC</th>
                      <th className="p-3">Fee Model</th>
                      <th className="p-3">Invoice Amount</th>
                      <th className="p-3">Days Completed</th>
                      <th className="p-3">Replacement Ends</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {joiningData.list.map((j) => (
                      <tr key={j.candidateId} className="hover:bg-muted/40">
                        <td className="p-3 font-semibold text-foreground">
                          {j.candidateName}
                          <div className="text-[10px] font-mono text-muted-foreground">{j.candidateId}</div>
                        </td>
                        <td className="p-3 text-foreground">{j.clientName}</td>
                        <td className="p-3 font-mono text-muted-foreground">{j.joiningDate}</td>
                        <td className="p-3 font-mono font-semibold">₹ {Number(j.annualCtc).toLocaleString('en-IN')}</td>
                        <td className="p-3 text-muted-foreground">{j.feeType} ({j.feeValue})</td>
                        <td className="p-3 font-mono font-bold text-foreground">₹ {Number(j.invoiceAmount).toLocaleString('en-IN')}</td>
                        <td className="p-3 font-bold">{j.daysCompleted} days</td>
                        <td className="p-3 text-muted-foreground">{j.replacementEnds} ({j.replacementRemainingDays}d left)</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            j.invoiceStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                            'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                          }`}>
                            {j.invoiceStatus || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {joiningData.list.map((j) => (
                <div key={j.candidateId} className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-base text-foreground">{j.candidateName}</h4>
                      <div className="text-xs text-muted-foreground">{j.designation} at <strong>{j.clientName}</strong></div>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      ₹ {Number(j.invoiceAmount).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-muted/20 p-3 rounded-xl border border-border/50">
                    <div>Joining Date: <strong>{j.joiningDate}</strong></div>
                    <div>Days Active: <strong>{j.daysCompleted} days</strong></div>
                    <div>Invoice Due: <strong>{j.invoiceDueDate}</strong></div>
                    <div>Replacement: <strong>{j.replacementRemainingDays} days left</strong></div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                    <span className="text-muted-foreground">Invoice No: {j.invoiceNo || 'Draft'}</span>
                    <span className="font-semibold text-primary">{j.invoiceStatus}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* REPORT 3: RECRUITER SCORECARD REPORT                                      */}
      {/* ========================================================================= */}
      {activeReport === 'recruiters' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Recruiter Productivity Matrix & Conversion Scorecard
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Recruiter</th>
                    <th className="p-3 text-center">Sourced</th>
                    <th className="p-3 text-center">Connected</th>
                    <th className="p-3 text-center">Interviews</th>
                    <th className="p-3 text-center">Selected</th>
                    <th className="p-3 text-center">Joined</th>
                    <th className="p-3 text-right">Sourced → Joined %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recruiterData.map((rec) => (
                    <tr key={rec.name} className="hover:bg-muted/40">
                      <td className="p-3 font-bold text-foreground flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                          {rec.name.slice(0, 1)}
                        </div>
                        {rec.name}
                      </td>
                      <td className="p-3 text-center font-semibold">{rec.totalSourced}</td>
                      <td className="p-3 text-center">{rec.connected}</td>
                      <td className="p-3 text-center font-semibold text-blue-600 dark:text-blue-400">{rec.scheduled}</td>
                      <td className="p-3 text-center font-semibold text-indigo-600 dark:text-indigo-400">{rec.selected}</td>
                      <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{rec.joined}</td>
                      <td className="p-3 text-right font-bold text-primary">{rec.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REPORT 4: CLIENT CONVERSION & EFFICIENCY REPORT                           */}
      {/* ========================================================================= */}
      {activeReport === 'clients' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" /> Corporate Client Conversion & Hiring Performance
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Client Name</th>
                    <th className="p-3">Industry</th>
                    <th className="p-3 text-center">Openings</th>
                    <th className="p-3 text-center">Lined up</th>
                    <th className="p-3 text-center">Selected</th>
                    <th className="p-3 text-center">Joined</th>
                    <th className="p-3 text-right">Lineup → Joined %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clientData.map((cl) => (
                    <tr key={cl.clientName} className="hover:bg-muted/40">
                      <td className="p-3 font-bold text-foreground">{cl.clientName}</td>
                      <td className="p-3 text-muted-foreground">{cl.industry}</td>
                      <td className="p-3 text-center font-semibold">{cl.activeOpenings}</td>
                      <td className="p-3 text-center">{cl.linedUp}</td>
                      <td className="p-3 text-center font-semibold text-indigo-600 dark:text-indigo-400">{cl.selected}</td>
                      <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{cl.joined}</td>
                      <td className="p-3 text-right font-bold text-primary">{cl.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REPORT 5: DROP & REJECTION ROOT CAUSE ANALYSIS                            */}
      {/* ========================================================================= */}
      {activeReport === 'dropoffs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" /> Root-Cause Drop Breakdown
              </h3>
              <div className="space-y-3">
                {dropoffData.map((d, i) => (
                  <div key={d.reason} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{d.reason}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-red-500 h-2 rounded-full"
                          style={{ width: `${Math.min(100, d.count * 30)}%` }}
                        />
                      </div>
                      <span className="font-bold text-foreground w-6 text-right">{d.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground">Operational Insights</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Root-cause analysis based on recruiters' logged Sub-Disposition selections:
                </p>
                <ul className="mt-3 space-y-2 text-xs text-muted-foreground list-disc list-inside">
                  <li><strong>Salary Expectation Gap:</strong> Primary reason candidates decline client offers after attending interview rounds.</li>
                  <li><strong>Location & Commute Issues:</strong> Common when candidate area is &gt; 15km from office/interview address.</li>
                  <li><strong>Drop After Lineup:</strong> Occurs when candidates are lined up without direct WhatsApp/phone pre-qualification on timings.</li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-primary/10 text-primary text-xs font-medium">
                Recommendation: Pre-align client salary slabs and verify candidate commute distance before confirming interview date.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
