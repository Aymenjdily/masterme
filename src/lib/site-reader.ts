import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import * as cheerio from "cheerio";
import { imageCandidates, loadsAsImage } from "@/lib/og-preview";

// Server-only. Reads a public web page for the AI: title, description, visible text and cover images.
// Only public http(s) hosts are fetched (no localhost / private networks), with size and time limits.

const TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 2_000_000;
const MAX_TEXT_CHARS = 12_000;
const MAX_REDIRECTS = 3;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function privateAddress(ip: string) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return privateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** Throws unless the URL is http(s) on a host that resolves only to public addresses. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That doesn't look like a web address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https links are supported.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw new Error("Local addresses can't be read.");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new Error("That site couldn't be found.");
  if (addresses.some((a) => privateAddress(a.address))) throw new Error("Private network addresses can't be read.");
  return url;
}

/** fetch() that re-checks every redirect hop against the public-address rule. */
export async function safeFetch(raw: string, accept: string): Promise<Response> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: accept },
        redirect: "manual",
        signal: controller.signal,
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel();
        url = await assertPublicUrl(new URL(location, url).toString());
        continue;
      }
      Object.defineProperty(res, "url", { value: url.toString() });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Too many redirects.");
}

async function readCapped(res: Response, maxBytes: number) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export type SiteRead = {
  url: string;
  finalUrl: string;
  title: string | null;
  description: string | null;
  text: string;
  words: number;
  /** Mostly a login form or nearly empty: only the title and image are useful */
  loginOnly: boolean;
  /** Cover image candidates that really load, best first */
  images: string[];
};

export async function readSite(raw: string): Promise<SiteRead> {
  const res = await safeFetch(raw, "text/html,application/xhtml+xml");
  if (!res.ok) throw new Error(`The site answered ${res.status}.`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("html")) throw new Error("That link isn't a web page.");

  const finalUrl = res.url || raw;
  const $ = cheerio.load(await readCapped(res, MAX_HTML_BYTES));

  const meta = (sel: string) => $(sel).attr("content")?.trim() || null;
  const title = meta('meta[property="og:title"]') || $("title").first().text().trim() || null;
  const description = meta('meta[property="og:description"]') || meta('meta[name="description"]');
  const hasPassword = $('input[type="password"]').length > 0;
  // Covers only: favicons and touch icons make poor portfolio images.
  const candidates = imageCandidates($, finalUrl, raw).filter((u) => !/favicon|apple-touch|[/-]icon[\w-]*\.|\.ico(\?|$)/i.test(u));

  $("script, style, noscript, svg, template, iframe, nav, footer, form").remove();
  const text = ($("main").text() || $("body").text()).replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
  const words = text ? text.split(" ").length : 0;

  const images: string[] = [];
  for (const candidate of candidates.slice(0, 6)) {
    if (images.length >= 3) break;
    if (await loadsAsImage(candidate)) images.push(candidate);
  }

  return { url: raw, finalUrl, title, description, text, words, loginOnly: (hasPassword && words < 250) || words < 40, images };
}
