import Phaser from 'phaser';
import { GameConfig, ServerConstants } from '../../shared/types';
import type { StateMessage, PlayerState, FlagState, DirectionValue } from '../../shared/types';
import { getIsServer, getPlayerId } from '../client/ClientState';
import { getLatestState } from '../server/GameServer';
import type { GameServer } from '../server/GameServer';

const PLAYER_COLORS = [
    0x4fc3f7, 0xf06292, 0xffd54f, 0x81c784,
    0xba68c8, 0xff8a65, 0xaed581, 0x7986cb,
];

export class GameScene extends Phaser.Scene {

    private localPlayerId: string | null = null;
    private isServer = false;
    private gameServer: GameServer | null = null;

    private mapGraphics: Phaser.GameObjects.Graphics | null = null;
    private playerSprites = new Map<string, Phaser.GameObjects.Container>();
    private flagSprite: Phaser.GameObjects.Container | null = null;
    private flagGfx: Phaser.GameObjects.Graphics | null = null;

    private lastDir = { x: 0 as DirectionValue, y: 0 as DirectionValue };
    private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
    private lastState: StateMessage | null = null;

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: { gameServer?: GameServer }): void {
        this.gameServer = data.gameServer ?? null;
        this.isServer = getIsServer();
        this.localPlayerId = this.isServer
            ? (this.gameServer?.getHostPlayerId() ?? null)
            : getPlayerId();
    }

    create(): void {
        const worldSize = GameConfig.map_size;

        this.cameras.main.setBackgroundColor('#1a1a2e');
        this.cameras.main.setBounds(0, 0, worldSize, worldSize);

        // ── Draw map ─────────────────────────────────────────────
        this.mapGraphics = this.add.graphics();
        this.drawMap();

        // ── Flag ─────────────────────────────────────────────────
        this.flagSprite = this.add.container(500, 500);
        this.flagGfx = this.add.graphics();
        this.flagSprite.add(this.flagGfx);
        this.drawFlag(false);

        // ── Keyboard ─────────────────────────────────────────────
        const kb = this.input.keyboard;
        if (kb) {
            this.keys = {
                W: kb.addKey('W'),
                A: kb.addKey('A'),
                S: kb.addKey('S'),
                D: kb.addKey('D'),
                UP: kb.addKey('UP'),
                DOWN: kb.addKey('DOWN'),
                LEFT: kb.addKey('LEFT'),
                RIGHT: kb.addKey('RIGHT'),
                SPACE: kb.addKey('SPACE'),
            };
        }

        // ── Camera ───────────────────────────────────────────────
        if (this.localPlayerId) {
            const placeholder = this.add.circle(0, 0, 1, 0x000000, 0);
            placeholder.setVisible(false);
            placeholder.setPosition(worldSize / 2, worldSize / 2);
            this.cameras.main.startFollow(placeholder, true, 0.1, 0.1);
            this.cameras.main.setZoom(0.8);
            // Store reference to update position later
            (this as any)._followTarget = placeholder;
        }

        // ── Register state listener (client mode) ────────────────
        if (!this.isServer) {
            const wc = (window as any).client;
            if (wc) {
                wc.onState((data: StateMessage) => {
                    this.lastState = data;
                });
                wc.onGameOver((data: any) => {
                    const name = data.winner;
                    this.scene.start('GameOverScene', { winnerName: name, isServer: false });
                });
            }
        }
    }

    update(): void {
        this.handleInput();

        // Get latest state
        let state: StateMessage | null = null;
        if (this.isServer) {
            state = getLatestState();
        } else {
            state = this.lastState;
        }

        if (state) {
            this.renderState(state);
        }
    }

    // ── Map Rendering ────────────────────────────────────────────

    private drawMap(): void {
        const g = this.mapGraphics;
        if (!g) return;

        const size = GameConfig.map_size;
        const cx = ServerConstants.circle_center.x;
        const cy = ServerConstants.circle_center.y;
        const r = GameConfig.circle_radius;

        // Map border
        g.lineStyle(2, 0x444466, 1);
        g.strokeRect(0, 0, size, size);

        // Grid lines (subtle)
        g.lineStyle(1, 0x222244, 0.3);
        for (let i = 100; i < size; i += 100) {
            g.lineBetween(i, 0, i, size);
            g.lineBetween(0, i, size, i);
        }

        // Central circle
        g.lineStyle(3, 0xff6b6b, 0.8);
        g.strokeCircle(cx, cy, r);

        // Circle fill (very subtle)
        g.fillStyle(0xff6b6b, 0.05);
        g.fillCircle(cx, cy, r);

        // Center dot
        g.fillStyle(0xff6b6b, 0.5);
        g.fillCircle(cx, cy, 4);
    }

    // ── Flag Rendering ───────────────────────────────────────────

    private drawFlag(carried: boolean): void {
        if (!this.flagGfx) return;
        this.flagGfx.clear();

        if (carried) {
            // Small diamond when carried
            this.flagGfx.fillStyle(0xffd700, 1);
            this.flagGfx.fillTriangle(0, -8, -6, 0, 0, 8);
            this.flagGfx.fillTriangle(0, -8, 6, 0, 0, 8);
        } else {
            // Flag on pole when free
            this.flagGfx.lineStyle(2, 0xcccccc, 1);
            this.flagGfx.lineBetween(0, -12, 0, 8);
            this.flagGfx.fillStyle(0xff4444, 1);
            this.flagGfx.fillTriangle(2, -12, 2, -4, 12, -8);
        }
    }

    // ── State Rendering ──────────────────────────────────────────

    private renderState(state: StateMessage): void {
        const existingIds = new Set(state.players.map(p => p.id));

        // Remove disconnected players
        for (const [id, sprite] of this.playerSprites) {
            if (!existingIds.has(id)) {
                sprite.destroy();
                this.playerSprites.delete(id);
            }
        }

        // Update or create players
        for (let i = 0; i < state.players.length; i++) {
            const ps = state.players[i];
            let container = this.playerSprites.get(ps.id);

            if (!container) {
                container = this.createPlayerSprite(ps.id, i);
                this.playerSprites.set(ps.id, container);
            }

            container.setPosition(ps.x, ps.y);

            // Update carry indicator
            const carryGfx = container.getAt(2) as Phaser.GameObjects.Graphics;
            if (carryGfx) {
                carryGfx.clear();
                if (state.flag.owner === ps.id) {
                    carryGfx.fillStyle(0xffd700, 0.6);
                    carryGfx.fillCircle(0, 0, GameConfig.player_radius + 5);
                }
            }
        }

        // Update flag position
        this.updateFlag(state.flag);

        // Update camera follow target
        if (this.localPlayerId) {
            const localPlayer = state.players.find(p => p.id === this.localPlayerId);
            if (localPlayer) {
                const target = (this as any)._followTarget;
                if (target) {
                    target.setPosition(localPlayer.x, localPlayer.y);
                }
            }
        }
    }

    private createPlayerSprite(id: string, colorIndex: number): Phaser.GameObjects.Container {
        const container = this.add.container(0, 0);

        // Body circle
        const bodyGfx = this.add.graphics();
        const color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
        bodyGfx.fillStyle(color, 1);
        bodyGfx.fillCircle(0, 0, GameConfig.player_radius);
        bodyGfx.lineStyle(2, 0xffffff, 0.3);
        bodyGfx.strokeCircle(0, 0, GameConfig.player_radius);

        // Name label
        const name = id === this.localPlayerId ? 'Tú' : id.substring(0, 12);
        const nameText = this.add.text(0, -GameConfig.player_radius - 14, name, {
            fontSize: '11px',
            color: '#ffffff',
            fontFamily: 'monospace',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5);

        // Carry indicator (drawn on top when this player has the flag)
        const carryGfx = this.add.graphics();

        container.add([bodyGfx, nameText, carryGfx]);
        return container;
    }

    private updateFlag(flag: FlagState): void {
        if (!this.flagSprite) return;

        this.flagSprite.setPosition(flag.x, flag.y);
        this.drawFlag(flag.owner !== null);
    }

    // ── Input ────────────────────────────────────────────────────

    private handleInput(): void {
        if (!this.localPlayerId) return;

        let dx: DirectionValue = 0;
        let dy: DirectionValue = 0;

        if (this.keys.A?.isDown || this.keys.LEFT?.isDown) dx -= 1;
        if (this.keys.D?.isDown || this.keys.RIGHT?.isDown) dx += 1;
        if (this.keys.W?.isDown || this.keys.UP?.isDown) dy -= 1;
        if (this.keys.S?.isDown || this.keys.DOWN?.isDown) dy += 1;

        // Clamp to -1..1
        dx = Math.max(-1, Math.min(1, dx)) as DirectionValue;
        dy = Math.max(-1, Math.min(1, dy)) as DirectionValue;

        // Only send if direction changed
        if (dx !== this.lastDir.x || dy !== this.lastDir.y) {
            this.lastDir = { x: dx, y: dy };
            this.sendInput(dx, dy);
        }

        // Interact (space)
        if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
            this.sendInteract();
        }
    }

    private sendInput(dx: DirectionValue, dy: DirectionValue): void {
        if (this.isServer) {
            this.gameServer?.processLocalInput({ x: dx, y: dy });
        } else {
            (window as any)?.client?.input?.({ x: dx, y: dy });
        }
    }

    private sendInteract(): void {
        if (this.isServer) {
            this.gameServer?.processLocalInteract();
        } else {
            (window as any)?.client?.interact?.();
        }
    }
}
