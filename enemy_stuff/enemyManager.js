import { Enemy, EnemyState } from './enemy.js';
import { resolveCollisions } from '../game_stuff/collision.js';

export class EnemyManager {
    constructor(game) {
        this.game = game;
        this.enemies = [];
        this.enemyConfigs = {};
    }

    registerEnemyType(typeName, config) {
        this.enemyConfigs[typeName] = config;
    }

    spawnFromMap(tileMap) {
        this.enemies = [];
        const spawns = tileMap.getObjectsByType('enemy');
        for (const spawn of spawns) {
            const typeName = spawn.properties.enemyType || spawn.name || 'default';
            this.spawnManual(typeName, spawn.x, spawn.y, {
                patrolLeft: spawn.properties.patrolLeft,
                patrolRight: spawn.properties.patrolRight,
            });
        }
    }

    spawnManual(typeName, x, y, overrides = {}) {
        const baseConfig = this.enemyConfigs[typeName] || this.enemyConfigs['default'] || {};
        const config = {
            ...baseConfig,
            x,
            y: y - (baseConfig.drawHeight || baseConfig.spriteHeight || 64),
            patrolLeft: overrides.patrolLeft ?? x - 100,
            patrolRight: overrides.patrolRight ?? x + 100,
            ...overrides,
        };
        const enemy = new Enemy(this.game, config);
        this.enemies.push(enemy);
        return enemy;
    }

    clear() {
        this.enemies = [];
    }

    update(deltaTime, player, tileMap) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            enemy.update(deltaTime, player);
            resolveCollisions(enemy, tileMap);

            if (enemy.markedForDeletion) {
                this.enemies.splice(i, 1);
                continue;
            }

            this.checkProjectileHits(enemy, player);
        }
    }

    checkProjectileHits(enemy, player) {
        for (const projectile of player.projectiles) {
            if (projectile.markedForDeletion) continue;
            if (projectile.collidesWith(enemy)) {
                projectile.markedForDeletion = true;
                enemy.takeDamage(player.damage);
                if (this.game.audio) this.game.audio.play('enemyHurt');
            }
        }
    }

    draw(ctx, camera) {
        for (const enemy of this.enemies) {
            enemy.draw(ctx, camera);
        }
    }
}
