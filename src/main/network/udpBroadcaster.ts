import dgram from 'dgram';

let socket: dgram.Socket | null = null;
let responseCallback: ((msg: unknown, rinfo: dgram.RemoteInfo) => void) | null = null;

export function init(callback: (msg: unknown, rinfo: dgram.RemoteInfo) => void): void {
    if (socket) {
        responseCallback = callback;
        return;
    }
    responseCallback = callback;
    socket = dgram.createSocket('udp4');
    socket.bind(() => {
        socket!.setBroadcast(true);
    });
    socket.on('message', (msg, rinfo) => {
        try {
            responseCallback?.(JSON.parse(msg.toString()), rinfo);
        } catch {
            // Discard invalid JSON
        }
    });
}

export function sendBroadcast(port: number, msg: unknown): void {
    if (!socket) return;
    const data = Buffer.from(JSON.stringify(msg));
    socket.send(data, port, '255.255.255.255');
}

export function sendUnicast(address: string, port: number, msg: unknown): void {
    if (!socket) return;
    const data = Buffer.from(JSON.stringify(msg));
    socket.send(data, port, address);
}

export function close(): void {
    if (socket) {
        socket.close();
        socket = null;
    }
    responseCallback = null;
}
