import React, { useState, useEffect } from 'react';
import { Search, X, User, Phone, Mail, Building, Briefcase } from 'lucide-react';
import type { Candidate } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: Candidate[];
  onSelectCandidate: (candidateId: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  candidates = [],
  onSelectCandidate
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        // toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = query.trim()
    ? (candidates || []).filter((c) => {
        const q = query.toLowerCase();
        return (
          c['Candidate ID']?.toLowerCase().includes(q) ||
          c['Candidate Name']?.toLowerCase().includes(q) ||
          c['Mobile Number']?.includes(q) ||
          c['Email ID']?.toLowerCase().includes(q) ||
          c['Client Name']?.toLowerCase().includes(q) ||
          c['Designation Applied']?.toLowerCase().includes(q)
        );
      }).slice(0, 10)
    : (candidates || []).slice(0, 8);

  const handleSelect = (id: string) => {
    onSelectCandidate(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <input
            autoFocus
            type="text"
            placeholder="Search by candidate ID, name, mobile, email, or client..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full py-4 bg-transparent text-sm sm:text-base outline-none text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-border/50">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No matching candidates found for "{query}".
            </div>
          ) : (
            filtered.map((c, i) => (
              <div
                key={c['Candidate ID']}
                onClick={() => handleSelect(c['Candidate ID'])}
                className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                  i === selectedIndex ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                    {c['Candidate Name'] ? c['Candidate Name'].slice(0, 2).toUpperCase() : 'CAN'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{c['Candidate Name']}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono font-medium">
                        {c['Candidate ID']}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" /> {c['Designation Applied'] || 'N/A'}
                      </span>
                      {c['Client Name'] && (
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" /> {c['Client Name']}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {c['Mobile Number']}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-medium">
                    {c['Pipeline Stage'] || 'Sourced'}
                  </span>
                  <div className="text-[11px] text-muted-foreground mt-1">HR: {c['Assigned HR'] || 'Unassigned'}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-muted/30 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Navigate with arrows, Enter to view profile</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
};
