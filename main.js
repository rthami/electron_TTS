// main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { setupIPC } = require('./src/ipc');
const { loadPreferences } = require('./src/preferences');
const { loadMessages } = require('./src/languages');
const { verifyLibreTranslate, startLibreTranslate } = require('./src/utils');


verifyLibreTranslate();

let mainWindow = null;

function createWindow() {
  const prefs = loadPreferences();
  const lang = prefs.interfaceLang || app.getLocale() || 'fr';
  const color = prefs.interfaceColor || 'blue';
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      webSecurity: true,
    }
  });

  mainWindow.loadFile('index.html');

  const initialMessages = loadMessages(lang);
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('initial-messages', initialMessages, color, lang);
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

app.on('ready', () => {
  startLibreTranslate(); // Démarre LibreTranslate au démarrage d'Electron
});

