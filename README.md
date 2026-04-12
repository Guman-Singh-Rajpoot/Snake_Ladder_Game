# 🐍 Snakes & Ladders — Full Stack Web App

A complete full-stack implementation of the classic Snakes & Ladders game built with
**HTML / CSS / Vanilla JavaScript** on the frontend and **Python Flask** on the backend.

---

## 🗂️ Project Structure

```
snakes-ladders-web/
│
├── backend/
│   ├── app.py       ← Flask REST API (all endpoints)
│   └── game.py      ← Game logic, snake/ladder config, BFS algorithm
│
├── frontend/
│   ├── index.html   ← Game UI structure
│   ├── style.css    ← Styling (dark arcade theme)
│   └── script.js    ← Board rendering, API calls, animations
│
└── README.md
```

---

## ⚡ Quick Start

### 1 — Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.8+ |
| pip | any recent |
| A modern browser | Chrome, Firefox, Edge, Safari |

### 2 — Install Python dependencies

```bash
cd snakes-ladders-web/backend
pip install flask flask-cors
```

### 3 — Start the Flask backend

```bash
# From the backend/ folder
python app.py
```

You should see:
```
🐍 Snakes & Ladders API running at http://127.0.0.1:5000
```

### 4 — Open the frontend

Open `frontend/index.html` directly in your browser.

> **No build step required.** The frontend uses only vanilla HTML/CSS/JS and
> communicates with the local Flask server via `fetch()`.

---

## 🎮 How to Play

1. Click **Roll Dice** — a random number (1–6) is generated.
2. Your player 🧑 moves that many cells forward.
3. If you land on a 🪜 **ladder bottom** → you climb up.
4. If you land on a 🐍 **snake head** → you slide down.
5. You cannot move past cell 100 (the roll is skipped).
6. First to reach **exactly 100** wins! 🏆

---

## 🔌 API Endpoints

All endpoints are on `http://127.0.0.1:5000`.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/roll` | Roll dice and move player |
| GET | `/reset` | Reset game to initial state |
| GET | `/state` | Get current position & stats |
| GET | `/min-rolls` | BFS: minimum rolls to win |

### Example responses

**GET /roll**
```json
{
  "dice": 4,
  "position": 29,
  "old_position": 25,
  "status": "playing",
  "blocked": false,
  "total_rolls": 7,
  "snakes_hit": 1,
  "ladders_used": 2,
  "snakes": { "99": 21, "95": 75, "...": "..." },
  "ladders": { "4": 25, "13": 46, "...": "..." }
}
```

**GET /min-rolls**
```json
{
  "min_rolls": 7,
  "explanation": "The minimum number of dice rolls needed to reach cell 100 is 7..."
}
```

---

## 🐍 Board Configuration

### Snakes (head → tail)

| Head | Tail |
|------|------|
| 99   | 21   |
| 95   | 75   |
| 87   | 24   |
| 62   | 19   |
| 54   | 34   |
| 46   | 5    |
| 17   | 7    |

### Ladders (bottom → top)

| Bottom | Top |
|--------|-----|
| 4      | 25  |
| 13     | 46  |
| 33     | 49  |
| 42     | 63  |
| 50     | 69  |
| 74     | 92  |
| 85     | 95  |

---

## 🧮 BFS Algorithm (Minimum Rolls)

`GET /min-rolls` runs **Breadth-First Search** over the board graph to find
the theoretical minimum number of dice rolls needed to win.

**How it works:**
- Each BFS level represents one dice roll.
- From any cell you can roll 1–6.
- If the landed cell has a snake or ladder, the teleport is applied instantly (no extra roll).
- BFS guarantees the shortest path (fewest rolls).

This is implemented in `game.py → min_rolls_to_win()`.

---

## 🔧 Customisation

### Change snakes/ladders
Edit the `SNAKES` and `LADDERS` dictionaries in `backend/game.py`.

### Change the server port
Edit the last line of `backend/app.py`:
```python
app.run(debug=True, port=5000)  # change 5000 to any free port
```

Then update `API_BASE` in `frontend/script.js`:
```javascript
const API_BASE = "http://127.0.0.1:YOUR_PORT";
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend UI | HTML5, CSS3 (Grid, custom properties, animations) |
| Frontend Logic | Vanilla JavaScript (ES6+, Fetch API) |
| Backend | Python 3, Flask |
| CORS | flask-cors |
| Algorithm | BFS (collections.deque) |
| Fonts | Google Fonts — Fredoka One + Nunito |

---

## 📋 Testing Checklist

- [ ] Dice rolls values are always 1–6
- [ ] Player moves forward by the exact dice value
- [ ] Snake: landing on head teleports to tail (lower cell)
- [ ] Ladder: landing on bottom teleports to top (higher cell)
- [ ] Roll is blocked when it would exceed cell 100
- [ ] Win triggers when player reaches exactly 100
- [ ] Reset returns player to start (cell 0) with zeroed stats
- [ ] BFS returns a sensible minimum number of rolls

---

## 🚀 Future Improvements

- 👥 Multiplayer (WebSockets via Flask-SocketIO)
- 🤖 AI opponent using minimax or Monte Carlo simulation
- 📱 Progressive Web App (PWA) for mobile
- 💾 Leaderboard with a SQLite / PostgreSQL database
- 🎨 Custom board themes / 3D board
- 🔊 Sound effects with the Web Audio API

---

## 📜 License

MIT — free for personal and educational use.
