/// One Hive Rule: all pieces must remain connected as a single group.
///
/// Before moving a piece, we must verify that removing it from its current
/// position doesn't split the hive into two or more disconnected groups.
///
/// We use articulation point detection: a piece is an articulation point if
/// removing it disconnects the graph. Only non-articulation points can move.

use std::collections::{HashMap, HashSet};
use crate::board::{Board, Coord, neighbors};

/// Check if removing the piece at `coord` would break the One Hive Rule.
/// Returns `true` if the piece CAN be removed (hive stays connected).
/// Returns `false` if removing it would split the hive.
///
/// For pieces on top of a stack (beetles), this always returns true
/// because the piece below keeps the position occupied.
pub fn can_remove(board: &Board, coord: Coord) -> bool {
    // If there's a stack > 1, removing the top piece won't disconnect anything.
    if board.stack_height(coord) > 1 {
        return true;
    }

    // Get all occupied positions except the one we're removing.
    let occupied: HashSet<Coord> = board
        .occupied_coords()
        .into_iter()
        .filter(|&c| c != coord)
        .collect();

    // If no other pieces, nothing to disconnect.
    if occupied.is_empty() {
        return true;
    }

    // BFS/DFS from any remaining piece. If we can reach all others, it's connected.
    let start = *occupied.iter().next().unwrap();
    let reachable = flood_fill(start, &occupied);

    reachable.len() == occupied.len()
}

/// Simple flood fill to find all reachable positions from `start`
/// within the set of `occupied` positions.
fn flood_fill(start: Coord, occupied: &HashSet<Coord>) -> HashSet<Coord> {
    let mut visited = HashSet::new();
    let mut stack = vec![start];

    while let Some(coord) = stack.pop() {
        if !visited.insert(coord) {
            continue;
        }
        for neighbor in neighbors(coord) {
            if occupied.contains(&neighbor) && !visited.contains(&neighbor) {
                stack.push(neighbor);
            }
        }
    }

    visited
}

/// Find all articulation points in the hive at once.
/// This is more efficient than calling `can_remove` for every piece
/// when we need to know which pieces can move.
///
/// Uses Tarjan's algorithm adapted for the hex grid.
pub fn find_articulation_points(board: &Board) -> HashSet<Coord> {
    let occupied: Vec<Coord> = board.occupied_coords().into_iter().collect();
    if occupied.len() <= 1 {
        return HashSet::new(); // 0 or 1 piece can't be articulation points
    }

    let mut disc = HashMap::new();
    let mut low = HashMap::new();
    let mut parent = HashMap::new();
    let mut ap = HashSet::new();
    let mut time = 0u32;

    // Only consider single-height positions (stacked positions are never articulation points).
    let single_occupied: HashSet<Coord> = occupied
        .iter()
        .filter(|&&c| board.stack_height(c) == 1)
        .cloned()
        .collect();

    let all_occupied: HashSet<Coord> = board.occupied_coords();

    for &start in &occupied {
        if disc.contains_key(&start) {
            continue;
        }
        tarjan_dfs(
            start,
            &all_occupied,
            &single_occupied,
            &mut disc,
            &mut low,
            &mut parent,
            &mut ap,
            &mut time,
        );
    }

    ap
}

/// DFS step of Tarjan's articulation point algorithm.
fn tarjan_dfs(
    u: Coord,
    all_occupied: &HashSet<Coord>,
    single_occupied: &HashSet<Coord>,
    disc: &mut HashMap<Coord, u32>,
    low: &mut HashMap<Coord, u32>,
    parent: &mut HashMap<Coord, Option<Coord>>,
    ap: &mut HashSet<Coord>,
    time: &mut u32,
) {
    disc.insert(u, *time);
    low.insert(u, *time);
    *time += 1;
    if !parent.contains_key(&u) {
        parent.insert(u, None);
    }

    let mut child_count = 0;

    for neighbor in neighbors(u) {
        if !all_occupied.contains(&neighbor) {
            continue;
        }

        if !disc.contains_key(&neighbor) {
            child_count += 1;
            parent.insert(neighbor, Some(u));
            tarjan_dfs(neighbor, all_occupied, single_occupied, disc, low, parent, ap, time);

            // Update low value.
            let low_neighbor = *low.get(&neighbor).unwrap();
            let low_u = low.get_mut(&u).unwrap();
            if low_neighbor < *low_u {
                *low_u = low_neighbor;
            }

            // u is an articulation point if:
            // 1) u is root of DFS tree and has 2+ children
            // 2) u is not root and low[neighbor] >= disc[u]
            let is_root = parent.get(&u) == Some(&None);
            let disc_u = *disc.get(&u).unwrap();
            if is_root && child_count > 1 && single_occupied.contains(&u) {
                ap.insert(u);
            }
            if !is_root && low_neighbor >= disc_u && single_occupied.contains(&u) {
                ap.insert(u);
            }
        } else if parent.get(&u).and_then(|p| *p) != Some(neighbor) {
            // Back edge — update low value.
            // (Only if neighbor is not the direct parent.)
            let disc_neighbor = *disc.get(&neighbor).unwrap();
            let low_u = low.get_mut(&u).unwrap();
            if disc_neighbor < *low_u {
                *low_u = disc_neighbor;
            }
        }
    }
}
