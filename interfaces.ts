export interface Requirement {
  goal_ids?: number[];
  mandatory_goal_ids?: number[];
  substitutions?: number[];
  play_style: "single";
  rank: string;
  requirements?: number;
}

export type ClearType = "life4" | "good" | "great" | "perfect";

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
  clear_type: ClearType;
}

interface SongsDiffClassGoalSongs extends SongsDiffClassGoalBase {
  d: number;
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
  clear_type?: ClearType;
}

interface SongsScoreGoal extends GoalBase {
  t: "songs";
  d: number;
  score: number;
  exceptions?: number;
  song_exceptions?: string[];
}

export interface SongsCountGoal extends GoalBase {
  t: "songs";
  d: number;
  score?: number;
  song_count: number;
  higher_diff?: true;
  clear_type?: ClearType;
}

interface SongsAverageGoal extends GoalBase {
  t: "songs";
  d: number;
  average_score: number;
}

interface TrialGoal extends GoalBase {
  t: "trial";
  rank: string;
  count: number;
}

interface MFCPointsGoal extends GoalBase {
  t: "mfc_points";
  points: number;
}

export type Goal =
  | CaloriesGoal
  | SongsDiffClassGoal
  | SongsDiffNumsGoal
  | SongsLampGoal
  | SongsScoreGoal
  | SongsCountGoal
  | SongsAverageGoal
  | TrialGoal
  | MFCPointsGoal;
