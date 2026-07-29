import type { WelcomeConfig } from '../../shared/types';

export interface ClientData {
    playerId: string | null;
    playerName: string | null;
    config: WelcomeConfig | null;
    isServer: boolean;
}

const state: ClientData = {
    playerId: null,
    playerName: null,
    config: null,
    isServer: false,
};

export function getPlayerId(): string | null { return state.playerId; }
export function getPlayerName(): string | null { return state.playerName; }
export function getConfig(): WelcomeConfig | null { return state.config; }
export function getIsServer(): boolean { return state.isServer; }

export function setPlayerId(id: string): void { state.playerId = id; }
export function setPlayerName(name: string): void { state.playerName = name; }
export function setConfig(config: WelcomeConfig): void { state.config = config; }
export function setIsServer(is: boolean): void { state.isServer = is; }

export function reset(): void {
    state.playerId = null;
    state.playerName = null;
    state.config = null;
    state.isServer = false;
}
