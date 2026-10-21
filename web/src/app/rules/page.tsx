import Link from "next/link";
import { BugDemo } from "@/components/BugDemo";
import { BugGlyph, hexPoints } from "@/components/BugGlyph";
import { Diagram } from "@/components/Diagram";
import type { BugLetter } from "@/lib/engine-types";
import { TILE } from "@/lib/themes";

export const metadata = { title: "How to play Hive" };

function Icon({ bug }: { bug: BugLetter }) {
  return (
    <svg viewBox="-50 -50 100 100" className="h-12 w-12 shrink-0">
      <polygon points={hexPoints(0, 0, 46)} fill={TILE.w.fill} stroke={TILE.w.edge} strokeWidth={3} />
      <g transform="translate(-28 -28) scale(0.56)">
        <BugGlyph bug={bug} ink={TILE.w.ink} />
      </g>
    </svg>
  );
}

const BUGS: { bug: BugLetter; name: string; count: string; expansion?: boolean; text: React.ReactNode; game: string; focus: string }[] = [
  {
    bug: "Q",
    name: "Queen Bee",
    count: "1 per player",
    text: (
      <>
        Moves exactly <b>one space</b> around the hive. She must be placed by each player&apos;s fourth turn, and no piece may move until your Queen is down.
        If she is surrounded on all six sides (by pieces of either colour), you lose.
      </>
    ),
    game: "Base+MLP;InProgress;Black[4];wS1;bA1 -wS1;wM wS1\\;bG1 -bA1;wA1 wM\\;bQ bG1\\;wQ wA1\\",
    focus: "bQ",
  },
  {
    bug: "B",
    name: "Beetle",
    count: "2 per player",
    text: (
      <>
        Moves one space, but can also <b>climb on top of the hive</b> and move along the top. A piece with a beetle on it can&apos;t move, and the stack takes the
        colour of the beetle for placing new pieces. Beetles can stack on beetles.
      </>
    ),
    game: "Base+MLP;InProgress;Black[4];wL;bL \\wL;wM wL\\;bQ bL/;wA1 -wM;bB1 -bQ;wQ -wA1",
    focus: "bB1",
  },
  {
    bug: "G",
    name: "Grasshopper",
    count: "3 per player",
    text: (
      <>
        <b>Jumps in a straight line</b> over one or more pieces, landing on the first empty space. It must jump at least one piece and can jump into gaps that
        sliding pieces can&apos;t reach.
      </>
    ),
    game: "Base+MLP;InProgress;White[5];wS1;bS1 -wS1;wP wS1-;bP -bS1;wG1 wP/;bA1 -bP;wQ wP-;bQ \\bS1",
    focus: "wG1",
  },
  {
    bug: "S",
    name: "Spider",
    count: "2 per player",
    text: (
      <>
        Slides <b>exactly three spaces</b> around the hive, never backtracking, staying in contact with the hive the whole way.
      </>
    ),
    game: "Base+MLP;InProgress;White[5];wL;bA1 wL\\;wA1 -wL;bA2 /bA1;wS1 -wA1;bB1 bA2-;wQ \\wA1;bQ bB1-",
    focus: "wS1",
  },
  {
    bug: "A",
    name: "Soldier Ant",
    count: "3 per player",
    text: (
      <>
        Slides <b>any number of spaces</b> around the outside of the hive, the most mobile piece in the game. It can&apos;t squeeze through gaps or enter fully
        enclosed spaces.
      </>
    ),
    game: "Base+MLP;InProgress;Black[4];wB1;bQ /wB1;wG1 wB1-;bB1 bQ\\;wL \\wG1;bA1 -bQ;wQ \\wL",
    focus: "bA1",
  },
  {
    bug: "M",
    name: "Mosquito",
    count: "1 per player (expansion)",
    expansion: true,
    text: (
      <>
        Has no movement of its own: it <b>copies the movement of any piece it touches</b>, friend or foe. Next to a beetle it can climb; once on top of the hive it
        moves like a beetle until it comes down. Touching only another mosquito, it can&apos;t move. Next to a pillbug it can use the pillbug&apos;s special
        ability.
      </>
    ),
    game: "Base+MLP;InProgress;White[5];wL;bP \\wL;wG1 wL\\;bQ \\bP;wM -wG1;bB1 \\bQ;wQ wG1\\;bG1 \\bB1",
    focus: "wM",
  },
  {
    bug: "L",
    name: "Ladybug",
    count: "1 per player (expansion)",
    expansion: true,
    text: (
      <>
        Moves <b>three spaces: two on top of the hive, then one down</b> into an empty space. It must take all three steps and can drop into enclosed spaces.
      </>
    ),
    game: "Base+MLP;InProgress;Black[4];wS1;bA1 /wS1;wQ wS1-;bL bA1\\;wG1 \\wS1;bQ -bA1;wP wQ-",
    focus: "bL",
  },
  {
    bug: "P",
    name: "Pillbug",
    count: "1 per player (expansion)",
    expansion: true,
    text: (
      <>
        Moves one space like the Queen. Instead of moving, it can use its special ability: <b>lift an adjacent piece</b> (of either colour) over itself and
        drop it onto an empty space next to it. It can&apos;t lift a piece in a stack, a piece that would split the hive, or the piece your opponent just moved,
        and it can&apos;t lift through a gap blocked by stacks. The lifted piece can&apos;t move on the next turn. In this demo White&apos;s pillbug can throw
        Black&apos;s ant.
      </>
    ),
    game: "Base+P;InProgress;White[5];wP;bA1 wP\\;wS1 wP/;bQ /bA1;wG1 \\wS1;bQ -bA1;wQ -wG1;bB1 /bQ",
    focus: "bA1",
  },
];

