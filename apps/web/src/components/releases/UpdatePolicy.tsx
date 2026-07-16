const channels = [
  { name: "Stable", cadence: "Recommended", description: "Signed releases promoted after compatibility and recovery testing." },
  { name: "Preview", cadence: "Opt-in", description: "Early access to new adapters and policy features. Receipt formats may evolve." },
  { name: "Nightly", cadence: "Developers", description: "Automated builds for integration testing. Never recommended for funded missions." },
];

export function UpdatePolicy() {
  return (
    <section className="border-t border-black/15 py-20 sm:py-28">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-electric">Distribution policy</p>
      <h2 className="mt-5 max-w-3xl font-serif text-5xl leading-[0.95] tracking-[-0.05em] sm:text-6xl">Choose how close you run to the edge.</h2>
      <div className="mt-12 grid border-t border-l border-black/15 md:grid-cols-3">
        {channels.map((channel) => (
          <div key={channel.name} className="border-r border-b border-black/15 p-7">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-serif text-3xl tracking-[-0.04em]">{channel.name}</h3>
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-electric">{channel.cadence}</span>
            </div>
            <p className="mt-12 text-sm leading-7 text-black/50">{channel.description}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 border-l-2 border-electric bg-blue-50 p-5 text-sm leading-7 text-blue-950">
        Silfable never auto-starts a mission after an update. Review the release notes, reopen the runtime, and authorize each mission explicitly.
      </div>
    </section>
  );
}
