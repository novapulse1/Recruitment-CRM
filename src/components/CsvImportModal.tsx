import React, { useState, useEffect, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Search,
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import type { Candidate, Client, User } from '../types';
import { PIPELINE_STAGES, type PipelineStage } from '../config';
import { api } from '../services/api';
import { normalizePhoneNumber } from '../utils/formatters';

export interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  existingCandidates: Candidate[];
  clients?: Client[];
  uniqueHRs?: string[];
  onSuccess: () => void;
}

// 16 Standard Candidate Fields for CSV Mapping
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
    aliases: ['candidatename', 'name', 'fullname', 'candidate', 'candidatename']
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

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';
type DuplicateStrategy = 'skip' | 'update' | 'hold';

interface ParsedRowValidation {
  rowIndex: number;
  raw: Record<string, any>;
  extracted: Partial<Candidate>;
  normalizedPhone: string;
  status: 'Ready' | 'Duplicate' | 'Error';
  errorMessages: string[];
  duplicateMatch?: Candidate;
  duplicateReason?: string;
  unknownClient?: string;
  unknownHR?: string;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  existingCandidates = [],
  clients = [],
  uniqueHRs = [],
  onSuccess
}) => {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRawData, setCsvRawData] = useState<Record<string, any>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({}); // CSV Header -> Standard Field Key
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip');
  const [clientRemaps, setClientRemaps] = useState<Record<string, string>>({}); // Unknown Client Name -> Master Client Name / ''

  // Preview filtering & search
  const [previewFilter, setPreviewFilter] = useState<'all' | 'ready' | 'duplicate' | 'error'>('all');
  const [previewSearch, setPreviewSearch] = useState('');

  // Execution & Progress
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; percent: number }>({
    current: 0,
    total: 0,
    percent: 0
  });
  const [importResult, setImportResult] = useState<{
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    failedCount: number;
    errors: { id?: string; error: string }[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setFile(null);
      setCsvHeaders([]);
      setCsvRawData([]);
      setColumnMapping({});
      setDuplicateStrategy('skip');
      setClientRemaps({});
      setPreviewFilter('all');
      setPreviewSearch('');
      setImportProgress({ current: 0, total: 0, percent: 0 });
      setImportResult(null);
    }
  }, [isOpen]);

  // Keyboard Escape listener and scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'importing') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose, step]);

  // Available client names for validation and dropdowns
  const availableClientNames = useMemo(() => {
    return Array.from(new Set(clients.map((c) => c.clientName).filter(Boolean))).sort();
  }, [clients]);

  // Client ID lookup map
  const clientNameToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach((c) => {
      if (c.clientName) {
        map.set(c.clientName.toLowerCase().trim(), c.clientId);
      }
    });
    return map;
  }, [clients]);

  // Download Sample CSV Template with UTF-8 BOM
  const handleDownloadTemplate = () => {
    const headers = STANDARD_FIELDS.map((f) => f.key);
    const sampleRow1 = [
      'Aakash Sharma',
      '9876543210',
      '9876543211',
      'aakash.sharma@example.com',
      'Software Engineer',
      'Bengaluru',
      '3 Years',
      '₹ 6,00,000',
      '₹ 9,00,000',
      '30 Days',
      'LinkedIn',
      availableClientNames[0] || 'NovaPulse Tech',
      uniqueHRs[0] || 'Anshu',
      'Assigned – Not Called',
      'Experienced in React and Node.js',
      'IT & Software'
    ];
    const sampleRow2 = [
      'Pooja Verma',
      '9123456780',
      '',
      'pooja.verma@example.com',
      'HR Specialist',
      'Mumbai',
      '5 Years',
      '₹ 8,00,000',
      '₹ 12,00,000',
      'Immediate',
      'Naukri',
      availableClientNames[1] || 'Apex Solutions',
      uniqueHRs[1] || 'Jigyasha',
      'Unassigned',
      'Immediate joiner with recruitment experience',
      'HR & Operations'
    ];

    const escapeVal = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csvContent =
      '\uFEFF' +
      [
        headers.map(escapeVal).join(','),
        sampleRow1.map(escapeVal).join(','),
        sampleRow2.map(escapeVal).join(',')
      ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'NovaPulse_Candidate_Import_Template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Auto-match CSV headers to Standard Fields
  const autoDetectMapping = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {};
    const usedStandardFields = new Set<string>();

    headers.forEach((header) => {
      const cleanHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');

      for (const field of STANDARD_FIELDS) {
        if (usedStandardFields.has(field.key)) continue;

        const cleanKey = field.key.toLowerCase().replace(/[^a-z0-9]/g, '');
        const isDirectMatch = cleanHeader === cleanKey;
        const isAliasMatch = field.aliases.some(
          (alias) => cleanHeader === alias.replace(/[^a-z0-9]/g, '')
        );

        if (isDirectMatch || isAliasMatch) {
          mapping[header] = field.key;
          usedStandardFields.add(field.key);
          break;
        }
      }
    });

    return mapping;
  };

  // File Upload & Parse
  const handleFileUpload = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      alert('Please upload a valid .csv file.');
      return;
    }

    setFile(selectedFile);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const rows = (results.data as Record<string, any>[]).filter((r) => {
          return Object.values(r).some((val) => String(val || '').trim().length > 0);
        });

        if (rows.length === 0) {
          alert('The uploaded CSV file is empty.');
          return;
        }

        if (rows.length > 5000) {
          alert(`File has ${rows.length} rows. Maximum 5,000 rows supported at once. Please split your file.`);
          return;
        }

        const headers = results.meta.fields || (rows[0] ? Object.keys(rows[0]) : []);
        setCsvHeaders(headers);
        setCsvRawData(rows);

        const initialMapping = autoDetectMapping(headers);
        setColumnMapping(initialMapping);

        setStep('mapping');
      },
      error: (err) => {
        alert('Failed to parse CSV: ' + err.message);
      }
    });
  };

  // Validation: Check if Candidate Name and Mobile Number are mapped
  const mappingIsValid = useMemo(() => {
    const mappedValues = Object.values(columnMapping);
    const hasName = mappedValues.includes('Candidate Name');
    const hasMobile = mappedValues.includes('Mobile Number');
    return hasName && hasMobile;
  }, [columnMapping]);

  // Preview & Row Validation Computation
  const validatedRows: ParsedRowValidation[] = useMemo(() => {
    if (step !== 'preview' && step !== 'importing' && step !== 'complete') {
      return [];
    }

    // Lookup caches for duplicate detection
    const phoneMap = new Map<string, Candidate>();
    const emailMap = new Map<string, Candidate>();

    existingCandidates.forEach((c) => {
      const p1 = normalizePhoneNumber(c['Mobile Number']);
      if (p1 && p1.length === 10) phoneMap.set(p1, c);

      const p2 = normalizePhoneNumber(c['Alternate Mobile']);
      if (p2 && p2.length === 10) phoneMap.set(p2, c);

      const em = c['Email ID']?.toLowerCase().trim();
      if (em) emailMap.set(em, c);
    });

    // In-file duplicate trackers
    const seenFilePhones = new Map<string, number>();
    const seenFileEmails = new Map<string, number>();

    return csvRawData.map((rawRow, idx) => {
      const extracted: Partial<Candidate> = {};
      Object.entries(columnMapping).forEach(([csvCol, stdField]) => {
        if (stdField && stdField !== '__SKIP__') {
          const val = rawRow[csvCol];
          if (val !== undefined && val !== null) {
            extracted[stdField as keyof Candidate] = String(val).trim();
          }
        }
      });

      const errors: string[] = [];
      const candName = extracted['Candidate Name'] || '';
      const rawMobile = extracted['Mobile Number'] || '';
      const rawAltMobile = extracted['Alternate Mobile'] || '';
      const rawEmail = (extracted['Email ID'] || '').toLowerCase().trim();

      // 1. Required field: Candidate Name
      if (!candName.trim()) {
        errors.push('Missing Candidate Name');
      }

      // 2. Required field: Mobile Number & 10-digit validation
      const normMobile = normalizePhoneNumber(rawMobile);
      if (!rawMobile.trim()) {
        errors.push('Missing Mobile Number');
      } else if (normMobile.length !== 10 || !/^[6-9]\d{9}$/.test(normMobile)) {
        errors.push(`Invalid 10-digit Mobile: "${rawMobile}"`);
      }

      // 3. Alternate Mobile validation (if provided)
      const normAltMobile = normalizePhoneNumber(rawAltMobile);
      if (rawAltMobile.trim() && (normAltMobile.length !== 10 || !/^[6-9]\d{9}$/.test(normAltMobile))) {
        errors.push(`Invalid 10-digit Alternate Mobile: "${rawAltMobile}"`);
      }

      // 4. Duplicate Check (Existing DB + In-file)
      let duplicateMatch: Candidate | undefined = undefined;
      let duplicateReason: string | undefined = undefined;

      if (normMobile.length === 10) {
        if (phoneMap.has(normMobile)) {
          duplicateMatch = phoneMap.get(normMobile);
          duplicateReason = `Mobile matches existing candidate ${duplicateMatch?.['Candidate ID']} (${duplicateMatch?.['Candidate Name']})`;
        } else if (seenFilePhones.has(normMobile)) {
          duplicateReason = `Duplicate mobile inside uploaded file (same as row #${seenFilePhones.get(normMobile)! + 1})`;
        }
      }

      if (!duplicateMatch && rawEmail) {
        if (emailMap.has(rawEmail)) {
          duplicateMatch = emailMap.get(rawEmail);
          duplicateReason = `Email matches existing candidate ${duplicateMatch?.['Candidate ID']} (${duplicateMatch?.['Candidate Name']})`;
        } else if (seenFileEmails.has(rawEmail)) {
          duplicateReason = `Duplicate email inside uploaded file (same as row #${seenFileEmails.get(rawEmail)! + 1})`;
        }
      }

      // Track in-file phones & emails
      if (normMobile.length === 10 && !seenFilePhones.has(normMobile)) {
        seenFilePhones.set(normMobile, idx);
      }
      if (rawEmail && !seenFileEmails.has(rawEmail)) {
        seenFileEmails.set(rawEmail, idx);
      }

      // 5. Client validation & remap check
      let rawClient = extracted['Client Name'] || '';
      let unknownClient: string | undefined = undefined;
      if (rawClient) {
        const remapped = clientRemaps[rawClient];
        if (remapped !== undefined) {
          rawClient = remapped;
          extracted['Client Name'] = remapped;
        }

        if (rawClient && !availableClientNames.includes(rawClient)) {
          unknownClient = rawClient;
        }
      }

      // 6. HR validation
      const rawHR = extracted['Assigned HR'] || '';
      let unknownHR: string | undefined = undefined;
      if (rawHR && uniqueHRs.length > 0 && !uniqueHRs.includes(rawHR)) {
        unknownHR = rawHR;
      }

      // 7. Pipeline Stage resolution
      let stage = extracted['Pipeline Stage'];
      if (!stage || !PIPELINE_STAGES.includes(stage as PipelineStage)) {
        if (rawHR) {
          stage = 'Assigned – Not Called';
        } else {
          stage = 'Unassigned';
        }
      }
      extracted['Pipeline Stage'] = stage;

      // Determine Status
      let status: 'Ready' | 'Duplicate' | 'Error' = 'Ready';
      if (errors.length > 0) {
        status = 'Error';
      } else if (duplicateMatch || duplicateReason) {
        status = 'Duplicate';
      }

      return {
        rowIndex: idx,
        raw: rawRow,
        extracted,
        normalizedPhone: normMobile,
        status,
        errorMessages: errors,
        duplicateMatch,
        duplicateReason,
        unknownClient,
        unknownHR
      };
    });
  }, [
    step,
    csvRawData,
    columnMapping,
    existingCandidates,
    availableClientNames,
    uniqueHRs,
    clientRemaps
  ]);

  // Statistics
  const counts = useMemo(() => {
    let ready = 0;
    let duplicate = 0;
    let error = 0;
    validatedRows.forEach((r) => {
      if (r.status === 'Ready') ready++;
      else if (r.status === 'Duplicate') duplicate++;
      else if (r.status === 'Error') error++;
    });
    return {
      total: validatedRows.length,
      ready,
      duplicate,
      error
    };
  }, [validatedRows]);

  // List of unique unknown clients detected across the file
  const unknownClientsDetected = useMemo(() => {
    const set = new Set<string>();
    validatedRows.forEach((r) => {
      if (r.unknownClient) set.add(r.unknownClient);
    });
    return Array.from(set).sort();
  }, [validatedRows]);

  // Filtered rows for the preview table
  const displayedRows = useMemo(() => {
    return validatedRows.filter((r) => {
      if (previewFilter === 'ready' && r.status !== 'Ready') return false;
      if (previewFilter === 'duplicate' && r.status !== 'Duplicate') return false;
      if (previewFilter === 'error' && r.status !== 'Error') return false;

      if (previewSearch.trim()) {
        const q = previewSearch.toLowerCase();
        const name = (r.extracted['Candidate Name'] || '').toLowerCase();
        const phone = (r.extracted['Mobile Number'] || '').toLowerCase();
        const email = (r.extracted['Email ID'] || '').toLowerCase();
        const client = (r.extracted['Client Name'] || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !email.includes(q) && !client.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [validatedRows, previewFilter, previewSearch]);

  // Calculate import plan
  const importPlan = useMemo(() => {
    const toCreate: Candidate[] = [];
    const toUpdate: { candidateId: string; patch: Partial<Candidate> }[] = [];
    let skippedCount = 0;

    validatedRows.forEach((row) => {
      if (row.status === 'Error') {
        skippedCount++;
        return;
      }

      if (row.status === 'Duplicate') {
        if (duplicateStrategy === 'skip') {
          skippedCount++;
          return;
        }

        if (duplicateStrategy === 'update') {
          if (row.duplicateMatch?.['Candidate ID']) {
            const patch: Partial<Candidate> = {};
            Object.entries(row.extracted).forEach(([k, v]) => {
              if (v !== undefined && v !== '' && k !== 'Candidate ID') {
                (patch as any)[k] = v;
              }
            });

            // Associate clientId if known
            if (patch['Client Name']) {
              const cId = clientNameToIdMap.get(patch['Client Name'].toLowerCase().trim());
              if (cId) (patch as any).clientId = cId;
            }

            patch['Record Version'] = Number(row.duplicateMatch['Record Version'] || 1) + 1;
            toUpdate.push({
              candidateId: row.duplicateMatch['Candidate ID'],
              patch
            });
          } else {
            skippedCount++;
          }
          return;
        }

        if (duplicateStrategy === 'hold') {
          const candidateData: Partial<Candidate> = {
            ...row.extracted,
            'Pipeline Stage': 'DUPLICATE HOLD',
            'Duplicate Of': row.duplicateMatch?.['Candidate ID'] || 'Existing Match',
            Remarks: [
              row.extracted.Remarks,
              `[Imported as Duplicate of ${row.duplicateMatch?.['Candidate ID'] || 'record'}]`
            ]
              .filter(Boolean)
              .join(' | ')
          };

          if (candidateData['Client Name']) {
            const cId = clientNameToIdMap.get(candidateData['Client Name'].toLowerCase().trim());
            if (cId) (candidateData as any).clientId = cId;
          }

          toCreate.push(candidateData as Candidate);
          return;
        }
      }

      // Ready status
      if (row.status === 'Ready') {
        const candidateData: Partial<Candidate> = {
          ...row.extracted,
          'Mobile Number': row.normalizedPhone || row.extracted['Mobile Number']!
        };

        if (candidateData['Client Name']) {
          const cId = clientNameToIdMap.get(candidateData['Client Name'].toLowerCase().trim());
          if (cId) (candidateData as any).clientId = cId;
        }

        toCreate.push(candidateData as Candidate);
      }
    });

    return {
      toCreate,
      toUpdate,
      skippedCount,
      totalToProcess: toCreate.length + toUpdate.length
    };
  }, [validatedRows, duplicateStrategy, clientNameToIdMap]);

  // Execute Import
  const handleExecuteImport = async () => {
    if (importPlan.totalToProcess === 0) {
      alert('No valid candidates to import.');
      return;
    }

    setStep('importing');
    setImportProgress({ current: 0, total: importPlan.totalToProcess, percent: 0 });

    try {
      // 1. Request candidate IDs in ONE collision-safe atomic transaction
      let allocatedIds: string[] = [];
      if (importPlan.toCreate.length > 0) {
        allocatedIds = await api.reserveCandidateIds(importPlan.toCreate.length);
        if (allocatedIds.length !== importPlan.toCreate.length) {
          throw new Error(
            `Failed to allocate enough Candidate IDs. Expected ${importPlan.toCreate.length}, received ${allocatedIds.length}.`
          );
        }

        // Assign reserved sequential IDs
        importPlan.toCreate.forEach((cand, idx) => {
          cand['Candidate ID'] = allocatedIds[idx];
        });
      }

      // 2. Perform batched writes (<= 400 per batch) with retries
      const result = await api.bulkImportCandidates(
        importPlan.toCreate,
        importPlan.toUpdate,
        (progress) => {
          setImportProgress(progress);
        }
      );

      setImportResult({
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        skippedCount: importPlan.skippedCount,
        failedCount: result.failedCount,
        errors: result.failedErrors
      });

      setStep('complete');
    } catch (err: any) {
      alert('Import failed: ' + err.message);
      setStep('preview');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Import Candidates from CSV</h2>
              <p className="text-xs text-muted-foreground">
                Bulk upload, column mapping, live duplicate checking and collision-safe Firestore import
              </p>
            </div>
          </div>

          {/* Stepper indicator */}
          <div className="hidden md:flex items-center gap-2 text-xs font-medium">
            <span
              className={`px-2.5 py-1 rounded-full ${
                step === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              1. Upload
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span
              className={`px-2.5 py-1 rounded-full ${
                step === 'mapping' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              2. Map
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span
              className={`px-2.5 py-1 rounded-full ${
                step === 'preview' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              3. Validate
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span
              className={`px-2.5 py-1 rounded-full ${
                step === 'importing' || step === 'complete'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              4. Import
            </span>
          </div>

          <button
            onClick={onClose}
            disabled={step === 'importing'}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6 py-4">
              <div className="text-center max-w-lg mx-auto space-y-2">
                <h3 className="text-base font-semibold text-foreground">Choose a CSV file to upload</h3>
                <p className="text-xs text-muted-foreground">
                  Supports .csv files up to 5,000 rows. If you don't have a template ready, download the
                  standard NovaPulse format below.
                </p>
                <div className="pt-2">
                  <button
                    onClick={handleDownloadTemplate}
                    type="button"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5 text-primary" />
                    Download Sample CSV Template
                  </button>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mx-auto max-w-xl border-2 border-dashed border-border hover:border-primary/60 rounded-2xl p-10 text-center cursor-pointer bg-muted/20 hover:bg-muted/40 transition-all flex flex-col items-center justify-center space-y-3"
              >
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <FileText className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Click to browse or drag & drop your CSV file here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">.csv format only, max 5,000 records</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                  }}
                />
              </div>

              {/* Guidelines Info Card */}
              <div className="max-w-xl mx-auto rounded-xl border border-border/80 bg-muted/30 p-4 text-xs space-y-2 text-muted-foreground">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-primary" />
                  Import Specifications
                </div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <strong>Required Columns:</strong> Candidate Name and Mobile Number.
                  </li>
                  <li>
                    <strong>Mobile Number:</strong> Must be 10 digits (e.g. 9876543210). Leading zeros or country
                    codes (+91) will be cleanly normalized.
                  </li>
                  <li>
                    <strong>Sequential IDs:</strong> IDs are generated atomically from the official counter starting
                    after historical max (1158+).
                  </li>
                  <li>
                    <strong>Duplicates:</strong> Cross-referenced automatically against phone, alternate phone, and
                    email.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/30 p-3 rounded-xl border border-border">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Map CSV Columns to Candidate Fields
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {csvRawData.length} records detected from <span className="font-mono">{file?.name}</span>
                  </div>
                </div>
                {!mappingIsValid && (
                  <div className="text-xs text-rose-500 font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Candidate Name and Mobile Number must be mapped.
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">CSV Column in File</th>
                      <th className="py-2.5 px-4 font-semibold">Sample Data (Row 1)</th>
                      <th className="py-2.5 px-4 font-semibold">Maps to NovaPulse Field</th>
                      <th className="py-2.5 px-4 font-semibold w-24">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {csvHeaders.map((header) => {
                      const sampleVal = csvRawData[0]?.[header];
                      const currentMapped = columnMapping[header] || '';
                      const isMapped = currentMapped && currentMapped !== '__SKIP__';
                      const stdField = STANDARD_FIELDS.find((f) => f.key === currentMapped);

                      return (
                        <tr key={header} className="hover:bg-muted/30">
                          <td className="py-3 px-4 font-semibold text-foreground">{header}</td>
                          <td className="py-3 px-4 text-muted-foreground font-mono text-[11px] truncate max-w-xs">
                            {sampleVal !== undefined && sampleVal !== '' ? String(sampleVal) : <em>(empty)</em>}
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={currentMapped || '__SKIP__'}
                              onChange={(e) => {
                                const val = e.target.value;
                                setColumnMapping((prev) => ({
                                  ...prev,
                                  [header]: val === '__SKIP__' ? '' : val
                                }));
                              }}
                              className="w-full sm:w-64 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <option value="__SKIP__">-- Skip Column (Do Not Import) --</option>
                              {STANDARD_FIELDS.map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label} {f.required ? '(Required)' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            {isMapped ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  stdField?.required
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                    : 'bg-primary/10 text-primary'
                                }`}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                {stdField?.required ? 'Required' : 'Mapped'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                                Skipped
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATE */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary Stats Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border border-border bg-card shadow-sm">
                  <div className="text-[11px] text-muted-foreground">Total Rows</div>
                  <div className="text-xl font-bold text-foreground">{counts.total}</div>
                </div>
                <div className="p-3 rounded-xl border border-emerald-300/40 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm">
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Ready to Import</div>
                  <div className="text-xl font-bold text-emerald-800 dark:text-emerald-300">{counts.ready}</div>
                </div>
                <div className="p-3 rounded-xl border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm">
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">Duplicate Matches</div>
                  <div className="text-xl font-bold text-amber-800 dark:text-amber-300">{counts.duplicate}</div>
                </div>
                <div className="p-3 rounded-xl border border-rose-300/40 bg-rose-50/50 dark:bg-rose-950/20 shadow-sm">
                  <div className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">Validation Errors</div>
                  <div className="text-xl font-bold text-rose-800 dark:text-rose-300">{counts.error}</div>
                </div>
              </div>

              {/* Duplicate Resolution Strategy Banner */}
              {counts.duplicate > 0 && (
                <div className="rounded-xl border border-amber-300/50 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    {counts.duplicate} duplicate candidate(s) detected. Choose how to handle duplicates:
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                    <label
                      className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                        duplicateStrategy === 'skip'
                          ? 'border-amber-500 bg-amber-100/60 dark:bg-amber-900/40 font-semibold text-amber-900 dark:text-amber-100'
                          : 'border-border bg-card/60 hover:bg-card text-foreground'
                      }`}
                    >
                      <input
                        type="radio"
                        name="dupStrategy"
                        value="skip"
                        checked={duplicateStrategy === 'skip'}
                        onChange={() => setDuplicateStrategy('skip')}
                        className="mt-0.5 text-primary"
                      />
                      <div>
                        <div>Skip Duplicates (Default)</div>
                        <div className="text-[11px] text-muted-foreground font-normal">
                          Leave existing records untouched.
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                        duplicateStrategy === 'update'
                          ? 'border-amber-500 bg-amber-100/60 dark:bg-amber-900/40 font-semibold text-amber-900 dark:text-amber-100'
                          : 'border-border bg-card/60 hover:bg-card text-foreground'
                      }`}
                    >
                      <input
                        type="radio"
                        name="dupStrategy"
                        value="update"
                        checked={duplicateStrategy === 'update'}
                        onChange={() => setDuplicateStrategy('update')}
                        className="mt-0.5 text-primary"
                      />
                      <div>
                        <div>Update Existing Records</div>
                        <div className="text-[11px] text-muted-foreground font-normal">
                          Merge CSV fields into existing candidate and bump version.
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                        duplicateStrategy === 'hold'
                          ? 'border-amber-500 bg-amber-100/60 dark:bg-amber-900/40 font-semibold text-amber-900 dark:text-amber-100'
                          : 'border-border bg-card/60 hover:bg-card text-foreground'
                      }`}
                    >
                      <input
                        type="radio"
                        name="dupStrategy"
                        value="hold"
                        checked={duplicateStrategy === 'hold'}
                        onChange={() => setDuplicateStrategy('hold')}
                        className="mt-0.5 text-primary"
                      />
                      <div>
                        <div>Import as DUPLICATE HOLD</div>
                        <div className="text-[11px] text-muted-foreground font-normal">
                          Generate new ID, set stage to DUPLICATE HOLD.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Unknown Client Name Bulk Re-mapper */}
              {unknownClientsDetected.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    Unrecognized Clients Detected ({unknownClientsDetected.length}):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {unknownClientsDetected.map((uClient) => (
                      <div key={uClient} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border">
                        <span className="font-semibold truncate max-w-[150px]">{uClient}</span>
                        <select
                          value={clientRemaps[uClient] ?? uClient}
                          onChange={(e) => {
                            const val = e.target.value;
                            setClientRemaps((prev) => ({
                              ...prev,
                              [uClient]: val
                            }));
                          }}
                          className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                        >
                          <option value={uClient}>Keep as "{uClient}"</option>
                          <option value="">Leave blank</option>
                          {availableClientNames.map((cName) => (
                            <option key={cName} value={cName}>
                              Map to: {cName}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter Tabs & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted border border-border text-xs">
                  <button
                    onClick={() => setPreviewFilter('all')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      previewFilter === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All ({counts.total})
                  </button>
                  <button
                    onClick={() => setPreviewFilter('ready')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      previewFilter === 'ready' ? 'bg-card text-emerald-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Ready ({counts.ready})
                  </button>
                  <button
                    onClick={() => setPreviewFilter('duplicate')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      previewFilter === 'duplicate' ? 'bg-card text-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Duplicates ({counts.duplicate})
                  </button>
                  <button
                    onClick={() => setPreviewFilter('error')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      previewFilter === 'error' ? 'bg-card text-rose-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Errors ({counts.error})
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search preview rows..."
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground w-full sm:w-64"
                  />
                </div>
              </div>

              {/* Data Table */}
              <div className="rounded-xl border border-border overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted text-muted-foreground border-b border-border sticky top-0 z-10">
                    <tr>
                      <th className="py-2 px-3 font-semibold w-12">#</th>
                      <th className="py-2 px-3 font-semibold w-24">Status</th>
                      <th className="py-2 px-3 font-semibold">Candidate Name</th>
                      <th className="py-2 px-3 font-semibold">Mobile Number</th>
                      <th className="py-2 px-3 font-semibold">Client</th>
                      <th className="py-2 px-3 font-semibold">Assigned HR</th>
                      <th className="py-2 px-3 font-semibold">Stage</th>
                      <th className="py-2 px-3 font-semibold">Validation Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayedRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-muted-foreground">
                          No rows match the filter criteria.
                        </td>
                      </tr>
                    ) : (
                      displayedRows.map((row) => (
                        <tr
                          key={row.rowIndex}
                          className={`hover:bg-muted/20 ${
                            row.status === 'Error'
                              ? 'bg-rose-50/20 dark:bg-rose-950/10'
                              : row.status === 'Duplicate'
                              ? 'bg-amber-50/20 dark:bg-amber-950/10'
                              : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-muted-foreground font-mono">{row.rowIndex + 1}</td>
                          <td className="py-2 px-3">
                            {row.status === 'Ready' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" />
                                Ready
                              </span>
                            )}
                            {row.status === 'Duplicate' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                <AlertTriangle className="h-3 w-3" />
                                Duplicate
                              </span>
                            )}
                            {row.status === 'Error' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                                <XCircle className="h-3 w-3" />
                                Error
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-semibold text-foreground">
                            {row.extracted['Candidate Name'] || <em className="text-rose-500">(missing)</em>}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px]">
                            {row.normalizedPhone || row.extracted['Mobile Number'] || (
                              <em className="text-rose-500">(missing)</em>
                            )}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {row.extracted['Client Name'] || '-'}
                            {row.unknownClient && (
                              <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                (Unknown)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{row.extracted['Assigned HR'] || '-'}</td>
                          <td className="py-2 px-3 text-muted-foreground">{row.extracted['Pipeline Stage'] || '-'}</td>
                          <td className="py-2 px-3 text-[11px]">
                            {row.errorMessages.length > 0 && (
                              <span className="text-rose-600 dark:text-rose-400 font-medium">
                                {row.errorMessages.join(', ')}
                              </span>
                            )}
                            {row.duplicateReason && (
                              <span className="text-amber-700 dark:text-amber-300">
                                {row.duplicateReason}
                              </span>
                            )}
                            {row.status === 'Ready' && <span className="text-muted-foreground">Ready for import</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: IMPORTING IN PROGRESS */}
          {step === 'importing' && (
            <div className="py-12 text-center max-w-md mx-auto space-y-4">
              <div className="flex justify-center">
                <RefreshCw className="h-10 w-10 text-primary animate-spin" />
              </div>
              <h3 className="text-base font-bold text-foreground">Importing Candidates to Firestore...</h3>
              <p className="text-xs text-muted-foreground">
                Reserving sequential candidate IDs and writing atomic batches (≤ 400 records per batch) with
                automatic retry handling.
              </p>

              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden border border-border">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${importProgress.percent}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-muted-foreground font-mono">
                <span>
                  {importProgress.current} / {importProgress.total} processed
                </span>
                <span>{importProgress.percent}%</span>
              </div>
            </div>
          )}

          {/* STEP 5: IMPORT COMPLETE */}
          {step === 'complete' && importResult && (
            <div className="py-8 max-w-lg mx-auto text-center space-y-6">
              <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">Import Complete!</h3>
                <p className="text-xs text-muted-foreground">
                  The candidates have been processed and synced directly with Cloud Firestore.
                </p>
              </div>

              {/* Results Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                <div className="p-3 rounded-xl border border-emerald-300/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Created</div>
                  <div className="text-xl font-bold text-emerald-800 dark:text-emerald-300">
                    {importResult.createdCount}
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-blue-300/40 bg-blue-50/50 dark:bg-blue-950/20">
                  <div className="text-[11px] text-blue-700 dark:text-blue-400 font-medium">Updated</div>
                  <div className="text-xl font-bold text-blue-800 dark:text-blue-300">
                    {importResult.updatedCount}
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">Skipped</div>
                  <div className="text-xl font-bold text-amber-800 dark:text-amber-300">
                    {importResult.skippedCount}
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-rose-300/40 bg-rose-50/50 dark:bg-rose-950/20">
                  <div className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">Failed</div>
                  <div className="text-xl font-bold text-rose-800 dark:text-rose-300">
                    {importResult.failedCount}
                  </div>
                </div>
              </div>

              {/* Error messages if any */}
              {importResult.errors.length > 0 && (
                <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/30 text-left text-xs text-rose-800 dark:text-rose-200">
                  <div className="font-semibold mb-1">Batch Errors:</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {importResult.errors.map((e, idx) => (
                      <li key={idx}>
                        <strong>{e.id}:</strong> {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/20">
          <div>
            {step === 'mapping' && (
              <button
                onClick={() => setStep('upload')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Upload
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={() => setStep('mapping')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Mapping
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step !== 'importing' && step !== 'complete' && (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                Cancel
              </button>
            )}

            {step === 'mapping' && (
              <button
                onClick={() => setStep('preview')}
                disabled={!mappingIsValid}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                Proceed to Preview & Validate
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}

            {step === 'preview' && (
              <button
                onClick={handleExecuteImport}
                disabled={importPlan.totalToProcess === 0}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                <UploadCloud className="h-4 w-4" />
                Import {importPlan.totalToProcess} Candidate{importPlan.totalToProcess === 1 ? '' : 's'}
              </button>
            )}

            {step === 'complete' && (
              <button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                Done & View Candidates
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
