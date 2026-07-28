import { contextBridge, ipcRenderer } from 'electron';


contextBridge.exposeInMainWorld('network', {

    // Renderer actions
    startServer: (port: number) =>
        ipcRenderer.invoke('network:start-server', port),
    connectAsClient: (host: string, port: number) =>
        ipcRenderer.invoke('network:connect-client', host, port),
    sendMessage: (data: string) =>
        ipcRenderer.send('network:send-message', data),

    // Renderer event listeners
    onMessageReceived: (callback: (data: string) => void) => {
        ipcRenderer.on('network:message-received', (_event, data) => callback(data));
    },
    onPeerConnected: (callback: (info: { address: string; port: number }) => void) => {
        ipcRenderer.on('network:peer-connected', (_event, info) => callback(info));
    }
});