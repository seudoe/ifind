"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

interface MarkdownMessageProps {
  content: string;
  isUser?: boolean;
  className?: string;
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "code"; language: string; code: string }
  | { type: "blockquote"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hr" }
  | { type: "paragraph"; text: string };

const INLINE_REGEX =
  /(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*\*[^*]+\*\*\*|___[^_]+___|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|(?<=\s|^)_[^_]+_(?=\s|$))/g;

function renderInline(text: string, isUser = false): React.ReactNode[] {
  if (!text) return [];
  const parts = text.split(INLINE_REGEX);

  return parts.map((part, index) => {
    if (!part) return null;

    // Inline code: `code`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const code = part.slice(1, -1);
      return (
        <code
          key={index}
          className={`font-mono text-[0.875em] px-1.5 py-0.5 rounded ${
            isUser
              ? "bg-blue-700/60 text-blue-50 border border-blue-400/20"
              : "bg-gray-200/80 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300/40"
          }`}
        >
          {code}
        </code>
      );
    }

    // Link: [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const safeHref = /^(https?:\/\/|mailto:|\/)/i.test(href) ? href : "#";
      return (
        <a
          key={index}
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline font-medium hover:opacity-80 inline-flex items-center gap-0.5 ${
            isUser ? "text-white underline-offset-2" : "text-blue-600 dark:text-blue-400"
          }`}
        >
          {label}
        </a>
      );
    }

    // Bold + Italic: ***text*** or ___text___
    if (
      (part.startsWith("***") && part.endsWith("***") && part.length >= 6) ||
      (part.startsWith("___") && part.endsWith("___") && part.length >= 6)
    ) {
      return (
        <strong key={index} className="font-bold italic">
          {part.slice(3, -3)}
        </strong>
      );
    }

    // Bold: **text** or __text__
    if (
      (part.startsWith("**") && part.endsWith("**") && part.length >= 4) ||
      (part.startsWith("__") && part.endsWith("__") && part.length >= 4)
    ) {
      return (
        <strong key={index} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Strikethrough: ~~text~~
    if (part.startsWith("~~") && part.endsWith("~~") && part.length >= 4) {
      return (
        <del key={index} className="opacity-70">
          {part.slice(2, -2)}
        </del>
      );
    }

    // Italic: *text* or _text_
    if (
      (part.startsWith("*") && part.endsWith("*") && part.length >= 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length >= 2)
    ) {
      return (
        <em key={index} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function renderInlineWithLineBreaks(text: string, isUser = false): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  lines.forEach((line, idx) => {
    if (idx > 0) {
      result.push(<br key={`br-${idx}`} />);
    }
    result.push(...renderInline(line, isUser));
  });
  return result;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="my-2.5 rounded-lg overflow-hidden border border-gray-700/60 bg-gray-950 text-gray-100 text-xs font-mono shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-800 text-[11px] text-gray-400">
        <span className="uppercase tracking-wider font-semibold">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors px-1.5 py-0.5 rounded hover:bg-gray-800"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function TableBlock({
  headers,
  rows,
  isUser,
}: {
  headers: string[];
  rows: string[][];
  isUser?: boolean;
}) {
  return (
    <div className="my-2.5 overflow-x-auto rounded-lg border border-gray-300 dark:border-gray-700 shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
        {headers.length > 0 && (
          <thead
            className={
              isUser
                ? "bg-blue-700/50 text-white font-semibold"
                : "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold"
            }
          >
            <tr>
              {headers.map((h, idx) => (
                <th key={idx} className="px-3 py-2 text-left">
                  {renderInlineWithLineBreaks(h, isUser)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-gray-200 dark:divide-gray-750">
          {rows.map((row, rIdx) => (
            <tr
              key={rIdx}
              className={
                rIdx % 2 === 0
                  ? isUser
                    ? "bg-blue-600/30"
                    : "bg-white dark:bg-gray-900"
                  : isUser
                    ? "bg-blue-600/50"
                    : "bg-gray-50/70 dark:bg-gray-850"
              }
            >
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3 py-2">
                  {renderInlineWithLineBreaks(cell, isUser)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced Code Block
    if (line.trim().startsWith("```")) {
      const match = line.trim().match(/^```([a-zA-Z0-9_-]*)/);
      const language = match ? match[1] : "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith("```")) {
        i++;
      }
      blocks.push({
        type: "code",
        language,
        code: codeLines.join("\n"),
      });
      continue;
    }

    // Heading: #..######
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // Horizontal Rule: ---, ***, ___
    if (/^(?:[-*_]\s*){3,}$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Blockquote: > text
    if (line.trim().startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(line.trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({
        type: "blockquote",
        lines: quoteLines,
      });
      continue;
    }

    // Table
    if (
      line.trim().startsWith("|") &&
      i + 1 < lines.length &&
      lines[i + 1].trim().startsWith("|") &&
      lines[i + 1].includes("---")
    ) {
      const splitCells = (row: string) =>
        row
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());

      const headers = splitCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitCells(lines[i]));
        i++;
      }
      blocks.push({
        type: "table",
        headers,
        rows,
      });
      continue;
    }

    // Unordered List: -, *, •
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ""));
        i++;
      }
      blocks.push({
        type: "ul",
        items,
      });
      continue;
    }

    // Ordered List: 1. , 2.
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({
        type: "ol",
        items,
      });
      continue;
    }

    // Regular Paragraph
    const pLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith(">") &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^(?:[-*_]\s*){3,}$/.test(lines[i].trim()) &&
      !(lines[i].trim().startsWith("|") && i + 1 < lines.length && lines[i + 1].includes("---"))
    ) {
      pLines.push(lines[i]);
      i++;
    }
    blocks.push({
      type: "paragraph",
      text: pLines.join("\n"),
    });
  }

  return blocks;
}

