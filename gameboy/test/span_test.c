// Checks the span limit of gen_moves() (built without NO_SPAN_LIMIT): over
// random games the hive never occupies more than 12 rows or 12 columns of
// the 16x16 torus.
#include <stdio.h>
#include "../src/rules.h"

static Move b[MAX_MOVES];

static int runs(int shift) {
    int seen[16] = {0}, n = 0, p, x;
    for (p = 0; p < NPIECES; p++) {
        if (IN_HAND(p)) continue;
        x = (pos[p] >> shift) & 15;
        if (!seen[x]) seen[x] = 1, n++;
    }
    return n;
}

int main(void) {
    unsigned s = 777;
    long positions = 0, fails = 0;
    int g, k, q, r, maxrun = 0;
    rules_init();
    for (g = 0; g < 3000; g++) {
        rules_new_game();
        for (k = 0; k < 300 && state == PLAYING; k++) {
            uint16_t n = gen_moves(b);
            positions++;
            s = s * 1103515245 + 12345;
            play(&b[(s >> 8) % n]);
            q = runs(0);
            r = runs(4);
            if (q > maxrun) maxrun = q;
            if (r > maxrun) maxrun = r;
            if (q > 12 || r > 12) fails++;
        }
    }
    printf("span: %ld random positions, widest hive %d cells, %ld failures\n", positions, maxrun, fails);
    return fails != 0;
}
