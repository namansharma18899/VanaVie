import { Enemy, EnemyState } from './enemy.js';
import { resolveCollisions, checkEntityCollision } from '../game_stuff/collision.js';

export class EnemyManager {
    constructor(game) {
        this.game = game;
        this.enemies = [];
        this.enemyConfigs = {};
        this.contactDamageCooldowns = new WeakMap();
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
            this.checkEnemyProjectileHits(enemy, player);
            this.checkContactDamage(enemy, player, deltaTime);
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

    checkEnemyProjectileHits(enemy, player) {
        for (const projectile of enemy.projectiles) {
            if (projectile.markedForDeletion) continue;
            if (projectile.collidesWith(player)) {
                projectile.markedForDeletion = true;
                player.takeDamage(enemy.config.projectileConfig?.damage || enemy.damage);
            }
        }
    }

    checkContactDamage(enemy, player, deltaTime) {
        let cooldown = this.contactDamageCooldowns.get(enemy) || 0;
        if (cooldown > 0) {
            this.contactDamageCooldowns.set(enemy, cooldown - deltaTime);
            return;
        }
        if (checkEntityCollision(enemy, player)) {
            player.takeDamage(enemy.damage);
            this.contactDamageCooldowns.set(enemy, 800);
        }
    }

    draw(ctx, camera) {
        for (const enemy of this.enemies) {
            enemy.draw(ctx, camera);
        }
    }
}
