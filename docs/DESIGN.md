# Design exploration: giving the site a point of view

The first version worked but looked like a generic web app wearing a hexagon. The goal
of this pass: make the whole experience (start screen, game, rules, history) feel like it
belongs to Hive, without hurting how readable the board is, in light mode and in dark mode.

## What "good" means here (the critique rubric)

1. **Board legibility comes first.** You need to read bugs, colours, stacks and legal moves at a glance, on a phone, in both themes.
2. **Light and dark are both first-class**: designed together, not inverted.
3. **Distinctive**: recognisable in a screenshot, rooted in the game (bakelite tiles, bugs, nature).
4. **Scales to every screen**: start screen, game, field guide, history, profile, leaderboard.
5. **Performance on phones**: no heavy effects on the board itself.
6. **Accessible**: contrast, colour-blind-safe move markers, reduced motion respected.

## Round 0: ten directions

| # | Direction | One-line pitch |
|---|---|---|
| 1 | **Honeycomb Atelier** | Amber and wax everywhere; every menu item is a honeycomb cell. |
| 2 | **Garden Floor** | The board sits on soil and moss; leaves frame the UI. |
| 3 | **Bakelite Table** | Skeuomorphic tabletop: the real tiles on wood or felt, menus as physical tiles you pick up. |
| 4 | **Naturalist's Field Guide** | A vintage entomology journal: serif type, ink drawings, specimen labels, rules as field-guide entries. |
| 5 | **Neon Hive** | Synthwave arcade: glowing hex outlines, neon bugs. |
| 6 | **Swiss Minimal** | Monochrome typography, one accent colour, no decoration. |
| 7 | **Bug's-eye Macro** | Cinematic 3D first: shallow depth of field, the camera at bug height. |
| 8 | **Apiary Control Room** | A beekeeper's dashboard: ratings, stats and analytics up front. |
| 9 | **Paper Cut** | Layered paper hexagons with soft shadows, playful and crafty. |
| 10 | **Night Garden** | Dark first: indigo dusk, drifting fireflies, bioluminescent move highlights; daytime meadow in light mode. |

## Round 1: cut to four

- **Neon Hive (5)**: cut. Glow destroys legibility, and it fights the game's natural, tactile identity.
- **Swiss Minimal (6)**: cut. Legible, but it's what we already had: no point of view.
- **Apiary Control Room (8)**: cut. Wrong mood. Hive is a cosy tabletop game, not a terminal. (Keep the idea that stats belong on the profile page.)
- **Bug's-eye Macro (7)**: cut as a *site* direction: too heavy for phones, and the camera hides the board. Its ambition survives in the 3D board style.
- **Paper Cut (9)**: cut. Charming, but layered shadows on every element get noisy around a dense board, and dark mode turns muddy.
- **Garden Floor (2)**: cut. A textured background directly behind the board hurts legibility (rubric 1). Its palette survives.
- Kept: **Honeycomb (1), Bakelite Table (3), Field Guide (4), Night Garden (10)**.

## Round 2: stress-testing the four

**Honeycomb Atelier.** *For:* instantly "bee". *Against:* the Queen Bee is one of eight bugs, and an all-amber site says "honey brand", not "Hive". Hex-shaped buttons have awkward hit areas and wrap text badly. In dark mode, amber on brown loses contrast. **Verdict: use the hexagon as a motif, not a layout system.**

**Bakelite Table.** *For:* the physical tiles are the most iconic thing about the game, and players love them. *Against:* making menus into physical tiles is a gimmick that slows every interaction, and a full wood texture behind UI text is hard to read. **Verdict: tactility belongs on the pieces and the 3D table, not the chrome.**

**Naturalist's Field Guide.** *For:* very distinctive, and it gives the content screens a structure: rules become field-guide entries, each bug gets a specimen card, game history becomes a journal of matches, puzzles become field exercises. A serif display face plus specimen labels carries the theme through typography rather than heavy imagery, which keeps it light and readable. *Against:* parchment in dark mode is the classic failure, beige-on-brown sludge.

