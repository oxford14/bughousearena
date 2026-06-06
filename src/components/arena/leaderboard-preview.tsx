import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const mockLeaderboard = [
  { rank: 1, name: "GrandmasterDrop", rating: 2340 },
  { rank: 2, name: "BugHouseKing", rating: 2285 },
  { rank: 3, name: "PieceStorm", rating: 2210 },
  { rank: 4, name: "ArenaQueen", rating: 2150 },
  { rank: 5, name: "KnightRider", rating: 2090 },
];

export function LeaderboardPreview() {
  return (
    <section className="py-16 px-6 bg-muted/20">
      <div className="mx-auto max-w-3xl">
        <Card className="arena-card border-primary/20 bg-card/60 backdrop-blur-sm">
          <CardHeader className="text-center">
            <Trophy className="h-8 w-8 text-primary mx-auto mb-2" />
            <CardTitle className="font-heading text-2xl">Global Leaderboard Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockLeaderboard.map((entry) => (
                  <TableRow key={entry.rank}>
                    <TableCell className="font-heading text-primary">#{entry.rank}</TableCell>
                    <TableCell>{entry.name}</TableCell>
                    <TableCell className="text-right">{entry.rating}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
