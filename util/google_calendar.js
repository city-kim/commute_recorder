const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const commute = require('../schedul/commute.js')
const moment = require('moment-timezone');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = __dirname + '/token.json'; // token.json으로 구글 OAuth2 인증해줘야함

// Load client secrets from a local file.
const googleCalendarLoad = (type) => {
  fs.readFile(__dirname + '/credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Calendar API.
    authorize(JSON.parse(content), getHoliday);
  }); 
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize (credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken (oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function getHoliday (auth) {
  console.log('휴일참조')
  const calendar = google.calendar({ version: 'v3', auth });
  const today = moment().format('YYYY-MM-DD');
  calendar.events.list({
    // calendarId: 'ko.south_korea#holiday@group.v.calendar.google.com', // 공식은 안맞는게 많아서 커스텀 달력을 가져옴
    calendarId: 'qduatr3seur835pk4aolok2900@group.calendar.google.com', // 2030년까지 유효
    timeMin: `${today}T00:00:00.000Z`,
    timeMax: `${today}T23:59:00.000Z`,
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) {
      console.log('The API returned an error: ' + err);
      commute.dailyCall(holiday, null)
      return false;
    }
    const events = res.data.items;
    if (events.length) {
      listEvents(auth, events)
    } else {
      listEvents(auth, null)
    }
  });
}

function listEvents (auth, holiday) {
  console.log('휴가참조')
  const calendar = google.calendar({ version: 'v3', auth });
  const today = moment().format('YYYY-MM-DD');
  calendar.events.list({
    calendarId: 'calendarId', // 회사 구글캘린더 참조
    timeMin: `${today}T00:00:00.00+09:00`,
    timeMax: `${today}T23:59:00.00+09:00`,
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) {
      console.log('The API returned an error: ' + err);
      commute.dailyCall(holiday, null)
      return false;
    }
    const events = res.data.items;
      if (events.length) {
        commute.dailyCall(holiday, events)
      } else {
        commute.dailyCall(holiday, null)
      console.log('구글참조종료')
    }
  });
}

// [END calendar_quickstart]

module.exports = {
  SCOPES,
  listEvents,
  googleCalendarLoad
};