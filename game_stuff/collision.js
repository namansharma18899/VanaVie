export function resolveCollisions(entity, tileMap) {
    resolveHorizontal(entity, tileMap);
    resolveVertical(entity, tileMap);
}

function resolveHorizontal(entity, tileMap) {
    entity.x += entity.vx;

    const left = entity.x + entity.hitboxOffsetX;
    const right = left + entity.hitboxWidth;
    const top = entity.y + entity.hitboxOffsetY;
    const bottom = top + entity.hitboxHeight;

    const topRow = Math.floor(top / tileMap.tileHeight);
    const bottomRow = Math.floor((bottom - 1) / tileMap.tileHeight);

    if (entity.vx > 0) {
        const col = Math.floor(right / tileMap.tileWidth);
        for (let row = topRow; row <= bottomRow; row++) {
            if (tileMap.isSolid(col * tileMap.tileWidth, row * tileMap.tileHeight)) {
                entity.x = col * tileMap.tileWidth - entity.hitboxWidth - entity.hitboxOffsetX;
                entity.vx = 0;
                break;
            }
        }
    } else if (entity.vx < 0) {
        const col = Math.floor(left / tileMap.tileWidth);
        for (let row = topRow; row <= bottomRow; row++) {
            if (tileMap.isSolid(col * tileMap.tileWidth, row * tileMap.tileHeight)) {
                entity.x = (col + 1) * tileMap.tileWidth - entity.hitboxOffsetX;
                entity.vx = 0;
                break;
            }
        }
    }
}

function resolveVertical(entity, tileMap) {
    entity.y += entity.vy;

    const left = entity.x + entity.hitboxOffsetX;
    const right = left + entity.hitboxWidth;
    const top = entity.y + entity.hitboxOffsetY;
    const bottom = top + entity.hitboxHeight;

    const leftCol = Math.floor(left / tileMap.tileWidth);
    const rightCol = Math.floor((right - 1) / tileMap.tileWidth);

    if (entity.vy > 0) {
        const row = Math.floor(bottom / tileMap.tileHeight);
        for (let col = leftCol; col <= rightCol; col++) {
            if (tileMap.isSolid(col * tileMap.tileWidth, row * tileMap.tileHeight)) {
                entity.y = row * tileMap.tileHeight - entity.hitboxHeight - entity.hitboxOffsetY;
                entity.vy = 0;
                entity.onGround = true;
                return;
            }
        }
    } else if (entity.vy < 0) {
        const row = Math.floor(top / tileMap.tileHeight);
        for (let col = leftCol; col <= rightCol; col++) {
            if (tileMap.isSolid(col * tileMap.tileWidth, row * tileMap.tileHeight)) {
                entity.y = (row + 1) * tileMap.tileHeight - entity.hitboxOffsetY;
                entity.vy = 0;
                return;
            }
        }
    }

    entity.onGround = false;
}

export function isOnGround(entity, tileMap) {
    const left = entity.x + entity.hitboxOffsetX;
    const right = left + entity.hitboxWidth;
    const bottom = entity.y + entity.hitboxOffsetY + entity.hitboxHeight + 1;

    const leftCol = Math.floor(left / tileMap.tileWidth);
    const rightCol = Math.floor((right - 1) / tileMap.tileWidth);
    const row = Math.floor(bottom / tileMap.tileHeight);

    for (let col = leftCol; col <= rightCol; col++) {
        if (tileMap.isSolid(col * tileMap.tileWidth, row * tileMap.tileHeight)) {
            return true;
        }
    }
    return false;
}

export function checkEntityCollision(a, b) {
    const aLeft = a.x + a.hitboxOffsetX;
    const aRight = aLeft + a.hitboxWidth;
    const aTop = a.y + a.hitboxOffsetY;
    const aBottom = aTop + a.hitboxHeight;

    const bLeft = b.x + b.hitboxOffsetX;
    const bRight = bLeft + b.hitboxWidth;
    const bTop = b.y + b.hitboxOffsetY;
    const bBottom = bTop + b.hitboxHeight;

    return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
}
