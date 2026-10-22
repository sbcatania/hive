// Checks gen_moves_to / gen_moves_near against filtering gen_moves, on
// random games (part of make test).
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../src/rules.h"

static Move all[MAX_MOVES], sub[MAX_MOVES];

static int key(const Move *m) { return m->piece << 16 | m->from << 8 | m->to; }
static int cmp(const void *a, const void *b) { return key(a) - key(b); }

int main(void) {
    unsigned s = 99;
    long checked = 0, bad = 0;
    int g, k, i, t, n, nf, nsub;
    rules_init();
    for (g = 0; g < 3000; g++) {
        rules_new_game();
        for (k = 0; k < 200 && state == PLAYING; k++) {
            n = gen_moves(all);
            for (t = 0; t < 4; t++) {
                uint8_t cell;
                if (t < 2) {
                    if (IN_HAND(QUEEN_OF(t))) continue;
                    cell = pos[QUEEN_OF(t)];
                } else {
                    s = s * 1103515245 + 12345;
                    cell = pos[(s >> 8) % NPIECES];
                }
                for (int mode = 0; mode < 2; mode++) {
                    nsub = mode ? gen_moves_near(sub, cell) : gen_moves_to(sub, cell);
                    Move want[MAX_MOVES];
                    nf = 0;
                    for (i = 0; i < n; i++)
                        if (all[i].piece != NONE && (mode ? HEXDIST(all[i].to, cell) <= 1 : all[i].to == cell)) want[nf++] = all[i];
                    qsort(want, nf, sizeof(Move), cmp);
                    qsort(sub, nsub, sizeof(Move), cmp);
                    checked++;
                    if (nf != nsub || memcmp(want, sub, nf * sizeof(Move))) {
                        if (bad++ < 5) printf("mismatch g%d k%d mode %d: want %d got %d\n", g, k, mode, nf, nsub);
                    }
                }
            }
            s = s * 1103515245 + 12345;
            play(&all[(s >> 8) % n]);
        }
    }
    printf("filtered generation: %ld checked, %ld failures\n", checked, bad);
    return bad != 0;
}
