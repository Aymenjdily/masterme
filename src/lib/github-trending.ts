export type GithubActivityItem = {
  title: string;
  url: string;
  description: string | null;
  publishedDate: Date | null;
};

type GithubSearchRepo = {
  full_name: string;
  html_url: string;
  description: string | null;
  pushed_at: string | null;
};

type GithubSearchResponse = {
  items: GithubSearchRepo[];
};

/**
 * Uses GitHub's public Search API (not the unofficial /trending page, which only
 * supports language slugs) so both languages and framework/library keywords work
 * the same way. Sorted by most-recently-pushed, which matches "latest updates"
 * better than a stars-based trending list.
 */
export async function fetchGithubActivity(
  keyword: string,
  { perPage = 10 }: { perPage?: number } = {}
): Promise<GithubActivityItem[]> {
  const url = new URL("https://api.github.com/search/repositories");
  // A minimum star count filters out noise (throwaway/auto-generated repos that
  // happen to have been pushed recently) so results actually reflect ecosystem activity.
  url.searchParams.set("q", `${keyword} stars:>50`);
  url.searchParams.set("sort", "updated");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(perPage));

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      console.error(
        `[github-trending] request failed for "${keyword}": ${res.status} ${res.statusText}`
      );
      return [];
    }

    const data = (await res.json()) as GithubSearchResponse;

    return data.items.map((repo) => ({
      title: repo.full_name,
      url: repo.html_url,
      description: repo.description,
      publishedDate: repo.pushed_at ? new Date(repo.pushed_at) : null,
    }));
  } catch (err) {
    console.error(`[github-trending] network error for "${keyword}":`, err);
    return [];
  }
}
