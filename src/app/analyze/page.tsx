'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import type { AnalysisResult } from '@/lib/types';

type AppState = 'upload' | 'analyzing' | 'results';

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<AppState>('upload');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) { setFile(dropped); setError(null); }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) { setFile(selected); setError(null); }
  }, []);

  const handleAnalyze = async () => {
    if (!file) return;
    setState('analyzing');
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setResult(data.result);
      setState('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setState('upload');
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setState('upload');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">RPA Migration</span>
          </Link>
          {state === 'results' && (
            <button onClick={reset} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              ← New Analysis
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {state === 'upload' && (
          <UploadSection
            file={file}
            error={error}
            onDrop={handleDrop}
            onFileInput={handleFileInput}
            onAnalyze={handleAnalyze}
            onClear={() => setFile(null)}
          />
        )}
        {state === 'analyzing' && <LoadingSection />}
        {state === 'results' && result && <ResultsSection result={result} />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload Section
// ---------------------------------------------------------------------------

function UploadSection({
  file,
  error,
  onDrop,
  onFileInput,
  onAnalyze,
  onClear,
}: {
  file: File | null;
  error: string | null;
  onDrop: (e: React.DragEvent) => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyze: () => void;
  onClear: () => void;
}) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Analyze Bot</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Upload an Automation Anywhere bot JSON file to generate a detailed analysis report.
        </p>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !file && document.getElementById('analyze-file-input')?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors bg-white dark:bg-slate-800/50 ${
          file
            ? 'border-blue-400 dark:border-blue-500'
            : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer'
        }`}
      >
        {!file ? (
          <>
            <svg className="w-12 h-12 mx-auto mb-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-1">
              Drop bot file here or click to browse
            </p>
            <p className="text-sm text-slate-500">Supports AA bot JSON files</p>
          </>
        ) : (
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="ml-3 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <input id="analyze-file-input" type="file" className="hidden" onChange={onFileInput} />
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {file && (
        <button
          onClick={onAnalyze}
          className="w-full mt-4 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors"
        >
          Analyze
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function LoadingSection() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
      <p className="text-lg font-medium text-slate-700 dark:text-slate-300">Analyzing bot...</p>
      <p className="text-sm text-slate-500 mt-1">This may take a moment for large files</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function ResultsSection({ result }: { result: AnalysisResult }) {
  const statusColor =
    result.parseStatus === 'OK'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
      : result.parseStatus === 'PARTIAL'
      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Section title="Overview">
        <MetricTable
          rows={[
            { label: 'Bot Name', value: result.botName },
            {
              label: 'Parse Status',
              value: (
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${statusColor}`}>
                  {result.parseStatus}
                </span>
              ),
            },
          ]}
        />
        {result.parseWarnings.length > 0 && (
          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
            {result.parseWarnings.join('; ')}
          </div>
        )}
      </Section>

      {/* A. Bot Size */}
      <Section title="A. Bot Size Indicators">
        <MetricTable
          rows={[
            { label: 'Total Actions', value: result.totalActions, help: 'Total number of non-disabled action nodes in the bot workflow. This is the primary measure of bot size.' },
            { label: 'Total Nodes', value: result.totalNodes, help: 'Total number of all nodes in the bot (including disabled ones).' },
            { label: 'Subtask / Child Bot Calls', value: result.subtaskCalls, help: 'Number of TaskBot.CallBot actions — calls to other bots from within this bot.' },
            { label: 'Packages Referenced', value: result.packagesReferenced, help: 'Number of distinct AA command packages declared in the bot\'s dependency list (e.g., Excel_MS, String, File).' },
          ]}
        />
      </Section>

      {/* B. Control-Flow */}
      <Section title="B. Control-Flow Complexity">
        <MetricTable
          rows={[
            { label: 'IF / ELSE Conditions', value: result.ifElseConditions, help: 'Total number of if and elseIf decision branches in the bot.' },
            { label: 'Max IF Nesting', value: result.maxIfNesting, help: 'Deepest level of nested IF statements (e.g., 3 means an IF inside an IF inside an IF).' },
            { label: 'SWITCH / CASE Branches', value: result.switchCaseBranches, help: 'Number of switch/case constructs (rare in A360; usually modeled as if/elseIf chains).' },
            { label: 'Loops', value: result.loops, help: 'Total number of loop constructs (loop.commands.start) — includes for-each, while, and count-based loops.' },
            { label: 'Max Loop Nesting', value: result.maxLoopNesting, help: 'Deepest level of nested loops.' },
            { label: 'TRY / CATCH Blocks', value: result.tryCatchBlocks, help: 'Number of try error-handling blocks.' },
            { label: 'FINALLY Blocks', value: result.finallyBlocks, help: 'Number of finally blocks (execute regardless of success/failure).' },
          ]}
        />
      </Section>

      {/* C. Variables */}
      <Section title="C. Variable and Data Complexity">
        <MetricTable
          rows={[
            { label: 'Total Variables', value: result.totalVariables, help: 'Total number of variables declared in the bot.' },
            { label: 'Input Variables', value: result.inputVariables, help: 'Variables marked as input — they receive values from a calling bot or trigger.' },
            { label: 'Output Variables', value: result.outputVariables, help: 'Variables marked as output — they return values to a calling bot.' },
            { label: 'Global / Shared Variables', value: result.globalVariables, help: 'Variables marked as both input and output, acting as shared/global data.' },
            { label: 'Table / List Variables', value: result.tableListVariables, help: 'Variables of type TABLE or LIST — structured collections.' },
            { label: 'Dictionary / Complex Variables', value: result.complexVariables, help: 'Variables of type DICTIONARY, RECORD, or ANY — complex/nested data structures.' },
          ]}
        />
      </Section>

      {/* D. UI Automation */}
      <Section title="D. UI Automation Indicators">
        <MetricTable
          rows={[
            { label: 'Recorder / UI Actions', value: result.uiActions, help: 'Total actions from UI-related packages (Recorder, Screen, Mouse, Keystrokes, Window, ImageRecognition, OCR, Clipboard).' },
            { label: 'Web Automation Actions', value: result.webAutomationActions, help: 'Actions from Browser and Web packages — interactions with web pages/browsers.' },
            { label: 'Desktop UI Actions', value: result.desktopUiActions, help: 'Actions from desktop-specific packages (Recorder, Screen, Mouse, Window).' },
            { label: 'Object Clone Actions', value: result.objectCloneActions, help: 'Number of Recorder.capture actions — object-cloning / selector-based UI captures.' },
            { label: 'Keystroke Actions', value: result.keystrokeActions, help: 'Number of Keystrokes.Keystrokes actions — simulated keyboard input.' },
            { label: 'Mouse Click Actions', value: result.mouseClickActions, help: 'Number of Mouse.click or Mouse.moveTo actions.' },
            { label: 'Coordinate-Based Actions', value: result.coordinateBasedActions, help: 'Actions that rely on screen coordinates rather than element selectors. High values increase fragility.' },
            { label: 'Wait / Delay Steps', value: result.waitDelaySteps, help: 'Number of Delay.delay actions — explicit pauses/synchronization waits.' },
            { label: 'Image Recognition Actions', value: result.imageRecognitionActions, help: 'Number of image-based UI element detection actions. These have no direct PAD equivalent.' },
            { label: 'OCR Actions', value: result.ocrActions, help: 'Number of OCR (optical character recognition) actions.' },
          ]}
        />
      </Section>

      {/* E. Application Integration */}
      <Section title="E. Application and Integration Indicators">
        <MetricTable
          rows={[
            { label: 'Distinct Applications', value: result.distinctApplications, help: 'Number of distinct application/system categories the bot interacts with (e.g., Excel, Email, Browser, Database, FileSystem, XML, API).' },
            { label: 'Browser Actions', value: result.browserActions, help: 'Total actions involving browser/web packages.' },
            { label: 'Excel Actions', value: result.excelActions, help: 'Total actions from the Excel_MS package (open, read, write, navigate, save, close).' },
            { label: 'Email Actions', value: result.emailActions, help: 'Total actions from the Email package (connect, send, receive, move, close).' },
            { label: 'PDF Actions', value: result.pdfActions, help: 'Total actions from the PDF package (extract text, merge, etc.).' },
            { label: 'File / Folder Actions', value: result.fileFolderActions, help: 'Total actions from File, CsvTxt, and LogToFile packages.' },
            { label: 'Database Actions', value: result.databaseActions, help: 'Total actions from the Database package (connect, query, insert/update/delete, disconnect).' },
            { label: 'API / Web Service Calls', value: result.apiWebServiceCalls, help: 'Total actions from REST or SOAP packages.' },
            { label: 'CMD Invocations', value: result.cmdInvocations, help: 'Number of command-line/terminal invocations detected.' },
            { label: 'External App Launches', value: result.externalAppLaunches, help: 'Number of Application.runApp actions that launch external programs.' },
            { label: 'Credential Vault Lookups', value: result.credentialVaultLookups, help: 'Number of credential vault retrieval actions.' },
            { label: 'Network / Share Accesses', value: result.networkShareAccesses, help: 'Number of network-related actions (FTP operations) plus detected UNC path references.' },
            { label: 'Integration Count', value: result.integrationCount, help: 'Count of distinct application/system categories touched. A quick proxy for integration breadth.' },
            { label: 'External Dependency Count', value: result.externalDependencyCount, help: 'Sum of external integrations requiring runtime connectivity: API calls + Database + DLL + External launches + all embedded scripts.' },
          ]}
        />
      </Section>

      {/* F. Non-Standard / Migration-Risk */}
      <Section title="F. Non-Standard / Migration-Risk Indicators">
        <MetricTable
          rows={[
            { label: 'Custom DLL References', value: result.customDllReferences, help: 'Number of actions from the DLL package — custom .NET/COM DLL invocations. These require redesign for PAD.' },
            { label: 'VBScript Embeds', value: result.vbscriptEmbeds, help: 'Number of embedded VBScript script-run actions.' },
            { label: 'JavaScript Embeds', value: result.javascriptEmbeds, help: 'Number of embedded JavaScript script-run actions.' },
            { label: 'Python Script Embeds', value: result.pythonEmbeds, help: 'Number of embedded Python script-run actions.' },
            { label: 'PowerShell Embeds', value: result.powershellEmbeds, help: 'Number of embedded PowerShell script-run actions.' },
            { label: 'Batch Script Embeds', value: result.batchScriptEmbeds, help: 'Number of other embedded script actions (batch/shell).' },
            { label: 'Custom Packages', value: result.customPackages, help: 'Number of non-standard/custom AA packages detected.' },
            { label: 'Legacy Commands', value: result.legacyCommands, help: 'Number of actions using the LegacyAutomation package — carried over from older AA versions.' },
            { label: 'Deprecated Commands', value: result.deprecatedCommands, help: 'Number of actions using deprecated packages or commands.' },
            { label: 'Bot-to-Bot Dependencies', value: result.botToBotDependencies, help: 'Number of calls to other bots. Indicates the bot\'s dependency chain.' },
          ]}
        />
      </Section>

      {/* G. Resilience */}
      <Section title="G. Resilience / Maintainability Indicators">
        <MetricTable
          rows={[
            { label: 'Comments', value: result.comments, help: 'Number of Comment nodes in the bot — developer annotations.' },
            { label: 'Disabled Steps', value: result.disabledSteps, help: 'Number of nodes marked as disabled: true — inactive steps left in the workflow.' },
            { label: 'Hardcoded Values', value: result.hardcodedValues, help: 'Total count of detected hardcoded values (file paths, UNC paths, URLs).' },
            { label: 'Hardcoded Paths', value: result.hardcodedPaths, help: 'Number of hardcoded file paths (drive letters like C:\\..., UNC paths like \\\\server\\..., or file:// URIs with absolute paths).' },
            { label: 'Hardcoded Credentials', value: result.hardcodedCredentials, help: 'Number of attribute names matching credential-like patterns (password, secret, api_key, token). Flags potential security concerns.' },
            { label: 'Generic Error Handlers', value: result.genericErrorHandlers, help: 'Number of catch blocks catching broad exceptions (BotException or unspecified). These mask specific errors.' },
            { label: 'Targeted Error Handlers', value: result.targetedErrorHandlers, help: 'Number of catch blocks catching specific exception types. Indicates more mature error handling.' },
            { label: 'Logging Steps', value: result.loggingSteps, help: 'Number of LogToFile actions — explicit log-writing steps.' },
            { label: 'Screenshot / Audit Actions', value: result.screenshotActions, help: 'Number of Screen.captureWindow actions used for audit trails or debugging screenshots.' },
          ]}
        />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable sub-components
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
      >
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && <div className="px-6 pb-4">{children}</div>}
    </div>
  );
}

interface MetricRow {
  label: string;
  value: number | string | React.ReactNode;
  help?: string;
}

function MetricTable({ rows }: { rows: MetricRow[] }) {
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
        {rows.map((row, i) => (
          <tr key={i} className="group">
            <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-400 w-1/2">
              {row.label}
              {row.help && (
                <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500 hidden group-hover:inline">
                  — {row.help}
                </span>
              )}
            </td>
            <td className="py-2.5 text-right font-medium text-slate-900 dark:text-slate-100">
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
