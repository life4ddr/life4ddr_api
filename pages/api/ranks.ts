import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";
import shallowequal from "shallowequal";

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
  t: "calories";
  count: number;
}

interface SongsDiffClassGoalBase extends GoalBase {
  t: "songs";
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

type SongsDiffClassGoal =
  | SongsDiffClassGoalFolderCount
  | SongsDiffClassGoalFolder
  | SongsDiffClassGoalSongCount
  | SongsDiffClassGoalSongs;

interface SongsDiffNumsGoal extends GoalBase {
  t: "set";
  diff_nums: number[];
}

interface SongsLampGoal extends GoalBase {
  t: "songs";
  d: number;
  clear_type?: string;
}

interface SongsScoreGoal extends GoalBase {
  t: "songs";
  d: number;
  score: number;
  exceptions?: number;
  song_exceptions?: string[];
}

interface SongsCountGoal extends GoalBase {
  t: "songs";
  d: number;
  score?: number;
  song_count: number;
  higher_diff?: true;
}

interface TrialGoal extends GoalBase {
  t: "trial";
  rank: string;
  count: number;
}

type Goal =
  | CaloriesGoal
  | SongsDiffClassGoal
  | SongsDiffNumsGoal
  | SongsLampGoal
  | SongsScoreGoal
  | SongsCountGoal
  | TrialGoal;

type Parser = (
  rowIndex: number,
  columnIndex: number,
  match: RegExpMatchArray
) => void;

const clearTypes: { [index: string]: string } = {
  Red: "life4",
  Blue: "good",
  Green: "great",
  Gold: "perfect",
};

async function listRanks() {
  const ids: { [index: string]: number } = {
    calories: 1000,
    songsDiffClass: 2000,
    songsDiffNums: 3000,
    trial: 4000,
    mfcPoints: 5000,
    multiple: 5500,
    songs1_9: 6000,
    songs10_11: 6500,
    songs12_13: 7000,
    songs14: 7500,
    songs15: 8000,
    songs16: 8500,
    songs17: 9000,
    songs18: 9500,
    songs19: 10000,
  };

  const sheets = google.sheets({
    version: "v4",
    auth: process.env.GOOGLE_API_KEY,
  });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: "1b4fX7Xbn8Bz0qswbaJwOV26lR4ZUVbdZpm2n8BBTag8",
    range: "A1:BM",
  });
  const rows = res.data.values;
  if (!rows || rows.length === 0) {
    console.log("No data found.");
    return;
  }

  const mandatoryCells: { [index: number]: number } = {};
  const substitutionsCells: { [index: number]: number } = {};

  const requirements: Requirement[] = [];
  const rankNames: { [index: string]: number } = {};
  const requirementIndices: { [index: number]: number } = {};
  const goals: Goal[] = [];

  const getRequirement = (columnIndex: number) =>
    requirements[requirementIndices[columnIndex]];
  const isMandatory = (rowIndex: number, columnIndex: number) =>
    !!mandatoryCells[columnIndex] && mandatoryCells[columnIndex] < rowIndex;
  const isSubstitution = (rowIndex: number, columnIndex: number) =>
    !!substitutionsCells[columnIndex] &&
    substitutionsCells[columnIndex] < rowIndex;

  const getIdsIndex = (d: number) => {
    if (d < 10) {
      return "songs1_9";
    }
    if (d < 12) {
      return "songs10_11";
    }
    if (d < 14) {
      return "songs12_13";
    }
    return `songs${d}`;
  };

  const setGoalId = (
    columnIndex: number,
    goal: Goal,
    mandatory = false,
    substitution = false
  ) => {
    const requirement = getRequirement(columnIndex);
    if (mandatory) {
      requirement.mandatory_goal_ids = requirement.mandatory_goal_ids
        ? [...requirement.mandatory_goal_ids, goal.id]
        : [goal.id];
    } else if (substitution) {
      requirement.substitutions = requirement.substitutions
        ? [...requirement.substitutions, goal.id]
        : [goal.id];
    } else {
      requirement.goal_ids = requirement.goal_ids
        ? [...requirement.goal_ids, goal.id]
        : [goal.id];
    }
  };

  const parseClear: Parser = (rowIndex, columnIndex, match) => {
    const substitution = isSubstitution(rowIndex, columnIndex);
    const mandatory = isMandatory(rowIndex, columnIndex);
    const song_count = match[1] === "a" ? 1 : Number(match[1]);
    const d = Number(match[2]);
    const higher_diff = !!match[3] || undefined;
    let goal = goals.find(
      (goal) =>
        "d" in goal &&
        "song_count" in goal &&
        !("score" in goal) &&
        goal.t === "songs" &&
        goal.d === d &&
        goal.song_count === song_count &&
        goal.higher_diff === higher_diff
    ) as SongsCountGoal | undefined;
    if (!goal) {
      const idsIndex = getIdsIndex(d);
      goal = {
        id: ids[idsIndex],
        t: "songs",
        d,
        song_count,
      };
      if (higher_diff) {
        goal.higher_diff = higher_diff;
      }
      ids[idsIndex] += 1;
      goals.push(goal);
    }
    setGoalId(columnIndex, goal, mandatory, substitution);
  };

  const parseTrials: Parser = (rowIndex, columnIndex, match) => {
    const mandatory = isMandatory(rowIndex, columnIndex);
    const rank = match[1].toLocaleLowerCase();
    const count = Number(match[2]);
    let goal = goals.find(
      (goal) => goal.t === "trial" && goal.rank === rank && goal.count === count
    );
    if (!goal) {
      goal = { id: ids.trial, t: "trial", rank, count };
      ids.trial += 1;
      goals.push(goal);
    }
    setGoalId(columnIndex, goal, mandatory);
  };

  const parseLamp: Parser = (rowIndex, columnIndex, match) => {
    const difficulty = rows[rowIndex - 1][columnIndex];
    const substitution = isSubstitution(rowIndex, columnIndex);
    const color = match[1];
    const clearType = clearTypes[color];
    const d = parseInt(difficulty);
    let goal = goals.find(
      (goal) =>
        "d" in goal &&
        !("score" in goal) &&
        !("song_count" in goal) &&
        goal.d === d &&
        goal.t === "songs" &&
        goal.clear_type === clearType
    );
    if (!goal) {
      const idsIndex = getIdsIndex(d);
      goal = { id: ids[idsIndex], d, t: "songs" };
      if (clearType) {
        goal.clear_type = clearType;
      }
      ids[idsIndex] += 1;
      goals.push(goal);
    }
    setGoalId(columnIndex, goal, false, substitution);
  };

  const parseAll: Parser = (rowIndex, columnIndex, match) => {
    const substitution = isSubstitution(rowIndex, columnIndex);
    const d = Number(match[1]);
    const score = Number(match[2]) * 1000;
    let exceptions: number | undefined = undefined;
    if (match[5]) {
      exceptions = Number(match[5]);
    }
    let song_exceptions: string[] | undefined = undefined;
    if (match[7]) {
      song_exceptions = match[7].split(" & ");
    }
    let goal = goals.find(
      (goal) =>
        "d" in goal &&
        "score" in goal &&
        !("song_count" in goal) &&
        goal.d === d &&
        goal.t === "songs" &&
        goal.score === score &&
        goal.exceptions === exceptions &&
        goal.song_exceptions === song_exceptions
    );
    if (!goal) {
      const idsIndex = getIdsIndex(d);
      goal = {
        id: ids[idsIndex],
        d,
        t: "songs",
        score,
      };
      if (exceptions) {
        goal.exceptions = exceptions;
      }
      if (song_exceptions) {
        goal.song_exceptions = song_exceptions;
      }
      ids[idsIndex] += 1;
      goals.push(goal);
    }
    setGoalId(columnIndex, goal, false, substitution);
  };

  const parseCalories: Parser = (rowIndex, columnIndex, match) => {
    const count = Number(match[1]);
    let goal = goals.find(
      (goal) => goal.t === "calories" && goal.count === count
    );
    if (!goal) {
      goal = {
        id: ids.calories,
        t: "calories",
        count,
      };
      ids.calories += 1;
      goals.push(goal);
    }
    setGoalId(columnIndex, goal);
  };

  const parseSingleScore: Parser = (rowIndex, columnIndex, match) => {
    const substitution = isSubstitution(rowIndex, columnIndex);
    const score = Number(match[1]) * 1000;
    const d = Number(match[2]);
    const higher_diff = !!match[3] || undefined;
    let goal = goals.find(
      (goal) =>
        "d" in goal &&
        "score" in goal &&
        "song_count" in goal &&
        goal.d === d &&
        goal.score === score &&
        goal.song_count === 1 &&
        goal.higher_diff === higher_diff
    );
    if (!goal) {
      const idsIndex = getIdsIndex(d);
      goal = {
        id: ids[idsIndex],
        t: "songs",
        d,
        score,
        song_count: 1,
      };
      if (higher_diff) {
        goal.higher_diff = true;
      }
      ids[idsIndex] += 1;
      goals.push(goal);
    }
    setGoalId(columnIndex, goal, false, substitution);
  };

  const parseSet: Parser = (rowIndex, columnIndex, match) => {
    const mandatory = isMandatory(rowIndex, columnIndex);
    const count = Number(match[1]);
    const difficulty = Number(match[2]);
    const diff_nums = Array(count);
    diff_nums.fill(difficulty);
    let goal = goals.find(
      (goal) => "diff_nums" in goal && shallowequal(goal.diff_nums && diff_nums)
    );
    if (!goal) {
      goal = {
        id: ids.songsDiffNums,
        t: "set",
        diff_nums,
      };
      ids.songsDiffNums += 1;
      goals.push(goal);
    }
    setGoalId(columnIndex, goal, mandatory);
  };

  rows.forEach((row, i) => {
    row.forEach((cell, j) => {
      if (cell === "Mandatory") {
        mandatoryCells[j] = i;
      }
      if (cell === "Substitutions") {
        substitutionsCells[j] = i;
      }
    });
  });
  rows[0].forEach((cell, i) => {
    const name = cell.split(" ")[0].toLocaleLowerCase();
    if (name) {
      rankNames[name] = (rankNames[name] || 0) + 1;
      const rank = name + rankNames[name];
      requirementIndices[i] =
        requirements.push({
          play_style: "single",
          rank,
        }) - 1;
    }
  });
  rows[1].forEach((cell, i) => {
    if (cell.match(/^Complete [0-9]/)) {
      const requirementNumber = Number(cell.split(" ")[1]);
      const requirement = getRequirement(i);
      requirement.requirements = requirementNumber;
    }
  });
  rows.forEach((row, i) => {
    row.forEach((cell: string, j) => {
      let match;
      if (!cell) {
        return;
      }
      if ((match = cell.match(/^Clear ([a0-9]+)n? ([0-9]+)s?(\+)?$/))) {
        parseClear(i, j, match);
      } else if (
        (match = cell.match(/^Earn (.*)+ or above on ([0-9]+) Trial/))
      ) {
        parseTrials(i, j, match);
      } else if ((match = cell.match(/(.+) Lamp$/))) {
        parseLamp(i, j, match);
      } else if (
        (match = cell.match(
          /^All ([0-9]{1,2})s over ([0-9]{3})k()( \(([0-9]+)E\))?( \(ex. (.*)\))?/
        ))
      ) {
        parseAll(i, j, match);
      } else if ((match = cell.match(/^Burn ([0-9]+)/))) {
        parseCalories(i, j, match);
      } else if ((match = cell.match(/^([0-9]{3})k\+ a ([0-9]{1,2})(\+?)/))) {
        parseSingleScore(i, j, match);
      } else if ((match = cell.match(/^Clear ([0-9]+) ([0-9]+)s in a row/))) {
        parseSet(i, j, match);
      }
    });
  });
  return {
    goals,
    game_versions: {
      A3: {
        rank_requirements: requirements,
      },
    },
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const json = await listRanks();
  res.status(200).json(json);
}
