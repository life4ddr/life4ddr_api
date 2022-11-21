import type { NextApiRequest, NextApiResponse } from 'next'
import { OAuth2Client } from 'google-auth-library';
import {authenticate} from '@google-cloud/local-auth';
import { google } from 'googleapis'

const fs = require('fs').promises;
const path = require('path');
const process = require('process');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = '/tmp/token.json'
const CREDENTIALS_PATH = '/tmp/credentials.json'

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials() {
  const payload = JSON.stringify({
    "installed": {
      "client_id": process.env.GOOGLE_CLIENT_ID,
      "project_id": process.env.GOOGLE_PROJECT_ID,
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_secret": process.env.GOOGLE_CLIENT_SECRET,
      "redirect_uris": [
        "http://localhost",
        "https://life4ddr-api.vercel.app/"
      ]
    }
  });
  await fs.writeFile(CREDENTIALS_PATH, payload);
}

/**
 * Reads previously authorized token from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedTokenIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const token = JSON.parse(content);
    return google.auth.fromJSON(token) as OAuth2Client;
  } catch (err) {
    return null;
  }
}

/**
 * Serializes token to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveToken(client: OAuth2Client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  try {
    await fs.readFile(CREDENTIALS_PATH)
  } catch (err) {
    await saveCredentials();
  }
  let client = await loadSavedTokenIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveToken(client);
  }
  return client;
}

/**
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
async function listRanks(auth: OAuth2Client) {
  const sheets = google.sheets({version: 'v4', auth});
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: '1b4fX7Xbn8Bz0qswbaJwOV26lR4ZUVbdZpm2n8BBTag8',
    range: 'A1:BM',
  });
  const rows = res.data.values;
  if (!rows || rows.length === 0) {
    console.log('No data found.');
    return;
  }
  const ranks: string[] = [];
  const rankNames: {[index: string]: number} = {};
  const rankColumns: {[index: string]: number} = {};

  rows[0].forEach((cell, i) => {
    const name = cell.split(" ")[0].toLocaleLowerCase();
    if (name) {
      rankNames[name] = (rankNames[name] || 0) + 1
      const rank = name + rankNames[name];
      rankColumns[rank] = i;
      ranks.push(rank);
    }
  })
  return {
    game_versions: {
      A3: {
        rank_requirements: ranks.map(rank => ({
          rank,
          play_style: "single",
        }))
      }
    }
  };
  /* rows.forEach((row) => {
    // Print columns A and E, which correspond to indices 0 and 4.
    console.log(`${row[0]}, ${row[4]}`);
  }); */
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const auth = await authorize();
  
  try {
    const json = await listRanks(auth)
    res.status(200).json(json)
  } catch (err) {
    res.status(500).send(err);
  }
}
