import { SpeechBubble } from "./SpeechBubble";
import { Game } from "./game";
import {
    PIXEL_PER_METER, GRAVITY, MAX_PLAYER_SPEED, PLAYER_ACCELERATION, PLAYER_JUMP_HEIGHT,
    PLAYER_IDLE_ANIMATION, PLAYER_RUNNING_ANIMATION
} from "./constants";
import { NPC } from './NPC';
import { loadImage } from "./graphics";
import { Sprites } from "./Sprites";
import { PhysicsEntity } from "./PhysicsEntity";
import { Snowball } from "./Snowball";
import { Environment } from "./World";
import { particles, valueCurves, ParticleEmitter } from './Particles';
import { rnd, rndItem, timedRnd } from './util';

enum SpriteIndex {
    IDLE0 = 0,
    IDLE1 = 1,
    IDLE2 = 2,
    IDLE3 = 3,
    WALK0 = 4,
    WALK1 = 5,
    WALK2 = 6,
    WALK3 = 7,
    JUMP = 8,
    FALL = 9
}

const groundColors = [
    "#806057",
    "#504336",
    "#3C8376",
    "#908784"
];

export class Player extends PhysicsEntity {
    private flying = false;
    private direction = 1;
    private spriteIndex = SpriteIndex.IDLE0;
    private sprites!: Sprites;
    private moveLeft: boolean = false;
    private moveRight: boolean = false;
    private debug = false;

    private interactionRange = 35;
    private closestNPC: NPC | null = null;
    public activeSpeechBubble: SpeechBubble | null = null;
    public isInDialog = false;
    private dustEmitter: ParticleEmitter;

    public constructor(game: Game, x: number, y: number) {
        super(game, x, y, 0.5 * PIXEL_PER_METER, 1.85 * PIXEL_PER_METER);
        document.addEventListener("keydown", event => this.handleKeyDown(event));
        document.addEventListener("keyup", event => this.handleKeyUp(event));
        this.setMaxVelocity(MAX_PLAYER_SPEED);
        this.dustEmitter = particles.createEmitter({
            position: {x: this.x, y: this.y},
            velocity: () => ({ x: rnd(-1, 1) * 26, y: rnd(0.7, 1) * 45 }),
            color: () => rndItem(groundColors),
            size: rnd(0.5, 1.5),
            gravity: {x: 0, y: -100},
            lifetime: () => rnd(0.5, 0.8),
            alphaCurve: valueCurves.trapeze(0.05, 0.2)
        });
    }

    public async load(): Promise<void> {
         this.sprites = new Sprites(await loadImage("sprites/main.png"), 4, 3);
    }

    private handleKeyDown(event: KeyboardEvent) {
        if (!this.game.camera.isOnTarget()) {
            return;
        }
        if (event.key === "ArrowRight" && !this.isInDialog) {
            this.direction = 1;
            this.moveRight = true;
        } else if (event.key === "ArrowLeft" && !this.isInDialog) {
            this.direction = -1;
            this.moveLeft = true;
        }
        if (event.key === "Enter") {
            if (this.closestNPC && this.closestNPC.hasDialog) {
                this.closestNPC.startDialog();
            }
        }
        if (event.key === " " && !event.repeat && !this.flying && !this.isInDialog) {
            this.setVelocityY(Math.sqrt(2 * PLAYER_JUMP_HEIGHT * GRAVITY));
        }
        if (event.key === "t") {
            this.game.gameObjects.push(new Snowball(this.game, this.x, this.y + this.height * 0.75, 20 * this.direction, 10));
        }
    }

