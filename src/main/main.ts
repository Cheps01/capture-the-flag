import { app } from 'electron';
import { createWindow } from './window'
import { registerNetworkHandlers } from './ipc';

app.whenReady().then(() => {
    const win = createWindow();
    registerNetworkHandlers(win);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
}); 