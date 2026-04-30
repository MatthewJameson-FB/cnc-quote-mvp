export type RawPreleadCandidate = {
  source: string;
  source_url: string;
  title: string;
  snippet: string;
  published_at?: string | null;
  query_used?: string | null;
  thread_context_summary?: import("@/lib/prelead-thread-context").ThreadContextSummary | null;
  comment_context_used?: boolean;
  comment_context_reason?: string | null;
};

export type PreleadAdapter = {
  name: string;
  enabled: boolean;
  fetchCandidates: () => Promise<RawPreleadCandidate[]>;
};

export type AdapterLogger = {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
};
