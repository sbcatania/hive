#include "rules.h"

uint8_t top[256];
uint8_t height[256];
uint8_t nbm[256];
uint8_t pos[NPIECES];
uint8_t level[NPIECES];
uint8_t under[NPIECES];
uint16_t ply;
uint8_t state;
uint8_t nplaced;
static uint8_t pinned_valid;  // compute_pinned() result still current

// Piece index within a colour -> bug. Q, S S, B B, G G G, A A A.
const uint8_t BUG_OF[PER_COLOR] = {QUEEN, SPIDER, SPIDER, BEETLE, BEETLE, HOPPER, HOPPER, HOPPER, ANT, ANT, ANT};
const uint8_t BUG_FIRST[NBUGS] = {0, 1, 3, 5, 8};
const uint8_t BUG_COUNT[NBUGS] = {1, 2, 2, 3, 3};

// Directions clockwise from East (pointy-top): E, SE, SW, W, NW, NE.
// d and d+3 are opposite; d-1 and d+1 are the two cells shared with NB[d].
static const uint8_t LEFT[6] = {5, 0, 1, 2, 3, 4};
static const uint8_t RIGHT[6] = {1, 2, 3, 4, 5, 0};

// Neighbour of a cell in each direction, precomputed so it lives in ROM
// rather than taking 1.5 KiB of WRAM.
const uint8_t NB[6][256] = {
    {
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x00,
        0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E, 0x1F, 0x10,
        0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D, 0x2E, 0x2F, 0x20,
        0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E, 0x3F, 0x30,
        0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F, 0x40,
        0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x5B, 0x5C, 0x5D, 0x5E, 0x5F, 0x50,
        0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F, 0x60,
        0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x7B, 0x7C, 0x7D, 0x7E, 0x7F, 0x70,
        0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8D, 0x8E, 0x8F, 0x80,
        0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9D, 0x9E, 0x9F, 0x90,
        0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xAB, 0xAC, 0xAD, 0xAE, 0xAF, 0xA0,
        0xB1, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xBB, 0xBC, 0xBD, 0xBE, 0xBF, 0xB0,
        0xC1, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xCB, 0xCC, 0xCD, 0xCE, 0xCF, 0xC0,
        0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xDB, 0xDC, 0xDD, 0xDE, 0xDF, 0xD0,
        0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xEB, 0xEC, 0xED, 0xEE, 0xEF, 0xE0,
        0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFB, 0xFC, 0xFD, 0xFE, 0xFF, 0xF0,
    },
    {
        0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E, 0x1F,
        0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D, 0x2E, 0x2F,
        0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E, 0x3F,
        0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F,
        0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x5B, 0x5C, 0x5D, 0x5E, 0x5F,
        0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F,
        0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x7B, 0x7C, 0x7D, 0x7E, 0x7F,
        0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8D, 0x8E, 0x8F,
        0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9D, 0x9E, 0x9F,
        0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xAB, 0xAC, 0xAD, 0xAE, 0xAF,
        0xB0, 0xB1, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xBB, 0xBC, 0xBD, 0xBE, 0xBF,
        0xC0, 0xC1, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xCB, 0xCC, 0xCD, 0xCE, 0xCF,
        0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xDB, 0xDC, 0xDD, 0xDE, 0xDF,
        0xE0, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xEB, 0xEC, 0xED, 0xEE, 0xEF,
        0xF0, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFB, 0xFC, 0xFD, 0xFE, 0xFF,
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
    },
    {
        0x1F, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E,
        0x2F, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D, 0x2E,
        0x3F, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E,
        0x4F, 0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E,
        0x5F, 0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x5B, 0x5C, 0x5D, 0x5E,
        0x6F, 0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E,
        0x7F, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x7B, 0x7C, 0x7D, 0x7E,
        0x8F, 0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8D, 0x8E,
        0x9F, 0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9D, 0x9E,
        0xAF, 0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xAB, 0xAC, 0xAD, 0xAE,
        0xBF, 0xB0, 0xB1, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xBB, 0xBC, 0xBD, 0xBE,
        0xCF, 0xC0, 0xC1, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xCB, 0xCC, 0xCD, 0xCE,
        0xDF, 0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xDB, 0xDC, 0xDD, 0xDE,
        0xEF, 0xE0, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xEB, 0xEC, 0xED, 0xEE,
        0xFF, 0xF0, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFB, 0xFC, 0xFD, 0xFE,
        0x0F, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E,
    },
    {
        0x0F, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E,
        0x1F, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E,
        0x2F, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D, 0x2E,
        0x3F, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E,
        0x4F, 0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E,
        0x5F, 0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x5B, 0x5C, 0x5D, 0x5E,
        0x6F, 0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E,
        0x7F, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x7B, 0x7C, 0x7D, 0x7E,
        0x8F, 0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8D, 0x8E,
        0x9F, 0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9D, 0x9E,
        0xAF, 0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xAB, 0xAC, 0xAD, 0xAE,
        0xBF, 0xB0, 0xB1, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xBB, 0xBC, 0xBD, 0xBE,
        0xCF, 0xC0, 0xC1, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xCB, 0xCC, 0xCD, 0xCE,
        0xDF, 0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xDB, 0xDC, 0xDD, 0xDE,
        0xEF, 0xE0, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xEB, 0xEC, 0xED, 0xEE,
        0xFF, 0xF0, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFB, 0xFC, 0xFD, 0xFE,
    },
    {
        0xF0, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFB, 0xFC, 0xFD, 0xFE, 0xFF,
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
        0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E, 0x1F,
        0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D, 0x2E, 0x2F,
        0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E, 0x3F,
        0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F,
        0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x5B, 0x5C, 0x5D, 0x5E, 0x5F,
        0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F,
        0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x7B, 0x7C, 0x7D, 0x7E, 0x7F,
        0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8D, 0x8E, 0x8F,
        0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9D, 0x9E, 0x9F,
        0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xAB, 0xAC, 0xAD, 0xAE, 0xAF,
        0xB0, 0xB1, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xBB, 0xBC, 0xBD, 0xBE, 0xBF,
        0xC0, 0xC1, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xCB, 0xCC, 0xCD, 0xCE, 0xCF,
        0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xDB, 0xDC, 0xDD, 0xDE, 0xDF,
        0xE0, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xEB, 0xEC, 0xED, 0xEE, 0xEF,
    },
    {
        0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFB, 0xFC, 0xFD, 0xFE, 0xFF, 0xF0,
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x00,
        0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E, 0x1F, 0x10,
        0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D, 0x2E, 0x2F, 0x20,
        0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E, 0x3F, 0x30,
        0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F, 0x40,
        0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x5B, 0x5C, 0x5D, 0x5E, 0x5F, 0x50,
        0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F, 0x60,
        0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x7B, 0x7C, 0x7D, 0x7E, 0x7F, 0x70,
        0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8D, 0x8E, 0x8F, 0x80,
        0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9D, 0x9E, 0x9F, 0x90,
        0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xAB, 0xAC, 0xAD, 0xAE, 0xAF, 0xA0,
        0xB1, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xBB, 0xBC, 0xBD, 0xBE, 0xBF, 0xB0,
        0xC1, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xCB, 0xCC, 0xCD, 0xCE, 0xCF, 0xC0,
        0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xDB, 0xDC, 0xDD, 0xDE, 0xDF, 0xD0,
        0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xEB, 0xEC, 0xED, 0xEE, 0xEF, 0xE0,
    },
};
// For a mask of occupied neighbours: the directions a ground piece can slide
// to (target empty, exactly one of the two shared neighbours occupied).
const uint8_t SLIDE[64] = {
    0, 34, 5, 36, 10, 40, 9, 40, 20, 54, 17, 48, 18, 48, 17, 48,
    40, 10, 45, 12, 34, 0, 33, 0, 36, 6, 33, 0, 34, 0, 33, 0,
    17, 18, 20, 20, 27, 24, 24, 24, 5, 6, 0, 0, 3, 0, 0, 0,
    9, 10, 12, 12, 3, 0, 0, 0, 5, 6, 0, 0, 3, 0, 0, 0,
};

