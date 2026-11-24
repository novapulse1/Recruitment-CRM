import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Building2,
  Calendar,
  FileCheck2,
  Receipt,
  Settings,
  Search,
  Moon,
  Sun,
  ShieldCheck,
  UserCheck,
  ChevronDown,
  X,
  Database,
  BarChart3,
  Shield,
  CreditCard,
  UserCog,
  KeyRound,
  LogOut
} from 'lucide-react';
import type { User, UserRole } from '../types';
import { canAccessModule } from '../services/permissions';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onSwitchUser: (email: string) => void;
  onOpenSearch: () => void;
  onOpenChangePassword?: () => void;
  onLogout?: () => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  counts: {
    candidates?: number;
    openings?: number;
    clients?: number;
    pendingLeads?: number;
    interviewsToday?: number;
  };
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onSwitchUser,
  onOpenSearch,
  onOpenChangePassword,
  onLogout,
  darkMode,
  setDarkMode,
  counts = {},
  mobileOpen,
  setMobileOpen
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

  const allWorkspaceNavItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'candidates',
      label: 'Candidates',
      icon: Users,
      badge: counts?.candidates !== undefined ? String(counts.candidates) : null
    },
    {
      id: 'openings',
      label: 'Openings',
      icon: Briefcase,
      badge: counts?.openings !== undefined ? String(counts.openings) : null
    },
    {
      id: 'clients',
      label: 'Clients',
      icon: Building2,
      badge: counts?.clients !== undefined ? String(counts.clients) : null
    },
    {
      id: 'interviews',
      label: 'Interviews',
      icon: Calendar,
      badge: counts?.interviewsToday && counts.interviewsToday > 0 ? `${counts.interviewsToday} today` : null,
      badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
    },
    {
      id: 'reports',
      label: 'Reports Center',
      icon: BarChart3,
      badge: '5 Reports',
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
    }
  ];

  const allManagementNavItems = [
    {
      id: 'leads',
      label: 'Lead Approvals',
      icon: FileCheck2,
      badge: counts?.pendingLeads && counts.pendingLeads > 0 ? String(counts.pendingLeads) : null,
      badgeColor: 'bg-primary text-primary-foreground'
    },
    {
      id: 'joinings',
      label: 'Billing & Joinings',
      icon: Receipt,
      badge: null
    },
    {
      id: 'admin',
      label: 'Admin & System',
      icon: Settings,
      badge: null
    },
    {
      id: 'rbac',
      label: 'RBAC & Accounts',
      icon: ShieldCheck,
      badge: currentUser.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin',
      badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
    }
  ];

  // Dynamic RBAC filtering
  const visibleWorkspaceItems = allWorkspaceNavItems.filter(item => canAccessModule(currentUser, item.id));
  const visibleManagementItems = allManagementNavItems.filter(item => canAccessModule(currentUser, item.id));

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <span className="text-purple-600 dark:text-purple-400 font-bold flex items-center gap-0.5">
            <ShieldCheck className="h-2.5 w-2.5" /> Super Admin
          </span>
        );
      case 'ADMIN':
        return (
          <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-0.5">
            <Shield className="h-2.5 w-2.5" /> Admin
          </span>
        );
      case 'RECRUITMENT_MANAGER':
        return (
          <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-0.5">
            <UserCog className="h-2.5 w-2.5" /> Manager
          </span>
        );
      case 'FINANCE':
        return (
          <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5">
            <CreditCard className="h-2.5 w-2.5" /> Finance
          </span>
        );
      case 'HR_RECRUITER':
      case 'HR':
        return (
          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
            <UserCheck className="h-2.5 w-2.5" /> Recruiter
          </span>
        );
      default:
        return (
          <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-0.5">
            Denied
          </span>
        );
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-card border-r border-border select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => handleNavClick(visibleWorkspaceItems.length > 0 ? visibleWorkspaceItems[0].id : 'joinings')}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 font-bold text-lg tracking-wider transition-transform group-hover:scale-105">
            NP
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base text-foreground tracking-tight">NovaPulse</span>
              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                CRM
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">Recruitment Database</p>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Global Search Shortcut Pill (Hidden for Finance if no candidate access) */}
      {canAccessModule(currentUser, 'candidates') && (
        <div className="p-3">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-border bg-muted/30 hover:bg-muted text-muted-foreground text-xs font-medium transition-all group"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span>Search candidates...</span>
            </div>
            <kbd className="inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
              Ctrl K
            </kbd>
          </button>
        </div>
      )}

      {/* Navigation Links Area */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6 scrollbar-thin">
        {/* Main Workspace Navigation */}
        {visibleWorkspaceItems.length > 0 && (
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Workspace
            </div>
            {visibleWorkspaceItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-primary-foreground'
                          : item.badgeColor || 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Management & Administration Section */}
        {visibleManagementItems.length > 0 && (
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Operations & Admin
            </div>
            {visibleManagementItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-primary-foreground'
                          : item.badgeColor || 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Footer & Account Controls */}
      <div className="p-3 border-t border-border space-y-2 bg-muted/10">
        {/* Dark Mode & System Status Row */}
        <div className="flex items-center justify-between px-2 text-xs">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center gap-2 p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Toggle Light / Dark mode"
          >
            {darkMode ? (
              <>
                <Sun className="h-4 w-4 text-amber-400" />
                <span className="text-[11px] font-medium">Light</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-muted-foreground" />
                <span className="text-[11px] font-medium">Dark</span>
              </>
            )}
          </button>

          {canAccessModule(currentUser, 'admin') && (
            <button
              onClick={() => handleNavClick('admin')}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Database Connection Settings"
            >
              <Database className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Current User Card & Switcher */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full p-2 rounded-xl border border-border/60 bg-card hover:bg-muted/70 transition-all flex items-center justify-between text-left group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary/20 to-indigo-500/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 uppercase border border-primary/20">
                {currentUser.name ? currentUser.name.slice(0, 2) : 'NP'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground truncate">{currentUser.name}</div>
                <div className="flex items-center gap-1 text-[10px]">
                  {getRoleBadge(currentUser.role)}
                </div>
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
          </button>

          {/* Account Popover */}
          {userMenuOpen && (
            <div
              className="absolute bottom-full left-0 mb-2 w-full rounded-2xl border border-border bg-card shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-96 overflow-y-auto"
            >
              {/* User Identity Details */}
              <div className="px-3 py-2 border-b border-border/60 mb-1.5">
                <div className="font-bold text-xs text-foreground truncate">{currentUser.name}</div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">{currentUser.email}</div>
                <div className="mt-1 flex items-center gap-1">
                  {getRoleBadge(currentUser.role)}
                </div>
              </div>

              {/* Action: Change Password */}
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  if (onOpenChangePassword) onOpenChangePassword();
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center gap-2.5 hover:bg-muted text-foreground transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-medium">Change Password</span>
              </button>

              {/* Action: Sign Out */}
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  if (onLogout) onLogout();
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center gap-2.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="font-semibold">Sign Out</span>
              </button>

              {/* Dev Only: Switch Role / Persona (TEST) */}
              {isDevMode && (
                <>
                  <div className="px-3 pt-2.5 pb-1 border-t border-border/60 mt-1 mb-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Dev Persona Switcher
                    </div>
                  </div>

                  {/* 1. Super Admin */}
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSwitchUser('novapulse739@gmail.com');
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      currentUser.email === 'novapulse739@gmail.com'
                        ? 'bg-purple-50 font-bold text-purple-700 dark:bg-purple-950/50'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs">Super Admin</div>
                      <div className="text-[10px] text-muted-foreground font-mono">novapulse739@gmail.com</div>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                      SUPER
                    </span>
                  </button>

                  {/* 2. Admin */}
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSwitchUser('admin@novapulse.co.in');
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      currentUser.email === 'admin@novapulse.co.in'
                        ? 'bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950/50'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs">Admin</div>
                      <div className="text-[10px] text-muted-foreground font-mono">admin@novapulse.co.in</div>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                      ADMIN
                    </span>
                  </button>

                  {/* 3. Recruitment Manager */}
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSwitchUser('manager@novapulse.co.in');
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      currentUser.email === 'manager@novapulse.co.in'
                        ? 'bg-blue-50 font-bold text-blue-700 dark:bg-blue-950/50'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs">Manager</div>
                      <div className="text-[10px] text-muted-foreground font-mono">manager@novapulse.co.in</div>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                      MANAGER
                    </span>
                  </button>

                  {/* 4. HR Recruiter - Anshu */}
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSwitchUser('hr@novapulse.co.in');
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      currentUser.email === 'hr@novapulse.co.in'
                        ? 'bg-emerald-50 font-bold text-emerald-700 dark:bg-emerald-950/50'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs">Anshu (Recruiter)</div>
                      <div className="text-[10px] text-muted-foreground font-mono">hr@novapulse.co.in</div>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                      HR
                    </span>
                  </button>

                  {/* 5. HR Recruiter - Jigyasha */}
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSwitchUser('gjigyasa11@gmail.com');
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      currentUser.email === 'gjigyasa11@gmail.com'
                        ? 'bg-emerald-50 font-bold text-emerald-700 dark:bg-emerald-950/50'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs">Jigyasha (Recruiter)</div>
                      <div className="text-[10px] text-muted-foreground font-mono">gjigyasa11@gmail.com</div>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                      HR
                    </span>
                  </button>

                  {/* 6. Finance */}
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSwitchUser('finance@novapulse.co.in');
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      currentUser.email === 'finance@novapulse.co.in'
                        ? 'bg-amber-50 font-bold text-amber-700 dark:bg-amber-950/50'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs">Finance Officer</div>
                      <div className="text-[10px] text-muted-foreground font-mono">finance@novapulse.co.in</div>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                      FINANCE
                    </span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Left Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col h-screen sticky top-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
