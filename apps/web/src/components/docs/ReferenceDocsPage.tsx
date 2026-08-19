import Link from "next/link";
import { docSections, type DocBlock } from "@/content/reference-docs";

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case "lead":
      return (
        <p className="font-display text-lg font-semibold leading-[1.65] text-[#20212a]">
          {block.text}
        </p>
      );
    case "paragraph":
      return (
        <p className="font-display text-base font-medium leading-[1.8] text-black/80">
          {block.text}
        </p>
      );
    case "heading":
      return (
        <h3 className="pt-2 font-display text-[0.72rem] font-bold uppercase tracking-[0.22em] text-[#df6b22]">
          {block.text}
        </h3>
      );
    case "list":
      return (
        <ul className="space-y-3">
          {block.items.map((item) => (
            <li
              key={item}
              className="flex gap-3 font-display text-base font-medium leading-[1.7] text-black/80"
            >
              <span
                aria-hidden
                className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#df6b22]"
              />
              {item}
            </li>
          ))}
        </ul>
      );
    case "cards":
      return (
        <div className="grid gap-4 sm:grid-cols-3">
          {block.items.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-black/10 bg-[#f4f4f1]/60 p-5 backdrop-blur-sm"
            >
              <p className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#20212a]">
                {item.title}
              </p>
              <p className="mt-3 font-display text-sm font-medium leading-[1.7] text-black/70">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      );
    case "steps":
      return (
        <ol className="space-y-3">
          {block.items.map((item, i) => (
            <li
              key={item}
              className="flex gap-4 font-display text-base font-medium leading-[1.7] text-black/80"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#df6b22]/10 font-display text-[0.7rem] font-bold text-[#df6b22]">
                {String(i + 1).padStart(2, "0")}
              </span>
              {item}
            </li>
          ))}
        </ol>
      );
    case "flow":
      return (
        <div className="flex flex-wrap items-center gap-2">
          {block.items.map((item, i) => (
            <div key={item} className="flex items-center gap-2">
              {i > 0 && (
                <span aria-hidden className="font-display text-sm text-[#df6b22]/60">
                  {">"}
                </span>
              )}
              <span className="rounded-full border border-black/10 bg-[#f4f4f1]/70 px-4 py-2 font-display text-[0.72rem] font-bold uppercase tracking-[0.1em] text-[#20212a]">
                {item}
              </span>
            </div>
          ))}
        </div>
      );
    case "note":
      return (
        <div className="rounded-2xl border border-[#df6b22]/25 bg-[#df6b22]/5 p-6">
          <p className="font-display text-[0.72rem] font-bold uppercase tracking-[0.2em] text-[#df6b22]">
            {block.title}
          </p>
          <ul className="mt-4 space-y-2.5">
            {block.items.map((item) => (
              <li
                key={item}
                className="flex gap-3 font-display text-sm font-medium leading-[1.7] text-black/80"
              >
                <span
                  aria-hidden
                  className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-[#df6b22]"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      );
    case "stats":
      return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {block.items.map((item) => (
            <div key={item.label} className="rounded-2xl border border-black/10 bg-[#f4f4f1]/50 p-5">
              <p className="font-display text-xl font-bold tracking-[-0.01em] text-[#df6b22]">
                {item.value}
              </p>
              <p className="mt-2 font-display text-[0.72rem] font-bold uppercase tracking-[0.12em] text-[#686970]">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-2xl border border-black/10">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead>
              <tr className="bg-[#f4f4f1]/70">
                {block.head.map((cell) => (
                  <th
                    key={cell}
                    className="px-5 py-3.5 font-display text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#20212a]"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join()} className="border-t border-black/10">
                  {row.map((cell, i) => (
                    <td
                      key={cell + i}
                      className={`px-5 py-4 font-display text-sm leading-[1.6] ${
                        i === 0 ? "font-bold text-[#20212a]" : "font-medium text-black/75"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

export default function ReferenceDocsPage() {
  return (
    <div className="min-h-screen bg-[#fbfbfa] pt-24">
      <div className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <section className="border-b border-black/10 py-16 sm:py-20">
          <p className="font-display text-[0.7rem] font-bold uppercase tracking-[0.32em] text-[#df6b22]">
            Mirae Whitepaper
          </p>
          <h1 className="mt-6 max-w-3xl font-serif text-[2.8rem] font-normal leading-[1.05] tracking-[-0.01em] text-[#20212a] sm:text-[3.5rem]">
            How the workspace turns intent into{" "}
            <span className="italic text-[#df6b22]">verified execution.</span>
          </h1>

          <p className="mt-7 max-w-2xl font-display text-base font-medium leading-[1.8] text-black/80">
            A complete reference for operators. It explains the runtime loop, the approval model,
            how routes are planned and settled, how automation stays bounded, and what the project
            does and does not claim today.
          </p>
        </section>

        <div className="flex gap-14 pt-12">
          <aside className="hidden w-60 shrink-0 lg:block">
            <div className="sticky top-24">
              <p className="font-display text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#686970]">
                Contents
              </p>
              <nav className="mt-5 flex flex-col gap-1">
                {docSections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-baseline gap-3 rounded-lg px-3 py-2 font-display text-sm font-semibold text-black/70 transition-colors hover:bg-[#df6b22]/8 hover:text-[#df6b22]"
                  >
                    <span className="font-display text-[0.68rem] font-bold text-[#686970]">
                      {section.index}
                    </span>
                    {section.kicker}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            {docSections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-28 border-b border-black/10 py-14 first:pt-0 last:border-b-0"
              >
                <p className="font-display text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[#686970]">
                  <span className="text-[#df6b22]">{section.index}</span> {section.kicker}
                </p>
                <h2 className="mt-4 max-w-2xl font-serif text-[2rem] font-normal leading-[1.15] tracking-[-0.01em] text-[#20212a] sm:text-[2.35rem]">
                  {section.title}
                </h2>
                <div className="mt-7 space-y-6">
                  {section.blocks.map((block, i) => (
                    <Block key={i} block={block} />
                  ))}
                </div>
              </section>
            ))}

            <footer className="py-14">
              <div className="rounded-3xl border border-black/10 bg-[#f4f4f1]/60 p-8 sm:p-10">
                <h2 className="font-serif text-[1.7rem] font-normal tracking-[-0.01em] text-[#20212a]">
                  Ready to run it locally?
                </h2>
                <p className="mt-4 max-w-xl font-display text-base font-medium leading-[1.75] text-black/75">
                  Install the workspace, connect an operating wallet, and review the first prepared
                  plan before signing it.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-full bg-[#df6b22] px-8 py-3.5 font-display text-sm font-bold uppercase tracking-[0.12em] text-white shadow-[0_18px_40px_-18px_rgba(223,107,34,0.42)] transition-transform hover:-translate-y-0.5"
                  >
                    Open Workspace
                  </Link>
                  <a
                    href="https://x.com/projectmirae"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-black/10 bg-[#fbfbfa] px-7 py-3.5 font-display text-sm font-semibold uppercase tracking-[0.1em] text-[#20212a] transition-colors hover:bg-[#f4f4f1]"
                  >
                    Follow Updates
                  </a>
                </div>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
