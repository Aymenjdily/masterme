import * as cheerio from "cheerio";

const FETCH_TIMEOUT_MS = 5000;
const MAX_CANDIDATES = 8;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function resolveUrl(maybeRelative: string, base: string): string | null {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

/** The same path + query, moved onto another origin (for og:image tags that point at an old domain). */
function rebase(imageUrl: string, origin: string): string | null {
  try {
    const u = new URL(imageUrl);
    return new URL(u.pathname + u.search, origin).toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, accept: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: accept },
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** True when the URL answers 2xx with an image content type. */
async function loadsAsImage(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url, "image/*");
    const ok = res.ok && (res.headers.get("content-type") ?? "").startsWith("image/");
    await res.body?.cancel();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Finds a preview image for a site and only returns one that actually loads.
 * Tries, in order: og:image, twitter:image, those paths on the site's real origin
 * (many sites point their tags at an old domain), apple-touch-icon, then icon links.
 * Never throws: returns null on any failure so a broken or slow site never blocks saving.
 */
export async function fetchPreviewImage(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, "text/html");
    if (!res.ok) return null;

    const finalUrl = res.url || url;
    const $ = cheerio.load(await res.text());

    const tagImages = [
      $('meta[property="og:image"]').attr("content"),
      $('meta[property="og:image:url"]').attr("content"),
      $('meta[name="twitter:image"]').attr("content"),
    ]
      .filter((v): v is string => !!v)
      .map((v) => resolveUrl(v, finalUrl))
      .filter((v): v is string => !!v);

    const origins = [...new Set([new URL(finalUrl).origin, new URL(url).origin])];
    const rebased = tagImages.flatMap((img) => origins.map((origin) => rebase(img, origin)));

    const icons = [
      ...$('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').map((_, el) => $(el).attr("href")).get(),
      ...$('link[rel="icon"], link[rel="shortcut icon"]').map((_, el) => $(el).attr("href")).get(),
    ]
      .map((href) => resolveUrl(href, finalUrl))
      .filter((v): v is string => !!v);

    const candidates = [...new Set([...tagImages, ...rebased, ...icons].filter((v): v is string => !!v))];

    // Cap the checks so a slow site can't hold up a save for long.
    for (const candidate of candidates.slice(0, MAX_CANDIDATES)) {
      if (await loadsAsImage(candidate)) return candidate;
    }
    return null;
  } catch (err) {
    console.error(`[og-preview] failed to fetch preview for ${url}:`, err);
    return null;
  }
}
