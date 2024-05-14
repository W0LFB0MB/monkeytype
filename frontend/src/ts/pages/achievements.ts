import Page from "./page";
import * as Skeleton from "../utils/skeleton";
import Ape from "../ape";
import { getLevel } from "../utils/levels";
import * as DB from "../db";
import * as Notifications from "../elements/notifications";
import { Auth } from "../firebase";

const numerals = [
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
  "XXI",
  "XXII",
  "XXIII",
  "XXIV",
  "XXV",
  "XXVI",
  "XXVII",
  "XXVIII",
  "XXIX",
  "XXX",
] as const;

function replaceTag(
  element: JQuery<HTMLElement>,
  tag: string
): JQuery<HTMLElement> {
  const newElement = $(`<${tag}>${element.html()}</${tag}>`);
  newElement.attr("class", element.attr("class") ?? "");
  newElement.attr("id", element.attr("id") ?? "");

  element.replaceWith(newElement);

  return newElement;
}

type AchievementGroupProps = {
  id: string;
  title: string;
  icon?: string;
  tip?: string;
  hideOtherSubgroup?: boolean;
  subgroups?: AchievementSubgroup[];
};

class AchievementGroup {
  public static all = new Map<string, AchievementGroup>();

  id: string;
  title: string;
  icon?: string;
  tip?: string;
  otherSubgroup: AchievementSubgroup;
  subgroups = new Map<string, AchievementSubgroup>();
  achievements = new Map<string, Achievement>();

  get element(): JQuery<HTMLElement> {
    return $(`#${this.id}Group`);
  }

  get titleElement(): JQuery<HTMLElement> {
    return this.element.find(".achievementGroupTitle");
  }

  get groupElement(): JQuery<HTMLElement> {
    return this.element.find(".achievementGroupContent");
  }

  constructor(props: AchievementGroupProps) {
    this.id = props.id;
    this.title = props.title;
    this.icon = props.icon;
    this.tip = props.tip;
    props.subgroups?.forEach((sg) => this.subgroups.set(sg.id, sg));

    this.otherSubgroup = new AchievementSubgroup({
      id: "other",
      title: "Other",
      hideTitle: props.hideOtherSubgroup ?? true,
      priority: 2,
      group: this,
    });

    AchievementGroup.all.set(this.id, this);
  }

  update(element = this.element): JQuery<HTMLElement> {
    const titleElement = element.find(".achievementGroupTitle");
    element.attr("id", `${this.id}Group`);
    titleElement.find(".title").text(this.title);

    const iconElement = titleElement.find("i");
    if (this.icon === undefined) {
      iconElement.addClass("hidden");
    } else {
      iconElement.attr("class", `fa fa-${this.icon}`);
    }

    const achievementCount = this.achievements.size;
    const achievedCount = this.groupElement.find(".achieved").length;
    titleElement.find(".progress").text(`${achievedCount}/${achievementCount}`);

    const tipElement = element.find(".groupTip");
    if (this.tip === undefined) {
      tipElement.addClass("hidden");
    } else {
      tipElement.removeClass("hidden");
    }
    tipElement.text(this.tip ?? "");

    return element;
  }

  public newElement(): JQuery<HTMLElement> {
    return this.update($($("#achievementGroupTemplate").html()));
  }
}

type AchievementSubgroupProps = {
  group: AchievementGroup;
  id: string;
  hideTitle?: boolean;
  title: string;
  tip?: string;
  priority?: number;
};

class AchievementSubgroup {
  group: AchievementGroup;
  id: string;
  title: string;
  hideTitle?: boolean;
  tip?: string;
  priority: number;
  achievements = new Map<string, Achievement>();

  get element(): JQuery<HTMLElement> {
    return $(`#${this.group.id}${this.id}Subgroup`);
  }

  get titleElement(): JQuery<HTMLElement> {
    return this.element.find(".achievementSubgroupTitle");
  }

  get contentElement(): JQuery<HTMLElement> {
    return this.element.find(".achievementSubgroupContent");
  }

  constructor(props: AchievementSubgroupProps) {
    this.group = props.group;
    this.id = props.id;
    this.title = props.title;
    this.tip = props.tip;
    this.hideTitle = props.hideTitle ?? false;
    this.priority = props.priority ?? 0;

    this.group.subgroups.set(this.id, this);
  }

  update(element = this.element): JQuery<HTMLElement> {
    const titleElement = element.find(".achievementSubgroupTitle");

    if (this.hideTitle) {
      titleElement.addClass("hidden");
    } else {
      titleElement.removeClass("hidden");
    }

    element.attr("id", `${this.group.id}${this.id}Subgroup`);
    titleElement.find(".title").text(this.title);

    const achievementCount = this.achievements.size;
    const achievedCount = this.contentElement.find(".achieved").length;
    titleElement.find(".progress").text(`${achievedCount}/${achievementCount}`);

    const tipElement = element.find(".subgroupTip");
    if (this.tip == undefined) {
      tipElement.addClass("hidden");
    } else {
      tipElement.removeClass("hidden");
    }
    tipElement.text(this.tip ?? "");

    return element;
  }

  public newElement(): JQuery<HTMLElement> {
    return this.update($($("#achievementSubgroupTemplate").html()));
  }
}

