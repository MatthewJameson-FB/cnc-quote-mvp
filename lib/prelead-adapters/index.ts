import type { AdapterLogger, PreleadAdapter } from "./types";
import { createRedditAdapter } from "./reddit";
import { createSerpapiAdapter } from "./serpapi";

export function buildEnabledPreleadAdapters(logger?: AdapterLogger): PreleadAdapter[] {
  const adapters = [createSerpapiAdapter(logger), createRedditAdapter(logger)];
  return adapters.filter((adapter) => adapter.enabled);
}
