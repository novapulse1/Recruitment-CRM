/**
 * NovaPulse Hiring CRM - Central Configuration
 * Contains Spreadsheet IDs, Tab Names, Row offsets, and Header Names.
 * Nothing should be hard-coded across components.
 */

export const APP_CONFIG = {
  BRAND_NAME: 'NovaPulse',
  TAGLINE: 'Recruitment & Staffing CRM',
  LIVE_SPREADSHEET_ID: '11j17e5RTG0uLTXg41f_AfKMqAUtGCDXV2DusZ8Muq58',
  DEV_SPREADSHEET_ID: '162bNBPeryLIJ-M6yBt8uSK3YbKc8tN3qP1DkF4PwAd0',
  DEFAULT_API_URL: import.meta.env.VITE_API_URL || '',
  TIMEZONE: 'Asia/Kolkata',
  CURRENCY_SYMBOL: '₹'
};

export const TABS = {
  MASTER_DATA: 'MASTER DATA',
  OPENINGS: 'OPENINGS',
  CLIENT_MASTER: 'CLIENT MASTER',
  JOINING_TRACKER: 'JOINING TRACKER',
  INTERVIEW_LOG: 'INTERVIEW LOG',
  RESCHEDULE_TRACKER: 'RESCHEDULE TRACKER',
  LEAD_APPROVALS: 'LEAD APPROVALS',
  HR_REGISTRY: 'HR REGISTRY',
  AUDIT_LOG: 'AUDIT LOG',
  DUPLICATE_LOG: 'DUPLICATE LOG',
  CONFIGURATION: 'CONFIGURATION',
  SYNC_QUEUE: 'SYNC QUEUE',
  CONFLICT_QUEUE: 'CONFLICT QUEUE',
  DROPDOWN_LISTS: 'DROPDOWN LISTS',
  MANAGEMENT_DASHBOARD: 'MANAGEMENT DASHBOARD',
  DASHBOARD: 'DASHBOARD',
  INTERVIEW_REPORT: 'INTERVIEW REPORT',
  JOINING_REPORT: 'JOINING REPORT',
  CANDIDATE_SEARCH: 'CANDIDATE SEARCH',
  ACCESS_CONTROL_REPORT: 'ACCESS CONTROL REPORT',
  DASH_DATA: '_DASH DATA',
  SYNC_STATE: '_SYNC STATE',
  FORM_RESPONSES: 'FORM RESPONSES (RAW)',
  SYNC_LOG: 'SYNC LOG'
} as const;

export const TAB_OFFSETS = {
  [TABS.OPENINGS]: {
    headerRow: 4,
    dataStartRow: 5
  },
  default: {
    headerRow: 1,
    dataStartRow: 2
  }
};

export const HEADERS = {
  MASTER_DATA: [
    'Candidate ID',
    'Entry Date',
    'Candidate Name',
    'Mobile Number',
    'Alternate Mobile',
    'Email ID',
    'Designation Applied',
    'Current Location',
    'Experience',
    'Current Salary',
    'Expected Salary',
    'Notice Period',
    'Source',
    'Client Name',
    'Assigned HR',
    'HR Email',
    'Connect Status',
    'Calling Disposition',
    'Sub-Disposition',
    'Call Status',
    'Interview Status',
    'Interview Date',
    'Selection Status',
    'Joining Status',
    'Joining Date',
    'Remarks',
    'Created By',
    'Last Updated',
    'Last Updated By',
    'Record Version',
    'Pipeline Stage',
    'Duplicate Of',
    'Record Status',
    'Industry'
  ] as const,

  OPENINGS: [
    'Opening ID',
    'Status',
    'Posted On',
    'Position / Role',
    'Client Name',
    'Job Location (City)',
    'Office / Interview Address',
    'Skills Required',
    'Qualification',
    'Experience Required',
    'Salary Slab (₹ / month)',
    'No. of Vacancies',
    'Shift / Timings',
    'Working Days',
    'Interview Mode / Process',
    'Other Details / Perks',
    'Last Updated'
  ] as const,

  CLIENT_MASTER: [
    'Client ID',
    'Client Name',
    'Status',
    'Fee Type',
    'Fee Value',
    'Invoice After Joining (Days)',
    'Replacement Period (Days)',
    'GST %',
    'Contact Person',
    'Contact Email',
    'Contact Phone',
    'Billing Address',
    'Agreement Notes',
    'Added On',
    'Industry',
    'Hiring Status',
    'Payroll Type',
    'Agreement',
    'Client Rank',
    'GST No',
    'Secondary POC Name',
    'Secondary POC Number',
    'Remarks'
  ] as const,

  JOINING_TRACKER: [
    'Candidate ID',
    'Candidate Name',
    'Client Name',
    'Designation',
    'Assigned HR',
    'Joining Date',
    'Annual CTC',
    'Fee Type',
    'Fee Value',
    'Invoice After (Days)',
    'Replacement Period (Days)',
    'Days Completed',
    'Invoice Due Date',
    'Replacement Ends',
    'Invoice Amount',
    'Employment Status',
    'Exit Date',
    'Early Exit Decision',
    'Invoice Status',
    'Invoice No',
    'Invoice Date',
    'Payment Received On',
    'Replacement Candidate ID',
    'Billing Status',
    'Replacement Status',
    'Remarks',
    'System Note'
  ] as const,

  INTERVIEW_LOG: [
    'Logged At',
    'Candidate ID',
    'Candidate Name',
    'Assigned HR',
    'Event',
    'From Date',
    'Interview Date',
    'Attempt #',
    'Changed By'
  ] as const,

  RESCHEDULE_TRACKER: [
    'Candidate ID',
    'Candidate Name',
    'Assigned HR',
    'First Scheduled For',
    'Current Interview Date',
    'Reschedule Count',
    'Interview Status',
    'Last Change',
    'Flag',
    'Last Status (system)'
  ] as const,

  LEAD_APPROVALS: [
    'Lead ID',
    'Received',
    'Submitted By HR',
    'Request Type',
    'Candidate Name',
    'Mobile Number',
    'Alternate Mobile',
    'Email ID',
    'Designation',
    'Location',
    'Experience',
    'Current Salary',
    'Expected Salary',
    'Notice Period',
    'Source',
    'Client Name',
    'Remarks',
    'Duplicate Of',
    'Duplicate With HR',
    'Status',
    'Decision',
    'Admin Note',
    'Processed By',
    'Processed At',
    'Candidate ID',
    'Industry',
    'Assign To HR'
  ] as const,

  HR_REGISTRY: [
    'HR ID',
    'HR Name',
    'HR Email',
    'HR Spreadsheet ID',
    'HR Spreadsheet URL',
    'Active Status',
    'Registration Date',
    'Last Sync',
    'Assigned Candidate Count',
    'Sharing Status',
    'Sync Mode'
  ] as const,

  AUDIT_LOG: [
    'Timestamp',
    'Candidate ID',
    'Candidate Name',
    'Previous Value',
    'New Value',
    'Action',
    'Updated By',
    'HR Name',
    'Source Spreadsheet',
    'Action Type'
  ] as const,

  DUPLICATE_LOG: [
    'Timestamp',
    'Candidate ID (new/incoming)',
    'Candidate Name',
    'Matched Candidate ID',
    'Matched Candidate Name',
    'Match Type',
    'Matched Value',
    'Detected By',
    'Decision',
    'Reviewed By',
    'Review Date',
    'Notes'
  ] as const,

  DROPDOWN_LISTS: [
    'List',
    'Option',
    'Parent Disposition',
    'Call Status',
    'Active',
    'System'
  ] as const
};

