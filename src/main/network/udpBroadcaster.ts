import dgram from 'dgram';

export function createUdpBroadcaster(): dgram.Socket {
    const socket = dgram.createSocket('udp4');
    socket.bind(() => {
        socket.setBroadcast(true);
    });
    return socket;
}

export function sendUdpMessage(socket: dgram.Socket, message: Buffer, port: number, address: string): void {
    socket.send(message, port, address, (err) => {
        if (err) console.error('Error enviando UDP:', err);
    });
}

export function broadcastDiscovery(socket: dgram.Socket, message: Buffer, discoveryPort: number): void {
    socket.send(message, discoveryPort, '255.255.255.255', (err) => {
        if (err) console.error('Error en broadcast:', err);
    });
}