type AchievementProps = {
  id: string;
  title: string;
  description: string;
  note?: string;
  progressTemplate?: string;
  descending?: boolean;
  targets?: number[];
  hideProgressBar?: boolean;
  group: AchievementGroup;
  subgroup?: AchievementSubgroup;
  secret?: boolean;
  url?: string;
  defaultValue?: number;
  colorHex?: `#${string}`;
};

export class Achievement implements AchievementProps {
  // Map containing all Achievements
  public static readonly all = new Map<string, Achievement>();

  // Utility method for chaining Achievement.add(...).add(...).add(...);
  public static add(props: AchievementProps): typeof Achievement {
    new Achievement(props);
    return Achievement;
  }

  // Utility to automatically test and show achievement effects if new level unlocked
  async processCompletion(oldValue: number, newValue: number): Promise<void> {
    const level = await this.achievedNewLevel(oldValue, newValue);
    if (level > 0) {
      Notifications.add(`Completed ${this.title} ${numerals[level]}`, 0, {
        customTitle: "Achievement Unlocked",
        customIcon: "crown",
      });
    }
  }

  id: string;
  title: string;
  description: string;
  note?: string;
  progressTemplate?: string;
  descending: boolean;
  targets: number[];
  hideProgressBar: boolean;
  group: AchievementGroup;
  subgroup: AchievementSubgroup;
  secret: boolean;
  url?: string;
  defaultValue: number;
  colorHex?: `#${string}`;

  get element(): JQuery<HTMLElement> {
    return $(`#${this.id}`);
  }

  constructor(props: AchievementProps) {
    this.id = props.id;
    this.title = props.title;
    this.description = props.description;
    this.note = props.note;
    this.descending = props.descending ?? false;
    this.targets = props.targets ?? [1];
    this.group = props.group;
    this.subgroup = props.subgroup ?? this.group.otherSubgroup;
    this.secret = props.secret ?? false;
    this.url = props.url;
    this.defaultValue = props.defaultValue ?? 0;
    this.progressTemplate = props.progressTemplate;
    this.colorHex = props.colorHex;

    let progressBarHidden = false;
    if (props.group === AchievementGroups.challenge) progressBarHidden = true;
    this.hideProgressBar = props.hideProgressBar ?? progressBarHidden;

    Achievement.all.set(this.id, this);

    this.group.achievements.set(this.id, this);
    this.subgroup?.achievements.set(this.id, this);
  }

  updateElement(
    element = this.element,
    value = this.defaultValue
  ): JQuery<HTMLElement> {
    element.attr("id", this.id);
    element.find(".title").text(this.title);
    element.find(".description").html(this.description);

    if (this.targets.length === 1) {
      element.addClass("boolean");
    } else {
      element.removeClass("boolean");
    }

    const progress = element.find(".progress");
    if (this.progressTemplate === undefined) {
      progress.addClass("hidden");
    } else {
      progress.removeClass("hidden");
    }
    progress.html(this.progressTemplate ?? "");

    const { level, target } = this.getLevelAndTarget(value);

    if (level > 0 && value >= 0) {
      element.addClass("achieved");
    } else {
      element.removeClass("achieved");
    }

    if (value >= -1) {
      const lvl =
        level === this.targets.length
          ? '<i class="fa fa-crown"></i>'
          : numerals[level] ?? "";
      element.find(".numeral").html(lvl);
    }

    element
      .find(".value")
      .text(value < 0 ? "-" : Math.floor(value).toLocaleString("en-US"));
    element.find(".target").text(target);
    element.find(".bar").css("width", `${(value / target) * 100}%`);

    const note = element.find(".note");
    if (this.note === undefined) {
      note.addClass("hidden");
    } else {
      note.removeClass("hidden");
    }
    note.text(this.note ?? "");

    if (this.hideProgressBar) {
      element.find(".progressBar").addClass("hidden");
    } else {
      element.find(".progressBar").removeClass("hidden");
    }

    if (this.url !== undefined) {
      element = replaceTag(element, "a");
    } else {
      element = replaceTag(element, "div");
    }
    element.attr("href", this.url ?? "");

    if (this.colorHex !== undefined) {
      element.css("--main-color", this.colorHex);
    } else {
      element.removeAttr("style");
    }

    return element;
  }

  public newElement(): JQuery<HTMLElement> {
    return this.updateElement($($("#achievementTemplate").html()));
  }

  update(value = this.defaultValue): JQuery<HTMLElement> {
    return this.updateElement(this.element, value);
  }

  getLevelAndTarget(value: number): { level: number; target: number } {
    const targets = this.targets;
    if (targets[0] === undefined || value < 0)
      return { level: 0, target: targets[0] ?? 1 };

    for (let i = 0; i < targets.length; i++) {
      if (
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        (!this.descending && targets[i]! > value) ||
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        (this.descending && targets[i]! < value)
      ) {
        return {
          level: i,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          target: targets[i]!,
        };
      }
    }

    return {
      level: targets.length,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      target: targets[targets.length - 1]!,
    };
  }

