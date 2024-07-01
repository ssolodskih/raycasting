// This module is the main logic of the game and when served via `npm run watch` should be 
// hot-reloadable without losing the state of the game. Anything outside of this module
// is only cold-reloadable by simply refreshing the whole page.
//
// The way we hot-reload modules is rather limited and does not allow to reload for instance
// classes. In case of Vector2 and RGBA we don't really care because they are not modified very
// often.
//
// TODO: maybe Vector2 and RBGA should be moved outside of this module for the above reason.
//
// Only simple functions that operate on objects that don't store any functions can be easily
// hot-reloaded. Examples are State and Player which we defined as interfaces.
export const EPS = 1e-6;
export const NEAR_CLIPPING_PLANE = 0.1;
export const FAR_CLIPPING_PLANE = 20.0;
export const FOV = Math.PI*0.5;
export const SCREEN_FACTOR = 30;
export const SCREEN_WIDTH = Math.floor(16*SCREEN_FACTOR);
export const SCREEN_HEIGHT = Math.floor(9*SCREEN_FACTOR);
export const PLAYER_STEP_LEN = 0.5;
export const PLAYER_SPEED = 2;
export const PLAYER_SIZE = 0.5

export class RGBA {
    r: number;
    g: number;
    b: number;
    a: number;
    constructor(r: number, g: number, b: number, a: number) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
    static red(): RGBA {
        return new RGBA(1, 0, 0, 1);
    }
    static green(): RGBA {
        return new RGBA(0, 1, 0, 1);
    }
    static blue(): RGBA {
        return new RGBA(0, 0, 1, 1);
    }
    static yellow(): RGBA {
        return new RGBA(1, 1, 0, 1);
    }
    static purple(): RGBA {
        return new RGBA(1, 0, 1, 1);
    }
    static cyan(): RGBA {
        return new RGBA(0, 1, 1, 1);
    }
    brightness(factor: number): RGBA {
        return new RGBA(factor*this.r, factor*this.g, factor*this.b, this.a);
    }
    toStyle(): string {
        return `rgba(`
            +`${Math.floor(this.r*255)}, `
            +`${Math.floor(this.g*255)}, `
            +`${Math.floor(this.b*255)}, `
            +`${this.a})`;
    }
}

export class Vector2 {
    x: number;
    y: number;
    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
    static zero(): Vector2 {
        return new Vector2(0, 0);
    }
    static scalar(value: number): Vector2 {
        return new Vector2(value, value);
    }
    static angle(angle: number): Vector2 {
        return new Vector2(Math.cos(angle), Math.sin(angle));
    }
    add(that: Vector2): Vector2 {
        return new Vector2(this.x + that.x, this.y + that.y);
    }
    sub(that: Vector2): Vector2 {
        return new Vector2(this.x - that.x, this.y - that.y);
    }
    div(that: Vector2): Vector2 {
        return new Vector2(this.x/that.x, this.y/that.y);
    }
    mul(that: Vector2): Vector2 {
        return new Vector2(this.x*that.x, this.y*that.y);
    }
    length(): number {
        return Math.sqrt(this.x*this.x + this.y*this.y);
    }
    sqrLength(): number {
        return this.x*this.x + this.y*this.y;
    }
    norm(): Vector2 {
        const l = this.length();
        if (l === 0) return new Vector2(0, 0);
        return new Vector2(this.x/l, this.y/l);
    }
    scale(value: number): Vector2 {
        return new Vector2(this.x*value, this.y*value);
    }
    rot90(): Vector2 {
        return new Vector2(-this.y, this.x);
    }
    sqrDistanceTo(that: Vector2): number {
        return that.sub(this).sqrLength();
    }
    lerp(that: Vector2, t: number): Vector2 {
        return that.sub(this).scale(t).add(this);
    }
    dot(that: Vector2): number {
        return this.x*that.x + this.y*that.y;
    }
    map(f: (x: number) => number): Vector2 {
        return new Vector2(f(this.x), f(this.y));
    }
    array(): [number, number] {
        return [this.x, this.y];
    }
}

function canvasSize(ctx: CanvasRenderingContext2D): Vector2 {
    return new Vector2(ctx.canvas.width, ctx.canvas.height);
}

function strokeLine(ctx: CanvasRenderingContext2D, p1: Vector2, p2: Vector2) {
    ctx.beginPath();
    ctx.moveTo(...p1.array());
    ctx.lineTo(...p2.array());
    ctx.stroke();
}

