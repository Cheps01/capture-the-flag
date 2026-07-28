// ═══════════════════════════════════════════════════════════════════
// CTF Protocol v1 — Shared Type Definitions
// ═══════════════════════════════════════════════════════════════════

// ─── Protocol Constants ──────────────────────────────────────────

export const PROTOCOL_VERSION = 1;

export const UDP_DISCOVERY_PORT = 8888;

export const MESSAGE_MAX_SIZE = 65536; // 64 KB in bytes

// ─── Game Config Constants (welcome.config — fixed, non-configurable) ─

export const GameConfig = {
    map_size: 1000,
    circle_radius: 300,
    player_radius: 15,
    interact_radius: 40,
    speed: 200,
    tick_rate: 20,
} as const;

// ─── Server Constants ────────────────────────────────────────────

export const ServerConstants = {
    countdown_seconds: 5,
    min_players: 2,
    post_game_seconds: 5,
    circle_center: { x: 500, y: 500 },
    spawn_radius_min: 350,
    spawn_radius_max: 450,
    victory_distance: 315, // circle_radius + player_radius
} as const;

// ─── Protocol Limits ─────────────────────────────────────────────

export const ProtocolLimits = {
    max_players: 100,
    name_max_length: 20,
    message_max_size: MESSAGE_MAX_SIZE,
} as const;

// ─── Error Reason Codes ──────────────────────────────────────────

export const ErrorReasons = [
    'INVALID_JSON',
    'UNKNOWN_TYPE',
    'MISSING_FIELD',
    'INVALID_FIELD',
    'INVALID_PHASE',
    'VERSION_MISMATCH',
    'LOBBY_FULL',
    'NAME_INVALID',
    'GAME_STARTED',
    'MESSAGE_TOO_LARGE',
    'NOT_JOINED',
] as const;

export type ErrorReason = (typeof ErrorReasons)[number];

// ─── Server States ───────────────────────────────────────────────

export const ServerState = {
    LOBBY: 'lobby',
    PLAYING: 'playing',
} as const;

export type ServerStateValue = (typeof ServerState)[keyof typeof ServerState];

// ─── Direction ───────────────────────────────────────────────────

export type DirectionValue = -1 | 0 | 1;

// ─── Player Info (lobby list) ────────────────────────────────────

export interface PlayerInfo {
    id: string;
    name: string;
}

// ─── Player State (in-game position) ─────────────────────────────

export interface PlayerState {
    id: string;
    x: number;
    y: number;
}

// ─── Flag State ──────────────────────────────────────────────────

export interface FlagState {
    owner: string | null;
    x: number;
    y: number;
}

// ─── Welcome Config ──────────────────────────────────────────────

export interface WelcomeConfig {
    map_size: number;
    circle_radius: number;
    player_radius: number;
    interact_radius: number;
    speed: number;
    tick_rate: number;
}

// ═══════════════════════════════════════════════════════════════════
// Message Types — UDP Discovery
// ═══════════════════════════════════════════════════════════════════

/** Client → UDP broadcast: discover servers on the LAN */
export interface DiscoverMessage {
    type: 'discover';
    v: typeof PROTOCOL_VERSION;
}

/** Server → UDP unicast: response with server info */
export interface ServerInfoMessage {
    type: 'server_info';
    v: typeof PROTOCOL_VERSION;
    name: string;
    tcp_port: number;
    state: ServerStateValue;
    players: number;
}

// ═══════════════════════════════════════════════════════════════════
// Message Types — Client → Server (TCP)
// ═══════════════════════════════════════════════════════════════════

/** Client → Server: request to join the game */
export interface JoinMessage {
    type: 'join';
    v: typeof PROTOCOL_VERSION;
    name: string;
}

/** Client → Server: movement direction input */
export interface InputMessage {
    type: 'input';
    dir: {
        x: DirectionValue;
        y: DirectionValue;
    };
}

/** Client → Server: attempt to capture or steal the flag */
export interface InteractMessage {
    type: 'interact';
}

// ═══════════════════════════════════════════════════════════════════
// Message Types — Server → Client (TCP)
// ═══════════════════════════════════════════════════════════════════

/** Server → Client: assigns identity and game constants */
export interface WelcomeMessage {
    type: 'welcome';
    player_id: string;
    config: WelcomeConfig;
}

/** Server → Client: list of players in the lobby */
export interface LobbyMessage {
    type: 'lobby';
    players: PlayerInfo[];
}

/** Server → Client: countdown before game start */
export interface CountdownMessage {
    type: 'countdown';
    seconds: number;
}

/** Server → Client: game has started */
export interface StartMessage {
    type: 'start';
}

/** Server → Client: full game state snapshot */
export interface StateMessage {
    type: 'state';
    flag: FlagState;
    players: PlayerState[];
}

/** Server → Client: game over with winner */
export interface GameOverMessage {
    type: 'game_over';
    winner: string;
}

/** Server → Client: error response */
export interface ErrorMessage {
    type: 'error';
    reason: ErrorReason;
}

// ═══════════════════════════════════════════════════════════════════
// Union Types
// ═══════════════════════════════════════════════════════════════════

/** All UDP messages */
export type UdpMessage = DiscoverMessage | ServerInfoMessage;

/** All client-to-server TCP messages */
export type ClientMessage = JoinMessage | InputMessage | InteractMessage;

/** All server-to-client TCP messages */
export type ServerMessage =
    | WelcomeMessage
    | LobbyMessage
    | CountdownMessage
    | StartMessage
    | StateMessage
    | GameOverMessage
    | ErrorMessage;

/** All protocol messages */
export type ProtocolMessage = UdpMessage | ClientMessage | ServerMessage;
