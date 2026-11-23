/**
 * NovaPulse Hiring CRM - TypeScript Types
 * Accurately models the exact schema of each tab in the recruitment database
 * and central RBAC user and permission representations.
 */

export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'ADMIN' 
  | 'RECRUITMENT_MANAGER' 
  | 'HR_RECRUITER' 
  | 'FINANCE' 
  | 'DENIED' 
  | 'HR'; // alias for HR_RECRUITER backwards compatibility

export interface User {
  authenticated: boolean;
  user_id?: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: string[];
  teamRecruiterEmails?: string[];
  hrId?: string;
  canEditAll?: boolean;
  editableFields?: string[] | null;
  assignedCandidateCount?: string | number;
  must_change_password?: boolean;
  failed_attempts?: number;
  locked_until?: string;
  isLocked?: boolean;
  last_login?: string;
  token?: string;
  error?: string;
}

export interface RBACUser {
  user_id?: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  must_change_password?: boolean;
  failed_attempts?: number;
  locked_until?: string;
  isLocked?: boolean;
  last_login?: string;
  password_updated_at?: string;
  password_updated_by?: string;
  teamRecruiterEmails?: string[];
}

export interface RBACOverview {
  users: RBACUser[];
  rolePermissions: Record<string, string[]>;
  allPermissions: Record<string, string>;
  teamMapping: Record<string, string[]>;
  rbacEnabled: boolean;
}

export interface Candidate {
  _rowIndex?: number;
  'Candidate ID': string;
  'Entry Date': string;
  'Candidate Name': string;
  'Mobile Number': string;
  'Alternate Mobile': string;
  'Email ID': string;
  'Designation Applied': string;
  'Current Location': string;
  'Experience': string;
  'Current Salary': string;
  'Expected Salary': string;
  'Notice Period': string;
  'Source': string;
  'Client Name': string;
  'Assigned HR': string;
  'HR Email': string;
  'Connect Status': string;
  'Calling Disposition': string;
  'Sub-Disposition': string;
  'Call Status': string;
  'Interview Status': string;
  'Interview Date': string;
  'Selection Status': string;
  'Joining Status': string;
  'Joining Date': string;
  'Remarks': string;
  'Created By': string;
  'Last Updated': string;
  'Last Updated By': string;
  'Record Version': string | number;
  'Pipeline Stage': string;
  'Duplicate Of': string;
  'Record Status': string;
  'Industry': string;
  [key: string]: any;
}

export interface Opening {
  _rowIndex?: number;
  'Opening ID': string;
  'Status': 'Open' | 'Closed' | 'Hold' | string;
  'Posted On': string;
  'Position / Role': string;
  'Client Name': string;
  'Job Location (City)': string;
  'Office / Interview Address': string;
  'Skills Required': string;
  'Qualification': string;
  'Experience Required': string;
  'Salary Slab (₹ / month)': string;
  'No. of Vacancies': string | number;
  'Shift / Timings': string;
  'Working Days': string;
  'Interview Mode / Process': string;
  'Other Details / Perks': string;
  'Last Updated': string;
}

export interface Client {
  _rowIndex?: number;
  clientId: string;
  clientName: string;
  status: string;
  feeType: string;
  feeValue: string;
  invoiceAfterDays: string | number;
  replacementPeriodDays: string | number;
  gstPercent: string | number;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  billingAddress: string;
  agreementNotes: string;
  addedOn: string;
  industry: string;
  hiringStatus: string;
  payrollType: string;
  agreement: string;
  clientRank: string;
  gstNo: string;
  secondaryPOCName: string;
  secondaryPOCNumber: string;
  remarks: string;
  activeOpeningsCount?: number;
  linedUpCount?: number;
  selectedCount?: number;
  joinedCount?: number;
}

export interface JoiningRecord {
  _rowIndex?: number;
  candidateId: string;
  candidateName: string;
  clientName: string;
  designation: string;
  assignedHR: string;
  joiningDate: string;
  annualCtc: string | number;
  feeType: string;
  feeValue: string | number;
  daysCompleted: number;
  invoiceDueDate: string;
  replacementEnds: string;
  invoiceAmount: string | number;
  employmentStatus: string;
  exitDate: string;
  earlyExitDecision: string;
  invoiceStatus: 'Pending' | 'Invoiced' | 'Paid' | 'Overdue' | string;
  invoiceNo: string;
  invoiceDate: string;
  paymentReceivedOn: string;
  replacementCandidateId: string;
  billingStatus: string;
  replacementStatus: string;
  remarks: string;
  daysUntilInvoiceDue?: number;
  invoiceDueSoon?: boolean;
  replacementRemainingDays?: number;
}

