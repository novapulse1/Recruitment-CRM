import React, { useState } from 'react';
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
  ExternalLink
} from 'lucide-react';
import type { InterviewItem, User as AuthUser } from '../types';

interface InterviewsViewProps {
  interviews: InterviewItem[];
  currentUser: AuthUser;
  onSelectCandidate: (candidateId: string) => void;
  onRefresh: () => void;
}

export const InterviewsView: React.FC<InterviewsViewProps> = ({
  interviews,
  currentUser,
  onSelectCandidate,
  onRefresh
}) => {
  const [activeBucket, setActiveBucket] = useState<'All' | 'Today' | 'Tomorrow' | 'This Week' | 'Overdue'>('All');
  const [search, setSearch] = useState('');

  const filtered = interviews.filter((item) => {
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
    Today: interviews.filter((i) => i.timeBucket === 'Today').length,
    Tomorrow: interviews.filter((i) => i.timeBucket === 'Tomorrow').length,
    'This Week': interviews.filter((i) => i.timeBucket === 'This Week').length,
    Overdue: interviews.filter((i) => i.timeBucket === 'Overdue').length
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
                {item.rescheduleFlag === 'HIGH RESCHEDULE' && (
                  <div className="mt-2 text-[10px] font-bold px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 flex items-center gap-1">
                    <RotateCcw className="h-3 w-3 text-amber-600" />
                    High Reschedule ({item.rescheduleCount} attempts)
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
