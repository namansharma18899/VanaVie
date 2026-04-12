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
        this.lockY = false;

        this.scale = 1.0;
        this.targetScale = 1.0;
        this.scaleSmoothing = 0.04;
        this._zoomFocusX = null;
        this._zoomFocusY = null;
    }

    setWorldBounds(width, height) {
        this.worldWidth = width;
        this.worldHeight = height;
    }

    follow(target) {
        this.target = target;
    }

    zoomTo(scale, focusWorldX, focusWorldY) {
        this.targetScale = scale;
        this._zoomFocusX = focusWorldX ?? null;
        this._zoomFocusY = focusWorldY ?? null;
    }

    resetZoom() {
        this.targetScale = 1.0;
        this._zoomFocusX = null;
        this._zoomFocusY = null;
    }

    isZooming() {
        return Math.abs(this.scale - this.targetScale) > 0.005;
    }

    update() {
        if (this.scale !== this.targetScale) {
            this.scale += (this.targetScale - this.scale) * this.scaleSmoothing;
            if (Math.abs(this.scale - this.targetScale) < 0.001) {
                this.scale = this.targetScale;
            }
        }

        if (!this.target) return;

        const effectiveVW = this.viewportWidth / this.scale;
        const effectiveVH = this.viewportHeight / this.scale;

        let targetX;
        if (this._zoomFocusX !== null) {
            targetX = this._zoomFocusX - effectiveVW / 2;
        } else {
            targetX = this.target.x + this.target.width / 2 - effectiveVW / 2;
        }
        this.x += (targetX - this.x) * this.smoothing;

        if (this._zoomFocusY !== null) {
            const targetY = this._zoomFocusY - effectiveVH / 2;
            this.y += (targetY - this.y) * this.smoothing;
        } else if (!this.lockY && this.target.onGround) {
            const targetY = this.target.y + this.target.height / 2 - effectiveVH / 2;
            this.y += (targetY - this.y) * this.smoothing;
        }

        this.x = Math.round(this.x);
        this.y = Math.round(this.y);

        this.clamp();
    }

    clamp() {
        const effectiveVW = this.viewportWidth / this.scale;
        const effectiveVH = this.viewportHeight / this.scale;
        this.x = Math.max(0, Math.min(this.x, this.worldWidth - effectiveVW));
        this.y = Math.max(0, Math.min(this.y, this.worldHeight - effectiveVH));
    }

    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.x) * this.scale,
            y: (worldY - this.y) * this.scale,
        };
    }

    isVisible(worldX, worldY, width, height) {
        const effectiveVW = this.viewportWidth / this.scale;
        const effectiveVH = this.viewportHeight / this.scale;
        return (
            worldX + width > this.x &&
            worldX < this.x + effectiveVW &&
            worldY + height > this.y &&
            worldY < this.y + effectiveVH
        );
    }
}