// Number of bits set in a 6-bit neighbour mask.
const uint8_t POP6[64] = {
    0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4,
    1, 2, 2, 3, 2, 3, 3, 4, 2, 3, 3, 4, 3, 4, 4, 5,
    1, 2, 2, 3, 2, 3, 3, 4, 2, 3, 3, 4, 3, 4, 4, 5,
    2, 3, 3, 4, 3, 4, 4, 5, 3, 4, 4, 5, 4, 5, 5, 6,
};

// Hex distance for a cell difference packed like a cell: signed 4-bit dq in
// the low nibble, dr in the high one (see HEXDIST in rules.h).
const uint8_t HEXD[256] = {
    0, 1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1,
    1, 2, 3, 4, 5, 6, 7, 8, 8, 7, 6, 5, 4, 3, 2, 1,
    2, 3, 4, 5, 6, 7, 8, 9, 8, 7, 6, 5, 4, 3, 2, 2,
    3, 4, 5, 6, 7, 8, 9, 10, 8, 7, 6, 5, 4, 3, 3, 3,
    4, 5, 6, 7, 8, 9, 10, 11, 8, 7, 6, 5, 4, 4, 4, 4,
    5, 6, 7, 8, 9, 10, 11, 12, 8, 7, 6, 5, 5, 5, 5, 5,
    6, 7, 8, 9, 10, 11, 12, 13, 8, 7, 6, 6, 6, 6, 6, 6,
    7, 8, 9, 10, 11, 12, 13, 14, 8, 7, 7, 7, 7, 7, 7, 7,
    8, 8, 8, 8, 8, 8, 8, 8, 16, 15, 14, 13, 12, 11, 10, 9,
    7, 7, 7, 7, 7, 7, 7, 7, 15, 14, 13, 12, 11, 10, 9, 8,
    6, 6, 6, 6, 6, 6, 6, 7, 14, 13, 12, 11, 10, 9, 8, 7,
    5, 5, 5, 5, 5, 5, 6, 7, 13, 12, 11, 10, 9, 8, 7, 6,
    4, 4, 4, 4, 4, 5, 6, 7, 12, 11, 10, 9, 8, 7, 6, 5,
    3, 3, 3, 3, 4, 5, 6, 7, 11, 10, 9, 8, 7, 6, 5, 4,
    2, 2, 2, 3, 4, 5, 6, 7, 10, 9, 8, 7, 6, 5, 4, 3,
    1, 1, 2, 3, 4, 5, 6, 7, 9, 8, 7, 6, 5, 4, 3, 2,
};

