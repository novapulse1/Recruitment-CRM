import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Phone,
  User,
  Building,
  Briefcase,
  Search,
  Filter,
  ExternalLink,
  Download
} from 'lucide-react';
import type { Candidate, InterviewItem, User as AuthUser } from '../types';
import { calculateInterviewTimeBucket, parseDateIST } from '../utils/formatters';
import { downloadCSV, type CSVColumn } from '../utils/csvExport';

const INTERVIEW_CSV_COLUMNS: CSVColumn<InterviewItem>[] = [
  { key: 'candidateId', label: 'Candidate ID', format: 'text' },
  { key: 'candidateName', label: 'Candidate Name' },
  { key: 'clientName', label: 'Client Name' },
  { key: 'designation', label: 'Designation' },
  { key: 'interviewDate', label: 'Interview Date' },
  { key: 'interviewStatus', label: 'Interview Status' },
  { key: 'timeBucket', label: 'Time Bucket' },
  { key: 'rescheduleCount', label: 'Reschedule Count', format: 'number' },
  { key: 'mobile', label: 'Mobile Number', format: 'text' },
  { key: 'assignedHR', label: 'Assigned HR' },
  { key: 'hrEmail', label: 'HR Email' }
];

interface InterviewsViewProps {
  interviews: InterviewItem[];
  candidates?: Candidate[];
  currentUser: AuthUser;
  onSelectCandidate: (candidateId: string) => void;
  onRefresh: () => void;
}

