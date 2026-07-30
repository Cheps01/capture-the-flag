import {
    GameConfig,
    ServerConstants,
    ProtocolLimits,
    PROTOCOL_VERSION,
} from '../../shared/types';
import type {
    PlayerInfo,
    PlayerState,
    FlagState,
    StateMessage,
    DiscoverMessage,
    JoinMessage,
    InputMessage,
    DirectionValue,
    ErrorReason,
} from '../../shared/types';
import { setIsServer } from '../client/ClientState';

// ─── Internal Types ──────────────────────────────────────────────

type Phase = 'lobby' | 'countdown' | 'playing' | 'game_over';

interface Player {
    id: string;
    name: string;
    clientId: string;
    x: number;
    y: number;
    dir: { x: DirectionValue; y: DirectionValue };
    wasInsideCircle: boolean;
}

export interface GameServerCallbacks {
    onPhaseChange: (phase: Phase) => void;
    onPlayersUpdate: (players: PlayerInfo[]) => void;
    onCountdown: (seconds: number) => void;
    onStart: () => void;
    onGameOver: (winnerName: string) => void;
}

// ─── Shared State (read by GameScene) ────────────────────────────

let latestState: StateMessage | null = null;

export function getLatestState(): StateMessage | null {
    return latestState;
}

// ─── GameServer ──────────────────────────────────────────────────

let nextPlayerNum = 1;

export class GameServer {
    private phase: Phase = 'lobby';
    private players = new Map<string, Player>();
    private clientToPlayer = new Map<string, string>();
    private flag: FlagState = { owner: null, x: 500, y: 500 };
    private countdownInterval: ReturnType<typeof setInterval> | null = null;
    private tickInterval: ReturnType<typeof setInterval> | null = null;
    private postGameTimeout: ReturnType<typeof setTimeout> | null = null;
    private callbacks: GameServerCallbacks;
    private hostPlayerId: string;
    private hostName: string;
    private serverName: string;
    private lastTickTime = 0;
    private winnerDeclared = false;
    private tcpPort = 0;

    constructor(hostName: string, callbacks: GameServerCallbacks) {
        this.hostName = hostName;
        this.serverName = `${hostName}'s CTF`;
        this.callbacks = callbacks;

        this.hostPlayerId = this.generatePlayerId();
        this.players.set(this.hostPlayerId, {
            id: this.hostPlayerId,
            name: hostName,
            clientId: 'host',
            x: 0,
            y: 0,
            dir: { x: 0, y: 0 },
            wasInsideCircle: false,
        });
        this.clientToPlayer.set('host', this.hostPlayerId);

        setIsServer(true);
        this.emitPlayersUpdate();
    }

    // ── Lifecycle ────────────────────────────────────────────────

    start(port: number): void {
        this.tcpPort = port;
        (window as any).server.listen(port);
        this.registerListeners();
    }

    stop(): void {
        this.clearCountdown();
        this.clearTick();
        this.clearPostGame();
        (window as any).server.stop();
    }

    // ── Listener Registration ────────────────────────────────────

    private registerListeners(): void {
        const ws = (window as any).server;

        ws.onDiscover((msg: DiscoverMessage, address: string, remotePort: number) => {
            this.handleDiscover(msg, address, remotePort);
        });

        ws.onJoin((clientId: string, msg: JoinMessage) => {
            this.handleJoin(clientId, msg);
        });

        ws.onInput((clientId: string, msg: InputMessage) => {
            this.handleInput(clientId, msg);
        });

        ws.onInteract((clientId: string) => {
            this.handleInteract(clientId);
        });

        ws.onClientConnect((clientId: string) => {
            this.handleClientConnect(clientId);
        });

        ws.onClientDisconnect((clientId: string) => {
            this.handleClientDisconnect(clientId);
        });
    }

    // ── UDP Discovery ────────────────────────────────────────────

    private handleDiscover(_msg: DiscoverMessage, address: string, remotePort: number): void {
        const ws = (window as any).server;
        ws.serverInfo(address, remotePort, {
            type: 'server_info',
            v: PROTOCOL_VERSION,
            name: this.serverName,
            tcp_port: this.tcpPort,
            state: this.phase === 'lobby' ? 'lobby' : 'playing',
            players: this.players.size,
        });
    }

    // ── Client Connection ────────────────────────────────────────

    private handleClientConnect(clientId: string): void {
        this.clientToPlayer.set(clientId, '');
    }

    private handleClientDisconnect(clientId: string): void {
        const playerId = this.clientToPlayer.get(clientId);
        if (!playerId) return;

        const wasCarrier = this.flag.owner === playerId;
        this.players.delete(playerId);
        this.clientToPlayer.delete(clientId);

        if (wasCarrier) {
            this.flag = { owner: null, x: 500, y: 500 };
        }

        if (this.phase === 'lobby') {
            this.emitPlayersUpdate();
        } else if (this.phase === 'countdown') {
            if (this.players.size < ServerConstants.min_players) {
                this.abortCountdown();
            }
        } else if (this.phase === 'playing') {
            if (this.players.size === 0) {
                this.clearTick();
                this.returnToLobby();
            }
        }
    }

