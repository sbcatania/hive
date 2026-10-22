// Micro-benchmark ROM for the AI building blocks on Game Boy Color timing.
// Built and run by tools/bench.py (not part of the game).
#include <gb/gb.h>
#include <gb/cgb.h>
#include "rules.c"
#include "ai.c"

uint16_t bres[8];
uint8_t bdone;
uint16_t btrace[48];
Move bmoves[MAX_MOVES];
#define mv bmoves

#define ITER 50
#define TIME(slot, body) { uint16_t t0 = sys_time, it; for (it = 0; it < ITER; it++) { body; } bres[slot] = sys_time - t0; }

void main(void) {
    uint16_t n, i;
    uint8_t plies = BENCH_PLIES;
    if (_cpu == CGB_TYPE) cpu_fast();
    DISPLAY_ON;
    rules_init();
    rules_new_game();
    rng_state = 0x1234;
    for (i = 0; i < plies; i++) {
        // Pick a move independently of generation order.
        uint16_t j, bj = 0, k, bk = 0xFFFF, salt = rnd8();
        n = gen_moves(mv);
        btrace[i] = n;
        for (j = 0; j < n; j++) {
            k = (uint16_t)(mv[j].piece * 97u + mv[j].from * 31u + mv[j].to * 57u + salt) * 40503u;
            if (k < bk) bk = k, bj = j;
        }
        play(&mv[bj]);
        if (state != PLAYING) { undo(&mv[0]); break; }
    }
    n = gen_moves(mv);
    bres[4] = n;
    TIME(0, gen_moves(mv));
    TIME(1, (pinned_valid = 0, compute_pinned()));
    TIME(2, BENCH_EVAL);
    TIME(3, (play(&mv[0]), undo(&mv[0])));
    {
        uint16_t t0 = sys_time;
        Move m;
        ai_choose(AI_HARD, &m);
        bres[5] = sys_time - t0;
    }
    bdone = 1;
    while (1) vsync();
}
