// Precisa ficar em sincronia com totalChallenges em src/data/quests.js no front-end.
export const QUEST_TOTALS = {
  1: 10,
  2: 10,
  3: 10,
  4: 10,
};

export const QUEST_IDS = Object.keys(QUEST_TOTALS).map(Number);

export const XP_PER_CHALLENGE = 100;
