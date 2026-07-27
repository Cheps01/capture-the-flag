import net from 'net';

export function createTcpServer(port: number): net.Server {

    const server = net.createServer((socket: net.Socket) => {
        console.log(`Cliente conectado: ${socket.remoteAddress}:${socket.remotePort}`);

        socket.on('data', (chunk: Buffer) => {
            console.log('Datos recibidos:', chunk);
        });

        socket.on('close', () => {
            console.log('Cliente desconectado');
        });

        socket.on('error', (err) => {
            console.error('Error en socket:', err);
        });

        socket.write(Buffer.from('Bienvenido\n'));
    });

    
    server.listen(port, () => {
        console.log(`Servidor TCP escuchando en puerto ${port}`);
    });

    return server;
}