function snap(x: number, dx: number): number {
    if (dx > 0) return Math.ceil(x + Math.sign(dx)*EPS);
    if (dx < 0) return Math.floor(x + Math.sign(dx)*EPS);
    return x;
}

function hittingCell(p1: Vector2, p2: Vector2): Vector2 {
    const d = p2.sub(p1);
    return new Vector2(Math.floor(p2.x + Math.sign(d.x)*EPS),
                       Math.floor(p2.y + Math.sign(d.y)*EPS));
}

function rayStep(p1: Vector2, p2: Vector2): Vector2 {
    // y = k*x + c
    // x = (y - c)/k
    // 
    // p1 = (x1, y1)
    // p2 = (x2, y2)
    //
    // | y1 = k*x1 + c
    // | y2 = k*x2 + c
    //
    // dy = y2 - y1
    // dx = x2 - x1
    // c = y1 - k*x1
    // k = dy/dx
    let p3 = p2;
    const d = p2.sub(p1);
    if (d.x !== 0) {
        const k = d.y/d.x;
        const c = p1.y - k*p1.x;

        {
            const x3 = snap(p2.x, d.x);
            const y3 = x3*k + c;
            p3 = new Vector2(x3, y3);
        }

        if (k !== 0) {
            const y3 = snap(p2.y, d.y);
            const x3 = (y3 - c)/k;
            const p3t = new Vector2(x3, y3);
            if (p2.sqrDistanceTo(p3t) < p2.sqrDistanceTo(p3)) {
                p3 = p3t;
            }
        }
    } else {
        const y3 = snap(p2.y, d.y);
        const x3 = p2.x;
        p3 = new Vector2(x3, y3);
    }

    return p3;
}

type Tile = RGBA | ImageData | null;

const SCENE_FLOOR1 = new RGBA(0.188, 0.188, 0.188, 1.0);
const SCENE_FLOOR2 = new RGBA(0.188, 0.188 + 0.05, 0.188 + 0.05, 1.0);
const SCENE_CEILING1 = new RGBA(0.094 + 0.05, 0.094, 0.094, 1.0);
const SCENE_CEILING2 = new RGBA(0.188 + 0.05, 0.188, 0.188, 1.0);

export interface Scene {
    walls: Array<Tile>;
    width: number;
    height: number;
}

export function createScene(walls: Array<Array<Tile>>): Scene {
    const scene: Scene = {
        height: walls.length,
        width: Number.MIN_VALUE,
        walls: [],
    };
    for (let row of walls) {
        scene.width = Math.max(scene.width, row.length);
    }
    for (let row of walls) {
        scene.walls = scene.walls.concat(row);
        for (let i = 0; i < scene.width - row.length; ++i) {
            scene.walls.push(null);
        }
    }
    return scene;
}

export function sceneSize(scene: Scene): Vector2 {
    return new Vector2(scene.width, scene.height);
}

function sceneContains(scene: Scene, p: Vector2): boolean {
    return 0 <= p.x && p.x < scene.width && 0 <= p.y && p.y < scene.height;
}

function sceneGetWall(scene: Scene, p: Vector2): Tile | undefined {
    if (!sceneContains(scene, p)) return undefined;
    const fp = p.map(Math.floor);
    return scene.walls[fp.y*scene.width + fp.x];
}

function sceneGetFloor(p: Vector2): Tile | undefined {
    if ((Math.floor(p.x) + Math.floor(p.y))%2 == 0) {
        return SCENE_FLOOR1;
    } else {
        return SCENE_FLOOR2;
    }
}

function sceneGetCeiling(p: Vector2): Tile | undefined {
    if ((Math.floor(p.x) + Math.floor(p.y))%2 == 0) {
        return SCENE_CEILING1;
    } else {
        return SCENE_CEILING2;
    }
}

function sceneIsWall(scene: Scene, p: Vector2): boolean {
    const c = sceneGetWall(scene, p);
    return c !== null && c !== undefined;
}

export function sceneCanRectangleFitHere(scene: Scene, position: Vector2, size: Vector2): boolean {
    const halfSize = size.scale(0.5);
    const leftTopCorner = position.sub(halfSize).map(Math.floor);
    const rightBottomCorner = position.add(halfSize).map(Math.floor);
    for (let x = leftTopCorner.x; x <= rightBottomCorner.x; ++x) {
        for (let y = leftTopCorner.y; y <= rightBottomCorner.y; ++y) {
            if (sceneIsWall(scene, new Vector2(x, y))) {
                return false;
            }
        }
    }
    return true;
}

