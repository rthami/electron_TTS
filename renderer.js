

let currentFilePath = null;
const langMap = {
  'fr': 'fr-FR',
  'en': 'en-US',
  'es': 'es-ES',
  'de': 'de-DE',
  'it': 'it-IT'
};

const updateUILanguage = (messages) => {
  window.electronAPI.querySelectorAll('[data-i18n]', (elements) => {
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      if (messages[key]) {
        if (key === 'HTMLPrefButton' || key === 'HTMLTranslateButton') {
          element.setAttribute('data-tooltip', messages[key]);
          return;
        }
        if (element.tagName === 'INPUT' && element.type === 'button') {
          // Vérifiez si l'élément existe avant de définir la propriété
          element.value = messages[key];
          return;
        }
        element.textContent = messages[key];
      } else {
        console.error(`Element not found for data-i18n key: ${key}`);
      }
    });
  });
};

const changeCssColor = (color) => {
  window.electronAPI.setAttribute('#cssColor', 'href', `./css/color.${color}.css`);
};

const setInitvalue = (set) => {
  langMap[window.electronAPI.setValue('#lang-select', set.readLang)] || 'fr';
  window.electronAPI.setValue('#lang-trad-select', set.readLang) || 'fr';
  window.electronAPI.setValue('#interface-lang-select', set.lang) || 'fr';
  window.electronAPI.setValue('#interface-color-select', set.color) || 'blue';
};

// console.log('Renderer script is running');
// console.log('Available electronAPI functions:', Object.keys(window.electronAPI));

// function checkFunction(funcName) {
//   if (typeof window.electronAPI[funcName] !== 'function') {
//     console.error(`Function ${funcName} is not available in electronAPI`);
//   } else {
//     console.log(`Function ${funcName} is available`);
//   }
// }

// checkFunction('setProperty');
// checkFunction('addEventListener');
// checkFunction('sendIpcMessage');

const initUI = () => {
  window.electronAPI.addEventListener('#pref-button', 'click', () => {
    window.electronAPI.setProperty('#pref-modal', 'open', true);
  });

  window.electronAPI.addEventListener('#close-pref-modal', 'click', () => {
    window.electronAPI.setProperty('#pref-modal', 'open', false);
  });

  window.electronAPI.addEventListener('#speak-button', 'click', async () => {
    const displayTrad = await window.electronAPI.stateMethode('getDisplayTrad');
    const textarea = displayTrad ? '#outputText' : '#text-input'
    const lang = langMap[window.electronAPI.getValue('#lang-select')] || 'fr-FR';
    const text = window.electronAPI.getValue(textarea);
    window.electronAPI.sendIpcMessage('speak', text, lang);
  });

  window.electronAPI.addEventListener('#pause-resume-button', 'click', () => {
    window.electronAPI.sendIpcMessage('pause-resume');
  });

  window.electronAPI.addEventListener('#stop-button', 'click', () => {
    window.electronAPI.sendIpcMessage('stop');
  });

  window.electronAPI.addEventListener('#clear-text-button', 'click', () => {
    window.electronAPI.setValue('#text-input', '');
    currentFilePath = null;
  });

  window.electronAPI.addEventListener('#file-input-button', 'click', () => {
    window.electronAPI.sendIpcMessage('open-file-dialog');
  });

  window.electronAPI.addEventListener('#save-preferences', 'click', () => {
    const interfaceLang = window.electronAPI.getValue('#interface-lang-select');
    const interfaceColor = window.electronAPI.getValue('#interface-color-select');
    const preferences = { interfaceLang, interfaceColor };
    window.electronAPI.sendIpcMessage('save-preferences', preferences);
    window.electronAPI.setProperty('#pref-modal', 'open', false);
  });

  window.electronAPI.addEventListener('#interface-lang-select', 'change', (event) => {
    const newLang = event.target.value;
    window.electronAPI.sendIpcMessage('change-language', newLang);
  });

  window.electronAPI.addEventListener('#interface-color-select', 'change', (event) => {
    const newColor = event.target.value;
    window.electronAPI.sendIpcMessage('change-color', newColor);
  });

  window.electronAPI.addEventListener('#openTranslate', 'click', async () => {
    const displayTrad = await window.electronAPI.stateMethode('getDisplayTrad');
    window.electronAPI.sendIpcMessage('setDisplayTrad', !displayTrad);
    window.electronAPI.querySelectorAll('.trad-display', (elements) => {
      elements.forEach((e) => {
        e.style.display = !displayTrad ? 'block' : 'none';
      });
    });
  });

  window.electronAPI.addEventListener('#translateButton', 'click', async () => {
    const texte = window.electronAPI.getValue('#text-input');
    const sourceLang = window.electronAPI.getValue('#lang-trad-select') || 'fr';
    const targetLang = window.electronAPI.getValue('#lang-select') || 'en';

    try {
      const translatedText = await window.electronAPI.traduireTexte(texte, sourceLang, targetLang);
      window.electronAPI.setProperty('#outputText', 'innerText', translatedText);
    } catch (error) {
      console.error('Erreur lors de la traduction :', error);
    }
  });
};

window.electronAPI.onIpcMessage('language-changed', (messages) => {
  updateUILanguage(messages);
});

window.electronAPI.onIpcMessage('color-changed', (messages) => {
  changeCssColor(messages);
});

window.electronAPI.onIpcMessage('initial-messages', (messages, color, lang) => {
  changeCssColor(color);
  setInitvalue({ color, lang, readLang: lang });
  updateUILanguage(messages);
});

const handleIpcEvent = async (event, data) => {
  switch (event) {
    case 'speak-success':
    case 'speak-error':
    case 'pause-resume-success':
    case 'program-check':
      window.electronAPI.setTextContent('#status', data);
      break;
    case 'file-loaded':
      window.electronAPI.setValue('#text-input', data.text);
      currentFilePath = data.filePath;
      break;
    case 'speak-progress':
      const displayTrad = await window.electronAPI.stateMethode('getDisplayTrad');
      const textarea = displayTrad ? '#outputText' : '#text-input'
      window.electronAPI.getValue(textarea, (text) => {
        const startIndex = text.indexOf(data);
        if (startIndex === -1) {
          console.error('Data not found in text.');
          return;
        }
        const endIndex = startIndex + data.length;
        window.electronAPI.focus(textarea);
        window.electronAPI.setSelectionRange(textarea, startIndex, endIndex);

        const textArea = window.electronAPI.querySelector(textarea);
        const startPos = textArea.value.substring(0, startIndex).length;
        const scrollPos = startPos / textArea.value.length * textArea.scrollHeight;
        textArea.scrollTop = scrollPos;
      });
      break;
    default:
      console.log('Événement non géré:', event, data);
  }
}

const events = ['speak-progress', 'speak-success', 'speak-error', 'pause-resume-success', 'file-loaded', 'program-check'];

events.forEach(eventName => {
  window.electronAPI.onIpcMessage(eventName, (data) => handleIpcEvent(eventName, data));
});

window.electronAPI.domReady(() => {
  console.log('DOM is ready, calling initUI');
  initUI();
});