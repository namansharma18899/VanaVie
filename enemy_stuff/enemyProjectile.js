export class EnemyProjectile {
    constructor(x, y, direction, config = {}) {
        this.x = x;
        this.y = y;
        this.width = config.width || 9;
        this.height = config.height || 54;
        this.speed = config.speed || 5;
        this.direction = direction;
        this.damage = config.damage || 8;
        this.markedForDeletion = false;
        this.maxDistance = config.maxDistance || 350;
        this.distanceTraveled = 0;

        this.hitboxOffsetX = 0;
        this.hitboxOffsetY = 0;
        this.hitboxWidth = this.width;
        this.hitboxHeight = this.height;

        this.image = null;
        if (config.image) {
            this.image = config.image;
        }

        this.rotation = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    update(_deltaTime) {
        this.x += this.speed * this.direction;
        this.distanceTraveled += this.speed;
        if (this.distanceTraveled >= this.maxDistance) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx, camera) {
        const screenW = this.height;
        const screenH = this.width;
        if (!camera.isVisible(this.x, this.y, screenW, screenH)) return;
        const screen = camera.worldToScreen(this.x, this.y);
        const s = camera.scale;
        const sw = screenW * s;
        const sh = screenH * s;

        if (this.image?.complete && this.image.naturalWidth) {
            ctx.save();
            const cx = screen.x + sw / 2;
            const cy = screen.y + sh / 2;
            ctx.translate(cx, cy);
            ctx.rotate(this.rotation);
            ctx.drawImage(this.image, -this.width * s / 2, -this.height * s / 2, this.width * s, this.height * s);
            ctx.restore();
        } else {
            ctx.fillStyle = '#4488ff';
            ctx.fillRect(screen.x, screen.y, sw, sh);
        }
    }

    collidesWithPlayer(player) {
        const drawW = this.height;
        const drawH = this.width;
        const aLeft = this.x;
        const aRight = this.x + drawW;
        const aTop = this.y;
        const aBottom = this.y + drawH;

        const bLeft = player.x + player.hitboxOffsetX;
        const bRight = bLeft + player.hitboxWidth;
        const bTop = player.y + player.hitboxOffsetY;
        const bBottom = bTop + player.hitboxHeight;

        return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
    }
}