function castRay(scene: Scene, p1: Vector2, p2: Vector2): Vector2 {
    let start = p1;
    while (start.sqrDistanceTo(p1) < FAR_CLIPPING_PLANE*FAR_CLIPPING_PLANE) {
        const c = hittingCell(p1, p2);
        if (sceneIsWall(scene, c)) break;
        const p3 = rayStep(p1, p2);
        p1 = p2;
        p2 = p3;
    }
    return p2;
}


export interface Player {
    position: Vector2;
    direction: number;
}

export function createPlayer(position: Vector2, direction: number): Player {
    return {
        position: position,
        direction: direction,
    }
}

function playerFovRange(player: Player): [Vector2, Vector2] {
    const l = Math.tan(FOV*0.5)*NEAR_CLIPPING_PLANE;
    const p = player.position.add(Vector2.angle(player.direction).scale(NEAR_CLIPPING_PLANE));
    const p1 = p.sub(p.sub(player.position).rot90().norm().scale(l));
    const p2 = p.add(p.sub(player.position).rot90().norm().scale(l));
    return [p1, p2];
}

function renderMinimap(ctx: CanvasRenderingContext2D, player: Player, position: Vector2, size: Vector2, scene: Scene) {
    ctx.save();

    const gridSize = sceneSize(scene);

    ctx.translate(...position.array());
    ctx.scale(...size.div(gridSize).array());

    ctx.fillStyle = "#181818";
    ctx.fillRect(0, 0, ...gridSize.array());

    ctx.lineWidth = 0.1;
    for (let y = 0; y < gridSize.y; ++y) {
        for (let x = 0; x < gridSize.x; ++x) {
            const cell = sceneGetWall(scene, new Vector2(x, y));
            if (cell instanceof RGBA) {
                ctx.fillStyle = cell.toStyle();
                ctx.fillRect(x, y, 1, 1);
            } else if (cell instanceof ImageData) {
                // TODO: Render ImageData tiles
            }
        }
    }

    ctx.strokeStyle = "#303030";
    for (let x = 0; x <= gridSize.x; ++x) {
        strokeLine(ctx, new Vector2(x, 0), new Vector2(x, gridSize.y));
    }
    for (let y = 0; y <= gridSize.y; ++y) {
        strokeLine(ctx, new Vector2(0, y), new Vector2(gridSize.x, y));
    }

    ctx.fillStyle = "magenta";
    ctx.fillRect(player.position.x - PLAYER_SIZE*0.5,
                 player.position.y - PLAYER_SIZE*0.5,
                 PLAYER_SIZE, PLAYER_SIZE);

    const [p1, p2] = playerFovRange(player);
    ctx.strokeStyle = "magenta";
    strokeLine(ctx, p1, p2);
    strokeLine(ctx, player.position, p1);
    strokeLine(ctx, player.position, p2);

    ctx.restore();
}

function renderWallsToImageData(imageData: ImageData, player: Player, scene: Scene) {
    const [r1, r2] = playerFovRange(player);
    for (let x = 0; x < SCREEN_WIDTH; ++x) {
        const p = castRay(scene, player.position, r1.lerp(r2, x/SCREEN_WIDTH));
        const c = hittingCell(player.position, p);
        const cell = sceneGetWall(scene, c);
        if (cell instanceof RGBA) {
            const v = p.sub(player.position);
            const d = Vector2.angle(player.direction)
            const stripHeight = SCREEN_HEIGHT/v.dot(d);
            const color = cell.brightness(v.dot(d));
            for (let dy = 0; dy < Math.ceil(stripHeight); ++dy) {
                const y = Math.floor((SCREEN_HEIGHT - stripHeight)*0.5) + dy;
                const destP = (y*SCREEN_WIDTH + x)*4;
                imageData.data[destP + 0] = color.r*255;
                imageData.data[destP + 1] = color.g*255;
                imageData.data[destP + 2] = color.b*255;
                imageData.data[destP + 3] = color.a*255;
            }
        } else if (cell instanceof ImageData) {
            const v = p.sub(player.position);
            const d = Vector2.angle(player.direction)
            const stripHeight = SCREEN_HEIGHT/v.dot(d);

            let u = 0;
            const t = p.sub(c);
            if ((Math.abs(t.x) < EPS || Math.abs(t.x - 1) < EPS) && t.y > 0) {
                u = t.y;
            } else {
                u = t.x;
            }

            const y1 = Math.floor((SCREEN_HEIGHT - stripHeight)*0.5);
            const y2 = Math.floor(y1 + stripHeight);
            const by1 = Math.max(0, y1);
            const by2 = Math.min(SCREEN_HEIGHT-1, y2);
            for (let y = by1; y <= by2; ++y) {
                const tx = Math.floor(u*cell.width);
                const ty = Math.floor((y - y1)/Math.ceil(stripHeight)*cell.height);
                const destP = (y*SCREEN_WIDTH + x)*4;
                imageData.data[destP + 0] = cell.data[(ty*cell.width + tx)*4 + 0]/v.dot(d)*2;
                imageData.data[destP + 1] = cell.data[(ty*cell.width + tx)*4 + 1]/v.dot(d)*2;
                imageData.data[destP + 2] = cell.data[(ty*cell.width + tx)*4 + 2]/v.dot(d)*2;
                imageData.data[destP + 3] = cell.data[(ty*cell.width + tx)*4 + 3];
            }
        }
    }
}

