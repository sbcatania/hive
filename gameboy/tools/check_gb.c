// Checks that the Game Boy build computes exactly what the host build does:
// plays the same pseudo-random games on both and checksums every move list
// (and, with CHECK_AI, the AI's choices). tools/check.py builds and compares.
#include <stdio.h>
#include "ai.h"
#ifndef HOST
#include <gb/gb.h>
#include <gb/cgb.h>
#endif

#ifndef GAMES
#define GAMES 12
#endif
#ifndef PLIES
#define PLIES 70
#endif

uint16_t csum[4];
uint16_t cstat[112][2];  // per AI call: GB frames, work units
uint8_t ncalls;
uint16_t cstack;  // deepest stack use seen below main (bytes)
extern uint16_t last_work;
uint8_t cdone;
Move cmoves[MAX_MOVES];

static uint16_t mhash(const Move *m) {
    return (uint16_t)((uint16_t)(m->piece * 97u + m->from * 31u + m->to * 57u + 7) * 40503u);
}

void main(void) {
    uint16_t n, i, j, bj, k, bk, h;
    uint8_t g, salt;
    Move m;
#ifndef HOST
    uint8_t *sp0, *q;
    if (_cpu == CGB_TYPE) cpu_fast();
    DISPLAY_ON;
    // Paint 768 bytes below the stack pointer to measure stack use later.
    sp0 = (uint8_t *)&n;
    for (q = sp0 - 768; q < sp0 - 16; q++) *q = 0xA5;
#endif
    rules_init();
    rng_state = 0x4321;
    for (g = 0; g < GAMES; g++) {
        rules_new_game();
        for (i = 0; i < PLIES && state == PLAYING; i++) {
            n = gen_moves(cmoves);
            h = n;
            salt = rnd8();
            bj = 0;
            bk = 0xFFFF;
            for (j = 0; j < n; j++) {
                h += mhash(&cmoves[j]);
                k = (uint16_t)(mhash(&cmoves[j]) + salt * 251u);
                if (k < bk) bk = k, bj = j;
            }
            csum[0] = (uint16_t)(csum[0] * 31u + h);
            csum[1] += n;
            m = cmoves[bj];
#ifdef CHECK_AI
            if ((i & 7) == 7) {
#ifndef HOST
                uint16_t t0 = sys_time;
#endif
                ai_choose(CHECK_AI, &m);
#if defined(HOST) && defined(PROF)
                {
                    extern unsigned long prof_eval, prof_gen, prof_genmoves, prof_win, prof_near, prof_epieces, prof_gpieces;
                    printf("call %u: %lu %lu %lu %lu %lu %lu %lu %u\n", ncalls++, prof_eval, prof_epieces, prof_gen,
                           prof_genmoves, prof_gpieces, prof_near, prof_win, last_work);
                    prof_eval = prof_gen = prof_genmoves = prof_win = prof_near = prof_epieces = prof_gpieces = 0;
                }
#endif
#ifndef HOST
                if (ncalls < 112) {
                    cstat[ncalls][0] = sys_time - t0;
                    cstat[ncalls][1] = last_work;
                    ncalls++;
                }
#endif
                csum[2] = (uint16_t)(csum[2] * 31u + mhash(&m));
            }
#endif
            play(&m);
        }
        csum[3] += i;
    }
#ifdef HOST
    printf("%u %u %u %u\n", csum[0], csum[1], csum[2], csum[3]);
#else
    for (q = sp0 - 768; q < sp0 && *q == 0xA5; q++)
        ;
    cstack = (uint16_t)(sp0 - q);
    cdone = 1;
    while (1) vsync();
#endif
}
