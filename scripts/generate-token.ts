

import * as fs from 'fs';
import * as readline from 'readline';
import { google } from 'googleapis';

const credentials = JSON.parse(fs.readFileSync('google-credentials.json', 'utf-8'));
const { client_id, client_secret, redirect_uris } = credentials.installed;

const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

// Only need read access to calendar
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent' // forces refresh token to be returned every time
});

console.log('\n📅 Google Calendar Auth Setup');
console.log('================================');
console.log('1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Sign in with your Google account');
console.log('3. Click Allow');
console.log('4. Copy the code from the URL and paste it below\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Paste the code here: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n✅ Success! Add these to your .env and .env.local:\n');
    console.log(`GOOGLE_CLIENT_ID=${client_id}`);
    console.log(`GOOGLE_CLIENT_SECRET=${client_secret}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\n✅ Done! You never need to run this script again.');
  } catch (err) {
    console.error('\n❌ Error getting token:', err);
  }
});