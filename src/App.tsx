import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { CandidatesView } from './components/CandidatesView';
import { CandidateDrawer } from './components/CandidateDrawer';
import { AddCandidateModal } from './components/AddCandidateModal';
import { OpeningsView } from './components/OpeningsView';
import { ClientsView } from './components/ClientsView';
import { InterviewsView } from './components/InterviewsView';
import { ReportsView } from './components/ReportsView';
import { LeadApprovalsView } from './components/LeadApprovalsView';
import { JoiningsBillingView } from './components/JoiningsBillingView';
import { AdminSettingsView } from './components/AdminSettingsView';
import { RBACManagementView } from './components/RBACManagementView';
import { AccessDenied } from './components/AccessDenied';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { LoginPage } from './components/LoginPage';
import { ForceChangePasswordView } from './components/ForceChangePasswordView';
import { InactivityWarningModal } from './components/InactivityWarningModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { FirebaseConfigMissing } from './components/FirebaseConfigMissing';
import { ErrorBoundary } from './components/ErrorBoundary';
import { isFirebaseConfigured } from './services/firebase';
import { api } from './services/api';
import { can, canAccessModule } from './services/permissions';
import type {
  Candidate,
  Opening,
  Client,
  InterviewItem,
  LeadItem,
  JoiningRecord,
  HRRecord,
  DropdownOption,
  DashboardMetrics,
  User
} from './types';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(api.getCurrentUser());
  const [activeTab, setActiveTab] = useState<string>(() => {
    const user = api.getCurrentUser();
    return user.role === 'FINANCE' ? 'joinings' : 'dashboard';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('novapulse_theme') === 'dark' ||
      (!localStorage.getItem('novapulse_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // Data states
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [joinings, setJoinings] = useState<JoiningRecord[]>([]);
  const [hrs, setHrs] = useState<HRRecord[]>([]);
  const [dropdowns, setDropdowns] = useState<Record<string, DropdownOption[]>>({});
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals & Drawers
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [lineUpInitialData, setLineUpInitialData] = useState<Partial<Candidate> | undefined>(undefined);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = api.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Apply dark mode class to html
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('novapulse_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('novapulse_theme', 'light');
    }
  }, [darkMode]);

  // Keyboard shortcut Ctrl+K / Cmd+K for global search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (can(currentUser, 'candidates.view')) {
          setIsSearchModalOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser]);

  // Initial load
  useEffect(() => {
    loadAllData();
  }, [currentUser]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [
        bootstrapRes,
        candidatesRes,
        openingsRes,
        clientsRes,
        interviewsRes,
        leadsRes,
        joiningsRes,
        dashboardRes,
        hrsRes
      ] = await Promise.all([
        api.getBootstrap(),
        can(currentUser, 'candidates.view') ? api.getCandidates() : Promise.resolve({ candidates: [] }),
        can(currentUser, 'openings.view') ? api.getOpenings() : Promise.resolve({ openings: [] }),
        can(currentUser, 'clients.view') ? api.getClients() : Promise.resolve({ clients: [] }),
        can(currentUser, 'interviews.view') ? api.getInterviews() : Promise.resolve({ interviews: [] }),
        can(currentUser, 'leads.view') ? api.getLeads() : Promise.resolve({ leads: [] }),
        can(currentUser, 'joinings.view') ? api.getJoinings() : Promise.resolve({ joinings: [] }),
        currentUser.role !== 'FINANCE' ? api.getDashboard() : Promise.resolve(null),
        can(currentUser, 'hr_registry.manage') ? api.getHRs() : Promise.resolve({ hrs: [] })
      ]);

      if (bootstrapRes.dropdowns) setDropdowns(bootstrapRes.dropdowns);
      setCandidates(candidatesRes.candidates || []);
      setOpenings(openingsRes.openings || []);
      setClients(clientsRes.clients || []);
      setInterviews(interviewsRes.interviews || []);
      setLeads(leadsRes.leads || []);
      setJoinings(joiningsRes.joinings || []);
      setDashboardMetrics(dashboardRes);
      setHrs(hrsRes.hrs || []);
    } catch (e: any) {
      console.error('Failed to load CRM data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchUser = async (email: string) => {
    try {
      const user = await api.loginWithEmail(email);
      setCurrentUser(user);
      // Auto-switch to permitted tab
      if (user.role === 'FINANCE') {
        setActiveTab('joinings');
      } else if (!canAccessModule(user, activeTab)) {
        setActiveTab('dashboard');
      }
    } catch (err: any) {
      alert('Login error: ' + err.message);
    }
  };

  const handleLineUpCandidate = (op: Opening) => {
    setLineUpInitialData({
      'Client Name': op['Client Name'],
      'Designation Applied': op['Position / Role'],
      'Current Location': op['Job Location (City)']
    });
    setIsAddModalOpen(true);
  };

  const handleCandidateUpdated = (updated: Candidate) => {
    setCandidates((prev) =>
      prev.map((c) => (c['Candidate ID'] === updated['Candidate ID'] ? updated : c))
    );
    // Reload background analytics
    if (currentUser.role !== 'FINANCE') {
      api.getDashboard().then(setDashboardMetrics).catch(console.error);
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'FINANCE') {
      setActiveTab('joinings');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handlePasswordChanged = (updatedUser: User) => {
    setCurrentUser(updatedUser);
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(api.getCurrentUser());
  };

  // Configuration Guard: Firebase credentials missing -> render FirebaseConfigMissing
  if (!isFirebaseConfigured()) {
    return <FirebaseConfigMissing />;
  }

  // Auth Guard: Unauthenticated user -> render LoginPage
  if (!currentUser.authenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Auth Guard: Temporary password must be changed first
  if (currentUser.must_change_password) {
    return (
      <ForceChangePasswordView
        user={currentUser}
        onPasswordChanged={handlePasswordChanged}
      />
    );
  }

  const isCurrentTabAllowed = canAccessModule(currentUser, activeTab);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans transition-colors duration-150">
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        onLogout={handleLogout}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        counts={{
          candidates: candidates.length,
          openings: openings.filter((o) => o.Status === 'Open').length,
          clients: clients.length,
          pendingLeads: leads.filter((l) => (l.Status || 'Pending') === 'Pending').length,
          interviewsToday: interviews.filter((i) => i.timeBucket === 'Today' || i.timeBucket === 'Overdue').length
        }}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          currentUser={currentUser}
          onOpenMobileSidebar={() => setMobileOpen(true)}
          onOpenSearch={() => setIsSearchModalOpen(true)}
          onOpenAddModal={() => {
            setLineUpInitialData(undefined);
            setIsAddModalOpen(true);
          }}
          onRefresh={loadAllData}
        />

        {/* View Content Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scrollbar-thin">
          <div className="max-w-7xl mx-auto w-full">
            {!isCurrentTabAllowed ? (
              <AccessDenied
                user={currentUser}
                moduleName={activeTab.toUpperCase()}
                onGoToAllowed={() => setActiveTab(currentUser.role === 'FINANCE' ? 'joinings' : 'dashboard')}
                onSwitchPersona={handleSwitchUser}
              />
            ) : (
              <ErrorBoundary
                key={activeTab}
                resetKey={activeTab}
                pageName={activeTab.toUpperCase()}
                fallbackTitle={`Error Loading ${activeTab.toUpperCase()}`}
              >
                {activeTab === 'dashboard' && (
                  <DashboardView
                    metrics={dashboardMetrics}
                    currentUser={currentUser}
                    candidates={candidates}
                    interviews={interviews}
                    joinings={joinings}
                    clients={clients}
                    onRefresh={loadAllData}
                    onSelectCandidate={(id) => setSelectedCandidateId(id)}
                  />
                )}

                {activeTab === 'candidates' && (
                  <CandidatesView
                    candidates={candidates}
                    currentUser={currentUser}
                    dropdowns={dropdowns}
                    clients={clients}
                    openings={openings}
                    onSelectCandidate={(id) => setSelectedCandidateId(id)}
                    onOpenAddModal={() => {
                      setLineUpInitialData(undefined);
                      setIsAddModalOpen(true);
                    }}
                    onRefresh={loadAllData}
                    onCandidateUpdated={handleCandidateUpdated}
                  />
                )}

                {activeTab === 'openings' && (
                  <OpeningsView
                    openings={openings}
                    currentUser={currentUser}
                    onLineUpCandidate={handleLineUpCandidate}
                    onRefresh={loadAllData}
                  />
                )}

                {activeTab === 'clients' && (
                  <ClientsView
                    clients={clients}
                    currentUser={currentUser}
                    onRefresh={loadAllData}
                  />
                )}

                {activeTab === 'interviews' && (
                  <InterviewsView
                    interviews={interviews}
                    currentUser={currentUser}
                    onSelectCandidate={(id) => setSelectedCandidateId(id)}
                    onRefresh={loadAllData}
                  />
                )}

                {activeTab === 'reports' && (
                  <ReportsView
                    candidates={candidates}
                    clients={clients}
                    joinings={joinings}
                    interviews={interviews}
                    hrs={hrs}
                    currentUser={currentUser}
                  />
                )}

                {activeTab === 'leads' && (
                  <LeadApprovalsView
                    leads={leads}
                    hrs={hrs}
                    currentUser={currentUser}
                    onRefresh={loadAllData}
                  />
                )}

                {activeTab === 'joinings' && (
                  <JoiningsBillingView
                    joinings={joinings}
                    currentUser={currentUser}
                    onSelectCandidate={(id) => setSelectedCandidateId(id)}
                    onRefresh={loadAllData}
                  />
                )}

                {activeTab === 'admin' && (
                  <AdminSettingsView
                    currentUser={currentUser}
                    onRefresh={loadAllData}
                  />
                )}

                {activeTab === 'rbac' && (
                  <RBACManagementView
                    currentUser={currentUser}
                  />
                )}
              </ErrorBoundary>
            )}
          </div>
        </main>
      </div>

      {/* Candidate Profile Drawer */}
      <CandidateDrawer
        candidateId={selectedCandidateId}
        onClose={() => setSelectedCandidateId(null)}
        currentUser={currentUser}
        dropdowns={dropdowns}
        clients={clients}
        openings={openings}
        onCandidateUpdated={handleCandidateUpdated}
      />

      {/* Add Candidate Modal */}
      <AddCandidateModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        currentUser={currentUser}
        candidates={candidates}
        dropdowns={dropdowns}
        clients={clients}
        openings={openings}
        initialData={lineUpInitialData}
        onCandidateAdded={loadAllData}
      />

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        candidates={candidates}
        onSelectCandidate={(id) => setSelectedCandidateId(id)}
      />

      {/* 30-Minute Inactivity Warning & Auto-Logout Modal */}
      <InactivityWarningModal onLogout={handleLogout} />

      {/* Self-Service Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        onSuccess={() => setCurrentUser(api.getCurrentUser())}
      />
    </div>
  );
};

export default App;
