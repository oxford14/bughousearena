/** Client wrappers for tournament APIs (re-export from wallet-api). */
export {
  joinTournamentRoom,
  registerTournamentTeam,
  createTournament,
  startTournamentBracket,
  kickTournamentMember,
  kickTournamentTeam,
  leaveTournament,
  pruneTournament,
  tournamentMatchHeartbeat,
  checkTournamentForfeit,
  clearTournamentRegistrationOnGameStart,
  advanceTournamentMatch,
} from "@/lib/wallet/wallet-api";

export {
  TOURNAMENT_ENTRY_FEE,
  TOURNAMENT_MAX_PLAYERS,
} from "@/lib/wallet/tournament-constants";
