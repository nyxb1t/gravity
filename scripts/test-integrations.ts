/**
 * @file scripts/test-integrations.ts
 * @description Smoke-tests all Gravity integrations and prints a clear status report.
 *
 * Run with:
 *   npx tsx --env-file .env.local scripts/test-integrations.ts
 *
 * This script never throws — it catches all errors and reports them clearly.
 */

import { logStartupConfig } from '../integrations/live';

async function testGitHub(): Promise<void> {
  console.log('\n─── GitHub ───────────────────────────────────────────────');
  try {
    const { fetchGitHubData } = await import('../integrations/github/client');
    const items = await fetchGitHubData();
    const issues = items.filter((i) => i.kind === 'issue');
    const prs    = items.filter((i) => i.kind === 'pr_review');
    console.log(`  ✅ Repository found: ${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`);
    console.log(`  📋 Issues:          ${issues.length}`);
    console.log(`  🔀 Pull Requests:   ${prs.length}`);
    if (items.length > 0) {
      console.log('  Sample items:');
      items.slice(0, 3).forEach((item) => {
        console.log(`    • [${item.kind}] ${item.title}`);
      });
    }
  } catch (err) {
    console.error(`  ❌ GitHub test failed:`, err instanceof Error ? err.message : err);
  }
}

async function testCalendar(): Promise<void> {
  console.log('\n─── Google Calendar ──────────────────────────────────────');
  try {
    const { fetchCalendarData } = await import('../integrations/calendar/client');
    const events = await fetchCalendarData();
    console.log(`  ✅ Authentication success`);
    console.log(`  📅 Events (next 7 days): ${events.length}`);
    if (events.length > 0) {
      console.log('  Sample events:');
      events.slice(0, 3).forEach((event) => {
        const start = event.metadata?.startTime
          ? new Date(event.metadata.startTime as string).toLocaleString()
          : 'Unknown';
        console.log(`    • ${event.title} (${start})`);
      });
    }
  } catch (err) {
    console.error(`  ❌ Calendar test failed:`, err instanceof Error ? err.message : err);
  }
}

async function testNotion(): Promise<void> {
  console.log('\n─── Notion ───────────────────────────────────────────────');
  try {
    const { fetchNotionData } = await import('../integrations/notion/client');
    const pages = await fetchNotionData();
    console.log(`  ✅ Database reachable: ${process.env.NOTION_DATABASE_ID}`);
    console.log(`  📝 Pages:             ${pages.length}`);
    if (pages.length > 0) {
      console.log('  Sample pages:');
      pages.slice(0, 3).forEach((page) => {
        console.log(`    • ${page.title}`);
      });
    }
  } catch (err) {
    console.error(`  ❌ Notion test failed:`, err instanceof Error ? err.message : err);
  }
}

async function testGemini(): Promise<void> {
  console.log('\n─── Gemini AI ────────────────────────────────────────────');
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('  ❌ GEMINI_API_KEY not set');
    return;
  }

  try {
    const model    = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const res = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with just the word "OK"' }] }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`  ❌ Gemini API error ${res.status}: ${body}`);
      return;
    }

    const json = await res.json() as any;
    const reply = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '(no response)';
    console.log(`  ✅ Gemini API responding`);
    console.log(`  🤖 Test reply: "${reply.trim()}"`);
  } catch (err) {
    console.error(`  ❌ Gemini test failed:`, err instanceof Error ? err.message : err);
  }
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════');
  console.log('         Gravity Integration Test Runner');
  console.log('═══════════════════════════════════════════════════════');

  logStartupConfig();

  await testGitHub();
  await testCalendar();
  await testNotion();
  await testGemini();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Test complete. Check output above for any ❌ errors.');
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