export function MarkdownMessage({
  content,
  isUser = false,
  className = "",
}: MarkdownMessageProps) {
  if (!content) return null;

  const blocks = parseBlocks(content);

  return (
    <div className={`space-y-2 text-sm leading-relaxed ${className}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "heading": {
            const headingContent = renderInlineWithLineBreaks(block.text, isUser);
            switch (block.level) {
              case 1:
                return (
                  <h1
                    key={idx}
                    className="text-base font-bold mt-3 mb-1.5 border-b pb-1 border-current/20 tracking-tight"
                  >
                    {headingContent}
                  </h1>
                );
              case 2:
                return (
                  <h2 key={idx} className="text-sm font-bold mt-2.5 mb-1 tracking-tight">
                    {headingContent}
                  </h2>
                );
              case 3:
                return (
                  <h3 key={idx} className="text-sm font-semibold mt-2 mb-1">
                    {headingContent}
                  </h3>
                );
              case 4:
              default:
                return (
                  <h4 key={idx} className="text-xs font-semibold mt-1.5 mb-0.5 uppercase tracking-wider opacity-90">
                    {headingContent}
                  </h4>
                );
            }
          }

          case "code":
            return (
              <CodeBlock
                key={idx}
                code={block.code}
                language={block.language}
              />
            );

          case "table":
            return (
              <TableBlock
                key={idx}
                headers={block.headers}
                rows={block.rows}
                isUser={isUser}
              />
            );

          case "ul":
            return (
              <ul key={idx} className="my-1.5 pl-5 list-disc space-y-1">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed">
                    {renderInlineWithLineBreaks(item, isUser)}
                  </li>
                ))}
              </ul>
            );

          case "ol":
            return (
              <ol key={idx} className="my-1.5 pl-5 list-decimal space-y-1">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed">
                    {renderInlineWithLineBreaks(item, isUser)}
                  </li>
                ))}
              </ol>
            );

          case "blockquote":
            return (
              <blockquote
                key={idx}
                className={`my-2 pl-3 border-l-4 italic py-0.5 ${
                  isUser
                    ? "border-blue-300 text-blue-100 bg-blue-700/30"
                    : "border-blue-500 text-gray-700 dark:text-gray-300 bg-blue-50/50 dark:bg-blue-950/20 rounded-r"
                }`}
              >
                {block.lines.map((l, lIdx) => (
                  <p key={lIdx} className="leading-relaxed">
                    {renderInlineWithLineBreaks(l, isUser)}
                  </p>
                ))}
              </blockquote>
            );

          case "hr":
            return <hr key={idx} className="my-2.5 border-current opacity-20" />;

          case "paragraph":
          default:
            return (
              <p key={idx} className="leading-relaxed first:mt-0 last:mb-0">
                {renderInlineWithLineBreaks(block.text, isUser)}
              </p>
            );
        }
      })}
    </div>
  );
}
