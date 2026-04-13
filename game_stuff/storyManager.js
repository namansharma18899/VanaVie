export class StoryManager {
    constructor(game) {
        this.game = game;
        this.triggers = [];
        this.firedTriggers = new Set();
        this.activeDialog = null;
        this.dialogQueue = [];
        this.dialogIndex = 0;
        this.displayedText = '';
        this.currentSpeaker = '';
        this.textTimer = 0;
        this.textSpeed = 30;
        this.waitingForInput = false;

        this.portraitImages = {};
        this.onDialogStart = null;
        this.onDialogEnd = null;
        this._cooldown = 0;
    }

    loadTriggers(tileMap) {
        this.triggers = tileMap.getObjectsByType('story');
        this.activeDialog = null;
        this.dialogQueue = [];
    }

    addManualTrigger(trigger) {
        this.triggers.push(trigger);
    }

    checkTriggers(player) {
        if (this.activeDialog || this._cooldown > 0) return;

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

    startDialogDirect(config) {
        if (this._cooldown > 0) return;
        const text = config.text || '';
        if (!text) return;

        this._parseAndStartDialog(text, config);
    }

    startDialog(trigger) {
        const text = trigger.properties.text || trigger.properties.dialog || '';
        if (!text) return;

        if (trigger.properties.oneShot) {
            this.firedTriggers.add(trigger.name);
        }

        this._parseAndStartDialog(text, trigger.properties);
        this.activeDialog = trigger;
    }

    _parseAndStartDialog(text, properties) {
        const rawLines = text.split('|');
        this.dialogQueue = rawLines.map(line => {
            const colonIdx = line.indexOf(':');
            if (colonIdx > 0 && colonIdx < 30) {
                const speaker = line.substring(0, colonIdx).trim();
                const msg = line.substring(colonIdx + 1).trim();
                return { speaker, text: msg };
            }
            return { speaker: properties.speaker || '', text: line.trim() };
        });

        if (properties.portraits) {
            try {
                const portraitMap = typeof properties.portraits === 'string'
                    ? JSON.parse(properties.portraits)
                    : properties.portraits;
                for (const [name, src] of Object.entries(portraitMap)) {
                    if (!this.portraitImages[name]) {
                        const img = new Image();
                        img.src = src;
                        this.portraitImages[name] = img;
                    }
                }
            } catch (_e) { /* ignore bad JSON */ }
        }

        this.dialogIndex = 0;
        this.displayedText = '';
        this.currentSpeaker = this.dialogQueue[0]?.speaker || '';
        this.textTimer = 0;
        this.waitingForInput = false;
        this.activeDialog = {};

        if (this.onDialogStart) {
            this.onDialogStart(properties);
        }
    }

    update(deltaTime, input) {
        if (this._cooldown > 0) this._cooldown -= deltaTime;
        if (!this.activeDialog) return;

        const kb = this.game.input.keyBindings;
        const entry = this.dialogQueue[this.dialogIndex];
        const currentMessage = entry.text;

        if (this.waitingForInput) {
            if (input.includes(kb.interact) || input.includes(kb.attack)) {
                this.dialogIndex++;
                if (this.dialogIndex >= this.dialogQueue.length) {
                    this._endDialog();
                    return;
                }
                const next = this.dialogQueue[this.dialogIndex];
                this.currentSpeaker = next.speaker;
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

    _endDialog() {
        const props = this.activeDialog?.properties || {};
        this.activeDialog = null;
        this.dialogQueue = [];
        this.currentSpeaker = '';
        this._cooldown = 300;

        if (this.onDialogEnd) {
            this.onDialogEnd(props);
        }
    }

    draw(ctx) {
        if (!this.activeDialog) return;

        const canvasW = ctx.canvas.width;
        const canvasH = ctx.canvas.height;
        const boxH = 110;
        const boxY = canvasH - boxH - 20;
        const boxX = 40;
        const boxW = canvasW - 80;

        let portraitSize = 0;
        const portrait = this.portraitImages[this.currentSpeaker];
        const hasPortrait = portrait?.complete && portrait.naturalWidth;
        if (hasPortrait) portraitSize = 80;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.strokeStyle = '#ccaa55';
        ctx.lineWidth = 2;
        roundRect(ctx, boxX, boxY, boxW, boxH, 8);
        ctx.fill();
        ctx.stroke();

        if (hasPortrait) {
            const pX = boxX + 10;
            const pY = boxY + (boxH - portraitSize) / 2;
            ctx.strokeStyle = '#887744';
            ctx.lineWidth = 1;
            ctx.strokeRect(pX, pY, portraitSize, portraitSize);
            ctx.drawImage(portrait, pX, pY, portraitSize, portraitSize);
        }

        const textStartX = boxX + 16 + (hasPortrait ? portraitSize + 10 : 0);
        const textW = boxW - 32 - (hasPortrait ? portraitSize + 10 : 0);

        if (this.currentSpeaker) {
            ctx.fillStyle = '#ccaa55';
            ctx.font = 'bold 14px monospace';
            ctx.textBaseline = 'top';
            ctx.fillText(this.currentSpeaker, textStartX, boxY + 10);
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = '15px monospace';
        ctx.textBaseline = 'top';
        const textY = this.currentSpeaker ? boxY + 32 : boxY + 16;
        wrapText(ctx, this.displayedText, textStartX, textY, textW, 20);

        if (this.waitingForInput) {
            ctx.fillStyle = '#ccaa55';
            ctx.font = '12px monospace';
            ctx.textBaseline = 'top';
            ctx.fillText('Press [E] to continue...', boxX + boxW - 180, boxY + boxH - 18);
        }
    }

    isActive() {
        return this.activeDialog !== null;
    }

    isOnCooldown() {
        return this._cooldown > 0;
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
