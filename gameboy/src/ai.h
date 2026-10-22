#ifndef HIVE_AI_H
#define HIVE_AI_H

#include "rules.h"

#define AI_EASY 0
#define AI_NORMAL 1
#define AI_HARD 2

extern uint16_t rng_state;
uint8_t rnd8(void);

// Picks a move for the side to move. EASY is a noisy one-move lookahead;
// NORMAL also checks the opponent's best reply to its top 3 candidates.
// HARD runs an iterative-deepening alpha-beta search (2-3 plies) under a
// fixed work budget.
void ai_choose(uint8_t level, Move *best);

// Optional: called by HARD every so often while it searches (a few dozen
// times per move), with done <= total == 64, e.g. to draw a progress bar.
// NULL (the default) means no callback. Keep it quick; it runs mid-search.
extern void (*ai_progress)(uint8_t done, uint8_t total);

#endif
