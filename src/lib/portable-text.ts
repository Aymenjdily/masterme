// Light markdown (what the AI writes and you edit) ↔ Portable Text matching the blog's schema:
// block styles normal / h2 / h3, bullet lists (level 1), the "strong" mark, and code blocks.
// Pure functions: used on the server (sending to Sanity) and in the browser (preview).

export type PortableSpan = { _type: "span"; _key: string; text: string; marks: string[] };
export type PortableTextBlock = {
  _type: "block";
  _key: string;
  style: "normal" | "h2" | "h3";
  markDefs: never[];
  children: PortableSpan[];
  listItem?: "bullet";
  level?: number;
};
export type PortableCodeBlock = { _type: "code"; _key: string; language: string; code: string };
export type PortableBlock = PortableTextBlock | PortableCodeBlock;

export type BlogSection = { heading: string; markdown: string };

const LANGUAGE_ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  sh: "sh",
  bash: "sh",
  shell: "sh",
  zsh: "sh",
  cmd: "batchfile",
  yml: "yaml",
  py: "python",
  md: "markdown",
};

function key() {
  return Math.random().toString(36).slice(2, 14).padEnd(12, "0");
}

/** "**bold** text" → spans with the strong mark. Inline code backticks and link syntax become plain text. */
export function inlineSpans(text: string): PortableSpan[] {
  const clean = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/`([^`]+)`/g, "$1");
  const spans: PortableSpan[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (let m = re.exec(clean); m; m = re.exec(clean)) {
    if (m.index > last) spans.push({ _type: "span", _key: key(), text: clean.slice(last, m.index), marks: [] });
    spans.push({ _type: "span", _key: key(), text: m[1], marks: ["strong"] });
    last = m.index + m[0].length;
  }
  if (last < clean.length || spans.length === 0) spans.push({ _type: "span", _key: key(), text: clean.slice(last), marks: [] });
  return spans;
}

function textBlock(style: PortableTextBlock["style"], text: string, bullet = false): PortableTextBlock {
  return {
    _type: "block",
    _key: key(),
    style,
    markDefs: [],
    children: inlineSpans(text.trim()),
    ...(bullet ? { listItem: "bullet" as const, level: 1 } : {}),
  };
}

/** One section's markdown → blocks (the section heading is added separately as h2). */
export function markdownToBlocks(markdown: string): PortableBlock[] {
  const blocks: PortableBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push(textBlock("normal", paragraph.join(" ")));
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```\s*([\w+-]*)\s*$/);
    if (fence) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !/^\s*```\s*$/.test(lines[i]); i++) code.push(lines[i]);
      const lang = fence[1].toLowerCase();
      blocks.push({ _type: "code", _key: key(), language: LANGUAGE_ALIASES[lang] ?? (lang || "text"), code: code.join("\n") });
      continue;
    }
    const heading = line.match(/^\s*#{2,6}\s+(.*)$/);
    if (heading) {
      flush();
      blocks.push(textBlock("h3", heading[1]));
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      flush();
      blocks.push(textBlock("normal", bullet[1], true));
      continue;
    }
    if (!line.trim()) flush();
    else paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

/** Whole post body: each section as an h2 heading followed by its content. */
export function sectionsToPortableText(sections: BlogSection[]): PortableBlock[] {
  return sections.flatMap((s) => [
    ...(s.heading.trim() ? [textBlock("h2", s.heading)] : []),
    ...markdownToBlocks(s.markdown),
  ]);
}

export function wordCount(sections: BlogSection[]) {
  return sections
    .map((s) => `${s.heading} ${s.markdown.replace(/```[\s\S]*?```/g, "")}`)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

export function slugify(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}
