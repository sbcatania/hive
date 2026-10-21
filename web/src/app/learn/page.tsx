import Link from "next/link";
import { BugDemo } from "@/components/BugDemo";
import { BugGlyph } from "@/components/BugGlyph";
import { Diagram } from "@/components/Diagram";
import type { BugLetter } from "@/lib/engine-types";
import { MiniTile } from "@/components/PieceTile";
import { SketchHero } from "@/components/SketchHero";
import {
  CountsVignette,
  DrawSketch,
  EarlyQueenVignette,
  GateSketch,
  HintSketch,
  LiteVignette,
  NotationCompass,
  OneHiveSketch,
  PassSketch,
  QueenDeadlineSketch,
  ReachSketch,
  RepetitionVignette,
  StackSketch,
  StunSketch,
  SundownVignette,
  SwarmVignette,
} from "@/components/RuleSketches";

export const metadata = { title: "How to play" };

const OPENING = "Base;InProgress;White[3];wS1;bS1 wS1-;wQ -wS1;bQ bS1-";

interface Specimen {
  bug: BugLetter;
  name: string;
  latin: string;
  count: string;
  expansion?: boolean;
  movement: React.ReactNode;
  note: React.ReactNode;
  game: string;
  focus: string;
}

const SPECIMENS: Specimen[] = [
  {
    bug: "Q",
    name: "Queen Bee",
    latin: "Apis regina",
    count: "1 per player",
    movement: <>Moves exactly <b>one space</b> around the edge of the hive. Must be placed by your fourth turn, and nothing of yours can move until she&apos;s down.</>,
    note: <>Keep at least two open sides around her. A Queen with room can step out of a closing trap, a Queen boxed in by her own pieces cannot.</>,
    game: "Base+MLP;InProgress;Black[4];wS1;bA1 -wS1;wM wS1\\;bG1 -bA1;wA1 wM\\;bQ bG1\\;wQ wA1\\",
    focus: "bQ",
  },
  {
    bug: "B",
    name: "Beetle",
    latin: "Coleoptera scandens",
    count: "2 per player",
    movement: <>Moves one space, but can <b>climb onto the hive</b> and walk along the top. Whatever it sits on is pinned, and the stack counts as the Beetle&apos;s colour.</>,
    note: <>A Beetle on top of the enemy Queen both pins her and fills one of her six sides. Beetles can also climb onto Beetles.</>,
    game: "Base+MLP;InProgress;Black[4];wL;bL \\wL;wM wL\\;bQ bL/;wA1 -wM;bB1 -bQ;wQ -wA1",
    focus: "bB1",
  },
  {
    bug: "G",
    name: "Grasshopper",
    latin: "Saltator rectus",
    count: "3 per player",
    movement: <><b>Jumps in a straight line</b> over one or more pieces and lands in the first empty space. It ignores the Freedom to Move rule.</>,
    note: <>The finisher. It can leap into a gap next to a Queen that no sliding piece can reach.</>,
    game: "Base+MLP;InProgress;White[5];wS1;bS1 -wS1;wP wS1-;bP -bS1;wG1 wP/;bA1 -bP;wQ wP-;bQ \\bS1",
    focus: "wG1",
  },
  {
    bug: "S",
    name: "Spider",
    latin: "Araneus tripes",
    count: "2 per player",
    movement: <>Slides <b>exactly three spaces</b>, no more and no less, never backtracking, staying in contact with the hive.</>,
    note: <>Slow but surgical: count three steps and it often reaches a pocket the Ants have overlooked.</>,
    game: "Base+MLP;InProgress;White[5];wL;bA1 wL\\;wA1 -wL;bA2 /bA1;wS1 -wA1;bB1 bA2-;wQ \\wA1;bQ bB1-",
    focus: "wS1",
  },
  {
    bug: "A",
    name: "Soldier Ant",
    latin: "Formica militaris",
    count: "3 per player",
    movement: <>Slides <b>any number of spaces</b> around the outside of the hive. It can&apos;t squeeze through gaps or slip into enclosed spaces.</>,
    note: <>The most valuable bug. Pin enemy Ants early by surrounding them, and keep yours free for the decisive moment.</>,
    game: "Base+MLP;InProgress;Black[4];wB1;bQ /wB1;wG1 wB1-;bB1 bQ\\;wL \\wG1;bA1 -bQ;wQ \\wL",
    focus: "bA1",
  },
  {
    bug: "M",
    name: "Mosquito",
    latin: "Culex imitator",
    count: "1 per player",
    expansion: true,
    movement: <>Has no movement of its own: it <b>copies any bug it touches</b>, friend or foe. Once on top of the hive it moves like a Beetle until it comes down. Next to only a Mosquito it can&apos;t move.</>,
    note: <>Its value depends on its neighbours. Parked next to an Ant it&apos;s a second Ant; next to a Pillbug it can lift pieces too.</>,
    game: "Base+MLP;InProgress;White[5];wL;bP \\wL;wG1 wL\\;bQ \\bP;wM -wG1;bB1 \\bQ;wQ wG1\\;bG1 \\bB1",
    focus: "wM",
  },
  {
    bug: "L",
    name: "Ladybug",
    latin: "Coccinella saltans",
    count: "1 per player",
    expansion: true,
    movement: <>Moves <b>three spaces: two on top of the hive, then one down</b>. It must take all three steps and may drop into enclosed spaces.</>,
    note: <>Brilliant for reaching the far side of the hive in one move, or dropping straight into a Queen&apos;s last open side.</>,
    game: "Base+MLP;InProgress;Black[4];wS1;bA1 /wS1;wQ wS1-;bL bA1\\;wG1 \\wS1;bQ -bA1;wP wQ-",
    focus: "bL",
  },
  {
    bug: "P",
    name: "Pillbug",
    latin: "Armadillidium levator",
    count: "1 per player",
    expansion: true,
    movement: (
      <>
        Moves one space like the Queen. Or, instead, it uses its special ability: <b>lift an adjacent piece</b> (either colour) over itself and drop it on another empty space next to it. It can&apos;t lift a stacked piece, a piece that would split the hive, or the piece your opponent just moved, and the lifted piece is stunned for a turn.
      </>
    ),
    note: <>The great defender: throw an attacker away from your Queen, or move your own Queen out of a trap. Here White&apos;s Pillbug can throw Black&apos;s Ant.</>,
    game: "Base+P;InProgress;White[5];wP;bA1 wP\\;wS1 wP/;bQ /bA1;wG1 \\wS1;bQ -bA1;wQ -wG1;bB1 /bQ",
    focus: "bA1",
  },
];

