import { BotFile, BotNode, BotAttribute, AnalysisResult } from './types';

// ---------------------------------------------------------------------------
// Standard AA package names (non-custom)
// ---------------------------------------------------------------------------
const STANDARD_PACKAGES = new Set([
  'ErrorHandler', 'If', 'Loop', 'Comment', 'String', 'Number', 'Boolean',
  'Datetime', 'System', 'LegacyAutomation', 'TaskBot', 'MessageBox',
  'Regex', 'Base64', 'JSON', 'File', 'Folder', 'CsvTxt', 'LogToFile',
  'Excel_MS', 'IExcelCommand', 'Browser', 'WebBrowser', 'Web', 'HTTP',
  'Email', 'IMAP', 'SMTP', 'Database', 'MSAccess', 'OLEDB',
  'PDF', 'XML', 'Recorder', 'RecorderV2', 'Screen', 'Mouse', 'Keystrokes',
  'Window', 'OCR', 'ImageRecognition', 'Clipboard', 'FTP', 'REST', 'SOAP',
  'WebService', 'WS', 'Delay', 'Application', 'DLL', 'PGP', 'Terminal',
  'CommandLine', 'Credential', 'CredentialVault', 'Python', 'PythonScript',
  'JavaScript', 'VBScript', 'PowerShell', 'Script', 'Dictionary', 'List',
  'DataTable', 'Table', 'SAP', 'SFTP', 'Zip', 'Unzip', 'Pdf',
]);

const DEPRECATED_PACKAGES = new Set(['LegacyAutomation']);

const UI_PACKAGES = new Set([
  'Recorder', 'RecorderV2', 'Screen', 'Mouse', 'Keystrokes', 'Window',
  'ImageRecognition', 'OCR', 'Clipboard',
]);

const WEB_PACKAGES = new Set(['Browser', 'WebBrowser', 'Web', 'HTTP']);

const DESKTOP_PACKAGES = new Set(['Recorder', 'RecorderV2', 'Screen', 'Mouse', 'Window']);

const APP_CATEGORIES: { name: string; packages: Set<string> }[] = [
  { name: 'Excel', packages: new Set(['Excel_MS', 'IExcelCommand']) },
  { name: 'Email', packages: new Set(['Email', 'IMAP', 'SMTP']) },
  { name: 'Browser/Web', packages: new Set(['Browser', 'WebBrowser', 'Web', 'HTTP']) },
  { name: 'Database', packages: new Set(['Database', 'MSAccess', 'OLEDB']) },
  { name: 'FileSystem', packages: new Set(['File', 'Folder', 'CsvTxt']) },
  { name: 'XML', packages: new Set(['XML']) },
  { name: 'API', packages: new Set(['REST', 'SOAP', 'WebService', 'WS']) },
  { name: 'PDF', packages: new Set(['PDF', 'Pdf']) },
  { name: 'SAP', packages: new Set(['SAP']) },
  { name: 'FTP', packages: new Set(['FTP', 'SFTP']) },
  { name: 'DLL', packages: new Set(['DLL']) },
  { name: 'Terminal', packages: new Set(['Terminal', 'CommandLine']) },
  { name: 'Scripting', packages: new Set(['Python', 'PythonScript', 'JavaScript', 'VBScript', 'PowerShell', 'Script']) },
  { name: 'UI Automation', packages: UI_PACKAGES },
];

const COORD_ATTR_NAMES = new Set([
  'x', 'y', 'xcoordinate', 'ycoordinate', 'xcordinate', 'ycordinate',
  'destinationx', 'destinationy', 'startx', 'starty', 'endx', 'endy',
  'xoffset', 'yoffset',
]);

const CREDENTIAL_ATTR_RE = /password|passwd|pwd|secret|api[_-]?key|apikey|token|credential/i;

const HARDCODED_DRIVE_RE = /[A-Za-z]:[/\\]/;
const HARDCODED_UNC_RE = /\\\\[a-zA-Z0-9._-]/;

// ---------------------------------------------------------------------------
// Tree walking utilities
// ---------------------------------------------------------------------------

function walkNodes(nodes: BotNode[], visitor: (node: BotNode) => void): void {
  for (const node of nodes) {
    visitor(node);
    if (node.children) walkNodes(node.children, visitor);
    if (node.branches) walkNodes(node.branches, visitor);
  }
}

