const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  domReady: (callback) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  },
  // DOM Manipulation
  getElementById: (id) => document.getElementById(id),
  querySelector: (selector) => document.querySelector(selector),
  querySelectorAll: (selector, callback) => {
    const elements = document.querySelectorAll(selector);
    callback(Array.from(elements));
  },
  addEventListener: (selector, event, callback) => {
    const element = document.querySelector(selector);
    if (element) element.addEventListener(event, callback);
  },
  removeEventListener: (selector, event, callback) => {
    const element = document.querySelector(selector);
    if (element) element.removeEventListener(event, callback);
  },
  setAttribute: (selector, attr, value) => {
    const element = document.querySelector(selector);
    if (element) element.setAttribute(attr, value);
  },
  setProperty: (selector, prop, value) => {
    console.log(`setProperty called with: ${selector}, ${prop}, ${value}`);
    const element = document.querySelector(selector);
    if (element) {
      element[prop] = value;
      console.log(`Property set successfully`);
    } else {
      console.log(`Element not found for selector: ${selector}`);
    }
  },
  getValue: (selector, callback) => {
    const element = document.querySelector(selector);
    if (callback && element) {
      callback(element.value);
      return;
    }
    return element ? element.value : null;
  },
  setValue: (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.value = value;
  },
  setInnerHTML: (selector, html) => {
    const element = document.querySelector(selector);
    if (element) element.innerHTML = html;
  },
  setTextContent: (selector, text) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = text;
  },
  focus: (selector) => {
    const element = document.querySelector(selector);
    if (element) element.focus();
  },
  setSelectionRange: (selector, start, end) => {
    const element = document.querySelector(selector);
    if (element) element.setSelectionRange(start, end);
  },
  // IPC Communication
  stateMethode: (channel, data) => {
    return new Promise((resolve, reject) => {
      ipcRenderer.once(channel, (event, response) => {
        resolve(response);
      });
      ipcRenderer.send(channel, data);
    });
  },
  sendIpcMessage: (channel,...args) => {
    if (args.length === 0) {
      ipcRenderer.send(channel);
    } else {
      ipcRenderer.send(channel,...args);
    }
  },
  onIpcMessage: (channel, func) => {
    const subscription = (event, ...args) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },

  // Méthode IPC pour traduire du texte
  traduireTexte: (texte, sourceLang, targetLang) => {
    return ipcRenderer.invoke('traduire-texte', texte, sourceLang, targetLang);
  },
  // Utility Functions
  setDocumentTitle: (title) => {
    document.title = title;
  },
};

// Expose the entire electronAPI object
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

console.log('Exposed API functions:', Object.keys(electronAPI));