export const InterviewsView: React.FC<InterviewsViewProps> = ({
  interviews = [],
  candidates = [],
  currentUser,
  onSelectCandidate,
  onRefresh
}) => {
  const [activeBucket, setActiveBucket] = useState<'All' | 'Today' | 'Tomorrow' | 'This Week' | 'Overdue'>('All');
  const [search, setSearch] = useState('');

  const processedInterviews = useMemo(() => {
    // 1. Map candidates by candidateId for lookup
    const candMap = new Map<string, Candidate>();
    (candidates || []).forEach((c) => {
      if (c['Candidate ID']) candMap.set(c['Candidate ID'], c);
    });

    // 2. Group raw interviews by candidateId
    const grouped = new Map<string, InterviewItem[]>();
    (interviews || []).forEach((item) => {
      if (!item.candidateId) return;
      const list = grouped.get(item.candidateId) || [];
      list.push(item);
      grouped.set(item.candidateId, list);
    });

    // 3. Also include candidates in "Interview Scheduled" stage who might not be in interviews collection
    (candidates || []).forEach((c) => {
      const id = c['Candidate ID'];
      if (!id) return;
      const isInterviewStage =
        c['Pipeline Stage'] === 'Interview Scheduled' ||
        Boolean(c['Interview Date'] && c['Interview Date'] !== '-');
      if (isInterviewStage && !grouped.has(id)) {
        grouped.set(id, [
          {
            candidateId: id,
            candidateName: c['Candidate Name'] || 'Unknown Candidate',
            mobile: c['Mobile Number'] || '',
            designation: c['Designation Applied'] || 'General',
            clientName: c['Client Name'] || 'Client not set',
            assignedHR: c['Assigned HR'] || 'Unassigned',
            hrEmail: c['HR Email'] || '',
            interviewDate: c['Interview Date'] || '',
            interviewStatus: c['Interview Status'] || 'Pending',
            timeBucket: 'Upcoming'
          }
        ]);
      }
    });

    // 4. Collapse each candidate's interviews to single record with reschedule history
    const deduplicated: (InterviewItem & {
      attemptCount: number;
      earlierAttempts: string[];
    })[] = [];

    grouped.forEach((items, candidateId) => {
      const cand = candMap.get(candidateId);

      // Sort items by date ascending
      items.sort((a, b) => {
        const da = parseDateIST(a.interviewDate)?.getTime() || 0;
        const db = parseDateIST(b.interviewDate)?.getTime() || 0;
        return da - db;
      });

      const latest = items[items.length - 1];
      const effectiveInterviewDate = latest.interviewDate || cand?.['Interview Date'] || '';
      const effectiveClient =
        latest.clientName && latest.clientName !== 'Client not set'
          ? latest.clientName
          : cand?.['Client Name'] || 'Client not set';
      const effectiveDesignation =
        latest.designation && latest.designation !== 'General'
          ? latest.designation
          : cand?.['Designation Applied'] || 'General';
      const effectiveMobile = latest.mobile || cand?.['Mobile Number'] || '';
      const effectiveHR = latest.assignedHR || cand?.['Assigned HR'] || 'Unassigned';

      const timeBucket = calculateInterviewTimeBucket(effectiveInterviewDate, latest.interviewStatus);
      const earlierAttempts = items.slice(0, -1).map((i) => i.interviewDate).filter(Boolean);

      deduplicated.push({
        ...latest,
        candidateName: latest.candidateName || cand?.['Candidate Name'] || 'Unknown',
        clientName: effectiveClient,
        designation: effectiveDesignation,
        mobile: effectiveMobile,
        assignedHR: effectiveHR,
        interviewDate: effectiveInterviewDate || 'Date missing',
        timeBucket,
        attemptCount: items.length,
        earlierAttempts,
        rescheduleFlag: items.length >= 2 ? 'HIGH RESCHEDULE' : latest.rescheduleFlag,
        rescheduleCount: items.length - 1
      });
    });

    return deduplicated;
  }, [interviews, candidates]);

  const filtered = processedInterviews.filter((item) => {
    if (activeBucket !== 'All' && item.timeBucket !== activeBucket) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.candidateName?.toLowerCase().includes(q) ||
        item.candidateId?.toLowerCase().includes(q) ||
        item.clientName?.toLowerCase().includes(q) ||
        item.designation?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const bucketCounts = {
    Today: processedInterviews.filter((i) => i.timeBucket === 'Today').length,
    Tomorrow: processedInterviews.filter((i) => i.timeBucket === 'Tomorrow').length,
    'This Week': processedInterviews.filter((i) => i.timeBucket === 'This Week').length,
    Overdue: processedInterviews.filter((i) => i.timeBucket === 'Overdue').length
  };

  const isAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN';

  const handleExportInterviews = async () => {
    if (!isAdmin) return;
    const nowStamp = new Date().toISOString().slice(0, 10);
    const bucketSuffix = activeBucket === 'All' ? 'All' : activeBucket.replace(/\s+/g, '_');
    await downloadCSV({
      filename: `NovaPulse_Interviews_${bucketSuffix}_${nowStamp}.csv`,
      columns: INTERVIEW_CSV_COLUMNS,
      data: filtered,
      moduleName: 'Interviews',
      currentUserEmail: currentUser.email
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Interview Schedule & Pipeline
          </h1>
          <p className="text-xs text-muted-foreground">
            Track upcoming lineups, client interviews, and reschedule flags
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Time Bucket Tabs */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border">
            {(['All', 'Today', 'Tomorrow', 'This Week', 'Overdue'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setActiveBucket(b)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeBucket === b
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{b}</span>
                {b !== 'All' && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      b === 'Overdue' && bucketCounts.Overdue > 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {bucketCounts[b]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Export Interviews Button (Admin only) */}
          {isAdmin && (
            <button
              onClick={handleExportInterviews}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors"
              title="Export Interviews to CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Overdue Warning Alert */}
      {bucketCounts.Overdue > 0 && activeBucket === 'Overdue' && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-200 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <span>
            <strong>Attention:</strong> {bucketCounts.Overdue} interview(s) have passed their scheduled date but
            are still marked as Pending. Please follow up with candidates and update outcomes.
          </span>
        </div>
      )}

      {/* Search Input */}
      <div className="p-3 rounded-xl border border-border bg-card shadow-sm flex items-center gap-3">
        <div className="relative max-w-md w-full">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search candidate, role, client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground outline-none"
          />
        </div>
      </div>

      {/* Interviews Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center text-muted-foreground text-sm">
            No interviews found in this view.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.candidateId}
              onClick={() => onSelectCandidate(item.candidateId)}
              className="p-5 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                      {item.candidateId}
                    </span>
                    <h3 className="font-bold text-base text-foreground mt-1 group-hover:text-primary transition-colors">
                      {item.candidateName}
                    </h3>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Briefcase className="h-3.5 w-3.5" /> {item.designation || 'General'}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      item.timeBucket === 'Today'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : item.timeBucket === 'Tomorrow'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                        : item.timeBucket === 'Overdue'
                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {item.timeBucket}
                  </span>
                </div>

                {/* Reschedule Alert Tag */}
                {item.attemptCount > 1 && (
                  <div className="mt-2 text-[10px] font-semibold px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                    <RotateCcw className="h-3 w-3 text-amber-600 shrink-0" />
                    <span>
                      Attempt {item.attemptCount} of {item.attemptCount}
                      {item.earlierAttempts.length > 0 && ` — Rescheduled from ${item.earlierAttempts[item.earlierAttempts.length - 1]}`}
                    </span>
                  </div>
                )}

                {/* Details */}
                <div className="mt-3 text-xs space-y-1.5 text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Building className="h-3.5 w-3.5 text-primary" /> {item.clientName || 'Client not set'}
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-primary font-bold">
                    <CalendarIcon className="h-3.5 w-3.5" /> {item.interviewDate}
                  </div>
                  <div className="flex items-center gap-1.5 font-mono">
                    <Phone className="h-3.5 w-3.5" /> {item.mobile}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">HR: {item.assignedHR}</span>
                <span className="font-semibold text-primary group-hover:underline">View Profile →</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
