import { Enemy } from './enemy.js';
import { resolveCollisions, checkEntityCollision } from '../game_stuff/collision.js';

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
            const baseConfig = this.enemyConfigs[typeName] || this.enemyConfigs['default'] || {};
            const config = {
                ...baseConfig,
                x: spawn.x,
                y: spawn.y - (baseConfig.drawHeight || baseConfig.spriteHeight || 64),
                patrolLeft: spawn.properties.patrolLeft ?? spawn.x - 100,
                patrolRight: spawn.properties.patrolRight ?? spawn.x + 100,
            };
            this.enemies.push(new Enemy(this.game, config));
        }
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