// Lowest set bit of a nonzero 6-bit mask.
static const uint8_t LOWD[64] = {
    0, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
    5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0,
};

// Visited marks: a cell is marked when seen[c] == st, where st is the value
// clear_seen() returned, so clearing is usually a single increment. (Keep st
// in a local: SDCC 4.5 miscompiled `seen[c] = stamp` right after comparing
// seen[c] with the global.) Stamps stay at 64 and up, so compute_pinned() can
// borrow the array for its discovery times (all below 64) without ever
// faking a mark.
static uint8_t seen[256], stamp = 64;
#define pdisc seen
#define SEEN(c) (seen[c] == st)
#define MARK(c) (seen[c] = st)

static uint8_t clear_seen(void) {
    uint8_t i = 0;
    if (++stamp) return stamp;
    do seen[i] = 0; while (++i);
    return stamp = 64;
}

static Move *out_p;
static uint16_t out_n;
// Optional destination filter: 1 = only `to == gen_target`, 2 = only
// destinations within one cell of gen_target.
static uint8_t gen_filter, gen_target;
uint16_t gen_cap = MAX_MOVES;

static void add(uint8_t piece, uint8_t from, uint8_t to) {
    Move *m;
    if (out_n >= gen_cap) return;
    if (gen_filter) {
        if (gen_filter == 1) {
            if (to != gen_target) return;
        } else if (HEXDIST(to, gen_target) > 1) {
            return;
        }
    }
    m = out_p++;
    m->piece = piece;
    m->from = from;
    m->to = to;
    out_n++;
}

void rules_init(void) {}

void rules_new_game(void) {
    uint8_t c = 0, p;
    do {
        top[c] = NONE;
        height[c] = 0;
        nbm[c] = 0;
        seen[c] = 0;
    } while (++c);
    stamp = 64;
    for (p = 0; p < NPIECES; p++) {
        level[p] = NONE;
        under[p] = NONE;
        pos[p] = 0;
    }
    ply = 0;
    nplaced = 0;
    state = PLAYING;
    pinned_valid = 0;
}

// Keep nbm in step when a cell becomes occupied or empty.
static void occ_on(uint8_t c) {
    nbm[NB[0][c]] |= 8;
    nbm[NB[1][c]] |= 16;
    nbm[NB[2][c]] |= 32;
    nbm[NB[3][c]] |= 1;
    nbm[NB[4][c]] |= 2;
    nbm[NB[5][c]] |= 4;
}

static void occ_off(uint8_t c) {
    nbm[NB[0][c]] &= ~8;
    nbm[NB[1][c]] &= ~16;
    nbm[NB[2][c]] &= ~32;
    nbm[NB[3][c]] &= ~1;
    nbm[NB[4][c]] &= ~2;
    nbm[NB[5][c]] &= ~4;
}

static void put(uint8_t p, uint8_t c) {
    under[p] = top[c];
    level[p] = height[c];
    if (!height[c]) occ_on(c);
    top[c] = p;
    height[c]++;
    pos[p] = c;
}

static void lift(uint8_t p) {
    uint8_t c = pos[p];
    top[c] = under[p];
    if (!--height[c]) occ_off(c);
    level[p] = NONE;
}

uint8_t queen_neighbors(uint8_t color) {
    uint8_t q = QUEEN_OF(color);
    if (IN_HAND(q)) return 0;
    return POP6[nbm[pos[q]]];
}

