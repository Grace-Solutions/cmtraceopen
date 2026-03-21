/**
 * Simplifies verbose macOS unified log messages into scannable summaries,
 * and categorizes them for filtering/visual badges.
 */

export type LogCategory =
  | "network-noise" // path:satisfied_change, connection state — very noisy
  | "http"          // sent request, received response, task summary
  | "task"          // task resuming, finished, connection reused
  | "info";         // everything else

export interface SimplifiedMessage {
  summary: string;
  category: LogCategory;
}

/** Parse a task summary dict like {transaction_duration_ms=88, response_status=200, ...} */
function parseTaskSummary(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  const match = raw.match(/\{([^}]+)\}/);
  if (!match) return result;
  for (const pair of match[1].split(",")) {
    const [k, v] = pair.split("=").map((s) => s.trim());
    if (k && v) result[k] = v;
  }
  return result;
}

/** Format bytes into human-readable size */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Simplify a unified log message into a scannable summary + category.
 * Returns null if no simplification is possible (show raw message).
 */
export function simplifyMessage(
  message: string,
  process: string,
): SimplifiedMessage | null {
  // Only simplify known Intune processes
  if (
    process !== "IntuneMdmDaemon" &&
    process !== "IntuneMdmAgent" &&
    process !== "CompanyPortal"
  ) {
    return null;
  }

  const msg = message.trim();

  // --- Network noise: path:satisfied_change events ---
  if (msg.includes("event: path:satisfied_change")) {
    return { summary: "Network path change", category: "network-noise" };
  }
  if (msg.includes("event: path:unsatisfied")) {
    return { summary: "Network path lost", category: "network-noise" };
  }

  // --- Connection events ---
  if (msg.includes("event: client:connection_reused")) {
    return { summary: "Connection reused", category: "task" };
  }
  if (msg.includes("event: client:connection_idle")) {
    return { summary: "Connection idle", category: "task" };
  }

  // --- Task lifecycle ---
  const taskResuming = msg.match(
    /Task <([A-F0-9-]+)>\.\d+ resuming/i,
  );
  if (taskResuming) {
    const taskId = taskResuming[1].slice(0, 8);
    return { summary: `Task ${taskId}… starting`, category: "task" };
  }

  const taskConnection = msg.match(
    /Task <([A-F0-9-]+)>\.\d+ now using Connection (\d+)/i,
  );
  if (taskConnection) {
    return {
      summary: `Using connection ${taskConnection[2]}`,
      category: "task",
    };
  }

  // --- HTTP: sent request ---
  const sentReq = msg.match(
    /Task <([A-F0-9-]+)>\.\d+ sent request, body \w+ (\d+)/i,
  );
  if (sentReq) {
    const bytes = parseInt(sentReq[2], 10);
    return {
      summary: `Sent request (${formatBytes(bytes)})`,
      category: "http",
    };
  }

  // --- HTTP: received response ---
  const recvResp = msg.match(
    /Task <([A-F0-9-]+)>\.\d+ received response, status (\d+)/i,
  );
  if (recvResp) {
    const status = recvResp[2];
    const ok = status.startsWith("2") ? "OK" : status.startsWith("3") ? "Redirect" : "Error";
    return {
      summary: `Response ${status} ${ok}`,
      category: "http",
    };
  }

  // --- HTTP: task summary ---
  const taskSummary = msg.match(
    /Task <([A-F0-9-]+)>\.\d+ summary for task (success|failure)\s*(\{[^}]+\})/i,
  );
  if (taskSummary) {
    const status = taskSummary[2];
    const stats = parseTaskSummary(taskSummary[3]);
    const parts: string[] = [];
    if (stats.response_status) parts.push(`${stats.response_status}`);
    if (stats.transaction_duration_ms) parts.push(`${stats.transaction_duration_ms}ms`);
    if (stats.request_bytes) parts.push(`sent ${formatBytes(parseInt(stats.request_bytes, 10))}`);
    if (stats.response_bytes) parts.push(`recv ${formatBytes(parseInt(stats.response_bytes, 10))}`);
    const icon = status === "success" ? "OK" : "FAIL";
    return {
      summary: `${icon}: ${parts.join(", ")}`,
      category: "http",
    };
  }

  // --- Task finished ---
  if (msg.match(/Task <[A-F0-9-]+>\.\d+ finished successfully/i)) {
    return { summary: "Task completed", category: "task" };
  }
  if (msg.match(/Task <[A-F0-9-]+>\.\d+ response ended/i)) {
    return { summary: "Response complete", category: "task" };
  }
  if (msg.match(/Task <[A-F0-9-]+>\.\d+ done using Connection/i)) {
    return { summary: "Connection released", category: "task" };
  }

  return null;
}
