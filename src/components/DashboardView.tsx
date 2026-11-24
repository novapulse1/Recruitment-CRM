import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Users,
  PhoneCall,
  Calendar,
  CheckCircle2,
  DollarSign,
  Award,
  AlertOctagon,
  Building,
  Target,
  ArrowUpRight,
  RefreshCw,
  IndianRupee,
  Activity,
  RotateCcw,
  Clock,
  PieChart as PieIcon,
  Filter,
  ShieldCheck,
  UserCheck
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
import type { DashboardMetrics, Candidate, InterviewItem, JoiningRecord, Client, User } from '../types';
import { formatINR, parseCurrency } from '../utils/formatters';

interface DashboardViewProps {
  metrics: DashboardMetrics | null;
  currentUser: User;
  candidates: Candidate[];
  interviews: InterviewItem[];
  joinings: JoiningRecord[];
  clients: Client[];
  onRefresh: () => void;
  onSelectCandidate: (candidateId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  currentUser,
  candidates = [],
  interviews = [],
  joinings = [],
  clients = [],
  onRefresh,
  onSelectCandidate
}) => {
  const safeCandidates = candidates || [];
  const safeInterviews = interviews || [];
  const safeJoinings = joinings || [];
  const safeClients = clients || [];

  const isAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN';

  const [selectedMonth, setSelectedMonth] = useState('Nov-2026');
  const [filterHR, setFilterHR] = useState('');
  const [filterClient, setFilterClient] = useState('');

  // Extract unique recruiters and clients for dashboard filtering
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

  // Filter candidates based on dashboard selections
  const filteredCandidates = useMemo(() => {
    return safeCandidates.filter((c) => {
      if (!c) return false;
      if (currentUser?.role === 'HR' && String(c['HR Email'] || '').toLowerCase() !== currentUser?.email?.toLowerCase()) {
        return false;
      }
      if (filterHR && c['Assigned HR'] !== filterHR) return false;
      if (filterClient && c['Client Name'] !== filterClient) return false;
      return true;
    });
  }, [safeCandidates, currentUser, filterHR, filterClient]);

  // Dynamic funnel calculation based on active filter
  const funnel = useMemo(() => {
    const sourced = filteredCandidates.length;
    const connected = filteredCandidates.filter((c) => c['Connect Status'] === 'Connect' || c['Calling Disposition'] || c['Interview Date']).length;
    const interested = filteredCandidates.filter((c) => c['Calling Disposition'] === 'Interested' || c['Calling Disposition'] === 'Interview Schedule' || c['Interview Date']).length;
    const interviewScheduled = filteredCandidates.filter((c) => c['Interview Date'] && c['Interview Date'] !== '-').length;
    const interviewAttended = filteredCandidates.filter((c) => c['Interview Status'] === 'Attended' || c['Selection Status'] === 'Selected' || c['Joining Status'] === 'Joined').length;
    const selected = filteredCandidates.filter((c) => c['Selection Status'] === 'Selected' || c['Joining Status'] === 'Joined').length;
    const joined = filteredCandidates.filter((c) => c['Joining Status'] === 'Joined').length;

    return { sourced, connected, interested, interviewScheduled, interviewAttended, selected, joined };
  }, [filteredCandidates]);

  const funnelData = [
    { name: 'Sourced', count: funnel.sourced, fill: '#6366f1' },
    { name: 'Connected', count: funnel.connected, fill: '#3b82f6' },
    { name: 'Interested', count: funnel.interested, fill: '#06b6d4' },
    { name: 'Scheduled', count: funnel.interviewScheduled, fill: '#0284c7' },
    { name: 'Attended', count: funnel.interviewAttended, fill: '#10b981' },
    { name: 'Selected', count: funnel.selected, fill: '#8b5cf6' },
    { name: 'Joined', count: funnel.joined, fill: '#059669' }
  ];

  // Pipeline Stage Distribution (Pie / Donut Chart)
  const stageDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCandidates.forEach((c) => {
      const stage = c['Pipeline Stage'] || 'Sourced';
      map[stage] = (map[stage] || 0) + 1;
    });
    return Object.keys(map).map((stage) => ({ name: stage, value: map[stage] }));
  }, [filteredCandidates]);

  // Commercial Revenue Pipeline Projections
  const commercialHealth = useMemo(() => {
    const totalInvoiced = safeJoinings.reduce((acc, j) => acc + (parseCurrency(j?.invoiceAmount || j?.feeValue) || 0), 0);
    const paidRevenue = safeJoinings.filter((j) => j?.invoiceStatus === 'Paid').reduce((acc, j) => acc + (parseCurrency(j?.invoiceAmount || j?.feeValue) || 0), 0);
    const pendingDue = safeJoinings.filter((j) => j?.invoiceStatus !== 'Paid').reduce((acc, j) => acc + (parseCurrency(j?.invoiceAmount || j?.feeValue) || 0), 0);

    // Projected revenue from candidates who are currently Selected but not yet in Joining Tracker
    const selectedCandidates = filteredCandidates.filter(
      (c) => c && (c['Selection Status'] === 'Selected' || c['Pipeline Stage'] === 'Selected – Joining Pending') && c['Joining Status'] !== 'Joined'
    );
    const projectedSelected = selectedCandidates.length * 25000; // estimated avg fee

    return {
      totalInvoiced,
      paidRevenue,
      pendingDue,
      projectedSelected,
      totalPipelinePotential: totalInvoiced + projectedSelected,
      dueSoonCount: safeJoinings.filter((j) => j?.invoiceDueSoon).length
    };
  }, [safeJoinings, filteredCandidates]);

  // Interview Attendance & Reschedule Health
  const interviewMetrics = useMemo(() => {
    // Total lineups: candidates who reached interview stage or have interview dates
    const linedUpCandidates = filteredCandidates.filter(
      (c) =>
        c['Pipeline Stage'] === 'Interview Scheduled' ||
        c['Pipeline Stage'] === 'Interview Attended' ||
        Boolean(c['Interview Date'] && c['Interview Date'] !== '-')
    );
    const totalLineups = Math.max(safeInterviews.length, linedUpCandidates.length);
    const attended = filteredCandidates.filter(
      (c) => c['Pipeline Stage'] === 'Interview Attended' || c['Selection Status'] === 'Selected' || c['Joining Status'] === 'Joined'
    ).length;
    const pending = filteredCandidates.filter(
      (c) => c['Pipeline Stage'] === 'Interview Scheduled' && (!c['Selection Status'] || c['Selection Status'] === 'Pending')
    ).length;
    const dropped = filteredCandidates.filter(
      (c) => c['Pipeline Stage'] === 'Interview No Show' || c['Pipeline Stage'] === 'Dropped / Not Joined'
    ).length;
    const highRescheduled = safeInterviews.filter((i) => (i?.rescheduleCount || 0) >= 2);
    const attendanceRate = totalLineups ? Math.round((attended / totalLineups) * 100) : 0;

    return { totalLineups, attended, pending, dropped, highRescheduled, attendanceRate };
  }, [filteredCandidates, safeInterviews]);

  // Drop Reasons Breakdown (Filtered to true negative drop/rejections only)
  const activeDropReasons = useMemo(() => {
    const POSITIVE_STATUSES = new Set([
      'interview schedule',
      'interview scheduled',
      'interview attended',
      'interested',
      'call back',
      'callback',
      'connected',
      'shortlisted',
      'selected',
      'joined',
      'none',
      '-'
    ]);

    const map: Record<string, number> = {};
    filteredCandidates.forEach((c) => {
      if (!c) return;
      const stage = c['Pipeline Stage'] || '';
      const disp = c['Calling Disposition'] || '';
      const status = c['Interview Status'] || '';
      const subDisp = (c['Sub-Disposition'] || '').trim();

      const isDrop =
        stage === 'Rejected' ||
        stage === 'Dropped / Not Joined' ||
        stage === 'Not Interested / Closed' ||
        stage === 'Interview No Show' ||
        disp === 'Not Interested' ||
        disp === 'Not Reachable' ||
        status === 'Drop After Lineup' ||
        c['Selection Status'] === 'Rejected';

      if (isDrop) {
        let reason = 'Other';
        if (subDisp && !POSITIVE_STATUSES.has(subDisp.toLowerCase())) {
          reason = subDisp;
        } else if (stage === 'Interview No Show' || status === 'No Show') {
          reason = 'Interview No Show';
        } else if (status === 'Drop After Lineup') {
          reason = 'Drop After Lineup';
        } else if (c['Selection Status'] === 'Rejected') {
          reason = 'Rejected by Client';
        } else if (disp === 'Not Reachable') {
          reason = 'Not Reachable';
        } else if (disp === 'Not Interested') {
          reason = 'Not Interested';
        } else if (stage === 'Dropped / Not Joined') {
          reason = 'Dropped Before Joining';
        }
        map[reason] = (map[reason] || 0) + 1;
      }
    });

    return Object.keys(map)
      .map((reason) => ({ reason, count: map[reason] }))
      .sort((a, b) => b.count - a.count);
  }, [filteredCandidates]);

  // Industry Diversity Breakdown
  const industryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCandidates.forEach((c) => {
      const ind = c['Industry'] || 'Other';
      map[ind] = (map[ind] || 0) + 1;
    });
    return Object.keys(map)
      .map((k) => ({ industry: k, count: map[k] }))
      .sort((a, b) => b.count - a.count);
  }, [filteredCandidates]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

  return (
    <div className="space-y-6">
      {/* Top Header & Interactive Dashboard Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {isAdmin ? 'Executive Recruitment Dashboard' : 'My Recruiter Workspace'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time pipeline visibility, commercial revenue forecasting, and recruiter analytics
          </p>
        </div>

        {/* Dashboard Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <select
              value={filterHR}
              onChange={(e) => setFilterHR(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground outline-none shadow-sm"
            >
              <option value="">All Recruiters</option>
              {hrNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}

          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground outline-none shadow-sm"
          >
            <option value="">All Clients</option>
            {clientNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground outline-none shadow-sm"
          >
            <option value="Nov-2026">November 2026</option>
            <option value="Oct-2026">October 2026</option>
          </select>

          <button
            onClick={onRefresh}
            className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground shadow-sm transition-colors"
            title="Refresh Metrics"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Primary KPI Header Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Candidates</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">{funnel.sourced}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Active in portfolio</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Connected</span>
            <PhoneCall className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">{funnel.connected}</div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
            {funnel.sourced ? Math.round((funnel.connected / funnel.sourced) * 100) : 0}% outreach rate
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Scheduled Lineups</span>
            <Calendar className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">{funnel.interviewScheduled}</div>
          <div className="text-[10px] text-purple-600 font-semibold mt-0.5">
            {funnel.interviewAttended} attended
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Selections</span>
            <Award className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">{funnel.selected}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Client offers extended</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Joined Placements</span>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{funnel.joined}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Under guarantee window</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">
              {isAdmin ? 'Invoiced Revenue' : 'Sourced → Joined'}
            </span>
            <IndianRupee className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">
            {isAdmin
              ? `₹ ${Number(commercialHealth.totalInvoiced).toLocaleString('en-IN')}`
              : `${funnel.sourced ? Math.round((funnel.joined / funnel.sourced) * 100) : 0}%`}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {isAdmin ? 'Total billed placements' : 'Full conversion yield'}
          </div>
        </div>
      </div>

      {/* Row 2: Commercial Health Forecast & Pipeline Stage Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Commercial Revenue & Cashflow Pipeline Widget (High Visibility) */}
        {isAdmin && (
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-emerald-600" />
                  Commercial Health & Cashflow
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  Billing Active
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Realized collections vs pending client invoices & pipeline pipeline
              </p>

              <div className="mt-4 space-y-3">
                <div className="p-3 rounded-xl bg-muted/30 border border-border flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-muted-foreground">Realized Cash (Paid)</div>
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      ₹ {commercialHealth.paidRevenue.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <CheckCircle2 className="h-6 w-6 text-emerald-500/40" />
                </div>

                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-amber-900 dark:text-amber-300 font-medium">Invoiced & Pending Collection</div>
                    <div className="text-lg font-bold text-amber-700 dark:text-amber-200">
                      ₹ {commercialHealth.pendingDue.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <Clock className="h-6 w-6 text-amber-500/40" />
                </div>

                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-indigo-900 dark:text-indigo-300 font-medium">Projected Pipeline (Selected)</div>
                    <div className="text-lg font-bold text-indigo-700 dark:text-indigo-200">
                      ₹ {commercialHealth.projectedSelected.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <TrendingUp className="h-6 w-6 text-indigo-500/40" />
                </div>
              </div>
            </div>

            {commercialHealth.dueSoonCount > 0 && (
              <div className="text-xs p-2.5 rounded-xl bg-amber-100/70 text-amber-900 dark:bg-amber-950 dark:text-amber-200 font-medium flex items-center gap-1.5">
                <AlertOctagon className="h-3.5 w-3.5 text-amber-600" />
                <span>{commercialHealth.dueSoonCount} client invoice(s) due within 7 days.</span>
              </div>
            )}
          </div>
        )}

        {/* Pipeline Stage Distribution Donut Chart */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-primary" />
              Pipeline Stage Distribution
            </h3>
            <span className="text-xs text-muted-foreground">{filteredCandidates.length} Candidates</span>
          </div>

          {stageDistribution.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
              No candidates in pipeline yet.
            </div>
          ) : (
            <>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stageDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {stageDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-wrap gap-2 text-[10px] justify-center">
                {stageDistribution.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-foreground font-semibold">{item.name}:</span>
                    <span className="text-muted-foreground font-bold">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Interview Health & High Reschedule Warning Card */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-purple-600" />
                Interview Attendance & Velocity
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                {interviewMetrics.attendanceRate}% Attended
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Candidate lineup attendance vs reschedule attempts
            </p>

            <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border">
                <div className="text-[10px] text-muted-foreground">Lineups</div>
                <div className="font-bold text-foreground text-sm">{interviewMetrics.totalLineups}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                <div className="text-[10px] text-emerald-700 dark:text-emerald-300">Attended</div>
                <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{interviewMetrics.attended}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
                <div className="text-[10px] text-red-700 dark:text-red-300">Dropped</div>
                <div className="font-bold text-red-600 dark:text-red-400 text-sm">{interviewMetrics.dropped}</div>
              </div>
            </div>

            {/* High Reschedule Attention List */}
            <div className="mt-4 space-y-2">
              <div className="text-xs font-bold text-foreground">High Reschedules Needing Attention:</div>
              {interviewMetrics.highRescheduled.length === 0 ? (
                <div className="text-xs text-muted-foreground italic py-2">No candidates rescheduled ≥ 2 times.</div>
              ) : (
                interviewMetrics.highRescheduled.map((item) => (
                  <div
                    key={item.candidateId}
                    onClick={() => onSelectCandidate(item.candidateId)}
                    className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center justify-between text-xs cursor-pointer hover:bg-amber-100 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-foreground">{item.candidateName}</div>
                      <div className="text-[10px] text-muted-foreground">{item.clientName} • HR: {item.assignedHR}</div>
                    </div>
                    <span className="font-bold px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 text-[10px]">
                      {item.rescheduleCount} Attempts
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Conversion Funnel & Recruiter Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recruitment Conversion Funnel */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Recruitment Conversion Funnel
            </h2>
            <span className="text-xs text-muted-foreground">Full Candidate Trajectory</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 30 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} textAnchor="end" />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-2.5 bg-card border border-border shadow-xl rounded-xl text-xs">
                          <div className="font-bold text-foreground">{data.name}</div>
                          <div className="text-primary font-semibold">{data.count} candidates</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[0, 8, 8, 0]} label={{ position: 'right', fill: '#64748b', fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Drop Reasons Analysis */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-red-500" />
              Drop Reasons Breakdown
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Logged sub-disposition root causes</p>

            <div className="mt-4 space-y-2.5">
              {activeDropReasons.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-xs">No drop reasons logged yet.</div>
              ) : (
                activeDropReasons.slice(0, 8).map((dr, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-foreground truncate max-w-[170px]">{dr.reason}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-red-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(15, (dr.count / (activeDropReasons[0]?.count || 1)) * 100))}%` }}
                        />
                      </div>
                      <span className="font-bold text-foreground">{dr.count}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Recruiter Leaderboard & Industry Breakdown */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recruiter Leaderboard */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" />
                Recruiter Productivity Leaderboard
              </h2>
              <span className="text-xs text-muted-foreground">Ranked by placements</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="text-[10px] uppercase font-semibold text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2">Recruiter</th>
                    <th className="py-2 text-center">Sourced</th>
                    <th className="py-2 text-center">Connected</th>
                    <th className="py-2 text-center">Interviews</th>
                    <th className="py-2 text-center">Selected</th>
                    <th className="py-2 text-right">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(!metrics?.leaderboard || metrics.leaderboard.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                        No recruiter performance recorded yet.
                      </td>
                    </tr>
                  ) : (
                    (metrics?.leaderboard || []).map((hr, idx) => (
                      <tr key={hr?.hrName || idx} className="hover:bg-muted/40">
                        <td className="py-2.5 font-semibold text-foreground flex items-center gap-2">
                          <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          {hr?.hrName || 'Recruiter'}
                        </td>
                        <td className="py-2.5 text-center text-muted-foreground">{hr?.sourced || 0}</td>
                        <td className="py-2.5 text-center text-muted-foreground">{hr?.connected || 0}</td>
                        <td className="py-2.5 text-center text-muted-foreground">{hr?.interviews || 0}</td>
                        <td className="py-2.5 text-center font-semibold text-foreground">{hr?.selected || 0}</td>
                        <td className="py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {hr?.joined || 0}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Industry Distribution Breakdown */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" />
                Industry Sector Distribution
              </h2>
              <span className="text-xs text-muted-foreground">Candidate Domain Diversity</span>
            </div>

            <div className="space-y-3">
              {industryBreakdown.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-xs">No candidate industry data yet.</div>
              ) : (
                industryBreakdown.map((ib) => (
                  <div key={ib.industry} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground truncate max-w-[200px]">{ib.industry}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${filteredCandidates.length ? Math.min(100, (ib.count / filteredCandidates.length) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="font-bold text-foreground w-6 text-right">{ib.count}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