static void update_state(void) {
    uint8_t w = queen_neighbors(WHITE) == 6;
    uint8_t b = queen_neighbors(BLACK) == 6;
    if (w && b) state = DRAW;
    else if (w) state = BLACK_WINS;
    else if (b) state = WHITE_WINS;
    else state = PLAYING;
}

void play(const Move *m) {
    uint8_t p = m->piece;
    pinned_valid = 0;
    if (p != NONE) {
        p &= ~MV_PLACE;
        if (!(m->piece & MV_PLACE)) lift(p);
        else nplaced++;
        put(p, m->to);
    }
    ply++;
    update_state();
}

void undo(const Move *m) {
    uint8_t p = m->piece;
    pinned_valid = 0;
    if (p != NONE) {
        p &= ~MV_PLACE;
        lift(p);
        if (!(m->piece & MV_PLACE)) put(p, m->from);
        else nplaced--;
    }
    ply--;
    state = PLAYING;
}

uint8_t next_in_hand(uint8_t color, uint8_t bug) {
    uint8_t p = (color ? PER_COLOR : 0) + BUG_FIRST[bug];
    uint8_t end = p + BUG_COUNT[bug];
    for (; p < end; p++)
        if (IN_HAND(p)) return p;
    return NONE;
}

uint8_t hand_count(uint8_t color, uint8_t bug) {
    uint8_t p = (color ? PER_COLOR : 0) + BUG_FIRST[bug];
    uint8_t end = p + BUG_COUNT[bug], n = 0;
    for (; p < end; p++)
        if (IN_HAND(p)) n++;
    return n;
}

// ---- One Hive: articulation points of the ground-level graph ----

static uint8_t ncells;
uint8_t pinned[256];
// Tarjan's articulation points over the ground cells, iterative. Indexed by
// cell; pdisc/plow are only meaningful for occupied cells. Each stack frame
// is {cell, parent cell, neighbours still to visit}.
static uint8_t plow[256];  // pdisc is seen[], see above
static uint8_t pstk[NPIECES * 3], ptimer, prc;

#ifdef __SDCC
// Hand-written SM83 version of the C code below (about 3x faster than what
// SDCC makes of it).
static uint8_t pin_last;