export default function RulesPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10 px-4 py-8 leading-relaxed">
      <header>
        <h1 className="text-3xl font-bold">How to play Hive</h1>
        <p className="mt-2 text-[var(--muted)]">
          Hive is a two-player game by John Yianni. There is no board: the pieces themselves form the playing area. These rules follow the official rulebook and
          the clarifications used in tournament play.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Goal</h2>
        <p>
          <b>Completely surround your opponent&apos;s Queen Bee.</b> All six spaces around it must be filled, by pieces of either colour. If both Queens are
          surrounded by the same move, the game is a draw. Players can also agree to a draw.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Pieces</h2>
        <p>
          Each player has 11 pieces: 1 Queen Bee, 2 Spiders, 2 Beetles, 3 Grasshoppers and 3 Soldier Ants. Each of the three expansions (Mosquito, Ladybug,
          Pillbug) adds one more piece per player and can be switched on or off independently when you start a game.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Placing pieces</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>On your turn you either place a new piece or move one already on the board. White goes first.</li>
          <li>The very first piece of each player just has to touch the hive. After that, a newly placed piece may touch only your own pieces, never an opponent&apos;s.</li>
          <li>Once placed, a piece can&apos;t be removed from the game.</li>
          <li>
            Your <b>Queen Bee must be placed by your fourth turn</b>.
          </li>
          <li>
            <b>Tournament opening</b> (on by default here): neither player may place their Queen on their first turn.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Moving pieces</h2>
        <p>You can only move pieces after your own Queen Bee is on the board. Two rules apply to every move:</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="font-semibold">One Hive</h3>
            <p className="mb-2 text-sm">
              The pieces must always be connected, including <i>while</i> a piece is moving. A piece whose removal would split the hive is pinned. Here the ant
              holds the two halves together, so it can&apos;t move.
            </p>
            <Diagram
              height={150}
              pieces={[
                { q: -1, r: 0, bug: "Q", color: "b" },
                { q: 0, r: 0, bug: "A", color: "w" },
                { q: 1, r: 0, bug: "Q", color: "w" },
                { q: 2, r: -1, bug: "G", color: "w" },
              ]}
              marks={[{ q: 0, r: 0, kind: "no" }]}
            />
          </div>
          <div>
            <h3 className="font-semibold">Freedom to Move</h3>
            <p className="mb-2 text-sm">
              Pieces slide; they can&apos;t squeeze through a gap between two pieces. The ant can&apos;t enter the enclosed space even though it&apos;s empty
              (a Grasshopper, Ladybug or Beetle could).
            </p>
            <Diagram
              height={150}
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
        <p className="text-sm">
          A piece that was just moved, whether by its owner or by a Pillbug, can&apos;t be moved by the Pillbug on the very next turn. If you have no legal move
          you must pass.
        </p>
      </section>

      <section className="space-y-8">
        <h2 className="text-xl font-semibold">The bugs</h2>
        <p className="text-sm text-[var(--muted)]">Each board below is a real position. The highlighted piece&apos;s legal moves are marked; click one to try it.</p>
        {BUGS.map((b) => (
          <div key={b.bug} className="space-y-3">
            <div className="flex items-start gap-3">
              <Icon bug={b.bug} />
              <div>
                <h3 className="text-lg font-semibold">
                  {b.name} <span className="text-sm font-normal text-[var(--muted)]">· {b.count}</span>
                </h3>
                <p className="text-sm">{b.text}</p>
              </div>
            </div>
            <BugDemo gameString={b.game} focus={b.focus} />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Notation</h2>
        <p className="text-sm">
          Moves are written in the Universal Hive Protocol format used by most Hive software. A piece is named by colour, bug and number, e.g. <code>wQ</code>,{" "}
          <code>bA2</code>. A move names the piece and where it goes relative to a piece already on the board: <code>bS1 wQ-</code> means &quot;black spider 1
          to the right of the white queen&quot;. The marks <code>-</code>, <code>/</code> and <code>\</code> before or after the reference piece give the six
          directions, and <code>wB1 bQ</code> means the beetle climbs on top of the black queen. You can copy any game&apos;s notation and paste it back in from the
          home page.
        </p>
      </section>

      <div className="text-center">
        <Link href="/" className="btn">
          Start a game
        </Link>
      </div>
    </article>
  );
}
