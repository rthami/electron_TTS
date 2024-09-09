// preferences.js
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const userDataPath = app.getPath('userData');
const preferencesFilePath = path.join(userDataPath, 'preferences.json');

let preferences = { interfaceLang: 'fr', interfaceColor : 'blue'};

const loadPreferences = () => {
  // console.log('Chargement des préférences depuis :', preferencesFilePath);
  try {
    if (fs.existsSync(preferencesFilePath)) {
      const data = fs.readFileSync(preferencesFilePath, 'utf-8');
      preferences = JSON.parse(data);
      // console.log('Préférences chargées avec succès :', preferences);
    } else {
      // console.log("Le fichier de préférences n'existe pas, utilisation des préférences par défaut.");
      savePreferences();
    }
  } catch (error) {
    console.error('Erreur lors du chargement des préférences :', error);
  }

  return preferences;
}

const savePreferences = (newPreferences) => {
  preferences = { ...preferences, ...newPreferences };
  console.log('Sauvegarde des préférences dans :', preferencesFilePath);

  try {
    fs.writeFileSync(preferencesFilePath, JSON.stringify(preferences, null, 2));
    // console.log('Préférences sauvegardées avec succès.', preferences);
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des préférences :', error);
  }
}

module.exports = { loadPreferences, savePreferences, preferences };