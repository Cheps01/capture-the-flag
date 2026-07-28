import net from 'net';
import { MESSAGE_MAX_SIZE } from '../../shared/types';

let buffer = '';
let socket: net.Socket | null = null;
let messageCallback: ((msg: unknown) => void) | null = null;
let closeCallback: (() => void) | null = null;

export function connect(
    host: string,
    port: number,
    callbacks: {
        onMessage: (msg: unknown) => void;
        onConnect: () => void;
        onClose: () => void;
        onError: (err: Error) => void;
    },
): void {
    disconnect();
    buffer = '';
    messageCallback = callbacks.onMessage;
    closeCallback = callbacks.onClose;

    socket = net.createConnection({ host, port }, () => {
        callbacks.onConnect();
    });

    socket.on('data', (chunk) => {
        buffer += chunk.toString();
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
            let line = buffer.substring(0, idx);
            buffer = buffer.substring(idx + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.length === 0) continue;
            if (Buffer.byteLength(line, 'utf8') > MESSAGE_MAX_SIZE) continue;
            try {
                messageCallback?.(JSON.parse(line));
            } catch {
                // Invalid JSON, discard
            }
        }
    });

    socket.on('close', () => {
        socket = null;
        buffer = '';
        closeCallback?.();
    });

    socket.on('error', (err) => {
        callbacks.onError(err);
    });
}

export function send(msg: unknown): void {
    if (!socket || socket.destroyed) return;
    const json = JSON.stringify(msg);
    if (Buffer.byteLength(json, 'utf8') > MESSAGE_MAX_SIZE) return;
    socket.write(json + '\n');
}

export function disconnect(): void {
    if (socket) {
        socket.destroy();
        socket = null;
    }
    buffer = '';
    messageCallback = null;
    closeCallback = null;
}

export function isConnected(): boolean {
    return socket !== null && !socket.destroyed;
}