  // Checks if the difference between two values are significant enough to level an achievement
  async achievedNewLevel(oldValue: number, newValue: number): Promise<number> {
    if (
      (this.descending && oldValue > newValue) ||
      (!this.descending && oldValue < newValue)
    ) {
      const { level: oldLevel } = this.getLevelAndTarget(oldValue);
      const { level: newLevel } = this.getLevelAndTarget(newValue);

      if (oldLevel !== newLevel) return newLevel;
    }

    return 0;
  }
}

async function getAccountStats(update = true): Promise<{
  maxWpm: number;
  wordsEstimate: number;
  quotes: number;
  xp: number;
  level: number;
  streak: number;
  tests: number;
  time: number;
  achievements: Record<string, number>;
}> {
  if (update) await DB.getUserResults();
  const achievements: Record<string, number> = {};
  const snapshot = DB.getSnapshot();

  let wordsEstimate = 0;
  let maxWpm = 0;
  let quotes = 0;

  snapshot?.results?.forEach(
    (result: SharedTypes.Result<SharedTypes.Config.Mode>) => {
      wordsEstimate += Math.round((result.wpm / 60) * result.testDuration);
      maxWpm = maxWpm > result.wpm ? maxWpm : result.wpm;

      const challenge = result.challenge;
      if (challenge !== undefined) achievements[challenge] = 1;

      if (result.mode === "quote" && result.bailedOut == false) {
        quotes++;
      }
    }
  );

  const xp = snapshot?.xp ?? 0;

  return {
    maxWpm: maxWpm,
    wordsEstimate: wordsEstimate,
    quotes: quotes,
    xp: xp,
    level: Math.floor(getLevel(xp)),
    streak: snapshot?.maxStreak ?? 0,
    tests: snapshot?.typingStats?.completedTests ?? 0,
    time: snapshot?.typingStats?.timeTyping ?? 0,
    achievements: achievements,
  };
}

// Honestly dont know what to name this
export async function proccessAchievementProgress(
  result: SharedTypes.Result<SharedTypes.Config.Mode>,
  res?: {
    xp: number;
    streak: number;
  }
): Promise<void> {
  const oldStats = await getAccountStats(false);

  await Achievement.all
    .get("speedAchievement")
    ?.processCompletion(oldStats.maxWpm, result.wpm);

  const newWordsEstimate =
    oldStats.wordsEstimate +
    Math.round((result.wpm / 60) * result.testDuration);
  await Achievement.all
    .get("wordsAchievement")
    ?.processCompletion(oldStats.wordsEstimate, newWordsEstimate);

  if (result.mode === "quote") {
    await Achievement.all
      .get("quotesAchievement")
      ?.processCompletion(oldStats.quotes, oldStats.quotes + 1);
  }

  const newLevel = Math.floor(getLevel(oldStats.xp + (res?.xp ?? 0)));
  await Achievement.all
    .get("levelAchievement")
    ?.processCompletion(oldStats.level, newLevel);

  await Achievement.all
    .get("streakAchievement")
    ?.processCompletion(oldStats.streak, res?.streak ?? oldStats.streak);

  await Achievement.all
    .get("testtakerAchievement")
    ?.processCompletion(oldStats.tests, oldStats.tests + 1);

  await Achievement.all
    .get("hoursAchievement")
    ?.processCompletion(
      oldStats.time / 60 / 60,
      (oldStats.time + result.testDuration) / 60 / 60
    );
}

async function getAccountAchievements(): Promise<Record<string, number>> {
  const stats = await getAccountStats();
  const achievements: Record<string, number> = stats.achievements;

  achievements["wordsAchievement"] = stats.wordsEstimate;
  achievements["speedAchievement"] = stats.maxWpm;
  achievements["levelAchievement"] = stats.level;
  achievements["streakAchievement"] = stats.streak;
  achievements["quotesAchievement"] = stats.quotes;
  achievements["testtakerAchievement"] = stats.tests;
  achievements["hoursAchievement"] = stats.time / 60 / 60;

  return achievements;
}

async function loadAchievements(): Promise<void> {
  const response = await Ape.achievements.getAchievements();
  const responseData = response.status === 200 ? response.data : {};

  // Collate achievement data;
  const achievements: Record<string, number> = {
    ...(await getAccountAchievements()),
    ...responseData,
  };

  // Update achievements
  for (const [id, value] of Object.entries(achievements)) {
    Achievement.all.get(id)?.update(value);
  }

  AchievementGroup.all.forEach((group) => {
    group.update();
    group.subgroups.forEach((sg) => {
      sg.update();
    });
  });
}

function resetAchievements(): void {
  Achievement.all.forEach((achievment) =>
    achievment.update(achievment.defaultValue)
  );
}

let loadedHtml = false;
// Loads all Achievements, groups & subgroups
function loadHtml(): void {
  if (loadedHtml) return;
  loadedHtml = true;

  AchievementGroup.all.forEach((group) => {
    $("#pageAchievements").append(group.newElement());
    const subgroups = Array.from(group.subgroups.values()).sort(
      (a, b) => a.priority - b.priority
    );
    subgroups.forEach((sg) => group.groupElement.append(sg.newElement()));
  });

  Achievement.all.forEach((achievement) => {
    achievement.subgroup.contentElement.append(achievement.newElement());
  });
}

