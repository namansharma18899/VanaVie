import { Player } from './player_stuff/player.js';
import { Camera } from './game_stuff/camera.js';
import { InputHandler, DEFAULT_KEY_BINDINGS } from './game_stuff/input.js';
import { LevelManager } from './game_stuff/levelManager.js';
import { EnemyManager } from './enemy_stuff/enemyManager.js';
import { StoryManager } from './game_stuff/storyManager.js';
import { AudioManager } from './game_stuff/audioHandler.js';
import { HUD } from './game_stuff/hud.js';
import { ParallaxBackground, ParallaxLayer } from './game_stuff/layers.js';
import { resolveCollisions } from './game_stuff/collision.js';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;

        this.camera = new Camera(this.width, this.height);
        this.input = new InputHandler(DEFAULT_KEY_BINDINGS);
        this.audio = new AudioManager();
        this.levelManager = new LevelManager(this);
        this.enemyManager = new EnemyManager(this);
        this.storyManager = new StoryManager(this);
        this.hud = new HUD(this);
        this.parallax = null;

        this.player = null;
        this.gameOver = false;
        this.paused = false;

        this.debug = false;
    }

    async init() {
        this.registerSounds();
        this.registerEnemyTypes();

        const charData = localStorage.getItem('vanavie_character');
        const characterConfig = charData ? JSON.parse(charData) : this.getDefaultCharacter();

        this.player = new Player(this, characterConfig);

        try {
            await this.levelManager.loadLevel('level1');
        } catch (e) {
            console.warn('No level1.json found, creating demo world');
            this.createDemoWorld();
        }

        this.camera.follow(this.player);

        window.addEventListener('keydown', (e) => {
            if (e.key === 'p') this.paused = !this.paused;
            if (e.key === 'F1') {
                e.preventDefault();
                this.debug = !this.debug;
            }
            if (e.key === 'm') this.audio.toggleMute();
        });
    }

    registerSounds() {
        this.audio.register('jump', 'assets/audio/jump.wav', { poolSize: 2 });
        this.audio.register('attack', 'assets/audio/attack.wav', { poolSize: 3 });
        this.audio.register('hurt', 'assets/audio/hurt.wav', { poolSize: 2 });
        this.audio.register('enemyHurt', 'assets/audio/enemy_hurt.wav', { poolSize: 3 });
        this.audio.register('pickup', 'assets/audio/pickup.wav');
        this.audio.register('door', 'assets/audio/door.wav');
    }

    registerEnemyTypes() {
        this.enemyManager.registerEnemyType('default', {
            spriteWidth: 64,
            spriteHeight: 64,
            drawWidth: 64,
            drawHeight: 64,
            speed: 1.5,
            health: 30,
            damage: 10,
            detectionRange: 200,
            attackRange: 50,
            hitboxOffsetX: 12,
            hitboxOffsetY: 12,
            hitboxWidth: 40,
            hitboxHeight: 52,
            spriteSrc: 'assets/sprites/enemy_sheet.png',
            animations: {
                idle:   { row: 0, frames: 3 },
                walk:   { row: 1, frames: 5 },
                attack: { row: 2, frames: 4 },
                hurt:   { row: 3, frames: 2 },
                dead:   { row: 4, frames: 5 },
            },
        });
    }

    getDefaultCharacter() {
        return {
            name: 'Knight',
            spriteSrc: 'assets/sprites/knight_sheet.png',
            spriteWidth: 64,
            spriteHeight: 64,
            drawWidth: 64,
            drawHeight: 64,
            speed: 3,
            jumpForce: -12,
            maxHealth: 100,
            damage: 15,
            hitboxOffsetX: 16,
            hitboxOffsetY: 8,
            hitboxWidth: 32,
            hitboxHeight: 56,
            animations: {
                idle:   { row: 0, frames: 3 },
                run:    { row: 1, frames: 5 },
                jump:   { row: 2, frames: 3 },
                fall:   { row: 3, frames: 2 },
                attack: { row: 4, frames: 4 },
                hurt:   { row: 5, frames: 2 },
                dead:   { row: 6, frames: 5 },
            },
        };
    }

    createDemoWorld() {
        const cols = 60;
        const rows = 17;
        const tileSize = 32;
        const terrainData = new Array(cols * rows).fill(0);

        for (let c = 0; c < cols; c++) {
            terrainData[(rows - 1) * cols + c] = 1;
            terrainData[(rows - 2) * cols + c] = 1;
        }

        for (let r = 0; r < rows; r++) {
            terrainData[r * cols] = 1;
            terrainData[r * cols + cols - 1] = 1;
        }

        for (let c = 15; c < 20; c++) terrainData[(rows - 4) * cols + c] = 1;
        for (let c = 25; c < 28; c++) terrainData[(rows - 6) * cols + c] = 1;
        for (let c = 35; c < 42; c++) terrainData[(rows - 4) * cols + c] = 1;

        const demoMap = {
            width: cols,
            height: rows,
            tilewidth: tileSize,
            tileheight: tileSize,
            tilesets: [{
                firstgid: 1,
                name: 'demo',
                tilewidth: tileSize,
                tileheight: tileSize,
                columns: 1,
                tilecount: 1,
                image: null,
            }],
            layers: [
                { name: 'terrain', type: 'tilelayer', data: terrainData, width: cols, height: rows, visible: true },
                { name: 'collision', type: 'tilelayer', data: terrainData, width: cols, height: rows, visible: false },
                {
                    name: 'objects', type: 'objectgroup', objects: [
                        { name: 'start', type: 'playerStart', x: 64, y: rows * tileSize - 3 * tileSize, width: 32, height: 32 },
                        {
                            name: 'welcome', type: 'story', x: 128, y: (rows - 3) * tileSize, width: 64, height: 64,
                            properties: [
                                { name: 'text', value: 'Welcome to VanaVie.|The forest awaits...|Use WASD to move, SPACE to attack.' },
                                { name: 'speaker', value: 'Ancient Stone' },
                                { name: 'oneShot', value: true },
                            ],
                        },
                    ],
                },
            ],
        };

        const objects = demoMap.layers[2].objects;
        const extractProps = (obj) => {
            const props = {};
            if (obj.properties) {
                for (const p of obj.properties) props[p.name] = p.value;
            }
            return props;
        };

        this.levelManager.tileMap = {
            tileWidth: tileSize,
            tileHeight: tileSize,
            cols,
            rows,
            worldWidth: cols * tileSize,
            worldHeight: rows * tileSize,
            layers: {
                terrain: { type: 'tile', data: terrainData, width: cols, height: rows, visible: true },
                collision: { type: 'tile', data: terrainData, width: cols, height: rows, visible: false },
                objects: { type: 'object', objects, visible: true },
            },
            isSolid(wx, wy) {
                const c = Math.floor(wx / tileSize);
                const r = Math.floor(wy / tileSize);
                if (c < 0 || c >= cols || r < 0 || r >= rows) return true;
                return terrainData[r * cols + c] !== 0;
            },
            getObjectsByType(type) {
                const results = [];
                for (const obj of objects) {
                    if (obj.type === type) {
                        results.push({ x: obj.x, y: obj.y, width: obj.width, height: obj.height, name: obj.name, properties: extractProps(obj) });
                    }
                }
                return results;
            },
            drawLayer(ctx, camera, layerName) {
                const layer = this.layers[layerName];
                if (!layer || layer.type !== 'tile' || !layer.visible) return;
                const startCol = Math.max(0, Math.floor(camera.x / tileSize));
                const endCol = Math.min(cols, Math.ceil((camera.x + camera.viewportWidth) / tileSize) + 1);
                const startRow = Math.max(0, Math.floor(camera.y / tileSize));
                const endRow = Math.min(rows, Math.ceil((camera.y + camera.viewportHeight) / tileSize) + 1);
                for (let r = startRow; r < endRow; r++) {
                    for (let c = startCol; c < endCol; c++) {
                        const gid = layer.data[r * cols + c];
                        if (gid === 0) continue;
                        const screen = camera.worldToScreen(c * tileSize, r * tileSize);
                        ctx.fillStyle = '#3a5a3a';
                        ctx.fillRect(Math.round(screen.x), Math.round(screen.y), tileSize, tileSize);
                        ctx.strokeStyle = '#2a4a2a';
                        ctx.strokeRect(Math.round(screen.x), Math.round(screen.y), tileSize, tileSize);
                    }
                }
            },
        };

        this.camera.setWorldBounds(this.levelManager.tileMap.worldWidth, this.levelManager.tileMap.worldHeight);

        const startObj = this.levelManager.tileMap.getObjectsByType('playerStart')[0];
        if (startObj) {
            this.player.init(startObj.x, startObj.y - this.player.height);
        } else {
            this.player.init(64, rows * tileSize - 4 * tileSize);
        }

        this.storyManager.loadTriggers(this.levelManager.tileMap);
        this.levelManager.currentLevelName = 'demo_world';
    }

    update(deltaTime) {
        if (this.paused || this.gameOver) return;

        if (this.storyManager.isActive()) {
            this.storyManager.update(deltaTime, this.input.keys);
            return;
        }

        this.player.update(this.input.keys, deltaTime);

        if (this.levelManager.tileMap) {
            resolveCollisions(this.player, this.levelManager.tileMap);
        }

        this.enemyManager.update(deltaTime, this.player, this.levelManager.tileMap);
        this.storyManager.checkTriggers(this.player);
        this.levelManager.checkExits(this.player);
        this.levelManager.update();

        this.camera.follow(this.player);
        this.camera.update();

        this.hud.update();

        if (this.player.health <= 0) {
            this.gameOver = true;
        }
    }

    draw(ctx) {
        ctx.clearRect(0, 0, this.width, this.height);

        ctx.fillStyle = '#0e1a0e';
        ctx.fillRect(0, 0, this.width, this.height);

        if (this.parallax) {
            this.parallax.update(this.camera.x);
            this.parallax.draw(ctx);
        }

        if (this.levelManager.tileMap) {
            this.levelManager.tileMap.drawLayer(ctx, this.camera, 'background');
            this.levelManager.tileMap.drawLayer(ctx, this.camera, 'terrain');
        }

        this.enemyManager.draw(ctx, this.camera);
        this.player.draw(ctx, this.camera);

        if (this.levelManager.tileMap) {
            this.levelManager.tileMap.drawLayer(ctx, this.camera, 'foreground');
        }

        this.hud.draw(ctx);
        this.storyManager.draw(ctx);
        this.levelManager.drawFade(ctx);

        if (this.debug) this.drawDebug(ctx);

        if (this.gameOver) this.drawGameOver(ctx);

        if (this.paused) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.fillStyle = '#ccaa55';
            ctx.font = 'bold 32px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('PAUSED', this.width / 2, this.height / 2);
            ctx.textAlign = 'left';
        }
    }

    drawGameOver(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.fillStyle = '#cc3333';
        ctx.font = 'bold 40px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('YOU DIED', this.width / 2, this.height / 2 - 30);
        ctx.fillStyle = '#ccaa55';
        ctx.font = '16px monospace';
        ctx.fillText('Press R to restart', this.width / 2, this.height / 2 + 20);
        ctx.textAlign = 'left';
    }

    drawDebug(ctx) {
        const p = this.player;
        const screen = this.camera.worldToScreen(p.x + p.hitboxOffsetX, p.y + p.hitboxOffsetY);
        ctx.strokeStyle = 'lime';
        ctx.lineWidth = 1;
        ctx.strokeRect(screen.x, screen.y, p.hitboxWidth, p.hitboxHeight);

        ctx.fillStyle = 'lime';
        ctx.font = '10px monospace';
        ctx.fillText(`pos: ${Math.round(p.x)}, ${Math.round(p.y)}`, 20, this.height - 40);
        ctx.fillText(`vel: ${p.vx.toFixed(1)}, ${p.vy.toFixed(1)}`, 20, this.height - 28);
        ctx.fillText(`state: ${p.currentState?.name}`, 20, this.height - 16);
        ctx.fillText(`ground: ${p.onGround}`, 20, this.height - 4);
    }

    restart() {
        this.gameOver = false;
        const startObj = this.levelManager.tileMap?.getObjectsByType('playerStart')[0];
        if (startObj) {
            this.player.init(startObj.x, startObj.y - this.player.height);
        }
    }
}

window.addEventListener('load', async () => {
    const canvas = document.getElementById('canvas1');
    const ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const game = new Game(canvas);
    await game.init();

    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.add('hidden');

    window.addEventListener('keydown', (e) => {
        if (e.key === 'r' && game.gameOver) game.restart();
    });

    let lastTime = 0;
    function animate(timestamp) {
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;
        game.update(deltaTime);
        game.draw(ctx);
        requestAnimationFrame(animate);
    }

    animate(0);
});
