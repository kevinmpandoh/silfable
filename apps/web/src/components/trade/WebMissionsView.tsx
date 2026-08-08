"use client";

import type { SessionItem } from "@/lib/db";

type WebMissionsViewProps = {
  sessions: SessionItem[];
  onCreateMission: () => void;
  onOpenSession: (sessionId: string) => void;
};

function formatWorkspace(session: SessionItem): string {
  return session.workspace === "evm" ? "Robinhood Chain" : "Solana";
}

export function WebMissionsView({ sessions, onCreateMission, onOpenSession }: WebMissionsViewProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex h-full flex-col items-start justify-center px-[clamp(40px,9vw,120px)]">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#7ba2ff]">Missions</p>
        <h1 className="mt-2 max-w-[720px] text-[clamp(42px,5vw,80px)] font-semibold leading-[.95] tracking-[-0.055em] text-[#eef2ff]">No mission contracts yet.</h1>
        <p className="mt-[18px] max-w-[620px] text-sm leading-7 text-[#7f8aa7]">Create a Mission session and provide exact token amounts, slippage limit, deadline, and stop conditions. Every Mainnet transaction will remain bound to its browser wallet.</p>
        <button type="button" onClick={onCreateMission} className="mt-7 rounded-full border border-[#3157ff] bg-[#3157ff]/15 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.13em] text-[#dce5ff] transition hover:bg-[#3157ff]/30">
          Create Mission session
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-[clamp(38px,6vw,82px)] py-[clamp(38px,6vw,82px)]">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#7ba2ff]">Missions</p>
          <h1 className="my-2 text-[42px] font-semibold tracking-[-0.04em] text-[#eef2ff]">Contract previews</h1>
          <p className="max-w-xl text-sm leading-6 text-[#7f8aa7]">Open an eligible session to review its constrained plan and explicitly approve a restricted Mainnet action.</p>
        </div>
        <button type="button" onClick={onCreateMission} className="rounded-full border border-[#3157ff] bg-[#3157ff]/15 px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.13em] text-[#dce5ff] transition hover:bg-[#3157ff]/30">
          + New mission
        </button>
      </div>

      <div className="mt-[30px] grid grid-cols-[repeat(auto-fill,minmax(250px,320px))] justify-start gap-3">
        {sessions.map((session) => (
          <button key={session.id} type="button" onClick={() => onOpenSession(session.id)} className="flex min-h-[150px] flex-col items-start gap-[9px] rounded-[10px] border border-[rgba(123,162,255,0.22)] bg-[#111629] p-[18px] text-left text-[#e8ecf8] transition hover:-translate-y-px hover:border-[#3157ff]">
            <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#62b8ff]">Mission session</span>
            <strong className="text-sm leading-[1.4]">{session.title}</strong>
            <small className="text-[9px] text-[#7f8aa7]">{formatWorkspace(session)} · {new Date(session.updatedAt).toLocaleString()}</small>
            <em className="mt-auto font-mono text-[8px] uppercase tracking-[0.12em] text-[#62b8ff] not-italic">Open session</em>
          </button>
        ))}
      </div>
    </div>
  );
}
