// Hive for the Game Boy Color: title menu, board rendering, cursor input,
// pass-and-play or vs CPU.
#include <gb/gb.h>
#include <gb/cgb.h>
#include <stdint.h>
#include "rules.h"
#include "ai.h"
#include "assets.h"

#define PAL_BOARD 0
#define PAL_WHITE 1
#define PAL_BLACK 2
#define PAL_TARGET 3
#define PAL_WSEL 4
#define PAL_BSEL 5
#define PAL_HUD 6
#define PAL_TOCC 7

#define SAND RGB8(232, 214, 172)
static const palette_color_t bg_pal[32] = {
    SAND, RGB8(200, 178, 134), RGB8(206, 140, 44), RGB8(52, 40, 28),         // board, text
    SAND, RGB8(250, 244, 226), RGB8(140, 110, 72), RGB8(44, 34, 24),         // white piece
    SAND, RGB8(62, 56, 64), RGB8(20, 18, 24), RGB8(244, 230, 196),           // black piece
    SAND, RGB8(40, 150, 70), RGB8(40, 150, 70), RGB8(20, 90, 40),            // legal target
    SAND, RGB8(255, 220, 110), RGB8(196, 120, 20), RGB8(44, 34, 24),         // white selected
    SAND, RGB8(130, 80, 20), RGB8(255, 190, 60), RGB8(255, 240, 200),        // black selected
    RGB8(44, 36, 30), RGB8(96, 84, 72), RGB8(244, 184, 60), RGB8(244, 232, 204),  // HUD
    SAND, RGB8(176, 232, 160), RGB8(30, 140, 60), RGB8(30, 40, 30),          // target on a piece
};
static const palette_color_t spr_pal[4] = {RGB8(0, 0, 0), RGB8(220, 40, 40), RGB8(255, 255, 255), RGB8(0, 0, 0)};

static const char BUG_LETTER[NBUGS] = {'Q', 'S', 'B', 'G', 'A'};
static const char *const BUG_NAME[NBUGS] = {"QUEEN", "SPIDER", "BEETLE", "HOPPER", "ANT"};

enum { S_IDLE, S_PIECE, S_HAND, S_PASS, S_OVER };

static Move moves[MAX_MOVES];
static uint16_t nmoves;
static uint8_t mark[256];  // nonzero: highlighted destination
static uint8_t cur, cam, lean;
static uint8_t sub, sel_cell, sel_piece, hand_bug;
static uint8_t cpu[2], ai_level = AI_NORMAL;
static uint8_t bt[320], ba[320];
static uint8_t hud_t[40], hud_a[40];
static uint8_t prev_keys, pressed, rep_timer;
static char msg[21];
uint16_t game_ply;  // moves actually played (read by tools/demo.py)
uint8_t game_over;

// The last HIST moves, for undo.
#define HIST 16
static Move hist[HIST];
static uint8_t hist_i, hist_n;

#define HINT_IDLE "A:PICK  START:MENU"
#define HINT_PIECE "A:MOVE HERE  B:BACK"
#define HINT_HAND "</>:BUG A:OK B:BACK"

// ---- small helpers ----

static void set_msg(const char *a, const char *b) {
    uint8_t i = 0;
    while (*a && i < 20) msg[i++] = *a++;
    if (b)
        while (*b && i < 20) msg[i++] = *b++;
    msg[i] = 0;
}

static void read_input(void) {
    uint8_t k = joypad();
    uint8_t dpad = J_UP | J_DOWN | J_LEFT | J_RIGHT;
    pressed = k & ~prev_keys;
    if (k & dpad) {
        if (pressed & dpad)
            rep_timer = 14;
        else if (rep_timer)
            rep_timer--;
        else {
            pressed |= k & dpad;
            rep_timer = 4;
        }
    }
    prev_keys = k;
}

// Signed difference of two 4-bit torus coordinates, in -8..7.
static int8_t sdiff(uint8_t a, uint8_t b) {
    return ((int8_t)(uint8_t)((uint8_t)(a - b) << 4)) >> 4;
}

static uint8_t cell_at(int8_t dq, int8_t dr) {
    return (uint8_t)(((cam & 15) + dq) & 15) | (uint8_t)((((cam >> 4) + dr) & 15) << 4);
}

