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
  'Sourced',
  'Connected',
  'Interested',
  'Interview Scheduled',
  'Interview Attended',
  'Interview Rescheduled',
  'Selected',
  'On Hold',
  'Rejected',
  'Joined',
  'Dropped / Not Joined'
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number];