export const page = new Page({
  name: "achievements",
  element: $(".page.pageAchievements"),
  path: "/achievements",
  afterHide: async (): Promise<void> => {
    Skeleton.remove("pageAchievements");
  },
  beforeShow: async (): Promise<void> => {
    Skeleton.append("pageAchievements", "main");
    loadHtml();
    if (Auth?.currentUser == undefined) {
      resetAchievements();
    } else {
      await loadAchievements(); // only load achievement data if user is logged in
    }
  },
});

Skeleton.save("pageAchievements");

const AchievementGroups = {
  account: new AchievementGroup({
    id: "account",
    title: "Achievements",
    icon: "trophy",
  }),
  challenge: new AchievementGroup({
    id: "challenge",
    title: "Challenges",
    icon: "star",
    hideOtherSubgroup: false,
    tip: "tip: You can click on any challenge with the 🔗 icon to automatically load it!",
  }),
} as const;

const AchievementSubgroups = {
  accountOther: AchievementGroups.account.otherSubgroup,
  challengeChampions: new AchievementSubgroup({
    id: "challengeChampions",
    title: "Champions challenges",
    group: AchievementGroups.challenge,
  }),
  challengeClassicEndurance: new AchievementSubgroup({
    id: "challengeClassicEndurance",
    title: "Classic Endurance challenges",
    group: AchievementGroups.challenge,
  }),
  challengeSpecificText: new AchievementSubgroup({
    id: "challengeSpecificText",
    title: "Specific Text challenges",
    group: AchievementGroups.challenge,
  }),
  challengeSpeed: new AchievementSubgroup({
    id: "challengeSpeed",
    title: "Speed challenges",
    group: AchievementGroups.challenge,
  }),
  challengeAccuracy: new AchievementSubgroup({
    id: "challengeAccuracy",
    title: "Accuracy challenges",
    group: AchievementGroups.challenge,
    tip: "A minimum 60wpm and maximum 5% afk time rules apply to all accuracy challenges.",
  }),
  challengeScriptsSongs: new AchievementSubgroup({
    id: "challengeScriptsSongs",
    title: "Script and song challenges",
    group: AchievementGroups.challenge,
  }),
  challengeFunbox: new AchievementSubgroup({
    id: "challengeFunbox",
    title: "Funbox challenges",
    group: AchievementGroups.challenge,
  }),
  challengeOther: AchievementGroups.challenge.otherSubgroup,
} as const;

const targetSpan = '<span class="target">-</span>';
const valueSpan = '<span class="value">-</span>';

// Achievements
Achievement.add({
  id: "speedAchievement",
  title: "Speedy typist",
  description: `Reach a typing speed of ${targetSpan} wpm`,
  group: AchievementGroups.account,
  targets: [
    40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190,
    200, 210, 220, 230, 240, 250, 260, 270, 290, 300, 310, 320, 330, 340, 350,
  ],
  progressTemplate: `${valueSpan}/${targetSpan} wpm`,
})
  .add({
    id: "hoursAchievement",
    title: "Master Typist",
    description: 'Spend a total of <span class="target">1</span> hours typing',
    group: AchievementGroups.account,
    targets: [
      2, 5, 7, 10, 15, 20, 25, 30, 50, 75, 100, 125, 150, 200, 250, 300, 350,
      400, 500, 600, 700,
    ],
    progressTemplate: `${valueSpan}/${targetSpan} hours`,
  })
  .add({
    id: "streakAchievement",
    title: "Streak",
    description: 'Achieve a streak of <span class="target">5</span> days',
    group: AchievementGroups.account,
    targets: [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250, 300, 365],
    progressTemplate: `${valueSpan}/${targetSpan} days`,
  })
  .add({
    id: "quotesAchievement",
    title: "Quoter",
    description: `Type ${targetSpan} quotes`,
    group: AchievementGroups.account,
    targets: [
      10, 50, 100, 200, 500, 1000, 2500, 5000, 10000, 50000, 100000, 250000,
      500000, 1000000,
    ],
    progressTemplate: `${valueSpan}/${targetSpan} quotes`,
  })
  .add({
    id: "wordsAchievement",
    title: "Dictionary",
    description: `Type ${targetSpan} words`,
    group: AchievementGroups.account,
    targets: [
      500, 1000, 1500, 2000, 3000, 5000, 7500, 100000, 250000, 500000, 1000000,
      2000000, 5000000, 10000000,
    ],
    progressTemplate: `${valueSpan}/${targetSpan} words`,
  })
  .add({
    id: "levelAchievement",
    title: "Experienced",
    description: `Reach level ${targetSpan}`,
    group: AchievementGroups.account,
    targets: [10, 25, 50, 75, 100, 150, 200, 250, 300, 350, 400, 450],
    progressTemplate: `Level ${valueSpan}/${targetSpan}`,
  })
  .add({
    id: "testtakerAchievement",
    title: "Test taker",
    description: `Complete ${targetSpan} tests`,
    group: AchievementGroups.account,
    targets: [50, 100, 150, 250, 500, 1000, 1500, 2000, 3000, 4000],
    progressTemplate: `${valueSpan}/${targetSpan} tests`,
  })
  .add({
    id: "leaderboard15Achievement",
    title: "Leader 15",
    description: `Reach #${targetSpan} on the English 15 second leaderboard`,
    descending: true,
    group: AchievementGroups.account,
    targets: [500, 250, 100, 50, 25, 10, 5, 3, 2, 1],
    progressTemplate: `Peak: #${valueSpan}`,
    hideProgressBar: true,
    defaultValue: -1,
  })
  .add({
    id: "leaderboard60Achievement",
    title: "Leader 60",
    description: `Reach #${targetSpan} on the English 60 second leaderboard`,
    descending: true,
    group: AchievementGroups.account,
    targets: [500, 250, 100, 50, 25, 10, 5, 3, 2, 1],
    progressTemplate: `Peak: #${valueSpan}`,
    hideProgressBar: true,
    defaultValue: -1,
  });

