import type { NextApiRequest, NextApiResponse } from 'next'
import { google } from 'googleapis'

interface Requirement {
  goal_ids?: number[];
  mandatory_goal_ids?: number[];
  play_style: "single";
  rank: string;
  requirements?: number;
}

interface GoalBase {
  id: number;
}

interface CaloriesGoal extends GoalBase {
  t: "calories",
  count: number;
}

interface SongsDiffClassGoalBase extends GoalBase {
  t: "songs",
  diff_class: string;
}

interface SongsDiffClassGoalFolderCount extends SongsDiffClassGoalBase {
  folder_count: number;
}

interface SongsDiffClassGoalFolder extends SongsDiffClassGoalBase {
  folder: string;
}

interface SongsDiffClassGoalSongCount extends SongsDiffClassGoalBase {
  song_count: number;
  clear_type: string;
}

interface SongsDiffClassGoalSongs extends SongsDiffClassGoalBase {
  songs: string[];
  score: number;
}

type SongsDiffClassGoal = SongsDiffClassGoalFolderCount | SongsDiffClassGoalFolder | SongsDiffClassGoalSongCount | SongsDiffClassGoalSongs;

interface SongsDiffNumsGoal extends GoalBase {
  t: "set",
  diff_nums: number[]
}

interface TrialGoal extends GoalBase {
  t: "trial",
  rank: string;
  count: number;
}

type Goal = CaloriesGoal | SongsDiffClassGoal | SongsDiffNumsGoal | TrialGoal;

async function listRanks() {
  let CALORIES_ID = 1000;
  let SONGS_DIFF_CLASS_ID = 2000;
  let SONGS_DIFF_NUMS_ID = 3000;
  let TRIAL_ID = 4000;
  let MFC_POINTS_ID = 5000;
  let MULTIPLE_ID = 5500;
  let SONGS_3_9_ID = 6000;
  let SONGS_10_11_ID = 6500;
  let SONGS_12_13_ID = 7000;
  let SONGS_14_ID = 7500;
  let SONGS_15_ID = 8000;
  let SONGS_16_ID = 8500;
  let SONGS_17_ID = 9000;
  let SONGS_18_ID = 9500;
  let SONGS_19_ID = 10000;

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
  const requirements: Requirement[] = [];
  const rankNames: {[index: string]: number} = {};
  const requirementIndices: {[index: number]: number} = {};
  const goals: Goal[] = []

  const parseTrials = (requirement: Requirement, cell: string, optional: boolean) => {
    const cellArr = cell.split(" ");
    const rank = cellArr[1].toLocaleLowerCase();
    const count = Number(cellArr[5]);
    let goal = goals.find((goal) => goal.t === "trial" && goal.rank === rank && goal.count === count)
    if (!goal) {
      goal = { id: TRIAL_ID, t: "trial", rank, count };
      TRIAL_ID += 1;
      goals.push(goal);
    }
    if (optional) {
      requirement.goal_ids = requirement.goal_ids ? [...requirement.goal_ids, goal.id] : [goal.id];
    } else {
      requirement.mandatory_goal_ids = requirement.mandatory_goal_ids ? [...requirement.mandatory_goal_ids, goal.id] : [goal.id];
    }
  }

  rows[0].forEach((cell, i) => {
    const name = cell.split(" ")[0].toLocaleLowerCase();
    if (name) {
      rankNames[name] = (rankNames[name] || 0) + 1
      const rank = name + rankNames[name];
      requirementIndices[i] = requirements.push({
        play_style: "single",
        rank,
      }) - 1;
    }
  })
  rows[1].forEach((cell, i) => {
    if (cell.toLocaleLowerCase().startsWith("complete")) {
      const requirementNumber = Number(cell.split(" ")[1]);
      const requirement = requirements[requirementIndices[i]];
      requirement.requirements = requirementNumber;
    }
  })
  rows[2].forEach((cell, i) => {
    if (cell.toLocaleLowerCase().startsWith("trials")) {
      const requirement = requirements[requirementIndices[i]];
      parseTrials(requirement, rows[3][i], true);
    }
  })
  return {
    goals,
    game_versions: {
      A3: {
        rank_requirements: requirements,
      }
    }
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {  
  const json = await listRanks()
  res.status(200).json(json)
}