    // ── Join ─────────────────────────────────────────────────────

    private handleJoin(clientId: string, msg: JoinMessage): void {
        const ws = (window as any).server;

        if (this.phase !== 'lobby') {
            ws.error(clientId, 'GAME_STARTED' as ErrorReason);
            return;
        }

        if (msg.v !== PROTOCOL_VERSION) {
            ws.error(clientId, 'VERSION_MISMATCH' as ErrorReason);
            return;
        }

        const name = (msg.name || '').trim();
        if (name.length === 0 || name.length > ProtocolLimits.name_max_length) {
            ws.error(clientId, 'NAME_INVALID' as ErrorReason);
            return;
        }

        if (this.clientToPlayer.has(clientId) && this.clientToPlayer.get(clientId) !== '') {
            ws.error(clientId, 'INVALID_PHASE' as ErrorReason);
            return;
        }

        if (this.players.size >= ProtocolLimits.max_players) {
            ws.error(clientId, 'LOBBY_FULL' as ErrorReason);
            return;
        }

        const playerId = this.generatePlayerId();
        this.players.set(playerId, {
            id: playerId,
            name,
            clientId,
            x: 0,
            y: 0,
            dir: { x: 0, y: 0 },
            wasInsideCircle: false,
        });
        this.clientToPlayer.set(clientId, playerId);

        ws.welcome(clientId, playerId);
        this.emitPlayersUpdate();
    }

    // ── Input / Interact ─────────────────────────────────────────

    private handleInput(clientId: string, msg: InputMessage): void {
        if (this.phase !== 'playing') return;

        const playerId = this.clientToPlayer.get(clientId);
        if (!playerId) return;

        const player = this.players.get(playerId);
        if (!player) return;

        const dx = msg.dir.x;
        const dy = msg.dir.y;
        if ((dx !== -1 && dx !== 0 && dx !== 1) || (dy !== -1 && dy !== 0 && dy !== 1)) {
            const ws = (window as any).server;
            ws.error(clientId, 'INVALID_FIELD' as ErrorReason);
            return;
        }

        player.dir = { x: dx, y: dy };
    }

    processLocalInput(dir: { x: DirectionValue; y: DirectionValue }): void {
        if (this.phase !== 'playing') return;
        const player = this.players.get(this.hostPlayerId);
        if (!player) return;
        player.dir = { x: dir.x, y: dir.y };
    }

    private handleInteract(clientId: string): void {
        if (this.phase !== 'playing') return;

        const playerId = this.clientToPlayer.get(clientId);
        if (!playerId) return;

        this.processInteractForPlayer(playerId);
    }

    processLocalInteract(): void {
        if (this.phase !== 'playing') return;
        this.processInteractForPlayer(this.hostPlayerId);
    }

    private processInteractForPlayer(playerId: string): void {
        const player = this.players.get(playerId);
        if (!player) return;

        if (this.flag.owner === null) {
            // Capture: must be within interact_radius of the flag
            const dist = this.distance(
                player.x, player.y,
                this.flag.x, this.flag.y,
            );
            if (dist <= GameConfig.interact_radius) {
                this.flag.owner = playerId;
                player.wasInsideCircle = this.isInsideCircle(player.x, player.y);
            }
        } else if (this.flag.owner !== playerId) {
            // Steal: must be within interact_radius of the carrier
            const carrier = this.players.get(this.flag.owner);
            if (!carrier) return;
            const dist = this.distance(
                player.x, player.y,
                carrier.x, carrier.y,
            );
            if (dist <= GameConfig.interact_radius) {
                this.flag.owner = playerId;
                player.wasInsideCircle = this.isInsideCircle(player.x, player.y);
            }
        }
    }

    // ── Countdown ────────────────────────────────────────────────

    startCountdown(): void {
        if (this.phase !== 'lobby') return;
        if (this.players.size < ServerConstants.min_players) return;

        this.phase = 'countdown';
        this.callbacks.onPhaseChange('countdown');

        let seconds = ServerConstants.countdown_seconds;
        this.broadcastCountdown(seconds);

        this.countdownInterval = setInterval(() => {
            seconds--;
            if (seconds <= 0) {
                this.clearCountdown();
                this.startGame();
            } else {
                this.broadcastCountdown(seconds);
            }
        }, 1000);
    }

    private broadcastCountdown(seconds: number): void {
        (window as any).server.countdown(seconds);
        this.callbacks.onCountdown(seconds);
    }

    private startGame(): void {
        this.phase = 'playing';
        this.flag = { owner: null, x: 500, y: 500 };
        this.winnerDeclared = false;

        // Spawn all players in the ring
        for (const player of this.players.values()) {
            const angle = Math.random() * Math.PI * 2;
            const r = ServerConstants.spawn_radius_min +
                Math.random() * (ServerConstants.spawn_radius_max - ServerConstants.spawn_radius_min);
            player.x = ServerConstants.circle_center.x + r * Math.cos(angle);
            player.y = ServerConstants.circle_center.y + r * Math.sin(angle);
            player.dir = { x: 0, y: 0 };
            player.wasInsideCircle = this.isInsideCircle(player.x, player.y);
        }

        (window as any).server.start();
        this.callbacks.onPhaseChange('playing');
        this.callbacks.onStart();

        // Start tick loop
        this.lastTickTime = performance.now();
        this.tickInterval = setInterval(() => this.tick(), 1000 / GameConfig.tick_rate);
    }

