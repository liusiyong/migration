import {
  BotFile,
  BotNode,
  BotAttribute,
  CategoryScore,
  SizeComparison,
  DiffLine,
  DiffStatus,
  DiffSummary,
  ComparisonResult,
} from './types';

// --- Utility: flatten a bot's command tree into a sequence ---

interface FlatCommand {
  commandName: string;
  packageName: string;
  depth: number;
  disabled: boolean;
  paramSummary: string;
  node: BotNode;
}

function extractParamSummary(attrs: BotAttribute[]): string {
  const parts: string[] = [];
  for (const attr of attrs) {
    const v = attr.value;
    if (v.string !== undefined) parts.push(truncate(v.string, 80));
    else if (v.expression !== undefined) parts.push(truncate(v.expression, 80));
    else if (v.number !== undefined) parts.push(v.number);
    else if (v.boolean !== undefined) parts.push(String(v.boolean));
    else if (v.conditionalName) parts.push(`${v.conditionalName}(${v.packageName || ''})`);
    else if (v.variableName) parts.push(`$${v.variableName}$`);
    else if (v.sessionName?.string) parts.push(v.sessionName.string);
    else if (v.iteratorName) parts.push(v.iteratorName);
    else if (v.exceptionName) parts.push(v.exceptionName);
  }
  return parts.join(', ');
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + '...';
}

function flattenNodes(nodes: BotNode[], depth: number = 0): FlatCommand[] {
  const result: FlatCommand[] = [];
  for (const node of nodes) {
    result.push({
      commandName: node.commandName,
      packageName: node.packageName,
      depth,
      disabled: !!node.disabled,
      paramSummary: extractParamSummary(node.attributes || []),
      node,
    });
    if (node.children) {
      result.push(...flattenNodes(node.children, depth + 1));
    }
    if (node.branches) {
      result.push(...flattenNodes(node.branches, depth + 1));
    }
  }
  return result;
}

function formatAction(cmd: FlatCommand): string {
  const indent = '  '.repeat(cmd.depth);
  const disabled = cmd.disabled ? ' [DISABLED]' : '';
  const params = cmd.paramSummary ? `  [${cmd.paramSummary}]` : '';
  return `${indent}${cmd.packageName}.${cmd.commandName}${params}${disabled}`;
}

// --- Jaccard similarity ---

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

// --- LCS-based command sequence similarity ---

function lcsLength(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  // Use two rows for space efficiency
  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev.fill(0)];
  }
  return prev.reduce((max, v) => Math.max(max, v), 0);
}

function commandSequenceSimilarity(cmdsA: FlatCommand[], cmdsB: FlatCommand[]): number {
  const seqA = cmdsA.map(c => `${c.packageName}.${c.commandName}`);
  const seqB = cmdsB.map(c => `${c.packageName}.${c.commandName}`);
  if (seqA.length === 0 && seqB.length === 0) return 1;
  const lcs = lcsLength(seqA, seqB);
  return (2 * lcs) / (seqA.length + seqB.length);
}

// --- Command distribution similarity (cosine) ---

