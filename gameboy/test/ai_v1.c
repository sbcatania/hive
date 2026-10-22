#include "ai.h"

#define WIN 30000
#define INF 32000

uint16_t rng_state = 0xACE1;

uint8_t rnd8(void) {
    rng_state = rng_state * 25173u + 13849u;
    return (uint8_t)(rng_state >> 8);
}

// Value of n occupied cells around the opponent's Queen (ours counts against us).
static const int16_t PRESSURE[7] = {0, 10, 25, 50, 95, 180, WIN};

static Move root[MAX_MOVES];
static Move reply[MAX_MOVES];
static int16_t score[MAX_MOVES];

// Static evaluation from `me`'s point of view.
static int16_t evaluate(uint8_t me) {
    uint8_t p, c, bug, color, stuck;
    int16_t s, v;
    if (state != PLAYING) {
        if (state == DRAW) return -20;
        return ((state == WHITE_WINS) == (me == WHITE)) ? WIN : -WIN;
    }
    s = PRESSURE[queen_neighbors(me ^ 1)];
    s -= PRESSURE[queen_neighbors(me)] + (PRESSURE[queen_neighbors(me)] >> 2);
    compute_pinned();
    for (p = 0; p < NPIECES; p++) {
        if (IN_HAND(p)) continue;
        c = pos[p];
        bug = BUGOF(p);
        color = COLOR_OF(p);
        stuck = top[c] != p || (level[p] == 0 && is_pinned_cell(c));
        if (stuck) {
            v = bug == QUEEN ? -40 : bug == ANT ? -14 : -7;
        } else {
            v = bug == ANT ? 9 : bug == QUEEN ? 6 : 4;
            if (level[p] > 0) {
                // Beetle on top of the hive; best of all on the enemy Queen.
                v += 8;
                if (pos[QUEEN_OF(color ^ 1)] == c && !IN_HAND(QUEEN_OF(color ^ 1))) v += 45;
            }
        }
        s += color == me ? v : -v;
    }
    return s;
}

void ai_choose(uint8_t level, Move *best) {
    uint16_t n, i, j, k, nr, bi;
    uint8_t me = TO_MOVE(), cands, noise;
    int16_t worst, best_score, e;

    n = gen_moves(root);
    if (n == 1) {
        *best = root[0];
        return;
    }
    noise = level == AI_EASY ? 63 : 7;
    for (i = 0; i < n; i++) {
        play(&root[i]);
        e = evaluate(me);
        undo(&root[i]);
        if (e >= WIN) {
            *best = root[i];
            return;
        }
        score[i] = e + (rnd8() & noise);
    }

    cands = level == AI_EASY ? 0 : level == AI_NORMAL ? 3 : 8;
    best_score = -INF;
    bi = 0;
    if (!cands) {
        for (i = 0; i < n; i++)
            if (score[i] > best_score) best_score = score[i], bi = i;
        *best = root[bi];
        return;
    }
    // Look one reply deeper for the top candidates, with a cutoff once a
    // reply already makes this candidate no better than the best so far.
    for (k = 0; k < cands && k < n; k++) {
        j = 0;
        for (i = 1; i < n; i++)
            if (score[i] > score[j]) j = i;
        score[j] = -INF;
        play(&root[j]);
        nr = gen_moves(reply);
        worst = nr ? INF : evaluate(me);  // no replies: the game is over
        for (i = 0; i < nr; i++) {
            play(&reply[i]);
            e = evaluate(me);
            undo(&reply[i]);
            if (e < worst) {
                worst = e;
                if (worst <= best_score) break;
            }
        }
        undo(&root[j]);
        if (worst > best_score) {
            best_score = worst;
            bi = j;
        }
    }
    *best = root[bi];
}