function renderCeilingIntoImageData(imageData: ImageData, player: Player, scene: Scene) {
    const pz = SCREEN_HEIGHT/2;
    const [p1, p2] = playerFovRange(player);
    const bp = p1.sub(player.position).length();
    for (let y = Math.floor(SCREEN_HEIGHT/2); y < SCREEN_HEIGHT; ++y) {
        const sz = SCREEN_HEIGHT - y - 1;

        const ap = pz - sz;
        const b = (bp/ap)*pz/NEAR_CLIPPING_PLANE;
        const t1 = player.position.add(p1.sub(player.position).norm().scale(b));
        const t2 = player.position.add(p2.sub(player.position).norm().scale(b));

        for (let x = 0; x < SCREEN_WIDTH; ++x) {
            const t = t1.lerp(t2, x/SCREEN_WIDTH);
            const tile = sceneGetCeiling(t);
            if (tile instanceof RGBA) {
                const color = tile.brightness(Math.sqrt(player.position.sqrDistanceTo(t)));
                const destP = (sz*SCREEN_WIDTH + x)*4;
                imageData.data[destP + 0] = color.r*255;
                imageData.data[destP + 1] = color.g*255;
                imageData.data[destP + 2] = color.b*255;
                imageData.data[destP + 3] = color.a*255;
            }
        }
    }
}

function renderFloorIntoImageData(imageData: ImageData, player: Player, scene: Scene) {
    const pz = SCREEN_HEIGHT/2;
    const [p1, p2] = playerFovRange(player);
    const bp = p1.sub(player.position).length();
    for (let y = Math.floor(SCREEN_HEIGHT/2); y < SCREEN_HEIGHT; ++y) {
        const sz = SCREEN_HEIGHT - y - 1;

        const ap = pz - sz;
        const b = (bp/ap)*pz/NEAR_CLIPPING_PLANE;
        const t1 = player.position.add(p1.sub(player.position).norm().scale(b));
        const t2 = player.position.add(p2.sub(player.position).norm().scale(b));

        for (let x = 0; x < SCREEN_WIDTH; ++x) {
            const t = t1.lerp(t2, x/SCREEN_WIDTH);
            const tile = sceneGetFloor(t);
            if (tile instanceof RGBA) {
                const color = tile.brightness(Math.sqrt(player.position.sqrDistanceTo(t)));
                const destP = (y*SCREEN_WIDTH + x)*4; 
                imageData.data[destP + 0] = color.r*255;
                imageData.data[destP + 1] = color.g*255;
                imageData.data[destP + 2] = color.b*255;
                imageData.data[destP + 3] = color.a*255;
            }
        }
    }
}

export function renderGameIntoImageData(ctx: CanvasRenderingContext2D, backCtx: OffscreenCanvasRenderingContext2D, backImageData: ImageData, deltaTime: number, player: Player, scene: Scene) {
    const minimapPosition = Vector2.zero().add(canvasSize(ctx).scale(0.03));
    const cellSize = ctx.canvas.width*0.03;
    const minimapSize = sceneSize(scene).scale(cellSize);

    backImageData.data.fill(255);
    renderFloorIntoImageData(backImageData, player, scene);
    renderCeilingIntoImageData(backImageData, player, scene);
    renderWallsToImageData(backImageData, player, scene);
    backCtx.putImageData(backImageData, 0, 0);
    ctx.drawImage(backCtx.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height);

    renderMinimap(ctx, player, minimapPosition, minimapSize, scene);

    ctx.font = "48px bold"
    ctx.fillStyle = "white"
    ctx.fillText(`${Math.floor(1/deltaTime)}`, 100, 100);
}
