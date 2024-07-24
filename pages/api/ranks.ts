import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";
import shallowequal from "shallowequal";
import { ClearType, Goal, Requirement, SongsCountGoal } from "../../interfaces";

type Parser = (
  rowIndex: number,
  columnIndex: number,
  match: RegExpMatchArray
) => void;

const clearLamps: { [index: string]: ClearType } = {
  Red: "life4",
  Blue: "good",
  Green: "great",
  Gold: "perfect",
};

const clearTypes: { [index: string]: ClearType } = {
  "LIFE4 Clear": "life4",
  "Full Combo": "good",
  "Great Full Combo": "great",
  PFC: "perfect",
  SDP: "sdp",
  MFC: "marvelous",
};

const sheets = google.sheets({
  version: "v4",
  auth: process.env.GOOGLE_API_KEY,
});

const ids: { [index: string]: number } = {
  calories: 1000,
  songsDiffClass: 2000,
  songsDiffNums: 3000,
  trial: 4000,
  maPoints: 5000,
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

async function getRows(range: string) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: "177SxduFGkE2EaCu0p1RxEUUhL4exo92KOl7N-U5ZzGU",
    range: range,
  });
  const rows = res.data.values;
  if (!rows || rows.length === 0) {
    console.log("No data found.");
    return;
  }
  return rows;
}

const goals: Goal[] = [];

