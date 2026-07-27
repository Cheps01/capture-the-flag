import dgram from 'dgram';

export function createUdpListener(port: number): dgram.Socket {

    const socket = dgram.createSocket('udp4');

    socket.on('message', (msg: Buffer, rinfo: dgram.RemoteInfo) => {
        console.log(`Mensaje de ${rinfo.address}:${rinfo.port} ->`, msg);
    });

    socket.on('error', (err) => {
        console.error('Error UDP:', err);
        socket.close();
    });

    socket.bind(port, () => {
        console.log(`Socket UDP escuchando en puerto ${port}`);
    });

    return socket;
}