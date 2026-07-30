import { ipcMain, BrowserWindow } from 'electron';
import * as tcpClient from './network/tcpClient';
import * as tcpServer from './network/tcpServer';
import * as udpBroadcast from './network/udpBroadcaster';
import * as udpListen from './network/udpListener';
import { PROTOCOL_VERSION, GameConfig } from '../shared/types';
import type {
    DiscoverMessage,
    ServerInfoMessage,
    JoinMessage,
    InputMessage,
    InteractMessage,
    WelcomeMessage,
    LobbyMessage,
    CountdownMessage,
    StartMessage,
    StateMessage,
    GameOverMessage,
    ErrorMessage,
    ProtocolMessage,
    PlayerInfo,
    FlagState,
    PlayerState,
    ErrorReason,
    DirectionValue,
} from '../shared/types';

export function registerNetworkHandlers(mainWindow: BrowserWindow): void {

    // ═══════════════════════════════════════════════════════════════
    // CLIENT — UDP Discovery
    // ═══════════════════════════════════════════════════════════════

    ipcMain.handle('client:discover', (_event, port?: number) => {
        udpBroadcast.init((msg, rinfo) => {
            try {
                const typed = msg as ServerInfoMessage;
                if (typed.type === 'server_info') {
                    mainWindow.webContents.send('client:server_info', typed, rinfo.address);
                }
            } catch {
                // Discard invalid UDP messages silently per protocol
            }
        });
        const discoverMsg: DiscoverMessage = { type: 'discover', v: PROTOCOL_VERSION };
        udpBroadcast.sendBroadcast(port ?? 8888, discoverMsg);
    });

    // ═══════════════════════════════════════════════════════════════
    // CLIENT — TCP Connection
    // ═══════════════════════════════════════════════════════════════

    ipcMain.handle('client:connect', (_event, host: string, port: number) => {
        return new Promise<void>((resolve) => {
            tcpClient.connect(host, port, {
                onMessage: (msg) => {
                    try {
                        const typed = msg as ProtocolMessage;
                        mainWindow.webContents.send(`client:${typed.type}`, typed);
                    } catch {
                        // Could notify renderer of parse error here
                    }
                },
                onConnect: () => {
                    mainWindow.webContents.send('client:connected');
                    resolve();
                },
                onClose: () => {
                    mainWindow.webContents.send('client:disconnected');
                },
                onError: (err) => {
                    console.error('TCP client error:', err);
                },
            });
        });
    });

    ipcMain.handle('client:disconnect', () => {
        tcpClient.disconnect();
    });

    // ═══════════════════════════════════════════════════════════════
    // CLIENT — Send Protocol Messages (TCP)
    // ═══════════════════════════════════════════════════════════════

    ipcMain.handle('client:join', (_event, name: string) => {
        const msg: JoinMessage = { type: 'join', v: PROTOCOL_VERSION, name };
        tcpClient.send(msg);
    });

    ipcMain.handle('client:input', (_event, dir: { x: DirectionValue; y: DirectionValue }) => {
        const msg: InputMessage = { type: 'input', dir };
        tcpClient.send(msg);
    });

    ipcMain.handle('client:interact', () => {
        const msg: InteractMessage = { type: 'interact' };
        tcpClient.send(msg);
    });

    // ═══════════════════════════════════════════════════════════════
    // SERVER — Start / Stop
    // ═══════════════════════════════════════════════════════════════

    ipcMain.handle('server:listen', (_event, port: number) => {
        tcpServer.start(port, {
            onMessage: (clientId, msg) => {
                try {
                    const typed = msg as ProtocolMessage;
                    mainWindow.webContents.send(`server:${typed.type}`, clientId, typed);
                } catch {
                    tcpServer.sendTo(clientId, {
                        type: 'error',
                        reason: 'UNKNOWN_TYPE' as ErrorReason,
                    } as ErrorMessage);
                }
            },
            onClientConnect: (clientId) => {
                mainWindow.webContents.send('server:client_connect', clientId);
            },
            onClientDisconnect: (clientId) => {
                mainWindow.webContents.send('server:client_disconnect', clientId);
            },
        });

        udpListen.start((msg, address, remotePort) => {
            try {
                const typed = msg as DiscoverMessage;
                if (typed.type === 'discover') {
                    mainWindow.webContents.send('server:discover', typed, address, remotePort);
                }
            } catch {
                // Discard invalid UDP messages silently per protocol
            }
        });
    });

    ipcMain.handle('server:stop', () => {
        tcpServer.stop();
        udpListen.stop();
    });

    ipcMain.handle('server:kick', (_event, clientId: string) => {
        tcpServer.kick(clientId);
    });

    // ═══════════════════════════════════════════════════════════════
    // SERVER — Send Protocol Messages
    // ═══════════════════════════════════════════════════════════════

    ipcMain.handle('server:server_info', (_event, address: string, port: number, data: ServerInfoMessage) => {
        udpListen.respond(address, port, data);
    });

    ipcMain.handle('server:welcome', (_event, clientId: string, playerId: string) => {
        const msg: WelcomeMessage = {
            type: 'welcome',
            player_id: playerId,
            config: GameConfig,
        };
        tcpServer.sendTo(clientId, msg);
    });

    ipcMain.handle('server:lobby', (_event, players: PlayerInfo[]) => {
        const msg: LobbyMessage = { type: 'lobby', players };
        tcpServer.broadcast(msg);
    });

    ipcMain.handle('server:countdown', (_event, seconds: number) => {
        const msg: CountdownMessage = { type: 'countdown', seconds };
        tcpServer.broadcast(msg);
    });

    ipcMain.handle('server:start', () => {
        const msg: StartMessage = { type: 'start' };
        tcpServer.broadcast(msg);
    });

    ipcMain.handle('server:state', (_event, flag: FlagState, players: PlayerState[]) => {
        const msg: StateMessage = { type: 'state', flag, players };
        tcpServer.broadcast(msg);
    });

    ipcMain.handle('server:game_over', (_event, winner: string) => {
        const msg: GameOverMessage = { type: 'game_over', winner };
        tcpServer.broadcast(msg);
    });

    ipcMain.handle('server:error', (_event, clientId: string, reason: ErrorReason) => {
        const msg: ErrorMessage = { type: 'error', reason };
        tcpServer.sendTo(clientId, msg);
    });
}