static int8_t screen_x(uint8_t c) {
    return 2 * sdiff(c & 15, cam & 15) + sdiff(c >> 4, cam >> 4) + 9;
}

static int8_t screen_y(uint8_t c) {
    return 2 * sdiff(c >> 4, cam >> 4) + 6;
}

// ---- drawing ----

static void put4(int8_t x, int8_t y, uint8_t tile, uint8_t pal) {
    uint8_t i, j;
    int8_t tx;
    for (j = 0; j < 2; j++) {
        for (i = 0; i < 2; i++) {
            tx = x + i;
            if (tx < 0 || tx > 19) continue;
            bt[(y + j) * 20 + tx] = tile + j * 2 + i;
            ba[(y + j) * 20 + tx] = pal;
        }
    }
}

static void bg_text(uint8_t x, uint8_t y, const char *s, uint8_t pal) {
    uint16_t i = y * 20 + x;
    while (*s && x++ < 20) {
        bt[i] = T_FONT + ascii_map[*s++ - 32];
        ba[i++] = pal;
    }
}

static void clear_bg(void) {
    uint16_t i;
    for (i = 0; i < 320; i++) {
        bt[i] = T_BLANK;
        ba[i] = PAL_BOARD;
    }
}

static void push_bg(void) {
    set_bkg_tiles(0, 0, 20, 16, bt);
    VBK_REG = VBK_ATTRIBUTES;
    set_bkg_tiles(0, 0, 20, 16, ba);
    VBK_REG = VBK_TILES;
}

static void draw_hex(int8_t x, int8_t y, uint8_t c) {
    uint8_t p, pal, black;
    if (height[c]) {
        p = top[c];
        black = COLOR_OF(p);
        pal = black ? PAL_BLACK : PAL_WHITE;
        if (c == sel_cell) pal = black ? PAL_BSEL : PAL_WSEL;
        else if (mark[c]) pal = PAL_TOCC;
        put4(x, y, T_PIECE + (BUGOF(p) * 2 + (height[c] > 1)) * 4, pal);
    } else if (mark[c]) {
        put4(x, y, T_TARGET, PAL_TARGET);
    } else {
        put4(x, y, T_HEX, PAL_BOARD);
    }
}

static void draw_board(void) {
    int8_t dq, dr, x, y;
    clear_bg();
    for (dr = -3; dr <= 4; dr++) {
        y = 2 * dr + 6;
        for (dq = -7; dq <= 7; dq++) {
            x = 2 * dq + dr + 9;
            if (x < -1 || x > 19) continue;
            draw_hex(x, y, cell_at(dq, dr));
        }
    }
    push_bg();
}

static void place_cursor(void) {
    uint8_t x = (uint8_t)(screen_x(cur) * 8 + 8);
    uint8_t y = (uint8_t)(screen_y(cur) * 8 + 16);
    move_sprite(0, x, y);
    move_sprite(1, x + 8, y);
}

static void hide_cursor(void) {
    move_sprite(0, 0, 0);
    move_sprite(1, 0, 0);
}

static void hud_put(uint8_t i, char ch) {
    hud_t[i] = T_FONT + ascii_map[ch - 32];
}

static void draw_hud(void) {
    uint8_t i, b, color = TO_MOVE();
    const char *s;
    for (i = 0; i < 40; i++) {
        hud_put(i, ' ');
        hud_a[i] = PAL_HUD;
    }
    s = color ? "BLACK" : "WHITE";
    for (i = 0; s[i]; i++) hud_put(i, s[i]);
    for (b = 0; b < NBUGS; b++) {
        hud_put(6 + 3 * b, BUG_LETTER[b]);
        hud_put(7 + 3 * b, '0' + hand_count(color, b));
        if (sub == S_HAND && b == hand_bug) hud_put(5 + 3 * b, '>');
    }
    for (i = 0; msg[i]; i++) hud_put(20 + i, msg[i]);
    set_win_tiles(0, 0, 20, 2, hud_t);
    VBK_REG = VBK_ATTRIBUTES;
    set_win_tiles(0, 0, 20, 2, hud_a);
    VBK_REG = VBK_TILES;
}

