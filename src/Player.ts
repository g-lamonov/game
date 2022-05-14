import { SpeechBubble } from "./SpeechBubble";
import { Entity } from './Entity';
import { Game } from "./game";
import { NPC } from './NPC';
import { PIXEL_PER_METER, GRAVITY, MAX_PLAYER_SPEED, PLAYER_ACCELERATION, PLAYER_JUMP_HEIGHT } from "./constants";

export class Player extends Entity {
    private moveLeft: boolean = false;
    private moveRight: boolean = false;
    private moveX = 0;
    private moveY = 0;
    private interactionRange = 35;
    private closestNPC: NPC | null = null;
    public activeSpeechBubble: SpeechBubble | null = null;

    public constructor(game: Game, x: number, y: number) {
        super(game, x, y, 1 * PIXEL_PER_METER, 1.85 * PIXEL_PER_METER);
        document.addEventListener("keydown", event => this.handleKeyDown(event));
        document.addEventListener("keyup", event => this.handleKeyUp(event));
    }

    private handleKeyDown(event: KeyboardEvent) {
        if (event.key === "ArrowRight") {
            this.moveRight = true;
        } else if (event.key === "ArrowLeft") {
            this.moveLeft = true;
        }
        if (event.key === "Enter") {
            if (this.closestNPC && this.closestNPC.hasDialog) {
                this.closestNPC.startDialog();
            }
        }
        if (event.key === " " && !event.repeat) {
            this.moveY = Math.sqrt(2 * PLAYER_JUMP_HEIGHT * GRAVITY);
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
        ctx.strokeRect(this.x - (this.width / 2), -this.y - this.height, this.width, this.height);
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
        const world = this.game.world;

        this.x += this.moveX * PIXEL_PER_METER * dt / 1000;
        this.y += this.moveY * PIXEL_PER_METER * dt / 1000;

        // Make sure player is on top of the ground.
        this.y = world.getTop(this.x, this.y);

        this.y = world.getBottom(this.x, this.y + 30) - 30;

        this.x = world.getLeft(this.x + 10, this.y + 25, 10) - 10;
        this.x = world.getRight(this.x - 10, this.y + 25, 10) + 10;

        // Player dropping down when there is no ground below
        if (world.collidesWith(this.x, this.y - 1) === 0) {
            this.moveY -= GRAVITY * dt / 1000;
        } else {
            this.moveY = 0;
        }

        // Player moving right
        if (this.moveRight) {
            this.moveX = Math.min(MAX_PLAYER_SPEED, this.moveX + PLAYER_ACCELERATION * dt / 1000);
        } else if (this.moveLeft) {
            this.moveX = Math.max(-MAX_PLAYER_SPEED, this.moveX - PLAYER_ACCELERATION * dt / 1000);
        } else {
            if (this.moveX > 0) {
                this.moveX = Math.max(0, this.moveX - PLAYER_ACCELERATION * dt / 1000);
            } else {
                this.moveX = Math.min(0, this.moveX + PLAYER_ACCELERATION * dt / 1000);
            }
        }

        // check for npc in interactionRange
        const closestEntity = this.getClosestEntityInRange(this.interactionRange);
        if (closestEntity instanceof NPC) {
            this.closestNPC = closestEntity;
        } else {
            this.closestNPC = null;
        }
    }
}
