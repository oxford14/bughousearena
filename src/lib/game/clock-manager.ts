export function formatClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function createClockManager(
  initialSeconds: number,
  onTick: (team1: number, team2: number) => void
) {
  let team1 = initialSeconds;
  let team2 = initialSeconds;
  let activeTeam: 1 | 2 = 1;
  let interval: ReturnType<typeof setInterval> | null = null;

  return {
    start(team: 1 | 2) {
      activeTeam = team;
      if (interval) return;
      interval = setInterval(() => {
        if (activeTeam === 1) {
          team1 = Math.max(0, team1 - 1);
        } else {
          team2 = Math.max(0, team2 - 1);
        }
        onTick(team1, team2);
      }, 1000);
    },
    switchTeam(team: 1 | 2) {
      activeTeam = team;
    },
    stop() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
    getTimes: () => ({ team1, team2 }),
  };
}
