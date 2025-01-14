import * as common from './common.mjs';
import { RGBA, Vector2, Vector3, sceneGetTile, updatePlayer, PLAYER_SIZE, SERVER_PORT, SCENE, clamp, properMod } from './common.mjs';
const EPS = 1e-6;
const NEAR_CLIPPING_PLANE = 0.1;
const FAR_CLIPPING_PLANE = 10.0;
const FOV = Math.PI * 0.5;
const PLAYER_RADIUS = 0.5;
const SCREEN_FACTOR = 30;
const SCREEN_WIDTH = Math.floor(16 * SCREEN_FACTOR);
const SCREEN_HEIGHT = Math.floor(9 * SCREEN_FACTOR);
const SCENE_FLOOR1 = new RGBA(0.094, 0.094 + 0.07, 0.094 + 0.07, 1.0);
const SCENE_FLOOR2 = new RGBA(0.188, 0.188 + 0.07, 0.188 + 0.07, 1.0);
const SCENE_CEILING1 = new RGBA(0.094 + 0.07, 0.094, 0.094, 1.0);
const SCENE_CEILING2 = new RGBA(0.188 + 0.07, 0.188, 0.188, 1.0);
const ITEM_FREQ = 0.7;
const ITEM_AMP = 0.07;
const BOMB_LIFETIME = 2;
const BOMB_THROW_VELOCITY = 5;
const BOMB_GRAVITY = 10;
const BOMB_DAMP = 0.8;
const BOMB_SCALE = 0.25;
const BOMB_PARTICLE_COUNT = 50;
const PARTICLE_LIFETIME = 1.0;
const PARTICLE_DAMP = 0.8;
const PARTICLE_SCALE = 0.05;
const PARTICLE_MAX_SPEED = 8;
const PARTICLE_COLOR = new RGBA(1, 0.5, 0.15, 1);
const MINIMAP = false;
const MINIMAP_SPRITES = true;
const MINIMAP_SPRITE_SIZE = 0.2;
const MINIMAP_SCALE = 0.07;
const SPRITE_ANGLES_COUNT = 8;
const CONTROL_KEYS = {
    'ArrowLeft': common.Moving.TurningLeft,
    'ArrowRight': common.Moving.TurningRight,
    'ArrowUp': common.Moving.MovingForward,
    'ArrowDown': common.Moving.MovingBackward,
    'KeyA': common.Moving.TurningLeft,
    'KeyD': common.Moving.TurningRight,
    'KeyW': common.Moving.MovingForward,
    'KeyS': common.Moving.MovingBackward,
};
function createSpritePool() {
    return {
        items: [],
        length: 0,
    };
}
function resetSpritePool(spritePool) {
    spritePool.length = 0;
}
function strokeLine(ctx, p1, p2) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
}
function snap(x, dx) {
    if (dx > 0)
        return Math.ceil(x + Math.sign(dx) * EPS);
    if (dx < 0)
        return Math.floor(x + Math.sign(dx) * EPS);
    return x;
}
function hittingCell(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return new Vector2(Math.floor(p2.x + Math.sign(dx) * EPS), Math.floor(p2.y + Math.sign(dy) * EPS));
}
function rayStep(p1, p2) {
    let p3 = p2.clone();
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (dx !== 0) {
        const k = dy / dx;
        const c = p1.y - k * p1.x;
        {
            const x3 = snap(p2.x, dx);
            const y3 = x3 * k + c;
            p3.set(x3, y3);
        }
        if (k !== 0) {
            const y3 = snap(p2.y, dy);
            const x3 = (y3 - c) / k;
            const p3t = new Vector2(x3, y3);
            if (p2.sqrDistanceTo(p3t) < p2.sqrDistanceTo(p3)) {
                p3.copy(p3t);
            }
        }
    }
    else {
        const y3 = snap(p2.y, dy);
        const x3 = p2.x;
        p3.set(x3, y3);
    }
    return p3;
}
function sceneGetFloor(p) {
    if ((Math.floor(p.x) + Math.floor(p.y)) % 2 == 0) {
        return SCENE_FLOOR1;
    }
    else {
        return SCENE_FLOOR2;
    }
}
function sceneGetCeiling(p) {
    if ((Math.floor(p.x) + Math.floor(p.y)) % 2 == 0) {
        return SCENE_CEILING1;
    }
    else {
        return SCENE_CEILING2;
    }
}
function castRay(scene, p1, p2) {
    let start = p1;
    while (start.sqrDistanceTo(p1) < FAR_CLIPPING_PLANE * FAR_CLIPPING_PLANE) {
        const c = hittingCell(p1, p2);
        if (sceneGetTile(scene, c))
            break;
        const p3 = rayStep(p1, p2);
        p1 = p2;
        p2 = p3;
    }
    return p2;
}
function renderMinimap(ctx, camera, player, scene, spritePool, visibleSprites) {
    ctx.save();
    const p1 = new Vector2();
    const p2 = new Vector2();
    const cellSize = ctx.canvas.width * MINIMAP_SCALE;
    ctx.translate(ctx.canvas.width * 0.03, ctx.canvas.height * 0.03);
    ctx.scale(cellSize, cellSize);
    ctx.fillStyle = "#181818";
    ctx.fillRect(0, 0, scene.width, scene.height);
    ctx.lineWidth = 0.05;
    for (let y = 0; y < scene.height; ++y) {
        for (let x = 0; x < scene.width; ++x) {
            if (sceneGetTile(scene, p1.set(x, y))) {
                ctx.fillStyle = "blue";
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    ctx.strokeStyle = "#303030";
    for (let x = 0; x <= scene.width; ++x) {
        strokeLine(ctx, p1.set(x, 0), p2.set(x, scene.height));
    }
    for (let y = 0; y <= scene.height; ++y) {
        strokeLine(ctx, p1.set(0, y), p2.set(scene.width, y));
    }
    ctx.fillStyle = "magenta";
    ctx.fillRect(player.position.x - PLAYER_SIZE * 0.5, player.position.y - PLAYER_SIZE * 0.5, PLAYER_SIZE, PLAYER_SIZE);
    ctx.strokeStyle = "magenta";
    strokeLine(ctx, camera.fovLeft, camera.fovRight);
    strokeLine(ctx, camera.position, camera.fovLeft);
    strokeLine(ctx, camera.position, camera.fovRight);
    if (MINIMAP_SPRITES) {
        ctx.strokeStyle = "yellow";
        ctx.fillStyle = "white";
        for (let i = 0; i < spritePool.length; ++i) {
            const sprite = spritePool.items[i];
            ctx.fillRect(sprite.position.x - MINIMAP_SPRITE_SIZE * 0.5, sprite.position.y - MINIMAP_SPRITE_SIZE * 0.5, MINIMAP_SPRITE_SIZE, MINIMAP_SPRITE_SIZE);
        }
        const sp = new Vector2();
        for (let sprite of visibleSprites) {
            strokeLine(ctx, player.position, sprite.position);
            sp.copy(sprite.position).sub(player.position).norm().scale(sprite.dist).add(player.position);
            ctx.fillRect(sp.x - MINIMAP_SPRITE_SIZE * 0.5, sp.y - MINIMAP_SPRITE_SIZE * 0.5, MINIMAP_SPRITE_SIZE, MINIMAP_SPRITE_SIZE);
        }
    }
    ctx.restore();
}
function renderDebugInfo(ctx, deltaTime, game) {
    const fontSize = 28;
    ctx.font = `${fontSize}px bold`;
    game.dts.push(deltaTime);
    if (game.dts.length > 60)
        game.dts.shift();
    const dtAvg = game.dts.reduce((a, b) => a + b, 0) / game.dts.length;
    const labels = [];
    labels.push(`FPS: ${Math.floor(1 / dtAvg)}`);
    switch (game.ws.readyState) {
        case WebSocket.CONNECTING:
            {
                labels.push('Connecting...');
            }
            break;
        case WebSocket.OPEN:
            {
                labels.push(`Ping: ${game.ping.toFixed(2)}ms`);
                labels.push(`Players: ${game.players.size}`);
            }
            break;
        case WebSocket.CLOSING:
        case WebSocket.CLOSED:
            {
                labels.push(`Offline`);
            }
            break;
    }
    const shadowOffset = fontSize * 0.06;
    const padding = 70;
    for (let i = 0; i < labels.length; ++i) {
        ctx.fillStyle = "black";
        ctx.fillText(labels[i], padding, padding + fontSize * i);
        ctx.fillStyle = "white";
        ctx.fillText(labels[i], padding + shadowOffset, padding - shadowOffset + fontSize * i);
    }
}
function renderColumnOfWall(display, cell, x, p, c) {
    if (cell instanceof RGBA) {
        const stripHeight = display.backImageData.height / display.zBuffer[x];
        const shadow = 1 / display.zBuffer[x] * 2;
        for (let dy = 0; dy < Math.ceil(stripHeight); ++dy) {
            const y = Math.floor((display.backImageData.height - stripHeight) * 0.5) + dy;
            const destP = (y * display.backImageData.width + x) * 4;
            display.backImageData.data[destP + 0] = cell.r * shadow * 255;
            display.backImageData.data[destP + 1] = cell.g * shadow * 255;
            display.backImageData.data[destP + 2] = cell.b * shadow * 255;
        }
    }
    else if (cell instanceof ImageData) {
        const stripHeight = display.backImageData.height / display.zBuffer[x];
        let u = 0;
        const t = p.clone().sub(c);
        if (Math.abs(t.x) < EPS && t.y > 0) {
            u = t.y;
        }
        else if (Math.abs(t.x - 1) < EPS && t.y > 0) {
            u = 1 - t.y;
        }
        else if (Math.abs(t.y) < EPS && t.x > 0) {
            u = 1 - t.x;
        }
        else {
            u = t.x;
        }
        const y1f = (display.backImageData.height - stripHeight) * 0.5;
        const y1 = Math.ceil(y1f);
        const y2 = Math.floor(y1 + stripHeight);
        const by1 = Math.max(0, y1);
        const by2 = Math.min(display.backImageData.height, y2);
        const tx = Math.floor(u * cell.width);
        const sh = cell.height / stripHeight;
        const shadow = Math.min(1 / display.zBuffer[x] * 4, 1);
        for (let y = by1; y < by2; ++y) {
            const ty = Math.floor((y - y1f) * sh);
            const destP = (y * display.backImageData.width + x) * 4;
            const srcP = (ty * cell.width + tx) * 4;
            display.backImageData.data[destP + 0] = cell.data[srcP + 0] * shadow;
            display.backImageData.data[destP + 1] = cell.data[srcP + 1] * shadow;
            display.backImageData.data[destP + 2] = cell.data[srcP + 2] * shadow;
        }
    }
}
function renderWalls(display, assets, camera, scene) {
    const d = new Vector2().setPolar(camera.direction);
    for (let x = 0; x < display.backImageData.width; ++x) {
        const p = castRay(scene, camera.position, camera.fovLeft.clone().lerp(camera.fovRight, x / display.backImageData.width));
        const c = hittingCell(camera.position, p);
        const v = p.clone().sub(camera.position);
        display.zBuffer[x] = v.dot(d);
        if (sceneGetTile(scene, c)) {
            renderColumnOfWall(display, assets.wallImageData, x, p, c);
        }
    }
}
function renderFloorAndCeiling(imageData, camera) {
    const pz = imageData.height / 2;
    const t = new Vector2();
    const t1 = new Vector2();
    const t2 = new Vector2();
    const bp = t1.copy(camera.fovLeft).sub(camera.position).length();
    for (let y = Math.floor(imageData.height / 2); y < imageData.height; ++y) {
        const sz = imageData.height - y - 1;
        const ap = pz - sz;
        const b = (bp / ap) * pz / NEAR_CLIPPING_PLANE;
        t1.copy(camera.fovLeft).sub(camera.position).norm().scale(b).add(camera.position);
        t2.copy(camera.fovRight).sub(camera.position).norm().scale(b).add(camera.position);
        for (let x = 0; x < imageData.width; ++x) {
            t.copy(t1).lerp(t2, x / imageData.width);
            const floorTile = sceneGetFloor(t);
            if (floorTile instanceof RGBA) {
                const destP = (y * imageData.width + x) * 4;
                const shadow = camera.position.distanceTo(t) * 255;
                imageData.data[destP + 0] = floorTile.r * shadow;
                imageData.data[destP + 1] = floorTile.g * shadow;
                imageData.data[destP + 2] = floorTile.b * shadow;
            }
            const ceilingTile = sceneGetCeiling(t);
            if (ceilingTile instanceof RGBA) {
                const destP = (sz * imageData.width + x) * 4;
                const shadow = camera.position.distanceTo(t) * 255;
                imageData.data[destP + 0] = ceilingTile.r * shadow;
                imageData.data[destP + 1] = ceilingTile.g * shadow;
                imageData.data[destP + 2] = ceilingTile.b * shadow;
            }
        }
    }
}
function createDisplay(ctx, width, height) {
    const backImageData = new ImageData(width, height);
    backImageData.data.fill(255);
    const backCanvas = new OffscreenCanvas(width, height);
    const backCtx = backCanvas.getContext("2d");
    if (backCtx === null)
        throw new Error("2D context is not supported");
    backCtx.imageSmoothingEnabled = false;
    return {
        ctx,
        backCtx,
        backImageData,
        zBuffer: Array(width).fill(0),
    };
}
function displaySwapBackImageData(display) {
    display.backCtx.putImageData(display.backImageData, 0, 0);
    display.ctx.drawImage(display.backCtx.canvas, 0, 0, display.ctx.canvas.width, display.ctx.canvas.height);
}
function cullAndSortSprites(camera, spritePool, visibleSprites) {
    const sp = new Vector2();
    const dir = new Vector2().setPolar(camera.direction);
    const fov = camera.fovRight.clone().sub(camera.fovLeft);
    visibleSprites.length = 0;
    for (let i = 0; i < spritePool.length; ++i) {
        const sprite = spritePool.items[i];
        sp.copy(sprite.position).sub(camera.position);
        const spl = sp.length();
        if (spl <= NEAR_CLIPPING_PLANE)
            continue;
        if (spl >= FAR_CLIPPING_PLANE)
            continue;
        const cos = sp.dot(dir) / spl;
        if (cos < 0)
            continue;
        sprite.dist = NEAR_CLIPPING_PLANE / cos;
        sp.norm().scale(sprite.dist).add(camera.position).sub(camera.fovLeft);
        sprite.t = sp.length() / fov.length() * Math.sign(sp.dot(fov));
        sprite.pdist = sprite.position.clone().sub(camera.position).dot(dir);
        if (sprite.pdist < NEAR_CLIPPING_PLANE)
            continue;
        if (sprite.pdist >= FAR_CLIPPING_PLANE)
            continue;
        visibleSprites.push(sprite);
    }
    visibleSprites.sort((a, b) => b.pdist - a.pdist);
}
function renderSprites(display, sprites) {
    for (let sprite of sprites) {
        const cx = display.backImageData.width * sprite.t;
        const cy = display.backImageData.height * 0.5;
        const maxSpriteSize = display.backImageData.height / sprite.pdist;
        const spriteSize = maxSpriteSize * sprite.scale;
        const x1 = Math.floor(cx - spriteSize * 0.5);
        const x2 = Math.floor(x1 + spriteSize - 1);
        const bx1 = Math.max(0, x1);
        const bx2 = Math.min(display.backImageData.width - 1, x2);
        const y1 = Math.floor(cy + maxSpriteSize * 0.5 - maxSpriteSize * sprite.z);
        const y2 = Math.floor(y1 + spriteSize - 1);
        const by1 = Math.max(0, y1);
        const by2 = Math.min(display.backImageData.height - 1, y2);
        if (sprite.image instanceof ImageData) {
            const src = sprite.image.data;
            const dest = display.backImageData.data;
            for (let x = bx1; x <= bx2; ++x) {
                if (sprite.pdist < display.zBuffer[x]) {
                    for (let y = by1; y <= by2; ++y) {
                        const tx = Math.floor((x - x1) / spriteSize * sprite.cropSize.x);
                        const ty = Math.floor((y - y1) / spriteSize * sprite.cropSize.y);
                        const srcP = ((ty + sprite.cropPosition.y) * sprite.image.width + (tx + sprite.cropPosition.x)) * 4;
                        const destP = (y * display.backImageData.width + x) * 4;
                        const alpha = src[srcP + 3] / 255;
                        dest[destP + 0] = dest[destP + 0] * (1 - alpha) + src[srcP + 0] * alpha;
                        dest[destP + 1] = dest[destP + 1] * (1 - alpha) + src[srcP + 1] * alpha;
                        dest[destP + 2] = dest[destP + 2] * (1 - alpha) + src[srcP + 2] * alpha;
                    }
                }
            }
        }
        else if (sprite.image instanceof RGBA) {
            const dest = display.backImageData.data;
            for (let x = bx1; x <= bx2; ++x) {
                if (sprite.pdist < display.zBuffer[x]) {
                    for (let y = by1; y <= by2; ++y) {
                        const destP = (y * display.backImageData.width + x) * 4;
                        const alpha = sprite.image.a;
                        dest[destP + 0] = dest[destP + 0] * (1 - alpha) + sprite.image.r * 255 * alpha;
                        dest[destP + 1] = dest[destP + 1] * (1 - alpha) + sprite.image.g * 255 * alpha;
                        dest[destP + 2] = dest[destP + 2] * (1 - alpha) + sprite.image.b * 255 * alpha;
                    }
                }
            }
        }
    }
}
function pushSprite(spritePool, image, position, z, scale, cropPosition, cropSize) {
    if (spritePool.length >= spritePool.items.length) {
        spritePool.items.push({
            image,
            position: new Vector2(),
            z,
            scale,
            pdist: 0,
            dist: 0,
            t: 0,
            cropPosition: new Vector2(),
            cropSize: new Vector2(),
        });
    }
    const last = spritePool.length;
    spritePool.items[last].image = image;
    spritePool.items[last].position.copy(position);
    spritePool.items[last].z = z;
    spritePool.items[last].scale = scale;
    spritePool.items[last].pdist = 0;
    spritePool.items[last].dist = 0;
    spritePool.items[last].t = 0;
    if (image instanceof ImageData) {
        if (cropPosition === undefined) {
            spritePool.items[last].cropPosition.set(0, 0);
        }
        else {
            spritePool.items[last].cropPosition.copy(cropPosition);
        }
        if (cropSize === undefined) {
            spritePool.items[last]
                .cropSize
                .set(image.width, image.height)
                .sub(spritePool.items[last].cropPosition);
        }
        else {
            spritePool.items[last].cropSize.copy(cropSize);
        }
    }
    else {
        spritePool.items[last].cropPosition.set(0, 0);
        spritePool.items[last].cropSize.set(0, 0);
    }
    spritePool.length += 1;
}
function allocateBombs(capacity) {
    let bomb = [];
    for (let i = 0; i < capacity; ++i) {
        bomb.push({
            position: new Vector3(),
            velocity: new Vector3(),
            lifetime: 0,
        });
    }
    return bomb;
}
function throwBomb(player, bombs) {
    for (let bomb of bombs) {
        if (bomb.lifetime <= 0) {
            bomb.lifetime = BOMB_LIFETIME;
            bomb.position.copy2(player.position, 0.6);
            bomb.velocity.x = Math.cos(player.direction);
            bomb.velocity.y = Math.sin(player.direction);
            bomb.velocity.z = 0.5;
            bomb.velocity.scale(BOMB_THROW_VELOCITY);
            break;
        }
    }
}
function updateCamera(player, camera) {
    const halfFov = FOV * 0.5;
    const fovLen = NEAR_CLIPPING_PLANE / Math.cos(halfFov);
    camera.position.copy(player.position);
    camera.direction = player.direction;
    camera.fovLeft.setPolar(camera.direction - halfFov, fovLen).add(camera.position);
    camera.fovRight.setPolar(camera.direction + halfFov, fovLen).add(camera.position);
}
function spriteOfItemKind(itemKind, assets) {
    switch (itemKind) {
        case "key": return assets.keyImageData;
        case "bomb": return assets.bombImageData;
    }
}
function updateItems(spritePool, time, player, items, assets) {
    for (let item of items) {
        if (item.alive) {
            if (player.position.sqrDistanceTo(item.position) < PLAYER_RADIUS * PLAYER_RADIUS) {
                playSound(assets.itemPickupSound, player.position, item.position);
                item.alive = false;
            }
        }
        if (item.alive) {
            pushSprite(spritePool, spriteOfItemKind(item.kind, assets), item.position, 0.25 + ITEM_AMP - ITEM_AMP * Math.sin(ITEM_FREQ * Math.PI * time + item.position.x + item.position.y), 0.25);
        }
    }
}
function allocateParticles(capacity) {
    let bomb = [];
    for (let i = 0; i < capacity; ++i) {
        bomb.push({
            position: new Vector3(),
            velocity: new Vector3(),
            lifetime: 0,
        });
    }
    return bomb;
}
function updateParticles(spritePool, deltaTime, scene, particles) {
    for (let particle of particles) {
        if (particle.lifetime > 0) {
            particle.lifetime -= deltaTime;
            particle.velocity.z -= BOMB_GRAVITY * deltaTime;
            const nx = particle.position.x + particle.velocity.x * deltaTime;
            const ny = particle.position.y + particle.velocity.y * deltaTime;
            if (sceneGetTile(scene, new Vector2(nx, ny))) {
                const dx = Math.abs(Math.floor(particle.position.x) - Math.floor(nx));
                const dy = Math.abs(Math.floor(particle.position.y) - Math.floor(ny));
                if (dx > 0)
                    particle.velocity.x *= -1;
                if (dy > 0)
                    particle.velocity.y *= -1;
                particle.velocity.scale(PARTICLE_DAMP);
            }
            else {
                particle.position.x = nx;
                particle.position.y = ny;
            }
            const nz = particle.position.z + particle.velocity.z * deltaTime;
            if (nz < PARTICLE_SCALE || nz > 1.0) {
                particle.velocity.z *= -1;
                particle.velocity.scale(PARTICLE_DAMP);
            }
            else {
                particle.position.z = nz;
            }
            if (particle.lifetime > 0) {
                pushSprite(spritePool, PARTICLE_COLOR, new Vector2(particle.position.x, particle.position.y), particle.position.z, PARTICLE_SCALE);
            }
        }
    }
}
function emitParticle(source, particles) {
    for (let particle of particles) {
        if (particle.lifetime <= 0) {
            particle.lifetime = PARTICLE_LIFETIME;
            particle.position.copy(source);
            const angle = Math.random() * 2 * Math.PI;
            particle.velocity.x = Math.cos(angle);
            particle.velocity.y = Math.sin(angle);
            particle.velocity.z = Math.random() * 0.5 + 0.5;
            particle.velocity.scale(PARTICLE_MAX_SPEED * Math.random());
            break;
        }
    }
}
function playSound(sound, playerPosition, objectPosition) {
    const maxVolume = 1;
    const distanceToPlayer = objectPosition.distanceTo(playerPosition);
    sound.volume = clamp(maxVolume / distanceToPlayer, 0.0, 1.0);
    sound.currentTime = 0;
    sound.play();
}
function updateBombs(spritePool, player, bombs, particles, scene, deltaTime, assets) {
    for (let bomb of bombs) {
        if (bomb.lifetime > 0) {
            bomb.lifetime -= deltaTime;
            bomb.velocity.z -= BOMB_GRAVITY * deltaTime;
            const nx = bomb.position.x + bomb.velocity.x * deltaTime;
            const ny = bomb.position.y + bomb.velocity.y * deltaTime;
            if (sceneGetTile(scene, new Vector2(nx, ny))) {
                const dx = Math.abs(Math.floor(bomb.position.x) - Math.floor(nx));
                const dy = Math.abs(Math.floor(bomb.position.y) - Math.floor(ny));
                if (dx > 0)
                    bomb.velocity.x *= -1;
                if (dy > 0)
                    bomb.velocity.y *= -1;
                bomb.velocity.scale(BOMB_DAMP);
                if (bomb.velocity.length() > 1) {
                    playSound(assets.bombRicochetSound, player.position, bomb.position.clone2());
                }
            }
            else {
                bomb.position.x = nx;
                bomb.position.y = ny;
            }
            const nz = bomb.position.z + bomb.velocity.z * deltaTime;
            if (nz < BOMB_SCALE || nz > 1.0) {
                bomb.velocity.z *= -1;
                bomb.velocity.scale(BOMB_DAMP);
                if (bomb.velocity.length() > 1) {
                    playSound(assets.bombRicochetSound, player.position, bomb.position.clone2());
                }
            }
            else {
                bomb.position.z = nz;
            }
            if (bomb.lifetime <= 0) {
                playSound(assets.bombBlastSound, player.position, bomb.position.clone2());
                for (let i = 0; i < BOMB_PARTICLE_COUNT; ++i) {
                    emitParticle(bomb.position, particles);
                }
            }
            else {
                pushSprite(spritePool, assets.bombImageData, new Vector2(bomb.position.x, bomb.position.y), bomb.position.z, BOMB_SCALE);
            }
        }
    }
}
async function loadImage(url) {
    const image = new Image();
    image.src = url;
    return new Promise((resolve, reject) => {
        image.onload = () => resolve(image);
        image.onerror = reject;
    });
}
async function loadImageData(url) {
    const image = await loadImage(url);
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    if (ctx === null)
        throw new Error("2d canvas is not supported");
    ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, image.width, image.height);
}
async function createGame() {
    const [wallImageData, keyImageData, bombImageData, playerImageData] = await Promise.all([
        loadImageData("assets/images/custom/wall.png"),
        loadImageData("assets/images/custom/key.png"),
        loadImageData("assets/images/custom/bomb.png"),
        loadImageData("assets/images/custom/player.png"),
    ]);
    const itemPickupSound = new Audio("assets/sounds/bomb-pickup.ogg");
    const bombRicochetSound = new Audio("assets/sounds/ricochet.wav");
    const bombBlastSound = new Audio("assets/sounds/blast.ogg");
    const assets = {
        wallImageData,
        keyImageData,
        bombImageData,
        playerImageData,
        bombRicochetSound,
        itemPickupSound,
        bombBlastSound,
    };
    const items = [
        {
            kind: "bomb",
            position: new Vector2(1.5, 3.5),
            alive: true,
        },
        {
            kind: "key",
            position: new Vector2(2.5, 1.5),
            alive: true,
        },
        {
            kind: "key",
            position: new Vector2(3, 1.5),
            alive: true,
        },
        {
            kind: "key",
            position: new Vector2(3.5, 1.5),
            alive: true,
        },
        {
            kind: "key",
            position: new Vector2(4.0, 1.5),
            alive: true,
        },
        {
            kind: "key",
            position: new Vector2(4.5, 1.5),
            alive: true,
        },
    ];
    const bombs = allocateBombs(10);
    const particles = allocateParticles(1000);
    const visibleSprites = [];
    const spritePool = createSpritePool();
    const players = new Map();
    const camera = {
        position: new Vector2(),
        direction: 0,
        fovLeft: new Vector2(),
        fovRight: new Vector2(),
    };
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.hostname}:${SERVER_PORT}`);
    if (window.location.hostname === 'tsoding.github.io')
        ws.close();
    const me = {
        id: 0,
        position: new Vector2(),
        direction: 0,
        moving: 0,
        hue: 0,
    };
    const game = { camera, ws, me: me, ping: 0, players, items, bombs, particles, assets, spritePool, visibleSprites, dts: [] };
    ws.binaryType = 'arraybuffer';
    ws.addEventListener("close", (event) => {
        console.log("WEBSOCKET CLOSE", event);
        game.players.clear();
    });
    ws.addEventListener("error", (event) => {
        console.log("WEBSOCKET ERROR", event);
    });
    ws.addEventListener("message", (event) => {
        if (!(event.data instanceof ArrayBuffer)) {
            console.error("Received bogus-amogus message from server. Expected binary data", event);
            ws?.close();
        }
        const view = new DataView(event.data);
        if (common.HelloStruct.verify(view)) {
            game.me = {
                id: common.HelloStruct.id.read(view),
                position: new Vector2(common.HelloStruct.x.read(view), common.HelloStruct.y.read(view)),
                direction: common.HelloStruct.direction.read(view),
                moving: 0,
                hue: common.HelloStruct.hue.read(view) / 256 * 360,
            };
            players.set(game.me.id, game.me);
        }
        else if (common.PlayersJoinedHeaderStruct.verify(view)) {
            const count = common.PlayersJoinedHeaderStruct.count(view);
            for (let i = 0; i < count; ++i) {
                const playerView = new DataView(event.data, common.PlayersJoinedHeaderStruct.size + i * common.PlayerStruct.size, common.PlayerStruct.size);
                const id = common.PlayerStruct.id.read(playerView);
                const player = players.get(id);
                if (player !== undefined) {
                    player.position.x = common.PlayerStruct.x.read(playerView);
                    player.position.y = common.PlayerStruct.y.read(playerView);
                    player.direction = common.PlayerStruct.direction.read(playerView);
                    player.moving = common.PlayerStruct.moving.read(playerView);
                    player.hue = common.PlayerStruct.hue.read(playerView) / 256 * 360;
                }
                else {
                    const x = common.PlayerStruct.x.read(playerView);
                    const y = common.PlayerStruct.y.read(playerView);
                    players.set(id, {
                        id,
                        position: new Vector2(x, y),
                        direction: common.PlayerStruct.direction.read(playerView),
                        moving: common.PlayerStruct.moving.read(playerView),
                        hue: common.PlayerStruct.hue.read(playerView) / 256 * 360,
                    });
                }
            }
        }
        else if (common.PlayersLeftHeaderStruct.verify(view)) {
            const count = common.PlayersLeftHeaderStruct.count(view);
            for (let i = 0; i < count; ++i) {
                const id = common.PlayersLeftHeaderStruct.items(i).id.read(view);
                players.delete(id);
            }
        }
        else if (common.PlayersMovingHeaderStruct.verify(view)) {
            const count = common.PlayersMovingHeaderStruct.count(view);
            for (let i = 0; i < count; ++i) {
                const playerView = new DataView(event.data, common.PlayersMovingHeaderStruct.size + i * common.PlayerStruct.size, common.PlayerStruct.size);
                const id = common.PlayerStruct.id.read(playerView);
                const player = players.get(id);
                if (player === undefined) {
                    console.error(`Received bogus-amogus message from server. We don't know anything about player with id ${id}`);
                    ws?.close();
                    return;
                }
                player.moving = common.PlayerStruct.moving.read(playerView);
                player.position.x = common.PlayerStruct.x.read(playerView);
                player.position.y = common.PlayerStruct.y.read(playerView);
                player.direction = common.PlayerStruct.direction.read(playerView);
            }
        }
        else if (common.PongStruct.verify(view)) {
            game.ping = performance.now() - common.PongStruct.timestamp.read(view);
        }
        else {
            console.error("Received bogus-amogus message from server.", view);
            ws?.close();
        }
    });
    ws.addEventListener("open", (event) => {
        console.log("WEBSOCKET OPEN", event);
    });
    return game;
}
function spriteAngleIndex(cameraPosition, entity) {
    return Math.floor(properMod(properMod(entity.direction, 2 * Math.PI) - properMod(entity.position.clone().sub(cameraPosition).angle(), 2 * Math.PI) - Math.PI + Math.PI / 8, 2 * Math.PI) / (2 * Math.PI) * SPRITE_ANGLES_COUNT);
}
function renderGame(display, deltaTime, time, game) {
    resetSpritePool(game.spritePool);
    game.players.forEach((player) => {
        if (player !== game.me)
            updatePlayer(player, SCENE, deltaTime);
    });
    updatePlayer(game.me, SCENE, deltaTime);
    updateCamera(game.me, game.camera);
    updateItems(game.spritePool, time, game.me, game.items, game.assets);
    updateBombs(game.spritePool, game.me, game.bombs, game.particles, SCENE, deltaTime, game.assets);
    updateParticles(game.spritePool, deltaTime, SCENE, game.particles);
    game.players.forEach((player) => {
        if (player !== game.me) {
            const index = spriteAngleIndex(game.camera.position, player);
            pushSprite(game.spritePool, game.assets.playerImageData, player.position, 1, 1, new Vector2(55 * index, 0), new Vector2(55, 55));
        }
    });
    renderFloorAndCeiling(display.backImageData, game.camera);
    renderWalls(display, game.assets, game.camera, SCENE);
    cullAndSortSprites(game.camera, game.spritePool, game.visibleSprites);
    renderSprites(display, game.visibleSprites);
    displaySwapBackImageData(display);
    if (MINIMAP)
        renderMinimap(display.ctx, game.camera, game.me, SCENE, game.spritePool, game.visibleSprites);
    renderDebugInfo(display.ctx, deltaTime, game);
}
(async () => {
    const gameCanvas = document.getElementById("game");
    if (gameCanvas === null)
        throw new Error("No canvas with id `game` is found");
    const factor = 80;
    gameCanvas.width = 16 * factor;
    gameCanvas.height = 9 * factor;
    const ctx = gameCanvas.getContext("2d");
    if (ctx === null)
        throw new Error("2D context is not supported");
    ctx.imageSmoothingEnabled = false;
    const display = createDisplay(ctx, SCREEN_WIDTH, SCREEN_HEIGHT);
    const game = await createGame();
    window.addEventListener("keydown", (e) => {
        if (!e.repeat) {
            const direction = CONTROL_KEYS[e.code];
            if (direction !== undefined) {
                if (game.ws.readyState === WebSocket.OPEN) {
                    const view = new DataView(new ArrayBuffer(common.AmmaMovingStruct.size));
                    common.AmmaMovingStruct.kind.write(view, common.MessageKind.AmmaMoving);
                    common.AmmaMovingStruct.start.write(view, 1);
                    common.AmmaMovingStruct.direction.write(view, direction);
                    game.ws.send(view);
                }
                else {
                    game.me.moving |= 1 << direction;
                }
            }
            else if (e.code === 'Space') {
                throwBomb(game.me, game.bombs);
            }
        }
    });
    window.addEventListener("keyup", (e) => {
        if (!e.repeat) {
            const direction = CONTROL_KEYS[e.code];
            if (direction !== undefined) {
                if (game.ws.readyState === WebSocket.OPEN) {
                    const view = new DataView(new ArrayBuffer(common.AmmaMovingStruct.size));
                    common.AmmaMovingStruct.kind.write(view, common.MessageKind.AmmaMoving);
                    common.AmmaMovingStruct.start.write(view, 0);
                    common.AmmaMovingStruct.direction.write(view, direction);
                    game.ws.send(view);
                }
                else {
                    game.me.moving &= ~(1 << direction);
                }
            }
        }
    });
    const PING_COOLDOWN = 60;
    let prevTimestamp = 0;
    let pingCooldown = PING_COOLDOWN;
    const frame = (timestamp) => {
        const deltaTime = (timestamp - prevTimestamp) / 1000;
        const time = timestamp / 1000;
        prevTimestamp = timestamp;
        renderGame(display, deltaTime, time, game);
        if (game.ws.readyState == WebSocket.OPEN) {
            pingCooldown -= 1;
            if (pingCooldown <= 0) {
                const view = new DataView(new ArrayBuffer(common.PingStruct.size));
                common.PingStruct.kind.write(view, common.MessageKind.Ping);
                common.PingStruct.timestamp.write(view, performance.now());
                game.ws.send(view);
                pingCooldown = PING_COOLDOWN;
            }
        }
        window.requestAnimationFrame(frame);
    };
    window.requestAnimationFrame((timestamp) => {
        prevTimestamp = timestamp;
        window.requestAnimationFrame(frame);
    });
})();
//# sourceMappingURL=client.mjs.map