// Moves the camera onto the cursor when it nears the screen edge.
static uint8_t follow_cursor(void) {
    int8_t x = screen_x(cur), y = screen_y(cur);
    if (x < 1 || x > 17 || y < 0 || y > 12) {
        cam = cur;
        return 1;
    }
    return 0;
}

static void refresh(void) {
    follow_cursor();
    draw_board();
    draw_hud();
    place_cursor();
}

// ---- game flow ----

static void clear_marks(void) {
    uint16_t i;
    for (i = 0; i < 256; i++) mark[i] = 0;
}

static void mark_placements(void) {
    uint16_t i;
    clear_marks();
    for (i = 0; i < nmoves; i++)
        if (moves[i].piece != NONE && (moves[i].piece & MV_PLACE)) mark[moves[i].to] = 1;
}

static uint8_t mark_piece(uint8_t p) {
    uint16_t i;
    uint8_t n = 0;
    clear_marks();
    for (i = 0; i < nmoves; i++)
        if (moves[i].piece == p) {
            mark[moves[i].to] = 1;
            n = 1;
        }
    return n;
}

static uint8_t has_moves(uint8_t p) {
    uint16_t i;
    for (i = 0; i < nmoves; i++)
        if (moves[i].piece == p) return 1;
    return 0;
}

static uint8_t can_place(uint8_t bug, uint8_t c) {
    uint16_t i;
    uint8_t p;
    for (i = 0; i < nmoves; i++) {
        p = moves[i].piece;
        if (p != NONE && (p & MV_PLACE) && moves[i].to == c && BUGOF(p & 0x7F) == bug) return 1;
    }
    return 0;
}

static uint8_t only_queen_placements(void) {
    uint16_t i;
    for (i = 0; i < nmoves; i++)
        if (!(moves[i].piece & MV_PLACE) || BUGOF(moves[i].piece & 0x7F) != QUEEN) return 0;
    return 1;
}

static void begin_turn(uint8_t keep_msg) {
    uint8_t me = TO_MOVE();
    nmoves = gen_moves(moves);
    sel_cell = NONE;
    sub = S_IDLE;
    clear_marks();
    game_over = state != PLAYING;
    if (game_over) {
        sub = S_OVER;
        if (state == DRAW) set_msg("DRAW!", " START:MENU");
        else if (cpu[0] || cpu[1]) set_msg(cpu[state == WHITE_WINS ? WHITE : BLACK] ? "CPU WINS!" : "YOU WIN!", " START:MENU");
        else set_msg(state == WHITE_WINS ? "WHITE WINS!" : "BLACK WINS!", " START:MENU");
    } else if (moves[0].piece == NONE) {
        sub = S_PASS;
        if (!cpu[me]) set_msg("NO MOVES. A: PASS", 0);
    } else if (!cpu[me]) {
        mark_placements();
        if (!keep_msg) set_msg(only_queen_placements() ? "PLACE YOUR QUEEN!" : HINT_IDLE, 0);
    }
    refresh();
}

static void do_move(const Move *m) {
    uint8_t was_cpu = cpu[TO_MOVE()];
    if (was_cpu) {
        if (m->piece == NONE) set_msg("CPU PASSED", 0);
        else set_msg((m->piece & MV_PLACE) ? "CPU PLACED " : "CPU MOVED ", BUG_NAME[BUGOF(m->piece & 0x7F)]);
    }
    play(m);
    game_ply++;
    hist[hist_i] = *m;
    hist_i = (hist_i + 1) & (HIST - 1);
    if (hist_n < HIST) hist_n++;
    if (m->piece != NONE) cur = m->to;
    begin_turn(was_cpu);
}

static void move_cursor(uint8_t d) {
    cur = NB[d][cur];
    if (follow_cursor()) draw_board();
    place_cursor();
}

// SELECT: the next cell after the cursor (in board order) worth pressing A
// on: a green spot, or (with nothing picked up) a piece that can move.
static void jump(void) {
    uint8_t c = cur, i, p;
    for (i = 0; i < 255; i++) {
        c++;
        if (mark[c]) break;
        p = top[c];
        if (sub == S_IDLE && p != NONE && COLOR_OF(p) == TO_MOVE() && has_moves(p)) break;
    }
    if (i == 255) return;  // nothing found
    cur = c;
    if (follow_cursor()) draw_board();
    place_cursor();
}

