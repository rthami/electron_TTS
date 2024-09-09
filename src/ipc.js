const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { savePreferences, preferences, loadPreferences } = require('./preferences');
const { loadMessages, getMessage } = require('./languages');
const {
  checkProgramAvailability,
  canRead,
  readChunksSequentially,
  CHAR_LIMIT,
  splitTextIntoPhrases
} = require('./utils');
const { setIsReading } = require('./state');

// Variables globales pour gérer l'état de l'application
let mplayerProcess = null;
let isPaused = false;
let isPicoAvailable = false;
let isMplayerAvailable = false;

function setupIPC(mainWindow) {
  // Charger les préférences au démarrage
  const prefs = loadPreferences();
  let currentLanguage = prefs.interfaceLang;
  let currentColor = prefs.interfaceColor;


  // Vérifier la disponibilité des programmes nécessaires
  checkProgramAvailability('pico2wave', (picoExists) => {
    isPicoAvailable = picoExists;
    if (!picoExists) {
      mainWindow.webContents.send('program-check', getMessage('errorPicoAbsent', currentLanguage));
    }

    checkProgramAvailability('mplayer', (mplayerExists) => {
      isMplayerAvailable = mplayerExists;
      if (!mplayerExists) {
        mainWindow.webContents.send('program-check', getMessage('errorMplayerAbsent', currentLanguage));
      }

      if (!picoExists && !mplayerExists) {
        mainWindow.webContents.send('program-check', getMessage('errorBothAbsent', currentLanguage));
      }
    });
  });

  // Gestionnaire pour sauvegarder les préférences
  ipcMain.on('save-preferences', (event, newPreferences) => {
    Object.assign(preferences, newPreferences);
    savePreferences(preferences);
    if (newPreferences.interfaceLang && newPreferences.interfaceLang !== currentLanguage) {
      currentLanguage = newPreferences.interfaceLang;
      const messages = loadMessages(currentLanguage);
      mainWindow.webContents.send('language-changed', messages);
    }
    if (newPreferences.interfaceColor && newPreferences.interfaceColor !== currentColor) {
      currentColor = newPreferences.interfaceColor;
      mainWindow.webContents.send('color-changed', currentColor);
    }
  });

  // Gestionnaire pour changer la langue de l'interface
  ipcMain.on('change-language', (event, newLang) => {
    console.log('Changing language to:', newLang);
    currentLanguage = newLang;
    const messages = loadMessages(newLang);
    mainWindow.webContents.send('language-changed', messages);
    savePreferences({ ...preferences, interfaceLang: newLang });
  });

  // Gestionnaire pour demander les messages initiaux
  ipcMain.on('request-messages', (event) => {
    const messages = loadMessages(currentLanguage);
    event.reply('initial-messages', {initialMessages:messages});
  });

  function processTextIntoChunks(text, charLimit) {
    const sentences = splitTextIntoPhrases(text);
    const chunks = [];

    sentences.forEach(sentence => {
      if (sentence.length > charLimit) {
        // Si une phrase dépasse la limite, la diviser
        let remainingSentence = sentence;
        while (remainingSentence.length > 0) {
          chunks.push(remainingSentence.slice(0, charLimit).trim());
          remainingSentence = remainingSentence.slice(charLimit);
        }
      } else {
        // Sinon, ajouter la phrase comme un chunk
        chunks.push(sentence.trim());
      }
    });

    return chunks;
  }

  // Gestionnaire pour la lecture de texte
  ipcMain.on('speak', (event, text, lang) => {
    if (!canRead(event, currentLanguage, isPicoAvailable, isMplayerAvailable, mplayerProcess, getMessage)) return;

    const chunks = processTextIntoChunks(text, CHAR_LIMIT);
    console.log(`Nombre de chunks : ${chunks.length}`);
    readChunksSequentially(event, chunks, lang, currentLanguage, getMessage, (newMplayerProcess) => {
      mplayerProcess = newMplayerProcess;
    });
  });

  // Gestionnaire pour mettre en pause ou reprendre la lecture
  ipcMain.on('pause-resume', (event) => {
    if (mplayerProcess) {
      mplayerProcess.stdin.write('p');
      isPaused = !isPaused;
      event.reply('pause-resume-success', isPaused ? getMessage('paused', currentLanguage) : getMessage('resumed', currentLanguage));
    } else {
      event.reply('speak-error', getMessage('noReadingInProgress', currentLanguage));
    }
  });

  // Gestionnaire pour arrêter la lecture
  ipcMain.on('stop', (event) => {
    setIsReading(false);
    if (mplayerProcess) {
      mplayerProcess.kill();
      event.reply('speak-success', getMessage('readingStopped', currentLanguage));
      mplayerProcess = null;
    } else {
      event.reply('speak-error', getMessage('noReadingInProgress', currentLanguage));
    }
  });

  // Gestionnaire pour ouvrir la boîte de dialogue de sélection de fichier
  ipcMain.on('open-file-dialog', (event) => {
    dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    }).then(result => {
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        try {
          const text = fs.readFileSync(filePath, 'utf-8');
          event.reply('file-loaded', { filePath, text });
          event.reply('speak-success', getMessage('fileLoaded', currentLanguage));
        } catch (error) {
          event.reply('speak-error', getMessage('fileLoadError', currentLanguage, error.message));
        }
      } else {
        event.reply('speak-error', getMessage('fileSelectionCancelled', currentLanguage));
      }
    }).catch(err => {
      event.reply('speak-error', getMessage('dialogOpenError', currentLanguage, err.message));
    });
  });
}

module.exports = { setupIPC };