export class Projectile {
    constructor(x, y, direction, config = {}) {
        this.x = x;
        this.y = y;
        this.width = config.width || 16;
        this.height = config.height || 8;
        this.speed = config.speed || 8;
        this.direction = direction;
        this.markedForDeletion = false;
        this.maxDistance = config.maxDistance || 400;
        this.distanceTraveled = 0;

        this.hitboxOffsetX = 0;
        this.hitboxOffsetY = 0;
        this.hitboxWidth = this.width;
        this.hitboxHeight = this.height;

        this.image = null;
        if (config.src) {
            this.image = new Image();
            this.image.src = config.src;
        }
    }

    update(_deltaTime) {
        this.x += this.speed * this.direction;
        this.distanceTraveled += this.speed;
        if (this.distanceTraveled >= this.maxDistance) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx, camera) {
        const screen = camera.worldToScreen(this.x, this.y);
        if (this.image?.complete && this.image.naturalWidth) {
            ctx.save();
            if (this.direction < 0) {
                ctx.translate(screen.x + this.width, screen.y);
                ctx.scale(-1, 1);
                ctx.drawImage(this.image, 0, 0, this.width, this.height);
            } else {
                ctx.drawImage(this.image, screen.x, screen.y, this.width, this.height);
            }
            ctx.restore();
        } else {
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(screen.x, screen.y, this.width, this.height);
        }
    }

    collidesWith(entity) {
        const aLeft = this.x;
        const aRight = this.x + this.width;
        const aTop = this.y;
        const aBottom = this.y + this.height;

        const bLeft = entity.x + entity.hitboxOffsetX;
        const bRight = bLeft + entity.hitboxWidth;
        const bTop = entity.y + entity.hitboxOffsetY;
        const bBottom = bTop + entity.hitboxHeight;

        return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
    }
}