static void pin_all(void) __naked {
    __asm
    ; reset the ground cells, count them, remember the last one
    ld hl, #_level
    ld de, #_pos
    ld b, #22
    ld c, #0
30$:
    ld a, (hl+)
    or a, a
    jr nz, 31$
    ld a, (de)
    ld (_pin_last), a
    push hl
    add a, #<(_seen)
    ld l, a
    ld a, #>(_seen)
    adc a, #0
    ld h, a
    ld (hl), #0
    ld a, (_pin_last)
    add a, #<(_pinned)
    ld l, a
    ld a, #>(_pinned)
    adc a, #0
    ld h, a
    ld (hl), #0
    pop hl
    inc c
31$:
    inc de
    dec b
    jr nz, 30$
    ld a, c
    ld (_ncells), a
    cp a, #3
    ret c
    ; root = last ground cell: pdisc = plow = 1, frame {root, root, nbm}
    ld a, (_pin_last)
    ld c, a
    add a, #<(_seen)
    ld l, a
    ld a, #>(_seen)
    adc a, #0
    ld h, a
    ld (hl), #1
    ld a, c
    add a, #<(_plow)
    ld l, a
    ld a, #>(_plow)
    adc a, #0
    ld h, a
    ld (hl), #1
    ld a, #2
    ld (_ptimer), a
    xor a, a
    ld (_prc), a
    ld a, c
    add a, #<(_nbm)
    ld l, a
    ld a, #>(_nbm)
    adc a, #0
    ld h, a
    ld b, (hl)
    ld hl, #_pstk
    ld (hl), c
    inc hl
    ld (hl), c
    inc hl
    ld (hl), b
    ld de, #_pstk
1$:
    ; b = u, frame m at (hl)
    ld h, d
    ld l, e
    ld b, (hl)
    inc hl
    inc hl
    ld a, (hl)
    or a, a
    jp z, 20$
    ld c, a
    dec a
    and a, c
    ld (hl), a
    ; a = LOWD[m]
    ld a, c
    add a, #<(_LOWD)
    ld l, a
    ld a, #>(_LOWD)
    adc a, #0
    ld h, a
    ld a, (hl)
    ; c = v = NB[dir][u]
    add a, #>(_NB)
    ld h, a
    ld a, b
    add a, #<(_NB)
    ld l, a
    jr nc, 2$
    inc h
2$:
    ld c, (hl)
    ; hl = &pdisc[v]
    ld a, c
    add a, #<(_seen)
    ld l, a
    ld a, #>(_seen)
    adc a, #0
    ld h, a
    ld a, (hl)
    or a, a
    jp nz, 10$
    ; unvisited. A leaf (v touches only u) needs no frame: it makes u a
    ; cut vertex, or another child of the root.
    ld a, c
    add a, #<(_nbm)
    ld l, a
    ld a, #>(_nbm)
    adc a, #0
    ld h, a
    ld a, (hl)
    add a, #<(_POP6)
    ld l, a
    ld a, #>(_POP6)
    adc a, #0
    ld h, a
    ld a, (hl)
    dec a
    jr nz, 4$
    ld a, e
    cp a, #<(_pstk)
    jr nz, 5$
    ld a, d
    cp a, #>(_pstk)
    jr nz, 5$
    ld hl, #_prc
    inc (hl)
    jp 1$
5$:
    ld a, b
    add a, #<(_pinned)
    ld l, a
    ld a, #>(_pinned)
    adc a, #0
    ld h, a
    ld (hl), #1
    jp 1$
4$:
    ld a, c
    add a, #<(_seen)
    ld l, a
    ld a, #>(_seen)
    adc a, #0
    ld h, a
    ; tree edge; count the children of the root
    ld a, e
    cp a, #<(_pstk)
    jr nz, 3$
    ld a, d
    cp a, #>(_pstk)
    jr nz, 3$
    ld a, (_prc)
    inc a
    ld (_prc), a
3$:
    ; pdisc[v] = plow[v] = ptimer++
    ld a, (_ptimer)
    ld (hl), a
    inc a
    ld (_ptimer), a
    dec a
    push af
    ld a, c
    add a, #<(_plow)
    ld l, a
    ld a, #>(_plow)
    adc a, #0
    ld h, a
    pop af
    ld (hl), a
    ; push frame {v, u, nbm[v]}
    inc de
    inc de
    inc de
    ld a, c
    add a, #<(_nbm)
    ld l, a
    ld a, #>(_nbm)
    adc a, #0
    ld h, a
    ld a, (hl)
    ld h, d
    ld l, e
    ld (hl), c
    inc hl
    ld (hl), b
    inc hl
    ld (hl), a
    jp 1$
10$:
    ; back edge: if v != parent && pdisc[v] < plow[u]: plow[u] = pdisc[v]
    push af
    ld h, d
    ld l, e
    inc hl
    ld a, (hl)
    cp a, c
    jr z, 11$
    ld a, b
    add a, #<(_plow)
    ld l, a
    ld a, #>(_plow)
    adc a, #0
    ld h, a
    pop af
    cp a, (hl)
    jp nc, 1$
    ld (hl), a
    jp 1$
11$:
    pop af
    jp 1$
20$:
    ; frame done. Root? Then it is pinned iff it had 2+ DFS children.
    ld a, e
    cp a, #<(_pstk)
    jr nz, 21$
    ld a, d
    cp a, #>(_pstk)
    jr nz, 21$
    ld a, (_prc)
    cp a, #2
    ret c
    ld a, b
    add a, #<(_pinned)
    ld l, a
    ld a, #>(_pinned)
    adc a, #0
    ld h, a
    ld (hl), #1
    ret
21$:
    dec de
    dec de
    dec de
    ld a, (de)
    ld c, a
    ; b = plow[u]
    ld a, b
    add a, #<(_plow)
    ld l, a
    ld a, #>(_plow)
    adc a, #0
    ld h, a
    ld b, (hl)
    ; plow[p] = min(plow[p], plow[u])
    ld a, c
    add a, #<(_plow)
    ld l, a
    ld a, #>(_plow)
    adc a, #0
    ld h, a
    ld a, b
    cp a, (hl)
    jr nc, 22$
    ld (hl), a
22$:
    ; parent not the root and plow[u] >= pdisc[p]: p is pinned
    ld a, e
    cp a, #<(_pstk)
    jr nz, 23$
    ld a, d
    cp a, #>(_pstk)
    jp z, 1$
23$:
    ld a, c
    add a, #<(_seen)
    ld l, a
    ld a, #>(_seen)
    adc a, #0
    ld h, a
    ld a, b
    cp a, (hl)
    jp c, 1$
    ld a, c
    add a, #<(_pinned)
    ld l, a
    ld a, #>(_pinned)
    adc a, #0
    ld h, a
    ld (hl), #1
    jp 1$
    __endasm;
}
#else
static void pin_all(void) {
    uint8_t *f = pstk, u, v, m, p, c = 0;
    ncells = 0;
    for (p = 0; p < NPIECES; p++) {
        if (level[p] == 0) {
            c = pos[p];
            pdisc[c] = 0;
            pinned[c] = 0;
            ncells++;
        }
    }
    if (ncells <= 2) return;
    pdisc[c] = plow[c] = 1;
    ptimer = 2;
    prc = 0;
    pstk[0] = c;
    pstk[1] = c;
    pstk[2] = nbm[c];
    for (;;) {
        u = f[0];
        m = f[2];
        if (m) {
            f[2] = m & (m - 1);
            v = NB[LOWD[m]][u];
            if (!pdisc[v] && POP6[nbm[v]] == 1) {
                // A leaf hanging off u alone: no frame needed.
                if (f == pstk) prc++;
                else pinned[u] = 1;
            } else if (!pdisc[v]) {
                if (f == pstk) prc++;
                pdisc[v] = plow[v] = ptimer++;
                f += 3;
                f[0] = v;
                f[1] = u;
                f[2] = nbm[v];
            } else if (v != f[1] && pdisc[v] < plow[u]) {
                plow[u] = pdisc[v];
            }
        } else {
            if (f == pstk) {
                if (prc > 1) pinned[u] = 1;
                return;
            }
            f -= 3;
            p = f[0];
            if (plow[u] < plow[p]) plow[p] = plow[u];
            if (f != pstk && plow[u] >= pdisc[p]) pinned[p] = 1;
        }
    }
}
#endif

