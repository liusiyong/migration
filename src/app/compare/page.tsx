'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import type { ComparisonResult, DiffLine, BotNode } from '@/lib/types';

type AppState = 'upload' | 'comparing' | 'results';

export default function ComparePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<AppState>('upload');
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...dropped]);
    setError(null);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selected]);
      setError(null);
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleCompare = async () => {
    if (files.length < 2) {
      setError('Please upload at least 2 bot files to compare.');
      return;
    }

    setState('comparing');
    setError(null);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || 'Upload failed');
      }

      const compareRes = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: files.map(f => f.name) }),
      });

      if (!compareRes.ok) {
        const data = await compareRes.json();
        throw new Error(data.error || 'Comparison failed');
      }

      const data = await compareRes.json();
      setResults(data.results);
      setActiveTab(0);
      setState('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setState('upload');
    }
  };

  const reset = () => {
    setFiles([]);
    setResults([]);
    setState('upload');
    setError(null);
    setActiveTab(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">RPA Migration</span>
          </Link>
          {state === 'results' && (
            <button onClick={reset} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              ← New Comparison
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {state === 'upload' && (
          <UploadSection
            files={files}
            error={error}
            onDrop={handleDrop}
            onFileInput={handleFileInput}
            onRemoveFile={removeFile}
            onCompare={handleCompare}
          />
        )}

        {state === 'comparing' && <LoadingSection />}

        {state === 'results' && (
          <ResultsSection
            results={results}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}
      </main>
    </div>
  );
}

// --- Upload Section ---

function UploadSection({
  files,
  error,
  onDrop,
  onFileInput,
  onRemoveFile,
  onCompare,
}: {
  files: File[];
  error: string | null;
  onDrop: (e: React.DragEvent) => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (i: number) => void;
  onCompare: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Compare Bot Files</h1>
        <p className="text-slate-600 dark:text-slate-400">Upload two or more Automation Anywhere bot files to generate a detailed comparison.</p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-12 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors bg-white dark:bg-slate-800/50 cursor-pointer"
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <svg className="w-12 h-12 mx-auto mb-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-1">
          Drop bot files here or click to browse
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-500">
          Supports AA bot JSON files
        </p>
        <input
          id="file-input"
          type="file"
          multiple
          className="hidden"
          onChange={onFileInput}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {files.length} file{files.length !== 1 ? 's' : ''} selected
          </h3>
          {files.map((file, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-200">{file.name}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveFile(i); }}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          <button
            onClick={onCompare}
            disabled={files.length < 2}
            className="w-full mt-4 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:cursor-not-allowed transition-colors"
          >
            Compare
          </button>
        </div>
      )}
    </div>
  );
}

// --- Loading ---

function LoadingSection() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
      <p className="text-lg font-medium text-slate-700 dark:text-slate-300">Analyzing and comparing bots...</p>
      <p className="text-sm text-slate-500 mt-1">This may take a moment for large files</p>
    </div>
  );
}

// --- Results with tabs ---

function ResultsSection({
  results,
  activeTab,
  onTabChange,
}: {
  results: ComparisonResult[];
  activeTab: number;
  onTabChange: (i: number) => void;
}) {
  const active = results[activeTab];

  return (
    <div>
      {/* Similarity Matrix */}
      {results.length > 1 && <SimilarityMatrix results={results} />}

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 mb-6 overflow-x-auto mt-6">
        <nav className="flex gap-1 -mb-px" aria-label="Comparison pairs">
          {results.map((r, i) => {
            const label = `${r.botAName.replace(/_bot$/, '')} vs ${r.botBName.replace(/_bot$/, '')}`;
            const isActive = i === activeTab;
            return (
              <button
                key={i}
                onClick={() => onTabChange(i)}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active pair diff */}
      {active && <DiffView result={active} />}
    </div>
  );
}

// --- Similarity Matrix ---

function SimilarityMatrix({ results }: { results: ComparisonResult[] }) {
  const [open, setOpen] = useState(true);
  const names = new Set<string>();
  for (const r of results) {
    names.add(r.botAName);
    names.add(r.botBName);
  }
  const nameList = Array.from(names);
  const lookup = new Map<string, number>();
  for (const r of results) {
    lookup.set(`${r.botAName}|${r.botBName}`, r.diffSummary.actionMatchRate);
    lookup.set(`${r.botBName}|${r.botAName}`, r.diffSummary.actionMatchRate);
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Action Match Rate Matrix</h2>
        <svg className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-2"></th>
                {nameList.map(name => (
                  <th key={name} className="p-2 text-slate-600 dark:text-slate-400 font-medium max-w-32 truncate" title={name}>
                    {name.replace(/_bot$/, '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nameList.map(rowName => (
                <tr key={rowName}>
                  <td className="p-2 font-medium text-slate-900 dark:text-slate-200 max-w-40 truncate" title={rowName}>
                    {rowName.replace(/_bot$/, '')}
                  </td>
                  {nameList.map(colName => {
                    if (rowName === colName) {
                      return <td key={colName} className="p-2 text-center text-slate-400">—</td>;
                    }
                    const val = lookup.get(`${rowName}|${colName}`);
                    const color = val !== undefined
                      ? val >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                        : val >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                      : '';
                    return (
                      <td key={colName} className="p-2 text-center">
                        <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${color}`}>
                          {val !== undefined ? `${val}%` : '—'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Diff View (image 3 style) ---

function DiffView({ result }: { result: ComparisonResult }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Title */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Action Compare: {result.botAName} vs {result.botBName}
        </h2>
      </div>

      {/* Legend */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Legend:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-600"></span>
            <span className="text-slate-700 dark:text-slate-300">Identical: <strong>{result.diffSummary.identical}</strong></span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300 dark:bg-amber-900/60 dark:border-amber-700"></span>
            <span className="text-slate-700 dark:text-slate-300">Modified: <strong>{result.diffSummary.modified}</strong></span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-red-100 border border-red-300 dark:bg-red-900/60 dark:border-red-700"></span>
            <span className="text-slate-700 dark:text-slate-300">Removed: <strong>{result.diffSummary.removed}</strong></span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-green-100 border border-green-300 dark:bg-green-900/60 dark:border-green-700"></span>
            <span className="text-slate-700 dark:text-slate-300">Added: <strong>{result.diffSummary.added}</strong></span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-purple-100 border border-purple-300 dark:bg-purple-900/60 dark:border-purple-700"></span>
            <span className="text-slate-700 dark:text-slate-300">Replaced: <strong>{result.diffSummary.replaced}</strong></span>
          </span>
        </div>
      </div>

      {/* Diff table */}
      <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
        <table className="w-full text-xs font-mono table-fixed">
          <colgroup>
            <col className="w-12" />
            <col />
            <col />
            <col className="w-28" />
          </colgroup>
          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 z-[1]">
            <tr>
              <th className="px-2 py-1.5 text-left text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">Line #</th>
              <th className="px-2 py-1.5 text-left text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">Bot A: {result.botAName}</th>
              <th className="px-2 py-1.5 text-left text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">Bot B: {result.botBName}</th>
              <th className="px-2 py-1.5 text-left text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {result.diffLines.map((line) => (
              <DiffRow key={line.lineNum} line={line} botAName={result.botAName} botBName={result.botBName} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function indentLevel(action: string): number {
  if (!action) return 0;
  const match = action.match(/^( *)/);
  return match ? Math.floor(match[1].length / 2) : 0;
}

function trimIndent(action: string): string {
  if (!action) return '';
  return action.replace(/^ +/, '');
}

function DiffRow({ line, botAName, botBName }: { line: DiffLine; botAName: string; botBName: string }) {
  const [expanded, setExpanded] = useState(false);

  const rowColors: Record<string, string> = {
    Identical: '',
    Modified: 'bg-amber-50 dark:bg-amber-950/30',
    Removed: 'bg-red-50 dark:bg-red-950/30',
    Added: 'bg-green-50 dark:bg-green-950/30',
    Replaced: 'bg-purple-50 dark:bg-purple-950/30',
  };

  const statusColors: Record<string, string> = {
    Identical: 'text-slate-500',
    Modified: 'text-amber-700 dark:text-amber-400',
    Removed: 'text-red-700 dark:text-red-400',
    Added: 'text-green-700 dark:text-green-400',
    Replaced: 'text-purple-700 dark:text-purple-400',
  };

  return (
    <>
      <tr
        className={`border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 ${rowColors[line.status] || ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-2 py-1 text-slate-400 text-right">{line.lineNum}</td>
        <td className="px-2 py-1 text-slate-800 dark:text-slate-200 break-words" style={{ paddingLeft: `${indentLevel(line.botAAction) * 16 + 8}px` }}>{trimIndent(line.botAAction)}</td>
        <td className="px-2 py-1 text-slate-800 dark:text-slate-200 break-words" style={{ paddingLeft: `${indentLevel(line.botBAction) * 16 + 8}px` }}>{trimIndent(line.botBAction)}</td>
        <td className={`px-2 py-1 font-medium ${statusColors[line.status] || ''}`}>{line.status}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-200 dark:border-slate-700">
          <td colSpan={4} className="p-0">
            <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700">
              <NodeJsonPanel node={line.botANode} label={botAName} />
              <NodeJsonPanel node={line.botBNode} label={botBName} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function NodeJsonPanel({ node, label }: { node?: BotNode | null; label: string }) {
  if (!node) {
    return (
      <div className="px-3 py-2 text-xs text-slate-400 italic">{label}: (no action)</div>
    );
  }

  // Strip children/branches for a cleaner single-node view
  const { children, branches, ...nodeWithout } = node;
  const display = {
    ...nodeWithout,
    ...(children && children.length > 0 ? { children: `[${children.length} children]` } : {}),
    ...(branches && branches.length > 0 ? { branches: `[${branches.length} branches]` } : {}),
  };

  return (
    <div className="px-3 py-2">
      <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 font-sans">{label}</div>
      <pre className="text-[10px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
        {JSON.stringify(display, null, 2)}
      </pre>
    </div>
  );
}
