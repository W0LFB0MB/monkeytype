import * as AchievementsDAL from "../../dal/achievements";
import * as LeaderboardsDAL from "../../dal/leaderboards";
import { MonkeyResponse } from "../../utils/monkey-response";

export async function getAchievements(
  req: MonkeyTypes.Request
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;

  const data = await AchievementsDAL.getAchievements(uid);
  if (data === null) return new MonkeyResponse("Achievements retrieved", {});

  // Check for placement improvement & update peak rank
  for (const lb of ["15", "60"]) {
    const oldRank = data?.achievements[`leaderboard${lb}Achievement`];

    const lbDALRes = await LeaderboardsDAL.getRank("time", lb, "english", uid);
    if (lbDALRes !== false && lbDALRes?.rank) {
      const newRank = lbDALRes.rank;

      const higherRank =
        oldRank !== undefined && oldRank < newRank ? oldRank : newRank;

      if (higherRank !== oldRank) {
        await AchievementsDAL.setAchievement(
          uid,
          `leaderboard${lb}Achievement`,
          higherRank
        );
      }

      data.achievements[`leaderboard${lb}Achievement`] = higherRank;
    }
  }

  return new MonkeyResponse("Achievements retrieved", data.achievements);
}