// Champions challenges
Achievement.add({
  id: "fluidchampionChallenge",
  title: "Fluid Champion",
  description: "Achieve the highest wpm in time 60 using 3 different layouts.",
  group: AchievementGroups.challenge,
  subgroup: AchievementSubgroups.challengeChampions,
})
  .add({
    id: "onehourchampionChallenge",
    title: "One Hour Champion",
    description: "Achieve the highest wpm in a one hour test.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeChampions,
  })
  .add({
    id: "accuracychampionChallenge",
    title: "Accuracy Champion",
    description: "Achieve the longest Master mode test.",
    note: "Accuracy rules apply",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeChampions,
  })
  .add({
    id: "insanitychampionChallenge",
    title: "Do You Know The Definition Of Insanity",
    description:
      "Complete the longest typing session known in the history of Monkeytype.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeChampions,
  })
  .add({
    id: "fastestchampionChallenge",
    title: "Literally The Fastest Person Here",
    description:
      "Achieve 1st place on the time 60 English all time leaderboard.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeChampions,
  });

// Classic endurance challenges
Achievement.add({
  id: "oneHourWarrior",
  title: "One Hour Warrior",
  description: "Complete a one hour long test.",
  url: "/challenge_oneHourWarrior",
  group: AchievementGroups.challenge,
  subgroup: AchievementSubgroups.challengeClassicEndurance,
})
  .add({
    id: "doubleDown",
    title: "Double Down",
    description: "Complete a two hour test.",
    url: "/challenge_oneHourWarrior",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeClassicEndurance,
  })
  .add({
    id: "tripleTrouble",
    title: "Triple Trouble",
    description: "Complete a three hour test.",
    url: "/challenge_tjripleTrouble",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeClassicEndurance,
  })
  .add({
    id: "quad",
    title: "Quaaaaad",
    description: "Complete a four hour test.",
    url: "/challenge_quad",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeClassicEndurance,
  })
  .add({
    id: "eightball",
    title: "8 Ball",
    description: "Complete an eight hour test.",
    url: "/challenge_8Ball",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeClassicEndurance,
  })
  .add({
    id: "twelveChallenge",
    title: "The Big 12",
    description: "Complete a 12 hour test.",
    url: "/challenge_theBigTwelve",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeClassicEndurance,
  })
  .add({
    id: "dayChallenge",
    title: "1 Day",
    description: "Complete a 24 hour test.",
    url: "/challenge_1Day",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeClassicEndurance,
  });

// Specific text challenges
Achievement.add({
  id: "simp",
  title: "Simp",
  description: "Type miodec one thousand times.",
  url: "/challenge_simp",
  group: AchievementGroups.challenge,
  subgroup: AchievementSubgroups.challengeSpecificText,
})
  .add({
    id: "trueSimp",
    title: "True Simp",
    description: "Type miodec ten thousand times.",
    url: "/challenge_trueSimp",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeSpecificText,
  })
  .add({
    id: "simpLord",
    title: "Simp Lord",
    description: "Type miodec one hundered thousand times.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeSpecificText,
  })
  .add({
    id: "antidiseWhat",
    title: "Antidise-what?",
    description: "Get at least 200 wpm typing antidisestablishmentarianism.",
    url: "/challenge_antidiseWhat",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeSpecificText,
  })
  .add({
    id: "whatsThisWebsiteCalledAgain",
    title: "What's this website called again?",
    description: "Type monkeytype one thousand times.",
    url: "/challenge_whatsThisWebsiteCalledAgain",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeSpecificText,
  })
  .add({
    // develop develop develop...
    id: "developd",
    title: "Develop'd",
    description: "Type develop one thousand times.",
    url: "/challenge_developd",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeSpecificText,
  });

