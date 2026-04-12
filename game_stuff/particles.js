class Particle {
    constructor(x, y, config) {
        this.x = x;
        this.y = y;
        this.vx = config.vx || 0;
        this.vy = config.vy || 0;
        this.size = config.size || 3;
        this.color = config.color || '#fff';
        this.alpha = config.alpha ?? 1;
        this.life = config.life || 3000;
        this.maxLife = this.life;
        this.gravity = config.gravity ?? 0;
        this.wobbleSpeed = config.wobbleSpeed ?? 0;
        this.wobbleAmp = config.wobbleAmp ?? 0;
        this.wobbleOffset = Math.random() * Math.PI * 2;
        this.fadeIn = config.fadeIn ?? false;
        this.pulseSpeed = config.pulseSpeed ?? 0;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = config.rotationSpeed ?? 0;
        this.shape = config.shape || 'circle';
    }

    update(deltaTime) {
        const dt = deltaTime / 1000;
        this.life -= deltaTime;

        this.vy += this.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (this.wobbleSpeed > 0) {
            const elapsed = (this.maxLife - this.life) / 1000;
            this.x += Math.sin(elapsed * this.wobbleSpeed + this.wobbleOffset) * this.wobbleAmp * dt;
        }

        this.rotation += this.rotationSpeed * dt;

        const lifeRatio = this.life / this.maxLife;
        if (this.pulseSpeed > 0) {
            const elapsed = (this.maxLife - this.life) / 1000;
            this.alpha = 0.3 + 0.7 * Math.abs(Math.sin(elapsed * this.pulseSpeed));
        } else if (this.fadeIn && lifeRatio > 0.8) {
            this.alpha = (1 - lifeRatio) / 0.2;
        } else {
            this.alpha = Math.min(1, lifeRatio * 2);
        }
    }

    get isDead() {
        return this.life <= 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;

        if (this.shape === 'leaf') {
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.beginPath();
            ctx.ellipse(0, 0, this.size * 1.8, this.size * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.shape === 'rect') {
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 0.6);
        } else {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class ParticleEmitter {
    constructor(config) {
        this.particles = [];
        this.rate = config.rate || 2;
        this.timer = 0;
        this.config = config;
        this.canvasWidth = config.canvasWidth || 960;
        this.canvasHeight = config.canvasHeight || 540;
        this.active = true;
    }

    update(deltaTime) {
        if (this.active) {
            this.timer += deltaTime;
            const interval = 1000 / this.rate;
            while (this.timer >= interval) {
                this.timer -= interval;
                this.spawn();
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(deltaTime);
            if (this.particles[i].isDead) {
                this.particles.splice(i, 1);
            }
        }
    }

    spawn() {
        const c = this.config;
        const x = (c.spawnX ?? 0) + Math.random() * (c.spawnWidth ?? this.canvasWidth);
        const y = (c.spawnY ?? -10) + Math.random() * (c.spawnHeight ?? 0);

        const vx = (c.baseVX ?? 0) + (Math.random() - 0.5) * (c.spreadVX ?? 10);
        const vy = (c.baseVY ?? 0) + (Math.random() - 0.5) * (c.spreadVY ?? 5);
        const size = (c.minSize ?? 2) + Math.random() * ((c.maxSize ?? 4) - (c.minSize ?? 2));
        const life = (c.minLife ?? 2000) + Math.random() * ((c.maxLife ?? 5000) - (c.minLife ?? 2000));

        const colors = c.colors || ['#fff'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        this.particles.push(new Particle(x, y, {
            vx, vy, size, color, life,
            gravity: c.gravity ?? 0,
            wobbleSpeed: c.wobbleSpeed ?? 0,
            wobbleAmp: c.wobbleAmp ?? 0,
            fadeIn: c.fadeIn ?? false,
            pulseSpeed: c.pulseSpeed ?? 0,
            rotationSpeed: c.rotationSpeed ?? 0,
            shape: c.shape || 'circle',
        }));
    }

    draw(ctx) {
        for (const p of this.particles) {
            p.draw(ctx);
        }
    }
}

const PRESETS = {
    wind_leaves: {
        rate: 1.5,
        spawnY: -20,
        spawnHeight: 0,
        baseVX: 40,
        spreadVX: 30,
        baseVY: 25,
        spreadVY: 15,
        gravity: 8,
        wobbleSpeed: 3,
        wobbleAmp: 40,
        minSize: 2,
        maxSize: 5,
        minLife: 6000,
        maxLife: 10000,
        rotationSpeed: 2,
        shape: 'leaf',
        colors: ['#5a7a3a', '#7a9a4a', '#8b6914', '#6b8a2a', '#a08030'],
    },
    wind_dust: {
        rate: 3,
        spawnX: -20,
        spawnWidth: 0,
        spawnY: 200,
        spawnHeight: 340,
        baseVX: 60,
        spreadVX: 30,
        baseVY: -5,
        spreadVY: 10,
        gravity: 0,
        wobbleSpeed: 2,
        wobbleAmp: 15,
        minSize: 1,
        maxSize: 3,
        minLife: 4000,
        maxLife: 7000,
        shape: 'circle',
        colors: ['#c8b080', '#d4c090', '#b0a070', '#e0d0a0'],
    },
    fireflies: {
        rate: 0.8,
        spawnY: 100,
        spawnHeight: 400,
        baseVX: 5,
        spreadVX: 20,
        baseVY: -8,
        spreadVY: 12,
        gravity: 0,
        wobbleSpeed: 1.5,
        wobbleAmp: 30,
        minSize: 1.5,
        maxSize: 3,
        minLife: 4000,
        maxLife: 8000,
        pulseSpeed: 3,
        shape: 'circle',
        colors: ['#ffee44', '#aaff44', '#eeff88'],
    },
    snow: {
        rate: 4,
        spawnY: -10,
        spawnHeight: 0,
        baseVX: 8,
        spreadVX: 20,
        baseVY: 30,
        spreadVY: 15,
        gravity: 5,
        wobbleSpeed: 2,
        wobbleAmp: 20,
        minSize: 1,
        maxSize: 4,
        minLife: 8000,
        maxLife: 12000,
        shape: 'circle',
        colors: ['#fff', '#eef', '#dde'],
    },
};

export class EnvironmentFX {
    constructor(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.emitters = [];
    }

    setPreset(presetName) {
        this.emitters = [];
        const preset = PRESETS[presetName];
        if (!preset) return;
        this.addEmitter({ ...preset, canvasWidth: this.canvasWidth, canvasHeight: this.canvasHeight });
    }

    addEmitter(config) {
        config.canvasWidth = config.canvasWidth || this.canvasWidth;
        config.canvasHeight = config.canvasHeight || this.canvasHeight;
        const emitter = new ParticleEmitter(config);
        this.emitters.push(emitter);
        return emitter;
    }

    clear() {
        this.emitters = [];
    }

    update(deltaTime) {
        for (const emitter of this.emitters) {
            emitter.update(deltaTime);
        }
    }

    draw(ctx) {
        for (const emitter of this.emitters) {
            emitter.draw(ctx);
        }
    }
}
