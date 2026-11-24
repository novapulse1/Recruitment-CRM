/**
 * NovaPulse CRM - CSV Import Standard Schema & Column Mapping Definitions
 */

export interface StandardFieldDef {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

export const STANDARD_FIELDS: StandardFieldDef[] = [
  {
    key: 'Candidate Name',
    label: 'Candidate Name',
    required: true,
    aliases: ['candidatename', 'name', 'fullname', 'candidate']
  },
  {
    key: 'Mobile Number',
    label: 'Mobile Number',
    required: true,
    aliases: ['mobilenumber', 'mobile', 'phone', 'phonenumber', 'contact', 'contactnumber', 'primarymobile']
  },
  {
    key: 'Alternate Mobile',
    label: 'Alternate Mobile',
    aliases: ['alternatemobile', 'alternatephone', 'altmobile', 'altphone', 'secondarymobile', 'secondaryphone', 'otherphone']
  },
  {
    key: 'Email ID',
    label: 'Email ID',
    aliases: ['emailid', 'email', 'mail', 'emailaddress', 'e-mail']
  },
  {
    key: 'Designation Applied',
    label: 'Designation Applied',
    aliases: ['designationapplied', 'designation', 'role', 'position', 'jobrole', 'profile', 'appliedfor']
  },
  {
    key: 'Current Location',
    label: 'Current Location',
    aliases: ['currentlocation', 'location', 'city', 'currentcity', 'residence']
  },
  {
    key: 'Experience',
    label: 'Experience',
    aliases: ['experience', 'exp', 'totalexp', 'totalexperience', 'workexp', 'workexperience', 'yrsofexp']
  },
  {
    key: 'Current Salary',
    label: 'Current Salary',
    aliases: ['currentsalary', 'currentctc', 'ctc', 'presentsalary', 'salary']
  },
  {
    key: 'Expected Salary',
    label: 'Expected Salary',
    aliases: ['expectedsalary', 'expectedctc', 'ectc', 'expctc']
  },
  {
    key: 'Notice Period',
    label: 'Notice Period',
    aliases: ['noticeperiod', 'notice', 'np', 'noticeperioddays']
  },
  {
    key: 'Source',
    label: 'Source',
    aliases: ['source', 'candidatesource', 'portal', 'leadsource', 'channel']
  },
  {
    key: 'Client Name',
    label: 'Client Name',
    aliases: ['clientname', 'client', 'company', 'companyname', 'organization']
  },
  {
    key: 'Assigned HR',
    label: 'Assigned HR',
    aliases: ['assignedhr', 'hr', 'recruiter', 'assignedrecruiter', 'hrname', 'recruitername']
  },
  {
    key: 'Pipeline Stage',
    label: 'Pipeline Stage',
    aliases: ['pipelinestage', 'stage', 'status', 'candidatestatus', 'pipelinestatus']
  },
  {
    key: 'Remarks',
    label: 'Remarks',
    aliases: ['remarks', 'notes', 'comments', 'feedback', 'remark']
  },
  {
    key: 'Industry',
    label: 'Industry',
    aliases: ['industry', 'domain', 'sector']
  }
];