// Speed challenges
Achievement.add({
  id: "slowAndSteady",
  title: "Slow And Steady",
  description:
    "Without the need of the live wpm or pace caret, complete a 5 minute test with exactly 60 WPM.",
  note: "Video verification required.",
  url: "/challenge_slowAndSteady",
  group: AchievementGroups.challenge,
  subgroup: AchievementSubgroups.challengeSpeed,
})
  .add({
    id: "blazeitChallenge",
    title: "Blaze It",
    description:
      "Achieve 420.00 (must have decimals enabled) wpm exactly by typing weed.",
    note: "Screen recording with the sound of you typing required.",
    url: "/challenge_blazeIt",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeSpeed,
  })
  .add({
    id: "speedSpacer",
    title: "Speed Spacer",
    description:
      "Get 100 wpm on a randomised custom test with the following input: 'a b c d e f g h i j k l m n o p q r s t u v w x y z' (the alphabet) and a word count of 100.",
    url: "/challenge_speedSpacer",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeSpeed,
  })
  .add({
    id: "alphaChallenge",
    title: "A l p h a",
    description:
      "Type the alphabet, where each letter is separated by a space and in alphabetical order 'a b c d e f g h i j k l m n o p q r s t u v w x y z' in LESS than 3.37 seconds.",
    note: " Master mode and video verification required: screen recording including the sound of you typing. Also make sure to hover over the time at the end in case it's rounded to make sure it's LESS than 3.37 seconds.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeSpeed,
  })
  .add({
    id: "iveGotThePower",
    title: "I've got the POWER",
    description: "Get 400 wpm while typing 10x 'power'",
    note: "Video verification required, including the sound of you typing.",
    url: "/challenge_iveGotThePower",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeSpeed,
  })
  .add({
    id: "bigramsaladChallenge",
    title: "Bigram Salad",
    description:
      "Get 100 WPM on a randomized, 100 word custom test with the following words list: 'to of in it is as at be we he so on an or do if up by my go'.",
    url: "/challenge_bigramSalad",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeSpeed,
  })
  .add({
    id: "burstmasterChallenge",
    title: "Burst Master",
    description: "Get 200-249 wpm on the words 10 mode.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeSpeed,
  })
  .add({
    id: "burstgodChallenge",
    title: "Burst God",
    description: "Get 250-299 on the words 10 mode.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeSpeed,
  })
  .add({
    id: "shotgunChallenge",
    title: "Shotgun",
    description: "Get 300-349 wpm on the words 10 mode",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeSpeed,
  })
  .add({
    id: "nukeChallenge",
    title: "Nuke",
    description: "Get 350-399 wpm on the words 10 mode.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeSpeed,
  });

// Accuracy challenges
Achievement.add({
  id: "flawlessChallenge",
  title: "Flawless",
  description:
    "Complete a time 15, 30, 60, 120 and words 10, 25, 50, 100 (8 tests) back-to-back in Master mode. If you fail one of them, you have to start from the beginning.",
  note: "Video verification required.",
  group: AchievementGroups.challenge,
  subgroup: AchievementSubgroups.challengeAccuracy,
})
  .add({
    id: "believeChallenge",
    title: "He's beginning to believe",
    description: `Complete a 2 minute test with 100% accuracy using the following settings: Normal difficulty, Blind mode, Caret style: off, Highlight mode: off, Tape mode: off, Min acc: off`,
    note: "Video verification required.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeAccuracy,
  })
  .add({
    id: "accuracyExpert",
    title: "Accuracy Expert",
    description: "Complete a 10 minute master mode test.",
    url: "/challenge_accuracy",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeAccuracy,
  })
  .add({
    id: "accuracyMaster",
    title: "Accuracy Master",
    description: "Complete a 20 minute master mode test.",
    url: "/challenge_accuracy",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeAccuracy,
  })
  .add({
    id: "accuracyGod",
    title: "Accuracy God",
    description: "Complete a 30 minute master mode test.",
    url: "/challenge_accuracy",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeAccuracy,
  });

// Script and song challenges
Achievement.add({
  id: "developerChallenge",
  title: "Look at me. I am the developer now.",
  description:
    "Type out the whole source code of Monkeytype, as it was in February 2022.",
  group: AchievementGroups.challenge,
  subgroup: AchievementSubgroups.challengeScriptsSongs,
})
  .add({
    id: "starwarsChallenge",
    title: "In a galaxy far, far away",
    description:
      "Type out the whole Star Wars Episode 4 script with punctuation while watching Star Wars Episode 4 at the same time.",
    note: "Video or stream verification required.",
    url: "/challenge_inAGalaxyFarFarAway",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeScriptsSongs,
  })
  .add({
    id: "starwars2Challenge",
    title: "Who's your daddy",
    description:
      "Type out the whole Star Wars Episode 5 script with punctuation while watching Star Wars Episode 5 at the same time.",
    note: "Video or stream verification required.",
    url: "/challenge_whosYourDaddy",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeScriptsSongs,
  })
  .add({
    id: "starwars3Challenge",
    title: "It's a trap!!",
    description:
      "Type out the whole Star Wars Episode 6 script with punctuation while watching Star Wars Episode 6 at the same time.",
    note: "Video or stream verification required.",
    url: "/challenge_itsATrap",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeScriptsSongs,
  })
  .add({
    id: "jolly",
    title: "Jolly",
    description: "Type the Jolly script with a minimum of 70 wpm.",
    url: "/challenge_jolly",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeScriptsSongs,
  })
  .add({
    id: "gottaCatchEmAll",
    title: "Gotta Catch 'Em All",
    description: "Type the names of all Pokemon.",
    note: "Words history verification required.",
    url: "/challenge_gottaCatchEmAll",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeScriptsSongs,
  })
  .add({
    id: "rapGod",
    title: "Rap God",
    description:
      "Type out the lyrics of Eminem's Rap God at a minimum of 85 wpm and 90 accuracy.",
    note: "Punctuation required.",
    url: "/challenge_rapGod",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeScriptsSongs,
  })
  .add({
    id: "littlechefChallenge",
    title: "Little Chef",
    description:
      "Type out the whole Ratatouille script while watching the movie at the same time.",
    note: "Video or stream verification required.",
    url: "/challenge_littleChef",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeScriptsSongs,
  })
  .add({
    id: "crosstalkChallenge",
    title: "(CROSSTALK)",
    description:
      "Type out the whole transcript of the first 2020 Presidential Debate.",
    note: "Video or stream verification required.",
    url: "/challenge_crosstalk",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeScriptsSongs,
  })
  .add({
    id: "beepboopChallenge",
    title: "Beep Boop",
    description:
      "Type the beepboop script with 100% accuracy and at least 45 wpm",
    url: "/challenge_beepBoop",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeScriptsSongs,
  })
  .add({
    id: "beesChallenge",
    title: "Bees!!!",
    description:
      "Type out the whole Bee Movie script while watching the Bee Movie at the same time.",
    note: "Video or stream verification required.",
    url: "/challenge_bees",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeScriptsSongs,
  })
  .add({
    id: "shadesChallenge",
    title: "50 Shades of Hell",
    description: "Type out your favourite chapter from 50 Shades of Gray.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeScriptsSongs,
  })
  .add({
    id: "navySeal",
    title: "Navy Seal",
    description: "Type out the Navy Seal copy pasta with 100% accuracy.",
    note: "minimum 60wpm and maximum 5% afk time.",
    url: "/challenge_navySeal",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeScriptsSongs,
  })
  .add({
    id: "shrekChallenge",
    title: "Get Off My Swamp",
    description:
      "Type out the entire Shrek script with punctuation while watching Shrek at the same time.",
    note: "Video or stream verification required.",
    url: "/challenge_getOffMySwamp",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeScriptsSongs,
  });

