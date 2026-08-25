import type { ReactNode, RefObject } from "react";
import Image from "next/image";
import type { WebMessage } from "@/lib/db";

interface TradeMessageFeedProps {
  messages: WebMessage[];
  activeSessionId: string;
  loading: boolean;
  viewportRef: RefObject<HTMLDivElement | null>;
  renderProposal: (message: WebMessage) => ReactNode;
}

function formatMessageTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isLegacyProgressMessage(message: WebMessage): boolean {
  if (message.role !== "assistant" || message.proposal) return false;
  return /^(?:Exact USDG approval confirmed\.|Bridge source transaction confirmed on Robinhood Chain\.|Robinhood (?:→|â†’) Solana bridge confirmed after independent Solana USDC balance verification\.)/u.test(message.content.trim());
}

function renderInlineMarkdown(text: string): ReactNode[] {
  // Regex to match code spans, markdown links, bold-italic, bold, strikethrough, and single italic (asterisk or underscore)
  const pattern = /(```[\s\S]*?```|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n\s](?:[^*\n]*[^*\n\s])?\*|_[^_\n\s](?:[^_\n]*[^_\n\s])?_)/gu;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }
    const token = match[0];
    if (token.startsWith("```") && token.endsWith("```")) {
      nodes.push(
        <pre key={`${start}-pre`} className="my-1.5 overflow-x-auto rounded-lg bg-[rgb(32,33,42,0.06)] p-2.5 font-mono text-xs text-[#20212a]">
          <code>{token.slice(3, -3).trim()}</code>
        </pre>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code key={`${start}-code`} className="rounded bg-[rgb(32,33,42,0.06)] px-1.5 py-0.5 font-mono text-xs text-[#df6b22]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("***") && token.endsWith("***")) {
      nodes.push(
        <strong key={`${start}-bi`}>
          <em>{token.slice(3, -3)}</em>
        </strong>,
      );
    } else if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
      nodes.push(<strong key={`${start}-strong`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      nodes.push(<del key={`${start}-del`}>{token.slice(2, -2)}</del>);
    } else if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
      nodes.push(<em key={`${start}-em`}>{token.slice(1, -1)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/u.exec(token);
      nodes.push(
        link ? (
          <a key={`${start}-link`} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-[#df6b22] underline hover:text-[#c95b18]">
            {link[1]}
          </a>
        ) : (
          token
        ),
      );
    }
    cursor = start + token.length;
  }
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return nodes;
}

function renderMessageContent(content: string): ReactNode[] {
  return content
    .split(/\n+/u)
    .filter(Boolean)
    .map((line, index) => {
      const trimmed = line.trim();

      // Heading 4
      if (trimmed.startsWith("#### ")) {
        return (
          <h4 key={`${trimmed}-${index}`} className="mt-3 mb-1 text-sm font-semibold text-[#20212a]">
            {renderInlineMarkdown(trimmed.replace(/^####\s+/u, ""))}
          </h4>
        );
      }

      // Heading 3
      if (trimmed.startsWith("### ")) {
        return (
          <h3 key={`${trimmed}-${index}`} className="mt-3.5 mb-1 text-base font-bold text-[#20212a]">
            {renderInlineMarkdown(trimmed.replace(/^###\s+/u, ""))}
          </h3>
        );
      }

      // Heading 2
      if (trimmed.startsWith("## ")) {
        return (
          <h2 key={`${trimmed}-${index}`} className="mt-4 mb-1 text-lg font-bold text-[#20212a]">
            {renderInlineMarkdown(trimmed.replace(/^##\s+/u, ""))}
          </h2>
        );
      }

      // Heading 1
      if (trimmed.startsWith("# ")) {
        return (
          <h2 key={`${trimmed}-${index}`} className="mt-4 mb-1.5 text-xl font-bold text-[#20212a]">
            {renderInlineMarkdown(trimmed.replace(/^#\s+/u, ""))}
          </h2>
        );
      }

      // Blockquotes (> Quote text)
      if (trimmed.startsWith(">")) {
        const quoteText = trimmed.replace(/^>+\s*/u, "");
        return (
          <blockquote
            key={`${trimmed}-${index}`}
            className="my-2 rounded-r border-l-2 border-[#df6b22] bg-[rgb(223,107,34,0.06)] py-1.5 pl-3 text-xs leading-5 text-[#52545d]"
          >
            {renderInlineMarkdown(quoteText)}
          </blockquote>
        );
      }

      // Horizontal rules (---, ***, ___)
      if (/^[-*_]{3,}$/u.test(trimmed)) {
        return <hr key={`${trimmed}-${index}`} className="my-3 border-t border-[rgb(32,33,42,0.12)]" />;
      }

      // Bullet lists (-, *, +, •). The marker and the text sit in separate spans
      // so a wrapped line stays aligned under its own text column.
      if (/^[-*+•]\s+/u.test(trimmed)) {
        return (
          <p key={`${trimmed}-${index}`} className="messageBullet">
            <span className="messageMarker" aria-hidden="true">•</span>
            <span className="messageBulletText">{renderInlineMarkdown(trimmed.replace(/^[-*+•]\s+/u, ""))}</span>
          </p>
        );
      }

      // Numbered lists (1., 2., 1), etc.)
      if (/^\d+[.)]\s+/u.test(trimmed)) {
        const match = /^(\d+[.)])\s+(.+)$/u.exec(trimmed);
        return (
          <p key={`${trimmed}-${index}`} className="messageBullet">
            <span className="messageMarker">{match?.[1]}</span>
            <span className="messageBulletText">{renderInlineMarkdown(match?.[2] ?? trimmed)}</span>
          </p>
        );
      }

      return <p key={`${trimmed}-${index}`}>{renderInlineMarkdown(trimmed)}</p>;
    });
}

export function TradeMessageFeed({ messages, activeSessionId, loading, viewportRef, renderProposal }: TradeMessageFeedProps) {
  return (
    <div className="messages" ref={viewportRef}>
      {messages
        .filter((message) => message.sessionId === activeSessionId && !isLegacyProgressMessage(message))
        .map((message) => (
          <article key={message.id} className={message.role}>
            {message.role === "assistant" && (
              <span className="avatar" role="img" aria-label="Mirae AI">
                <Image
                  className="avatarLogo"
                  src="/mirae-logo.png"
                  alt=""
                  width={26}
                  height={26}
                  aria-hidden="true"
                />
              </span>
            )}
            <div>
              <small className="mb-1.5 block text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
                {message.role === "user" ? "You" : "Mirae"} <span aria-hidden="true">·</span>{" "}
                <time dateTime={new Date(message.createdAt).toISOString()}>{formatMessageTime(message.createdAt)}</time>
              </small>
              <div className="markdownMessage">{renderMessageContent(message.content)}</div>
              {renderProposal(message)}
            </div>
          </article>
        ))}
      {loading && (
        <div className="typingIndicator">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}