export const PIPELINE_STAGES = [
  'Unassigned',
  'Assigned – Not Called',
  'Interested',
  'Callback',
  'Not Reachable',
  'Not Interested / Closed',
  'Interview Scheduled',
  'Interview Attended',
  'Interview No Show',
  'Selected – Joining Pending',
  'Joined',
  'On Hold',
  'Rejected',
  'Dropped / Not Joined',
  'DUPLICATE HOLD'
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number];

export interface StageDefinition {
  id: PipelineStage;
  label: string;
  category: 'sourcing' | 'contact' | 'interview' | 'offer' | 'joined' | 'drop' | 'hold';
  color: string;
  badgeClass: string;
}

export const STAGE_DEFINITIONS: Record<PipelineStage, StageDefinition> = {
  'Unassigned': {
    id: 'Unassigned',
    label: 'Unassigned',
    category: 'sourcing',
    color: '#64748b',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700'
  },
  'Assigned – Not Called': {
    id: 'Assigned – Not Called',
    label: 'Assigned – Not Called',
    category: 'sourcing',
    color: '#3b82f6',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300 dark:border-blue-800'
  },
  'Interested': {
    id: 'Interested',
    label: 'Interested',
    category: 'contact',
    color: '#06b6d4',
    badgeClass: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
  },
  'Callback': {
    id: 'Callback',
    label: 'Callback',
    category: 'contact',
    color: '#f59e0b',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-800'
  },
  'Not Reachable': {
    id: 'Not Reachable',
    label: 'Not Reachable',
    category: 'contact',
    color: '#ea580c',
    badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300 dark:border-orange-800'
  },
  'Not Interested / Closed': {
    id: 'Not Interested / Closed',
    label: 'Not Interested / Closed',
    category: 'drop',
    color: '#ef4444',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-300 dark:border-rose-800'
  },
  'Interview Scheduled': {
    id: 'Interview Scheduled',
    label: 'Interview Scheduled',
    category: 'interview',
    color: '#8b5cf6',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300 dark:border-purple-800'
  },
  'Interview Attended': {
    id: 'Interview Attended',
    label: 'Interview Attended',
    category: 'interview',
    color: '#6366f1',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
  },
  'Interview No Show': {
    id: 'Interview No Show',
    label: 'Interview No Show',
    category: 'drop',
    color: '#dc2626',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-800'
  },
  'Selected – Joining Pending': {
    id: 'Selected – Joining Pending',
    label: 'Selected – Joining Pending',
    category: 'offer',
    color: '#10b981',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
  },
  'Joined': {
    id: 'Joined',
    label: 'Joined',
    category: 'joined',
    color: '#059669',
    badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border-teal-300 dark:border-teal-800'
  },
  'On Hold': {
    id: 'On Hold',
    label: 'On Hold',
    category: 'hold',
    color: '#d97706',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-800'
  },
  'Rejected': {
    id: 'Rejected',
    label: 'Rejected',
    category: 'drop',
    color: '#e11d48',
    badgeClass: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300 border-pink-300 dark:border-pink-800'
  },
  'Dropped / Not Joined': {
    id: 'Dropped / Not Joined',
    label: 'Dropped / Not Joined',
    category: 'drop',
    color: '#991b1b',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-300 dark:border-rose-800'
  },
  'DUPLICATE HOLD': {
    id: 'DUPLICATE HOLD',
    label: 'DUPLICATE HOLD',
    category: 'hold',
    color: '#b45309',
    badgeClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-300 dark:border-yellow-800'
  }
};
