import * as db from "../init/db";
import { Collection, WithId, UpdateResult } from "mongodb";

export const getAchievementsCollection = (): Collection<
  WithId<MonkeyTypes.Achievements>
> => db.collection<MonkeyTypes.Achievements>("achievements");

export async function getAchievements(
  uid: string
): Promise<WithId<WithId<MonkeyTypes.Achievements>> | null> {
  const config = await getAchievementsCollection().findOne({ uid });
  return config;
}

export async function getAchievement(
  uid: string,
  aid: string
): Promise<number | undefined> {
  const config = await getAchievementsCollection().findOne({ uid });
  return config?.achievements[aid];
}

export async function setAchievement(
  uid: string,
  achievementID: string,
  value: number
): Promise<UpdateResult> {
  const achievementsObj = await getAchievements(uid);
  const achievements = achievementsObj?.achievements ?? {};
  achievements[achievementID] = value;

  return await getAchievementsCollection().updateOne(
    { uid },
    { $set: { achievements: achievements } },
    { upsert: true }
  );
}
