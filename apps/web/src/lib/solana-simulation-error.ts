type InstructionFailure = {
  index: number | null;
  customCode: number | null;
};

export function describePumpLaunchSimulationError(error: unknown, logs: string[] | null): string {
  const evidence = `${safeStringify(error)} ${(logs ?? []).join(" ")}`;
  if (/insufficient funds/iu.test(evidence)) {
    return "Creator wallet has insufficient SOL for the creator buy, account rent, and network fee. Nothing was signed or broadcast.";
  }
  if (/already in use|already initialized/iu.test(evidence)) {
    return "The generated mint already exists; prepare a fresh launch.";
  }

  const failure = readInstructionFailure(error);
  const programMessage = relevantProgramMessage(logs);
  const location = failure.index === null ? "" : ` at instruction ${failure.index}`;
  const code = failure.customCode === null ? "" : ` (program code ${failure.customCode})`;
  const detail = programMessage ? `: ${programMessage}` : ".";
  return `Pump.fun rejected the unsigned launch simulation${location}${code}${detail} Nothing was signed or broadcast.`;
}

function readInstructionFailure(error: unknown): InstructionFailure {
  if (!error || typeof error !== "object" || !("InstructionError" in error)) {
    return { index: null, customCode: null };
  }
  const instructionError = (error as { InstructionError?: unknown }).InstructionError;
  if (!Array.isArray(instructionError) || typeof instructionError[0] !== "number") {
    return { index: null, customCode: null };
  }
  const reason = instructionError[1];
  const customCode = reason && typeof reason === "object" && "Custom" in reason
    && typeof (reason as { Custom?: unknown }).Custom === "number"
    ? (reason as { Custom: number }).Custom
    : null;
  return { index: instructionError[0], customCode };
}

function relevantProgramMessage(logs: string[] | null): string | null {
  const candidates = (logs ?? []).filter((line) =>
    /AnchorError|Error Code|Error Message|custom program error|Program log: Error|failed:/iu.test(line),
  );
  const last = candidates.at(-1);
  if (!last) return null;
  return last
    .replace(/^Program log:\s*/iu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 220);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
