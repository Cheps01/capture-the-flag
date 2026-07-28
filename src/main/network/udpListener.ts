import dgram from 'dgram';
import { UDP_DISCOVERY_PORT } from '../../shared/types';

let socket: dgram.Socket | null = null;

export function start(onDiscover: (msg: unknown, address: string, port: number) => void): void {
    stop();
    socket = dgram.createSocket('udp4');
    socket.on('message', (msg, rinfo) => {
        try {
            onDiscover(JSON.parse(msg.toString()), rinfo.address, rinfo.port);
        } catch {
            // Discard invalid JSON per protocol
        }
    });
    socket.on('error', (err) => {
        console.error('UDP listener error:', err);
    });
    socket.bind(UDP_DISCOVERY_PORT, () => {
        console.log(`UDP discovery listening on port ${UDP_DISCOVERY_PORT}`);
    });
}

export function respond(address: string, port: number, msg: unknown): void {
    if (!socket) return;
    const data = Buffer.from(JSON.stringify(msg));
    socket.send(data, port, address);
}

export function stop(): void {
    if (socket) {
        socket.close();
        socket = null;
    }
}
