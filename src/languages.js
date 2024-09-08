const fs = require('fs');
const path = require('path');

let messages = {};

function loadMessages(lang) {
  const langFilePath = path.join(__dirname, '../lang', `${lang}.json`);
  try {
    const data = fs.readFileSync(langFilePath, 'utf-8');
    messages = JSON.parse(data);
    return messages;
  } catch (error) {
    console.error(`Erreur lors du chargement des messages pour la langue ${lang}:`, error);
    return {};
  }
}

function getMessage(key, ...args) {
  let message = messages[key] || key;
  args.forEach((arg, index) => {
    message = message.replace(`{${index}}`, arg);
  });
  return message;
}

module.exports = { loadMessages, getMessage };