export interface InterviewItem {
  candidateId: string;
  candidateName: string;
  mobile: string;
  designation: string;
  clientName: string;
  assignedHR: string;
  hrEmail: string;
  interviewDate: string;
  interviewStatus: string;
  timeBucket: 'Today' | 'Tomorrow' | 'This Week' | 'Overdue' | 'Upcoming' | 'Past';
  rescheduleCount?: number;
  rescheduleFlag?: string;
  remarks?: string;
}

export interface LeadItem {
  _rowIndex?: number;
  'Lead ID': string;
  'Received': string;
  'Submitted By HR': string;
  'Request Type': string;
  'Candidate Name': string;
  'Mobile Number': string;
  'Alternate Mobile': string;
  'Email ID': string;
  'Designation': string;
  'Location': string;
  'Experience': string;
  'Current Salary': string;
  'Expected Salary': string;
  'Notice Period': string;
  'Source': string;
  'Client Name': string;
  'Remarks': string;
  'Duplicate Of': string;
  'Duplicate With HR': string;
  'Status': 'Pending' | 'Approved' | 'Rejected' | 'Merged' | string;
  'Decision': string;
  'Admin Note': string;
  'Processed By': string;
  'Processed At': string;
  'Candidate ID': string;
  'Industry': string;
  'Assign To HR': string;
}

export interface HRRecord {
  'HR ID': string;
  'HR Name': string;
  'HR Email': string;
  'HR Spreadsheet ID': string;
  'HR Spreadsheet URL': string;
  'Active Status': 'Active' | 'Inactive' | string;
  'Registration Date': string;
  'Last Sync': string;
  'Assigned Candidate Count': string | number;
  'Sharing Status': string;
  'Sync Mode': string;
}

export interface AuditLogEntry {
  'Timestamp': string;
  'Candidate ID': string;
  'Candidate Name': string;
  'Previous Value': string;
  'New Value': string;
  'Action': string;
  'Updated By': string;
  'HR Name': string;
  'Source Spreadsheet': string;
  'Action Type': string;
}

export interface DuplicateLogEntry {
  'Timestamp': string;
  'Candidate ID (new/incoming)': string;
  'Candidate Name': string;
  'Matched Candidate ID': string;
  'Matched Candidate Name': string;
  'Match Type': string;
  'Matched Value': string;
  'Detected By': string;
  'Decision': string;
  'Reviewed By': string;
  'Review Date': string;
  'Notes': string;
}

export interface DropdownOption {
  List: string;
  Option: string;
  'Parent Disposition'?: string;
  'Call Status'?: string;
  Active: string;
  System: string;
}

export interface DashboardMetrics {
  funnel: {
    sourced: number;
    connected: number;
    interested: number;
    interviewScheduled: number;
    interviewAttended: number;
    selected: number;
    joined: number;
  };
  conversionRates: {
    sourcedToConnected: number;
    connectedToInterested: number;
    interestedToInterview: number;
    interviewToAttended: number;
    attendedToSelected: number;
    selectedToJoined: number;
    overallConversion: number;
  };
  quickStats: {
    totalCandidates: number;
    callsToday: number;
    interviewsToday: number;
    interviewsThisWeek: number;
    selectionsThisMonth: number;
    joiningsThisMonth: number;
    totalRevenue: number;
    pendingInvoiceAmount: number;
    receivedRevenue: number;
  };
  leaderboard: Array<{
    hrName: string;
    sourced: number;
    connected: number;
    interviews: number;
    selected: number;
    joined: number;
  }>;
  dropReasons: Array<{
    reason: string;
    count: number;
  }>;
  clientBreakdown: Array<{
    client: string;
    count: number;
  }>;
  sourceBreakdown: Array<{
    source: string;
    count: number;
  }>;
}
