export class ParallaxLayer {
    constructor(image, speedModifier, gameHeight) {
        this.image = image;
        this.speedModifier = speedModifier;
        this.width = image.width;
        this.height = gameHeight;
        this.x = 0;
    }

    update(cameraX) {
        this.x = -(cameraX * this.speedModifier) % this.width;
    }

    draw(ctx) {
        ctx.drawImage(this.image, this.x, 0, this.width, this.height);
        ctx.drawImage(this.image, this.x + this.width, 0, this.width, this.height);
        if (this.x + this.width < ctx.canvas.width) {
            ctx.drawImage(this.image, this.x + this.width * 2, 0, this.width, this.height);
        }
    }
}

export class ParallaxBackground {
    constructor(layers) {
        this.layers = layers;
    }

    update(cameraX) {
        for (const layer of this.layers) {
            layer.update(cameraX);
        }
    }

    draw(ctx) {
        for (const layer of this.layers) {
            layer.draw(ctx);
        }
    }
}