void compute_pinned(void) {
    if (pinned_valid) return;
    pinned_valid = 1;
    pin_all();
}

uint8_t is_pinned_cell(uint8_t cell) {
    return pinned[cell];
}

// ---- Movement ----

// Beetle step; `cur` is the height left behind at `from`.
static uint8_t can_climb(uint8_t from, uint8_t d, uint8_t cur) {
    uint8_t ht = height[NB[d][from]];
    uint8_t hl = height[NB[LEFT[d]][from]];
    uint8_t hr = height[NB[RIGHT[d]][from]];
    uint8_t lo = hl < hr ? hl : hr;
    uint8_t hi = cur > ht ? cur : ht;
    if (!cur && !ht && !hl && !hr) return 0;
    return lo <= hi;
}

static uint8_t queue[64];

#ifdef __SDCC
// SM83 version of the C breadth-first search below (the ants' moves are the
// biggest part of move generation).
static uint8_t ab_p, ab_from, ab_to, ab_st, ab_qh, ab_qt;

static void add_ab(void) {
    add(ab_p, ab_from, ab_to);
}

static void gen_ant(uint8_t p, uint8_t from) __naked {
    (void)p;
    (void)from;
    __asm
    ld (_ab_p), a
    ld a, e
    ld (_ab_from), a
    call _clear_seen
    ld (_ab_st), a
    ld b, a
    ld a, (_ab_from)
    ld (_queue), a
    add a, #<(_seen)
    ld l, a
    ld a, #>(_seen)
    adc a, #0
    ld h, a
    ld (hl), b
    xor a, a
    ld (_ab_qh), a
    inc a
    ld (_ab_qt), a
1$:
    ; next queued cell c, with m = directions it can slide to
    ld hl, #_ab_qh
    ld a, (_ab_qt)
    cp a, (hl)
    ret z
    ld a, (hl)
    inc (hl)
    add a, #<(_queue)
    ld l, a
    ld a, #>(_queue)
    adc a, #0
    ld h, a
    ld c, (hl)
    ld a, c
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
    ld d, (hl)
    ld e, #>(_NB)
2$:
    ld a, d
    or a, a
    jr z, 1$
    srl d
    jr nc, 5$
    ; b = to = NB[dir][c]
    ld a, c
    add a, #<(_NB)
    ld l, a
    ld a, e
    adc a, #0
    ld h, a
    ld b, (hl)
    ld a, b
    add a, #<(_seen)
    ld l, a
    ld a, #>(_seen)
    adc a, #0
    ld h, a
    ld a, (_ab_st)
    cp a, (hl)
    jr z, 5$
    ld (hl), a
    ld hl, #_ab_qt
    ld a, (hl)
    inc (hl)
    add a, #<(_queue)
    ld l, a
    ld a, #>(_queue)
    adc a, #0
    ld h, a
    ld (hl), b
    ld a, (_gen_filter)
    or a, a
    jr nz, 4$
    ; add(p, from, to) inline, unless the buffer is full
    ld a, (_out_n)
    ld hl, #_gen_cap
    sub a, (hl)
    inc hl
    ld a, (_out_n + 1)
    sbc a, (hl)
    jr nc, 5$
    ld hl, #_out_p
    ld a, (hl+)
    ld h, (hl)
    ld l, a
    ld a, (_ab_p)
    ld (hl+), a
    ld a, (_ab_from)
    ld (hl+), a
    ld (hl), b
    inc hl
    ld a, l
    ld (_out_p), a
    ld a, h
    ld (_out_p + 1), a
    ld hl, #_out_n
    inc (hl)
    jr nz, 5$
    inc hl
    inc (hl)
    jr 5$
4$:
    ld a, b
    ld (_ab_to), a
    push bc
    push de
    call _add_ab
    pop de
    pop bc
5$:
    inc e
    jr 2$
    __endasm;
}
#else
static void gen_ant(uint8_t p, uint8_t from) {
    uint8_t qh = 0, qt = 0, c, d, m, to, st;
    st = clear_seen();
    MARK(from);
    queue[qt++] = from;
    while (qh < qt) {
        c = queue[qh++];
        m = SLIDE[nbm[c]];
        for (d = 0; m; d++, m >>= 1) {
            if (!(m & 1)) continue;
            to = NB[d][c];
            if (SEEN(to)) continue;
            MARK(to);
            add(p, from, to);
            queue[qt++] = to;
        }
    }
}
#endif

