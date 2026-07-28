import { contextBridge, ipcRenderer } from 'electron';

// ═══════════════════════════════════════════════════════════════════
// Client API — used when this app connects to a remote server
// ═══════════════════════════════════════════════════════════════════

contextBridge.exposeInMainWorld('client', {
    // ── UDP Discovery ──────────────────────────────────────────
    discover: (port?: number) =>
        ipcRenderer.invoke('client:discover', port),

    // ── TCP Connection ─────────────────────────────────────────
    connect: (host: string, port: number) =>
        ipcRenderer.invoke('client:connect', host, port),
    disconnect: () =>
        ipcRenderer.invoke('client:disconnect'),

    // ── Send Protocol Messages (C → S) ────────────────────────
    join: (name: string) =>
        ipcRenderer.invoke('client:join', name),
    input: (dir: { x: number; y: number }) =>
        ipcRenderer.invoke('client:input', dir),
    interact: () =>
        ipcRenderer.invoke('client:interact'),

    // ── Receive Events from Server (S → C) ─────────────────────
    onServerInfo: (cb: (data: unknown) => void) => {
        ipcRenderer.on('client:server_info', (_e, data) => cb(data));
    },
    onConnected: (cb: () => void) => {
        ipcRenderer.on('client:connected', () => cb());
    },
    onDisconnected: (cb: () => void) => {
        ipcRenderer.on('client:disconnected', () => cb());
    },
    onWelcome: (cb: (data: unknown) => void) => {
        ipcRenderer.on('client:welcome', (_e, data) => cb(data));
    },
    onLobby: (cb: (data: unknown) => void) => {
        ipcRenderer.on('client:lobby', (_e, data) => cb(data));
    },
    onCountdown: (cb: (data: unknown) => void) => {
        ipcRenderer.on('client:countdown', (_e, data) => cb(data));
    },
    onStart: (cb: () => void) => {
        ipcRenderer.on('client:start', (_e) => cb());
    },
    onState: (cb: (data: unknown) => void) => {
        ipcRenderer.on('client:state', (_e, data) => cb(data));
    },
    onGameOver: (cb: (data: unknown) => void) => {
        ipcRenderer.on('client:game_over', (_e, data) => cb(data));
    },
    onError: (cb: (data: unknown) => void) => {
        ipcRenderer.on('client:error', (_e, data) => cb(data));
    },
});

// ═══════════════════════════════════════════════════════════════════
// Server API — used when this app hosts a game
// ═══════════════════════════════════════════════════════════════════

contextBridge.exposeInMainWorld('server', {
    // ── Server Management ──────────────────────────────────────
    listen: (port: number) =>
        ipcRenderer.invoke('server:listen', port),
    stop: () =>
        ipcRenderer.invoke('server:stop'),
    kick: (clientId: string) =>
        ipcRenderer.invoke('server:kick', clientId),

    // ── Send UDP Response ──────────────────────────────────────
    serverInfo: (address: string, port: number, data: Record<string, unknown>) =>
        ipcRenderer.invoke('server:server_info', address, port, data),

    // ── Send Protocol Messages (S → C) ────────────────────────
    welcome: (clientId: string, playerId: string) =>
        ipcRenderer.invoke('server:welcome', clientId, playerId),
    lobby: (players: Array<{ id: string; name: string }>) =>
        ipcRenderer.invoke('server:lobby', players),
    countdown: (seconds: number) =>
        ipcRenderer.invoke('server:countdown', seconds),
    start: () =>
        ipcRenderer.invoke('server:start'),
    state: (flag: Record<string, unknown>, players: Array<Record<string, unknown>>) =>
        ipcRenderer.invoke('server:state', flag, players),
    gameOver: (winner: string) =>
        ipcRenderer.invoke('server:game_over', winner),
    error: (clientId: string, reason: string) =>
        ipcRenderer.invoke('server:error', clientId, reason),

    // ── Receive Events from Clients (C → S) ────────────────────
    onDiscover: (cb: (data: unknown, address: string) => void) => {
        ipcRenderer.on('server:discover', (_e, data, address) => cb(data, address));
    },
    onJoin: (cb: (clientId: string, data: unknown) => void) => {
        ipcRenderer.on('server:join', (_e, clientId, data) => cb(clientId, data));
    },
    onInput: (cb: (clientId: string, data: unknown) => void) => {
        ipcRenderer.on('server:input', (_e, clientId, data) => cb(clientId, data));
    },
    onInteract: (cb: (clientId: string) => void) => {
        ipcRenderer.on('server:interact', (_e, clientId) => cb(clientId));
    },
    onClientConnect: (cb: (clientId: string) => void) => {
        ipcRenderer.on('server:client_connect', (_e, clientId) => cb(clientId));
    },
    onClientDisconnect: (cb: (clientId: string) => void) => {
        ipcRenderer.on('server:client_disconnect', (_e, clientId) => cb(clientId));
    },
});