// Funbox challenges
Achievement.add({
  id: "belikewaterChallenge",
  title: "Be Like Water",
  description:
    "Achieve at least 50wpm in all three layouts in time 60 using the 'layoutfluid' mode.",
  group: AchievementGroups.challenge,
  subgroup: AchievementSubgroups.challengeFunbox,
  url: "/challenge_beLikeWater",
  note: "Must be 50 in each layout. Layouts must be unique, cannot use qwerty and qwertz for example.",
})
  .add({
    id: "rollercoaster",
    title: "Rollercoaster",
    description:
      "Complete at least a one hour test using the 'round round baby' mode.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeFunbox,
    url: "/challenge_rollercoaster",
  })
  .add({
    id: "oneHourMirror",
    title: "ɿoɿɿim ɿυoʜ ɘno",
    description: "Complete at least a one hour test using the 'mirror' mode.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeFunbox,
    url: "/challenge_oneHourMirror",
  })
  .add({
    id: "chooChoo",
    title: "Choo Choo Baby",
    description: "Complete at least a one hour test using `choo choo` mode.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeFunbox,
    url: "/challenge_chooChoo",
  })
  .add({
    id: "mnemonistChallenge",
    title: "Mnemonist",
    description:
      "Get 100+ wpm with 100% accuracy on a 25 word test using the 'memory' funbox.",
    note: "Video verification required.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeFunbox,
    url: "/challenge_mnemonist",
  })
  .add({
    id: "earfquake",
    title: "Earfquake",
    description:
      "Complete at least a one hour test using the 'earthquake' funbox mode.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeFunbox,
    url: "/challenge_earfquake",
  })
  .add({
    id: "simonSez",
    title: "simon sez",
    description:
      "Complete at least a one hour test using the 'simon says' funbox mode.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeFunbox,
    url: "/challenge_simonSez",
  })
  .add({
    id: "accountant",
    title: "Accountant",
    description:
      "Complete at least a one hour test using the '58008' funbox mode.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeFunbox,
    url: "/challenge_accountant",
  })
  .add({
    id: "hidden",
    title: "Hidden",
    description:
      "Get 100+ WPM using the 'read ahead' funbox on a 60 second test.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeFunbox,
    url: "/challenge_hidden",
  })
  .add({
    id: "iCanSeeTheFuture",
    title: "I can see the future",
    description:
      "Get 100+ WPM using the 'read ahead hard' funbox on a 60 second test.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeFunbox,
    url: "/challenge_iCanSeeTheFuture",
  })
  .add({
    id: "whatAreWordsAtThisPoint",
    title: "What are words at this point",
    description:
      "Complete at least a one hour test using the 'gibberish' funbox mode.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeFunbox,
    url: "/challenge_whatAreWordsAtThisPoint",
  })
  .add({
    id: "specials",
    title: "!@#$%",
    description:
      "Complete at least a one hour test using the 'specials' funbox mode.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeFunbox,
    url: "/challenge_specials",
  })
  .add({
    id: "aeiou",
    title: "Aeiou.",
    description:
      "Complete at least a one hour test using the 'tts' funbox mode.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeFunbox,
    url: "/challenge_aeiou",
  })
  .add({
    id: "asciiWarrior",
    title: "ASCII Warrior.",
    description:
      "Complete at least a one hour test using the 'ascii' funbox mode.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeFunbox,
    url: "/challenge_asciiWarrior",
  })
  .add({
    id: "iKiNdAlIkEhOwInEfFiCiEnTqWeRtYiS",
    title: "I kInDa LiKe HoW iNeFfIcIeNt QwErTy Is",
    description:
      "Complete at least a one hour test using the 'randomcase' funbox mode.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeFunbox,
    url: "/challenge_iKiNdAlIkEhOwInEfFiCiEnTqWeRtYiS",
  })
  .add({
    id: "oneNauseousMonkey",
    title: "One Nauseous Monkey",
    description:
      "Complete at least a one hour test using the 'nausea' funbox mode.",
    group: AchievementGroups.challenge,
    subgroup: AchievementSubgroups.challengeFunbox,
    url: "/challenge_oneNauseousMonkey",
  });

