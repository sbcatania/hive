#include "ai.h"
#ifdef __SDCC
#include <gb/gb.h>  // sys_time
#endif

#define WIN 30000
#define INF 32000

uint16_t rng_state = 0xACE1;
void (*ai_progress)(uint8_t done, uint8_t total);

uint8_t rnd8(void) {
    rng_state = rng_state * 25173u + 13849u;
    return (uint8_t)(rng_state >> 8);
}

// Below the root, positions with more than SEARCH_MOVES moves are searched
// without the extra ones (they do not come up in real games; the most seen
// in thousands of AI games is about 140).
#define SEARCH_MOVES 192

static Move root[MAX_MOVES];
static Move reply[SEARCH_MOVES];
static int16_t score[MAX_MOVES];

// ---------------------------------------------------------------------------
// EASY and NORMAL: one ply plus a look at the opponent's best reply.

// Value of n occupied cells around the opponent's Queen (ours counts against us).
static const int16_t PRESSURE[7] = {0, 10, 25, 50, 95, 180, WIN};

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

static void choose_simple(uint8_t level, Move *best) {
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

    cands = level == AI_EASY ? 0 : 3;
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
        gen_cap = SEARCH_MOVES;
        nr = gen_moves(reply);
        gen_cap = MAX_MOVES;
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

// ---------------------------------------------------------------------------
// HARD: iterative-deepening alpha-beta (negamax) under a work budget, with a
// richer evaluation and a check for a Queen that can be finished off at the
// leaves.

static Move deep[SEARCH_MOVES];  // moves two plies below the root
// Three plies below the root the search only looks at moves onto or next to
// the enemy Queen (at most 77), except with its own Queen in danger, when
// it settles for the first DEEP3_MOVES moves.
#define DEEP3_MOVES 80
static Move deep3[DEEP3_MOVES];
static Move *const bufs[4] = {root, reply, deep, deep3};
static const uint8_t buf_cap[4] = {0, SEARCH_MOVES, SEARCH_MOVES, DEEP3_MOVES};
static Move tmp[16];          // gen_moves_to output
static Move killer[4];
static uint8_t root_side, stopped;
static uint16_t work, budget;
#ifdef PROF
unsigned long prof_eval, prof_gen, prof_genmoves, prof_win;
uint16_t prof_n, prof_w1, prof_w2, prof_d, prof_i;
unsigned long prof_look, prof_hit, prof_near, prof_epieces, prof_gpieces;
#define PROF_ADD(x, n) (x += (n))
static uint16_t npieces_on_board(void) {
    uint8_t p, n = 0;
    for (p = 0; p < NPIECES; p++)
        if (!IN_HAND(p)) n++;
    return n;
}
#else
#define PROF_ADD(x, n)
#endif
uint16_t last_work;  // work spent on the last HARD move (for tests)

// Evaluation weights (tuned on the host with test/arena.c; each can be
// overridden with -D for experiments).
#ifndef QS_INIT
#define QS_INIT {0, 10, 30, 65, 125, 230, 0}
#endif
#ifndef MOBILE_INIT
#define MOBILE_INIT {6, 8, 36, 10, 22}
#endif
#ifndef HAND_INIT
#define HAND_INIT {0, 4, 8, 5, 12}
#endif
#ifndef REFUND
#define REFUND 6
#endif
#ifndef QUEEN_FREE
#define QUEEN_FREE 12
#endif
// Bonus for a piece that can reach a free cell next to the enemy Queen, by
// how many cells around that Queen are already taken: about half of what
// actually filling the next cell is worth, so attackers do go in.
#ifndef ATT_INIT
#define ATT_INIT {4, 8, 14, 22, 39, 75, 0}
#endif
#ifndef ON_ENEMY
#define ON_ENEMY 10
#endif
#ifndef ON_QUEEN
#define ON_QUEEN 60
#endif
#ifndef COVERED
#define COVERED 6
#endif
#ifndef TEMPO
#define TEMPO 6
#endif
#ifndef CONTEMPT
#define CONTEMPT 60
#endif
static const int16_t QS[7] = QS_INIT;
static const uint8_t MOBILE[NBUGS] = MOBILE_INIT;
static const uint8_t HAND[NBUGS] = HAND_INIT;
static const uint8_t ATT[7] = ATT_INIT;

static uint8_t mob[NPIECES];
static uint8_t qcell[2], nholes[2], enterable[2];

// Does a hopper on c have a jump that lands next to the cell eqc?
static uint8_t hopper_att(uint8_t c, uint8_t eqc) {
    uint8_t m = nbm[c], d, t;
    for (d = 0; m; d++, m >>= 1) {
        if (!(m & 1)) continue;
        t = NB[d][c];
        while (height[t]) t = NB[d][t];
        if (HEXDIST(t, eqc) == 1) return 1;
    }
    return 0;
}

// Score of one side's pieces (everything but its own Queen's surroundings):
// pieces in hand, covered, on top of enemies, free to move, and able to
// reach a free cell next to the enemy Queen next move ("attackers").
#ifdef __SDCC
// SM83 version of the C code below (SDCC's code for it was the single
// biggest cost of the search). Bugs: 0 Queen, 1 Spider, 2 Beetle,
// 3 Hopper, 4 Ant. Returns s in BC.
static uint8_t ss_color, ss_eqc, ss_h, ss_ent, ss_attv, ss_enemy_q, ss_p, ss_j, ss_bug, ss_lvl, ss_c, ss_natt;

static int16_t side_score(uint8_t color) __naked {
    (void)color;
    __asm
    ld (_ss_color), a
    xor a, #1
    ld e, a
    ld d, #0
    ld hl, #_qcell
    add hl, de
    ld a, (hl)
    ld (_ss_eqc), a
    ld hl, #_enterable
    add hl, de
    ld a, (hl)
    ld (_ss_ent), a
    ld hl, #_nholes
    add hl, de
    ld a, (hl)
    ld (_ss_h), a
    ld c, a
    ld a, #6
    sub a, c
    ld e, a
    ld hl, #_ATT
    add hl, de
    ld a, (hl)
    ld (_ss_attv), a
    ld a, (_ss_color)
    or a, a
    ld a, #11
    ld b, #0
    jr z, 1$
    ld b, a
    xor a, a
1$:
    ld (_ss_enemy_q), a
    ld a, b
    ld (_ss_p), a
    xor a, a
    ld (_ss_j), a
    ld (_ss_natt), a
    ld bc, #0
10$:
    ; bug = BUG_OF[j]
    ld a, (_ss_j)
    ld e, a
    ld d, #0
    ld hl, #_BUG_OF
    add hl, de
    ld a, (hl)
    ld (_ss_bug), a
    ; mob[p] = 0, then level[p]
    ld a, (_ss_p)
    ld e, a
    ld hl, #_mob
    add hl, de
    ld (hl), #0
    ld hl, #_level
    add hl, de
    ld a, (hl)
    inc a
    jr nz, 11$
    ; in hand
    ld a, (_ss_bug)
    ld e, a
    ld hl, #_HAND
    add hl, de
    ld a, (hl)
    add a, c
    ld c, a
    jp nc, 90$
    inc b
    jp 90$
11$:
    dec a
    ld (_ss_lvl), a
    ld hl, #_pos
    add hl, de
    ld a, (hl)
    ld (_ss_c), a
    add a, #<(_top)
    ld l, a
    ld a, #>(_top)
    adc a, #0
    ld h, a
    ld a, (hl)
    cp a, e
    jr z, 12$
    ; covered
    ld a, c
    sub a, #COVERED
    ld c, a
    jp nc, 90$
    dec b
    jp 90$
12$:
    ld a, (_ss_lvl)
    or a, a
    jr z, 14$
    ; up on the hive: what is below?
    ld hl, #_under
    add hl, de
    ld a, (hl)
    ld l, a
    cp a, #11
    ld a, #0
    jr c, 13$
    inc a
13$:
    ld h, a
    ld a, (_ss_color)
    cp a, h
    jr z, 20$
    ld a, (_ss_enemy_q)
    cp a, l
    ld a, #ON_ENEMY
    jr nz, 15$
    ld a, #ON_QUEEN
15$:
    add a, c
    ld c, a
    jr nc, 20$
    inc b
    jr 20$
14$:
    ; on the ground: pinned?
    ld a, (_ss_c)
    add a, #<(_pinned)
    ld l, a
    ld a, #>(_pinned)
    adc a, #0
    ld h, a
    ld a, (hl)
    or a, a
    jp nz, 90$
    ld a, (_ss_bug)
    cp a, #2
    jr z, 20$
    cp a, #3
    jr z, 20$
    ld a, (_ss_c)
    add a, #<(_nbm)
    ld l, a
    ld a, #>(_nbm)
    adc a, #0
    ld h, a
    ld a, (hl)
    add a, #<(_SLIDE)
    ld l, a
    ld a, #>(_SLIDE)
    adc a, #0
    ld h, a
    ld a, (hl)
    or a, a
    jp z, 90$
20$:
    ; free to move
    ld hl, #_mob
    add hl, de
    ld (hl), #1
    ld a, (_ss_bug)
    ld e, a
    ld hl, #_MOBILE
    add hl, de
    ld a, (hl)
    add a, c
    ld c, a
    jr nc, 21$
    inc b
21$:
    ld a, (_ss_h)
    or a, a
    jp z, 90$
    ld a, (_ss_j)
    or a, a
    jp z, 90$
    ; e = HEXDIST(c, eqc)
    ld a, (_ss_eqc)
    ld l, a
    ld a, (_ss_c)
    sub a, l
    and a, #0x0F
    ld h, a
    ld a, l
    and a, #0xF0
    ld l, a
    ld a, (_ss_c)
    and a, #0xF0
    sub a, l
    or a, h
    add a, #<(_HEXD)
    ld l, a
    ld a, #>(_HEXD)
    adc a, #0
    ld h, a
    ld a, (hl)
    ld e, a
    cp a, #1
    jr nz, 22$
    ld a, (_ss_c)
    add a, #<(_height)
    ld l, a
    ld a, #>(_height)
    adc a, #0
    ld h, a
    ld a, (hl)
    cp a, #1
    jp z, 90$
22$:
    ld a, (_ss_bug)
    cp a, #4
    jr nz, 23$
    ld a, (_ss_ent)
    or a, a
    jr z, 90$
    jr 30$
23$:
    cp a, #2
    jr nz, 24$
    ld a, e
    or a, a
    jr z, 90$
    cp a, #3
    jr c, 30$
    jr 90$
24$:
    cp a, #1
    jr nz, 25$
    ld a, (_ss_ent)
    or a, a
    jr z, 90$
    ld a, e
    cp a, #5
    jr c, 30$
    jr 90$
25$:
    push bc
    ld a, (_ss_eqc)
    ld e, a
    ld a, (_ss_c)
    call _hopper_att
    pop bc
    or a, a
    jr z, 90$
30$:
    ld hl, #_ss_natt
    inc (hl)
90$:
    ld hl, #_ss_p
    inc (hl)
    ld hl, #_ss_j
    inc (hl)
    ld a, (hl)
    cp a, #11
    jp c, 10$
    ; s += natt * attv
    ld a, (_ss_natt)
    or a, a
    ret z
    ld e, a
    ld a, (_ss_attv)
    ld l, a
91$:
    ld a, c
    add a, l
    ld c, a
    jr nc, 92$
    inc b
92$:
    dec e
    jr nz, 91$
    ret
    __endasm;
}
#else
static int16_t side_score(uint8_t color) {
    uint8_t j, p, c, bug, t, att, h, eqc, ent, enemy_q, dq, natt = 0, attv;
    int16_t s = 0;
    enemy_q = QUEEN_OF(color ^ 1);
    eqc = qcell[color ^ 1];
    h = nholes[color ^ 1];
    ent = enterable[color ^ 1];
    attv = ATT[6 - h];
    p = color ? PER_COLOR : 0;
    for (j = 0; j < PER_COLOR; j++, p++) {
        bug = BUG_OF[j];
        mob[p] = 0;
        if (level[p] == NONE) {
            s += HAND[bug];
            continue;
        }
        c = pos[p];
        if (top[c] != p) {
            s -= COVERED;
            continue;
        }
        if (level[p]) {
            t = under[p];
            if (COLOR_OF(t) != color) s += t == enemy_q ? ON_QUEEN : ON_ENEMY;
        } else if (pinned[c]) {
            continue;
        } else if (bug != BEETLE && bug != HOPPER && !SLIDE[nbm[c]]) {
            continue;
        }
        mob[p] = 1;
        s += MOBILE[bug];
        if (!h || !j) continue;
        dq = HEXDIST(c, eqc);
        if (dq == 1 && height[c] == 1) continue;  // already there
        if (bug == ANT) att = ent;
        else if (bug == BEETLE) att = dq && dq <= 2;
        else if (bug == SPIDER) att = ent && dq <= 4;
        else att = hopper_att(c, eqc);
        if (att) natt++;
    }
    s += natt * attv;
    return s;
}
#endif

// Penalty for the cells around a side's own Queen.
static int16_t queen_score(uint8_t color) {
    uint8_t c = qcell[color], m, d, t;
    int16_t s;
    if (c == NONE) return 0;
    m = nbm[c];
    s = -QS[POP6[m]];
    if (mob[QUEEN_OF(color)]) s += QUEEN_FREE;
    for (d = 0; m; d++, m >>= 1) {
        if (!(m & 1)) continue;
        t = top[NB[d][c]];
        if (COLOR_OF(t) == color && mob[t]) s += REFUND;
    }
    return s;
}

// Static evaluation for the side to move.
static int16_t eval_hard(void) {
    uint8_t p, c, color, d, m, n;
    int16_t s;
    // Work is counted in roughly milliseconds of Game Boy time (fitted
    // against tools/check.py runs).
    work += 2 + ((nplaced * 3) >> 3);
    PROF_ADD(prof_eval, 1);
    PROF_ADD(prof_epieces, npieces_on_board());
    compute_pinned();
    for (color = 0; color < 2; color++) {
        p = QUEEN_OF(color);
        n = enterable[color] = 0;
        qcell[color] = NONE;
        if (level[p] != NONE) {
            c = qcell[color] = pos[p];
            m = nbm[c];
            for (d = 0; d < 6; d++, m >>= 1) {
                if (m & 1) continue;
                n++;
                if (SLIDE[nbm[NB[d][c]]]) enterable[color] = 1;
            }
        }
        nholes[color] = n;
    }
    s = side_score(WHITE) - side_score(BLACK);
    s += queen_score(WHITE) - queen_score(BLACK);
    if (TO_MOVE()) s = -s;
    return s + TEMPO;
}

static int16_t terminal(uint8_t ply_) {
    if (state == DRAW) return TO_MOVE() == root_side ? -CONTEMPT : CONTEMPT;
    // The side that just moved won (or lost) on its move.
    if ((state == WHITE_WINS) == (TO_MOVE() == WHITE)) return WIN - ply_;
    return -WIN + ply_;
}

// Scores of the positions two plies down, kept from one iteration to the
// next: the depth-3 search stands pat on exactly the positions the depth-2
// search scored. Keyed by a 16-bit hash of the two moves.
#ifndef NO_CACHE
#define CACHE 128
static uint16_t cache_key[CACHE];
static int16_t cache_val[CACHE];
#endif
static const Move *path[2];

static uint16_t path_hash(void) {
    const Move *a = path[0], *b = path[1];
    uint16_t h = a->piece;
    h = h * 251u + a->from;
    h = h * 251u + a->to;
    h = h * 251u + b->piece;
    h = h * 251u + b->from;
    h = h * 251u + b->to;
    return h;
}

static int16_t leaf_eval(uint8_t ply_);

static int16_t leaf(uint8_t ply_) {
#ifndef NO_CACHE
    uint16_t h;
    uint8_t i;
    if (ply_ == 2) {
        h = path_hash();
        i = (uint8_t)(h ^ (h >> 8)) & (CACHE - 1);
        PROF_ADD(prof_look, 1);
        if (cache_key[i] == h) {
            PROF_ADD(prof_hit, 1);
            return cache_val[i];
        }
        // Keep the first entry: the depth-2 search scores the best moves
        // (by depth 1) first, and those are what depth 3 looks at.
        if (cache_key[i] != 0xFFFF) return leaf_eval(ply_);
        cache_key[i] = h;
        return cache_val[i] = leaf_eval(ply_);
    }
#endif
    return leaf_eval(ply_);
}

// Leaf: static evaluation, unless the side to move can surround the enemy
// Queen right now.
static int16_t leaf_eval(uint8_t ply_) {
    uint8_t eq = QUEEN_OF(TO_MOVE() ^ 1), c, d, hole = 0, n, i, won;
    if (!IN_HAND(eq)) {
        c = pos[eq];
        if (POP6[nbm[c]] == 5) {
            for (d = 0; d < 6; d++)
                if (!height[NB[d][c]]) hole = NB[d][c];
            work += 22;
            PROF_ADD(prof_win, 1);
            n = gen_moves_to(tmp, hole);
            for (i = 0; i < n; i++) {
                play(&tmp[i]);
                won = state != PLAYING && state != DRAW;
                undo(&tmp[i]);
                if (won) return WIN - ply_ - 1;
            }
        }
    }
    return eval_hard();
}

// Cheap move ordering: moves that land next to the enemy Queen (or on it)
// first, then moves that step away from our own Queen.
static void order(Move *b, uint16_t n) {
    uint8_t me = TO_MOVE(), eqc, oqc, to, from, good;
    Move *front = b, *e = b + n, t;
    eqc = level[QUEEN_OF(me ^ 1)] == NONE ? NONE : pos[QUEEN_OF(me ^ 1)];
    oqc = level[QUEEN_OF(me)] == NONE ? NONE : pos[QUEEN_OF(me)];
    for (; b != e; b++) {
        to = b->to;
        good = 0;
        if (eqc != NONE && HEXDIST(to, eqc) <= 1) {
            from = b->from;
            good = (b->piece & MV_PLACE) || HEXDIST(from, eqc) != 1 || height[from] > 1;
        } else if (oqc != NONE && !(b->piece & MV_PLACE)) {
            from = b->from;
            good = HEXDIST(from, oqc) == 1 && HEXDIST(to, oqc) != 1;
        }
        if (good) {
            if (front != b) {
                t = *front;
                *front = *b;
                *b = t;
            }
            front++;
        }
    }
}

// Moves the killer (the last move that caused a cutoff at this ply) to the
// front; returns whether it was there.
static uint8_t killer_first(Move *b, uint16_t n, uint8_t ply_) {
    uint8_t kp = killer[ply_].piece, kf = killer[ply_].from, kt = killer[ply_].to;
    uint16_t k;
    Move t;
    if (kp == NONE) return 0;
    for (k = 0; k < n; k++)
        if (b[k].to == kt && b[k].piece == kp && b[k].from == kf) {
            t = b[k];
            b[k] = b[0];
            b[0] = t;
            return 1;
        }
    return 0;
}


// On the Game Boy, a hard stop well before 12 s in case a position is much
// slower per unit of work than usual (it does not normally trigger, so the
// host builds play the same moves).
#ifndef MAX_FRAMES
#define MAX_FRAMES 600
#endif
#ifdef __SDCC
static uint16_t t_start;
#define time_up() ((uint16_t)(sys_time - t_start) >= MAX_FRAMES)
#define start_clock() (t_start = sys_time)
#else
#define time_up() 0
#define start_clock()
#endif

static void progress(void) {
    uint16_t d;
    if (!ai_progress) return;
    d = work / (budget >> 6);
    ai_progress(d > 64 ? 64 : (uint8_t)d, 64);
}

static int16_t search(uint8_t depth, int16_t alpha, int16_t beta, uint8_t ply_) {
    uint16_t n, i;
    uint8_t k;
    int16_t best = -INF, s;
    Move *b;
    if (state != PLAYING) return terminal(ply_);
    if (!depth) return leaf(ply_);
    if (work >= budget || time_up()) {
        stopped = 1;
        return 0;
    }
    b = bufs[ply_];
    gen_cap = buf_cap[ply_];
#ifndef DANGER
#define DANGER 5
#endif
#ifndef NO_SELECTIVE
    // Our second move (just above the leaves): stand pat on the static
    // score unless our Queen is in danger, and otherwise only look at moves
    // onto or next to the enemy Queen.
    if (depth == 1 && ply_ >= 2 && queen_neighbors(TO_MOVE()) < DANGER) {
        uint8_t eq = QUEEN_OF(TO_MOVE() ^ 1);
        best = leaf(ply_);
        if (best >= beta || IN_HAND(eq)) return best;
        if (best > alpha) alpha = best;
        n = gen_moves_near(b, pos[eq]);
        work += 4;
        PROF_ADD(prof_near, 1);
        for (i = 0; i < n; i++) {
            play(&b[i]);
            s = -search(0, -beta, -alpha, ply_ + 1);
            undo(&b[i]);
            if (s > best) {
                best = s;
                if (s > alpha) {
                    alpha = s;
                    if (alpha >= beta) break;
                }
            }
        }
        return best;
    }
#endif
    n = gen_moves(b);
    work += 7 + (n >> 3) + (nplaced >> 2);
    PROF_ADD(prof_gen, 1);
    PROF_ADD(prof_genmoves, n);
    PROF_ADD(prof_gpieces, npieces_on_board());
    // Try the killer first; order the rest only if it did not cut off.
    k = killer_first(b, n, ply_);
    if (!k) order(b, n);
    for (i = 0; i < n; i++) {
        if (k && i == 1) order(b + 1, n - 1);
        if (ply_ == 1) path[1] = &b[i];
        play(&b[i]);
        s = -search(depth - 1, -beta, -alpha, ply_ + 1);
        undo(&b[i]);
        if (stopped || work >= budget) {
            stopped = 1;
            return 0;
        }
        if (s > best) {
            best = s;
            if (s > alpha) {
                alpha = s;
                if (alpha >= beta) {
                    killer[ply_] = b[i];
                    break;
                }
            }
        }
    }
    return best;
}

// Sort root moves by score, best first (insertion sort; scores mostly sorted
// already after the first pass).
static void sort_root(uint16_t n) {
    uint16_t i, j;
    int16_t s;
    Move m;
    for (i = 1; i < n; i++) {
        s = score[i];
        m = root[i];
        for (j = i; j && score[j - 1] < s; j--) {
            score[j] = score[j - 1];
            root[j] = root[j - 1];
        }
        score[j] = s;
        root[j] = m;
    }
}

#ifndef HARD_BUDGET
#define HARD_BUDGET 4800
#endif
#ifndef MAX_DEPTH
#define MAX_DEPTH 4  // bufs[] has room for 4 plies
#endif

static void choose_hard(Move *best) {
    uint16_t n, i, k;
    uint8_t depth;
    int16_t alpha, s;
    Move bm;

    root_side = TO_MOVE();
    start_clock();
    n = gen_moves(root);
    *best = root[0];
    if (n == 1) return;
    work = 0;
    budget = HARD_BUDGET;
    stopped = 0;
    killer[0].piece = killer[1].piece = killer[2].piece = killer[3].piece = NONE;
#ifndef NO_CACHE
    for (i = 0; i < CACHE; i++) cache_key[i] = 0xFFFF;
#endif

    // Depth 1 scores every move; shuffle first so equal scores vary.
    for (i = n - 1; i; i--) {
        k = rnd8() % (i + 1);
        bm = root[i];
        root[i] = root[k];
        root[k] = bm;
    }
    for (i = 0; i < n; i++) {
        play(&root[i]);
        score[i] = state != PLAYING ? -terminal(1) : -leaf(1);
        undo(&root[i]);
        if (!(i & 15)) progress();
    }
    sort_root(n);
    *best = root[0];
#ifdef PROF
    prof_n = n;
    prof_w1 = work;
    prof_w2 = 0;
    prof_d = 1;
#endif
    if (score[0] >= WIN - 10) return;

    for (depth = 2; depth <= MAX_DEPTH; depth++) {
        alpha = -INF;
        bm = root[0];
        for (i = 0; i < n; i++) {
            path[0] = &root[i];
            play(&root[i]);
            s = -search(depth - 1, -INF, -alpha, 1);
            undo(&root[i]);
            if (stopped) break;
            score[i] = s;
            if (s > alpha) {
                alpha = s;
                bm = root[i];
            }
            progress();
        }
        // A partial iteration still counts if it covered the previous best.
        if (i) *best = bm;
#ifdef PROF
        if (!stopped) prof_d = depth;
        if (depth == 2) prof_w2 = work;
        prof_i = i;
#endif
        if (stopped) break;
        sort_root(n);
        if (alpha >= WIN - 10 || alpha <= -WIN + 10) break;
    }
    gen_cap = MAX_MOVES;
    last_work = work;
}

void ai_choose(uint8_t level, Move *best) {
    if (level == AI_HARD) choose_hard(best);
    else choose_simple(level, best);
}
