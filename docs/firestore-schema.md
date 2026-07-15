# Bughouse Arena — Firestore Schema

## Collections Overview

| Collection | Document ID | Purpose |
|------------|-------------|---------|
| `users` | `{uid}` | Player profiles, stats, house membership |
| `users/{uid}/friends` | `{friendId}` | Accepted friend relationships |
| `users/{uid}/friendRequests` | `{requestId}` | Pending friend requests |
| `users/{uid}/messages` | `{messageId}` | Direct messages |
| `matchmaking` | auto | Queue entries for casual/ranked |
| `matches` | auto | Active and completed games |
| `matches/{id}/boards` | `board-a`..`board-d` | 4-board bughouse state |
| `matches/{id}/moves` | auto | Move audit log |
| `privateRooms` | `{code}` | 6-char invite rooms |
| `houses` | auto | Guild/house metadata |
| `houses/{id}/members` | `{uid}` | Role assignments |
| `houses/{id}/chat` | auto | House Hall messages |
| `leaderboards/global/entries` | `{uid}` | Global ratings |
| `leaderboards/houses/entries` | `{houseId}` | House rankings |
| `leaderboards/seasons/{seasonId}/entries` | `{uid}` | Seasonal ratings |
| `matchHistory/{uid}/games` | `{matchId}` | Per-player history |
| `voiceSignals/{roomId}/candidates` | auto | WebRTC signaling |

## User Profile (`users/{uid}`)

```typescript
{
  displayName: string;
  photoURL: string | null;
  email: string | null;
  rating: number;          // Default 1200
  rankedWins: number;
  rankedLosses: number;
  arenaCoins: number;
  houseId: string | null;
  onlineStatus: "online" | "away" | "offline";
  lastOnline: Timestamp;
  createdAt: Timestamp;
}
```

## Match (`matches/{matchId}`)

```typescript
{
  mode: "casual" | "ranked" | "private";
  status: "waiting" | "active" | "completed" | "abandoned";
  players: MatchPlayer[];
  teamClocks: { team1: number; team2: number };
  winnerTeam: 1 | 2 | null;
  privateRoomCode?: string;
  createdAt: Timestamp;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
}
```

## Board (`matches/{matchId}/boards/{boardId}`)

Board IDs: `board-a`, `board-b`, `board-c`, `board-d`

Team 1: boards A/B (partners). Team 2: boards C/D (partners).

```typescript
{
  fen: string;
  captured: string[];       // Droppable pieces for this player
  turn: "w" | "b";
  lastMove: string | null;
  playerUid: string;
  partnerBoardId: string;
  team: 1 | 2;
  isCheck: boolean;
  isGameOver: boolean;
}
```

## House Roles

- **founder**: Full control, cannot be demoted
- **steward**: Can manage members and house settings
- **member**: Can chat in House Hall

## Firebase Connection (Live: `bughousearena`)

1. `.env.local` is configured with your Firebase web app keys
2. Set `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false` for production (already set)
3. **Auth enabled:** Email/Password + Google Sign-In
4. **Firestore:** rules + indexes deployed to `(default)` database
5. **Seed data:** global/house/seasonal leaderboards, 2 houses, demo friends (via Firebase MCP)

### Remaining manual steps

- **Blaze plan** required for Cloud Functions — upgrade at [Firebase usage](https://console.firebase.google.com/project/bughousearena/usage/details), then run:
  `npx firebase-tools@latest deploy --only functions`
- **Firebase Storage** — open [Storage setup](https://console.firebase.google.com/project/bughousearena/storage), click Get Started, then:
  `npx firebase-tools@latest deploy --only storage`
- Add **bughousearena.com** (and `www` if used) to **Authentication → Settings → Authorized domains**
- Connect the custom domain in **Firebase Hosting** and point DNS to Firebase
- Set production env: `NEXT_PUBLIC_APP_URL=https://bughousearena.com`
- PayMongo webhook: `https://bughousearena.com/api/paymongo/webhook`

## Local Development

```bash
cp .env.local.example .env.local
npm run emulators   # Start Firebase emulators
npm run dev         # Start Next.js (webpack for Serwist)
```
