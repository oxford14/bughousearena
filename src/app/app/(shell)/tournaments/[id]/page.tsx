"use client";

import { useParams } from "next/navigation";
import TournamentRoomContent from "@/components/arena/tournaments/tournament-room-content";

export default function TournamentRoomPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  return <TournamentRoomContent tournamentId={tournamentId} />;
}
