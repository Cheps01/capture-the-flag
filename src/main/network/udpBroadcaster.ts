import dgram from 'dgram';
import os from 'os';

let socket: dgram.Socket | null = null;
let responseCallback: ((msg: unknown, rinfo: dgram.RemoteInfo) => void) | null = null;

function getSubnetBroadcastAddresses(): string[] {
    const addresses: string[] = [];
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] ?? []) {
            if (iface.family !== 'IPv4' || iface.internal) continue;
            const ipParts = iface.address.split('.').map(Number);
            const maskParts = (iface.netmask || '255.255.255.0').split('.').map(Number);
            const broadcastParts = ipParts.map((ip, i) => (ip | (~maskParts[i] & 255)));
            const broadcast = broadcastParts.join('.');
            if (broadcast !== '255.255.255.255') {
                addresses.push(broadcast);
            }
        }
    }
    return [...new Set(addresses)];
}

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
    for (const broadcast of getSubnetBroadcastAddresses()) {
        socket.send(data, port, broadcast);
    }
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