static void gen_spider(uint8_t p, uint8_t from) {
    uint8_t d1, d2, d3, c1, c2, c3, m1, m2, m3, st;
    st = clear_seen();
    m1 = SLIDE[nbm[from]];
    for (d1 = 0; m1; d1++, m1 >>= 1) {
        if (!(m1 & 1)) continue;
        c1 = NB[d1][from];
        m2 = SLIDE[nbm[c1]];
        for (d2 = 0; m2; d2++, m2 >>= 1) {
            if (!(m2 & 1)) continue;
            c2 = NB[d2][c1];
            if (c2 == from) continue;
            m3 = SLIDE[nbm[c2]];
            for (d3 = 0; m3; d3++, m3 >>= 1) {
                if (!(m3 & 1)) continue;
                c3 = NB[d3][c2];
                if (c3 == c1 || c3 == from || SEEN(c3)) continue;
                MARK(c3);
                add(p, from, c3);
            }
        }
    }
}

static void gen_piece(uint8_t p) {
    uint8_t from = pos[p], d, to, m, bug = BUGOF(p);
    if (level[p] == 0 && is_pinned_cell(from)) return;
    if (bug == BEETLE) {
        for (d = 0; d < 6; d++)
            if (can_climb(from, d, height[from] - 1)) add(p, from, NB[d][from]);
        return;
    }
    if (bug == HOPPER) {
        m = nbm[from];
        for (d = 0; m; d++, m >>= 1) {
            if (!(m & 1)) continue;
            to = NB[d][NB[d][from]];
            while (height[to]) to = NB[d][to];
            add(p, from, to);
        }
        return;
    }
    // Queen, Spider and Ant slide on the ground: take the mover off first.
    height[from] = 0;
    occ_off(from);
    if (bug == QUEEN) {
        m = SLIDE[nbm[from]];
        for (d = 0; m; d++, m >>= 1)
            if (m & 1) add(p, from, NB[d][from]);
    } else if (bug == SPIDER) {
        gen_spider(p, from);
    } else {
        gen_ant(p, from);
    }
    height[from] = 1;
    occ_on(from);
}

static void gen_placements(uint8_t color) {
    uint8_t types[NBUGS], nt = 0, bug, p, i, j, d, c, end, st;
    uint8_t turn = (uint8_t)((color == WHITE ? (ply + 1) / 2 : ply / 2) + 1);
    uint8_t queen_in_hand = IN_HAND(QUEEN_OF(color));
    uint8_t must_queen = turn >= 4 && queen_in_hand;

    for (bug = 0; bug < NBUGS; bug++) {
        if (bug == QUEEN && turn == 1) continue;  // tournament opening
        if (must_queen && bug != QUEEN) continue;
        p = next_in_hand(color, bug);
        if (p != NONE) types[nt++] = p | MV_PLACE;
    }
    if (!nt) return;

    if (ply == 0) {
        for (i = 0; i < nt; i++) add(types[i], 0, ORIGIN);
        return;
    }
    if (ply == 1) {
        for (i = 0; i < nt; i++)
            for (d = 0; d < 6; d++) add(types[i], 0, NB[d][ORIGIN]);
        return;
    }
    // Mark every cell touching an enemy piece, then collect the empty cells
    // around our own pieces that are not marked (marking them as we go).
    st = clear_seen();
    p = color ? 0 : PER_COLOR;
    for (end = p + PER_COLOR; p < end; p++) {
        if (IN_HAND(p) || top[pos[p]] != p) continue;
        c = pos[p];
        for (d = 0; d < 6; d++) MARK(NB[d][c]);
    }
    p = color ? PER_COLOR : 0;
    for (end = p + PER_COLOR; p < end; p++) {
        if (IN_HAND(p) || top[pos[p]] != p) continue;
        for (d = 0; d < 6; d++) {
            c = NB[d][pos[p]];
            if (height[c] || SEEN(c)) continue;
            MARK(c);
            for (j = 0; j < nt; j++) add(types[j], 0, c);
        }
    }
}

