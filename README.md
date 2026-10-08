# Yazzy

A mobile-first Yahtzee-style dice game: **Solo vs Bot** and **2-player online rooms**.
React + Vite + Tailwind on the client, Node + Express + Socket.IO on the server, all TypeScript.

The server is authoritative. Dice, turn order, roll counts, scoring and winners are all decided on the server.
The browser only sends intents ("roll", "hold these dice", "score this box"). Solo mode runs on the server too
(a room with a bot player), so dice are never generated in the browser.

---

## Quick start (local)

Requires Node 20+ (22 recommended).

```bash
npm install
cp .env.example .env        # optional, defaults work
npm run dev                 # server on :3001, client on :5173
```

Open http://localhost:5173. To try online mode alone, open two browser tabs: one creates a room, the other joins
with the code (each tab keeps its own seat, so reconnecting works per tab).
To test from a phone on the same Wi-Fi, open `http://<your-computer-ip>:5173`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Server + client with hot reload |
| `npm run build` | Builds `client/dist` and `server/dist/server.mjs` |
| `npm start` | Runs the production build: one process serves the API, sockets and the built client |
| `npm test` | Runs all unit + integration tests (Vitest) |
| `npm run typecheck` | Type-checks game, server and client |

---

## Deploy to Heroku

The app is one Node process: Express serves the built React app **and** the Socket.IO server, so you deploy a
single Heroku app. The repo is already prepared for it:

- `Procfile` runs `npm start` (`web: npm start`).
- `heroku-postbuild` in the root `package.json` runs `npm run build` (builds the client and bundles the server).
- `engines.node` is pinned to `22.x`.
- The server listens on Heroku's `PORT` automatically and needs no other environment variables.

### Option A: Heroku CLI (recommended)

1. **Install** the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) and create a Heroku account.
   Heroku has no free tier, so add a payment method (the cheapest dynos cost a few dollars a month).
2. **Log in:**
   ```bash
   heroku login
   ```
3. **Put the project in git** (skip if it already is). Run this inside the `yazzy` folder, the one that contains
   `Procfile` and `package.json`:
   ```bash
   git init
   git add .
   git commit -m "Yazzy"
   ```
   (`node_modules`, `dist` and `.env` are already in `.gitignore`.)
4. **Create the app** (pick your own unique name, or leave it blank for a random one):
   ```bash
   heroku create my-yazzy-game
   heroku buildpacks:set heroku/nodejs
   ```
5. **Deploy:**
   ```bash
   git push heroku HEAD:main
   ```
   Heroku installs the dependencies, runs `heroku-postbuild` (the build takes a minute or two) and starts the web
   dyno. If Heroku says it cannot find `main`, run `git push heroku HEAD:master` instead.
6. **Run exactly one web dyno** (important, see "Limits" below):
   ```bash
   heroku ps:scale web=1
   ```
7. **Open it:**
   ```bash
   heroku open
   ```
   You should see the Yazzy home screen. `https://<your-app>.herokuapp.com/health` should return `{"ok":true}`.

To deploy an update later: commit your changes and run `git push heroku HEAD:main` again.

### Option B: Heroku dashboard + GitHub

1. Push the project to a GitHub repository (the repository root must be the `yazzy` folder).
2. In the Heroku dashboard choose **New, then Create new app**.
3. Open the **Deploy** tab, choose **GitHub**, connect your repo and click **Deploy Branch**
   (optionally enable automatic deploys).
4. In **Settings, Buildpacks** make sure `heroku/nodejs` is listed.
5. In the **Resources** tab keep the web dyno at **1**, then click **Open app**.

### Optional configuration

Everything has a default. Set any of these with `heroku config:set NAME=value`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `BOT_DELAY_MS` | `1100` | Pause between the bot's actions (roll / hold / score) |
| `WAITING_ROOM_TTL_MIN` | `30` | Rooms with no opponent expire after this long |
| `IDLE_ROOM_TTL_MIN` | `120` | Rooms with no activity expire after this long |
| `RECONNECT_GRACE_MIN` | `15` | An empty room (everyone disconnected) is kept this long for reconnects |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Only needed if the React app is hosted on a different domain than the server |

### Limits you should know about

- **Use one dyno only.** Rooms live in the server's memory. With two or more dynos a player could land on a
  different dyno than their opponent and see "room not found". To scale beyond one dyno, move rooms to Redis
  (implement the `RoomStore` interface in `server/rooms/roomStore.ts`) and run
  `heroku features:enable http-session-affinity`.
- **Restarts end games in progress.** Heroku restarts every dyno at least once a day and on each deploy. Players
  then see "Your previous game is no longer available" and start a new room. Avoid deploying during a game.
- **Sleeping dynos.** Eco dynos fall asleep after 30 minutes without web traffic, and the first visit then takes a
  few seconds. Basic dynos and above do not sleep.
- **WebSockets** work on Heroku by default. Socket.IO pings every 25 seconds, which keeps the connection open
  through Heroku's 55-second idle timeout.
- The UI loads the Baloo 2 and Lilita One fonts from Google Fonts, so players need internet access (the app falls
  back to a rounded system font otherwise).

### Troubleshooting

| Symptom | What to do |
| --- | --- |
| "Application error" page | `heroku logs --tail` shows why. A crash on boot usually means the build failed. |
| Build fails during `heroku-postbuild` | Run `npm run build` locally; it uses the same steps. Fix the error it prints, commit, push again. |
| `Cannot find module 'express'` | Make sure `package-lock.json` is committed and the runtime packages stay in `dependencies` of `server/package.json` (they are). |
| "Connecting to the game server…" never ends | Check `heroku ps` shows one `web` dyno that is `up`, and look at the browser console for blocked requests. |
| "Room not found" for a valid code | You probably have more than one dyno: `heroku ps:scale web=1`. |
| Useful commands | `heroku logs --tail`, `heroku ps`, `heroku config`, `heroku restart` |

