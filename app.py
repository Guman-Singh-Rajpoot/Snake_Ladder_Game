"""
app.py — Flask REST API for Snakes & Ladders
Exposes endpoints consumed by the frontend via Fetch API.
"""

from flask import Flask, jsonify
from flask_cors import CORS
from game import SnakesAndLaddersGame, min_rolls_to_win

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from the frontend

# Single global game instance (one-player, in-memory)
game = SnakesAndLaddersGame()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.route("/roll", methods=["GET"])
def roll():
    """
    Roll the dice and advance the player.
    Returns: dice value, new position, event type, status, stats.
    """
    result = game.move()
    return jsonify(result)


@app.route("/reset", methods=["GET"])
def reset():
    """Reset the game to its initial state."""
    game.reset()
    return jsonify({"message": "Game reset", **game.get_state()})


@app.route("/state", methods=["GET"])
def state():
    """Return the current game state without making a move."""
    return jsonify(game.get_state())


@app.route("/min-rolls", methods=["GET"])
def min_rolls():
    """
    BFS endpoint: calculate the theoretical minimum number of dice rolls
    required to reach cell 100 from the start.
    This is board-level analysis, independent of current game state.
    """
    minimum = min_rolls_to_win()
    return jsonify({
        "min_rolls": minimum,
        "explanation": (
            f"The minimum number of dice rolls needed to reach cell 100 "
            f"is {minimum}, achieved by always landing on ladders and "
            f"never hitting snakes."
        )
    })


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("🐍 Snakes & Ladders API running at http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
