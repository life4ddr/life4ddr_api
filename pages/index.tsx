import { GetServerSideProps } from "next";
import { ReactElement, useCallback, useEffect, useRef, useState } from "react";
import { ClearType, Goal, Requirement } from "../interfaces";

const printGoal = (goal?: Goal) => {
  const an: { [index: number]: "an" } = {
    8: "an",
    11: "an",
    18: "an",
  };

  const clearTypes: { [index in ClearType]: string } = {
    life4: "LIFE4 Clear",
    good: "Full Combo",
    great: "Great Full Combo",
    perfect: "PFC",
  };

  const clearLamps: { [index in ClearType]: string } = {
    life4: "Red",
    good: "Blue",
    great: "Green",
    perfect: "Gold",
  };

  if (!goal) {
    return "";
  }
  if (goal.t === "calories") {
    return `Burn ${goal.count} calories in one day`;
  }
  if (goal.t === "trial") {
    return `Earn ${
      goal.rank.charAt(0).toUpperCase() + goal.rank.slice(1)
    } or above on ${goal.count} Trial${goal.count === 1 ? "" : "s"}`;
  }
  if (goal.t === "mfc_points") {
    return `MFC Points: ${goal.points}`;
  }
  if (
    goal.t === "set" &&
    goal.diff_nums.every((diff) => diff === goal.diff_nums[0])
  ) {
    return `Clear ${goal.diff_nums.length} ${goal.diff_nums[0]}s in a row`;
  }
  if (goal.t === "songs") {
    if ("d" in goal) {
      if ("average_score" in goal) {
        return `${goal.d}s: ${goal.average_score.toLocaleString()} Average`;
      }
      if ("song_count" in goal) {
        return `${
          goal.score
            ? goal.score === 990000
              ? "AAA"
              : `${String(goal.score).substring(0, 3)}k+`
            : goal.clear_type
            ? clearTypes[goal.clear_type]
            : "Clear"
        } ${goal.song_count === 1 ? an[goal.d] || "a" : goal.song_count} ${
          goal.d
        }${goal.song_count === 1 ? "" : "s"}${goal.higher_diff ? "+" : ""}`;
      }
      if ("songs" in goal) {
        return `${String(goal.score).substring(0, 3)}k+ on ${goal.songs.join(
          " and "
        )}`;
      }
      if ("score" in goal) {
        let ret = `All ${goal.d}s over ${String(goal.score).substring(0, 3)}k`;
        if (goal.exceptions) {
          ret += ` (${goal.exceptions}E)`;
        }
        if (goal.song_exceptions) {
          ret += ` (ex. ${goal.song_exceptions.join(" & ")})`;
        }
        return ret;
      }
      return `${goal.d} ${
        goal.clear_type ? clearLamps[goal.clear_type] : "Clear"
      } Lamp`;
    }
  }
  return JSON.stringify(goal);
};

const Requirements = ({
  goals,
  requirements,
}: {
  requirements: Requirement[];
  goals: Goal[];
}) => {
  const rows: ReactElement[][] = [];

  let moreData = true;
  let index = 0;

  const getGoalId = (requirement: Requirement) =>
    requirement.goal_ids?.[index] ||
    (requirement.goal_ids &&
      requirement.mandatory_goal_ids &&
      (index === requirement.goal_ids.length
        ? "Mandatory"
        : requirement.mandatory_goal_ids[
            index - requirement.goal_ids.length - 1
          ])) ||
    requirement.mandatory_goal_ids?.[index] ||
    (requirement.substitutions &&
      (index === requirement.mandatory_goal_ids!.length
        ? "Substitutions"
        : requirement.substitutions[
            index - requirement.mandatory_goal_ids!.length - 1
          ]));

  while (moreData) {
    moreData = requirements.some(getGoalId);
    if (moreData) {
      rows.push(
        requirements.map((requirement, requirementIndex) => {
          const goalId = getGoalId(requirement);
          if (goalId) {
            if (goalId === "Mandatory") {
              return <th key={requirementIndex}>Mandatory</th>;
            }
            if (goalId === "Substitutions") {
              return <th key={requirementIndex}>Substitutions</th>;
            }
            return (
              <td key={requirementIndex}>
                {printGoal(goals.find((g) => g.id === goalId))}
              </td>
            );
          }
          return <td key={requirementIndex} />;
        })
      );
      index += 1;
    }
  }

  const romanNumerals: { [index: string]: string } = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
  };

  return (
    <table style={{ whiteSpace: "nowrap" }}>
      <thead>
        <tr>
          {requirements.map((requirement) => (
            <th key={requirement.rank}>
              {requirement.rank.charAt(0).toUpperCase() +
                requirement.rank.slice(1, -1) +
                " " +
                romanNumerals[requirement.rank.slice(-1)]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {requirements.map((requirement, index) => (
            <th key={index}>
              {requirement.requirements
                ? `Complete ${requirement.requirements} / ${
                    requirement.goal_ids?.length ||
                    requirement.mandatory_goal_ids?.length
                  }`
                : ""}
            </th>
          ))}
        </tr>
        {rows.map((row, index) => (
          <tr key={index}>{row}</tr>
        ))}
      </tbody>
    </table>
  );
};

type HomeProps = { host: string | null };

interface Ranks {
  game_versions: {
    A20: {
      rank_requirements: Requirement[];
    };
    A3: {
      rank_requirements: Requirement[];
    };
  };
  goals: Goal[];
}

export default function Home({ host }: HomeProps) {
  const requested = useRef(false);

  const [ranks, setRanks] = useState<Ranks | undefined>();

  const getRanks = useCallback(async () => {
    requested.current = true;

    const response = await fetch("/api/ranks");

    setRanks(await response.json());
  }, []);

  useEffect(() => {
    if (!requested.current) {
      getRanks();
    }
  }, [getRanks]);

  return (
    <>
      {ranks ? (
        <>
          <h2>A3</h2>
          <Requirements
            goals={ranks.goals}
            requirements={ranks.game_versions.A3.rank_requirements}
          />
          <h2>A20</h2>
          <Requirements
            goals={ranks.goals}
            requirements={ranks.game_versions.A20.rank_requirements}
          />
        </>
      ) : (
        "Loading ranks, please wait..."
      )}
      {/* <a
        href={`https://life4ddr.com/oauth/authorize?response_type=token&client_id=${
          process.env.NEXT_PUBLIC_LIFE4_OAUTH_CLIENT_ID
        }&redirect_uri=${
          host?.startsWith("localhost") ? "http://" : "https://"
        }${host}`}
      >
        Login
      </a> */}
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({
  query,
  req,
  res,
}) => {
  if (query.code) {
    const response = await fetch("https://life4ddr.com/oauth/token", {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: query.code as string,
        client_id: process.env.NEXT_PUBLIC_LIFE4_OAUTH_CLIENT_ID!,
        client_secret: process.env.LIFE4_OAUTH_CLIENT_SECRET!,
        redirect_uri: "/",
      }),
    });
    const json = await response.json();
    console.log(json);
    res.setHeader("Set-Cookie", [
      `access_token=${json.access_token}; Secure; HttpOnly`,
      `refresh_token=${json.refresh_token}; Secure; HttpOnly`,
    ]);
  }

  return {
    props: {
      host: req.headers.host,
    },
  };
};
