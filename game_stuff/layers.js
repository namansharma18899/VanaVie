export class ParallaxLayer {
    constructor(image, speedModifier, gameHeight) {
        this.image = image;
        this.speedModifier = speedModifier;
        const scale = gameHeight / image.height;
        this.width = Math.ceil(image.width * scale);
        this.height = gameHeight;
        this.x = 0;
    }

    update(cameraX) {
        this.x = -(cameraX * this.speedModifier);
    }

    draw(ctx) {
        const canvasWidth = ctx.canvas.width;
        let startX = this.x % this.width;
        if (startX > 0) startX -= this.width;

        for (let x = startX; x < canvasWidth; x += this.width) {
            ctx.drawImage(this.image, x, 0, this.width, this.height);
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
