
import { Octokit } from '@octokit/rest';
import { GravityNormalizer } from '@/utils/normalizer';
import type { WorkspaceItem } from '@/types';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function fetchGitHubData(
  owner: string = process.env.GITHUB_OWNER || '',
  repo: string = process.env.GITHUB_REPO || ''
): Promise<WorkspaceItem[]> {
  if (!owner || !repo) {
    throw new Error('GITHUB_OWNER and GITHUB_REPO must be set in .env');
  }

  // Fetch issues + PRs together (GitHub issues endpoint returns both)
  const { data } = await octokit.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    per_page: 50
  });

  return data.map(GravityNormalizer.fromGitHub);
}