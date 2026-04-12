# VanaVie

A 2D side-scrolling adventure game built with vanilla JavaScript and HTML5 Canvas.

**VanaVie** (Sanskrit *vana* = forest + French *vie* = life) is an exploration game where you choose a character and journey through tile-based worlds, encountering enemies, story events, and level transitions.

## Features

- **Character Selection** -- choose from Knight, Archer, Wizard, or Rogue
- **Tile Map Engine** -- loads Tiled JSON exports with multiple layers
- **Camera System** -- smooth-follow camera with viewport culling
- **State Machine AI** -- enemies with Patrol, Chase, Attack behaviors
- **Story System** -- typewriter dialog boxes triggered from map objects
- **Combat** -- projectile attacks, enemy HP, invincibility frames
- **Level Transitions** -- fade transitions between maps via exit objects
- **Audio** -- pooled SFX and looping background music
- **Parallax Backgrounds** -- multi-layer scrolling behind tile maps

## Getting Started

1. Clone the repo
2. Start a local file server:
   ```bash
   python -m http.server 8000
   ```
3. Open `http://localhost:8000/start.html`

## Controls

| Key | Action |
|-----|--------|
| W | Jump |
| A / D | Move left / right |
| Space | Attack |
| E | Interact / advance dialog |
| P | Pause |
| M | Mute audio |
| R | Restart (on death) |
| F1 | Debug overlay |

## Adding Levels

1. Design your map in [Tiled Map Editor](https://www.mapeditor.org/)
2. Use these layer conventions:
   - `background` (tile layer) -- decorative backdrop
   - `terrain` (tile layer) -- visible ground and walls
   - `collision` (tile layer) -- solid tiles for physics
   - `foreground` (tile layer) -- tiles rendered above the player
   - Object layer with: `playerStart`, `enemy`, `story`, `exit` objects
3. Export as JSON to `maps/your_level.json`
4. Place tileset images in `maps/tilesets/`

## Project Structure

```
start.html              Character selection screen
index.html              Game canvas
script.js               Game loop and main Game class

game_stuff/
  state.js              Base State class
  input.js              Keyboard input handler
  camera.js             Viewport camera with smoothing
  tileMap.js            Tiled JSON map loader/renderer
  collision.js          AABB tile collision resolution
  layers.js             Parallax background layers
  audioHandler.js       Sound effects and music manager
  levelManager.js       Level loading and transitions
  storyManager.js       Dialog and story trigger system
  hud.js                Health bar and HUD overlay

player_stuff/
  player.js             Player entity
  projectile.js         Player projectiles
  states/playerStates.js  Player state machine

enemy_stuff/
  enemy.js              Base enemy entity
  enemyManager.js       Enemy spawning and lifecycle
  enemyStates.js        Enemy AI state machine

maps/                   Tiled JSON maps and tileset images
assets/                 Sprites, audio, backgrounds, UI
```