    private handleKeyUp(event: KeyboardEvent) {
        if (event.key === "ArrowRight") {
            this.moveRight = false;
        } else if (event.key === "ArrowLeft") {
            this.moveLeft = false;
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = "red";
        ctx.translate(this.x, -this.y + 1);
        if (this.debug) {
            ctx.strokeRect(-this.width / 2, -this.height, this.width, this.height);
        }
        if (this.direction < 0) {
            ctx.scale(-1, 1);
        }
        this.sprites.draw(ctx, this.spriteIndex);
        ctx.restore();

        if (this.closestNPC && this.closestNPC.hasDialog) {
            this.drawDialogTip(ctx);
        }
    }

    drawDialogTip(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = "white";
        ctx.strokeText("press 'Enter' to talk", this.x - (this.width / 2), -this.y + 20);
        ctx.restore();
        this.activeSpeechBubble?.draw(ctx, this.x, this.y + 30);
    }

    update(dt: number): void {
        super.update(dt);

        const world = this.game.world;
        const wasFlying = this.flying;
        const prevVelocity = this.getVelocityY();

        // Player movement
        if (!this.game.camera.isOnTarget()) {
            this.moveRight = false;
            this.moveLeft = false;
        }
        if (this.moveRight) {
            this.accelerateX(PLAYER_ACCELERATION * dt);
        } else if (this.moveLeft) {
            this.accelerateX(-PLAYER_ACCELERATION * dt);
        } else {
            if (this.getVelocityX() > 0) {
                this.decelerateX(PLAYER_ACCELERATION * dt);
            } else {
                this.decelerateX(-PLAYER_ACCELERATION * dt);
            }
        }

        // Set sprite index depending on movement
        if (this.getVelocityX() === 0 && this.getVelocityY() === 0) {
            this.spriteIndex = getSpriteIndex(SpriteIndex.IDLE0, PLAYER_IDLE_ANIMATION);
            this.flying = false;
        } else {
            if (this.getVelocityY() > 0) {
                this.spriteIndex = SpriteIndex.JUMP;
                this.flying = true;
            } else if (this.getVelocityY() < 0 && this.y - world.getGround(this.x, this.y) > 10) {
                this.spriteIndex = SpriteIndex.FALL;
                this.flying = true;
            } else {
                this.spriteIndex = getSpriteIndex(SpriteIndex.WALK0, PLAYER_RUNNING_ANIMATION);
                this.flying = false;
            }
        }

        // check for npc in interactionRange
        const closestEntity = this.getClosestEntityInRange(this.interactionRange);
        if (closestEntity instanceof NPC) {
            this.closestNPC = closestEntity;
        } else {
            this.closestNPC = null;
        }

        // Spawn random dust particles while walking
        if (!this.flying && (Math.abs(this.getVelocityX()) > 1 || wasFlying)) {
            if (timedRnd(dt, 0.2) || wasFlying) {
                this.dustEmitter.setPosition(this.x, this.y);
                const count = wasFlying ? Math.ceil(Math.abs(prevVelocity) / 5) : 1;
                this.dustEmitter.emit(count);
            }
        }
    }


    /**
     * If given coordinate collides with the world then the first free Y coordinate above is returned. This can
     * be used to unstuck an object after a new position was set.
     *
     * @param x - X coordinate of current position.
     * @param y - Y coordinate of current position.
     * @return The Y coordinate of the ground below the given coordinate.
     */
    private pullOutOfGround(): number {
        let pulled = 0;
        if (this.getVelocityY() <= 0) {
            const world = this.game.world;
            const height = world.getHeight();
            while (this.y < height && world.collidesWith(this.x, this.y)) {
                pulled++;
                this.y++;
            }
        }
        return pulled;
    }

    /**
     * If given coordinate collides with the world then the first free Y coordinate above is returned. This can
     * be used to unstuck an object after a new position was set.
     *
     * @param x - X coordinate of current position.
     * @param y - Y coordinate of current position.
     * @return The Y coordinate of the ground below the given coordinate.
     */
    private pullOutOfCeiling(): number {
        let pulled = 0;
        const world = this.game.world;
        while (this.y > 0 && world.collidesWith(this.x, this.y + this.height, [ Environment.PLATFORM ])) {
            pulled++;
            this.y--;
        }
        return pulled;
    }

    private pullOutOfWall(): number {
        let pulled = 0;
        const world = this.game.world;
        if (this.getVelocityX() > 0) {
            while (world.collidesWithVerticalLine(this.x + this.width / 2, this.y + this.height * 3 / 4,
                    this.height / 2, [ Environment.PLATFORM ])) {
                this.x--;
                pulled++;
            }
        } else {
            while (world.collidesWithVerticalLine(this.x - this.width / 2, this.y + this.height * 3 / 4,
                    this.height / 2, [ Environment.PLATFORM ])) {
                this.x++;
                pulled++;
            }
        }
        return pulled;
    }

    protected updatePosition(newX: number, newY: number): void {
        this.x = newX;
        this.y = newY;

        // Check collision with the environment and correct player position and movement
        if (this.pullOutOfGround() !== 0 || this.pullOutOfCeiling() !== 0) {
            this.setVelocityY(0);
        }
        if (this.pullOutOfWall() !== 0) {
            this.setVelocityX(0);
        }
    }
}

function getSpriteIndex(startIndex: number, delays: number[]): number {
    const duration = delays.reduce((duration, delay) => duration + delay, 0);
    let time = Date.now() % duration;
    return startIndex + delays.findIndex(value => (time -= value) <= 0);
}
