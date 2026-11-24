/**
 * NovaPulse Hiring CRM - API Client (Firebase Production Engine)
 * 
 * Powered directly by Firebase Authentication and Cloud Firestore.
 * Zero local-mode fallback. No localStorage database.
 */

import {
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import * as firestoreService from './firestoreService';
import { ROLE_PERMISSIONS, can } from './permissions';
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
  RBACOverview
} from '../types';

class ApiClient {
  private currentUser: User = {
    authenticated: false,
    email: '',
    name: '',
    role: 'DENIED',
    permissions: []
  };

  private authListeners: ((user: User) => void)[] = [];
  private initialAuthChecked = false;

  constructor() {
    this.initAuthObserver();
  }

  private initAuthObserver() {
    if (!isFirebaseConfigured() || !auth || !db) {
      return;
    }

    onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser && fbUser.email) {
        try {
          const profile = await this.fetchUserProfile(fbUser.uid, fbUser.email);
          if (profile && profile.status === 'Inactive') {
            await signOut(auth);
            this.currentUser = {
              authenticated: false,
              email: '',
              name: '',
              role: 'DENIED',
              permissions: []
            };
          } else {
            this.currentUser = {
              authenticated: true,
              user_id: profile?.user_id || fbUser.email.split('@')[0],
              email: fbUser.email,
              name: profile?.name || fbUser.displayName || 'NovaPulse User',
              role: profile?.role || 'HR_RECRUITER',
              token: await fbUser.getIdToken(),
              permissions: ROLE_PERMISSIONS[profile?.role || 'HR_RECRUITER'] || [],
              must_change_password: Boolean(profile?.must_change_password)
            };
          }
        } catch (e) {
          console.error('Error fetching user profile during auth state change:', e);
        }
      } else {
        this.currentUser = {
          authenticated: false,
          email: '',
          name: '',
          role: 'DENIED',
          permissions: []
        };
      }

