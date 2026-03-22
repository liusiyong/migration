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

export interface ComparisonResult {
  botAName: string;
  botBName: string;
  overallSimilarity: number;
  categories: CategoryScore[];
  sizeComparison: SizeComparison;
  diffLines: DiffLine[];
  diffSummary: DiffSummary;
}