    private abortCountdown(): void {
        this.clearCountdown();
        this.phase = 'lobby';
        this.callbacks.onPhaseChange('lobby');
        this.emitPlayersUpdate();
    }

    // ── Game Over ────────────────────────────────────────────────

    endGame(winnerId: string): void {
        if (this.phase !== 'playing' || this.winnerDeclared) return;
        this.winnerDeclared = true;

        this.clearTick();

        const winner = this.players.get(winnerId);
        const winnerName = winner ? winner.name : winnerId;

        this.phase = 'game_over';
        (window as any).server.gameOver(winnerId);
        this.callbacks.onPhaseChange('game_over');
        this.callbacks.onGameOver(winnerName);

        this.postGameTimeout = setTimeout(() => {
            this.returnToLobby();
        }, ServerConstants.post_game_seconds * 1000);
    }

    private returnToLobby(): void {
        this.phase = 'lobby';
        this.flag = { owner: null, x: 500, y: 500 };
        this.winnerDeclared = false;
        latestState = null;
        this.callbacks.onPhaseChange('lobby');
        this.emitPlayersUpdate();
    }

    // ── Tick Loop ────────────────────────────────────────────────

    private tick(): void {
        if (this.phase !== 'playing') return;

        const now = performance.now();
        const dt = (now - this.lastTickTime) / 1000; // seconds
        this.lastTickTime = now;

        // 1. Apply movement for all players
        for (const player of this.players.values()) {
            this.applyMovement(player, dt);
        }

        // 2. Check victory condition
        if (this.flag.owner) {
            const carrier = this.players.get(this.flag.owner);
            if (carrier) {
                const isInside = this.isInsideCircle(carrier.x, carrier.y);
                if (carrier.wasInsideCircle && !isInside) {
                    // Victory: transition from inside to outside while carrying flag
                    this.endGame(carrier.id);
                    return;
                }
                carrier.wasInsideCircle = isInside;
            }
        }

        // 3. Broadcast state
        this.broadcastState();
    }

    private applyMovement(player: Player, dt: number): void {
        const dx = player.dir.x;
        const dy = player.dir.y;

        if (dx === 0 && dy === 0) return;

        // Normalize diagonal movement
        let speed = GameConfig.speed;
        if (dx !== 0 && dy !== 0) {
            speed /= Math.SQRT2;
        }

        player.x += dx * speed * dt;
        player.y += dy * speed * dt;

        // Clamp to map bounds
        player.x = Math.max(
            GameConfig.player_radius,
            Math.min(GameConfig.map_size - GameConfig.player_radius, player.x),
        );
        player.y = Math.max(
            GameConfig.player_radius,
            Math.min(GameConfig.map_size - GameConfig.player_radius, player.y),
        );
    }

    private broadcastState(): void {
        const playerStates: PlayerState[] = [];
        for (const player of this.players.values()) {
            playerStates.push({
                id: player.id,
                x: Math.round(player.x * 10) / 10,
                y: Math.round(player.y * 10) / 10,
            });

            // If carrier, flag position = carrier position
            if (this.flag.owner === player.id) {
                this.flag.x = player.x;
                this.flag.y = player.y;
            }
        }

        const stateMsg: StateMessage = {
            type: 'state',
            flag: { ...this.flag },
            players: playerStates,
        };

        latestState = stateMsg;
        (window as any).server.state(this.flag, playerStates);
    }

    // ── Host Controls ────────────────────────────────────────────

    getPhase(): Phase { return this.phase; }

    getPlayers(): PlayerInfo[] {
        return Array.from(this.players.values()).map(p => ({
            id: p.id,
            name: p.name,
        }));
    }

    getHostPlayerId(): string { return this.hostPlayerId; }

    // ── Helpers ──────────────────────────────────────────────────

    private generatePlayerId(): string {
        return `player_${nextPlayerNum++}`;
    }

    private emitPlayersUpdate(): void {
        this.callbacks.onPlayersUpdate(this.getPlayers());
    }

    private isInsideCircle(x: number, y: number): boolean {
        const dx = x - ServerConstants.circle_center.x;
        const dy = y - ServerConstants.circle_center.y;
        return Math.sqrt(dx * dx + dy * dy) <= ServerConstants.victory_distance;
    }

    private distance(x1: number, y1: number, x2: number, y2: number): number {
        const dx = x1 - x2;
        const dy = y1 - y2;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private clearCountdown(): void {
        if (this.countdownInterval !== null) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }

    private clearTick(): void {
        if (this.tickInterval !== null) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }

    private clearPostGame(): void {
        if (this.postGameTimeout !== null) {
            clearTimeout(this.postGameTimeout);
            this.postGameTimeout = null;
        }
    }
}
