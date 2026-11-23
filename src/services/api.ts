/**
 * NovaPulse Hiring CRM - API Client
 * Connects frontend to the Google Apps Script Web App backend.
 * Provides fallback mock/live storage initialized from the actual Google Sheet
 * to enable instant local testing and offline resilience.
 */

import { APP_CONFIG } from '../config';
import { PERMISSIONS, ROLE_PERMISSIONS, can } from './permissions';
import type {
  Candidate,
  Client,
  Opening,
  JoiningRecord,
  InterviewItem,
  LeadItem,
  HRRecord,
  AuditLogEntry,
  DuplicateLogEntry,
  DropdownOption,
  DashboardMetrics,
  User,
  UserRole,
  RBACOverview,
  RBACUser
} from '../types';

class ApiClient {
  private baseUrl: string = '';
  private currentUser: User = {
    authenticated: true,
    email: 'novapulse739@gmail.com',
    name: 'Super Administrator',
    role: 'SUPER_ADMIN',
    permissions: ROLE_PERMISSIONS.SUPER_ADMIN,
    canEditAll: true
  };

  constructor() {
    this.baseUrl = localStorage.getItem('novapulse_api_url') || APP_CONFIG.DEFAULT_API_URL || '';
    const savedUser = localStorage.getItem('novapulse_current_user');
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
      } catch (e) {
        // use default admin
      }
    }
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.trim();
    localStorage.setItem('novapulse_api_url', this.baseUrl);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getCurrentUser(): User {
    return this.currentUser;
  }

  setCurrentUser(user: User) {
    this.currentUser = user;
    localStorage.setItem('novapulse_current_user', JSON.stringify(user));
  }

  async loginWithEmail(email: string): Promise<User> {
    if (this.baseUrl) {
      const resp = await this.get<{ user: User }>('auth', { userEmail: email });
      if (resp.user && resp.user.authenticated) {
        this.setCurrentUser(resp.user);
        return resp.user;
      }
      throw new Error(resp.user?.error || 'Access denied');
    }

    // Local authentication resolution matching server rules
    const cleanEmail = email.trim().toLowerCase();

    // 1. Super Admin
    if (cleanEmail === 'novapulse739@gmail.com' || cleanEmail === 'superadmin@novapulse.co.in') {
      const superAdminUser: User = {
        authenticated: true,
        email: cleanEmail,
        name: 'Super Administrator',
        role: 'SUPER_ADMIN',
        permissions: ROLE_PERMISSIONS.SUPER_ADMIN,
        canEditAll: true
      };
      this.setCurrentUser(superAdminUser);
      return superAdminUser;
    }

    // 2. Admin
    if (cleanEmail === 'admin@novapulse.co.in') {
      const adminUser: User = {
        authenticated: true,
        email: cleanEmail,
        name: 'Management Admin',
        role: 'ADMIN',
        permissions: ROLE_PERMISSIONS.ADMIN,
        canEditAll: true
      };
      this.setCurrentUser(adminUser);
      return adminUser;
    }

    // 3. Recruitment Manager
    if (cleanEmail === 'manager@novapulse.co.in') {
      const managerUser: User = {
        authenticated: true,
        email: cleanEmail,
        name: 'Recruitment Manager',
        role: 'RECRUITMENT_MANAGER',
        permissions: ROLE_PERMISSIONS.RECRUITMENT_MANAGER,
        teamRecruiterEmails: ['hr@novapulse.co.in', 'gjigyasa11@gmail.com'],
        canEditAll: false,
        editableFields: [
          'Designation Applied', 'Current Location', 'Experience', 'Current Salary', 'Expected Salary',
          'Notice Period', 'Source', 'Client Name', 'Industry', 'Calling Disposition',
          'Sub-Disposition', 'Call Status', 'Connect Status', 'Interview Status', 'Interview Date',
          'Selection Status', 'Joining Status', 'Joining Date', 'Remarks'
        ]
      };
      this.setCurrentUser(managerUser);
      return managerUser;
    }

    // 4. Finance
    if (cleanEmail === 'finance@novapulse.co.in' || cleanEmail === 'accounts@novapulse.co.in') {
      const financeUser: User = {
        authenticated: true,
        email: cleanEmail,
        name: 'Finance Executive',
        role: 'FINANCE',
        permissions: ROLE_PERMISSIONS.FINANCE,
        canEditAll: false,
        editableFields: []
      };
      this.setCurrentUser(financeUser);
      return financeUser;
    }

    // 5. HR Recruiter (Anshu)
    if (cleanEmail === 'hr@novapulse.co.in') {
      const hrUser: User = {
        authenticated: true,
        email: cleanEmail,
        name: 'Anshu',
        role: 'HR_RECRUITER',
        permissions: ROLE_PERMISSIONS.HR_RECRUITER,
        hrId: 'NP-HR-001',
        canEditAll: false,
        assignedCandidateCount: '75',
        editableFields: [
          'Designation Applied', 'Current Location', 'Experience', 'Current Salary', 'Expected Salary',
          'Notice Period', 'Source', 'Client Name', 'Industry', 'Calling Disposition',
          'Sub-Disposition', 'Call Status', 'Connect Status', 'Interview Status', 'Interview Date',
          'Selection Status', 'Joining Status', 'Joining Date', 'Remarks'
        ]
      };
      this.setCurrentUser(hrUser);
      return hrUser;
    }

    // 6. HR Recruiter (Jigyasha)
    if (cleanEmail === 'gjigyasa11@gmail.com') {
      const hrUser: User = {
        authenticated: true,
        email: cleanEmail,
        name: 'Jigyasha',
        role: 'HR_RECRUITER',
        permissions: ROLE_PERMISSIONS.HR_RECRUITER,
        hrId: 'NP-HR-002',
        canEditAll: false,
        assignedCandidateCount: '437',
        editableFields: [
          'Designation Applied', 'Current Location', 'Experience', 'Current Salary', 'Expected Salary',
          'Notice Period', 'Source', 'Client Name', 'Industry', 'Calling Disposition',
          'Sub-Disposition', 'Call Status', 'Connect Status', 'Interview Status', 'Interview Date',
          'Selection Status', 'Joining Status', 'Joining Date', 'Remarks'
        ]
      };
      this.setCurrentUser(hrUser);
      return hrUser;
    }

    // 7. Inactive Recruiter
    if (cleanEmail === 'inactive.hr@novapulse.co.in') {
      throw new Error('Account Inactive: Your recruiter account has been disabled. Please contact Management.');
    }

    throw new Error('Access denied: Email is not registered in NovaPulse CRM.');
  }

  logout() {
    this.currentUser = {
      authenticated: false,
      email: '',
      name: '',
      role: 'DENIED',
      permissions: []
    };
    localStorage.removeItem('novapulse_current_user');
    // Clear cached CRM data so it isn't left on shared computers
    Object.keys(localStorage)
      .filter((k) => k.startsWith('novapulse_data_cache_'))
      .forEach((k) => localStorage.removeItem(k));
  }

  // Network Request Helpers
  private async get<T>(action: string, params: Record<string, any> = {}): Promise<T> {
    if (!this.baseUrl) {
      return this.localGet<T>(action, params);
    }

    const query = new URLSearchParams({
      action,
      userEmail: this.currentUser.email,
      ...params
    }).toString();

    const response = await fetch(`${this.baseUrl}?${query}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    const json = await response.json();
    if (!json.success) {
      const err = new Error(json.error || 'Server request failed');
      (err as any).statusCode = json.statusCode;
      throw err;
    }
    return json.data as T;
  }

  private async post<T>(action: string, body: Record<string, any> = {}): Promise<T> {
    if (!this.baseUrl) {
      return this.localPost<T>(action, body);
    }

    const payload = {
      action,
      userEmail: this.currentUser.email,
      ...body
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Avoid CORS preflight on Apps Script
      body: JSON.stringify(payload)
    });

    const json = await response.json();
    if (!json.success) {
      const err = new Error(json.error || 'Server operation failed');
      (err as any).statusCode = json.statusCode;
      throw err;
    }
    return json.data as T;
  }

  // High-Level API Methods

  /**
   * PERF: Loads everything the app needs on startup in a single request.
   * Pass force=true to skip the server cache (manual refresh).
   */
  async getAll(force: boolean = false) {
    return this.get<{
      bootstrap: { user: User; dropdowns: Record<string, DropdownOption[]>; config: Record<string, string> };
      candidates: Candidate[];
      openings: Opening[];
      clients: Client[];
      interviews: InterviewItem[];
      leads: LeadItem[];
      joinings: JoiningRecord[];
      dashboard: DashboardMetrics | null;
      hrs: HRRecord[];
      errors?: Record<string, string>;
    }>('getAll', force ? { nocache: '1' } : {});
  }

  async getBootstrap() {
    return this.get<{ user: User; dropdowns: Record<string, DropdownOption[]>; config: Record<string, string> }>('getBootstrap');
  }

  async getCandidates(filters: Record<string, any> = {}) {
    return this.get<{ candidates: Candidate[] }>('getCandidates', filters);
  }

  async getCandidate(candidateId: string) {
    return this.get<{
      candidate: Candidate;
      audits: AuditLogEntry[];
      interviews: any[];
      reschedule?: any;
      joining?: any;
    }>('getCandidate', { candidateId });
  }

  async createCandidate(candidateData: Partial<Candidate>, allowDuplicateOverride: boolean = false) {
    return this.post<{
      success: boolean;
      candidateId?: string;
      leadId?: string;
      isDuplicate?: boolean;
      matches?: any[];
      candidate?: Candidate;
      message?: string;
    }>('createCandidate', { candidateData, allowDuplicateOverride });
  }

  async updateCandidate(candidateId: string, patch: Partial<Candidate>, recordVersion: string | number) {
    return this.post<{
      success: boolean;
      candidateId: string;
      newVersion: number;
      updatedCandidate: Candidate;
    }>('updateCandidate', { candidateId, patch, recordVersion });
  }

  async bulkCandidateAction(actionType: 'REASSIGN_HR' | 'CHANGE_CLIENT' | 'ARCHIVE', candidateIds: string[], payload: any = {}) {
    return this.post<{ success: boolean; results: any[] }>('bulkCandidateAction', { actionType, candidateIds, payload });
  }

  async getOpenings(filters: Record<string, any> = {}) {
    return this.get<{ openings: Opening[] }>('getOpenings', filters);
  }

  async saveOpening(openingData: Partial<Opening>) {
    return this.post<{ success: boolean; openingId: string; opening: Opening }>('saveOpening', { openingData });
  }

  async getClients() {
    return this.get<{ clients: Client[] }>('getClients');
  }

  async saveClient(clientData: Partial<Client>) {
    return this.post<{ success: boolean; clientId: string; client: Client }>('saveClient', { clientData });
  }

  async getInterviews(filters: Record<string, any> = {}) {
    return this.get<{ interviews: InterviewItem[] }>('getInterviews', filters);
  }

  async getJoinings() {
    return this.get<{ joinings: JoiningRecord[] }>('getJoinings');
  }

  async updateBilling(candidateId: string, patch: Record<string, any>) {
    return this.post<{ success: boolean }>('updateBilling', { candidateId, patch });
  }

  async getLeads(status?: string) {
    return this.get<{ leads: LeadItem[] }>('getLeads', { status });
  }

  async approveLead(leadId: string, assignToHR?: { name: string; email: string }, adminNote?: string) {
    return this.post<{ success: boolean; candidateId: string }>('approveLead', { leadId, assignToHR, adminNote });
  }

  async rejectLead(leadId: string, adminNote?: string) {
    return this.post<{ success: boolean }>('rejectLead', { leadId, adminNote });
  }

  async mergeLead(leadId: string, targetCandidateId: string, adminNote?: string) {
    return this.post<{ success: boolean }>('mergeLead', { leadId, targetCandidateId, adminNote });
  }

  async getDashboard(month?: string) {
    return this.get<DashboardMetrics>('getDashboard', { month });
  }

  async getHRs() {
    return this.get<{ hrs: HRRecord[] }>('getHRs');
  }

  async addHR(hrData: { hrName: string; hrEmail: string }) {
    return this.post<{ success: boolean; hr: HRRecord }>('addHR', { hrData });
  }

  async toggleHRStatus(hrId: string, status: 'Active' | 'Inactive') {
    return this.post<{ success: boolean; hrId: string; status: string }>('toggleHRStatus', { hrId, status });
  }

  async getDropdowns() {
    return this.get<{ all: DropdownOption[]; grouped: Record<string, DropdownOption[]> }>('getDropdowns');
  }

  async addDropdownOption(list: string, option: string, parentDisposition?: string, callStatus?: string) {
    return this.post<{ success: boolean; option: DropdownOption }>('addDropdownOption', { list, option, parentDisposition, callStatus });
  }

  async toggleDropdownOption(list: string, option: string, active: boolean) {
    return this.post<{ success: boolean }>('toggleDropdownOption', { list, option, active });
  }

  async getLogs(logType: string, limit: number = 100) {
    return this.get<{ logs: any[] }>('getLogs', { logType, limit });
  }

  async reviewDuplicate(timestamp: string, candidateId: string, decision: string, notes?: string) {
    return this.post<{ success: boolean }>('reviewDuplicate', { timestamp, candidateId, decision, notes });
  }

  async getRBAC() {
    return this.get<RBACOverview>('getRBAC');
  }

  async updateUserRole(targetEmail: string, newRole: UserRole) {
    return this.post<{ success: boolean; email: string; newRole: string }>('updateUserRole', { targetEmail, newRole });
  }

  async updateTeamMapping(managerEmail: string, teamRecruiterEmails: string[]) {
    return this.post<{ success: boolean; managerEmail: string; teamRecruiterEmails: string[] }>('updateTeamMapping', { managerEmail, teamRecruiterEmails });
  }

  // Local Sheet Store Implementation (used for zero-friction local execution)
  private localGet<T>(action: string, params: Record<string, any>): T {
    const store = getLocalStore();
    const user = this.currentUser;

    if (action === 'getBootstrap') {
      return {
        user,
        dropdowns: store.dropdowns,
        config: store.config
      } as unknown as T;
    }

    if (action === 'getCandidates') {
      if (user.role === 'FINANCE') {
        return { candidates: [] } as unknown as T;
      }

      let candidates = [...store.candidates];
      if (user.role === 'HR_RECRUITER' || user.role === 'HR') {
        candidates = candidates.filter(c => c['HR Email']?.toLowerCase() === user.email.toLowerCase());
      } else if (user.role === 'RECRUITMENT_MANAGER') {
        const team = user.teamRecruiterEmails || ['hr@novapulse.co.in', 'gjigyasa11@gmail.com'];
        candidates = candidates.filter(c => {
          const cEmail = (c['HR Email'] || '').toLowerCase();
          return team.includes(cEmail) || cEmail === user.email.toLowerCase();
        });
      }

      if (params.search) {
        const q = String(params.search).toLowerCase();
        candidates = candidates.filter(c =>
          c['Candidate ID']?.toLowerCase().includes(q) ||
          c['Candidate Name']?.toLowerCase().includes(q) ||
          c['Mobile Number']?.includes(q) ||
          c['Email ID']?.toLowerCase().includes(q) ||
          c['Client Name']?.toLowerCase().includes(q) ||
          c['Designation Applied']?.toLowerCase().includes(q)
        );
      }
      if (params.clientName) candidates = candidates.filter(c => c['Client Name'] === params.clientName);
      if (params.callingDisposition) candidates = candidates.filter(c => c['Calling Disposition'] === params.callingDisposition);
      if (params.pipelineStage) candidates = candidates.filter(c => c['Pipeline Stage'] === params.pipelineStage);
      if (params.interviewStatus) candidates = candidates.filter(c => c['Interview Status'] === params.interviewStatus);
      if (params.selectionStatus) candidates = candidates.filter(c => c['Selection Status'] === params.selectionStatus);
      if (params.joiningStatus) candidates = candidates.filter(c => c['Joining Status'] === params.joiningStatus);
      return { candidates } as unknown as T;
    }

    if (action === 'getCandidate') {
      const cand = store.candidates.find(c => c['Candidate ID'] === params.candidateId);
      if (!cand) throw new Error('Candidate not found');
      const audits = store.audits.filter(a => a['Candidate ID'] === params.candidateId);
      const interviews = store.interviews.filter(i => i['Candidate ID'] === params.candidateId);
      const reschedule = store.reschedules.find(r => r['Candidate ID'] === params.candidateId);
      const joining = store.joinings.find(j => j.candidateId === params.candidateId);
      return { candidate: cand, audits, interviews, reschedule, joining } as unknown as T;
    }

    if (action === 'getOpenings') {
      return { openings: store.openings } as unknown as T;
    }

    if (action === 'getClients') {
      return { clients: store.clients } as unknown as T;
    }

    if (action === 'getInterviews') {
      if (user.role === 'FINANCE') {
        return { interviews: [] } as unknown as T;
      }
      let candidates = store.candidates.filter(c => c['Interview Date'] && c['Interview Date'] !== '-');
      if (user.role === 'HR_RECRUITER' || user.role === 'HR') {
        candidates = candidates.filter(c => c['HR Email']?.toLowerCase() === user.email.toLowerCase());
      } else if (user.role === 'RECRUITMENT_MANAGER') {
        const team = user.teamRecruiterEmails || ['hr@novapulse.co.in', 'gjigyasa11@gmail.com'];
        candidates = candidates.filter(c => {
          const cEmail = (c['HR Email'] || '').toLowerCase();
          return team.includes(cEmail) || cEmail === user.email.toLowerCase();
        });
      }
      const interviews: InterviewItem[] = candidates.map(c => {
        const iDate = new Date(c['Interview Date']);
        const today = new Date();
        today.setHours(0,0,0,0);
        iDate.setHours(0,0,0,0);
        const diff = Math.round((iDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        let timeBucket: InterviewItem['timeBucket'] = 'Upcoming';
        if (diff < 0) timeBucket = c['Interview Status'] === 'Pending' ? 'Overdue' : 'Past';
        else if (diff === 0) timeBucket = 'Today';
        else if (diff === 1) timeBucket = 'Tomorrow';
        else if (diff <= 7) timeBucket = 'This Week';

        const resched = store.reschedules.find(r => r['Candidate ID'] === c['Candidate ID']);

        return {
          candidateId: c['Candidate ID'],
          candidateName: c['Candidate Name'],
          mobile: c['Mobile Number'],
          designation: c['Designation Applied'],
          clientName: c['Client Name'],
          assignedHR: c['Assigned HR'],
          hrEmail: c['HR Email'],
          interviewDate: c['Interview Date'],
          interviewStatus: c['Interview Status'],
          timeBucket,
          rescheduleCount: resched ? parseInt(resched['Reschedule Count'], 10) : 1,
          rescheduleFlag: resched?.Flag || '',
          remarks: c['Remarks']
        };
      });
      return { interviews } as unknown as T;
    }

    if (action === 'getJoinings') {
      return { joinings: store.joinings } as unknown as T;
    }

    if (action === 'getLeads') {
      let leads = [...store.leads];
      if (user.role === 'HR_RECRUITER' || user.role === 'HR') {
        const uName = (user.name || '').toLowerCase();
        const uEmail = (user.email || '').toLowerCase();
        leads = leads.filter(l => {
          const sub = (l['Submitted By HR'] || '').toLowerCase();
          return sub === uName || sub === uEmail;
        });
      }
      return { leads } as unknown as T;
    }

    if (action === 'getRBAC') {
      const teamMapping = store.teamMapping || {
        'manager@novapulse.co.in': ['hr@novapulse.co.in', 'gjigyasa11@gmail.com']
      };

      const users: RBACUser[] = [
        { email: 'novapulse739@gmail.com', name: 'Super Administrator', role: 'SUPER_ADMIN', status: 'Active' },
        { email: 'admin@novapulse.co.in', name: 'Management Admin', role: 'ADMIN', status: 'Active' },
        { email: 'manager@novapulse.co.in', name: 'Recruitment Manager', role: 'RECRUITMENT_MANAGER', status: 'Active', teamRecruiterEmails: teamMapping['manager@novapulse.co.in'] || [] },
        { email: 'hr@novapulse.co.in', name: 'Anshu', role: 'HR_RECRUITER', status: 'Active' },
        { email: 'gjigyasa11@gmail.com', name: 'Jigyasha', role: 'HR_RECRUITER', status: 'Active' },
        { email: 'finance@novapulse.co.in', name: 'Finance Executive', role: 'FINANCE', status: 'Active' },
        { email: 'inactive.hr@novapulse.co.in', name: 'Deactivated HR', role: 'DENIED', status: 'Inactive' }
      ];

      return {
        users,
        rolePermissions: ROLE_PERMISSIONS,
        allPermissions: PERMISSIONS,
        teamMapping,
        rbacEnabled: true
      } as unknown as T;
    }

    if (action === 'getDashboard') {
      return computeLocalDashboard(store, user) as unknown as T;
    }

    if (action === 'getHRs') {
      return { hrs: store.hrs } as unknown as T;
    }

    if (action === 'getDropdowns') {
      return { all: store.allDropdowns, grouped: store.dropdowns } as unknown as T;
    }

    if (action === 'getLogs') {
      if (params.logType === 'AUDIT_LOG') return { logs: store.audits } as unknown as T;
      if (params.logType === 'DUPLICATE_LOG') return { logs: store.duplicates } as unknown as T;
      return { logs: [] } as unknown as T;
    }

    return {} as T;
  }

  private localPost<T>(action: string, body: Record<string, any>): T {
    const store = getLocalStore();
    const user = this.currentUser;

    if (action === 'createCandidate') {
      const data = body.candidateData || body;
      // Duplicate check
      const cleanPhone = String(data['Mobile Number'] || '').replace(/\D/g, '').slice(-10);
      const cleanEmail = String(data['Email ID'] || '').trim().toLowerCase();
      const match = store.candidates.find(c => {
        const cPhone = String(c['Mobile Number'] || '').replace(/\D/g, '').slice(-10);
        const cEmail = String(c['Email ID'] || '').trim().toLowerCase();
        return (cleanPhone && cleanPhone === cPhone) || (cleanEmail && cleanEmail !== '-' && cleanEmail === cEmail);
      });

      if (match && !body.allowDuplicateOverride) {
        return {
          success: false,
          isDuplicate: true,
          matches: [{
            matchedCandidateId: match['Candidate ID'],
            matchedCandidateName: match['Candidate Name'],
            matchedHR: match['Assigned HR'],
            matchType: 'Phone/Email Match'
          }],
          message: 'Duplicate candidate detected on phone or email.'
        } as unknown as T;
      }

      if (match && body.allowDuplicateOverride && !can(user, PERMISSIONS.DUPLICATES_OVERRIDE)) {
        throw new Error('Forbidden: Only Super Admin is authorized to override duplicate candidate restrictions.');
      }

      if (user.role === 'HR_RECRUITER' || user.role === 'HR') {
        const leadId = `NP-LEAD-${String(store.leads.length + 1).padStart(6, '0')}`;
        const newLead: LeadItem = {
          'Lead ID': leadId,
          'Received': new Date().toLocaleDateString('en-GB'),
          'Submitted By HR': user.name,
          'Request Type': 'New Candidate',
          'Candidate Name': data['Candidate Name'] || '',
          'Mobile Number': data['Mobile Number'] || '',
          'Alternate Mobile': data['Alternate Mobile'] || '',
          'Email ID': data['Email ID'] || '',
          'Designation': data['Designation Applied'] || '',
          'Location': data['Current Location'] || '',
          'Experience': data['Experience'] || '',
          'Current Salary': data['Current Salary'] || '',
          'Expected Salary': data['Expected Salary'] || '',
          'Notice Period': data['Notice Period'] || '',
          'Source': data['Source'] || '',
          'Client Name': data['Client Name'] || '',
          'Remarks': data['Remarks'] || '',
          'Duplicate Of': match ? match['Candidate ID'] : '',
          'Duplicate With HR': match ? match['Assigned HR'] : '',
          'Status': 'Pending',
          'Decision': 'Pending',
          'Admin Note': '',
          'Processed By': '',
          'Processed At': '',
          'Candidate ID': '',
          'Industry': data['Industry'] || '',
          'Assign To HR': user.name
        };
        store.leads.unshift(newLead);
        saveLocalStore(store);
        return { success: true, leadId, status: 'Pending', message: 'Lead submitted for admin approval' } as unknown as T;
      }

      const nextNum = store.candidates.length + 1;
      const candidateId = `NP-CAN-${String(nextNum).padStart(6, '0')}`;
      const newCandidate: Candidate = {
        'Candidate ID': candidateId,
        'Entry Date': new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        'Candidate Name': data['Candidate Name'] || '',
        'Mobile Number': data['Mobile Number'] || '',
        'Alternate Mobile': data['Alternate Mobile'] || '',
        'Email ID': data['Email ID'] || '',
        'Designation Applied': data['Designation Applied'] || '',
        'Current Location': data['Current Location'] || '',
        'Experience': data['Experience'] || '',
        'Current Salary': data['Current Salary'] || '',
        'Expected Salary': data['Expected Salary'] || '',
        'Notice Period': data['Notice Period'] || '',
        'Source': data['Source'] || '',
        'Client Name': data['Client Name'] || '',
        'Assigned HR': data['Assigned HR'] || user.name,
        'HR Email': data['HR Email'] || user.email,
        'Connect Status': data['Connect Status'] || 'Not Connected',
        'Calling Disposition': data['Calling Disposition'] || '',
        'Sub-Disposition': data['Sub-Disposition'] || '',
        'Call Status': data['Call Status'] || '',
        'Interview Status': data['Interview Status'] || '',
        'Interview Date': data['Interview Date'] || '',
        'Selection Status': data['Selection Status'] || '',
        'Joining Status': data['Joining Status'] || '',
        'Joining Date': data['Joining Date'] || '',
        'Remarks': data['Remarks'] || '',
        'Created By': user.email,
        'Last Updated': new Date().toLocaleString('en-GB'),
        'Last Updated By': user.email,
        'Record Version': 1,
        'Pipeline Stage': data['Calling Disposition'] === 'Interview Schedule' ? 'Interview Scheduled' : 'Sourced',
        'Duplicate Of': match ? match['Candidate ID'] : '',
        'Record Status': 'Active',
        'Industry': data['Industry'] || ''
      };

      store.candidates.unshift(newCandidate);
      saveLocalStore(store);
      return { success: true, candidateId, candidate: newCandidate } as unknown as T;
    }

    if (action === 'updateCandidate') {
      const idx = store.candidates.findIndex(c => c['Candidate ID'] === body.candidateId);
      if (idx === -1) throw new Error('Candidate not found');
      const current = store.candidates[idx];

      // Optimistic locking verification
      if (body.recordVersion !== undefined && String(current['Record Version']) !== String(body.recordVersion)) {
        const err = new Error('This record was updated by someone else — reload');
        (err as any).statusCode = 409;
        throw err;
      }

      const nextVersion = (parseInt(String(current['Record Version']), 10) || 1) + 1;
      const updated: Candidate = {
        ...current,
        ...body.patch,
        'Record Version': nextVersion,
        'Last Updated': new Date().toLocaleString('en-GB'),
        'Last Updated By': user.email
      };

      store.candidates[idx] = updated;

      // Audit log entry
      store.audits.unshift({
        'Timestamp': new Date().toLocaleString('en-GB'),
        'Candidate ID': current['Candidate ID'],
        'Candidate Name': current['Candidate Name'],
        'Previous Value': JSON.stringify(body.patch),
        'New Value': JSON.stringify(body.patch),
        'Action': 'UPDATE',
        'Updated By': user.email,
        'HR Name': current['Assigned HR'],
        'Source Spreadsheet': 'CRM',
        'Action Type': 'CRM'
      });

      saveLocalStore(store);
      return { success: true, candidateId: body.candidateId, newVersion: nextVersion, updatedCandidate: updated } as unknown as T;
    }

    if (action === 'approveLead') {
      if (!can(user, PERMISSIONS.LEADS_APPROVE)) {
        throw new Error('Forbidden: Only Super Admin and Admin are authorized to approve leads.');
      }
      const leadIdx = store.leads.findIndex(l => l['Lead ID'] === body.leadId);
      if (leadIdx === -1) throw new Error('Lead not found');
      const lead = store.leads[leadIdx];

      const candidateId = `NP-CAN-${String(store.candidates.length + 1).padStart(6, '0')}`;
      lead.Status = 'Approved';
      lead.Decision = 'Approved';
      lead['Candidate ID'] = candidateId;
      lead['Processed By'] = user.email;
      lead['Processed At'] = new Date().toLocaleString('en-GB');

      const newCand: Candidate = {
        'Candidate ID': candidateId,
        'Entry Date': new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        'Candidate Name': lead['Candidate Name'],
        'Mobile Number': lead['Mobile Number'],
        'Alternate Mobile': lead['Alternate Mobile'],
        'Email ID': lead['Email ID'],
        'Designation Applied': lead['Designation'],
        'Current Location': lead['Location'],
        'Experience': lead['Experience'],
        'Current Salary': lead['Current Salary'],
        'Expected Salary': lead['Expected Salary'],
        'Notice Period': lead['Notice Period'],
        'Source': lead['Source'],
        'Client Name': lead['Client Name'],
        'Assigned HR': body.assignToHR?.name || lead['Assign To HR'] || lead['Submitted By HR'],
        'HR Email': body.assignToHR?.email || user.email,
        'Connect Status': 'Not Connected',
        'Calling Disposition': '',
        'Sub-Disposition': '',
        'Call Status': '',
        'Interview Status': '',
        'Interview Date': '',
        'Selection Status': '',
        'Joining Status': '',
        'Joining Date': '',
        'Remarks': lead['Remarks'],
        'Created By': lead['Submitted By HR'],
        'Last Updated': new Date().toLocaleString('en-GB'),
        'Last Updated By': user.email,
        'Record Version': 1,
        'Pipeline Stage': 'Sourced',
        'Duplicate Of': lead['Duplicate Of'],
        'Record Status': 'Active',
        'Industry': lead['Industry']
      };

      store.candidates.unshift(newCand);
      saveLocalStore(store);
      return { success: true, candidateId } as unknown as T;
    }

    if (action === 'rejectLead') {
      if (!can(user, PERMISSIONS.LEADS_REJECT)) {
        throw new Error('Forbidden: Only Super Admin and Admin are authorized to reject leads.');
      }
      const leadIdx = store.leads.findIndex(l => l['Lead ID'] === body.leadId);
      if (leadIdx !== -1) {
        store.leads[leadIdx].Status = 'Rejected';
        store.leads[leadIdx].Decision = 'Rejected';
        store.leads[leadIdx]['Admin Note'] = body.adminNote || '';
        store.leads[leadIdx]['Processed By'] = user.email;
        store.leads[leadIdx]['Processed At'] = new Date().toLocaleString('en-GB');
        saveLocalStore(store);
      }
      return { success: true } as unknown as T;
    }

    if (action === 'updateBilling') {
      if (!can(user, PERMISSIONS.BILLING_UPDATE)) {
        throw new Error('Forbidden: You are not authorized to update billing information.');
      }
      const jIdx = store.joinings.findIndex((j: any) => j.candidateId === body.candidateId);
      if (jIdx !== -1) {
        store.joinings[jIdx] = {
          ...store.joinings[jIdx],
          ...body.patch
        };
        saveLocalStore(store);
      }
      return { success: true } as unknown as T;
    }

    if (action === 'updateUserRole') {
      if (!can(user, PERMISSIONS.RBAC_MANAGE)) {
        throw new Error('Forbidden: Only Super Admin is authorized to modify user roles.');
      }
      const { targetEmail, newRole } = body;
      if (targetEmail === 'novapulse739@gmail.com') {
        throw new Error('Forbidden: Root Super Admin account cannot be modified.');
      }
      store.userRoles = store.userRoles || {};
      store.userRoles[targetEmail] = newRole;
      store.audits = store.audits || [];
      store.audits.unshift({
        'Timestamp': new Date().toLocaleString('en-GB'),
        'Candidate ID': 'RBAC',
        'Candidate Name': targetEmail,
        'Previous Value': 'Role Change',
        'New Value': newRole,
        'Action': 'CHANGE_USER_ROLE',
        'Updated By': user.email,
        'HR Name': 'Super Admin',
        'Source Spreadsheet': 'CONFIGURATION',
        'Action Type': 'SECURITY'
      });
      saveLocalStore(store);
      return { success: true, email: targetEmail, newRole } as unknown as T;
    }

    if (action === 'updateTeamMapping') {
      if (!can(user, PERMISSIONS.RBAC_MANAGE)) {
        throw new Error('Forbidden: Only Super Admin is authorized to update team mappings.');
      }
      const { managerEmail, teamRecruiterEmails } = body;
      store.teamMapping = store.teamMapping || {};
      store.teamMapping[managerEmail] = teamRecruiterEmails;
      store.audits = store.audits || [];
      store.audits.unshift({
        'Timestamp': new Date().toLocaleString('en-GB'),
        'Candidate ID': 'RBAC',
        'Candidate Name': managerEmail,
        'Previous Value': 'Team Mapping',
        'New Value': JSON.stringify(teamRecruiterEmails),
        'Action': 'UPDATE_TEAM_MAPPING',
        'Updated By': user.email,
        'HR Name': 'Super Admin',
        'Source Spreadsheet': 'CONFIGURATION',
        'Action Type': 'SECURITY'
      });
      saveLocalStore(store);
      return { success: true, managerEmail, teamRecruiterEmails } as unknown as T;
    }

    return { success: true } as unknown as T;
  }
}

// Initial seed store
function getLocalStore() {
  const existing = localStorage.getItem('novapulse_local_db');
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch (e) {
      // fallback to initial
    }
  }

  const initialStore = {
    candidates: [
      {
        'Candidate ID': 'NP-CAN-000043',
        'Entry Date': '10-Nov-2026',
        'Candidate Name': 'Deepak',
        'Mobile Number': '8448930037',
        'Alternate Mobile': '-',
        'Email ID': '-',
        'Designation Applied': 'Collections Executive',
        'Current Location': 'Karol bhagh',
        'Experience': '2 Years',
        'Current Salary': '18000',
        'Expected Salary': '22000',
        'Notice Period': 'Immediate',
        'Source': 'Apna',
        'Client Name': 'Ramfirncop',
        'Assigned HR': 'Jigyasha',
        'HR Email': 'gjigyasa11@gmail.com',
        'Connect Status': 'Connect',
        'Calling Disposition': 'Not Interested',
        'Sub-Disposition': 'Salary Issue',
        'Call Status': 'Salary Issue',
        'Interview Status': 'Attended',
        'Interview Date': '13-Nov-2026',
        'Selection Status': 'Selected',
        'Joining Status': 'Not Joined',
        'Joining Date': '14-Nov-2026',
        'Remarks': 'Due to salary issue',
        'Created By': 'novapulse739@gmail.com',
        'Last Updated': '20-Nov-2026 17:38',
        'Last Updated By': 'novapulse739@gmail.com',
        'Record Version': 21,
        'Pipeline Stage': 'Dropped / Not Joined',
        'Duplicate Of': '',
        'Record Status': 'Active',
        'Industry': 'BFSI'
      },
      {
        'Candidate ID': 'NP-CAN-000044',
        'Entry Date': '10-Nov-2026',
        'Candidate Name': 'Jaspreet Singh',
        'Mobile Number': '9278621402',
        'Alternate Mobile': '-',
        'Email ID': 'jaspreet@example.com',
        'Designation Applied': 'Collections Executive',
        'Current Location': 'Delhi',
        'Experience': '1 Year',
        'Current Salary': '16000',
        'Expected Salary': '20000',
        'Notice Period': '15 Days',
        'Source': 'Apna',
        'Client Name': 'Devi Industrial Engineers',
        'Assigned HR': 'Anshu',
        'HR Email': 'hr@novapulse.co.in',
        'Connect Status': 'Connect',
        'Calling Disposition': 'Interested',
        'Sub-Disposition': 'Interested',
        'Call Status': 'Interested',
        'Interview Status': 'Pending',
        'Interview Date': '23-Nov-2026',
        'Selection Status': 'Pending',
        'Joining Status': 'Pending',
        'Joining Date': '',
        'Remarks': 'Interested in MIS role',
        'Created By': 'novapulse739@gmail.com',
        'Last Updated': '21-Nov-2026 18:20',
        'Last Updated By': 'hr@novapulse.co.in',
        'Record Version': 17,
        'Pipeline Stage': 'Interview Scheduled',
        'Duplicate Of': '',
        'Record Status': 'Active',
        'Industry': 'Manufacturing'
      },
      {
        'Candidate ID': 'NP-CAN-000045',
        'Entry Date': '11-Nov-2026',
        'Candidate Name': 'Rahul Verma',
        'Mobile Number': '9810123456',
        'Alternate Mobile': '9810987654',
        'Email ID': 'rahul.v@gmail.com',
        'Designation Applied': 'MIS Executive',
        'Current Location': 'Karol Bagh',
        'Experience': '3 Years',
        'Current Salary': '22000',
        'Expected Salary': '26000',
        'Notice Period': 'Immediate',
        'Source': 'Naukri',
        'Client Name': 'Basecop Luxgery',
        'Assigned HR': 'Anshu',
        'HR Email': 'hr@novapulse.co.in',
        'Connect Status': 'Connect',
        'Calling Disposition': 'Interview Schedule',
        'Sub-Disposition': 'Interview Schedule',
        'Call Status': 'Interview Scheduled',
        'Interview Status': 'Attended',
        'Interview Date': '18-Nov-2026',
        'Selection Status': 'Selected',
        'Joining Status': 'Joined',
        'Joining Date': '20-Nov-2026',
        'Remarks': 'Joined successfully with Basecop',
        'Created By': 'novapulse739@gmail.com',
        'Last Updated': '21-Nov-2026 19:00',
        'Last Updated By': 'novapulse739@gmail.com',
        'Record Version': 5,
        'Pipeline Stage': 'Joined',
        'Duplicate Of': '',
        'Record Status': 'Active',
        'Industry': 'Retail'
      }
    ],
    openings: [
      {
        'Opening ID': 'OP-001',
        'Status': 'Open',
        'Posted On': '11-Nov-2026',
        'Position / Role': 'MIS Executive',
        'Client Name': 'Basecop Luxgery',
        'Job Location (City)': 'Karol Bagh',
        'Office / Interview Address': 'M8 6270 upper Ground floor Block no.6 Dev Nagar Saluja Gali Tank road Karol bagh New Delhi 110005',
        'Skills Required': 'Advanced Excel (VLOOKUP, Pivot, Dashboards), Google Sheets, basic SQL',
        'Qualification': 'Graduate',
        'Experience Required': '1–3 years',
        'Salary Slab (₹ / month)': '₹18,000 – ₹25,000',
        'No. of Vacancies': '1',
        'Shift / Timings': '11:00 AM – 2:30 PM',
        'Working Days': 'Mon–Sat',
        'Interview Mode / Process': 'Walk-in: Excel test',
        'Other Details / Perks': 'Incentives based on accuracy',
        'Last Updated': '11-Nov-2026'
      },
      {
        'Opening ID': 'OP-002',
        'Status': 'Open',
        'Posted On': '14-Nov-2026',
        'Position / Role': 'Collections Executive',
        'Client Name': 'Devi Industrial Engineers',
        'Job Location (City)': 'Delhi NCR',
        'Office / Interview Address': 'Devi Complex, Karol Bagh',
        'Skills Required': 'Calling, Recovery, Negotiation',
        'Qualification': '12th / Graduate',
        'Experience Required': '0–2 years',
        'Salary Slab (₹ / month)': '₹16,000 – ₹22,000',
        'No. of Vacancies': '3',
        'Shift / Timings': '9:30 AM – 6:30 PM',
        'Working Days': 'Mon–Sat',
        'Interview Mode / Process': 'HR Round + Client Walkin',
        'Other Details / Perks': 'Travel allowances',
        'Last Updated': '14-Nov-2026'
      }
    ],
    clients: [
      {
        clientId: 'CL-001',
        clientName: 'Devi Industrial Engineers',
        status: 'Active',
        feeType: 'Percentage',
        feeValue: '8.33',
        invoiceAfterDays: 30,
        replacementPeriodDays: 90,
        gstPercent: 18,
        contactPerson: 'Samarth Khurana',
        contactEmail: 'marketing@deviindustrial.com',
        contactPhone: '9999952404',
        billingAddress: 'M8 6270 upper Ground floor Block no.6 Dev Nagar Saluja Gali Tank road Karol bagh New Delhi 110005',
        agreementNotes: 'Standard 8.33% with 90 days replacement guarantee',
        addedOn: '10-Nov-2026',
        industry: 'Manufacturing',
        hiringStatus: 'Open',
        payrollType: 'Novapulse',
        agreement: 'Yes',
        clientRank: 'A',
        gstNo: '07AAECD1234H1Z1',
        secondaryPOCName: 'Ravi',
        secondaryPOCNumber: '9811122334',
        remarks: 'Priority client',
        activeOpeningsCount: 1,
        linedUpCount: 2,
        selectedCount: 1,
        joinedCount: 0
      },
      {
        clientId: 'CL-002',
        clientName: 'Basecop Luxgery',
        status: 'Active',
        feeType: 'Fixed',
        feeValue: '25000',
        invoiceAfterDays: 15,
        replacementPeriodDays: 60,
        gstPercent: 18,
        contactPerson: 'Karan Mehra',
        contactEmail: 'karan@basecop.com',
        contactPhone: '9876543210',
        billingAddress: 'Tank Road, Karol Bagh, Delhi',
        agreementNotes: 'Fixed flat fee ₹25k per hire',
        addedOn: '11-Nov-2026',
        industry: 'Retail',
        hiringStatus: 'Open',
        payrollType: 'Own',
        agreement: 'Yes',
        clientRank: 'A',
        gstNo: '07BBECD5678J2Z2',
        secondaryPOCName: 'Anita',
        secondaryPOCNumber: '9876543211',
        remarks: 'Prompt payer',
        activeOpeningsCount: 1,
        linedUpCount: 1,
        selectedCount: 1,
        joinedCount: 1
      }
    ],
    joinings: [
      {
        candidateId: 'NP-CAN-000045',
        candidateName: 'Rahul Verma',
        clientName: 'Basecop Luxgery',
        designation: 'MIS Executive',
        assignedHR: 'Anshu',
        joiningDate: '20-Nov-2026',
        annualCtc: 312000,
        feeType: 'Fixed',
        feeValue: 25000,
        daysCompleted: 2,
        invoiceDueDate: '05-Dec-2026',
        replacementEnds: '19-Jan-2027',
        invoiceAmount: 29500,
        employmentStatus: 'Active',
        exitDate: '',
        earlyExitDecision: '',
        invoiceStatus: 'Pending',
        invoiceNo: 'INV-NP-2026-089',
        invoiceDate: '21-Nov-2026',
        paymentReceivedOn: '',
        replacementCandidateId: '',
        billingStatus: 'Invoiced',
        replacementStatus: 'Active',
        remarks: 'First candidate placed with Basecop',
        daysUntilInvoiceDue: 13,
        invoiceDueSoon: false,
        replacementRemainingDays: 58
      }
    ],
    leads: [
      {
        'Lead ID': 'NP-LEAD-000001',
        'Received': '21-Nov-2026 14:30',
        'Submitted By HR': 'Anshu',
        'Request Type': 'New Candidate',
        'Candidate Name': 'Amit Sharma',
        'Mobile Number': '9899011223',
        'Alternate Mobile': '',
        'Email ID': 'amit.sharma@example.com',
        'Designation': 'MIS Executive',
        'Location': 'Karol Bagh',
        'Experience': '2 Years',
        'Current Salary': '20000',
        'Expected Salary': '24000',
        'Notice Period': 'Immediate',
        'Source': 'LinkedIn',
        'Client Name': 'Basecop Luxgery',
        'Remarks': 'Excellent Excel skills, shortlisted for interview',
        'Duplicate Of': '',
        'Duplicate With HR': '',
        'Status': 'Pending',
        'Decision': 'Pending',
        'Admin Note': '',
        'Processed By': '',
        'Processed At': '',
        'Candidate ID': '',
        'Industry': 'Retail',
        'Assign To HR': 'Anshu'
      }
    ],
    hrs: [
      {
        'HR ID': 'NP-HR-001',
        'HR Name': 'Anshu',
        'HR Email': 'hr@novapulse.co.in',
        'HR Spreadsheet ID': '1tCwkgjKQ5Ts_QODN1Lnz58xniESpZN-ntfIMkxxg_BU',
        'HR Spreadsheet URL': 'https://docs.google.com/spreadsheets/d/1tCwkgjKQ5Ts_QODN1Lnz58xniESpZN-ntfIMkxxg_BU/edit',
        'Active Status': 'Active',
        'Registration Date': '11/9/2026 1:06:05',
        'Last Sync': '22-Nov-2026 00:30',
        'Assigned Candidate Count': 75,
        'Sharing Status': 'SHARED – EDITOR',
        'Sync Mode': 'EDIT TRIGGER'
      },
      {
        'HR ID': 'NP-HR-002',
        'HR Name': 'Jigyasha',
        'HR Email': 'gjigyasa11@gmail.com',
        'HR Spreadsheet ID': '1Nxdqn0rPawWvZJzaq42yUCbQfaTTaf1Nmp0ea90lVvQ',
        'HR Spreadsheet URL': 'https://docs.google.com/spreadsheets/d/1Nxdqn0rPawWvZJzaq42yUCbQfaTTaf1Nmp0ea90lVvQ/edit',
        'Active Status': 'Active',
        'Registration Date': '11/9/2026 1:06:37',
        'Last Sync': '22-Nov-2026 00:30',
        'Assigned Candidate Count': 437,
        'Sharing Status': 'SHARED – EDITOR',
        'Sync Mode': 'EDIT TRIGGER'
      }
    ],
    reschedules: [
      {
        'Candidate ID': 'NP-CAN-000043',
        'Candidate Name': 'Deepak',
        'Assigned HR': 'Jigyasha',
        'First Scheduled For': '12-Nov-2026',
        'Current Interview Date': '13-Nov-2026',
        'Reschedule Count': '2',
        'Interview Status': 'Attended',
        'Last Change': '12-Nov-2026 14:00',
        'Flag': 'HIGH RESCHEDULE',
        'Last Status (system)': 'Rescheduled'
      }
    ],
    audits: [],
    duplicates: [],
    interviews: [],
    config: {
      MANAGEMENT_EMAILS: 'novapulse739@gmail.com',
      HR_EDITABLE_FIELDS: 'Designation, Location, Experience, Current Salary, Expected Salary, Notice Period, Source, Client Name, Industry, Calling Disposition, Sub-Disposition, Interview Status, Interview Date, Selection Status, Joining Status, Joining Date, Remarks'
    },
    dropdowns: {
      'Calling Disposition': [
        { List: 'Calling Disposition', Option: 'Interested', Active: 'TRUE', System: 'TRUE' },
        { List: 'Calling Disposition', Option: 'Not Interested', Active: 'TRUE', System: 'TRUE' },
        { List: 'Calling Disposition', Option: 'Call Back', Active: 'TRUE', System: 'TRUE' },
        { List: 'Calling Disposition', Option: 'Not Prospect', Active: 'TRUE', System: 'TRUE' },
        { List: 'Calling Disposition', Option: 'Not Connected', Active: 'TRUE', System: 'TRUE' },
        { List: 'Calling Disposition', Option: 'Interview Schedule', Active: 'TRUE', System: 'TRUE' }
      ],
      'Sub-Disposition': [
        { List: 'Sub-Disposition', Option: 'Interested', 'Parent Disposition': 'Interested', 'Call Status': 'Interested', Active: 'TRUE', System: 'TRUE' },
        { List: 'Sub-Disposition', Option: 'Salary Issue', 'Parent Disposition': 'Not Interested', 'Call Status': 'Salary Issue', Active: 'TRUE', System: 'TRUE' },
        { List: 'Sub-Disposition', Option: 'Location Issue', 'Parent Disposition': 'Not Interested', 'Call Status': 'Location Issue', Active: 'TRUE', System: 'TRUE' },
        { List: 'Sub-Disposition', Option: 'Ambience Issue', 'Parent Disposition': 'Not Interested', 'Call Status': 'Ambience Issue', Active: 'TRUE', System: 'TRUE' },
        { List: 'Sub-Disposition', Option: 'Call Back', 'Parent Disposition': 'Call Back', 'Call Status': 'Callback', Active: 'TRUE', System: 'TRUE' },
        { List: 'Sub-Disposition', Option: 'Follow Up', 'Parent Disposition': 'Call Back', 'Call Status': 'Follow Up', Active: 'TRUE', System: 'TRUE' },
        { List: 'Sub-Disposition', Option: 'Irrelevant Profile', 'Parent Disposition': 'Not Prospect', 'Call Status': 'Irrelevant Profile', Active: 'TRUE', System: 'TRUE' },
        { List: 'Sub-Disposition', Option: 'Not Eligible', 'Parent Disposition': 'Not Prospect', 'Call Status': 'Not Eligible', Active: 'TRUE', System: 'TRUE' },
        { List: 'Sub-Disposition', Option: 'Wrong Number', 'Parent Disposition': 'Not Prospect', 'Call Status': 'Wrong', Active: 'TRUE', System: 'TRUE' },
        { List: 'Sub-Disposition', Option: 'Ringing', 'Parent Disposition': 'Not Connected', 'Call Status': 'Ringing', Active: 'TRUE', System: 'TRUE' },
        { List: 'Sub-Disposition', Option: 'No Response', 'Parent Disposition': 'Not Connected', 'Call Status': 'No Response', Active: 'TRUE', System: 'TRUE' },
        { List: 'Sub-Disposition', Option: 'Busy', 'Parent Disposition': 'Not Connected', 'Call Status': 'Busy', Active: 'TRUE', System: 'TRUE' },
        { List: 'Sub-Disposition', Option: 'Call Rejected', 'Parent Disposition': 'Not Connected', 'Call Status': 'Call Rejected', Active: 'TRUE', System: 'TRUE' },
        { List: 'Sub-Disposition', Option: 'Not Reachable', 'Parent Disposition': 'Not Connected', 'Call Status': 'Unreachable', Active: 'TRUE', System: 'TRUE' },
        { List: 'Sub-Disposition', Option: 'Interview Schedule', 'Parent Disposition': 'Interview Schedule', 'Call Status': 'Interview Scheduled', Active: 'TRUE', System: 'TRUE' }
      ],
      'Interview Status': [
        { List: 'Interview Status', Option: 'Attended', Active: 'TRUE', System: 'TRUE' },
        { List: 'Interview Status', Option: 'Pending', Active: 'TRUE', System: 'TRUE' },
        { List: 'Interview Status', Option: 'Drop After Lineup', Active: 'TRUE', System: 'TRUE' },
        { List: 'Interview Status', Option: 'Rescheduled', Active: 'TRUE', System: 'TRUE' },
        { List: 'Interview Status', Option: 'Not Responding', Active: 'TRUE', System: 'TRUE' }
      ],
      'Selection Status': [
        { List: 'Selection Status', Option: 'Pending', Active: 'TRUE', System: 'TRUE' },
        { List: 'Selection Status', Option: 'Selected', Active: 'TRUE', System: 'TRUE' },
        { List: 'Selection Status', Option: 'Rejected', Active: 'TRUE', System: 'TRUE' },
        { List: 'Selection Status', Option: 'On Hold', Active: 'TRUE', System: 'TRUE' }
      ],
      'Joining Status': [
        { List: 'Joining Status', Option: 'Pending', Active: 'TRUE', System: 'TRUE' },
        { List: 'Joining Status', Option: 'Joined', Active: 'TRUE', System: 'TRUE' },
        { List: 'Joining Status', Option: 'Not Joined', Active: 'TRUE', System: 'TRUE' },
        { List: 'Joining Status', Option: 'Dropped', Active: 'TRUE', System: 'TRUE' }
      ],
      'Industry': [
        { List: 'Industry', Option: 'IT / Software', Active: 'TRUE', System: 'FALSE' },
        { List: 'Industry', Option: 'ITES / BPO / KPO', Active: 'TRUE', System: 'FALSE' },
        { List: 'Industry', Option: 'BFSI', Active: 'TRUE', System: 'FALSE' },
        { List: 'Industry', Option: 'Manufacturing', Active: 'TRUE', System: 'FALSE' },
        { List: 'Industry', Option: 'Retail', Active: 'TRUE', System: 'FALSE' },
        { List: 'Industry', Option: 'Other', Active: 'TRUE', System: 'FALSE' }
      ]
    },
    allDropdowns: []
  };

  saveLocalStore(initialStore);
  return initialStore;
}

function saveLocalStore(store: any) {
  localStorage.setItem('novapulse_local_db', JSON.stringify(store));
}

function computeLocalDashboard(store: any, user: User): DashboardMetrics {
  let candidates = [...store.candidates];
  if (user.role === 'HR_RECRUITER' || user.role === 'HR') {
    candidates = candidates.filter(c => c['HR Email']?.toLowerCase() === user.email.toLowerCase());
  } else if (user.role === 'RECRUITMENT_MANAGER') {
    const team = user.teamRecruiterEmails || ['hr@novapulse.co.in', 'gjigyasa11@gmail.com'];
    candidates = candidates.filter(c => {
      const cEmail = (c['HR Email'] || '').toLowerCase();
      return team.includes(cEmail) || cEmail === user.email.toLowerCase();
    });
  }

  const funnel = {
    sourced: candidates.length,
    connected: candidates.filter(c => c['Connect Status'] === 'Connect' || c['Calling Disposition'] || c['Interview Date']).length,
    interested: candidates.filter(c => c['Calling Disposition'] === 'Interested' || c['Calling Disposition'] === 'Interview Schedule' || c['Interview Date']).length,
    interviewScheduled: candidates.filter(c => c['Interview Date'] && c['Interview Date'] !== '-').length,
    interviewAttended: candidates.filter(c => c['Interview Status'] === 'Attended' || c['Selection Status'] === 'Selected' || c['Joining Status'] === 'Joined').length,
    selected: candidates.filter(c => c['Selection Status'] === 'Selected' || c['Joining Status'] === 'Joined').length,
    joined: candidates.filter(c => c['Joining Status'] === 'Joined').length
  };

  const conversionRates = {
    sourcedToConnected: funnel.sourced ? Math.round((funnel.connected / funnel.sourced) * 100) : 0,
    connectedToInterested: funnel.connected ? Math.round((funnel.interested / funnel.connected) * 100) : 0,
    interestedToInterview: funnel.interested ? Math.round((funnel.interviewScheduled / funnel.interested) * 100) : 0,
    interviewToAttended: funnel.interviewScheduled ? Math.round((funnel.interviewAttended / funnel.interviewScheduled) * 100) : 0,
    attendedToSelected: funnel.interviewAttended ? Math.round((funnel.selected / funnel.interviewAttended) * 100) : 0,
    selectedToJoined: funnel.selected ? Math.round((funnel.joined / funnel.selected) * 100) : 0,
    overallConversion: funnel.sourced ? Math.round((funnel.joined / funnel.sourced) * 100 * 10) / 10 : 0
  };

  return {
    funnel,
    conversionRates,
    quickStats: {
      totalCandidates: funnel.sourced,
      callsToday: 3,
      interviewsToday: 1,
      interviewsThisWeek: 2,
      selectionsThisMonth: funnel.selected,
      joiningsThisMonth: funnel.joined,
      totalRevenue: 29500,
      pendingInvoiceAmount: 29500,
      receivedRevenue: 0
    },
    leaderboard: [
      { hrName: 'Anshu', sourced: 2, connected: 2, interviews: 2, selected: 1, joined: 1 },
      { hrName: 'Jigyasha', sourced: 1, connected: 1, interviews: 1, selected: 1, joined: 0 }
    ],
    dropReasons: [
      { reason: 'Salary Issue', count: 1 },
      { reason: 'Location Issue', count: 0 }
    ],
    clientBreakdown: [
      { client: 'Basecop Luxgery', count: 2 },
      { client: 'Devi Industrial Engineers', count: 1 }
    ],
    sourceBreakdown: [
      { source: 'Apna', count: 2 },
      { source: 'Naukri', count: 1 }
    ]
  };
}

export const api = new ApiClient();