function commandDistributionSimilarity(cmdsA: FlatCommand[], cmdsB: FlatCommand[]): number {
  const countA = new Map<string, number>();
  const countB = new Map<string, number>();
  for (const c of cmdsA) {
    const key = `${c.packageName}.${c.commandName}`;
    countA.set(key, (countA.get(key) || 0) + 1);
  }
  for (const c of cmdsB) {
    const key = `${c.packageName}.${c.commandName}`;
    countB.set(key, (countB.get(key) || 0) + 1);
  }
  const allKeys = new Set([...countA.keys(), ...countB.keys()]);
  if (allKeys.size === 0) return 1;
  let dot = 0, magA = 0, magB = 0;
  for (const k of allKeys) {
    const a = countA.get(k) || 0;
    const b = countB.get(k) || 0;
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// --- Command types Jaccard ---

function commandTypesSimilarity(cmdsA: FlatCommand[], cmdsB: FlatCommand[]): number {
  const setA = new Set(cmdsA.map(c => `${c.packageName}.${c.commandName}`));
  const setB = new Set(cmdsB.map(c => `${c.packageName}.${c.commandName}`));
  return jaccardSimilarity(setA, setB);
}

// --- Structural depth profile ---

function depthProfile(cmds: FlatCommand[]): Map<number, number> {
  const profile = new Map<number, number>();
  for (const c of cmds) {
    profile.set(c.depth, (profile.get(c.depth) || 0) + 1);
  }
  return profile;
}

function structuralDepthSimilarity(cmdsA: FlatCommand[], cmdsB: FlatCommand[]): number {
  const profA = depthProfile(cmdsA);
  const profB = depthProfile(cmdsB);
  const allDepths = new Set([...profA.keys(), ...profB.keys()]);
  if (allDepths.size === 0) return 1;
  let dot = 0, magA = 0, magB = 0;
  for (const d of allDepths) {
    const a = profA.get(d) || 0;
    const b = profB.get(d) || 0;
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// --- Variables Jaccard ---

function variablesSimilarity(botA: BotFile, botB: BotFile): number {
  const setA = new Set(botA.variables.map(v => v.name));
  const setB = new Set(botB.variables.map(v => v.name));
  return jaccardSimilarity(setA, setB);
}

// --- Packages Jaccard ---

function packagesSimilarity(botA: BotFile, botB: BotFile): number {
  const setA = new Set(botA.packages.map(p => p.name));
  const setB = new Set(botB.packages.map(p => p.name));
  return jaccardSimilarity(setA, setB);
}

// --- String literals Jaccard ---

function extractStringLiterals(nodes: BotNode[]): Set<string> {
  const strings = new Set<string>();

  function walk(nodeList: BotNode[]) {
    for (const node of nodeList) {
      for (const attr of node.attributes || []) {
        collectStringsFromAttr(attr, strings);
      }
      if (node.children) walk(node.children);
      if (node.branches) walk(node.branches);
    }
  }

  walk(nodes);
  return strings;
}

function collectStringsFromAttr(attr: BotAttribute, strings: Set<string>) {
  if (attr.value.type === 'STRING' && attr.value.string) {
    const s = attr.value.string.trim();
    if (s.length > 0 && !s.startsWith('file://')) {
      strings.add(s);
    }
  }
  if (attr.attributes) {
    for (const sub of attr.attributes) {
      collectStringsFromAttr(sub, strings);
    }
  }
}

function stringLiteralsSimilarity(botA: BotFile, botB: BotFile): number {
  const setA = extractStringLiterals(botA.nodes);
  const setB = extractStringLiterals(botB.nodes);
  return jaccardSimilarity(setA, setB);
}

// --- Max nesting depth ---

function maxDepth(nodes: BotNode[], depth: number = 0): number {
  let max = depth;
  for (const node of nodes) {
    if (node.children) max = Math.max(max, maxDepth(node.children, depth + 1));
    if (node.branches) max = Math.max(max, maxDepth(node.branches, depth + 1));
  }
  return max;
}

// --- Action diff (LCS-based alignment) ---

function computeActionDiff(cmdsA: FlatCommand[], cmdsB: FlatCommand[]): DiffLine[] {
  const seqA = cmdsA.map(c => `${c.packageName}.${c.commandName}`);
  const seqB = cmdsB.map(c => `${c.packageName}.${c.commandName}`);
  const m = seqA.length;
  const n = seqB.length;

  // Build full LCS table for backtracking
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (seqA[i - 1] === seqB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce aligned diff
  const diffLines: DiffLine[] = [];
  let i = m, j = n;
  const aligned: { aIdx: number | null; bIdx: number | null }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && seqA[i - 1] === seqB[j - 1]) {
      aligned.push({ aIdx: i - 1, bIdx: j - 1 });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      aligned.push({ aIdx: null, bIdx: j - 1 });
      j--;
    } else {
      aligned.push({ aIdx: i - 1, bIdx: null });
      i--;
    }
  }

  aligned.reverse();

  let lineNum = 1;
  for (const pair of aligned) {
    let status: DiffStatus;
    let botAAction = '';
    let botBAction = '';

    if (pair.aIdx !== null && pair.bIdx !== null) {
      botAAction = formatAction(cmdsA[pair.aIdx]);
      botBAction = formatAction(cmdsB[pair.bIdx]);
      if (botAAction === botBAction) {
        status = 'Identical';
      } else if (seqA[pair.aIdx] === seqB[pair.bIdx]) {
        status = 'Modified';
      } else {
        status = 'Replaced';
      }
    } else if (pair.aIdx !== null) {
      botAAction = formatAction(cmdsA[pair.aIdx]);
      status = 'Removed';
    } else {
      botBAction = formatAction(cmdsB[pair.bIdx!]);
      status = 'Added';
    }

    diffLines.push({
      lineNum: lineNum++,
      botAAction,
      botBAction,
      status,
      botANode: pair.aIdx !== null ? cmdsA[pair.aIdx].node : null,
      botBNode: pair.bIdx !== null ? cmdsB[pair.bIdx].node : null,
    });
  }

  return diffLines;
}

// --- Main compare function ---

export function compareBots(
  botA: BotFile,
  botB: BotFile,
  botAName: string,
  botBName: string
): ComparisonResult {
  const cmdsA = flattenNodes(botA.nodes);
  const cmdsB = flattenNodes(botB.nodes);

  const categories: CategoryScore[] = [
    { name: 'Command Sequence (LCS)', similarity: commandSequenceSimilarity(cmdsA, cmdsB), weight: 0.30 },
    { name: 'Command Distribution', similarity: commandDistributionSimilarity(cmdsA, cmdsB), weight: 0.15 },
    { name: 'Command Types (Jaccard)', similarity: commandTypesSimilarity(cmdsA, cmdsB), weight: 0.10 },
    { name: 'Structural Depth Profile', similarity: structuralDepthSimilarity(cmdsA, cmdsB), weight: 0.10 },
    { name: 'Variables (Jaccard)', similarity: variablesSimilarity(botA, botB), weight: 0.15 },
    { name: 'Packages (Jaccard)', similarity: packagesSimilarity(botA, botB), weight: 0.10 },
    { name: 'String Literals (Jaccard)', similarity: stringLiteralsSimilarity(botA, botB), weight: 0.10 },
  ];

  const overallSimilarity = categories.reduce((sum, cat) => sum + cat.similarity * cat.weight, 0);

  const sizeComparison: SizeComparison = {
    botACommands: cmdsA.length,
    botBCommands: cmdsB.length,
    botAMaxDepth: maxDepth(botA.nodes),
    botBMaxDepth: maxDepth(botB.nodes),
  };

  const diffLines = computeActionDiff(cmdsA, cmdsB);

  const diffSummary: DiffSummary = {
    identical: diffLines.filter(d => d.status === 'Identical').length,
    modified: diffLines.filter(d => d.status === 'Modified').length,
    removed: diffLines.filter(d => d.status === 'Removed').length,
    added: diffLines.filter(d => d.status === 'Added').length,
    replaced: diffLines.filter(d => d.status === 'Replaced').length,
    actionMatchRate: 0,
  };

  const totalLines = diffLines.length;
  diffSummary.actionMatchRate = totalLines > 0
    ? (diffSummary.identical / totalLines) * 100
    : 100;

  return {
    botAName,
    botBName,
    overallSimilarity: Math.round(overallSimilarity * 1000) / 10,
    categories: categories.map(c => ({
      ...c,
      similarity: Math.round(c.similarity * 1000) / 10,
      weight: Math.round(c.weight * 100),
    })),
    sizeComparison,
    diffLines,
    diffSummary: {
      ...diffSummary,
      actionMatchRate: Math.round(diffSummary.actionMatchRate * 10) / 10,
    },
  };
}
