type AuditOutcome = "success" | "failure" | "blocked";

type SafeAuditFields = {
  operation?: string;
  outcome?: AuditOutcome;
  count?: number;
  code?: string;
  retryAt?: string;
};

const OPERATION = /^[a-z0-9_:-]{1,80}$/u;
const CODE = /^[A-Z0-9_:-]{1,80}$/u;

/** Process diagnostics with a tiny field allowlist; do not pass Error objects or user/provider payloads here. */
export function writeSafeAuditLog(event: string, fields: SafeAuditFields = {}): void {
  if (!OPERATION.test(event)) throw new Error("Audit event must use a bounded machine-readable name.");
  const payload: Record<string, string | number> = { timestamp: new Date().toISOString(), event };
  if (fields.operation !== undefined && OPERATION.test(fields.operation)) payload.operation = fields.operation;
  if (fields.outcome !== undefined) payload.outcome = fields.outcome;
  if (fields.count !== undefined && Number.isInteger(fields.count) && fields.count >= 0) payload.count = fields.count;
  if (fields.code !== undefined && CODE.test(fields.code)) payload.code = fields.code;
  if (fields.retryAt !== undefined && /^\d{4}-\d{2}-\d{2}T/u.test(fields.retryAt)) payload.retryAt = fields.retryAt;
  console.info(JSON.stringify(payload));
}
