export class StoryManager {
    constructor(game) {
        this.game = game;
        this.triggers = [];
        this.firedTriggers = new Set();
        this.activeDialog = null;
        this.dialogQueue = [];
        this.dialogIndex = 0;
        this.displayedText = '';
        this.textTimer = 0;
        this.textSpeed = 30;
        this.waitingForInput = false;
    }

    loadTriggers(tileMap) {
        this.triggers = tileMap.getObjectsByType('story');
        this.activeDialog = null;
        this.dialogQueue = [];
    }

    checkTriggers(player) {
        if (this.activeDialog) return;

        const px = player.x + player.hitboxOffsetX;
        const py = player.y + player.hitboxOffsetY;
        const pw = player.hitboxWidth;
        const ph = player.hitboxHeight;

        for (const trigger of this.triggers) {
            if (this.firedTriggers.has(trigger.name) && trigger.properties.oneShot) continue;

            if (px < trigger.x + trigger.width && px + pw > trigger.x &&
                py < trigger.y + trigger.height && py + ph > trigger.y) {
                this.startDialog(trigger);
                break;
            }
        }
    }

    startDialog(trigger) {
        const text = trigger.properties.text || trigger.properties.dialog || '';
        if (!text) return;

        this.dialogQueue = text.split('|');
        this.dialogIndex = 0;
        this.displayedText = '';
        this.textTimer = 0;
        this.waitingForInput = false;
        this.activeDialog = trigger;

        if (trigger.properties.oneShot) {
            this.firedTriggers.add(trigger.name);
        }
    }

    update(deltaTime, input) {
        if (!this.activeDialog) return;

        const kb = this.game.input.keyBindings;
        const currentMessage = this.dialogQueue[this.dialogIndex];

        if (this.waitingForInput) {
            if (input.includes(kb.interact) || input.includes(kb.attack)) {
                this.dialogIndex++;
                if (this.dialogIndex >= this.dialogQueue.length) {
                    this.activeDialog = null;
                    this.dialogQueue = [];
                    return;
                }
                this.displayedText = '';
                this.textTimer = 0;
                this.waitingForInput = false;
            }
            return;
        }

        this.textTimer += deltaTime;
        const charsToShow = Math.floor(this.textTimer / this.textSpeed);
        if (charsToShow >= currentMessage.length) {
            this.displayedText = currentMessage;
            this.waitingForInput = true;
        } else {
            this.displayedText = currentMessage.substring(0, charsToShow);
        }
    }

    draw(ctx) {
        if (!this.activeDialog) return;

        const canvasW = ctx.canvas.width;
        const canvasH = ctx.canvas.height;
        const boxH = 100;
        const boxY = canvasH - boxH - 20;
        const boxX = 40;
        const boxW = canvasW - 80;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.strokeStyle = '#ccaa55';
        ctx.lineWidth = 2;
        roundRect(ctx, boxX, boxY, boxW, boxH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '16px monospace';
        ctx.textBaseline = 'top';

        const speaker = this.activeDialog.properties.speaker || '';
        if (speaker) {
            ctx.fillStyle = '#ccaa55';
            ctx.font = 'bold 14px monospace';
            ctx.fillText(speaker, boxX + 16, boxY + 12);
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px monospace';
        }

        const textY = speaker ? boxY + 34 : boxY + 16;
        wrapText(ctx, this.displayedText, boxX + 16, textY, boxW - 32, 22);

        if (this.waitingForInput) {
            ctx.fillStyle = '#ccaa55';
            ctx.font = '12px monospace';
            ctx.fillText('Press [E] to continue...', boxX + boxW - 180, boxY + boxH - 18);
        }
    }

    isActive() {
        return this.activeDialog !== null;
    }
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    for (const word of words) {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== '') {
            ctx.fillText(line.trim(), x, currentY);
            line = word + ' ';
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line.trim(), x, currentY);
}