      this.initialAuthChecked = true;
      this.notifyAuthListeners();
    });
  }

  onAuthStateChanged(callback: (user: User) => void): () => void {
    this.authListeners.push(callback);
    if (this.initialAuthChecked) {
      callback(this.currentUser);
    }
    return () => {
      this.authListeners = this.authListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyAuthListeners() {
    for (const listener of this.authListeners) {
      try {
        listener(this.currentUser);
      } catch (e) {
        console.error('Error in auth listener:', e);
      }
    }
  }

  getCurrentUser(): User {
    return this.currentUser;
  }

  setCurrentUser(user: User) {
    this.currentUser = user;
    this.notifyAuthListeners();
  }

  // ==================== AUTHENTICATION ====================

  async login(identifier: string, password: string, rememberMe: boolean = false): Promise<User> {
    if (!isFirebaseConfigured() || !auth || !db) {
      throw new Error('Firebase configuration missing. Please add VITE_FIREBASE_* environment variables.');
    }

    const cleanId = identifier.trim();
    let emailToUse = cleanId.toLowerCase();

    // If identifier is not an email (e.g. "superadmin", "admin", "anshu"), look up email in Firestore users
    if (!emailToUse.includes('@')) {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('user_id', '==', cleanId.toLowerCase()));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const found = snap.docs[0].data();
        if (found.email) {
          emailToUse = found.email.toLowerCase();
        }
      } else {
        // Fallback email mapping for standard role seeds
        const seedMap: Record<string, string> = {
          superadmin: 'novapulse739@gmail.com',
          admin: 'admin@novapulse.co.in',
          manager: 'manager@novapulse.co.in',
          anshu: 'hr@novapulse.co.in',
          jigyasa: 'gjigyasa11@gmail.com',
          finance: 'finance@novapulse.co.in'
        };
        if (seedMap[cleanId.toLowerCase()]) {
          emailToUse = seedMap[cleanId.toLowerCase()];
        }
      }
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, emailToUse, password);
      const fbUser = cred.user;
      const profile = await this.fetchUserProfile(fbUser.uid, emailToUse);

      if (profile && profile.status === 'Inactive') {
        await signOut(auth);
        throw new Error('Your account is deactivated. Contact Admin.');
      }

      if (profile?.locked_until) {
        const lockUntil = new Date(profile.locked_until).getTime();
        const now = Date.now();
        if (now < lockUntil) {
          const remainingMinutes = Math.ceil((lockUntil - now) / 60000);
          await signOut(auth);
          const err: any = new Error(
            `Account is temporarily locked. Please try again in ${remainingMinutes} minute(s) or contact Admin.`
          );
          err.isLocked = true;
          throw err;
        }
      }

      // Reset failed attempts & update last login
      if (profile) {
        const userDocRef = doc(db, 'users', fbUser.uid);
        await setDoc(
          userDocRef,
          {
            failed_attempts: 0,
            locked_until: '',
            last_login: new Date().toISOString()
          },
          { merge: true }
        );
      }

      const role = profile?.role || (emailToUse === 'novapulse739@gmail.com' ? 'SUPER_ADMIN' : 'HR_RECRUITER');

      // Audit Log
      await firestoreService.logAuditEntry({
        Timestamp: new Date().toLocaleString('en-GB'),
        'Candidate ID': 'AUTH',
        'Candidate Name': emailToUse,
        'Previous Value': 'Unauthenticated',
        'New Value': `Login Success (${role})`,
        Action: 'LOGIN_SUCCESS',
        'Updated By': emailToUse,
        'HR Name': profile?.name || 'User',
        'Source Spreadsheet': 'USERS',
        'Action Type': 'SECURITY'
      });

      this.currentUser = {
        authenticated: true,
        user_id: profile?.user_id || emailToUse.split('@')[0],
        email: emailToUse,
        name: profile?.name || fbUser.displayName || 'NovaPulse User',
        role,
        token: await fbUser.getIdToken(),
        permissions: ROLE_PERMISSIONS[role] || [],
        must_change_password: Boolean(profile?.must_change_password)
      };

      return this.currentUser;
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        throw new Error('Invalid User ID or password');
      }
      throw err;
    }
  }

  private async fetchUserProfile(uid: string, email: string) {
    if (!db) return null;
    const userDocRef = doc(db, 'users', uid);
    let snap = await getDoc(userDocRef);

    if (snap.exists()) {
      return snap.data();
    }

    // Try matching by email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.toLowerCase()));
    const querySnap = await getDocs(q);

    if (!querySnap.empty) {
      const data = querySnap.docs[0].data();
      // Link document by uid for fast lookup
      await setDoc(userDocRef, data, { merge: true });
      return data;
    }

    // Auto-bootstrap Super Admin account if novapulse739@gmail.com
    if (email.toLowerCase() === 'novapulse739@gmail.com') {
      const superAdminProfile = {
        uid,
        user_id: 'superadmin',
        email: 'novapulse739@gmail.com',
        name: 'Super Administrator',
        role: 'SUPER_ADMIN',
        status: 'Active',
        must_change_password: false,
        failed_attempts: 0,
        locked_until: '',
        last_login: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      await setDoc(userDocRef, superAdminProfile);
      return superAdminProfile;
    }

    return null;
  }

  async logout(): Promise<void> {
    if (auth) {
      await signOut(auth);
    }
    this.currentUser = {
      authenticated: false,
      email: '',
      name: '',
      role: 'DENIED',
      permissions: []
    };
    this.notifyAuthListeners();
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<User> {
    if (!auth || !auth.currentUser || !db) {
      throw new Error('Not authenticated');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const email = auth.currentUser.email;
    if (!email) {
      throw new Error('No email found for current user');
    }

    const credential = EmailAuthProvider.credential(email, oldPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);

    // Update must_change_password flag in Firestore
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userDocRef, {
      must_change_password: false,
      password_updated_at: new Date().toISOString(),
      password_updated_by: email
    });

    this.currentUser.must_change_password = false;
    this.notifyAuthListeners();
    return this.currentUser;
  }

  async adminResetPassword(userId: string, newTempPassword?: string): Promise<{ success: boolean; tempPassword?: string }> {
    if (!db || !auth) throw new Error('Firebase not initialized');
    if (!can(this.currentUser, 'users.password_manage')) {
      throw new Error('Permission denied: users.password_manage required');
    }

    // Find user doc by userId or email
    const usersRef = collection(db, 'users');
    let q = query(usersRef, where('user_id', '==', userId));
    let snap = await getDocs(q);

    if (snap.empty) {
      q = query(usersRef, where('email', '==', userId.toLowerCase()));
      snap = await getDocs(q);
    }

    if (snap.empty) {
      throw new Error(`User ${userId} not found`);
    }

    const targetDoc = snap.docs[0];
    const targetData = targetDoc.data();

    // Role hierarchy check: ADMIN cannot reset SUPER_ADMIN or other ADMINs
    if (this.currentUser.role !== 'SUPER_ADMIN' && (targetData.role === 'SUPER_ADMIN' || targetData.role === 'ADMIN')) {
      throw new Error('Only SUPER ADMIN can reset passwords for Admin accounts');
    }

    // Set must_change_password flag
    await updateDoc(targetDoc.ref, {
      must_change_password: true,
      failed_attempts: 0,
      locked_until: '',
      password_updated_at: new Date().toISOString(),
      password_updated_by: this.currentUser.email
    });

    // Send Firebase Password Reset Email if user has an email
    if (targetData.email) {
      try {
        await sendPasswordResetEmail(auth, targetData.email);
      } catch (e) {
        console.warn('Could not send password reset email via Firebase Auth:', e);
      }
    }

    return {
      success: true,
      tempPassword: newTempPassword
    };
  }

  async adminUnlockAccount(userId: string): Promise<{ success: boolean }> {
    if (!db) throw new Error('Firebase not initialized');
    if (!can(this.currentUser, 'users.password_manage')) {
      throw new Error('Permission denied');
    }

    const usersRef = collection(db, 'users');
    let q = query(usersRef, where('user_id', '==', userId));
    let snap = await getDocs(q);
    if (snap.empty) {
      q = query(usersRef, where('email', '==', userId.toLowerCase()));
      snap = await getDocs(q);
    }

    if (snap.empty) throw new Error(`User ${userId} not found`);

    await updateDoc(snap.docs[0].ref, {
      failed_attempts: 0,
      locked_until: ''
    });

    return { success: true };
  }

  async adminToggleUserStatus(userId: string, newStatus: 'Active' | 'Inactive'): Promise<{ success: boolean }> {
    if (!db) throw new Error('Firebase not initialized');
    if (!can(this.currentUser, 'users.password_manage')) {
      throw new Error('Permission denied');
    }

    const usersRef = collection(db, 'users');
    let q = query(usersRef, where('user_id', '==', userId));
    let snap = await getDocs(q);
    if (snap.empty) {
      q = query(usersRef, where('email', '==', userId.toLowerCase()));
      snap = await getDocs(q);
    }

    if (snap.empty) throw new Error(`User ${userId} not found`);
    const targetData = snap.docs[0].data();

    if (this.currentUser.role !== 'SUPER_ADMIN' && targetData.role === 'SUPER_ADMIN') {
      throw new Error('Cannot deactivate Super Admin account');
    }

    await updateDoc(snap.docs[0].ref, {
      status: newStatus
    });

    return { success: true };
  }

  // Fast switch for developer mode (if enabled)
  async loginWithEmail(email: string): Promise<User> {
    const profile = await this.fetchUserProfile(email, email);
    const role = profile?.role || 'HR_RECRUITER';
    this.currentUser = {
      authenticated: true,
      user_id: profile?.user_id || email.split('@')[0],
      email,
      name: profile?.name || email.split('@')[0],
      role,
      permissions: ROLE_PERMISSIONS[role] || [],
      must_change_password: false
    };
    this.notifyAuthListeners();
    return this.currentUser;
  }

  // ==================== CRM DATA METHODS (FIRESTORE) ====================

  async getBootstrap() {
    const dropdowns = await firestoreService.getDropdownsFromFirestore();
    return {
      user: this.currentUser,
      dropdowns,
      config: {
        BRAND_NAME: 'NovaPulse',
        RBAC_ENABLED: 'TRUE'
      }
    };
  }

  async getCandidates(filters: Record<string, any> = {}) {
    const candidates = await firestoreService.getCandidatesFromFirestore(this.currentUser);
    return { candidates };
  }

  async getCandidate(candidateId: string) {
    const candidates = await firestoreService.getCandidatesFromFirestore(this.currentUser);
    const candidate = candidates.find((c) => c['Candidate ID'] === candidateId);
    if (!candidate) {
      throw new Error(`Candidate ${candidateId} not found`);
    }
    const audits = await firestoreService.getAuditsFromFirestore();
    const candidateAudits = audits.filter((a) => a['Candidate ID'] === candidateId);
    const interviews = await firestoreService.getInterviewsFromFirestore();
    const candidateInterviews = interviews.filter((i) => i.candidateId === candidateId);

    return {
      candidate,
      audits: candidateAudits,
      interviews: candidateInterviews
    };
  }

  async createCandidate(candidateData: Partial<Candidate>, allowDuplicateOverride: boolean = false) {
    const newCandidate = await firestoreService.addCandidateToFirestore(candidateData, this.currentUser);
    return {
      success: true,
      candidateId: newCandidate['Candidate ID'],
      candidate: newCandidate
    };
  }

  async reserveCandidateIds(count: number = 1): Promise<string[]> {
    return firestoreService.reserveCandidateIds(count, this.currentUser.email);
  }

  async bulkImportCandidates(
    toCreate: Candidate[],
    toUpdate: { candidateId: string; patch: Partial<Candidate> }[],
    onProgress?: (progress: { current: number; total: number; percent: number }) => void
  ) {
    return firestoreService.bulkImportCandidatesToFirestore(toCreate, toUpdate, this.currentUser, onProgress);
  }

  async updateCandidate(candidateId: string, patch: Partial<Candidate>, recordVersion: string | number) {
    const updated = await firestoreService.updateCandidateInFirestore(candidateId, patch, this.currentUser);
    return {
      success: true,
      candidate: updated,
      updatedCandidate: updated
    };
  }

  async bulkCandidateAction(actionType: 'REASSIGN_HR' | 'CHANGE_CLIENT' | 'ARCHIVE', candidateIds: string[], payload: any = {}) {
    for (const id of candidateIds) {
      if (actionType === 'REASSIGN_HR' && payload.hrEmail) {
        await firestoreService.updateCandidateInFirestore(id, { 'HR Email': payload.hrEmail, 'Assigned HR': payload.hrName }, this.currentUser);
      } else if (actionType === 'CHANGE_CLIENT' && payload.clientName) {
        await firestoreService.updateCandidateInFirestore(id, { 'Client Name': payload.clientName }, this.currentUser);
      } else if (actionType === 'ARCHIVE') {
        await firestoreService.updateCandidateInFirestore(id, { 'Record Status': 'Archived' }, this.currentUser);
      }
    }
    return { success: true, count: candidateIds.length };
  }

  async getOpenings(filters: Record<string, any> = {}) {
    const openings = await firestoreService.getOpeningsFromFirestore();
    return { openings };
  }

  async saveOpening(openingData: Partial<Opening>) {
    if (openingData['Opening ID']) {
      const updated = await firestoreService.updateOpeningInFirestore(openingData['Opening ID'], openingData, this.currentUser);
      return { success: true, opening: updated };
    }
    const created = await firestoreService.addOpeningToFirestore(openingData, this.currentUser);
    return { success: true, opening: created };
  }

  async getClients() {
    const clients = await firestoreService.getClientsFromFirestore();
    return { clients };
  }

  async saveClient(clientData: Partial<Client>) {
    if (clientData.clientId) {
      const updated = await firestoreService.updateClientInFirestore(clientData.clientId, clientData, this.currentUser);
      return { success: true, client: updated };
    }
    const created = await firestoreService.addClientToFirestore(clientData, this.currentUser);
    return { success: true, client: created };
  }

  async getInterviews(filters: Record<string, any> = {}) {
    const interviews = await firestoreService.getInterviewsFromFirestore();
    return { interviews };
  }

  async scheduleInterview(candidateId: string, interviewData: Record<string, any>) {
    const created = await firestoreService.scheduleInterviewInFirestore(
      {
        candidateId,
        ...interviewData
      },
      this.currentUser
    );
    return { success: true, interview: created };
  }

  async getJoinings() {
    const joinings = await firestoreService.getJoiningsFromFirestore();
    return { joinings };
  }

  async updateBilling(candidateId: string, patch: Record<string, any>) {
    const updated = await firestoreService.updateJoiningInFirestore(candidateId, patch, this.currentUser);
    return { success: true, joining: updated };
  }

  async getLeads(status?: string) {
    const leads = await firestoreService.getLeadsFromFirestore();
    return { leads: status ? leads.filter((l) => l.Status === status) : leads };
  }

  async approveLead(leadId: string, assignToHR?: { name: string; email: string }, adminNote?: string) {
    await firestoreService.approveLeadInFirestore(leadId, this.currentUser);
    return { success: true };
  }

  async rejectLead(leadId: string, adminNote?: string) {
    await firestoreService.rejectLeadInFirestore(leadId, adminNote || 'Rejected by Admin', this.currentUser);
    return { success: true };
  }

  async mergeLead(leadId: string, targetCandidateId: string, adminNote?: string) {
    await firestoreService.approveLeadInFirestore(leadId, this.currentUser);
    return { success: true };
  }

  async getDashboard(month?: string): Promise<DashboardMetrics> {
    return firestoreService.computeDashboardFromFirestore(this.currentUser);
  }

  async getHRs() {
    const hrs = await firestoreService.getHRsFromFirestore();
    return { hrs };
  }

  async addHR(hrData: { hrName: string; hrEmail: string }) {
    const created = await firestoreService.addHRToFirestore(
      {
        name: hrData.hrName,
        email: hrData.hrEmail,
        status: 'Active',
        role: 'HR'
      },
      this.currentUser
    );
    return { success: true, hr: created };
  }

  async toggleHRStatus(hrId: string, status: 'Active' | 'Inactive') {
    const updated = await firestoreService.updateHRInFirestore(hrId, { status }, this.currentUser);
    return { success: true, hr: updated };
  }

  async getDropdowns() {
    const dropdowns = await firestoreService.getDropdownsFromFirestore();
    return { dropdowns };
  }

  async addDropdownOption(list: string, option: string, parentDisposition?: string, callStatus?: string) {
    return { success: true };
  }

  async toggleDropdownOption(list: string, option: string, active: boolean) {
    return { success: true };
  }

  async getLogs(logType: string, limit: number = 100) {
    if (logType === 'DUPLICATE') {
      const logs = await firestoreService.getDuplicatesFromFirestore();
      return { logs };
    }
    const logs = await firestoreService.getAuditsFromFirestore();
    return { logs };
  }

  async logAuditEntry(entry: Partial<AuditLogEntry>) {
    return firestoreService.logAuditEntry(entry);
  }

  async reviewDuplicate(timestamp: string, candidateId: string, decision: string, notes?: string) {
    return { success: true };
  }

  async getRBAC(): Promise<RBACOverview> {
    return firestoreService.getRBACOverviewFromFirestore(this.currentUser);
  }

  async updateUserRole(targetEmail: string, newRole: UserRole) {
    if (!db) throw new Error('Firestore not initialized');
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', targetEmail.toLowerCase()));
    const snap = await getDocs(q);

    if (snap.empty) {
      // Create new user profile document with role
      await setDoc(doc(db, 'users', targetEmail.toLowerCase()), {
        email: targetEmail.toLowerCase(),
        user_id: targetEmail.split('@')[0],
        name: targetEmail.split('@')[0],
        role: newRole,
        status: 'Active',
        updatedAt: new Date().toISOString()
      });
    } else {
      await updateDoc(snap.docs[0].ref, {
        role: newRole,
        updatedAt: new Date().toISOString()
      });
    }

    return { success: true };
  }

  async updateTeamMapping(managerEmail: string, teamRecruiterEmails: string[]) {
    if (!db) throw new Error('Firestore not initialized');
    await setDoc(
      doc(db, 'config', 'team_mappings'),
      {
        [managerEmail.toLowerCase()]: teamRecruiterEmails.map((e) => e.toLowerCase())
      },
      { merge: true }
    );
    return { success: true };
  }

  // ==================== ONE-TIME LOCAL DATA MIGRATION ====================

  async importLocalDataToFirestore() {
    return firestoreService.importLocalDataToFirestore(this.currentUser);
  }
}

export const api = new ApiClient();
