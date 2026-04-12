import { TileMap } from './tileMap.js';

export class LevelManager {
    constructor(game) {
        this.game = game;
        this.currentLevelName = null;
        this.tileMap = null;
        this.tilesetImages = {};
        this.transitioning = false;
        this.fadeAlpha = 0;
        this.fadingIn = false;
        this.fadingOut = false;
        this.fadeSpeed = 0.03;
        this.pendingLevel = null;
        this.pendingSpawn = null;
    }

    async loadLevel(levelName) {
        this.currentLevelName = levelName;
        const response = await fetch(`maps/${levelName}.json`);
        const mapData = await response.json();

        await this.loadTilesetImages(mapData.tilesets);

        this.tileMap = new TileMap(mapData, this.tilesetImages);
        this.game.camera.setWorldBounds(this.tileMap.worldWidth, this.tileMap.worldHeight);

        const playerStart = this.tileMap.getObjectsByType('playerStart')[0];
        if (playerStart && this.game.player) {
            this.game.player.init(playerStart.x, playerStart.y - this.game.player.height);
        }

        if (this.game.enemyManager) {
            this.game.enemyManager.spawnFromMap(this.tileMap);
        }

        if (this.game.storyManager) {
            this.game.storyManager.loadTriggers(this.tileMap);
        }

        const levelProps = this.getLevelProperties(mapData);
        if (levelProps.music && this.game.audio) {
            this.game.audio.playMusic(levelProps.music);
        }
    }

    async loadTilesetImages(tilesets) {
        const promises = tilesets.map((ts) => {
            return new Promise((resolve) => {
                const imagePath = ts.image || `maps/tilesets/${ts.name}.png`;
                const img = new Image();
                img.onload = () => {
                    this.tilesetImages[ts.name] = img;
                    if (ts.source) this.tilesetImages[ts.source] = img;
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to load tileset image: ${imagePath}`);
                    resolve();
                };
                img.src = imagePath;
            });
        });
        await Promise.all(promises);
    }

    getLevelProperties(mapData) {
        const props = {};
        if (mapData.properties) {
            for (const p of mapData.properties) {
                props[p.name] = p.value;
            }
        }
        return props;
    }

    transitionTo(levelName, spawnPointName) {
        if (this.transitioning) return;
        this.transitioning = true;
        this.fadingOut = true;
        this.fadingIn = false;
        this.fadeAlpha = 0;
        this.pendingLevel = levelName;
        this.pendingSpawn = spawnPointName;
    }

    async update() {
        if (!this.transitioning) return;

        if (this.fadingOut) {
            this.fadeAlpha += this.fadeSpeed;
            if (this.fadeAlpha >= 1) {
                this.fadeAlpha = 1;
                this.fadingOut = false;
                this.fadingIn = true;
                await this.loadLevel(this.pendingLevel);
                if (this.pendingSpawn) {
                    const spawn = this.tileMap.getObjectsByType('playerStart')
                        .find(s => s.name === this.pendingSpawn);
                    if (spawn && this.game.player) {
                        this.game.player.init(spawn.x, spawn.y - this.game.player.height);
                    }
                }
            }
        }

        if (this.fadingIn) {
            this.fadeAlpha -= this.fadeSpeed;
            if (this.fadeAlpha <= 0) {
                this.fadeAlpha = 0;
                this.fadingIn = false;
                this.transitioning = false;
            }
        }
    }

    drawFade(ctx) {
        if (this.fadeAlpha > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
    }

    checkExits(player) {
        if (!this.tileMap || this.transitioning) return;
        const exits = this.tileMap.getObjectsByType('exit');
        const px = player.x + player.hitboxOffsetX;
        const py = player.y + player.hitboxOffsetY;
        const pw = player.hitboxWidth;
        const ph = player.hitboxHeight;

        for (const exit of exits) {
            if (px < exit.x + exit.width && px + pw > exit.x &&
                py < exit.y + exit.height && py + ph > exit.y) {
                const targetLevel = exit.properties.targetLevel;
                const targetSpawn = exit.properties.targetSpawn;
                if (targetLevel) {
                    this.transitionTo(targetLevel, targetSpawn);
                }
                break;
            }
        }
    }
}