function collectAllNodes(nodes: BotNode[]): BotNode[] {
  const result: BotNode[] = [];
  walkNodes(nodes, n => result.push(n));
  return result;
}

function walkAttrs(attrs: BotAttribute[], visitor: (attr: BotAttribute) => void): void {
  for (const attr of attrs) {
    visitor(attr);
    if (attr.attributes) walkAttrs(attr.attributes, visitor);
  }
}

function getNodeAttrs(node: BotNode): BotAttribute[] {
  const result: BotAttribute[] = [];
  walkAttrs(node.attributes || [], a => result.push(a));
  return result;
}

// ---------------------------------------------------------------------------
// Nesting depth helpers
// ---------------------------------------------------------------------------

function computeMaxIfNesting(nodes: BotNode[], depth: number = 0): number {
  let max = depth;
  for (const node of nodes) {
    if (node.commandName === 'if' || node.commandName === 'elseIf') {
      const next = depth + 1;
      max = Math.max(max, next);
      if (node.children) max = Math.max(max, computeMaxIfNesting(node.children, next));
      if (node.branches) max = Math.max(max, computeMaxIfNesting(node.branches, depth));
    } else {
      if (node.children) max = Math.max(max, computeMaxIfNesting(node.children, depth));
      if (node.branches) max = Math.max(max, computeMaxIfNesting(node.branches, depth));
    }
  }
  return max;
}

function computeMaxLoopNesting(nodes: BotNode[], depth: number = 0): number {
  let max = depth;
  for (const node of nodes) {
    if (node.commandName === 'loop.commands.start') {
      const next = depth + 1;
      max = Math.max(max, next);
      if (node.children) max = Math.max(max, computeMaxLoopNesting(node.children, next));
    } else {
      if (node.children) max = Math.max(max, computeMaxLoopNesting(node.children, depth));
      if (node.branches) max = Math.max(max, computeMaxLoopNesting(node.branches, depth));
    }
  }
  return max;
}

// ---------------------------------------------------------------------------
// String value extraction
// ---------------------------------------------------------------------------

function collectStringValues(nodes: BotNode[]): string[] {
  const values: string[] = [];
  walkNodes(nodes, node => {
    walkAttrs(node.attributes || [], attr => {
      const v = attr.value;
      if (v.string) values.push(v.string);
      if (v.expression) values.push(v.expression);
    });
  });
  return values;
}

