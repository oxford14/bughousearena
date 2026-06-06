import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BookOpen, Play } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RulesDropMateBoard } from "@/components/arena/rules-drop-mate-board";
import {
  RulesInvalidPawnRankBoard,
  RulesInvalidSelfCheckBoard,
  RulesLegalBlockDropBoard,
  RulesPromotedCaptureBoard,
} from "@/components/arena/rules-invalid-drops-demo";

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "structure", label: "Game Structure" },
  { id: "teams", label: "Teams & Partners" },
  { id: "chess", label: "Standard Chess" },
  { id: "captures", label: "Captures & Reserve" },
  { id: "promoted", label: "Promoted Pieces" },
  { id: "drops", label: "Piece Drops" },
  { id: "restrictions", label: "Drop Restrictions" },
  { id: "check", label: "Check & Self-Check" },
  { id: "endings", label: "Checkmate & Stalemate" },
  { id: "clocks", label: "Clocks & Sitting" },
  { id: "match-end", label: "Match End" },
  { id: "arena", label: "Bughouse Arena" },
  { id: "strategy", label: "Strategy" },
  { id: "faq", label: "FAQ" },
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-heading text-2xl md:text-3xl mb-6 neon-glow">{title}</h2>
      <div className="space-y-4 text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

function RuleCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="arena-card rounded-xl border border-primary/20 p-5">
      <h3 className="font-heading text-lg text-foreground mb-2">{title}</h3>
      <div className="text-sm text-muted-foreground space-y-2">{children}</div>
    </div>
  );
}

function Diagram({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="my-8 arena-card rounded-xl border border-primary/25 overflow-hidden">
      <div className="relative aspect-[16/10] w-full bg-muted/30">
        <Image src={src} alt={alt} fill className="object-contain p-2" sizes="(max-width: 768px) 100vw, 720px" />
      </div>
      <figcaption className="px-4 py-3 text-sm text-muted-foreground border-t border-primary/15 bg-card/60">
        {caption}
      </figcaption>
    </figure>
  );
}

function Notation({ children }: { children: string }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-secondary font-mono">{children}</code>
  );
}

