export function calculateElo(
  playerRating: number,
  opponentRating: number,
  score: 1 | 0.5 | 0,
  k = 32
): number {
  const expected =
    1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  return Math.round(playerRating + k * (score - expected));
}
