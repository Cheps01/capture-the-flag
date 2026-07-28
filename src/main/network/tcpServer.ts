import net from 'net';
import { MESSAGE_MAX_SIZE } from '../../shared/types';

interface Client {
    socket: net.Socket;
    buffer: string;
}

let server: net.Server | null = null;
const clients = new Map<string, Client>();
let nextId = 1;

let messageCallback: ((clientId: string, msg: unknown) => void) | null = null;
let connectCallback: ((clientId: string) => void) | null = null;
let disconnectCallback: ((clientId: string) => void) | null = null;

export function start(
    port: number,
    callbacks: {
        onMessage: (clientId: string, msg: unknown) => void;
        onClientConnect: (clientId: string) => void;
        onClientDisconnect: (clientId: string) => void;
    },
): void {
    stop();
    clients.clear();
    nextId = 1;
    messageCallback = callbacks.onMessage;
    connectCallback = callbacks.onClientConnect;
    disconnectCallback = callbacks.onClientDisconnect;

    server = net.createServer((sock) => {
        const clientId = String(nextId++);
        const client: Client = { socket: sock, buffer: '' };
        clients.set(clientId, client);
        connectCallback?.(clientId);

        sock.on('data', (chunk) => {
            client.buffer += chunk.toString();
            let idx: number;
            while ((idx = client.buffer.indexOf('\n')) !== -1) {
                let line = client.buffer.substring(0, idx);
                client.buffer = client.buffer.substring(idx + 1);
                if (line.endsWith('\r')) line = line.slice(0, -1);
                if (line.length === 0) continue;
                if (Buffer.byteLength(line, 'utf8') > MESSAGE_MAX_SIZE) {
                    sock.destroy();
                    return;
                }
                try {
                    messageCallback?.(clientId, JSON.parse(line));
                } catch {
                    // Invalid JSON, discard
                }
            }
        });

        sock.on('close', () => {
            clients.delete(clientId);
            disconnectCallback?.(clientId);
        });

        sock.on('error', () => {
            clients.delete(clientId);
            disconnectCallback?.(clientId);
        });
    });

    server.on('error', (err) => {
        console.error('TCP server error:', err);
    });

    server.listen(port, () => {
        console.log(`TCP server listening on port ${port}`);
    });
}

export function sendTo(clientId: string, msg: unknown): void {
    const client = clients.get(clientId);
    if (!client || client.socket.destroyed) return;
    const json = JSON.stringify(msg);
    if (Buffer.byteLength(json, 'utf8') > MESSAGE_MAX_SIZE) return;
    client.socket.write(json + '\n');
}

export function broadcast(msg: unknown): void {
    const json = JSON.stringify(msg);
    if (Buffer.byteLength(json, 'utf8') > MESSAGE_MAX_SIZE) return;
    for (const client of clients.values()) {
        if (!client.socket.destroyed) {
            client.socket.write(json + '\n');
        }
    }
}

export function kick(clientId: string): void {
    const client = clients.get(clientId);
    if (client) {
        client.socket.destroy();
        clients.delete(clientId);
    }
}

export function stop(): void {
    for (const client of clients.values()) {
        client.socket.destroy();
    }
    clients.clear();
    if (server) {
        server.close();
        server = null;
    }
    messageCallback = null;
    connectCallback = null;
    disconnectCallback = null;
}

export function getClientIds(): string[] {
    return Array.from(clients.keys());
}