function collectAttributeNames(nodes: BotNode[]): string[] {
  const names: string[] = [];
  walkNodes(nodes, node => {
    walkAttrs(node.attributes || [], attr => {
      names.push(attr.name);
    });
  });
  return names;
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

export function analyzeBot(botData: BotFile, fileName: string): AnalysisResult {
  const warnings: string[] = [];
  const botName = fileName.replace(/_bot$/, '').trim();

  if (!botData.nodes || !Array.isArray(botData.nodes)) {
    return emptyResult(botName, 'FAILED', ['Could not find nodes array in bot file']);
  }

  const allNodes = collectAllNodes(botData.nodes);
  const activeNodes = allNodes.filter(n => !n.disabled);
  const pkgSet = new Set(activeNodes.map(n => n.packageName));

  // -- A. Bot Size --
  const totalActions = activeNodes.length;
  const totalNodes = allNodes.length;
  const subtaskCalls = activeNodes.filter(
    n => n.packageName === 'TaskBot' &&
         (n.commandName === 'callBot' || n.commandName === 'CallBot' || n.commandName.toLowerCase() === 'callbot')
  ).length;
  const packagesReferenced = (botData.packages || []).length;

  // -- B. Control-Flow --
  const ifElseConditions = activeNodes.filter(
    n => n.commandName === 'if' || n.commandName === 'elseIf'
  ).length;
  const maxIfNesting = computeMaxIfNesting(botData.nodes);
  const switchCaseBranches = activeNodes.filter(
    n => n.commandName === 'switch' || n.commandName === 'case'
  ).length;
  const loops = activeNodes.filter(n => n.commandName === 'loop.commands.start').length;
  const maxLoopNesting = computeMaxLoopNesting(botData.nodes);
  const tryCatchBlocks = activeNodes.filter(
    n => n.packageName === 'ErrorHandler' && n.commandName === 'catch'
  ).length;
  const finallyBlocks = activeNodes.filter(
    n => n.packageName === 'ErrorHandler' && n.commandName === 'finally'
  ).length;

  // -- C. Variables --
  const vars = botData.variables || [];
  const totalVariables = vars.length;
  const inputVariables = vars.filter(v => v.input && !v.output).length;
  const outputVariables = vars.filter(v => !v.input && v.output).length;
  const globalVariables = vars.filter(v => v.input && v.output).length;
  const tableListVariables = vars.filter(
    v => v.type === 'TABLE' || v.type === 'LIST'
  ).length;
  const complexVariables = vars.filter(
    v => v.type === 'DICTIONARY' || v.type === 'RECORD' || v.type === 'ANY'
  ).length;

  // -- D. UI Automation --
  const uiActions = activeNodes.filter(n => UI_PACKAGES.has(n.packageName)).length;
  const webAutomationActions = activeNodes.filter(n => WEB_PACKAGES.has(n.packageName)).length;
  const desktopUiActions = activeNodes.filter(n => DESKTOP_PACKAGES.has(n.packageName)).length;
  const objectCloneActions = activeNodes.filter(
    n => (n.packageName === 'Recorder' || n.packageName === 'RecorderV2') &&
         n.commandName.toLowerCase().includes('capture')
  ).length;
  const keystrokeActions = activeNodes.filter(n => n.packageName === 'Keystrokes').length;
  const mouseClickActions = activeNodes.filter(
    n => n.packageName === 'Mouse' &&
         (n.commandName.toLowerCase().includes('click') || n.commandName === 'moveTo')
  ).length;
  const coordinateBasedActions = activeNodes.filter(n => {
    const attrs = getNodeAttrs(n);
    return attrs.some(a => COORD_ATTR_NAMES.has(a.name.toLowerCase()));
  }).length;
  const waitDelaySteps = activeNodes.filter(
    n => n.packageName === 'Delay' || n.commandName === 'delay'
  ).length;
  const imageRecognitionActions = activeNodes.filter(
    n => n.packageName === 'ImageRecognition'
  ).length;
  const ocrActions = activeNodes.filter(n => n.packageName === 'OCR').length;

  // -- E. Application Integration --
  const browserActions = activeNodes.filter(n => WEB_PACKAGES.has(n.packageName)).length;
  const excelActions = activeNodes.filter(
    n => n.packageName === 'Excel_MS' || n.packageName === 'IExcelCommand'
  ).length;
  const emailActions = activeNodes.filter(
    n => n.packageName === 'Email' || n.packageName === 'IMAP' || n.packageName === 'SMTP'
  ).length;
  const pdfActions = activeNodes.filter(
    n => n.packageName === 'PDF' || n.packageName === 'Pdf'
  ).length;
  const fileFolderActions = activeNodes.filter(
    n => n.packageName === 'File' || n.packageName === 'Folder' ||
         n.packageName === 'CsvTxt' || n.packageName === 'LogToFile'
  ).length;
  const databaseActions = activeNodes.filter(
    n => n.packageName === 'Database' || n.packageName === 'MSAccess' || n.packageName === 'OLEDB'
  ).length;
  const apiWebServiceCalls = activeNodes.filter(
    n => n.packageName === 'REST' || n.packageName === 'SOAP' ||
         n.packageName === 'WebService' || n.packageName === 'WS'
  ).length;
  const cmdInvocations = activeNodes.filter(
    n => n.packageName === 'Terminal' || n.packageName === 'CommandLine'
  ).length;
  const externalAppLaunches = activeNodes.filter(
    n => n.packageName === 'Application' &&
         (n.commandName === 'runApp' || n.commandName === 'run' || n.commandName === 'openApplication')
  ).length;
  const credentialVaultLookups = activeNodes.filter(
    n => n.packageName === 'CredentialVault' || n.packageName === 'Credential' ||
         n.commandName.toLowerCase().includes('credential')
  ).length;

  const ftpActions = activeNodes.filter(
    n => n.packageName === 'FTP' || n.packageName === 'SFTP'
  ).length;
  const allStrings = collectStringValues(botData.nodes);
  const uncPathRefs = allStrings.filter(s => HARDCODED_UNC_RE.test(s)).length;
  const networkShareAccesses = ftpActions + uncPathRefs;

  const distinctApplications = APP_CATEGORIES.filter(cat =>
    [...cat.packages].some(p => pkgSet.has(p))
  ).length;
  const integrationCount = distinctApplications;

  const scriptEmbedCount =
    (activeNodes.filter(n => n.packageName === 'VBScript' || (n.packageName === 'Script' && n.commandName.toLowerCase().includes('vb'))).length) +
    (activeNodes.filter(n => n.packageName === 'JavaScript' || (n.packageName === 'Script' && n.commandName.toLowerCase().includes('javascript'))).length) +
    (activeNodes.filter(n => n.packageName === 'Python' || n.packageName === 'PythonScript' || (n.packageName === 'Script' && n.commandName.toLowerCase().includes('python'))).length) +
    (activeNodes.filter(n => n.packageName === 'PowerShell' || (n.packageName === 'Script' && n.commandName.toLowerCase().includes('powershell'))).length);

  const customDllRefs = activeNodes.filter(n => n.packageName === 'DLL').length;

  const externalDependencyCount =
    apiWebServiceCalls + databaseActions + customDllRefs + externalAppLaunches + scriptEmbedCount;

  // -- F. Non-Standard / Migration-Risk --
  const customDllReferences = customDllRefs;
  const vbscriptEmbeds = activeNodes.filter(
    n => n.packageName === 'VBScript' ||
         (n.packageName === 'Script' && n.commandName.toLowerCase().includes('vb'))
  ).length;
  const javascriptEmbeds = activeNodes.filter(
    n => n.packageName === 'JavaScript' ||
         (n.packageName === 'Script' && n.commandName.toLowerCase().includes('javascript'))
  ).length;
  const pythonEmbeds = activeNodes.filter(
    n => n.packageName === 'Python' || n.packageName === 'PythonScript' ||
         (n.packageName === 'Script' && n.commandName.toLowerCase().includes('python'))
  ).length;
  const powershellEmbeds = activeNodes.filter(
    n => n.packageName === 'PowerShell' ||
         (n.packageName === 'Script' && n.commandName.toLowerCase().includes('powershell'))
  ).length;
  const batchScriptEmbeds = activeNodes.filter(
    n => n.packageName === 'Script' &&
         !n.commandName.toLowerCase().includes('vb') &&
         !n.commandName.toLowerCase().includes('javascript') &&
         !n.commandName.toLowerCase().includes('python') &&
         !n.commandName.toLowerCase().includes('powershell')
  ).length;

  const usedPackageNames = new Set((botData.packages || []).map(p => p.name));
  const customPackages = [...usedPackageNames].filter(p => !STANDARD_PACKAGES.has(p)).length;
  const legacyCommands = activeNodes.filter(n => n.packageName === 'LegacyAutomation').length;
  const deprecatedCommands = activeNodes.filter(n => DEPRECATED_PACKAGES.has(n.packageName)).length;
  const botToBotDependencies = subtaskCalls;

  // -- G. Resilience / Maintainability --
  const comments = allNodes.filter(n => n.packageName === 'Comment').length;
  const disabledSteps = allNodes.filter(n => !!n.disabled).length;

  const hardcodedPathStrings = allStrings.filter(s => HARDCODED_DRIVE_RE.test(s) || HARDCODED_UNC_RE.test(s));
  const hardcodedPaths = hardcodedPathStrings.length;
  const urlStrings = allStrings.filter(s => /https?:\/\//i.test(s)).length;
  const hardcodedValues = hardcodedPaths + urlStrings;

  const attrNames = collectAttributeNames(botData.nodes);
  const hardcodedCredentials = attrNames.filter(n => CREDENTIAL_ATTR_RE.test(n)).length;

  const catchNodes = allNodes.filter(
    n => n.packageName === 'ErrorHandler' && n.commandName === 'catch'
  );
  const genericErrorHandlers = catchNodes.filter(n => {
    const attrs = getNodeAttrs(n);
    const exceptionAttr = attrs.find(a => a.name === 'exceptionType');
    if (!exceptionAttr) return true;
    const name = exceptionAttr.value.exceptionName || exceptionAttr.value.string || '';
    return name === '' || name === 'BotException' || name === 'Exception';
  }).length;
  const targetedErrorHandlers = catchNodes.length - genericErrorHandlers;

  const loggingSteps = activeNodes.filter(n => n.packageName === 'LogToFile').length;
  const screenshotActions = activeNodes.filter(
    n => n.packageName === 'Screen' &&
         (n.commandName === 'captureWindow' || n.commandName.toLowerCase().includes('capture'))
  ).length;

  // Parse status
  let parseStatus: 'OK' | 'PARTIAL' | 'FAILED' = 'OK';
  if (warnings.length > 0) parseStatus = 'PARTIAL';

  return {
    botName,
    parseStatus,
    parseWarnings: warnings,
    totalActions,
    totalNodes,
    subtaskCalls,
    packagesReferenced,
    ifElseConditions,
    maxIfNesting,
    switchCaseBranches,
    loops,
    maxLoopNesting,
    tryCatchBlocks,
    finallyBlocks,
    totalVariables,
    inputVariables,
    outputVariables,
    globalVariables,
    tableListVariables,
    complexVariables,
    uiActions,
    webAutomationActions,
    desktopUiActions,
    objectCloneActions,
    keystrokeActions,
    mouseClickActions,
    coordinateBasedActions,
    waitDelaySteps,
    imageRecognitionActions,
    ocrActions,
    distinctApplications,
    browserActions,
    excelActions,
    emailActions,
    pdfActions,
    fileFolderActions,
    databaseActions,
    apiWebServiceCalls,
    cmdInvocations,
    externalAppLaunches,
    credentialVaultLookups,
    networkShareAccesses,
    integrationCount,
    externalDependencyCount,
    customDllReferences,
    vbscriptEmbeds,
    javascriptEmbeds,
    pythonEmbeds,
    powershellEmbeds,
    batchScriptEmbeds,
    customPackages,
    legacyCommands,
    deprecatedCommands,
    botToBotDependencies,
    comments,
    disabledSteps,
    hardcodedValues,
    hardcodedPaths,
    hardcodedCredentials,
    genericErrorHandlers,
    targetedErrorHandlers,
    loggingSteps,
    screenshotActions,
  };
}

function emptyResult(
  botName: string,
  parseStatus: 'OK' | 'PARTIAL' | 'FAILED',
  warnings: string[]
): AnalysisResult {
  const zero = 0;
  return {
    botName, parseStatus, parseWarnings: warnings,
    totalActions: zero, totalNodes: zero, subtaskCalls: zero, packagesReferenced: zero,
    ifElseConditions: zero, maxIfNesting: zero, switchCaseBranches: zero,
    loops: zero, maxLoopNesting: zero, tryCatchBlocks: zero, finallyBlocks: zero,
    totalVariables: zero, inputVariables: zero, outputVariables: zero,
    globalVariables: zero, tableListVariables: zero, complexVariables: zero,
    uiActions: zero, webAutomationActions: zero, desktopUiActions: zero,
    objectCloneActions: zero, keystrokeActions: zero, mouseClickActions: zero,
    coordinateBasedActions: zero, waitDelaySteps: zero, imageRecognitionActions: zero, ocrActions: zero,
    distinctApplications: zero, browserActions: zero, excelActions: zero, emailActions: zero,
    pdfActions: zero, fileFolderActions: zero, databaseActions: zero, apiWebServiceCalls: zero,
    cmdInvocations: zero, externalAppLaunches: zero, credentialVaultLookups: zero,
    networkShareAccesses: zero, integrationCount: zero, externalDependencyCount: zero,
    customDllReferences: zero, vbscriptEmbeds: zero, javascriptEmbeds: zero,
    pythonEmbeds: zero, powershellEmbeds: zero, batchScriptEmbeds: zero,
    customPackages: zero, legacyCommands: zero, deprecatedCommands: zero, botToBotDependencies: zero,
    comments: zero, disabledSteps: zero, hardcodedValues: zero, hardcodedPaths: zero,
    hardcodedCredentials: zero, genericErrorHandlers: zero, targetedErrorHandlers: zero,
    loggingSteps: zero, screenshotActions: zero,
  };
}
