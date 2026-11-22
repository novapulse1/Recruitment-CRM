import React from 'react';
import {
  Users,
  Briefcase,
  Building2,
  Calendar,
  FileCheck2,
  Receipt,
  LayoutDashboard,
  Settings,
  Search,
  Moon,
  Sun,
  ShieldCheck,
  UserCheck,
  LogOut,
  Database
} from 'lucide-react';
import type { User } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onSwitchUser: (email: string) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onSwitchUser,
  onOpenSearch,
  onOpenSettings,
  darkMode,
  setDarkMode
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = React.useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'candidates', label: 'Candidates', icon: Users },
    { id: 'openings', label: 'Openings', icon: Briefcase },
    { id: 'clients', label: 'Clients', icon: Building2 },
    { id: 'interviews', label: 'Interviews', icon: Calendar },
    ...(currentUser.role === 'ADMIN'
      ? [
          { id: 'leads', label: 'Lead Approvals', icon: FileCheck2 },
          { id: 'joinings', label: 'Billing & Joinings', icon: Receipt },
          { id: 'admin', label: 'Admin & System', icon: Settings }
        ]
      : [])
  ];

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75 border-border">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20 font-bold text-xl tracking-wider">
              NP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-foreground tracking-tight">NovaPulse</span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  CRM
                </span>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">Recruitment & Staffing</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Global Search Button */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground text-xs font-medium transition-colors"
            title="Global Search (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search candidates...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
              Ctrl K
            </kbd>
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Toggle Theme"
          >
            {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Backend Connection status */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Database & Connection Settings"
          >
            <Database className="h-4 w-4" />
          </button>

          {/* User Profile & Role Selector */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2.5 p-1.5 sm:px-2.5 rounded-lg hover:bg-muted transition-colors border border-transparent hover:border-border"
            >
              <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase">
                {currentUser.name ? currentUser.name.slice(0, 2) : 'NP'}
              </div>
              <div className="hidden text-left sm:block">
                <div className="text-xs font-semibold leading-tight text-foreground">{currentUser.name}</div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {currentUser.role === 'ADMIN' ? (
                    <span className="text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-0.5">
                      <ShieldCheck className="h-2.5 w-2.5" /> Admin
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                      <UserCheck className="h-2.5 w-2.5" /> HR Recruiter
                    </span>
                  )}
                </div>
              </div>
            </button>

            {userDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-card shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setUserDropdownOpen(false)}
              >
                <div className="px-3 py-2 border-b border-border mb-2">
                  <div className="font-semibold text-sm text-foreground">{currentUser.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{currentUser.email}</div>
                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    Role: {currentUser.role}
                  </div>
                </div>

                <div className="text-[11px] font-semibold text-muted-foreground px-3 py-1">
                  Switch Active Account (Demo / Testing):
                </div>

                <button
                  onClick={() => onSwitchUser('novapulse739@gmail.com')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between ${
                    currentUser.email === 'novapulse739@gmail.com' ? 'bg-primary/10 font-bold text-primary' : 'hover:bg-muted'
                  }`}
                >
                  <div>
                    <div>Novapulse Admin</div>
                    <div className="text-[10px] text-muted-foreground">novapulse739@gmail.com</div>
                  </div>
                  <span className="text-[10px] font-bold text-purple-600">ADMIN</span>
                </button>

                <button
                  onClick={() => onSwitchUser('hr@novapulse.co.in')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between ${
                    currentUser.email === 'hr@novapulse.co.in' ? 'bg-primary/10 font-bold text-primary' : 'hover:bg-muted'
                  }`}
                >
                  <div>
                    <div>Anshu (HR)</div>
                    <div className="text-[10px] text-muted-foreground">hr@novapulse.co.in</div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600">HR</span>
                </button>

                <button
                  onClick={() => onSwitchUser('gjigyasa11@gmail.com')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between ${
                    currentUser.email === 'gjigyasa11@gmail.com' ? 'bg-primary/10 font-bold text-primary' : 'hover:bg-muted'
                  }`}
                >
                  <div>
                    <div>Jigyasha (HR)</div>
                    <div className="text-[10px] text-muted-foreground">gjigyasa11@gmail.com</div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600">HR</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation bar */}
      <div className="md:hidden flex items-center overflow-x-auto px-4 py-2 border-t border-border gap-1 scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
