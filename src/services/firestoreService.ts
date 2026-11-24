/**
 * NovaPulse CRM - Firestore Data Service
 * 
 * Provides comprehensive Cloud Firestore CRUD operations, data scoping
 * based on RBAC roles, audit logging, and local data migration.
 * No localStorage database is used.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import { MASTER_MIGRATION_DATA } from '../data/masterMigrationData';
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
  RBACOverview,
  RBACUser
} from '../types';

function requireDb() {
  if (!db) {
    throw new Error('Cloud Firestore is not initialized. Please verify Firebase environment variables.');
  }
  return db;
}

// ==================== CANDIDATES ====================

export async function getCandidatesFromFirestore(user: User): Promise<Candidate[]> {
  const firestore = requireDb();
  const candidatesRef = collection(firestore, 'candidates');
  let q = query(candidatesRef);

  // Apply RBAC record scoping
  if (user.role === 'HR_RECRUITER' || user.role === 'HR') {
    q = query(candidatesRef, where('HR Email', '==', user.email.toLowerCase()));
  }

  const snapshot = await getDocs(q);
  const candidates: Candidate[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as Candidate;
    candidates.push(data);
  });

  // For managers: filter team recruiters in memory or query
  if (user.role === 'RECRUITMENT_MANAGER') {
    const team = (user.teamRecruiterEmails || ['hr@novapulse.co.in', 'gjigyasa11@gmail.com']).map((e) => e.toLowerCase());
    return candidates.filter((c) => {
      const cEmail = (c['HR Email'] || '').toLowerCase();
      return team.includes(cEmail) || cEmail === user.email.toLowerCase();
    });
  }

  return candidates;
}

export async function addCandidateToFirestore(candidate: Partial<Candidate>, user: User): Promise<Candidate> {
  const firestore = requireDb();
  let candidateId = candidate['Candidate ID'];

  if (!candidateId) {
    try {
      const counterRef = doc(firestore, 'config', 'counters');
      candidateId = await runTransaction(firestore, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let nextNum = 1159;
        if (counterSnap.exists() && counterSnap.data()?.lastCandidateNum) {
          nextNum = Number(counterSnap.data().lastCandidateNum) + 1;
        }
        const formattedId = `NP-CAN-${String(nextNum).padStart(6, '0')}`;
        transaction.set(
          counterRef,
          {
            lastCandidateNum: nextNum,
            nextCandidateId: `NP-CAN-${String(nextNum + 1).padStart(6, '0')}`,
            updatedAt: serverTimestamp(),
            updatedBy: user.email
          },
          { merge: true }
        );
        return formattedId;
      });
    } catch (err) {
      console.warn('Failed to atomically increment candidate counter, using sequential fallback:', err);
      candidateId = `NP-CAN-${String(Date.now()).slice(-6)}`;
    }
  }

  const nowStr = new Date().toLocaleString('en-GB');

  const newCandidate: Candidate = {
    ...candidate,
    'Candidate ID': candidateId,
    'Entry Date': candidate['Entry Date'] || nowStr,
    'Record Status': candidate['Record Status'] || 'Active',
    'Created By': user.email,
    'Last Updated': nowStr,
    'Last Updated By': user.email,
    'Record Version': 1
  } as Candidate;

  await setDoc(doc(firestore, 'candidates', candidateId), newCandidate);

  // Audit Log
  await logAuditEntry({
    Timestamp: nowStr,
    'Candidate ID': candidateId,
    'Candidate Name': newCandidate['Candidate Name'] || '',
    'Previous Value': 'None',
    'New Value': 'Record Created in Firestore',
    Action: 'RECORD_CREATED',
    'Updated By': user.email,
    'HR Name': user.name,
    'Source Spreadsheet': 'CANDIDATES',
    'Action Type': 'DATA'
  });

  return newCandidate;
}

export async function updateCandidateInFirestore(
  candidateId: string,
  updates: Partial<Candidate>,
  user: User
): Promise<Candidate> {
  const firestore = requireDb();
  const docRef = doc(firestore, 'candidates', candidateId);
  const existingSnap = await getDoc(docRef);

  if (!existingSnap.exists()) {
    throw new Error(`Candidate with ID ${candidateId} not found in Firestore.`);
  }

  const existing = existingSnap.data() as Candidate;
  const nowStr = new Date().toLocaleString('en-GB');

  const merged: Candidate = {
    ...existing,
    ...updates,
    'Candidate ID': candidateId,
    'Last Updated': nowStr,
    'Last Updated By': user.email,
    'Record Version': (existing['Record Version'] || 1) + 1
  };

  await setDoc(docRef, merged, { merge: true });

  // Audit Log
  await logAuditEntry({
    Timestamp: nowStr,
    'Candidate ID': candidateId,
    'Candidate Name': merged['Candidate Name'] || '',
    'Previous Value': existing['Pipeline Stage'] || existing['Calling Disposition'] || 'Active',
    'New Value': updates['Pipeline Stage'] || updates['Calling Disposition'] || 'Updated',
    Action: 'FIELD_UPDATED',
    'Updated By': user.email,
    'HR Name': user.name,
    'Source Spreadsheet': 'CANDIDATES',
    'Action Type': 'DATA'
  });

  return merged;
}

// ==================== OPENINGS ====================

export async function getOpeningsFromFirestore(): Promise<Opening[]> {
  const firestore = requireDb();
  const snapshot = await getDocs(collection(firestore, 'openings'));
  const openings: Opening[] = [];
  snapshot.forEach((docSnap) => {
    openings.push(docSnap.data() as Opening);
  });
  return openings;
}

export async function addOpeningToFirestore(opening: Partial<Opening>, user: User): Promise<Opening> {
  const firestore = requireDb();
  const openingId = opening['Opening ID'] || `OP-${String(Date.now()).slice(-4)}`;
  const nowStr = new Date().toLocaleString('en-GB');

  const newOpening: Opening = {
    ...opening,
    'Opening ID': openingId,
    Status: opening.Status || 'Open',
    'Posted On': opening['Posted On'] || nowStr,
    'Last Updated': nowStr
  } as Opening;

  await setDoc(doc(firestore, 'openings', openingId), newOpening);
  return newOpening;
}

export async function updateOpeningInFirestore(
  openingId: string,
  updates: Partial<Opening>,
  user: User
): Promise<Opening> {
  const firestore = requireDb();
  const docRef = doc(firestore, 'openings', openingId);
  const snap = await getDoc(docRef);
  const existing = (snap.exists() ? snap.data() : {}) as Opening;

  const merged: Opening = {
    ...existing,
    ...updates,
    'Opening ID': openingId,
    'Last Updated': new Date().toLocaleString('en-GB')
  };

  await setDoc(docRef, merged, { merge: true });
  return merged;
}

// ==================== CLIENTS ====================

export async function getClientsFromFirestore(): Promise<Client[]> {
  const firestore = requireDb();
  const snapshot = await getDocs(collection(firestore, 'clients'));
  const clients: Client[] = [];
  snapshot.forEach((docSnap) => {
    clients.push(docSnap.data() as Client);
  });
  return clients;
}

export async function addClientToFirestore(client: Partial<Client>, user: User): Promise<Client> {
  const firestore = requireDb();
  const clientId = client.clientId || `CL-${String(Date.now()).slice(-4)}`;
  const nowStr = new Date().toLocaleString('en-GB');

  const newClient: Client = {
    ...client,
    clientId,
    status: client.status || 'Active',
    addedOn: client.addedOn || nowStr
  } as Client;

  await setDoc(doc(firestore, 'clients', clientId), newClient);
  return newClient;
}

export async function updateClientInFirestore(
  clientId: string,
  updates: Partial<Client>,
  user: User
): Promise<Client> {
  const firestore = requireDb();
  const docRef = doc(firestore, 'clients', clientId);
  const snap = await getDoc(docRef);
  const existing = (snap.exists() ? snap.data() : {}) as Client;

  const merged: Client = {
    ...existing,
    ...updates,
    clientId
  };

  await setDoc(docRef, merged, { merge: true });
  return merged;
}

// ==================== INTERVIEWS ====================

export async function getInterviewsFromFirestore(): Promise<InterviewItem[]> {
  const firestore = requireDb();
  const snapshot = await getDocs(collection(firestore, 'interviews'));
  const interviews: InterviewItem[] = [];
  snapshot.forEach((docSnap) => {
    interviews.push(docSnap.data() as InterviewItem);
  });
  return interviews;
}

export async function scheduleInterviewInFirestore(
  interview: Partial<InterviewItem>,
  user: User
): Promise<InterviewItem> {
  const firestore = requireDb();
  const interviewId = interview.interviewId || `INT-${String(Date.now()).slice(-6)}`;

  const newInterview: InterviewItem = {
    ...interview,
    interviewId,
    interviewStatus: interview.interviewStatus || 'Pending',
    rescheduleCount: 0,
    timeBucket: 'Upcoming'
  } as InterviewItem;

  await setDoc(doc(firestore, 'interviews', interviewId), newInterview);
  return newInterview;
}

export async function updateInterviewInFirestore(
  interviewId: string,
  updates: Partial<InterviewItem>,
  user: User
): Promise<InterviewItem> {
  const firestore = requireDb();
  const docRef = doc(firestore, 'interviews', interviewId);
  const snap = await getDoc(docRef);
  const existing = (snap.exists() ? snap.data() : {}) as InterviewItem;

  const merged: InterviewItem = {
    ...existing,
    ...updates,
    interviewId
  };

  await setDoc(docRef, merged, { merge: true });
  return merged;
}

// ==================== JOININGS & BILLING ====================

export async function getJoiningsFromFirestore(): Promise<JoiningRecord[]> {
  const firestore = requireDb();
  const snapshot = await getDocs(collection(firestore, 'joinings'));
  const joinings: JoiningRecord[] = [];
  snapshot.forEach((docSnap) => {
    joinings.push(docSnap.data() as JoiningRecord);
  });
  return joinings;
}

export async function updateJoiningInFirestore(
  candidateId: string,
  updates: Partial<JoiningRecord>,
  user: User
): Promise<JoiningRecord> {
  const firestore = requireDb();
  const docRef = doc(firestore, 'joinings', candidateId);
  const snap = await getDoc(docRef);
  const existing = (snap.exists() ? snap.data() : {}) as JoiningRecord;

  const merged: JoiningRecord = {
    ...existing,
    ...updates,
    candidateId
  };

  await setDoc(docRef, merged, { merge: true });
  return merged;
}

// ==================== LEADS ====================

export async function getLeadsFromFirestore(): Promise<LeadItem[]> {
  const firestore = requireDb();
  const snapshot = await getDocs(collection(firestore, 'leads'));
  const leads: LeadItem[] = [];
  snapshot.forEach((docSnap) => {
    leads.push(docSnap.data() as LeadItem);
  });
  return leads;
}

export async function submitLeadToFirestore(lead: Partial<LeadItem>, user: User): Promise<LeadItem> {
  const firestore = requireDb();
  const leadId = lead['Lead ID'] || `NP-LEAD-${String(Date.now()).slice(-6)}`;
  const nowStr = new Date().toLocaleString('en-GB');

  const newLead: LeadItem = {
    ...lead,
    'Lead ID': leadId,
    Received: nowStr,
    'Submitted By HR': user.name || user.email,
    Status: 'Pending'
  } as LeadItem;

  await setDoc(doc(firestore, 'leads', leadId), newLead);
  return newLead;
}

export async function approveLeadInFirestore(leadId: string, user: User): Promise<void> {
  const firestore = requireDb();
  const docRef = doc(firestore, 'leads', leadId);
  await updateDoc(docRef, {
    Status: 'Approved',
    'Reviewed By': user.email,
    'Reviewed At': new Date().toLocaleString('en-GB')
  });
}

export async function rejectLeadInFirestore(leadId: string, reason: string, user: User): Promise<void> {
  const firestore = requireDb();
  const docRef = doc(firestore, 'leads', leadId);
  await updateDoc(docRef, {
    Status: 'Rejected',
    'Rejection Reason': reason,
    'Reviewed By': user.email,
    'Reviewed At': new Date().toLocaleString('en-GB')
  });
}

// ==================== HR REGISTRY ====================

export async function getHRsFromFirestore(): Promise<HRRecord[]> {
  const firestore = requireDb();
  const snapshot = await getDocs(collection(firestore, 'hrs'));
  const hrs: HRRecord[] = [];
  snapshot.forEach((docSnap) => {
    hrs.push(docSnap.data() as HRRecord);
  });
  return hrs;
}

export async function addHRToFirestore(hr: Partial<HRRecord>, user: User): Promise<HRRecord> {
  const firestore = requireDb();
  const hrId = hr.hrId || `HR-${String(Date.now()).slice(-4)}`;
  const newHR: HRRecord = {
    ...hr,
    hrId,
    status: hr.status || 'Active'
  } as HRRecord;

  await setDoc(doc(firestore, 'hrs', hrId), newHR);
  return newHR;
}

export async function updateHRInFirestore(hrId: string, updates: Partial<HRRecord>, user: User): Promise<HRRecord> {
  const firestore = requireDb();
  const docRef = doc(firestore, 'hrs', hrId);
  const snap = await getDoc(docRef);
  const existing = (snap.exists() ? snap.data() : {}) as HRRecord;

  const merged: HRRecord = {
    ...existing,
    ...updates,
    hrId
  };

  await setDoc(docRef, merged, { merge: true });
  return merged;
}

// ==================== AUDITS & DUPLICATES ====================

export async function logAuditEntry(entry: Partial<AuditLogEntry>): Promise<void> {
  try {
    const firestore = requireDb();
    await addDoc(collection(firestore, 'audits'), {
      ...entry,
      Timestamp: entry.Timestamp || new Date().toLocaleString('en-GB'),
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('Failed to write audit entry to Firestore:', err);
  }
}

export async function getAuditsFromFirestore(): Promise<AuditLogEntry[]> {
  const firestore = requireDb();
  const auditsRef = collection(firestore, 'audits');
  const q = query(auditsRef, limit(100));
  const snapshot = await getDocs(q);
  const audits: AuditLogEntry[] = [];
  snapshot.forEach((docSnap) => {
    audits.push(docSnap.data() as AuditLogEntry);
  });
  return audits;
}

export async function getDuplicatesFromFirestore(): Promise<DuplicateLogEntry[]> {
  const firestore = requireDb();
  const snapshot = await getDocs(collection(firestore, 'duplicates'));
  const duplicates: DuplicateLogEntry[] = [];
  snapshot.forEach((docSnap) => {
    duplicates.push(docSnap.data() as DuplicateLogEntry);
  });
  return duplicates;
}

// ==================== DROPDOWNS ====================

export async function getDropdownsFromFirestore(): Promise<Record<string, DropdownOption[]>> {
  const firestore = requireDb();
  const snap = await getDoc(doc(firestore, 'dropdowns', 'categories'));
  if (snap.exists()) {
    return snap.data() as Record<string, DropdownOption[]>;
  }

  // Default dropdown seed
  const defaultDropdowns: Record<string, DropdownOption[]> = {
    'Calling Disposition': [
      { List: 'Calling Disposition', Option: 'Connected', Active: 'TRUE', System: 'TRUE' },
      { List: 'Calling Disposition', Option: 'Not Connected', Active: 'TRUE', System: 'TRUE' },
      { List: 'Calling Disposition', Option: 'Not Interested', Active: 'TRUE', System: 'TRUE' },
      { List: 'Calling Disposition', Option: 'Callback Requested', Active: 'TRUE', System: 'TRUE' },
      { List: 'Calling Disposition', Option: 'Interview Scheduled', Active: 'TRUE', System: 'TRUE' }
    ],
    'Interview Status': [
      { List: 'Interview Status', Option: 'Pending', Active: 'TRUE', System: 'TRUE' },
      { List: 'Interview Status', Option: 'Attended', Active: 'TRUE', System: 'TRUE' },
      { List: 'Interview Status', Option: 'Drop After Lineup', Active: 'TRUE', System: 'TRUE' },
      { List: 'Interview Status', Option: 'Rescheduled', Active: 'TRUE', System: 'TRUE' }
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
      { List: 'Industry', Option: 'Retail', Active: 'TRUE', System: 'FALSE' }
    ]
  };

  // Seed default dropdowns
  await setDoc(doc(firestore, 'dropdowns', 'categories'), defaultDropdowns);
  return defaultDropdowns;
}

// ==================== DASHBOARD METRICS ====================

export async function computeDashboardFromFirestore(user: User): Promise<DashboardMetrics> {
  const candidates = (await getCandidatesFromFirestore(user)) || [];
  const interviews = (await getInterviewsFromFirestore()) || [];
  const joinings = (await getJoiningsFromFirestore()) || [];
  const clients = (await getClientsFromFirestore()) || [];

  const totalSourced = candidates.length;
  const connected = candidates.filter(
    (c) => c && (c['Connect Status'] === 'Connect' || c['Calling Disposition'] === 'Connected' || c['Calling Disposition'] === 'Interview Scheduled')
  ).length;
  const interested = candidates.filter(
    (c) => c && (c['Calling Disposition'] === 'Interested' || c['Calling Disposition'] === 'Interview Schedule' || Boolean(c['Interview Date']))
  ).length;
  const interviewScheduled = candidates.filter(
    (c) => c && Boolean(c['Interview Date']) && c['Interview Date'] !== '-'
  ).length;
  const interviewAttended = interviews.filter((i) => i && i.interviewStatus === 'Attended').length;
  const selected = candidates.filter((c) => c && c['Selection Status'] === 'Selected').length;
  const joined = joinings.filter((j) => j && (j.billingStatus === 'Invoiced' || j.billingStatus === 'Paid')).length;

  const totalRevenue = joinings.reduce((sum, j) => sum + (Number(j?.invoiceAmount) || 0), 0);
  const pendingRevenue = joinings.filter((j) => j?.invoiceStatus !== 'Paid').reduce((sum, j) => sum + (Number(j?.invoiceAmount) || 0), 0);
  const receivedRevenue = joinings.filter((j) => j?.invoiceStatus === 'Paid').reduce((sum, j) => sum + (Number(j?.invoiceAmount) || 0), 0);
  const activeGuarantees = joinings.filter((j) => (j?.replacementRemainingDays || 0) > 0).length;

  // Drop Reasons Breakdown
  const dropReasonsMap: Record<string, number> = {};
  candidates.forEach((c) => {
    if (!c) return;
    const disp = c['Calling Disposition'] || '';
    const status = c['Interview Status'] || '';
    const subDisp = c['Sub-Disposition'] || '';
    if (
      disp === 'Not Interested' ||
      disp === 'Not Connected' ||
      status === 'Drop After Lineup' ||
      c['Selection Status'] === 'Rejected' ||
      c['Joining Status'] === 'Dropped'
    ) {
      const reason = subDisp || disp || status || 'Other';
      dropReasonsMap[reason] = (dropReasonsMap[reason] || 0) + 1;
    }
  });

  const dropReasons = Object.keys(dropReasonsMap)
    .map((reason) => ({ reason, count: dropReasonsMap[reason] }))
    .sort((a, b) => b.count - a.count);

  // Recruiter Leaderboard
  const hrMap: Record<string, { sourced: number; connected: number; interviews: number; selected: number; joined: number }> = {};
  candidates.forEach((c) => {
    if (!c) return;
    const hr = c['Assigned HR'] || 'Unassigned';
    if (!hrMap[hr]) {
      hrMap[hr] = { sourced: 0, connected: 0, interviews: 0, selected: 0, joined: 0 };
    }
    hrMap[hr].sourced += 1;
    if (c['Connect Status'] === 'Connect' || c['Calling Disposition'] === 'Connected' || c['Interview Date']) {
      hrMap[hr].connected += 1;
    }
    if (c['Interview Date'] && c['Interview Date'] !== '-') {
      hrMap[hr].interviews += 1;
    }
    if (c['Selection Status'] === 'Selected' || c['Joining Status'] === 'Joined') {
      hrMap[hr].selected += 1;
    }
    if (c['Joining Status'] === 'Joined') {
      hrMap[hr].joined += 1;
    }
  });

  const leaderboard = Object.keys(hrMap)
    .map((hrName) => ({
      hrName,
      ...hrMap[hrName]
    }))
    .sort((a, b) => b.joined - a.joined || b.selected - a.selected);

  // Client Breakdown
  const clientMap: Record<string, number> = {};
  candidates.forEach((c) => {
    if (!c) return;
    const cl = c['Client Name'] || 'Unassigned';
    clientMap[cl] = (clientMap[cl] || 0) + 1;
  });
  const clientBreakdown = Object.keys(clientMap)
    .map((client) => ({ client, count: clientMap[client] }))
    .sort((a, b) => b.count - a.count);

  // Source Breakdown
  const sourceMap: Record<string, number> = {};
  candidates.forEach((c) => {
    if (!c) return;
    const src = c['Source'] || 'Direct';
    sourceMap[src] = (sourceMap[src] || 0) + 1;
  });
  const sourceBreakdown = Object.keys(sourceMap)
    .map((source) => ({ source, count: sourceMap[source] }))
    .sort((a, b) => b.count - a.count);

  return {
    funnel: {
      sourced: totalSourced,
      connected,
      interested,
      interviewScheduled,
      interviewAttended,
      selected,
      joined
    },
    conversionRates: {
      sourcedToConnected: totalSourced ? Math.round((connected / totalSourced) * 100) : 0,
      connectedToInterested: connected ? Math.round((interested / connected) * 100) : 0,
      interestedToInterview: interested ? Math.round((interviewScheduled / interested) * 100) : 0,
      interviewToAttended: interviewScheduled ? Math.round((interviewAttended / interviewScheduled) * 100) : 0,
      attendedToSelected: interviewAttended ? Math.round((selected / interviewAttended) * 100) : 0,
      selectedToJoined: selected ? Math.round((joined / selected) * 100) : 0,
      overallConversion: totalSourced ? Math.round((joined / totalSourced) * 100) : 0
    },
    quickStats: {
      totalCandidates: totalSourced,
      callsToday: connected,
      interviewsToday: interviews.filter((i) => i?.timeBucket === 'Today').length,
      interviewsThisWeek: interviews.filter((i) => i?.timeBucket === 'This Week').length,
      selectionsThisMonth: selected,
      joiningsThisMonth: joined,
      totalRevenue,
      pendingInvoiceAmount: pendingRevenue,
      receivedRevenue
    },
    leaderboard,
    dropReasons,
    clientBreakdown,
    sourceBreakdown,

    // Backward-compatible properties
    totalSourced,
    connected,
    linedUp: interviewScheduled,
    attended: interviewAttended,
    selected,
    joined,
    interviewsToday: interviews.filter((i) => i?.timeBucket === 'Today').length,
    interviewsTomorrow: interviews.filter((i) => i?.timeBucket === 'Tomorrow').length,
    interviewsThisWeek: interviews.filter((i) => i?.timeBucket === 'This Week').length,
    overdueFollowups: interviews.filter((i) => i?.timeBucket === 'Overdue').length,
    pendingLeads: 0,
    totalRevenue,
    pendingRevenue,
    activeGuarantees
  };
}

// ==================== RBAC & USERS ====================

export async function getRBACOverviewFromFirestore(user: User): Promise<RBACOverview> {
  const firestore = requireDb();
  const snapshot = await getDocs(collection(firestore, 'users'));
  const users: RBACUser[] = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    users.push({
      user_id: data.user_id || docSnap.id,
      email: data.email || '',
      name: data.name || '',
      role: data.role || 'HR_RECRUITER',
      status: data.status || 'Active',
      must_change_password: Boolean(data.must_change_password),
      failed_attempts: data.failed_attempts || 0,
      locked_until: data.locked_until || '',
      last_login: data.last_login || '',
      password_updated_at: data.password_updated_at || '',
      password_updated_by: data.password_updated_by || ''
    });
  });

  const audits = await getAuditsFromFirestore();
  const securityAudits = audits.filter((a) => a['Action Type'] === 'SECURITY' || a['Candidate ID'] === 'AUTH');

  return {
    currentUser: user,
    users,
    audits: securityAudits,
    matrix: {},
    teamMappings: {
      'manager@novapulse.co.in': ['hr@novapulse.co.in', 'gjigyasa11@gmail.com']
    }
  };
}

// ==================== ONE-TIME MASTER DATA MIGRATION ====================

export async function importLocalDataToFirestore(user: User): Promise<{
  success: boolean;
  imported: Record<string, number>;
  message: string;
}> {
  const firestore = requireDb();

  // Load master dataset from Google Sheets export
  const master = MASTER_MIGRATION_DATA;

  // Check if there is also any legacy local db to merge
  let localStore: any = null;
  const rawData = localStorage.getItem('novapulse_local_db');
  if (rawData) {
    try {
      localStore = JSON.parse(rawData);
    } catch (e) {
      console.warn('Could not parse localStore:', e);
    }
  }

  const counts: Record<string, number> = {
    candidates: 0,
    openings: 0,
    clients: 0,
    joinings: 0,
    interviews: 0,
    leads: 0,
    hrs: 0,
    users: 0,
    dropdowns: 0
  };

  // Helper for batch commits (Firestore allows up to 500 writes per batch)
  const commitInChunks = async <T>(
    items: T[],
    getDocRefAndData: (item: T) => { ref: any; data: any } | null,
    chunkSize = 300
  ): Promise<number> => {
    let written = 0;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const batch = writeBatch(firestore);
      let batchCount = 0;
      for (const item of chunk) {
        const pair = getDocRefAndData(item);
        if (pair && pair.ref) {
          batch.set(pair.ref, pair.data, { merge: true });
          batchCount++;
        }
      }
      if (batchCount > 0) {
        await batch.commit();
        written += batchCount;
      }
    }
    return written;
  };

  // 1. Candidates (1,057 records from master dataset + local merges)
  const candidateMap = new Map<string, any>();
  if (Array.isArray(master.candidates)) {
    for (const c of master.candidates) {
      if (c && c['Candidate ID']) {
        candidateMap.set(c['Candidate ID'], { ...c });
      }
    }
  }
  if (localStore && Array.isArray(localStore.candidates)) {
    for (const c of localStore.candidates) {
      if (c && c['Candidate ID']) {
        const existing = candidateMap.get(c['Candidate ID']) || {};
        candidateMap.set(c['Candidate ID'], { ...existing, ...c });
      }
    }
  }
  const candidateList = Array.from(candidateMap.values());
  counts.candidates = await commitInChunks(
    candidateList,
    (c) => ({
      ref: doc(firestore, 'candidates', c['Candidate ID']),
      data: c
    })
  );

  // 2. Openings (15 records from master dataset + local merges)
  const openingMap = new Map<string, any>();
  if (Array.isArray(master.openings)) {
    for (const o of master.openings) {
      if (o && o['Opening ID']) {
        openingMap.set(o['Opening ID'], { ...o });
      }
    }
  }
  if (localStore && Array.isArray(localStore.openings)) {
    for (const o of localStore.openings) {
      if (o && o['Opening ID']) {
        const existing = openingMap.get(o['Opening ID']) || {};
        openingMap.set(o['Opening ID'], { ...existing, ...o });
      }
    }
  }
  const openingList = Array.from(openingMap.values());
  counts.openings = await commitInChunks(
    openingList,
    (o) => ({
      ref: doc(firestore, 'openings', o['Opening ID']),
      data: o
    })
  );

  // 3. Clients (21 records from master dataset + local merges)
  const clientMap = new Map<string, any>();
  if (Array.isArray(master.clients)) {
    for (const cl of master.clients) {
      if (cl && cl.clientId) {
        clientMap.set(cl.clientId, { ...cl });
      }
    }
  }
  if (localStore && Array.isArray(localStore.clients)) {
    for (const cl of localStore.clients) {
      if (cl && cl.clientId) {
        const existing = clientMap.get(cl.clientId) || {};
        clientMap.set(cl.clientId, { ...existing, ...cl });
      }
    }
  }
  const clientList = Array.from(clientMap.values());
  counts.clients = await commitInChunks(
    clientList,
    (cl) => ({
      ref: doc(firestore, 'clients', cl.clientId),
      data: cl
    })
  );

  // 4. Joinings (13 records from master dataset + local merges)
  const joiningMap = new Map<string, any>();
  if (Array.isArray(master.joinings)) {
    for (const j of master.joinings) {
      if (j && j.candidateId) {
        joiningMap.set(j.candidateId, { ...j });
      }
    }
  }
  if (localStore && Array.isArray(localStore.joinings)) {
    for (const j of localStore.joinings) {
      if (j && j.candidateId) {
        const existing = joiningMap.get(j.candidateId) || {};
        joiningMap.set(j.candidateId, { ...existing, ...j });
      }
    }
  }
  const joiningList = Array.from(joiningMap.values());
  counts.joinings = await commitInChunks(
    joiningList,
    (j) => ({
      ref: doc(firestore, 'joinings', j.candidateId),
      data: j
    })
  );

  // 5. Interviews (99 records from master dataset + local merges)
  const interviewMap = new Map<string, any>();
  if (Array.isArray(master.interviews)) {
    for (const i of master.interviews) {
      if (i && i.interviewId) {
        interviewMap.set(i.interviewId, { ...i });
      }
    }
  }
  if (localStore && Array.isArray(localStore.interviews)) {
    for (const i of localStore.interviews) {
      if (i && i.interviewId) {
        const existing = interviewMap.get(i.interviewId) || {};
        interviewMap.set(i.interviewId, { ...existing, ...i });
      }
    }
  }
  const interviewList = Array.from(interviewMap.values());
  counts.interviews = await commitInChunks(
    interviewList,
    (i) => ({
      ref: doc(firestore, 'interviews', i.interviewId),
      data: i
    })
  );

  // 6. Leads (2 records from master dataset + local merges)
  const leadMap = new Map<string, any>();
  if (Array.isArray(master.leads)) {
    for (const l of master.leads) {
      if (l && l['Lead ID']) {
        leadMap.set(l['Lead ID'], { ...l });
      }
    }
  }
  if (localStore && Array.isArray(localStore.leads)) {
    for (const l of localStore.leads) {
      if (l && l['Lead ID']) {
        const existing = leadMap.get(l['Lead ID']) || {};
        leadMap.set(l['Lead ID'], { ...existing, ...l });
      }
    }
  }
  const leadList = Array.from(leadMap.values());
  counts.leads = await commitInChunks(
    leadList,
    (l) => ({
      ref: doc(firestore, 'leads', l['Lead ID']),
      data: l
    })
  );

  // 7. HRs (2 records from master dataset + local merges)
  const hrMap = new Map<string, any>();
  if (Array.isArray(master.hrs)) {
    for (const h of master.hrs) {
      const docId = (h as any)['HR ID'] || (h as any).hrId;
      if (docId) {
        hrMap.set(docId, { ...h });
      }
    }
  }
  if (localStore && Array.isArray(localStore.hrs)) {
    for (const h of localStore.hrs) {
      const docId = h['HR ID'] || h.hrId || h.email;
      if (docId) {
        const existing = hrMap.get(docId) || {};
        hrMap.set(docId, { ...existing, ...h });
      }
    }
  }
  const hrList = Array.from(hrMap.values());
  counts.hrs = await commitInChunks(
    hrList,
    (h: any) => ({
      ref: doc(firestore, 'hrs', h['HR ID'] || h.hrId),
      data: h
    })
  );

  // 8. Users (Skip password_hash and salt completely)
  if (localStore && Array.isArray(localStore.users)) {
    for (const u of localStore.users) {
      const { password_hash, salt, ...safeUser } = u;
      const docId = safeUser.email || safeUser.user_id;
      if (docId) {
        await setDoc(
          doc(firestore, 'users', docId),
          {
            ...safeUser,
            importedAt: new Date().toISOString(),
            importedBy: user.email
          },
          { merge: true }
        );
        counts.users++;
      }
    }
  }

  // 9. Dropdowns
  const defaultDropdowns = await getDropdownsFromFirestore();
  counts.dropdowns = Object.keys(defaultDropdowns).length;

  // 10. Update ID Counters document (Highest candidate: 1158, next candidate: 1159)
  await setDoc(
    doc(firestore, 'config', 'counters'),
    {
      lastCandidateNum: 1158,
      nextCandidateId: 'NP-CAN-001159',
      updatedAt: serverTimestamp(),
      updatedBy: user.email
    },
    { merge: true }
  );

  // 11. Log audit entry
  await logAuditEntry({
    Timestamp: new Date().toLocaleString('en-GB'),
    'Candidate ID': 'SYSTEM',
    'Candidate Name': 'Master Database Migration',
    'Previous Value': 'Initial state',
    'New Value': `Imported ${counts.candidates} candidates, ${counts.clients} clients, ${counts.openings} openings, ${counts.joinings} joinings, ${counts.interviews} interviews, ${counts.leads} leads`,
    Action: 'DATA_IMPORT_COMPLETED',
    'Updated By': user.email,
    'HR Name': user.name,
    'Source Spreadsheet': 'FIRESTORE',
    'Action Type': 'SECURITY'
  });

  // Permanently delete novapulse_local_db from localStorage
  localStorage.removeItem('novapulse_local_db');

  return {
    success: true,
    imported: counts,
    message: `Master dataset successfully synchronized with Cloud Firestore! Migrated ${counts.candidates} candidates (NP-CAN-000043 to NP-CAN-001158), ${counts.clients} clients, ${counts.openings} openings, ${counts.joinings} joinings, ${counts.interviews} interviews, ${counts.leads} leads. Counter initialized: next Candidate ID is NP-CAN-001159.`
  };
}
