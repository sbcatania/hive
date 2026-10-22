// Host-side arena: two AI builds play each other from paired random openings
// (each opening is played twice with colours swapped). Build with
// test/arena.sh, which compiles two copies of an AI source with their
// symbols prefixed A_ and B_.
//   arena <levelA> <levelB> <games> [seed] [ply_cap] [random_plies]
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include "../src/rules.h"

void A_ai_choose(uint8_t level, Move *best);
void B_ai_choose(uint8_t level, Move *best);
extern uint16_t A_rng_state, B_rng_state;
extern uint16_t A_work_total, B_work_total;  // optional instrumentation
extern uint16_t A_last_work, B_last_work;

static Move buf[MAX_MOVES];
static uint32_t rs;
static uint32_t rnd(void) {
    rs ^= rs << 13;
    rs ^= rs >> 17;
    rs ^= rs << 5;
    return rs;
}

static void show(void) {
    // Rows r with q across, offset by r/2 to look hex-ish. White upper, black lower.
    static const char L[] = "QSBGA";
    int r, q, c, p;
    for (r = 0; r < 16; r++) {
        int any = 0;
        for (q = 0; q < 16; q++) if (height[(r << 4) | q]) any = 1;
        if (!any) continue;
        printf("%*s", r, "");
        for (q = 0; q < 16; q++) {
            c = (r << 4) | q;
            p = top[c];
            if (p == NONE) printf(" .");
            else printf(" %c", COLOR_OF(p) ? L[BUGOF(p)] + 32 : L[BUGOF(p)]);
            if (height[c] > 1) printf("\b%d", height[c]);
        }
        printf("\n");
    }
}

int main(int argc, char **argv) {
    int la = atoi(argv[1]), lb = atoi(argv[2]), games = atoi(argv[3]);
    uint32_t seed = argc > 4 ? (uint32_t)atoi(argv[4]) : 1;
    int cap = argc > 5 ? atoi(argv[5]) : 200, nrand = argc > 6 ? atoi(argv[6]) : 3;
    int w = 0, d = 0, l = 0, capped = 0, g, k;
    long plies_total = 0;
    unsigned long work_sum = 0, work_n = 0, work_max = 0;
    Move open_moves[16], m;
    rules_init();
    for (g = 0; g < games; g++) {
        int a_white = !(g & 1);
        if (!(g & 1)) {
            // New opening shared by this pair of games.
            rs = seed * 2654435761u + (uint32_t)g * 40503u + 1;
            rules_new_game();
            for (k = 0; k < nrand; k++) {
                uint16_t n = gen_moves(buf);
                open_moves[k] = buf[rnd() % n];
                play(&open_moves[k]);
            }
        }
        rules_new_game();
        for (k = 0; k < nrand; k++) play(&open_moves[k]);
        A_rng_state = (uint16_t)(rs + g * 7);
        B_rng_state = (uint16_t)(rs + g * 13);
        while (state == PLAYING && ply < cap) {
            int a_turn = (TO_MOVE() == WHITE) == a_white;
            if (a_turn) {
                A_ai_choose(la, &m);
                if (la == 2) {
                    work_sum += A_last_work;
                    work_n++;
                    if (A_last_work > work_max) work_max = A_last_work;
                }
            } else {
                B_ai_choose(lb, &m);
            }
            play(&m);
            if (getenv("VERBOSE") && ply % 20 == 0)
                printf("  g%d ply %d: qn W %d B %d  last %s piece %d\n", g, ply, queen_neighbors(WHITE), queen_neighbors(BLACK),
                       a_turn ? "A" : "B", m.piece);
        }
        if (getenv("SHOW") && state == PLAYING) {
            printf("game %d capped, A is %s\n", g, a_white ? "white" : "black");
            show();
        }
        plies_total += ply;
        if (state == PLAYING) {
            capped++;
            d++;
        } else if (state == DRAW) {
            d++;
        } else if ((state == WHITE_WINS) == a_white) {
            w++;
        } else {
            l++;
        }
    }
    printf("A(lvl %d) vs B(lvl %d): %d games  A wins %d  draws %d (capped %d)  A losses %d  avg plies %.1f",
           la, lb, games, w, d, capped, l, (double)plies_total / games);
    if (work_n) printf("  A work avg %.0f max %lu", (double)work_sum / work_n, work_max);
    printf("\n");
    return 0;
}
