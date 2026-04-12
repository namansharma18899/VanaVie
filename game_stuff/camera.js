export class Camera {
    constructor(viewportWidth, viewportHeight) {
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;
        this.x = 0;
        this.y = 0;
        this.worldWidth = 0;
        this.worldHeight = 0;
        this.smoothing = 0.08;
        this.target = null;
    }

    setWorldBounds(width, height) {
        this.worldWidth = width;
        this.worldHeight = height;
    }

    follow(target) {
        this.target = target;
    }

    update() {
        if (!this.target) return;

        const targetX = this.target.x + this.target.width / 2 - this.viewportWidth / 2;
        const targetY = this.target.y + this.target.height / 2 - this.viewportHeight / 2;

        this.x += (targetX - this.x) * this.smoothing;
        this.y += (targetY - this.y) * this.smoothing;

        this.clamp();
    }

    clamp() {
        this.x = Math.max(0, Math.min(this.x, this.worldWidth - this.viewportWidth));
        this.y = Math.max(0, Math.min(this.y, this.worldHeight - this.viewportHeight));
    }

    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.x,
            y: worldY - this.y,
        };
    }

    isVisible(worldX, worldY, width, height) {
        return (
            worldX + width > this.x &&
            worldX < this.x + this.viewportWidth &&
            worldY + height > this.y &&
            worldY < this.y + this.viewportHeight
        );
    }
}
