export class HUD {
    constructor(game) {
        this.game = game;
        this.healthLerp = 0.08;
        this.displayHealth = 0;
    }

    update() {
        if (!this.game.player) return;
        const target = this.game.player.health / this.game.player.maxHealth;
        this.displayHealth += (target - this.displayHealth) * this.healthLerp;
    }

    draw(ctx) {
        if (!this.game.player) return;
        this.drawHealthBar(ctx);
        this.drawLevelName(ctx);
    }

    drawHealthBar(ctx) {
        const x = 20;
        const y = 20;
        const w = 200;
        const h = 20;
        const r = 4;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.roundRect(x - 2, y - 2, w + 4, h + 4, r + 2);
        ctx.fill();

        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fill();

        const healthWidth = w * Math.max(0, this.displayHealth);
        const healthColor = this.displayHealth > 0.5 ? '#44cc44' :
                           this.displayHealth > 0.25 ? '#ccaa22' : '#cc3333';
        ctx.fillStyle = healthColor;
        ctx.beginPath();
        ctx.roundRect(x, y, healthWidth, h, r);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px monospace';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        const hp = this.game.player.health;
        const maxHp = this.game.player.maxHealth;
        ctx.fillText(`${Math.ceil(hp)} / ${maxHp}`, x + w / 2, y + h / 2);
        ctx.textAlign = 'left';
    }

    drawLevelName(ctx) {
        if (!this.game.levelManager.currentLevelName) return;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '11px monospace';
        ctx.textBaseline = 'top';
        const name = this.game.levelManager.currentLevelName.replace(/_/g, ' ');
        ctx.fillText(name, 20, 48);
    }
}
