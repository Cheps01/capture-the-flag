import net from 'net';

export function createTcpClient(host: string, port: number): net.Socket {

    const socket = net.createConnection({ host, port }, () => {
        console.log('Conectado al servidor');
        socket.write(Buffer.from('Hola servidor\n'));
    });

    socket.on('data', (chunk: Buffer) => {
        console.log('Datos recibidos:', chunk);
    });

    socket.on('close', () => {
        console.log('Conexión cerrada');
    });

    socket.on('error', (err) => {
        console.error('Error en socket:', err);
    });

    return socket;
}