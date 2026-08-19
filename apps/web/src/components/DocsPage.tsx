import Link from "next/link";
import MiraeNav from "@/components/MiraeNav";
import { docSections, type DocBlock } from "@/content/docs";

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case "lead":
      return (
        <p className="font-serif text-[1.35rem] font-normal leading-[1.5] text-foreground">
          {block.text}
        </p>
      );
    case "paragraph":
      return (
        <p className="font-sans text-[1.02rem] font-normal leading-[1.85] text-black/75">
          {block.text}
        </p>
      );
    case "heading":
      return (
        <h3 className="pt-2 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-primary">
          {block.text}
        </h3>
      );
    case "list":
      return (
        <ul className="space-y-3">
          {block.items.map((item) => (
            <li
              key={item}
              className="flex gap-3 font-sans text-[1.02rem] font-normal leading-[1.75] text-black/75"
            >
              <span
                aria-hidden
                className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
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
              className="rounded-2xl border border-border bg-secondary/60 p-5 backdrop-blur-sm"
            >
              <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-foreground">
                {item.title}
              </p>
              <p className="mt-3 font-sans text-sm font-normal leading-[1.75] text-black/70">
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
              className="flex gap-4 font-sans text-[1.02rem] font-normal leading-[1.75] text-black/75"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[0.68rem] font-semibold text-primary">
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
                <span aria-hidden className="font-mono text-sm text-primary/60">
                  {">"}
                </span>
              )}
              <span className="rounded-full border border-border bg-secondary/70 px-4 py-2 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-foreground">
                {item}
              </span>
            </div>
          ))}
        </div>
      );
    case "note":
      return (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6">
          <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary">
            {block.title}
          </p>
          <ul className="mt-4 space-y-2.5">
            {block.items.map((item) => (
              <li
                key={item}
                className="flex gap-3 font-sans text-sm font-normal leading-[1.75] text-black/75"
              >
                <span
                  aria-hidden
                  className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-primary"
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
            <div key={item.label} className="rounded-2xl border border-border bg-secondary/50 p-5">
              <p className="font-serif text-[1.75rem] font-normal tracking-[-0.01em] text-primary">
                {item.value}
              </p>
              <p className="mt-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead>
              <tr className="bg-secondary/70">
                {block.head.map((cell) => (
                  <th
                    key={cell}
                    className="px-5 py-3.5 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-foreground"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join()} className="border-t border-border">
                  {row.map((cell, i) => (
                    <td
                      key={cell + i}
                      className={`px-5 py-4 font-sans text-sm leading-[1.65] ${
                        i === 0 ? "font-bold text-foreground" : "font-medium text-black/75"
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

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 flex justify-center px-4 py-5 sm:px-8">
        <MiraeNav />
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <section className="border-b border-border py-16 sm:py-20">
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-primary">
            Mirae Whitepaper . Version 1.0
          </p>
          <h1 className="mt-6 max-w-3xl font-serif text-[2.8rem] font-normal leading-[1.05] tracking-[-0.01em] text-foreground sm:text-[3.5rem]">
            Autonomous markets,{" "}
            <span className="italic text-primary">in your control.</span>
          </h1>
        </section>

        <div className="flex gap-14 pt-12">
          <aside className="hidden w-60 shrink-0 lg:block">
            <div className="sticky top-24">
              <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Contents
              </p>
              <nav className="mt-5 flex flex-col gap-1">
                {docSections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-baseline gap-3 rounded-lg px-3 py-2 font-sans text-sm font-medium text-black/70 transition-colors hover:bg-primary/8 hover:text-primary"
                  >
                    <span className="font-mono text-[0.66rem] font-semibold text-muted-foreground">
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
                className="scroll-mt-28 border-b border-border py-14 first:pt-0 last:border-b-0"
              >
                <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  <span className="text-primary">{section.index}</span> {section.kicker}
                </p>
                <h2 className="mt-4 max-w-2xl font-serif text-[2rem] font-normal leading-[1.15] tracking-[-0.01em] text-foreground sm:text-[2.35rem]">
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
              <div className="rounded-3xl border border-border bg-secondary/60 p-8 sm:p-10">
                <h2 className="font-serif text-[1.7rem] font-normal tracking-[-0.01em] text-foreground">
                  Ready to run it locally?
                </h2>
                <p className="mt-4 max-w-xl font-sans text-[1.02rem] font-normal leading-[1.8] text-black/75">
                  Install the workspace, connect an operating wallet, and review the first prepared
                  plan before signing it.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3.5 font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground shadow-soft transition-transform hover:-translate-y-0.5"
                  >
                    Open Workspace
                  </Link>
                  <a
                    href="https://x.com/projectmirae"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-border bg-background px-7 py-3.5 font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-secondary"
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
