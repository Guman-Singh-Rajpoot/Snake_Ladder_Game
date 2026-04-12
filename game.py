"""
game.py — Core game logic for Snakes & Ladders
Handles: player position, dice rolls, snakes, ladders, win detection, BFS
"""

import random
from collections import deque


# ---------------------------------------------------------------------------
# Board Configuration
# ---------------------------------------------------------------------------

# Snakes: {head: tail}  — landing on the head sends you DOWN to the tail
SNAKES = {
    99: 21,
    95: 75,
    87: 24,
    62: 19,
    54: 34,
    46: 5,
    17: 7,
}

# Ladders: {bottom: top}  — landing on the bottom sends you UP to the top
LADDERS = {
    4:  25,
    13: 46,
    33: 49,
    42: 63,
    50: 69,
    62: 81,   # note: 62 is also a snake head — snake takes priority in our logic
    74: 92,
    85: 95,
}

# Build a combined teleport map (used by BFS and movement)
# Snakes take priority over ladders on the same cell
def build_teleport_map():
    teleport = {}
    for bottom, top in LADDERS.items():
        teleport[bottom] = top
    for head, tail in SNAKES.items():
        teleport[head] = tail  # snake overrides ladder on same cell
    return teleport

TELEPORT = build_teleport_map()


# ---------------------------------------------------------------------------
# Game State
# ---------------------------------------------------------------------------

class SnakesAndLaddersGame:
    """Encapsulates the state and logic of a single-player Snakes & Ladders game."""

    def __init__(self):
        self.reset()

    def reset(self):
        """Reset the game to its initial state."""
        self.position = 0        # 0 = "off board" (game not started)
        self.status = "playing"  # "playing" | "win"
        self.total_rolls = 0
        self.snakes_hit = 0
        self.ladders_used = 0
        self.history = []        # list of move records

    def roll_dice(self):
        """Roll a six-sided die and return the result."""
        return random.randint(1, 6)

    def move(self):
        """
        Roll the dice, update the player position, apply snake/ladder rules,
        check win condition, and return the full result dict.
        """
        if self.status == "win":
            return self._state_dict()

        dice = self.roll_dice()
        self.total_rolls += 1

        old_position = self.position
        new_position = self.position + dice

        # Rule: cannot move beyond cell 100 — stay in place
        if new_position > 100:
            self.history.append({
                "roll": dice,
                "from": old_position,
                "to": old_position,
                "event": "blocked"
            })
            return {**self._state_dict(), "dice": dice, "blocked": True}

        self.position = new_position
        event = "normal"

        # Apply snake or ladder if this cell has one
        if new_position in TELEPORT:
            destination = TELEPORT[new_position]
            if destination > new_position:
                event = "ladder"
                self.ladders_used += 1
            else:
                event = "snake"
                self.snakes_hit += 1
            self.position = destination

        # Win condition
        if self.position == 100:
            self.status = "win"
            event = "win"

        self.history.append({
            "roll": dice,
            "from": old_position,
            "to": self.position,
            "event": event
        })

        return {
            **self._state_dict(),
            "dice": dice,
            "old_position": old_position,
            "blocked": False,
        }

    def get_state(self):
        """Return current game state without rolling."""
        return self._state_dict()

    def _state_dict(self):
        """Build the serializable state dictionary."""
        return {
            "position": self.position,
            "status": self.status,
            "total_rolls": self.total_rolls,
            "snakes_hit": self.snakes_hit,
            "ladders_used": self.ladders_used,
            "snakes": SNAKES,
            "ladders": LADDERS,
        }


# ---------------------------------------------------------------------------
# BFS: Minimum Rolls to Win
# ---------------------------------------------------------------------------

def min_rolls_to_win():
    """
    BFS over the board graph to find the minimum number of dice rolls
    needed to reach cell 100 from cell 0 (start).

    Each BFS level = one dice roll.
    From any cell we can roll 1–6, land on a new cell, and if there's a
    snake/ladder teleport, we immediately move to that cell (no extra roll).
    """
    # visited[cell] = minimum rolls to reach that cell
    visited = [-1] * 101   # cells 0–100
    visited[0] = 0

    queue = deque([0])

    while queue:
        current = queue.popleft()
        current_rolls = visited[current]

        # Try every possible dice outcome
        for dice in range(1, 7):
            next_cell = current + dice

            if next_cell > 100:
                continue  # can't move beyond 100

            # Apply teleport instantly (snake or ladder)
            if next_cell in TELEPORT:
                next_cell = TELEPORT[next_cell]

            # Only visit each cell once (BFS guarantees shortest path)
            if visited[next_cell] == -1:
                visited[next_cell] = current_rolls + 1
                if next_cell == 100:
                    return visited[100]
                queue.append(next_cell)

    return -1  # unreachable (should never happen on a valid board)
