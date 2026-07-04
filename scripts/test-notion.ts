

import 'dotenv/config';
import { fetchNotionData } from '../integrations/notion/client';

async function main() {
  console.log('Fetching Notion data...');
  console.log('Database ID:', process.env.NOTION_DATABASE_ID);
  console.log('---');

  try {
    const data = await fetchNotionData();
    console.log(`✅ Success! Fetched ${data.length} tasks.`);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('❌ Error fetching Notion data:');
    console.error(err);
  }
}

main();