// The 16x16 torus is only safe while the hive (plus the two rings of cells
// around it that move generation looks at) fits in 16 cells along q and r.
// Real games rarely get near that, so instead of a bigger board we drop the
// moves that would stretch the hive past 12 cells. The host test builds with
// NO_SPAN_LIMIT to compare against the reference engine's random games.
//
// The hive is connected, so the columns (q) it occupies form one run around
// the torus, and so do its rows (r). Every destination is next to a piece,
// so a move can only stretch a run by one: it matters only when a run is
// already 12 long, and then the destination must stay inside it.
#define MAX_SPAN 12

static Move *out_start;

#ifndef NO_SPAN_LIMIT
static uint8_t okq[16], okr[16];

static void limit_span(void) {
    uint8_t p, x, nq = 0, nr = 0;
    uint16_t i;
    Move *src, *dst;
    for (x = 0; x < 16; x++) okq[x] = okr[x] = 0;
    for (p = 0; p < NPIECES; p++) {
        if (IN_HAND(p)) continue;
        x = pos[p];
        if (!okq[x & 15]) okq[x & 15] = 1, nq++;
        if (!okr[x >> 4]) okr[x >> 4] = 1, nr++;
    }
    if (nq < MAX_SPAN && nr < MAX_SPAN) return;
    if (nq < MAX_SPAN)
        for (x = 0; x < 16; x++) okq[x] = 1;
    if (nr < MAX_SPAN)
        for (x = 0; x < 16; x++) okr[x] = 1;
    src = dst = out_start;
    for (i = out_n; i; i--, src++) {
        x = src->to;
        if (!okq[x & 15] || !okr[x >> 4]) continue;
        if (dst != src) *dst = *src;
        dst++;
    }
    out_n = (uint16_t)(dst - out_start);
    out_p = dst;
}

#endif

// For the "near" filter: can piece p possibly end within one cell of
// gen_target? Cheap distance bounds; false only when it certainly cannot.
static uint8_t may_reach_near(uint8_t p) {
    uint8_t c = pos[p], d = HEXDIST(c, gen_target), bug = BUGOF(p), m, i;
    if (bug == QUEEN || bug == BEETLE) return d <= 2;
    if (bug == SPIDER) return d <= 4;
    if (bug == ANT && d > 2) {
        // An ant ends on an empty cell it slid into; if no empty cell next
        // to the target can be slid into, it cannot get there. (Its own
        // cell is too far away to change that.)
        m = nbm[gen_target];
        for (i = 0; i < 6; i++, m >>= 1)
            if (!(m & 1) && SLIDE[nbm[NB[i][gen_target]]]) return 1;
        return 0;
    }
    return 1;
}
uint16_t gen_moves(Move *out) {
    uint8_t color = TO_MOVE(), p, end;
    out_start = out_p = out;
    out_n = 0;
    if (state != PLAYING) return 0;
    // With the "near" filter on a cell topped by an enemy piece, every cell
    // it accepts touches that piece, so no placement can pass (after the
    // second move of the game, which may touch).
    if (gen_filter != 2 || ply < 2 || top[gen_target] == NONE || COLOR_OF(top[gen_target]) == color)
        gen_placements(color);
    if (!IN_HAND(QUEEN_OF(color))) {
        compute_pinned();
        p = color ? PER_COLOR : 0;
        for (end = p + PER_COLOR; p < end; p++) {
            if (IN_HAND(p) || top[pos[p]] != p) continue;
            if (gen_filter == 2 && !may_reach_near(p)) continue;
            gen_piece(p);
        }
    }
#ifndef NO_SPAN_LIMIT
    limit_span();
#endif
    if (!out_n) add(NONE, 0, 0);
    return out_n;
}

uint8_t gen_moves_to(Move *out, uint8_t cell) {
    uint8_t n;
    gen_filter = 1;
    gen_target = cell;
    gen_moves(out);
    gen_filter = 0;
    n = (uint8_t)out_n;
    if (n && out->piece == NONE) n = 0;
    return n;
}

uint8_t gen_moves_near(Move *out, uint8_t cell) {
    uint8_t n;
    gen_filter = 2;
    gen_target = cell;
    gen_moves(out);
    gen_filter = 0;
    n = (uint8_t)out_n;
    if (n && out->piece == NONE) n = 0;
    return n;
}