To test the production build on your machine before deploying: `npm run build && PORT=3000 npm start`, then open
http://localhost:3000.

---

## How to play

1. **ROLL** (up to 3 rolls per turn). Tap dice to **hold** them (lime border). Held dice stay perfectly still on the
   next roll; only the others tumble.
2. Tap one of your empty boxes. It shows what it would score with the current dice (for example three 3s in
   "Threes" shows 9). Tap another box to compare.
3. Press **PLAY** to lock it in. The scored dice fly from the tray into the box.
4. Tap any row icon (or the bonus label) to see how that box scores, for example "Sequence of 4, Score: 30".
5. The round button on the right edge **restarts** the game. In solo it restarts at once. Online, both players must
   agree: the other player gets a Yes/No question.

Colours: one player is **red** and the other **blue**, drawn at random for every game (the bot gets the opposite
colour). The whole screen wears your colour.

You only see roll animations for your own rolls and the bot's. When another human rolls, their dice simply update.

## Rules implemented

Standard 13 boxes and scoring: Ones to Sixes (sum of matching dice), Three/Four of a Kind (sum of all dice),
Full House 25, Small Straight 30, Large Straight 40, Yazzy 50, Chance (sum). Upper-section bonus of +35 at 63 or more.
A Full House needs exactly three of one value and two of another (five of a kind is not a Full House).
A tie is a draw. Leaving a live online game counts as a loss.
Not implemented: Yahtzee bonus (100 per extra Yazzy) and Joker rules.

---

## Architecture

```text
game/       Pure TypeScript, no Socket.IO / Node / DOM. Shared by server and client.
  types/      domain types + the typed Socket.IO protocol (events and payloads)
  utils/      dice helpers
  scoring/    category scoring, upper bonus, totals
  engine/     createGame / rollDice / setHeld / selectScore / getWinners / forfeitGame
  bot/        decideHold + chooseCategory
server/
  rooms/      Room model, RoomStore interface (+ in-memory impl), room codes, public view
  services/   RoomService: rooms, reconnects, turns, restart votes, bot driver (no Socket.IO import)
  socket/     thin Socket.IO adapter: payload parsing, error mapping, broadcaster
  utils/      secure RNG (crypto.randomInt), tokens
client/
  components/ Cube (CSS 3D die), DiceTray, Scorecard (board), RollBar, FlyingDice, RuleTip, dialogs, notices
  pages/      Menu, Join, Lobby, Game
  hooks/      useGameClient (socket <-> React state)
  services/   socket instance + session storage
```

- **Engine is immutable and injectable.** Every engine function takes a state and returns a new one; the dice
  source is a parameter (`DieRoller`), so tests are deterministic.
- **Humans and the bot use the same code path** (`performRoll / performHold / performScore`), so the bot cannot
  break a rule a human cannot.
- **`RoomService` talks to a `Broadcaster` interface**, not Socket.IO, so it is unit-tested with a fake.
- **Public view.** Clients receive a `RoomView`: no tokens, no socket ids. A player's dice are only revealed while it
  is their turn.
- **Persistence.** Rooms live in memory behind the `RoomStore` interface. For Redis, implement `RoomStore` and make
  its methods async (RoomService is the only caller).
- **UI scaling.** The interface is drawn on a 390 x 844 canvas (iPhone 13) and scaled with one CSS unit (`--u`), so
  iPhone and Android screens keep identical proportions; safe-area insets are respected.

## Socket events

Client to server: `create_room`, `create_solo`, `join_room`, `rejoin_room`, `leave_room`, `restart_game`,
`decline_restart`, `roll_dice`, `hold_dice` (`{ held: boolean[5] }`), `select_score` (`{ category }`).

Server to client: `room_created`, `room_joined`, `room_rejoined`, `room_left`, `room_error`, `player_joined`,
`player_left`, `player_reconnected`, `game_started`, `restart_requested`, `restart_declined`, `dice_rolled`,
`dice_held`, `score_updated`, `turn_changed`, `game_finished`.

Every game event carries the full `RoomView`, so a client can always rebuild its UI from the latest event.
Types live in `game/types/protocol.ts`.

## Reconnection

Creating or joining a room returns a secret `session { roomCode, playerId, token }`, stored in `sessionStorage`.
On every socket (re)connect the client sends `rejoin_room`. The server matches the token, rebinds the seat to the new
socket and replies with `room_rejoined` containing the current state. A disconnect only marks the player
`connected: false`; the game waits. Rooms with nobody connected are removed after `RECONNECT_GRACE_MIN`.

## Security notes

- The server rolls dice with `crypto.randomInt`; clients cannot submit dice or scores.
- Every action is validated in the engine: turn, rolls left (max 3), roll-before-score, category validity,
  duplicate categories, hold mask shape. Room joins check code format, existence, expiry, capacity and status.
- Names are sanitised and length-limited; unexpected server errors are logged and returned as a generic message.
- Not included yet: per-socket rate limiting and authentication (rooms are protected only by their unguessable code
  and per-seat tokens). Add rate limiting before a large public launch.

## Tests

`npm test` runs 121 tests: scoring for every box (including edge cases), engine rules (roll limit, holds, duplicates,
turn validation, winners, forfeits), bot decisions, `RoomService` (create/join/full/invalid/expired, disconnect and
reconnect, random colours, restart votes, a solo bot playing a full game) and a real Socket.IO integration suite
(create/join, broadcasts, out-of-turn errors, reconnect, restart, solo over the wire).
