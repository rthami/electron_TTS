// main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { setupIPC } = require('./src/ipc');
const { loadPreferences } = require('./src/preferences');
const { loadMessages } = require('./src/languages');

let mainWindow = null;

function createWindow() {
  const prefs = loadPreferences();
  const lang = prefs.interfaceLang || app.getLocale() || 'fr';
  console.log('Langue initiale:', lang);

  mainWindow = new BrowserWindow({
    width: 800,
    height: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true,
      enableRemoteModule: true,
    }
  });

  mainWindow.loadFile('index.html');

  const initialMessages = loadMessages(lang);
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('initial-messages', initialMessages);
    mainWindow.webContents.send('preferences-loaded', prefs);
  });

  setupIPC(mainWindow);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});