import type { NextApiRequest, NextApiResponse } from 'next'
import { google } from 'googleapis'


/**
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
async function listRanks() {
  const sheets = google.sheets({version: 'v4', auth: process.env.GOOGLE_API_KEY});
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
  try {
    const json = await listRanks()
    res.status(200).json(json)
  } catch (err) {
    res.status(500).send(err);
  }
}
