# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VanaVie is a 2D side-scrolling adventure game built with vanilla JavaScript and HTML5 Canvas. It features tile-based maps (Tiled JSON), sprite-based animation, a state machine pattern for all entities, a camera system, combat with enemies, story/dialog triggers, and parallax backgrounds.

## Running the Project

Start a live file server (e.g., VS Code Live Server, `python -m http.server`) with `start.html` as the entry point. The character selection screen loads first, stores the choice in `localStorage`, then navigates to `index.html` which runs the game.

## Architecture

### State Pattern

All entities (player, enemies) use a shared `State` base class from `game_stuff/state.js`. Each state implements `enter()` (set sprite frames) and `handleInput()` (transition logic). State indices are defined via frozen enum objects (`PlayerState`, `EnemyState`).

### Core Systems

- **Camera** (`game_stuff/camera.js`): Follows the player with lerp smoothing, clamps to world bounds, provides `worldToScreen()` for all rendering.
- **TileMap** (`game_stuff/tileMap.js`): Parses Tiled JSON exports. Handles tile layers (background, terrain, foreground), object layers (enemies, triggers, exits), and collision queries. Only renders tiles visible in the camera viewport.
- **Collision** (`game_stuff/collision.js`): AABB collision resolution against tile map. Resolves horizontal then vertical separately. Also provides entity-vs-entity collision.
- **LevelManager** (`game_stuff/levelManager.js`): Loads levels from `maps/*.json`, manages transitions with fade effects, spawns enemies and story triggers from map data.
- **StoryManager** (`game_stuff/storyManager.js`): Reads story trigger objects from tile maps, displays typewriter-style dialog boxes, tracks one-shot triggers.
- **AudioManager** (`game_stuff/audioHandler.js`): Pooled sound effects with named registration, background music with loop support, mute toggle.
- **HUD** (`game_stuff/hud.js`): Health bar with lerp smoothing, level name display.
- **ParallaxBackground** (`game_stuff/layers.js`): Multiple layers scrolling at different speeds relative to camera.

### Module Organization

```
game_stuff/           # Core engine systems
  state.js            # Shared State base class
  input.js            # InputHandler with configurable key bindings
  camera.js           # Camera with viewport, smoothing, world bounds
  tileMap.js           # Tiled JSON parser and renderer
  collision.js         # Tile and entity collision resolution
  layers.js           # Parallax background layers
  audioHandler.js     # Sound effect and music manager
  levelManager.js     # Level loading and transitions
  storyManager.js     # Dialog system and story triggers
  hud.js              # Player HUD overlay

player_stuff/         # Player entity
  player.js           # Player class with sprite animation, combat, physics
  projectile.js       # Player projectiles
  states/
    playerStates.js   # Idle, Running, Jumping, Falling, Attacking, Hurt, Dead

enemy_stuff/          # Enemy entities
  enemy.js            # Base Enemy class with AI states
  enemyManager.js     # Spawns enemies from map, manages lifecycle
  enemyStates.js      # Idle, Patrol, Chase, Attack, Hurt, Dead

maps/                 # Tiled map JSON exports and tileset images
  tilesets/           # Tileset PNGs
```

### Input System

`InputHandler` accepts a `keyBindings` object. Default bindings: WASD for movement, Space for attack, E for interact.

### Sprite Animation

Sprite sheets are sliced by `spriteWidth`/`spriteHeight`. `frameX` advances horizontally through frames; `frameY` selects the animation row. Frame rate controlled via `fps` and delta-time accumulation. Animation config (row + frame count per state) comes from the character config object.

### Map System

Maps are created in Tiled Map Editor and exported as JSON. Expected layers:
- **background** (tile layer): decorative tiles behind the player
- **terrain** (tile layer): visible ground/walls
- **collision** (tile layer): solid tiles for physics (can be same as terrain)
- **foreground** (tile layer): tiles rendered above the player
- **objects** (object layer): `playerStart`, `enemy`, `story`, `exit` objects

### Game Loop

`script.js` runs `requestAnimationFrame` loop: calculates `deltaTime`, then calls `game.update(deltaTime)` and `game.draw(ctx)`. Update order: player -> collision resolution -> enemies -> story triggers -> exits -> camera -> HUD.

## Adding New Features

**New State**: Extend `State` from `game_stuff/state.js`, implement `enter()` and `handleInput()`, add to the entity's `states` array, and add an entry to the enum.

**New Level**: Create a Tiled map with the expected layers, export as JSON to `maps/`, add tileset images to `maps/tilesets/`.

**New Enemy Type**: Call `enemyManager.registerEnemyType(name, config)` in `Game.registerEnemyTypes()`. Place enemies in Tiled maps with matching `enemyType` property.

**New Character**: Add to the `characters` array in `start.html` with full sprite config including animation rows/frames.