static void press_a(void) {
    uint16_t i;
    uint8_t c = cur, p = top[cur], b;
    if (sub == S_PIECE && mark[c]) {
        for (i = 0; i < nmoves; i++)
            if (moves[i].piece == sel_piece && moves[i].to == c) {
                do_move(&moves[i]);
                return;
            }
    }
    if (p != NONE && COLOR_OF(p) == TO_MOVE()) {
        if (has_moves(p)) {
            sel_piece = p;
            sel_cell = c;
            mark_piece(p);
            sub = S_PIECE;
            set_msg(HINT_PIECE, 0);
        } else {
            set_msg(IN_HAND(QUEEN_OF(TO_MOVE())) ? "PLACE QUEEN FIRST" : "THAT PIECE IS STUCK", 0);
        }
    } else if (sub == S_IDLE && mark[c]) {
        for (b = 0; b < NBUGS; b++)
            if (can_place(b, c)) break;
        hand_bug = b;
        sel_cell = c;
        sub = S_HAND;
        set_msg(HINT_HAND, 0);
    } else {
        if (sub == S_PIECE) {
            sub = S_IDLE;
            sel_cell = NONE;
            mark_placements();
        }
        set_msg(p != NONE ? "NOT YOUR PIECE" : "PICK A PIECE OR SPOT", 0);
    }
    draw_board();
    draw_hud();
}

static void cancel(void) {
    sub = S_IDLE;
    sel_cell = NONE;
    mark_placements();
    set_msg(HINT_IDLE, 0);
    draw_board();
    draw_hud();
}

static void hand_input(void) {
    uint16_t i;
    uint8_t b = hand_bug, n;
    if (pressed & (J_LEFT | J_RIGHT)) {
        for (n = 0; n < NBUGS; n++) {
            b = (pressed & J_RIGHT) ? (b + 1) % NBUGS : (b + NBUGS - 1) % NBUGS;
            if (can_place(b, sel_cell)) break;
        }
        hand_bug = b;
        draw_hud();
    } else if (pressed & J_A) {
        for (i = 0; i < nmoves; i++)
            if ((moves[i].piece & MV_PLACE) && moves[i].to == sel_cell && BUGOF(moves[i].piece & 0x7F) == hand_bug) {
                do_move(&moves[i]);
                return;
            }
    } else if (pressed & J_B) {
        cancel();
    }
}

// HARD reports its progress; fill a bar after "THINKING" on the HUD.
static uint8_t bar_len;

static void show_progress(uint8_t done, uint8_t total) {
    uint8_t n = (uint16_t)done * 11 / total, t = T_FONT + ascii_map['-' - 32];
    while (bar_len < n && bar_len < 11) set_win_tiles(9 + bar_len++, 1, 1, 1, &t);
}

static uint8_t undo_turn(void) {
    if (!hist_n) return 0;
    do {
        hist_i = (hist_i - 1) & (HIST - 1);
        hist_n--;
        undo(&hist[hist_i]);
        game_ply--;
    } while (hist_n && cpu[TO_MOVE()]);  // back to a human's turn
    cur = ply ? hist[(hist_i - 1) & (HIST - 1)].to : ORIGIN;
    return 1;
}

// ---- menus and help ----

static void box(uint8_t x, uint8_t y, uint8_t w, uint8_t h) {
    uint8_t i, j;
    for (j = y; j < y + h; j++)
        for (i = x; i < x + w; i++) {
            bt[j * 20 + i] = T_BLANK;
            ba[j * 20 + i] = PAL_HUD;
        }
}

// The window covers BG rows 16-17 in game; paint them when it's hidden.
static void paint_bottom(uint8_t pal) {
    uint8_t i;
    for (i = 0; i < 40; i++) {
        bt[i] = T_BLANK;
        ba[i] = pal;
    }
    set_bkg_tiles(0, 16, 20, 2, bt);
    VBK_REG = VBK_ATTRIBUTES;
    set_bkg_tiles(0, 16, 20, 2, ba);
    VBK_REG = VBK_TILES;
}

