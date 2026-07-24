import { BrowserWindow } from 'electron';
import path from 'path';

export function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  window.loadFile(path.join(__dirname, '../renderer/index.html'));
  window.webContents.openDevTools();
  return window;
}