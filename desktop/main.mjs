import { app, BrowserWindow, shell, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let win = null;
let server = null;
let localUrl = '';
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win?.isMinimized()) win.restore();
    win?.focus();
  });

  const createWindow = () => {
    win = new BrowserWindow({
      width: 1490,
      height: 940,
      minWidth: 900,
      minHeight: 650,
      title: 'ZuzuMod Studio',
      backgroundColor: '#090e18',
      autoHideMenuBar: true,
      show: false,
      icon: path.join(path.dirname(fileURLToPath(import.meta.url)), 'icon.ico'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true
      }
    });
    win.once('ready-to-show', () => win?.show());
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https:\/\//i.test(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (event, target) => {
      if (!target.startsWith(localUrl + '/') && target !== localUrl) event.preventDefault();
    });
    void win.loadURL(localUrl).catch(error => {
      dialog.showErrorBox('ZuzuMod Studio', 'Could not load the app: ' + error.message);
    });
    win.on('closed', () => { win = null; });
  };

  app.whenReady().then(async () => {
    try {
      process.env.PORT = '0';
      const backend = await import('../server/index.mjs');
      server = backend.listener;
      if (!server.listening) await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
      });
      localUrl = 'http://127.0.0.1:' + server.address().port;
      createWindow();
      app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
    } catch (error) {
      dialog.showErrorBox('ZuzuMod Studio startup error', String(error?.stack || error));
      app.quit();
    }
  });
  app.on('before-quit', () => { try { server?.close(); } catch {} });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