static const char *const HELP[3][11] = {
    {"HOW TO PLAY  1/3", "", "SURROUND THE OTHER", "QUEEN ON ALL 6 SIDES", "TO WIN.", "", "PLACE A BUG NEXT TO", "YOUR OWN, AWAY FROM", "THE OTHER COLOUR.", "NEVER SPLIT THE", "HIVE IN TWO."},
    {"BUGS  2/3", "", "Q QUEEN: 1 STEP", "B BEETLE: 1 STEP,", "  CAN CLIMB ON TOP", "S SPIDER: EXACTLY 3", "G HOPPER: JUMPS OVER", "  A LINE OF BUGS", "A ANT: ANYWHERE", "  AROUND THE HIVE", ""},
    {"CONTROLS  3/3", "", "A  PICK A PIECE OR", "   SPOT, THEN GREEN", "B  CANCEL / BACK", "SELECT  NEXT SPOT", "START  MENU, UNDO", "", "QUEEN BY TURN 4.", "BUGS MOVE ONLY AFTER", "YOUR QUEEN IS DOWN."},
};

static void help_screen(void) {
    uint8_t page = 0, i;
    hide_cursor();
    HIDE_WIN;
    paint_bottom(PAL_HUD);
    while (1) {
        clear_bg();
        box(0, 0, 20, 16);
        for (i = 0; i < 11; i++) bg_text(0, 1 + i + (i > 0), HELP[page][i], PAL_HUD);
        bg_text(0, 14, page < 2 ? "A:NEXT  B:BACK" : "A/B:DONE", PAL_HUD);
        push_bg();
        do {
            vsync();
            read_input();
        } while (!(pressed & (J_A | J_B | J_START | J_LEFT | J_RIGHT)));
        if (pressed & (J_A | J_RIGHT)) {
            if (++page == 3) break;
        } else if (pressed & J_LEFT) {
            if (page) page--;
        } else {
            break;
        }
    }
}

enum { M_RESUME, M_UNDO, M_HELP, M_QUIT };
static const char *const PAUSE_ITEM[4] = {"RESUME", "UNDO MOVE", "HOW TO PLAY", "MAIN MENU"};

static uint8_t pause_menu(void) {
    uint8_t sel = 0, i;
    hide_cursor();
    while (1) {
        box(4, 3, 13, 8);
        bg_text(6, 4, "PAUSED", PAL_HUD);
        for (i = 0; i < 4; i++) bg_text(6, 6 + i, PAUSE_ITEM[i], PAL_HUD);
        bg_text(5, 6 + sel, ">", PAL_HUD);
        push_bg();
        do {
            vsync();
            read_input();
        } while (!(pressed & (J_UP | J_DOWN | J_A | J_B | J_START)));
        if (pressed & J_UP) sel = (sel + 3) & 3;
        else if (pressed & J_DOWN) sel = (sel + 1) & 3;
        else if (pressed & J_A) return sel;
        else return M_RESUME;
    }
}

// Returns 1 to leave the game for the title screen.
static uint8_t pause(void) {
    switch (pause_menu()) {
    case M_UNDO:
        if (undo_turn()) {
            begin_turn(0);
            return 0;
        }
        set_msg("NOTHING TO UNDO", 0);
        break;
    case M_HELP:
        help_screen();
        SHOW_WIN;
        break;
    case M_QUIT:
        return 1;
    }
    refresh();
    return 0;
}

static void game_loop(void) {
    Move m;
    while (1) {
        vsync();
        if (sub != S_OVER && cpu[TO_MOVE()]) {
            if (cpu[WHITE] && cpu[BLACK]) {
                read_input();
                if (pressed & (J_B | J_START)) return;  // leave the demo
            }
            set_msg(ai_level == AI_HARD ? "THINKING" : "CPU THINKING...", 0);
            draw_hud();
            bar_len = 0;
            ai_progress = 0;
            if (ai_level == AI_HARD) ai_progress = show_progress;
            ai_choose(ai_level, &m);
            do_move(&m);
            continue;
        }
        read_input();
        if (pressed & J_START) {
            if (pause()) return;
            continue;
        }
        if (sub == S_OVER) {
            if (pressed & J_A) return;
            if (pressed & J_LEFT) move_cursor(3);
            if (pressed & J_RIGHT) move_cursor(0);
            if (pressed & J_UP) move_cursor(4);
            if (pressed & J_DOWN) move_cursor(1);
            continue;
        }
        if (sub == S_PASS) {
            if (pressed & J_A) {
                m.piece = NONE;
                do_move(&m);
            }
            continue;
        }
        if (sub == S_HAND) {
            hand_input();
            continue;
        }
        if (pressed & J_LEFT) { lean = 0; move_cursor(3); }
        if (pressed & J_RIGHT) { lean = 0; move_cursor(0); }
        if (pressed & J_UP) { move_cursor(lean ? 5 : 4); lean ^= 1; }
        if (pressed & J_DOWN) { move_cursor(lean ? 1 : 2); lean ^= 1; }
        if (pressed & J_A) press_a();
        else if (pressed & J_B) cancel();
        else if (pressed & J_SELECT) jump();
    }
}

