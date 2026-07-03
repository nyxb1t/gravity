

import 'dotenv/config';
import { fetchCalendarData } from '../integrations/calendar/client';

async function main() {
  console.log('Fetching Google Calendar data...');
  console.log('---');

  try {
    const data = await fetchCalendarData();
    console.log(`✅ Success! Fetched ${data.length} events.`);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('❌ Error fetching Calendar data:');
    console.error(err);
  }
}

main();