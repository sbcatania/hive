//! Unwrapped (planar) coordinates for cells on the torus grid.
//!
//! Occupied cells are unwrapped by walking the hive from the occupied cell
//! closest to the origin; empty cells get coordinates from an occupied
//! neighbour. Used for display and for the neural-network input frame.

use crate::game::Game;
use crate::hex::*;

pub struct Layout {
    known: Vec<bool>,
    coords: Vec<(i32, i32)>,
    pub occupied: Vec<Cell>,
}

impl Layout {
    pub fn new(g: &Game) -> Layout {
        let mut known = vec![false; CELLS];
        let mut coords = vec![(0, 0); CELLS];
        let occupied = g.occupied_cells();
        if let Some(&anchor) = occupied.iter().min_by_key(|&&c| {
            let (q, r) = signed_coords(c);
            q.abs() + r.abs() + (q + r).abs()
        }) {
            known[anchor as usize] = true;
            coords[anchor as usize] = signed_coords(anchor);
            let mut stack = vec![anchor];
            while let Some(c) = stack.pop() {
                let (q, r) = coords[c as usize];
                for (d, &n) in neighbors(c).iter().enumerate() {
                    if g.occupied(n) && !known[n as usize] {
                        known[n as usize] = true;
                        coords[n as usize] = (q + DIRS[d].0, r + DIRS[d].1);
                        stack.push(n);
                    }
                }
            }
        }
        Layout { known, coords, occupied }
    }

    /// Planar coordinates of `c` (occupied, or adjacent to an occupied cell).
    pub fn coords(&self, c: Cell) -> (i32, i32) {
        if self.known[c as usize] {
            return self.coords[c as usize];
        }
        for (d, &n) in neighbors(c).iter().enumerate() {
            if self.known[n as usize] {
                let (q, r) = self.coords[n as usize];
                // n is in direction d from c, so c = n - DIRS[d].
                return (q - DIRS[d].0, r - DIRS[d].1);
            }
        }
        signed_coords(c)
    }

    /// Centre of the occupied cells' bounding box.
    pub fn center(&self) -> (i32, i32) {
        if self.occupied.is_empty() {
            return (0, 0);
        }
        let (mut minq, mut maxq, mut minr, mut maxr) = (i32::MAX, i32::MIN, i32::MAX, i32::MIN);
        for &c in &self.occupied {
            let (q, r) = self.coords[c as usize];
            minq = minq.min(q);
            maxq = maxq.max(q);
            minr = minr.min(r);
            maxr = maxr.max(r);
        }
        ((minq + maxq).div_euclid(2), (minr + maxr).div_euclid(2))
    }
}
