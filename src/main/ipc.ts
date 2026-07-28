import { ipcMain, BrowserWindow } from 'electron';
import * as tcpClient from './network/tcpClient';
import * as tcpServer from './network/tcpServer';
import * as udpBroadcast from './network/udpBroadcaster';
import * as udpListen from './network/udpListener';
import { PROTOCOL_VERSION, GameConfig } from '../shared/types';
import type { DiscoverMessage } from '../shared/types';

export function registerNetworkHandlers(mainWindow: BrowserWindow): void {

    // ═══════════════════════════════════════════════════════════════
    // CLIENT — UDP Discovery
    // ═══════════════════════════════════════════════════════════════

    ipcMain.handle('client:discover', (_event, port?: number) => {
        udpBroadcast.init((msg) => {
            if (msg && typeof msg === 'object' && 'type' in msg && (msg as Record<string, unknown>).type === 'server_info') {
                mainWindow.webContents.send('client:server_info', msg);
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
                    if (msg && typeof msg === 'object' && 'type' in msg) {
                        const type = (msg as Record<string, unknown>).type;
                        mainWindow.webContents.send(`client:${type}`, msg);
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
        tcpClient.send({ type: 'join', v: PROTOCOL_VERSION, name });
    });

    ipcMain.handle('client:input', (_event, dir: { x: number; y: number }) => {
        tcpClient.send({ type: 'input', dir });
    });

    ipcMain.handle('client:interact', () => {
        tcpClient.send({ type: 'interact' });
    });

    // ═══════════════════════════════════════════════════════════════
    // SERVER — Start / Stop
    // ═══════════════════════════════════════════════════════════════

    ipcMain.handle('server:listen', (_event, port: number) => {
        tcpServer.start(port, {
            onMessage: (clientId, msg) => {
                if (msg && typeof msg === 'object' && 'type' in msg) {
                    const type = (msg as Record<string, unknown>).type;
                    mainWindow.webContents.send(`server:${type}`, clientId, msg);
                }
            },
            onClientConnect: (clientId) => {
                mainWindow.webContents.send('server:client_connect', clientId);
            },
            onClientDisconnect: (clientId) => {
                mainWindow.webContents.send('server:client_disconnect', clientId);
            },
        });

        udpListen.start((msg, address, _remotePort) => {
            if (msg && typeof msg === 'object' && 'type' in msg && (msg as Record<string, unknown>).type === 'discover') {
                mainWindow.webContents.send('server:discover', msg, address);
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

    ipcMain.handle('server:server_info', (_event, address: string, port: number, data: Record<string, unknown>) => {
        udpListen.respond(address, port, data);
    });

    ipcMain.handle('server:welcome', (_event, clientId: string, playerId: string) => {
        tcpServer.sendTo(clientId, {
            type: 'welcome',
            player_id: playerId,
            config: GameConfig,
        });
    });

    ipcMain.handle('server:lobby', (_event, players: Array<{ id: string; name: string }>) => {
        tcpServer.broadcast({ type: 'lobby', players });
    });

    ipcMain.handle('server:countdown', (_event, seconds: number) => {
        tcpServer.broadcast({ type: 'countdown', seconds });
    });

    ipcMain.handle('server:start', () => {
        tcpServer.broadcast({ type: 'start' });
    });

    ipcMain.handle('server:state', (_event, flag: Record<string, unknown>, players: Array<Record<string, unknown>>) => {
        tcpServer.broadcast({ type: 'state', flag, players });
    });

    ipcMain.handle('server:game_over', (_event, winner: string) => {
        tcpServer.broadcast({ type: 'game_over', winner });
    });

    ipcMain.handle('server:error', (_event, clientId: string, reason: string) => {
        tcpServer.sendTo(clientId, { type: 'error', reason });
    });
}
