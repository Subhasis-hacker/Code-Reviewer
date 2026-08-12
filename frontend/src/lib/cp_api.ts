/**
 * Typed API client for the CP Dashboard endpoints.
 * Every call attaches the Supabase JWT Bearer token.
 */

import { getAccessToken } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return {
    "Content-Type":  "application/json",
    Authorization:   `Bearer ${token}`,
  };
}

// ── Types mirroring backend Pydantic schemas ──────────────────────────────────

export interface PlatformStats {
  platform:     string;
  handle:       string;
  rating:       number;
  max_rating:   number;
  rank:         string;
  easy_count:   number;
  medium_count: number;
  hard_count:   number;
  total_solved: number;
  error:        string | null;
}

export interface SyncResult {
  user_id:    string;
  synced_at:  string;
  leetcode:   PlatformStats;
  codeforces: PlatformStats;
  codechef:   PlatformStats;
  totals: {
    easy:   number;
    medium: number;
    hard:   number;
    total:  number;
  };
}

export interface HeatmapEntry {
  activity_date:      string;
  problems_solved:    number;
  platform_breakdown: Record<string, number>;
}

export interface DashboardData {
  profile: {
    username:           string;
    avatar_url:         string | null;
    leetcode_handle:    string | null;
    codeforces_handle:  string | null;
    codechef_handle:    string | null;
  };
  platform_stats: Record<string, PlatformStats & { total_solved: number }>;
  heatmap:        HeatmapEntry[];
  fetched_at:     string;
}

export interface HandlesPayload {
  leetcode_handle?:   string;
  codeforces_handle?: string;
  codechef_handle?:   string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function saveHandles(payload: HandlesPayload): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/api/v1/cp/handles`, {
    method:  "PUT",
    headers,
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Failed to save handles");
  }
}

export async function triggerSync(): Promise<SyncResult> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/api/v1/cp/sync`, {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Sync failed");
  }
  return res.json();
}

export async function fetchDashboard(): Promise<DashboardData> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/api/v1/cp/dashboard`, {
    method:  "GET",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Dashboard fetch failed");
  }
  return res.json();
}