export function RulesGuide({ embedded = false }: { embedded?: boolean }) {
  const body = (
    <>
      <div className={cn("text-center mb-16", embedded && "mb-10")}>
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-secondary mb-6">
          <BookOpen className="h-4 w-4" />
          Official Rules
        </div>
        <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4 neon-glow">
          Bughouse Rules & How to Play
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Competitive four-player team chess on two boards — captures feed your partner, drops win games.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
        <nav aria-label="Table of contents" className="lg:w-56 shrink-0 lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs uppercase tracking-widest text-secondary mb-3">On this page</p>
          <ul className="flex flex-wrap lg:flex-col gap-2">
            {TOC.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="block text-sm text-muted-foreground hover:text-primary transition-colors py-1 cursor-pointer"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 flex-1 space-y-16">
          <Section id="overview" title="What is Bughouse?">
            <p>
              <strong className="text-foreground">Bughouse</strong> (Exchange Chess, Tandem Chess, Double Chess)
              is a four-player team variant. Two chess games run at the same time on{" "}
              <strong className="text-foreground">Board Alpha</strong> and{" "}
              <strong className="text-foreground">Board Bravo</strong>. When you capture a piece, it goes to your
              partner&apos;s <strong className="text-foreground">reserve</strong> (pocket). Your partner can later{" "}
              <strong className="text-foreground">drop</strong> that piece onto their board instead of making a normal
              move.
            </p>
            <p>
              Bughouse Arena validates every move and drop server-side against these official rules using a dedicated
              rules engine built on chess.js.
            </p>
          </Section>

          <Section id="structure" title="Game Structure">
            <p>
              Bughouse uses exactly <strong className="text-foreground">two physical boards</strong>. Both teams play
              on both boards — one player from each team sits at each board:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Board A (Alpha)</strong> — Team 1 White vs Team 2 Black
              </li>
              <li>
                <strong className="text-foreground">Board B (Bravo)</strong> — Team 2 White vs Team 1 Black
              </li>
            </ul>
            <p>
              There are no separate Board C or Board D. Four players share these two boards. Each board has its own
              position, clocks, and reserves. Captures on one board feed your partner&apos;s reserve on the other board.
            </p>
          </Section>

          <Section id="teams" title="Teams & Partners">
            <Diagram
              src="/assets/rules/rules-team-layout.png"
              alt="Two chess boards side by side: Board A has Team 1 White vs Team 2 Black, Board B has Team 2 White vs Team 1 Black, with partner arrows crossing between boards"
              caption="Only two boards. Team 1 (blue): White on Board A + Black on Board B. Team 2 (red): Black on Board A + White on Board B. Partner arrows show where captures go."
            />
            <div className="grid sm:grid-cols-2 gap-4 not-prose">
              <RuleCard title="Team 1 (Blue)">
                <ul className="list-disc pl-4 space-y-1">
                  <li>White on Board A (Alpha)</li>
                  <li>Black on Board B (Bravo)</li>
                </ul>
                <p className="pt-2">Partners across the two boards — never on the same board.</p>
              </RuleCard>
              <RuleCard title="Team 2 (Red)">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Black on Board A (Alpha)</li>
                  <li>White on Board B (Bravo)</li>
                </ul>
                <p className="pt-2">Same two boards as Team 1, opposite colors.</p>
              </RuleCard>
            </div>
            <p>
              In the arena you see <strong className="text-foreground">your board</strong> and your{" "}
              <strong className="text-foreground">partner&apos;s board</strong>. Captures you make appear in your
              partner&apos;s pocket instantly.
            </p>
          </Section>

          <Section id="chess" title="Standard Chess Rules">
            <p>All normal chess rules apply on each board, validated through chess.js:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Legal piece movement, including castling and en passant</li>
              <li>Check, checkmate, and pawn promotion on the final rank</li>
              <li>On your turn you make <strong className="text-foreground">one</strong> action: a normal move <em>or</em> a reserve drop — never both</li>
            </ul>
          </Section>

          <Section id="captures" title="Captures & the Reserve">
            <p>When you capture an enemy piece:</p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>The piece is removed from your board.</li>
              <li>Its type is determined (see promoted-piece rule below).</li>
              <li>That piece is added to your <strong className="text-foreground">partner&apos;s</strong> reserve — not yours.</li>
            </ol>
            <Diagram
              src="/assets/rules/rules-capture-transfer.png"
              alt="Captured knight transferring from one board to the partner reserve pocket"
              caption="You capture on your board → the piece appears in your partner&apos;s reserve. Coordinate timing with voice chat."
            />
            <div className="grid sm:grid-cols-2 gap-4 not-prose">
              <RuleCard title="Allowed in reserve">
                <p>Pawn, Knight, Bishop, Rook, Queen. Kings are never captured or stored.</p>
              </RuleCard>
              <RuleCard title="Reserve integrity">
                <p>
                  Each piece exists once. Drops consume a piece from reserve. The engine prevents duplicate transfers
                  and negative counts.
                </p>
              </RuleCard>
            </div>
          </Section>

          <Section id="promoted" title="Promoted Piece Rule">
            <p>
              Promoted pieces are tracked by square. If a promoted pawn is captured — even if it became a queen, rook,
              bishop, or knight — your partner receives a <strong className="text-foreground">pawn</strong>, not the
              promoted piece type.
            </p>
            <div className="my-6 arena-card rounded-xl border border-primary/25 p-4 not-prose">
              <p className="text-xs uppercase tracking-widest text-secondary mb-3 text-center">
                Purple = promoted queen (if captured, partner gets a pawn)
              </p>
              <RulesPromotedCaptureBoard />
            </div>
            <p>
              Example: a pawn promotes to queen on e8. Later that queen is captured. Your partner&apos;s reserve gains{" "}
              <Notation>P</Notation>, not <Notation>Q</Notation>.
            </p>
          </Section>

          <Section id="drops" title="Piece Drops">
            <p>
              Instead of moving, play a piece from your reserve onto any empty square. Drop notation looks like{" "}
              <Notation>N@f7</Notation> (knight on f7) or <Notation>Q@h6#</Notation> (queen drop delivering mate).
              A drop uses your entire turn.
            </p>
            <Diagram
              src="/assets/rules/rules-drop-example.png"
              alt="Queen drop Qh6 checkmate on the h-file"
              caption="Checkmate by drop: Q@h6# — the queen checks along the open h-file while Black&apos;s rook on g8 blocks escape."
            />
            <div className="my-6 arena-card rounded-xl border border-primary/25 p-4">
              <p className="text-xs uppercase tracking-widest text-secondary mb-3 text-center">
                Verified engine position (green = dropped queen on h6)
              </p>
              <RulesDropMateBoard />
            </div>
            <p>
              Dropped pawns cannot move two squares on their first move. If a dropped pawn later reaches the final rank,
              it promotes normally under standard chess rules.
            </p>
            <p>In Bughouse Arena: select a piece in your pocket, then click an empty square on your board.</p>
          </Section>

          <Section id="restrictions" title="Drop Restrictions">
            <p>A drop is legal only when all of the following hold:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The target square is empty</li>
              <li>You own the piece in your reserve</li>
              <li>It is your turn on that board</li>
              <li>After the drop, <strong className="text-foreground">your king is not in check</strong></li>
            </ul>
            <Diagram
              src="/assets/rules/rules-invalid-drops.png"
              alt="Illegal pawn rank drop and illegal drop failing to resolve check"
              caption="Left: P@f8 is illegal — pawns cannot be dropped on the 1st or 8th rank. Right: in check from Qc3, B@h5 fails because your king remains attacked."
            />
            <div className="grid md:grid-cols-3 gap-4 my-6 not-prose">
              <div className="arena-card rounded-xl border border-primary/25 p-4">
                <p className="text-xs uppercase tracking-widest text-secondary mb-3 text-center">Illegal P@f8</p>
                <RulesInvalidPawnRankBoard />
              </div>
              <div className="arena-card rounded-xl border border-primary/25 p-4">
                <p className="text-xs uppercase tracking-widest text-secondary mb-3 text-center">Illegal B@h5</p>
                <RulesInvalidSelfCheckBoard />
              </div>
              <div className="arena-card rounded-xl border border-primary/25 p-4">
                <p className="text-xs uppercase tracking-widest text-secondary mb-3 text-center">Legal B@d2 blocks</p>
                <RulesLegalBlockDropBoard />
              </div>
            </div>
          </Section>

          <Section id="check" title="Check & Self-Check">
            <p>
              A dropped piece may give check (<Notation>N@f7+</Notation>) or checkmate (<Notation>Q@h6#</Notation>)
              to the <strong className="text-foreground">opponent</strong>. That is legal and often decisive.
            </p>
            <p>
              You may never move or drop while <strong className="text-foreground">your own king remains in check</strong>.
              If you are in check, you must move the king, capture the attacker, block the line, or drop a piece that
              resolves the check — such as <Notation>B@d2</Notation> blocking the queen on c3 in the diagram above.
            </p>
          </Section>

          <Section id="endings" title="Checkmate & Stalemate">
            <Diagram
              src="/assets/rules/rules-win-condition.png"
              alt="Checkmate on Board A ends the match for the winning team; only two boards exist in bughouse"
              caption="Checkmate on Board A or Board B ends the entire match immediately — there are only two boards. The team that delivered mate wins."
            />
            <div className="my-6 arena-card rounded-xl border border-primary/25 p-4">
              <p className="text-xs uppercase tracking-widest text-secondary mb-3 text-center">
                Example mate position on Board A (Q@h6#)
              </p>
              <RulesDropMateBoard />
            </div>
            <div className="grid sm:grid-cols-2 gap-4 not-prose">
              <RuleCard title="Checkmate">
                <p>
                  When a king is in check and has no legal move or drop, that board is checkmate. The whole Bughouse
                  match ends at once — the mating team wins.
                </p>
              </RuleCard>
              <RuleCard title="Stalemate (board freeze)">
                <p>
                  Stalemate occurs when the king is <em>not</em> in check but has no legal moves and no legal reserve
                  drops. Only that board freezes — clocks on that board stop, no further moves or drops. The other board
                  continues until checkmate, time forfeit, or resignation.
                </p>
              </RuleCard>
            </div>
            <p>
              One board stalemating does <strong className="text-foreground">not</strong> draw the full match. The game
              continues on the active board unless both boards are drawn under tournament rules.
            </p>
          </Section>

          <Section id="clocks" title="Clocks & Sitting">
            <p>
              Official Bughouse uses <strong className="text-foreground">independent clocks on each board</strong>:
              White Alpha Clock, Black Alpha Clock, White Bravo Clock, and Black Bravo Clock. When White moves, White&apos;s
              clock stops and Black&apos;s clock on that same board runs — independently on Alpha and Bravo.
            </p>
            <p>
              If <strong className="text-foreground">any</strong> player&apos;s clock hits zero, that player&apos;s team
              loses immediately.
            </p>
            <p>
              When the match begins, <strong className="text-foreground">both boards start simultaneously</strong> —
              White&apos;s clock on Alpha and White&apos;s clock on Bravo begin running immediately. No first move is
              required to start the clocks. If a player delays their opening move, only their own clock continues to run.
            </p>
            <RuleCard title="Sitting (legal waiting)">
              <p>
                You may deliberately delay moving while your own clock runs — for example, waiting for your partner to
                capture a queen or knight before you continue. This strategic waiting is legal; you are never forced to
                move early.
              </p>
            </RuleCard>
          </Section>

          <Section id="match-end" title="When the Match Ends">
            <p>The match ends immediately when any of these occur:</p>
            <ol className="list-decimal pl-6 space-y-2">
              <li><strong className="text-foreground">Checkmate</strong> on either board</li>
              <li><strong className="text-foreground">Time forfeit</strong> — any player&apos;s clock reaches zero</li>
              <li><strong className="text-foreground">Resignation</strong> by any player (forfeits the whole team)</li>
              <li>Administrative forfeit</li>
            </ol>
          </Section>

          <Section id="arena" title="Playing on Bughouse Arena">
            <div className="grid sm:grid-cols-3 gap-4 not-prose">
              <RuleCard title="Casual">
                <p>Unrated games with fast queue times.</p>
              </RuleCard>
              <RuleCard title="Ranked">
                <p>ELO matchmaking with rank tiers from Pawn (&lt;1200) to King (2200+).</p>
              </RuleCard>
              <RuleCard title="Private">
                <p>Room codes for custom four-player matches.</p>
              </RuleCard>
            </div>
            <p className="pt-4">
              Built-in voice chat connects you to your partner at match start. Queue solo or party with a friend to
              guarantee partner pairing.
            </p>
          </Section>

          <Section id="strategy" title="Strategy Tips">
            <div className="grid sm:grid-cols-2 gap-4 not-prose">
              <RuleCard title="Feed with purpose">
                <p>Capture pieces your partner can use — call out what is coming.</p>
              </RuleCard>
              <RuleCard title="Watch both boards">
                <p>Your partner&apos;s mate ends the game for you too.</p>
              </RuleCard>
              <RuleCard title="Use sitting">
                <p>Wait for the right reserve piece before committing on your board.</p>
              </RuleCard>
              <RuleCard title="King safety">
                <p>Open kings die to drops. Shelter until pocket threats are manageable.</p>
              </RuleCard>
            </div>
          </Section>

          <Section id="faq" title="FAQ">
            <div className="space-y-4 not-prose">
              <RuleCard title="Can I drop a piece I captured?">
                <p>
                  No. Your captures go to your partner. You drop pieces your partner captured on their board.
                </p>
              </RuleCard>
              <RuleCard title="What happens when a promoted piece is captured?">
                <p>Your partner always receives a pawn, regardless of what the piece promoted to.</p>
              </RuleCard>
              <RuleCard title="Can a drop give check?">
                <p>Yes. Drops may give check or checkmate to the opponent. Only self-check is forbidden.</p>
              </RuleCard>
              <RuleCard title="What if one board stalemates?">
                <p>That board freezes. The match continues on the other board until a decisive result.</p>
              </RuleCard>
              <RuleCard title="Bughouse vs Crazyhouse?">
                <p>Crazyhouse is two-player with your own captures. Bughouse is four-player team play with partner reserves.</p>
              </RuleCard>
            </div>
          </Section>

          <div className="arena-card rounded-2xl border border-primary/30 p-8 md:p-10 text-center">
            <h2 className="font-heading text-2xl md:text-3xl mb-3 neon-glow">Ready to enter the arena?</h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Every move is validated against these rules. Queue up and play.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={embedded ? "/app/lobby" : "/app/loader"}
                className={cn(buttonVariants({ size: "lg" }), "btn-arena-primary cursor-pointer")}
              >
                <Play className="h-5 w-5 mr-2" />
                {embedded ? "Go to Lobby" : "Play Game"}
              </Link>
              {!embedded ? (
                <Link
                  href="/login"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "cursor-pointer border-primary/50 hover:border-primary")}
                >
                  Create Account
                </Link>
              ) : null}
            </div>
          </div>
        </article>
      </div>
    </>
  );

  if (embedded) {
    return <div className="mx-auto max-w-6xl pb-8">{body}</div>;
  }

  return (
    <div className="min-h-screen arena-bg">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
          <p className="font-heading text-lg neon-glow hidden sm:block">Rules & How to Play</p>
          <Link href="/app/loader" className={cn(buttonVariants({ size: "sm" }), "btn-arena-primary cursor-pointer shrink-0")}>
            <Play className="h-4 w-4 mr-1.5" />
            Play Now
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">{body}</div>
      <footer className="border-t border-border/50 py-8 px-6 mt-8">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <Link href="/" className="font-heading text-foreground neon-glow cursor-pointer">Bughouse Arena</Link>
          <p>Competitive 4-player team chess</p>
        </div>
      </footer>
    </div>
  );
}