async function listRequirements(rows: string[][]) {
  const mandatoryCells: { [index: number]: number } = {};
  const substitutionsCells: { [index: number]: number } = {};

  const requirements: Requirement[] = [];
  const rankNames: { [index: string]: number } = {};
  const requirementIndices: { [index: number]: number } = {};

  const getRequirement = (columnIndex: number) =>
    requirements[requirementIndices[columnIndex]];
  const isMandatory = (rowIndex: number, columnIndex: number) =>
    !mandatoryCells[columnIndex] || mandatoryCells[columnIndex] < rowIndex;
  const isSubstitution = (rowIndex: number, columnIndex: number) =>
    !!substitutionsCells[columnIndex] &&
    substitutionsCells[columnIndex] < rowIndex;

  const getSong = (song: string) =>
    song === "Endymion"
      ? "ENDYMION"
      : song === "Lachryma"
      ? "Lachryma《Re:Queen’M》"
      : song;

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

  const setGoalId = (rowIndex: number, columnIndex: number, goal: Goal) => {
    const requirement = getRequirement(columnIndex);
    if (isSubstitution(rowIndex, columnIndex)) {
      requirement.substitutions = requirement.substitutions
        ? [...requirement.substitutions, goal.id]
        : [goal.id];
    } else if (isMandatory(rowIndex, columnIndex)) {
      requirement.mandatory_goal_ids = requirement.mandatory_goal_ids
        ? [...requirement.mandatory_goal_ids, goal.id]
        : [goal.id];
    } else {
      requirement.goal_ids = requirement.goal_ids
        ? [...requirement.goal_ids, goal.id]
        : [goal.id];
    }
  };

  const parseClear: Parser = (rowIndex, columnIndex, match) => {
    const clearType = clearTypes[match[1]];
    const song_count = match[2] === "a" ? 1 : Number(match[2]);
    const d = Number(match[3]);
    const higher_diff = !!match[4] || undefined;
    let goal = goals.find(
      (goal) =>
        "d" in goal &&
        "song_count" in goal &&
        !("score" in goal) &&
        goal.t === "songs" &&
        goal.d === d &&
        goal.song_count === song_count &&
        goal.higher_diff === higher_diff &&
        (clearType ? goal.clear_type === clearType : !("clear_type" in goal))
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
      if (clearType) {
        goal.clear_type = clearType;
      }
      ids[idsIndex] += 1;
      goals.push(goal);
    }
    setGoalId(rowIndex, columnIndex, goal);
  };

  const parsePFCs: Parser = (rowIndex, columnIndex, match) => {
    const song_count = Number(match[1]);
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
        goal.higher_diff === higher_diff &&
        goal.clear_type === "perfect"
    );
    if (!goal) {
      const idsIndex = getIdsIndex(d);
      goal = {
        id: ids[idsIndex],
        t: "songs",
        d,
        song_count,
        clear_type: "perfect",
      };
      if (higher_diff) {
        goal.higher_diff = higher_diff;
      }
      ids[idsIndex] += 1;
      goals.push(goal);
    }
    setGoalId(rowIndex, columnIndex, goal);
  };

  const parseTrials: Parser = (rowIndex, columnIndex, match) => {
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
    setGoalId(rowIndex, columnIndex, goal);
  };

  const parseLamp: Parser = (rowIndex, columnIndex, match) => {
    const difficulty = rows[rowIndex - 1][columnIndex];
    const color = match[1];
    const clearType = clearLamps[color];
    const d = parseInt(difficulty);
    let goal = goals.find(
      (goal) =>
        "d" in goal &&
        !("score" in goal) &&
        !("song_count" in goal) &&
        !("average_score" in goal) &&
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
    setGoalId(rowIndex, columnIndex, goal);
  };

  const parseAll: Parser = (rowIndex, columnIndex, match) => {
    const d = Number(match[1]);
    const score = match[2].includes(",")
      ? Number(match[4].replace(",", ""))
      : Number(match[3]) * 1000;
    let exceptions: number | undefined = undefined;
    let exception_score: number | undefined = undefined;
    if (match[5]) {
      exceptions = Number(match[6]);
      if (match[7]) {
        exception_score = Number(match[8]) * 1000;
      }
    }
    let song_exceptions: string[] | undefined = undefined;
    if (match[9]) {
      song_exceptions = match[10].split(" & ").map(getSong);
      if (match[11]) {
        exception_score = Number(match[12]) * 1000;
      }
    }
    let goal = goals.find(
      (goal) =>
        "d" in goal &&
        "score" in goal &&
        !("song_count" in goal) &&
        !("songs" in goal) &&
        goal.d === d &&
        goal.t === "songs" &&
        goal.score === score &&
        goal.exceptions === exceptions &&
        goal.exception_score === exception_score &&
        shallowequal(goal.song_exceptions, song_exceptions)
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
      if (exception_score) {
        goal.exception_score = exception_score;
      }
      if (song_exceptions) {
        goal.song_exceptions = song_exceptions;
      }
      ids[idsIndex] += 1;
      goals.push(goal);
    }
    setGoalId(rowIndex, columnIndex, goal);
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
    setGoalId(rowIndex, columnIndex, goal);
  };

  const parseScore: Parser = (rowIndex, columnIndex, match) => {
    const score = (match[1] === "AAA" ? 990 : Number(match[2])) * 1000;
    const song_count = Number(match[3]) || 1;
    const d = Number(match[4]);
    const higher_diff = !!match[5] || undefined;
    let goal = goals.find(
      (goal) =>
        "d" in goal &&
        "score" in goal &&
        "song_count" in goal &&
        goal.d === d &&
        goal.score === score &&
        goal.song_count === song_count &&
        goal.higher_diff === higher_diff
    );
    if (!goal) {
      const idsIndex = getIdsIndex(d);
      goal = {
        id: ids[idsIndex],
        t: "songs",
        d,
        score,
        song_count,
      };
      if (higher_diff) {
        goal.higher_diff = true;
      }
      ids[idsIndex] += 1;
      goals.push(goal);
    }
    setGoalId(rowIndex, columnIndex, goal);
  };

  const parseScores: Parser = (rowIndex, columnIndex, match) => {
    const score = Number(match[3]) * 1000;
    const song_count = Number(match[1]);
    const d = Number(match[2]);
    const exceptions = match[4] ? Number(match[5]) : undefined;
    const exception_score = match[6] ? Number(match[7]) * 1000 : undefined;
    let goal = goals.find(
      (goal) =>
        "d" in goal &&
        "score" in goal &&
        "song_count" in goal &&
        goal.d === d &&
        goal.score === score &&
        goal.song_count === song_count &&
        goal.exceptions === exceptions &&
        goal.exception_score === exception_score
    );
    if (!goal) {
      const idsIndex = getIdsIndex(d);
      goal = {
        id: ids[idsIndex],
        t: "songs",
        d,
        score,
        song_count,
        exceptions,
        exception_score,
      };
      ids[idsIndex] += 1;
      goals.push(goal);
    }
    setGoalId(rowIndex, columnIndex, goal);
  };

  const parseSet: Parser = (rowIndex, columnIndex, match) => {
    const count = Number(match[1]);
    const difficulty = Number(match[2]);
    const diff_nums = Array(count);
    diff_nums.fill(difficulty);
    let goal = goals.find(
      (goal) => "diff_nums" in goal && shallowequal(goal.diff_nums, diff_nums)
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
    setGoalId(rowIndex, columnIndex, goal);
  };

  const getDifficulty = (rowIndex: number, columnIndex: number) => {
    let d = 0;
    let rowIndexStart = rowIndex - 1;
    let diffMatch;
    while (!d && rowIndexStart > -1) {
      if (
        rows[rowIndexStart][columnIndex] &&
        (diffMatch = rows[rowIndexStart][columnIndex].match(/^ *([0-9]+)s *$/))
      ) {
        d = Number(diffMatch[1]);
      }
      rowIndexStart -= 1;
    }
    return d;
  };

  const parseAverage: Parser = (rowIndex, columnIndex, match) => {
    const average_score = Number(match[1].replace(",", ""));
    const d = getDifficulty(rowIndex, columnIndex);
    let goal = goals.find(
      (goal) =>
        "average_score" in goal &&
        goal.d === d &&
        goal.average_score === average_score
    );
    if (!goal) {
      const idsIndex = getIdsIndex(d);
      goal = {
        average_score,
        id: ids[idsIndex],
        d,
        t: "songs",
      };
      ids[idsIndex] += 1;
      goals.push(goal);
    }
    setGoalId(rowIndex, columnIndex, goal);
  };

  const parseSongScore: Parser = (rowIndex, columnIndex, match) => {
    const score = Number(match[1]) * 1000;
    const d = getDifficulty(rowIndex, columnIndex);
    const diff_class = "C";
    const songs = match[2].split(/, and |, | and /).map(getSong);
    let goal = goals.find(
      (goal) =>
        "songs" in goal &&
        goal.d === d &&
        goal.diff_class === diff_class &&
        goal.score === score &&
        goal.songs.length === songs.length &&
        goal.songs.every((song) => songs.includes(song))
    );
    if (!goal) {
      goal = {
        id: ids.songsDiffClass,
        d,
        diff_class,
        score,
        songs,
        t: "songs",
      };
      ids.songsDiffClass += 1;
      goals.push(goal);
    }
    setGoalId(rowIndex, columnIndex, goal);
  };

  const parseMAPoints = (rowIndex: number, columnIndex: number) => {
    const cell = rows[rowIndex + 1][columnIndex];
    if (cell == null) return;
    const points = Number(cell);
    let goal = goals.find((goal) => "points" in goal && goal.points === points);
    if (!goal) {
      goal = {
        id: ids.maPoints,
        t: "ma_points",
        points,
      };
      ids.maPoints += 1;
      goals.push(goal);
    }
    setGoalId(rowIndex, columnIndex, goal);
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
      if (!cell) {
        return;
      }
      const trimmedCell = cell.trim();
      if (trimmedCell === "MA Points") {
        return parseMAPoints(i, j);
      }
      let match;
      if (
        (match = trimmedCell.match(
          /^(Clear|LIFE4 Clear|Full Combo|Great Full Combo|PFC|SDP|MFC) ([a0-9]+)n? ([0-9]{1,2})s?(\+)?$/
        ))
      ) {
        return parseClear(i, j, match);
      }
      if ((match = trimmedCell.match(/^([0-9]+) ([0-9]{1,2})(\+)? PFCs/))) {
        return parsePFCs(i, j, match);
      }
      if (
        (match = trimmedCell.match(/^Earn (.*)+ or above on ([0-9]+) Trial/))
      ) {
        return parseTrials(i, j, match);
      }
      if ((match = trimmedCell.match(/(.+) Lamp$/))) {
        return parseLamp(i, j, match);
      }
      if (
        (match = trimmedCell.match(
          /^All ([0-9]{1,2})s over (([0-9]{3})k|([0-9]{3},[0-9]{3}))( \(([0-9]+)E(, ([0-9]+)k\)))?( \(ex. ([^,]+)(, ([0-9]+)k)?\))?/
        ))
      ) {
        return parseAll(i, j, match);
      }
      if ((match = trimmedCell.match(/^Burn ([0-9]+)/))) {
        return parseCalories(i, j, match);
      }
      if (
        (match = trimmedCell.match(
          /^(([0-9]{3})k\+|AAA) ([a0-9]+)n? ([0-9]{1,2})(\+?)/
        ))
      ) {
        return parseScore(i, j, match);
      }
      if (
        (match = trimmedCell.match(
          // temp: optional "60" in the sheet from copy-paste error
          /^Clear(?: 60)? ([0-9]+) ([0-9]+)s over ([0-9]{3})k( \(([0-9]+)E(, ([0-9]+)k\)))?/
        ))
      ) {
        return parseScores(i, j, match);
      }
      if (
        (match = trimmedCell.match(/^Clear ([0-9]+) ([0-9]{1,2})s in a row/))
      ) {
        return parseSet(i, j, match);
      }
      if ((match = trimmedCell.match(/^([0-9,]+) Average/))) {
        return parseAverage(i, j, match);
      }
      if ((match = trimmedCell.match(/^([0-9]{3})k\+ on (.*)$/))) {
        return parseSongScore(i, j, match);
      }
    });
  });
  return requirements;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const a3Rows = await getRows("'5.1 patch (A3 ver.)'!A1:BM");
  const a20Rows = await getRows("'5.1 patch (A20+ ver.)'!A1:BM");
  if (a3Rows && a20Rows) {
    const json = {
      goals,
      game_versions: {
        A20: {
          rank_requirements: await listRequirements(a20Rows),
        },
        A3: {
          rank_requirements: await listRequirements(a3Rows),
        },
      },
    };
    res.status(200).json(json);
  } else {
    res.status(500).send("Internal Server Error");
  }
}
