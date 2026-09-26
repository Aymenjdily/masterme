// Checks the markdown → Portable Text converter against the blog's schema. Usage: npm run check:pt
import assert from "node:assert/strict";
import { markdownToBlocks, sectionsToPortableText, slugify, wordCount } from "@/lib/portable-text";

type Loose = {
  _type: string;
  _key: string;
  style?: string;
  listItem?: string;
  level?: number;
  markDefs?: unknown[];
  children: { text: string; marks: string[] }[];
  language?: string;
  code?: string;
};

const blocks = markdownToBlocks(
  [
    "First line of a paragraph",
    "continues here with **bold** and `code`.",
    "",
    "### A subheading",
    "- one",
    "* two with [a link](https://x.dev)",
    "",
    "```ts",
    "const a = 1;",
    "",
    "console.log(a);",
    "```",
    "Last paragraph.",
  ].join("\n")
);

const [p, h3, li1, li2, code, last] = blocks as unknown as Loose[];
assert.equal(blocks.length, 6);
assert.equal(p.style, "normal");
assert.deepEqual(
  p.children.map((c) => [c.text, c.marks]),
  [["First line of a paragraph continues here with ", []], ["bold", ["strong"]], [" and code.", []]]
);
assert.equal(h3.style, "h3");
assert.equal(h3.children[0].text, "A subheading");
assert.equal(li1.listItem, "bullet");
assert.equal(li1.level, 1);
assert.equal(li2.children[0].text, "two with a link");
assert.equal(code._type, "code");
assert.equal(code.language, "typescript");
assert.equal(code.code, "const a = 1;\n\nconsole.log(a);");
assert.equal(last.children[0].text, "Last paragraph.");
for (const b of blocks as unknown as Loose[]) {
  assert.ok(b._key && b._key.length === 12, "every block has a _key");
  if (b._type === "block") assert.deepEqual(b.markDefs, []);
}

const body = sectionsToPortableText([{ heading: "Intro", markdown: "Hello." }, { heading: "Next", markdown: "- a" }]);
assert.deepEqual(
  (body as unknown as Loose[]).map((b) => (b._type === "block" ? `${b.style}${b.listItem ? ":bullet" : ""}` : b._type)),
  ["h2", "normal", "h2", "normal:bullet"]
);

assert.equal(slugify("How I Built BuildformAI in 120 Hours — à la Next.js!"), "how-i-built-buildformai-in-120-hours-a-la-next-js");
assert.equal(wordCount([{ heading: "Two words", markdown: "three more words\n```js\nignored code\n```" }]), 5);

console.log("portable-text: all checks passed");
