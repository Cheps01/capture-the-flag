import { ipcMain, BrowserWindow } from 'electron';
import net from 'net';
import { createTcpServer } from './network/tcpServer';
import { createTcpClient } from './network/tcpClient';

let activeSocket: net.Socket | null = null;

export function registerNetworkHandlers(mainWindow: BrowserWindow): void {

    ipcMain.handle('network:start-server', (_event, port: number) => {
        const server = createTcpServer(port);

        server.on('connection', (socket) => {
            mainWindow.webContents.send('network:peer-connected', {
                address: socket.remoteAddress,
                port: socket.remotePort
            });

            socket.on('data', (chunk) => {
                mainWindow.webContents.send('network:message-received', chunk.toString());
            });

            activeSocket = socket;
        });

        return { success: true, port };
    });

    ipcMain.handle('network:connect-client', (_event, host: string, port: number) => {
        const socket = createTcpClient(host, port);

        socket.on('data', (chunk) => {
            mainWindow.webContents.send('network:message-received', chunk.toString());
        });

        activeSocket = socket;
        return { success: true };
    });

    ipcMain.on('network:send-message', (_event, data: string) => {
        if (activeSocket) {
            activeSocket.write(Buffer.from(data));
        }
    });
}