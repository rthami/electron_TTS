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
const { setIsReading, getDisplayTrad, setDisplayTrad } = require('./state');


let mplayerProcess = null;
let isPaused = false;
let isPicoAvailable = false;
let isMplayerAvailable = false;

const setupIPC = (mainWindow) => {
  const prefs = loadPreferences();
  let currentLanguage = prefs.interfaceLang;
  let currentColor = prefs.interfaceColor;

  const sendToRenderer = (channel, ...args) => { 
    if (mainWindow) {
      mainWindow.webContents.send(channel, ...args);
    } else {
      console.error('mainWindow is not initialized');
    }
  }

  checkProgramAvailability('pico2wave', (picoExists) => {
    isPicoAvailable = picoExists;
    if (!picoExists) {
      sendToRenderer('program-check', getMessage('errorPicoAbsent', currentLanguage));
    }

    checkProgramAvailability('mplayer', (mplayerExists) => {
      isMplayerAvailable = mplayerExists;
      if (!mplayerExists) {
        sendToRenderer('program-check', getMessage('errorMplayerAbsent', currentLanguage));
      }

      if (!picoExists && !mplayerExists) {
        sendToRenderer('program-check', getMessage('errorBothAbsent', currentLanguage));
      }
    });
  });

  ipcMain.on('save-preferences', (event, newPreferences) => {
    Object.assign(preferences, newPreferences);
    savePreferences(preferences);
    if (newPreferences.interfaceLang && newPreferences.interfaceLang !== currentLanguage) {
      currentLanguage = newPreferences.interfaceLang;
      const messages = loadMessages(currentLanguage);
      sendToRenderer('language-changed', messages);
    }
    if (newPreferences.interfaceColor && newPreferences.interfaceColor !== currentColor) {
      currentColor = newPreferences.interfaceColor;
      sendToRenderer('color-changed', currentColor);
    }
  });

  ipcMain.on('change-language', (event, newLang) => {
    currentLanguage = newLang;
    const messages = loadMessages(newLang);
    sendToRenderer('language-changed', messages);
    savePreferences({ ...preferences, interfaceLang: newLang });
  });

  // ipcMain.on('request-messages', (event) => {
  //   console.log('from ipc =====================00');

  //   const messages = loadMessages(currentLanguage);
  //   event.reply('initial-messages', messages, currentColor, currentLanguage);
  // });

  const  processTextIntoChunks = (text, charLimit) => {
    const sentences = splitTextIntoPhrases(text);
    const chunks = [];

    sentences.forEach(sentence => {
      if (sentence.length > charLimit) {
        let remainingSentence = sentence;
        while (remainingSentence.length > 0) {
          chunks.push(remainingSentence.slice(0, charLimit).trim());
          remainingSentence = remainingSentence.slice(charLimit);
        }
      } else {
        chunks.push(sentence.trim());
      }
    });

    return chunks;
  }

  ipcMain.on('speak-error', (event, message) => {
    event.reply('speak-error', message);
  });

  ipcMain.on('speak', (event, text, lang) => {
    if (!canRead(event, currentLanguage, isPicoAvailable, isMplayerAvailable, mplayerProcess, getMessage)) return;

    const chunks = processTextIntoChunks(text, CHAR_LIMIT);
    console.log(`Nombre de chunks : ${chunks.length}`);
    readChunksSequentially(event, chunks, lang, currentLanguage, getMessage, (newMplayerProcess) => {
      mplayerProcess = newMplayerProcess;
    }, sendToRenderer);
  });

  ipcMain.on('pause-resume', (event) => {
    if (mplayerProcess) {
      mplayerProcess.stdin.write('p');
      isPaused = !isPaused;
      event.reply('pause-resume-success', isPaused ? getMessage('paused', currentLanguage) : getMessage('resumed', currentLanguage));
    } else {
      event.reply('speak-error', getMessage('noReadingInProgress', currentLanguage));
    }
  });

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

  // tradution 
  ipcMain.on('getDisplayTrad', (event) => {
    const displayTrad = getDisplayTrad(); // Récupérer la valeur depuis le state
    event.sender.send('getDisplayTrad', displayTrad); // Répondre avec la valeur
  });

  ipcMain.on('setDisplayTrad', (event,data) => {
    setDisplayTrad(data);
  });

  ipcMain.handle('traduire-texte', async (event, texte, sourceLang, targetLang) => {
    console.log(texte, sourceLang, targetLang);
    

    // Vérifie que les valeurs ne sont pas nulles ou vides
    if (!texte || !sourceLang || !targetLang) {
        throw new Error('Les paramètres de traduction sont manquants ou invalides.');
    }

    try {
        const response = await fetch('http://localhost:5000/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: texte,
                source: sourceLang,
                target: targetLang
            })
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP : ${response.status}`);
        }

        const data = await response.json();
        return data.translatedText;
    } catch (error) {
        console.error("Erreur lors de la traduction :", error);
        throw error; // Propagate the error to be handled in renderer
    }
});

}

module.exports = { setupIPC };