export interface ReviewRequest {
  code: string;
  problem_description: string;
}

export interface SSEStatusEvent {
  node: string;
  label: string;
  status: string;
  retry_count: number;
  time_complexity: string;
  space_complexity: string;
  bottlenecks: string[];
  pass_rate: number;
  test_count: number;
  failed_count: number;
}

export interface TestCase {
  description: string;
  input: unknown;
  expected: unknown;
  actual?: unknown;
  passed?: boolean;
  error?: string;
  elapsed_ms?: number;
}

export interface ReviewResult {
  original_code: string;
  refactored_code: string;
  time_complexity: string;
  space_complexity: string;
  bottlenecks: string[];
  pass_rate: number;
  retry_count: number;
  generated_tests: TestCase[];
  failed_tests: TestCase[];
  status: string;
}

export interface SSEErrorEvent {
  message: string;
}

export type PipelineStatus =
  | "idle"
  | "running"
  | "completed"
  | "error";

export interface TimelineEntry {
  id: string;
  node: string;
  label: string;
  status: string;
  timestamp: Date;
  meta?: Partial<SSEStatusEvent>;
}