const CHAPTERS = [
  ["aim", "The aim"],
  ["placing", "Placing"],
  ["moving", "Moving"],
  ["bugs", "The bugs"],
  ["finer", "Finer points"],
  ["variants", "Variants"],
  ["notation", "Notation"],
];

function Plate({ bug }: { bug: BugLetter }) {
  return <MiniTile bug={bug} size={80} seed={bug.charCodeAt(0)} />;
}

function Chapter({ id, title, children }: { id: string; n?: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <div className="flex items-baseline gap-3 border-b border-dashed border-line-strong pb-2">
        <h2 className="font-display text-3xl font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="grid items-center gap-6 md:grid-cols-[1fr_1fr]">
        <div className="max-w-xl">
          <h1 className="font-display text-4xl leading-tight font-semibold sm:text-5xl">How to play Hive</h1>
          <p className="mt-3 text-lg text-ink-soft">
            Hive, by John Yianni, has no board: the pieces themselves are the playing field. Two players, eleven bugs each (fourteen with the expansions), and
            one goal. These pages follow the official rules and their tournament clarifications. Every board here is live, so tap around.
          </p>
        </div>
        <SketchHero className="mx-auto w-full max-w-md" />
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[12rem_1fr]">
        <nav className="hidden lg:block">
          <ul className="sticky top-20 space-y-1 text-sm">
            {CHAPTERS.map(([id, t], i) => (
              <li key={id}>
                <a href={`#${id}`} className="flex gap-2 sk px-2 py-1 text-ink-soft hover:bg-card hover:text-ink">
                  {t}
                </a>
              </li>
            ))}
            <li className="pt-3">
              <Link href="/puzzles" className="btn w-full">
                Try the puzzles
              </Link>
            </li>
          </ul>
        </nav>

        <article className="min-w-0 space-y-14 leading-relaxed">
          <Chapter id="aim" n={0} title="The aim">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-lg">
                  <b>Surround your opponent&apos;s Queen Bee on all six sides.</b> Pieces of either colour count. If both Queens are surrounded by the same move, it&apos;s
                  a draw.
                </p>
                <p className="text-ink-soft">There&apos;s no luck and no hidden information. On each turn you either place a new piece from your hand, or move one already in the hive.</p>
                <p className="text-ink-soft">
                  Each player has 1 Queen Bee, 2 Spiders, 2 Beetles, 3 Grasshoppers and 3 Soldier Ants. The Mosquito, Ladybug and Pillbug expansions add one of each.
                </p>
              </div>
              <Diagram
                height={220}
                pieces={[
                  { q: 0, r: 0, bug: "Q", color: "b" },
                  { q: 1, r: 0, bug: "A", color: "w" },
                  { q: 0, r: 1, bug: "G", color: "w" },
                  { q: -1, r: 1, bug: "S", color: "b" },
                  { q: -1, r: 0, bug: "B", color: "w" },
                  { q: 0, r: -1, bug: "A", color: "b" },
                ]}
                marks={[{ q: 1, r: -1, kind: "ok" }]}
              />
            </div>
          </Chapter>

          <Chapter id="placing" n={1} title="Placing">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-5">
                <ul className="list-disc space-y-2 pl-5">
                  <li>White places first. The second piece of the game just has to touch the first.</li>
                  <li>
                    After that, <b>a new piece may only touch your own colour</b>, never an opponent&apos;s.
                  </li>
                  <li>
                    Your <b>Queen must be in the hive by your fourth turn</b>.
                  </li>
                  <li>
                    <b>Tournament opening</b> (on by default): neither player may place their Queen on their very first turn.
                  </li>
                  <li>Placed pieces never leave the game.</li>
                </ul>
                <QueenDeadlineSketch className="mx-auto md:mx-0 md:ml-5" />
              </div>
              <BugDemo gameString={OPENING} focus="wG1" caption="White wants to place a Grasshopper: only cells touching white pieces alone are allowed." />
            </div>
          </Chapter>

          <Chapter id="moving" n={2} title="Moving">
            <p>
              You can move pieces once your Queen is placed. Every move must obey <b>two laws</b>:
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="font-display text-xl font-semibold">One Hive</h3>
                <div className="flex items-start gap-3">
                  <p className="min-w-0 flex-1 text-sm text-ink-soft">The hive must stay in one connected piece, even <i>while</i> a piece is moving. A piece holding two halves together is pinned.</p>
                  <OneHiveSketch width={128} />
                </div>
                <BugDemo gameString={OPENING} focus="wS1" height="h-56" caption="White's Spider joins its Queen to the rest of the hive, so it can't move." />
              </div>
              <div className="space-y-2">
                <h3 className="font-display text-xl font-semibold">Freedom to Move</h3>
                <div className="flex items-start gap-3">
                  <p className="min-w-0 flex-1 text-sm text-ink-soft">Pieces slide; they can&apos;t squeeze through a gap between two pieces. Climbers and jumpers (Beetle, Grasshopper, Ladybug) get over it.</p>
                  <GateSketch width={128} />
                </div>
                <Diagram
                  height={224}
                  pieces={[
                    { q: 1, r: 0, bug: "G", color: "w" },
                    { q: 0, r: 1, bug: "S", color: "b" },
                    { q: -1, r: 1, bug: "Q", color: "b" },
                    { q: -1, r: 0, bug: "B", color: "w" },
                    { q: 0, r: -1, bug: "Q", color: "w" },
                    { q: 1, r: -1, bug: "A", color: "w" },
                  ]}
                  marks={[{ q: 0, r: 0, kind: "no" }]}
                  arrows={[[1, -1, 0, 0]]}
                />
              </div>
            </div>
          </Chapter>

          <Chapter id="bugs" n={3} title="The bugs">
            <p className="text-ink-soft">Each specimen below is a real position. The coloured cells show where the highlighted bug can go; tap one to watch it move.</p>
            <div className="space-y-10">
              {SPECIMENS.map((s) => (
                <div key={s.bug} className="grid gap-5 md:grid-cols-[1fr_1.1fr]">
                  <div className="card space-y-3 p-5">
                    <div className="flex items-start gap-4">
                      <Plate bug={s.bug} />
                      <div>
                        <h3 className="font-display text-2xl font-semibold">{s.name}</h3>
                        <div className="text-sm text-muted">
                          <span className="font-display italic">{s.latin}</span> · {s.count}
                          {s.expansion ? " (expansion)" : ""}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm">{s.movement}</p>
                    <div className="pencil pencil-clear pencil-dashed p-3 text-sm">
                      <span className="font-display font-semibold italic">Field note. </span>
                      {s.note}
                    </div>
                  </div>
                  <BugDemo gameString={s.game} focus={s.focus} />
                </div>
              ))}
            </div>
          </Chapter>

          <Chapter id="finer" n={4} title="Finer points">
            <dl className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["Stunned pieces", "A piece that was just moved (including one thrown by a Pillbug) can't be moved or thrown by the Pillbug on the very next turn.", <StunSketch key="s" />],
                  ["Stacks", "Only the top piece of a stack can move. A Beetle's stack counts as the Beetle's colour for placing. Stacks also block sliding at height: two tall stacks form a gate.", <StackSketch key="s" />],
                  ["Passing", "If you have no legal move or placement at all, you must pass. You can't pass otherwise.", <PassSketch key="s" />],
                  ["Draws", "Both Queens surrounded at once, or by agreement. Endless shuffling isn't an automatic draw in the official rules (there's a variant for that).", <DrawSketch key="s" />],
                  ["Click any piece", "On this site, clicking an opponent's piece shows where it could go on their next turn (dashed red ink). A piece that can't move tells you why.", <ReachSketch key="s" />],
                  ["Hints", "Stuck? The Hint button asks the engine for a suggestion in CPU and pass-and-play games.", <HintSketch key="s" />],
                ] as const
              ).map(([k, v, sketch]) => (
                <div key={k} className="card @container">
                  <div className="grid gap-x-4 gap-y-3 @min-[22rem]:grid-cols-[1fr_auto]">
                    <div>
                      <dt className="font-display text-lg font-semibold">{k}</dt>
                      <dd className="mt-1 text-sm text-ink-soft">{v}</dd>
                    </div>
                    <dd className="flex justify-center self-center">{sketch}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </Chapter>

          <Chapter id="variants" n={5} title="Variants">
            <p className="text-ink-soft">
              The start screen&apos;s <b>Advanced rules</b> drawer lets you change the game. The CPU opponents adapt to all of these; rated games always use the official rules.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["Hive Lite", "Fewer pieces (one of each bug, two Ants). Shorter and great for learning.", <LiteVignette key="v" />],
                  ["Swarm", "A Queen falls when 5 of her 6 sides are covered. Fast and aggressive.", <SwarmVignette key="v" />],
                  ["Sundown", "A turn limit: when it's reached, the less-surrounded Queen wins.", <SundownVignette key="v" />],
                  ["Early Queen", "Queens must be placed by turn 3 instead of 4.", <EarlyQueenVignette key="v" />],
                  ["Repetition draw", "A position occurring for the third time ends the game in a draw.", <RepetitionVignette key="v" />],
                  ["Custom counts", "Set how many of each bug both players get.", <CountsVignette key="v" />],
                ] as const
              ).map(([k, v, vignette]) => (
                <div key={k} className="card">
                  <div className="mb-2 flex h-14 items-center">{vignette}</div>
                  <div className="font-semibold">{k}</div>
                  <p className="mt-1 text-sm text-ink-soft">{v}</p>
                </div>
              ))}
            </div>
          </Chapter>

          <Chapter id="notation" n={6} title="Notation">
            <div className="grid items-center gap-x-8 gap-y-4 md:grid-cols-[1fr_auto]">
              <p className="text-sm text-ink-soft">
                Moves use the Universal Hive Protocol notation shared by most Hive software. Pieces are named by colour, bug and number: <code className="font-mono">wQ</code>,{" "}
                <code className="font-mono">bA2</code>. A move names the piece and its destination next to a piece already in the hive: <code className="font-mono">bS1 wQ-</code> is
                &quot;Black Spider 1 to the right of the White Queen&quot;. The marks <code className="font-mono">-</code>, <code className="font-mono">/</code> and{" "}
                <code className="font-mono">\</code> before or after the reference give the six directions; <code className="font-mono">wB1 bQ</code> means the Beetle climbs
                onto the Black Queen. Copy any game&apos;s notation from the game screen, and paste one into the start screen to load it.
              </p>
              <NotationCompass className="mx-auto" />
            </div>
          </Chapter>

          <div className="card flex flex-col items-center gap-3 p-8 text-center">
            <div className="font-display text-3xl font-semibold">Ready for the wild?</div>
            <p className="text-ink-soft">Test yourself on puzzles, or start with Pip the Pillbug, the gentlest opponent in the garden.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/puzzles" className="btn">
                Puzzles
              </Link>
              <Link href="/" className="btn-secondary">
                Play a game
              </Link>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
