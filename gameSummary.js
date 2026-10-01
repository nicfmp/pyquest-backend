export function summarizeGame(state) {
  const completed = [...new Set((Array.isArray(state?.completedActivities) ? state.completedActivities : [])
    .filter(id => Number.isInteger(id) && id >= 1 && id <= 20))];
  return {
    totalXp: Number.isFinite(state?.totalXp) ? Math.max(0, Math.floor(state.totalXp)) : 0,
    completedActivities: completed.length,
    totalActivities: 20,
    isComplete: completed.length === 20,
  };
}
