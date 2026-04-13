export class NPC {
    constructor(game, config) {
        this.game = game;
        this.config = config;

        this.name = config.name || 'NPC';
        this.x = config.x || 0;
        this.y = config.y || 0;
        this.spriteWidth = config.spriteWidth || 128;
        this.spriteHeight = config.spriteHeight || 128;
        this.width = config.drawWidth || this.spriteWidth;
        this.height = config.drawHeight || this.spriteHeight;
        this.facingRight = config.facingRight ?? true;

        this.image = null;
        if (config.spriteSrc) {
            this.image = new Image();
            this.image.src = config.spriteSrc;
        }

        this.frameX = 0;
        this.frameY = 0;
        this.maxFrame = (config.idleFrames ?? 6) - 1;
        this.fps = config.fps || 8;
        this.frameTimer = 0;

        this.interactRange = config.interactRange || 100;
        this.dialog = config.dialog || null;
        this.hasInteracted = false;
        this.oneShot = config.oneShot ?? false;

        this.cinematicZoom = config.cinematicZoom ?? true;
        this.zoomScale = config.zoomScale || 1.3;
    }

    update(deltaTime) {
        this.frameTimer += deltaTime;
        const frameInterval = 1000 / this.fps;
        if (this.frameTimer >= frameInterval) {
            this.frameTimer -= frameInterval;
            this.frameX = this.frameX < this.maxFrame ? this.frameX + 1 : 0;
        }
    }

    draw(ctx, camera) {
        if (!camera.isVisible(this.x, this.y, this.width, this.height)) return;

        const img = this.image;
        if (!img?.complete || !img.naturalWidth) return;

        const screen = camera.worldToScreen(this.x, this.y);
        const s = camera.scale;
        const sx = Math.round(screen.x);
        const sy = Math.round(screen.y);
        const dw = Math.round(this.width * s);
        const dh = Math.round(this.height * s);

        ctx.save();
        if (!this.facingRight) {
            ctx.translate(sx + dw, sy);
            ctx.scale(-1, 1);
            ctx.drawImage(
                img,
                this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                this.spriteWidth, this.spriteHeight,
                0, 0,
                dw, dh
            );
        } else {
            ctx.drawImage(
                img,
                this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                this.spriteWidth, this.spriteHeight,
                sx, sy,
                dw, dh
            );
        }
        ctx.restore();
    }

    drawPrompt(ctx, camera, player) {
        if (this.oneShot && this.hasInteracted) return;

        const dist = this._distanceTo(player);
        if (dist > this.interactRange) return;

        const screen = camera.worldToScreen(this.x, this.y);
        const s = camera.scale;
        const alpha = Math.max(0, 1 - dist / this.interactRange) *
                      (0.7 + 0.3 * Math.sin(performance.now() / 400));

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ccaa55';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`[E] Talk to ${this.name}`, screen.x + (this.width * s) / 2, screen.y - 6);
        ctx.restore();
    }

    _distanceTo(player) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        return Math.hypot(px - cx, py - cy);
    }

    isPlayerNearby(player) {
        return this._distanceTo(player) < this.interactRange;
    }
}

export class NPCManager {
    constructor(game) {
        this.game = game;
        this.npcs = [];
    }

    spawnManual(config) {
        const npc = new NPC(this.game, config);
        this.npcs.push(npc);
        return npc;
    }

    spawnFromMap(tileMap) {
        const objs = tileMap.getObjectsByType('npc');
        for (const obj of objs) {
            this.spawnManual({
                name: obj.name,
                x: obj.x,
                y: obj.y - (obj.properties.drawHeight || 128),
                ...obj.properties,
            });
        }
    }

    clear() {
        this.npcs = [];
    }

    update(deltaTime) {
        for (const npc of this.npcs) {
            npc.update(deltaTime);
        }
    }

    checkInteraction(player, input) {
        if (this.game.storyManager.isActive() || this.game.storyManager.isOnCooldown()) return;

        const kb = this.game.input.keyBindings;
        if (!input.includes(kb.interact)) return;

        for (const npc of this.npcs) {
            if (npc.oneShot && npc.hasInteracted) continue;
            if (!npc.isPlayerNearby(player)) continue;
            if (!npc.dialog) continue;

            npc.hasInteracted = true;

            const midX = (npc.x + npc.width / 2 + player.x + player.width / 2) / 2;
            const midY = (npc.y + npc.height / 2 + player.y + player.height / 2) / 2;

            player.facingRight = npc.x + npc.width / 2 > player.x + player.width / 2;

            if (npc.cinematicZoom) {
                this.game.camera.zoomTo(npc.zoomScale, midX, midY);
            }

            this.game.storyManager.startDialogDirect(npc.dialog);
            break;
        }
    }

    draw(ctx, camera) {
        for (const npc of this.npcs) {
            npc.draw(ctx, camera);
        }
    }

    drawPrompts(ctx, camera, player) {
        for (const npc of this.npcs) {
            npc.drawPrompt(ctx, camera, player);
        }
    }
}
