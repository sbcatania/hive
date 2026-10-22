// The C AI as a line-protocol player for test/rustarena (the Rust engine
// drives the game). Commands: "N <level> <seed>" new game, "M <move>" play a
// move, "G" choose, play and print a move. Moves are "bug from to" with from
// "h" for placements (the format of test/host_test.c and test/rustdump).
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../src/ai.h"

static Move buf[MAX_MOVES];

static void fmt(const Move *m, char *s) {
    uint8_t p = m->piece;
    int tq, tr;
    if (p == NONE) {
        strcpy(s, "pass");
        return;
    }
    tq = (m->to & 15) - 8;
    tr = (m->to >> 4) - 8;
    if (p & MV_PLACE)
        sprintf(s, "%d h %d,%d", BUGOF(p & 0x7F), tq, tr);
    else
        sprintf(s, "%d %d,%d %d,%d", BUGOF(p), (m->from & 15) - 8, (m->from >> 4) - 8, tq, tr);
}

int main(void) {
    char line[128], s[32];
    int level = 2, i, n;
    Move m;
    rules_init();
    rules_new_game();
    while (fgets(line, sizeof line, stdin)) {
        line[strcspn(line, "\n")] = 0;
        if (line[0] == 'N') {
            unsigned seed;
            sscanf(line + 2, "%d %u", &level, &seed);
            rules_new_game();
            rng_state = (uint16_t)seed;
            printf("OK\n");
        } else if (line[0] == 'M') {
            n = gen_moves(buf);
            for (i = 0; i < n; i++) {
                fmt(&buf[i], s);
                if (!strcmp(s, line + 2)) break;
            }
            if (i == n) {
                printf("ILLEGAL\n");
            } else {
                play(&buf[i]);
                printf("OK\n");
            }
        } else if (line[0] == 'G') {
            ai_choose((uint8_t)level, &m);
            fmt(&m, s);
            play(&m);
            printf("%s\n", s);
        }
        fflush(stdout);
    }
    return 0;
}
