import { Fragment } from "react";
import { markdownToBlocks, type PortableSpan } from "@/lib/portable-text";

// Renders a section's markdown exactly as it will be stored in Sanity (same converter as the send route).

function Spans({ spans }: { spans: PortableSpan[] }) {
  return (
    <>
      {spans.map((s) => (s.marks.includes("strong") ? <strong key={s._key} className="font-semibold">{s.text}</strong> : <Fragment key={s._key}>{s.text}</Fragment>))}
    </>
  );
}

export function SectionBody({ markdown }: { markdown: string }) {
  const blocks = markdownToBlocks(markdown);
  const out: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  const flushList = () => {
    if (list.length) out.push(<ul key={`ul-${out.length}`} className="mt-2 list-disc space-y-0.5 pl-5">{list}</ul>);
    list = [];
  };

  for (const block of blocks) {
    if (block._type === "block" && block.listItem) {
      list.push(
        <li key={block._key}>
          <Spans spans={block.children} />
        </li>
      );
      continue;
    }
    flushList();
    if (block._type === "code") {
      out.push(
        <pre key={block._key} className="relative mt-2.5 overflow-x-auto rounded-[10px] bg-foreground px-3.5 py-3 font-mono text-[0.78rem] leading-relaxed text-background">
          <span className="absolute top-2 right-2.5 text-[0.625rem] tracking-wider text-background/50 uppercase">{block.language}</span>
          <code>{block.code}</code>
        </pre>
      );
    } else if (block.style === "h3") {
      out.push(
        <h4 key={block._key} className="mt-3.5 text-[0.9375rem] font-semibold">
          <Spans spans={block.children} />
        </h4>
      );
    } else {
      out.push(
        <p key={block._key} className="mt-2">
          <Spans spans={block.children} />
        </p>
      );
    }
  }
  flushList();
  return <div className="text-sm leading-[1.7] text-foreground/90">{out}</div>;
}
