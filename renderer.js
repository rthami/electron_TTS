const { ipcRenderer } = require('electron');
let currentFilePath = null;  // Variable pour stocker le chemin du fichier
const textarea = document.getElementById('text-input');
const selectLang = document.getElementById('lang-select');
const prefSelectLang = document.getElementById('interface-lang-select');
const prefSelecColor = document.getElementById('interface-color-select');

const updateUILanguage = (messages) => {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (messages[key]) {
      if (element.tagName === 'INPUT' && element.type === 'button') {
        element.value = messages[key];
      } else {
        element.textContent = messages[key];
      }
    }
  });
  document.title = messages['HTMLTitle'] || document.title;
}

const changeColor = (color, place) => {
  console.log('Received new color:', color, place);
  document.getElementById('cssColor').href = `./css/color.${color}.css`;
}

const setInitvalue = (set) => {
  selectLang.value = set.readLang
  prefSelectLang.value = set.lang
  prefSelecColor.value = set.color

}
// Fonction pour initialiser l'interface utilisateur
const initUI = () => {

  // Sélectionnez les éléments nécessaires por la modale préférence 
  const prefButton = document.getElementById('pref-button');
  const prefModal = document.getElementById('pref-modal');
  const closePrefModalButton = document.getElementById('close-pref-modal');

  // Ajoutez un événement pour ouvrir la modale lorsque l'utilisateur clique sur le bouton
  prefButton.addEventListener('click', () => {
    prefModal.open = true;
  });

  // Ajoutez un événement pour fermer la modale lorsque l'utilisateur clique sur le bouton de fermeture
  closePrefModalButton.addEventListener('click', () => {
    prefModal.open = false;
  });

  // Gestion du bouton "Lire le Texte" ou "Lire le Fichier"
  document.getElementById('speak-button').addEventListener('click', () => {
    const lang = selectLang.value;
    const text = textarea.value;
    ipcRenderer.send('speak', text, lang);
  });

  // Gestion du bouton "Pause/Reprendre"
  document.getElementById('pause-resume-button').addEventListener('click', () => {
    ipcRenderer.send('pause-resume');
  });

  // Gestion du bouton "Stop"
  document.getElementById('stop-button').addEventListener('click', () => {
    ipcRenderer.send('stop');
  });

  // Gestion du bouton "Vider le texte"
  document.getElementById('clear-text-button').addEventListener('click', () => {
    textarea.value = '';
    currentFilePath = null;  // Réinitialiser le chemin du fichier
  });

  // Gestion de la sélection d'un fichier texte
  document.getElementById('file-input-button').addEventListener('click', () => {
    ipcRenderer.send('open-file-dialog');
  });

  // Sauvegarde des préférences utilisateur
  document.getElementById('save-preferences').addEventListener('click', () => {
    const interfaceLang = document.getElementById('interface-lang-select').value;
    const interfaceColor = document.getElementById('interface-color-select').value;
    const preferences = { interfaceLang, interfaceColor };
    ipcRenderer.send('save-preferences', preferences);
    prefModal.open = false;
  });

  // Gestion du changement de langue de l'interface
  prefSelectLang.addEventListener('change', (event) => {
    const newLang = event.target.value;
    console.log('Interface language changed to:', newLang);
    ipcRenderer.send('change-language', newLang);
  });


  // Gestion du changement de couleur de l'interface
  prefSelecColor.addEventListener('change', (event) => {
    const newColor = event.target.value;
    console.log('Interface color changed to:', newColor);
    ipcRenderer.send('change-color', newColor);
  });

  // Demander les messages initiaux au chargement de la page
  ipcRenderer.send('request-messages');
}

const langMap = {
  'fr': 'fr-FR',
  'en': 'en-US',
  'es': 'es-ES',
  'de': 'de-DE',
  'it': 'it-IT'
};

ipcRenderer.on('language-changed', (event, messages) => {
  updateUILanguage(messages);
});

ipcRenderer.on('color-changed', (event, messages) => {
  changeColor(messages, 'color-changed');
});

ipcRenderer.on('initial-messages', (event, messages, color, lang) => {
  console.log('Received initial messages:', messages);
  updateUILanguage(messages);
  changeColor(color, 'initial-messages');
  setInitvalue({ color, lang, readLang: langMap[lang] })
});

// Fonction générique pour gérer les événements IPC
function handleIpcEvent(event, data) {
  switch (event) {
    case 'speak-success':
    case 'speak-error':
    case 'pause-resume-success':
    case 'program-check':
      document.getElementById('status').innerText = data;
      break;
    case 'file-loaded':
      const filePath = data.filePath; // Stocke le chemin du fichier
      const fileContent = data.text; // Stocke le contenu du fichier
      textarea.value = fileContent; // Affiche le contenu dans le textarea
      currentFilePath = filePath; // Stocke le chemin du fichier pour une lecture ultérieure
      break;
    case 'speak':
      const text = textarea.value;
      const startIndex = text.indexOf(data);
      const endIndex = startIndex + data.length;
      textarea.selectionStart = startIndex;
      textarea.selectionEnd = endIndex;
      textarea.focus();
    default:
      console.log('Événement non géré:', event, data);
  }
}

// Écouter tous les événements pertinents
const events = ['speak', 'speak-success', 'speak-error', 'pause-resume-success', 'file-loaded', 'program-check'];

events.forEach(eventName => {
  ipcRenderer.on(eventName, (_, data) => handleIpcEvent(eventName, data));
});

// Initialiser l'interface utilisateur lorsque le DOM est chargé
document.addEventListener('DOMContentLoaded', initUI);