**Night Garden.** *For:* the best dark mode of the lot, with a natural reason for coloured, glowing highlights (fireflies equal possible moves). *Against:* the light-mode counterpart is vague, and drifting particles everywhere get tiring.

## Round 3: synthesis and its critique

**Proposal: "Field Guide by day, Night Garden by night."**

- The *information design* is the Field Guide: serif display headings, specimen-card layouts, small-caps labels, journal entries.
- The *themes* are a pair. Light is warm paper and ink, like a meadow at noon. Dark is deep indigo-green with firefly-gold accents, like the garden at night.
- The *pieces* get Bakelite tactility: rounded, bevelled, glossy tiles in 2D and properly modelled tiles in 3D.
- The *hexagon* appears in structural spots: logo, piece tiles, the start-screen hive, small corner cuts on cards, the loading animation.

**Critique of the synthesis:**

1. *Risk of three themes glued together.* Fix: one rule for each layer. Chrome is Field Guide, colour is Day/Night, pieces are Bakelite. Nothing else gets decorated.
2. *Is the board still sacred?* The board surface is plain and slightly darker than the page, with a faint hex dot grid. No textures under pieces except in the explicitly decorative "Field guide" board style.
3. *Colour meaning must be consistent.* The bugs already own eight colours, so UI accents can't collide with them. Final mapping:
   - **Selected:** ink blue.
   - **Your legal moves:** leaf green.
   - **Opponent's potential moves (preview):** coral, drawn dashed so it doesn't rely on colour alone.
   - **Last move:** honey outline.
   - **Hints:** violet.
   Each also differs in shape or line style, so it's colour-blind safe.
4. *The start screen shouldn't be a form.* The first version opened on a settings form. The new start screen is a **title moment** (animated hive of tiles assembling around the wordmark) followed by **three specimen cards** (Computer / Same device / Online) and a "Field guide" entry point. Settings appear progressively *after* choosing a mode, with advanced rules folded away.
5. *CPU levels need personality.* Plain "Easy/Medium/Hard/Expert" is fine but forgettable. Each level becomes a named bug opponent with a one-line temperament: Pip the Pillbug (Easy), Greta the Grasshopper (Medium), Sable the Spider (Hard), Queen Regina (Expert). The difficulty is still printed plainly underneath, so nobody has to guess.
6. *Motion budget.* Allowed: the title-screen tile assembly, pieces sliding (2D) or hopping (3D), a gentle firefly pulse on legal-move markers in dark mode. Everything else stays still, and `prefers-reduced-motion` turns it all off.
7. *Typography.* Display: **Fraunces** (soft, slightly whimsical serif). UI: **Inter**. Notation: **JetBrains Mono**. All are self-hosted via Fontsource, so there are no runtime font requests.

## Final decisions

| Area | Decision |
|---|---|
| Themes | Light "Day" (paper `#f6f1e4`, ink `#2a241b`) and dark "Night" (`#121a17` garden, firefly gold `#f2c14e`); system default plus a manual toggle |
| Start screen | Animated tile-hive title; three mode "specimen cards"; progressive setup sheet; advanced rules folded away |
| Board styles | **Bakelite** (default, glossy bevelled tiles), **Field guide** (ink-and-watercolour on paper), **Clean** (flat, maximum contrast), **3D table** (modelled rounded tiles, wood table, contact shadows, hop animation) |
| Move feedback | Click *any* piece: yours shows legal moves (green); the opponent's shows where it could go next turn (coral, dashed); a piece that can't move tells you *why* (pinned by One Hive, covered by a beetle, too tight to slide, just moved...) |
| Rules | "Field guide" chapters with live boards, then puzzles (win in 1, win in 2) checked by the engine |
| Accounts | Optional; anonymous play keeps a local journal. Signed-in players get a cloud journal, an Elo rating (rated online games only), a profile and the leaderboard |
| Variants | Standard expansions plus an advanced drawer: piece counts ("Hive Lite"), Queen deadline, surround-to-win threshold, turn limit with adjudication, automatic threefold-repetition draw, and chess clocks for local games |
