import assert from "node:assert/strict";
import test from "node:test";

import { describePumpLaunchSimulationError } from "./solana-simulation-error";

test("reports the failing instruction and custom program code", () => {
    assert.equal(describePumpLaunchSimulationError(
      { InstructionError: [2, { Custom: 6002 }] },
      ["Program log: AnchorError caused by account: global. Error Code: InvalidGlobal."],
    ),
      "Pump.fun rejected the unsigned launch simulation at instruction 2 (program code 6002): AnchorError caused by account: global. Error Code: InvalidGlobal. Nothing was signed or broadcast.",
    );
});

test("keeps insufficient-balance guidance readable", () => {
    assert.match(describePumpLaunchSimulationError(
      { InstructionError: [1, "Custom"] },
      ["Program log: insufficient funds"],
    ), /insufficient SOL/u);
});

test("does not append arbitrary successful program logs", () => {
    assert.equal(describePumpLaunchSimulationError(
      { InstructionError: [1, "InvalidAccountData"] },
      ["Program log: Instruction: CreateV2"],
    ),
      "Pump.fun rejected the unsigned launch simulation at instruction 1. Nothing was signed or broadcast.",
    );
});
