// Host-side checks for the C rules: perft from the start position against
// Mzinga's reference counts, then a move-by-move comparison with games
// dumped by the Rust engine (test/rustdump).
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../src/rules.h"

static Move buf[8][MAX_MOVES];

static uint64_t perft(int depth) {
    uint16_t n = gen_moves(buf[depth]), i;
    uint64_t total = 0;
    if (depth == 1) return n;
    for (i = 0; i < n; i++) {
        play(&buf[depth][i]);
        total += perft(depth - 1);
        undo(&buf[depth][i]);
    }
    return total;
}

static void fmt(const Move *m, char *s) {
    uint8_t p = m->piece;
    if (p == NONE) {
        strcpy(s, "pass");
        return;
    }
    int tq = (m->to & 15) - 8, tr = (m->to >> 4) - 8;
    if (p & MV_PLACE)
        sprintf(s, "%d h %d,%d", BUGOF(p & 0x7F), tq, tr);
    else
        sprintf(s, "%d %d,%d %d,%d", BUGOF(p), (m->from & 15) - 8, (m->from >> 4) - 8, tq, tr);
}

static int cmp(const void *a, const void *b) { return strcmp((const char *)a, (const char *)b); }

static char line[256];
static char want[MAX_MOVES][32], got[MAX_MOVES][32];

static int same(int n) {
    int i;
    for (i = 0; i < n; i++)
        if (strcmp(got[i], want[i])) return 0;
    return 1;
}

int main(int argc, char **argv) {
    static const uint64_t expect[] = {0, 4, 96, 1440, 21600, 516240};
    int d, fails = 0;
    rules_init();
    for (d = 1; d <= 5; d++) {
        rules_new_game();
        uint64_t n = perft(d);
        printf("perft %d = %llu %s\n", d, (unsigned long long)n, n == expect[d] ? "ok" : "MISMATCH");
        if (n != expect[d]) fails++;
    }

    FILE *f = fopen(argc > 1 ? argv[1] : "test/rust_games.txt", "r");
    if (!f) {
        perror("rust_games.txt");
        return 1;
    }
    int games = 0, positions = 0, bad_game = 0, i;
    uint16_t n = 0;
    while (fgets(line, sizeof line, f)) {
        line[strcspn(line, "\n")] = 0;
        if (line[0] == 'G') {
            rules_new_game();
            games++;
            bad_game = 0;
        } else if (line[0] == 'P' && line[1] == ' ') {
            int k = atoi(line + 2);
            for (i = 0; i < k; i++) {
                fgets(line, sizeof line, f);
                line[strcspn(line, "\n")] = 0;
                strcpy(want[i], line);
            }
            if (bad_game) continue;
            positions++;
            n = gen_moves(buf[0]);
            for (i = 0; i < n; i++) fmt(&buf[0][i], got[i]);
            qsort(got, n, 32, cmp);
            qsort(want, k, 32, cmp);
            if (n != k || !same(n)) {
                printf("game %d ply %u: C has %u moves, Rust %d\n", games, ply, n, k);
                for (i = 0; i < k; i++)
                    if (!bsearch(want[i], got, n, 32, cmp)) printf("  missing %s\n", want[i]);
                for (i = 0; i < n; i++)
                    if (!bsearch(got[i], want, k, 32, cmp)) printf("  extra   %s\n", got[i]);
                fails++;
                bad_game = 1;
            }
        } else if (line[0] == 'M' && !bad_game) {
            char s[32];
            for (i = 0; i < n; i++) {
                fmt(&buf[0][i], s);
                if (!strcmp(s, line + 2)) break;
            }
            play(&buf[0][i]);
        } else if (line[0] == 'E' && !bad_game) {
            const char *st = state == WHITE_WINS ? "WhiteWins" : state == BLACK_WINS ? "BlackWins" : state == DRAW ? "Draw" : "InProgress";
            if (strcmp(st, line + 2)) {
                printf("game %d: end state %s, Rust %s\n", games, st, line + 2);
                fails++;
            }
        }
    }
    printf("%d games, %d positions compared, %d failures\n", games, positions, fails);
    return fails != 0;
}
