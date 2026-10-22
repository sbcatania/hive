// Hive rules for the base game (Queen, Spider, Beetle, Grasshopper, Ant),
// tournament opening, Queen by turn 4. Portable C: builds with GBDK (SDCC)
// for the Game Boy Color and with clang on the host for tests.
//
// The board is a 16x16 torus of axial hex coordinates packed into one byte
// (q in the low nibble, r in the high nibble), so cells and pieces are 8-bit
// values and every lookup is a single table index on the Game Boy's CPU.
#ifndef HIVE_RULES_H
#define HIVE_RULES_H

#include <stdint.h>

#define NPIECES 22
#define PER_COLOR 11
#define NONE 0xFF
#define ORIGIN 0x88

#define WHITE 0
#define BLACK 1

enum { QUEEN, SPIDER, BEETLE, HOPPER, ANT, NBUGS };

// Game state.
#define PLAYING 0
#define WHITE_WINS 1
#define BLACK_WINS 2
#define DRAW 3

// A move. `piece` has MV_PLACE set for placements (then `from` is unused);
// a pass has piece == NONE.
#define MV_PLACE 0x80
typedef struct {
    uint8_t piece, from, to;
} Move;

#define MAX_MOVES 320
// gen_moves() writes at most this many moves (default MAX_MOVES); a search
// can lower it to use smaller buffers.
extern uint16_t gen_cap;

extern const uint8_t NB[6][256];       // neighbour of a cell in each direction
extern uint8_t top[256];         // top piece on a cell, or NONE
extern uint8_t height[256];      // stack height on a cell
extern uint8_t nbm[256];         // bit d set when NB[d][c] is occupied
extern uint8_t pos[NPIECES];     // cell of a piece on the board
extern uint8_t level[NPIECES];   // 0 = ground; NONE = in hand
extern uint8_t under[NPIECES];   // piece directly below, or NONE
extern uint16_t ply;
extern uint8_t nplaced;          // pieces on the board
extern uint8_t state;

extern const uint8_t BUG_OF[PER_COLOR];
extern const uint8_t BUG_FIRST[NBUGS];
extern const uint8_t BUG_COUNT[NBUGS];
extern const uint8_t SLIDE[64];   // nbm -> directions a ground piece can slide
extern const uint8_t POP6[64];    // bits set in a 6-bit mask
extern const uint8_t HEXD[256];
// Hex distance between two cells.
#define HEXDIST(a, b) HEXD[(uint8_t)((((a) & 0xF0) - ((b) & 0xF0)) & 0xF0) | (((a) - (b)) & 15)]

#define COLOR_OF(p) ((p) >= PER_COLOR)
#define BUGOF(p) (BUG_OF[(p) >= PER_COLOR ? (p) - PER_COLOR : (p)])
#define QUEEN_OF(c) ((c) ? PER_COLOR : 0)
#define TO_MOVE() ((uint8_t)(ply & 1))
#define IN_HAND(p) (level[p] == NONE)

void rules_init(void);              // once at startup
void rules_new_game(void);
uint16_t gen_moves(Move *out);      // all legal moves (a single pass if none)
// Only the legal moves that end on `cell` (no pass); at most one per piece.
uint8_t gen_moves_to(Move *out, uint8_t cell);
// Only the legal moves that end on or next to `cell` (no pass).
uint8_t gen_moves_near(Move *out, uint8_t cell);
void play(const Move *m);
void undo(const Move *m);
uint8_t hand_count(uint8_t color, uint8_t bug);
uint8_t next_in_hand(uint8_t color, uint8_t bug);
uint8_t queen_neighbors(uint8_t color);

// Articulation points of the ground-level hive ("pinned" cells), valid until
// the board changes. Returns how many pieces of `color` are pinned or covered.
void compute_pinned(void);
uint8_t is_pinned_cell(uint8_t cell);
extern uint8_t pinned[256];  // same as is_pinned_cell(), for ground cells only

#endif