// Other challenges
Achievement.add({
  id: "thumbWarrior",
  title: "Thumb Warrior",
  description: "Complete a one hour test using only your thumbs.",
  note: "Video verification required.",
  group: AchievementGroups.challenge,
  url: "/challenge_thumbWarrior",
})
  .add({
    id: "fingerBlaster",
    title: "Thumb Warrior",
    description: "Achieve at least 60wpm using one finger on a time 60 test.",
    note: "Handcam required.",
    group: AchievementGroups.challenge,
  })
  .add({
    id: "mouseWarrior",
    title: "Mouse Warrior",
    description: "Complete a one hour test using only the on screen keyboard.",
    note: "Video verification required. No funbox.",
    group: AchievementGroups.challenge,
    url: "/challenge_mouseWarrior",
  })
  .add({
    id: "wingdings",
    title: "Ten Words of Pain",
    description:
      "Complete a 10 word master mode test using the Wingdings custom font.",
    note: "No keymap allowed. Handcam required.",
    group: AchievementGroups.challenge,
    url: "/challenge_wingdings",
  })
  .add({
    id: "mobileWarrior",
    title: "Mobile Warrior",
    description: "Complete a one hour test on mobile.",
    group: AchievementGroups.challenge,
    url: "/challenge_mobileWarrior",
  })
  .add({
    id: "69",
    title: "6969696969",
    description:
      "Complete a 69 second test and achieve 69 wpm, 69 raw, 69% accuracy and 69% consistency.",
    note: "Video required.",
    group: AchievementGroups.challenge,
    url: "/challenge_69",
  })
  .add({
    id: "whyAreTheWallsMoving",
    title: "Why are the walls moving?",
    description: "Complete a one hour test using tape mode: letter.",
    note: "Video verification required.",
    group: AchievementGroups.challenge,
  })
  .add({
    id: "upsideDown",
    title: "uʍop ǝpᴉsdn",
    description:
      "Achieve at least 60wpm on a one minute test with your keyboard upside down.",
    note: "Handcam required.",
    group: AchievementGroups.challenge,
    url: "/challenge_upsideDown",
  })
  .add({
    id: "oneArmedBandit",
    title: "One Armed Bandit",
    description:
      "Complete a one hour or 10k words test (whichever comes sooner, use an external timer) using a one handed words list for your layout.",
    note: "Video verification required.",
    group: AchievementGroups.challenge,
    url: "/challenge_oneArmedBandit",
  })
  .add({
    id: "englishMaster",
    title: "English Master",
    description:
      "Complete at least a one hour test using English 10k language with punctuation and numbers enabled.",
    group: AchievementGroups.challenge,
    url: "/challenge_englishMaster",
  })
  .add({
    id: "feetWarrior",
    title: "Feet Warrior",
    description: "Complete a one hour test using your feet. Don't ask me why.",
    note: "Video or stream verification required.",
    group: AchievementGroups.challenge,
    url: "/challenge_feetWarrior",
  })
  .add({
    id: "woodPecker",
    title: "Wood Pecker",
    description: "Complete a 200 word test using only your nose.",
    group: AchievementGroups.challenge,
  })
  .add({
    id: "100Hours",
    title: "100 hours",
    description: "Achieve 100 hours typed.",
    group: AchievementGroups.challenge,
  })
  .add({
    id: "250Hours",
    title: "250 hours",
    description: "Achieve 250 hours typed.",
    group: AchievementGroups.challenge,
  })
  .add({
    id: "500Hours",
    title: "500 hours",
    description: "Achieve 500 hours typed.",
    group: AchievementGroups.challenge,
  })
  .add({
    id: "mrWorldwide",
    title: "Mr Worldwide",
    description:
      "Achieve 100 wpm on a 60 second test in 5 different languages. (must be unique)",
    group: AchievementGroups.challenge,
  })
  .add({
    id: "internalMetronome",
    title: "Internal Metronome",
    description:
      "Complete a 60s test (standard english, not english 10k etc...) with a minimum consistency of 90%, 100% accuracy and be within 25% of your 60s personal best.",
    group: AchievementGroups.challenge,
  })
  .add({
    id: "apesTogetherStrong",
    title: "Apes Together Strong",
    description:
      "Complete a 1 hour test in a Tribe lobby with at least 10 players.",
    group: AchievementGroups.challenge,
  })
  .add({
    id: "apesTogetherStronger",
    title: "🍌 Apes Together Stronger",
    description:
      "Complete a 2 hour test in a Tribe lobby with at least 10 players.",
    group: AchievementGroups.challenge,
  });
