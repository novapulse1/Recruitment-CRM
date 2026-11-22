import React from 'react';
import { Menu, Search, Plus, ShieldCheck, Shield, UserCog, UserCheck, CreditCard, Lock } from 'lucide-react';
import type { User, UserRole } from '../types';
import { can } from '../services/permissions';

interface HeaderProps {
  activeTab: string;
  currentUser: User;
  onOpenMobileSidebar: () => void;
  onOpenSearch: () => void;
  onOpenAddModal: () => void;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  currentUser,
  onOpenMobileSidebar,
  onOpenSearch,
  onOpenAddModal
}) => {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Executive Dashboard';
      case 'candidates':
        return 'Candidate Master Database';
      case 'openings':
        return 'Active Job Openings';
      case 'clients':
        return 'Corporate Clients & Commercials';
      case 'interviews':
        return 'Interview Pipeline & Schedule';
      case 'reports':
        return 'Intelligence & Reporting Center';
      case 'leads':
        return 'Lead Approvals Queue';
      case 'joinings':
        return 'Joinings, Billing & Replacement';
      case 'admin':
        return 'Admin Controls & System Logs';
      case 'rbac':
        return 'RBAC Security & Role Authorization';
      default:
        return 'NovaPulse CRM';
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200/60 flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> SUPER ADMIN
          </span>
        );
      case 'ADMIN':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200/60 flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" /> ADMIN
          </span>
        );
      case 'RECRUITMENT_MANAGER':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200/60 flex items-center gap-1">
            <UserCog className="h-3.5 w-3.5" /> MANAGER
          </span>
        );
      case 'FINANCE':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200/60 flex items-center gap-1">
            <CreditCard className="h-3.5 w-3.5" /> FINANCE
          </span>
        );
      case 'HR_RECRUITER':
      case 'HR':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200/60 flex items-center gap-1">
            <UserCheck className="h-3.5 w-3.5" /> RECRUITER ({currentUser.name})
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200/60 flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" /> ACCESS DENIED
          </span>
        );
    }
  };

  const canCreateCandidate = can(currentUser, 'candidates.create') || can(currentUser, 'leads.submit');

  return (
    <header className="sticky top-0 z-20 h-16 w-full border-b border-border bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left: Mobile Menu Toggle + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 rounded-xl border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Open Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight tracking-tight">
            {getTabTitle()}
          </h1>
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            Connected to Central Recruitment Database
          </p>
        </div>
      </div>

      {/* Right: Search, Quick Add, Role Badge */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search button (only for roles with candidate view access) */}
        {can(currentUser, 'candidates.view') && (
          <button
            onClick={onOpenSearch}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-muted-foreground text-xs font-medium transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Quick search...</span>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
              Ctrl K
            </kbd>
          </button>
        )}

        {/* Quick Add Candidate / Submit Lead Button */}
        {canCreateCandidate && (
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm shadow-primary/25 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">
              {(currentUser.role === 'HR_RECRUITER' || currentUser.role === 'HR') ? 'Submit Lead' : 'Add Candidate'}
            </span>
            <span className="sm:hidden">Add</span>
          </button>
        )}

        {/* User Role Tag */}
        <div className="hidden sm:flex items-center">
          {getRoleBadge(currentUser.role)}
        </div>
      </div>
    </header>
  );
};
