// scripts/test-github.ts
// Quick standalone test — run this to confirm GitHub integration works
// before wiring it into the main /api/gravity/context endpoint.
//
// Run with: npx tsx scripts/test-github.ts
// (or: npx ts-node scripts/test-github.ts)

import 'dotenv/config';
import { fetchGitHubData } from '../integrations/github/client';

async function main() {
  console.log('Fetching GitHub data...');
  console.log('Owner:', process.env.GITHUB_OWNER);
  console.log('Repo:', process.env.GITHUB_REPO);
  console.log('---');

  try {
    const data = await fetchGitHubData();
    console.log(`✅ Success! Fetched ${data.length} items.`);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('❌ Error fetching GitHub data:');
    console.error(err);
  }
}

main();