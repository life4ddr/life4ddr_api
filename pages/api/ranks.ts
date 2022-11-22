import type { NextApiRequest, NextApiResponse } from 'next'
import { google } from 'googleapis'

interface Requirement {
  goal_ids?: number[];
  mandatory_goal_ids?: number[];
  substitutions?: number[];
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

interface SongsLampGoal extends GoalBase {
  t: "songs";
  d: number;
  clear_type?: string;
}

interface TrialGoal extends GoalBase {
  t: "trial",
  rank: string;
  count: number;
}

type Goal = CaloriesGoal | SongsDiffClassGoal | SongsDiffNumsGoal | SongsLampGoal | TrialGoal;

const clearTypes: {[index: string]: string} = {
  "Red": "life4",
  "Blue": "good",
  "Green": "great",
  "Gold": "perfect"
}

async function listRanks() {
  const ids: {[index: string]: number} = {
    calories: 1000,
    songsDiffClass: 2000,
    songsDiffNums: 3000,
    trial: 4000,
    mfcPoints: 5000,
    multiple: 5500,
    songs3_9: 6000,
    songs10_11: 6500,
    songs12_13: 7000,
    songs14: 7500,
    songs15: 8000,
    songs16: 8500,
    songs17: 9000,
    songs18: 9500,
    songs19: 10000,
  }

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

  const mandatoryCells: {[index: number]: number} = {};
  const substitutionsCells: {[index: number]: number} = {};

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
      goal = { id: ids.trial, t: "trial", rank, count };
      ids.trial += 1;
      goals.push(goal);
    }
    if (optional) {
      requirement.goal_ids = requirement.goal_ids ? [...requirement.goal_ids, goal.id] : [goal.id];
    } else {
      requirement.mandatory_goal_ids = requirement.mandatory_goal_ids ? [...requirement.mandatory_goal_ids, goal.id] : [goal.id];
    }
  }

  const parseLamp = (requirement: Requirement, cell: string, difficulty: string, substitution: boolean) => {
    const color = cell.split(" ")[0];
    const clearType = clearTypes[color];
    const d = parseInt(difficulty);
    let goal = goals.find((goal) => "d" in goal && goal.d === d && goal.t === "songs" && goal.clear_type === clearType);
    if (!goal) {
      goal = { id: ids[`songs${d}`], d, t: "songs" }
      if (clearType) {
        goal.clear_type = clearType
      }
      ids[`songs${d}`] += 1;
      goals.push(goal);
    }
    if (substitution) {
      requirement.substitutions = requirement.substitutions ? [...requirement.substitutions, goal.id] : [goal.id];
    } else {
      requirement.mandatory_goal_ids = requirement.mandatory_goal_ids ? [...requirement.mandatory_goal_ids, goal.id] : [goal.id];
    }
  }

  rows.forEach((row, i) => {
    row.forEach((cell, j) => {
      if (cell === "Mandatory") {
        mandatoryCells[j] = i
      }
      if (cell === "Substitutions") {
        substitutionsCells[j] = i;
      }
    });
  })
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
    if (cell.match(/^Complete [0-9]/)) {
      const requirementNumber = Number(cell.split(" ")[1]);
      const requirement = requirements[requirementIndices[i]];
      requirement.requirements = requirementNumber;
    }
  })
  rows.forEach((row, i) => {
    row.forEach((cell, j) => {
      const requirement = requirements[requirementIndices[j]];
      if (cell === "Trials") {
        parseTrials(requirement, rows[i+1][j], !!mandatoryCells[j] && mandatoryCells[j] > i);
      }
      if (cell.match(/Lamp$/)) {
        parseLamp(requirement, cell, rows[i-1][j], !!substitutionsCells[j] && substitutionsCells[j] < i);
      }
    });
  });
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
