// Search statistics for HARD on the host: plays HARD vs NORMAL and prints how
// far each search got. cc -O2 -DPROF -o /tmp/st test/stats.c src/rules.c src/ai.c
#include <stdio.h>
#include "../src/ai.h"
extern unsigned long prof_look, prof_hit, prof_eval;
extern uint16_t prof_n, prof_w1, prof_w2, prof_d, prof_i, last_work;
int main(void) {
    Move m;
    int g, calls = 0, d3done = 0, d2done = 0, hist[8] = {0};
    long w1 = 0, w2 = 0, n = 0, frac = 0;
    rules_init();
    for (g = 0; g < 40; g++) {
        rules_new_game();
        rng_state = g * 77 + 1;
        while (state == PLAYING && ply < 160) {
            if ((ply & 1) == (g & 1)) {
                ai_choose(AI_HARD, &m);
                calls++;
                n += prof_n;
                w1 += prof_w1;
                w2 += prof_w2;
                if (prof_d >= 2) d2done++;
                if (prof_d >= 3) d3done++;
                else if (prof_d == 2) frac += prof_i * 100 / (prof_n ? prof_n : 1);
                hist[prof_d]++;
            } else {
                ai_choose(AI_NORMAL, &m);
            }
            play(&m);
        }
    }
    printf("%d calls: avg root moves %.1f, work after d1 %.0f, after d2 %.0f; d2 complete %d%%, d3 complete %d%%, partial d3 covers %.0f%% of root\n",
           calls, (double)n / calls, (double)w1 / calls, (double)w2 / calls, d2done * 100 / calls, d3done * 100 / calls,
           (double)frac / (calls - d3done + 1));
    printf("cache lookups %lu hits %lu; evals %lu\n", prof_look, prof_hit, prof_eval);
    return 0;
}
