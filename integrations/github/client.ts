/**
 * @file integrations/github/client.ts
 * @description Live GitHub integration — fetches issues and PRs from the configured repo.
 *
 * Env vars required:
 *   GITHUB_TOKEN   – Personal Access Token (repo scope)
 *   GITHUB_OWNER   – GitHub owner / org name
 *   GITHUB_REPO    – Repository name
 */

import { Octokit } from '@octokit/rest';
import { GravityNormalizer } from '@/utils/normalizer';
import type { WorkspaceItem } from '@/types';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateGitHubEnv(): { owner: string; repo: string; token: string } | null {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo  = process.env.GITHUB_REPO;

  if (!token) {
    console.error('[GitHub] ❌ GITHUB_TOKEN is not set');
    return null;
  }
  if (!owner) {
    console.error('[GitHub] ❌ GITHUB_OWNER is not set');
    return null;
  }
  if (!repo) {
    console.error('[GitHub] ❌ GITHUB_REPO is not set');
    return null;
  }
  return { owner, repo, token };
}

// ---------------------------------------------------------------------------
// Public fetcher
// ---------------------------------------------------------------------------

export async function fetchGitHubData(): Promise<WorkspaceItem[]> {
  const env = validateGitHubEnv();
  if (!env) {
    console.warn('[GitHub] ⚠️  Skipping — missing credentials. Returning empty.');
    return [];
  }

  const { owner, repo, token } = env;
  const octokit = new Octokit({ auth: token });

  console.log(`[GitHub] 🔄 Fetching from ${owner}/${repo}…`);

  let issues: any[] = [];
  let prs:    any[] = [];

  try {
    // Fetch all open issues (GitHub returns PRs here too — filter below)
    const { data, headers } = await octokit.issues.listForRepo({
      owner,
      repo,
      state:    'open',
      per_page: 50,
    });

    // Log rate-limit info if present
    const remaining = headers['x-ratelimit-remaining'];
    const limit     = headers['x-ratelimit-limit'];
    if (remaining && limit) {
      console.log(`[GitHub] ℹ️  Rate limit: ${remaining}/${limit} requests remaining`);
    }

    // Separate real issues from PRs
    issues = data.filter((item: any) => !item.pull_request);
    prs    = data.filter((item: any) => !!item.pull_request);

    console.log(`[GitHub] ✅ Connected — repository "${owner}/${repo}" found`);
    console.log(`[GitHub] 📋 Fetched ${issues.length} issues`);
    console.log(`[GitHub] 🔀 Fetched ${prs.length} pull requests`);
  } catch (err: any) {
    if (err?.status === 401) {
      console.error('[GitHub] ❌ Authentication failed — GITHUB_TOKEN is invalid or expired');
    } else if (err?.status === 404) {
      console.error(`[GitHub] ❌ Repository not found — "${owner}/${repo}" does not exist or token lacks access`);
    } else if (err?.status === 403) {
      console.error('[GitHub] ❌ Rate limited or insufficient permissions');
    } else {
      console.error('[GitHub] ❌ Failed to fetch:', err?.message ?? err);
    }
    return [];
  }

  const allItems = [...issues, ...prs];
  return allItems.map(GravityNormalizer.fromGitHub);
}