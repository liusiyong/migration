// Types for Automation Anywhere bot JSON structure

export interface BotAttribute {
  name: string;
  value: {
    type: string;
    string?: string;
    number?: string;
    boolean?: boolean;
    expression?: string;
    variableName?: string;
    packageName?: string;
    conditionalName?: string;
    sessionName?: { type: string; string?: string };
    sessionTarget?: string;
    exceptionName?: string;
    iteratorName?: string;
    list?: unknown[];
    dictionary?: unknown[];
  };
  attributes?: BotAttribute[];
  returnTo?: unknown;
  operatorAttribute?: unknown;
}

export interface BotNode {
  uid: string;
  commandName: string;
  packageName: string;
  disabled?: boolean;
  attributes: BotAttribute[];
  children?: BotNode[];
  branches?: BotNode[];
  returnTo?: unknown;
  returns?: unknown;
}

export interface BotVariable {
  name: string;
  description: string;
  type: string;
  subtype: string;
  input: boolean;
  output: boolean;
  defaultValue?: unknown;
}

export interface BotPackage {
  name: string;
  version: string;
}

export interface BotFile {
  nodes: BotNode[];
  variables: BotVariable[];
  packages: BotPackage[];
  breakpoints?: unknown[];
  properties?: Record<string, unknown>;
}

export interface CategoryScore {
  name: string;
  similarity: number;
  weight: number;
}

export interface SizeComparison {
  botACommands: number;
  botBCommands: number;
  botAMaxDepth: number;
  botBMaxDepth: number;
}

export type DiffStatus = 'Identical' | 'Modified' | 'Removed' | 'Added' | 'Replaced';

export interface DiffLine {
  lineNum: number;
  botAAction: string;
  botBAction: string;
  status: DiffStatus;
  botANode?: BotNode | null;
  botBNode?: BotNode | null;
}

export interface DiffSummary {
  identical: number;
  modified: number;
  removed: number;
  added: number;
  replaced: number;
  actionMatchRate: number;
}

export interface AnalysisResult {
  botName: string;
  parseStatus: 'OK' | 'PARTIAL' | 'FAILED';
  parseWarnings: string[];
  // A. Bot Size
  totalActions: number;
  totalNodes: number;
  subtaskCalls: number;
  packagesReferenced: number;
  // B. Control-Flow
  ifElseConditions: number;
  maxIfNesting: number;
  switchCaseBranches: number;
  loops: number;
  maxLoopNesting: number;
  tryCatchBlocks: number;
  finallyBlocks: number;
  // C. Variables
  totalVariables: number;
  inputVariables: number;
  outputVariables: number;
  globalVariables: number;
  tableListVariables: number;
  complexVariables: number;
  // D. UI Automation
  uiActions: number;
  webAutomationActions: number;
  desktopUiActions: number;
  objectCloneActions: number;
  keystrokeActions: number;
  mouseClickActions: number;
  coordinateBasedActions: number;
  waitDelaySteps: number;
  imageRecognitionActions: number;
  ocrActions: number;
  // E. Application Integration
  distinctApplications: number;
  browserActions: number;
  excelActions: number;
  emailActions: number;
  pdfActions: number;
  fileFolderActions: number;
  databaseActions: number;
  apiWebServiceCalls: number;
  cmdInvocations: number;
  externalAppLaunches: number;
  credentialVaultLookups: number;
  networkShareAccesses: number;
  integrationCount: number;
  externalDependencyCount: number;
  // F. Non-Standard / Migration-Risk
  customDllReferences: number;
  vbscriptEmbeds: number;
  javascriptEmbeds: number;
  pythonEmbeds: number;
  powershellEmbeds: number;
  batchScriptEmbeds: number;
  customPackages: number;
  legacyCommands: number;
  deprecatedCommands: number;
  botToBotDependencies: number;
  // G. Resilience / Maintainability
  comments: number;
  disabledSteps: number;
  hardcodedValues: number;
  hardcodedPaths: number;
  hardcodedCredentials: number;
  genericErrorHandlers: number;
  targetedErrorHandlers: number;
  loggingSteps: number;
  screenshotActions: number;
}

export interface ComparisonResult {
  botAName: string;
  botBName: string;
  overallSimilarity: number;
  categories: CategoryScore[];
  sizeComparison: SizeComparison;
  diffLines: DiffLine[];
  diffSummary: DiffSummary;
}