// ---- title ----

static const char *const LEVEL_NAME[3] = {"EASY  ", "NORMAL", "HARD  "};

static void draw_title(uint8_t sel) {
    uint8_t i;
    paint_bottom(PAL_BOARD);
    clear_bg();
    for (i = 0; i < 4; i++) put4(6 + 2 * i, 1, T_BIG + i * 4, PAL_BOARD);
    for (i = 0; i < NBUGS; i++) put4(1 + 4 * i, 4, T_PIECE + i * 8, (i & 1) ? PAL_BLACK : PAL_WHITE);
    bg_text(2, 8, "VS CPU: YOU WHITE", PAL_BOARD);
    bg_text(2, 9, "VS CPU: YOU BLACK", PAL_BOARD);
    bg_text(2, 10, "2 PLAYERS", PAL_BOARD);
    bg_text(2, 11, "HOW TO PLAY", PAL_BOARD);
    bg_text(2, 13, "CPU:", PAL_BOARD);
    bg_text(7, 13, LEVEL_NAME[ai_level], PAL_TARGET);
    bg_text(1, sel == 4 ? 13 : 8 + sel, ">", PAL_TARGET);
    bg_text(1, 15, sel == 4 ? "</>:CHANGE LEVEL" : "A:OK  SELECT:DEMO", PAL_BOARD);
    push_bg();
}

static uint8_t title_loop(void) {
    uint8_t sel = 0;
    HIDE_WIN;
    hide_cursor();
    draw_title(sel);
    while (1) {
        vsync();
        read_input();
        rnd8();
        if (pressed & J_UP) sel = sel ? sel - 1 : 4;
        else if (pressed & J_DOWN) sel = sel == 4 ? 0 : sel + 1;
        else if ((pressed & (J_LEFT | J_RIGHT)) && sel == 4) ai_level = (ai_level + ((pressed & J_RIGHT) ? 1 : 2)) % 3;
        else if (pressed & J_SELECT) return 3;  // CPU vs CPU demo
        else if (pressed & (J_A | J_START)) {
            if (sel < 3) return sel;
            if (sel == 3) help_screen();
            else ai_level = (ai_level + 1) % 3;
        } else continue;
        draw_title(sel);
    }
}

void main(void) {
    uint8_t mode;
    if (_cpu == CGB_TYPE) cpu_fast();
    DISPLAY_OFF;
    rules_init();
    set_bkg_palette(0, 8, bg_pal);
    set_sprite_palette(0, 1, spr_pal);
    set_bkg_data(0, N_BG_TILES, bg_tiles);
    SPRITES_8x16;
    set_sprite_data(T_CURSOR, 4, cursor_tiles);
    set_sprite_tile(0, T_CURSOR);
    set_sprite_tile(1, T_CURSOR + 2);
    move_win(7, 128);
    SHOW_BKG;
    SHOW_SPRITES;
    DISPLAY_ON;
    while (1) {
        mode = title_loop();
        rng_state ^= DIV_REG;
        cpu[WHITE] = mode == 1 || mode == 3;
        cpu[BLACK] = mode == 0 || mode == 3;
        rules_new_game();
        game_ply = 0;
        hist_n = hist_i = 0;
        cur = cam = ORIGIN;
        lean = 0;
        msg[0] = 0;
        SHOW_WIN;
        begin_turn(0);
        game_loop();
    }
}
