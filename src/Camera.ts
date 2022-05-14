import { Vector2, clamp } from './util';

interface camFocus {
    x: number;
    y: number;
    duration: number;
    startTime: number;
    endTime: number;
    zoom: number;
    progress: number;
    dead: boolean;
    force: number;
};

export class Camera {
    public x = 0;
    public y = 0;
    public zoom = 1;
    private focuses: camFocus[] = [];
    private time = 0;
    private interpolationTime!: number;

    constructor(private target: Vector2, interpolationTime = 0.5, private barHeight = 0.15) {
        if (interpolationTime > 1) {
            throw new Error("Camera interpolation time may not exceed 1");
        }
        this.interpolationTime = interpolationTime / 2;
        // TODO remove this example camera focus
        setTimeout(() => this.focusOn(3, 2150,1350, 0.5), 5000);
    }

    public update(dt: number, time: number) {
        this.time = time;
        // Base position always on target (player)
        this.x = this.target.x;
        this.y = this.target.y;
        this.zoom = 1;
        // On top of that, apply cam focus(es)
        for (const focus of this.focuses) {
            this.updateAndApplyFocus(focus);
        }
        // Drop any focus that is done
        this.focuses = this.focuses.filter(f => !f.dead);
    }

    /**
     * Returns true if cam target (player) currently has full attention, or is showing something else for the moment.
     */
    public isOnTarget(): boolean {
        return this.focuses.length === 0;
    }

    /**
     * Returns strength of camera focus on something other than the player. E.g. when camera focuses on some place to
     * show the player, the focus force will be between 0 and 1 during interpolation and exactly 1 while fully focusing
     * on that spot. This e.g. can be used for cinematic bars at top and bottom, scaling their height.
     */
    public getFocusForce(): number {
        return this.focuses.reduce((a, b) => Math.max(a, b.force), 0);
    }

    public applyTransform(ctx: CanvasRenderingContext2D): void {
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.x, this.y);
    }

    public focusOn(duration: number, x: number, y: number, zoom = 1) {
        const focus: camFocus = {
            x,
            y,
            duration,
            zoom,
            startTime: this.time,
            endTime: this.time + duration,
            progress: 0,
            dead: false,
            force: 0
        };
        this.focuses.push(focus);
    }

    public updateAndApplyFocus(focus: camFocus) {
        focus.progress = clamp((this.time - focus.startTime) / focus.duration, 0, 1);
        focus.dead = (focus.progress >= 1);
        if (!focus.dead) {
            // Fade in and out of focus using force lerping from 0 to 1 and back to 0 over time
            let force = 1;
            if (focus.progress < this.interpolationTime || focus.progress > 1 - this.interpolationTime) {
                const diff = ((focus.progress < 0.5) ? focus.progress : (1 - focus.progress)) / this.interpolationTime;
                force = 0.5 - 0.5 * Math.cos(diff * Math.PI);
            }
            focus.force = force;
            // Apply to camera state
            const f1 = 1 - force;
            this.x = f1 * this.x + force * focus.x;
            this.y = f1 * this.y + force * focus.y;
            this.zoom = f1 * this.zoom + force * focus.zoom;
        }
    }

    public renderCinematicBars(ctx: CanvasRenderingContext2D, force = this.getFocusForce()): void {
        ctx.save();
        ctx.fillStyle = "black";
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const h = ctx.canvas.height * this.barHeight * force;
        ctx.fillRect(0, 0, ctx.canvas.width, h);
        ctx.fillRect(0, ctx.canvas.height - h, ctx.canvas.width, h);
        ctx.restore();
    }
}
