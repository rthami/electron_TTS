const { exec, spawn } = require('child_process');
const path = require('path');
const { setIsReading, getIsReading } = require('./state');
const CHAR_LIMIT = 2000; // Réduit la limite de caractères pour pico2wave

// Fonction pour vérifier la disponibilité des programmes
const checkProgramAvailability = (program, callback) => {
    const command = process.platform === 'win32' ? `where ${program}` : `which ${program}`;
    exec(command, (error) => {
        callback(!error);
    });
}

// Fonction pour vérifier si la lecture peut se faire
const canRead = (event, currentLanguage, isPicoAvailable, isMplayerAvailable, mplayerProcess, getMessage) => {
    if (!isPicoAvailable) {
        event.reply('speak-error', getMessage('errorPicoAbsent', currentLanguage));
        return false;
    }

    if (!isMplayerAvailable) {
        event.reply('speak-error', getMessage('errorMplayerAbsent', currentLanguage));
        return false;
    }

    if (mplayerProcess) {
        event.reply('speak-error', getMessage('errorReadingInProgress', currentLanguage));
        return false;
    }

    return true;
}

const escapeSpecialChars = (text) => {
    return text.replace(/(["\\])/g, '\\$1'); // Échapper les guillemets et les barres obliques inverses
}

// Fonction pour diviser le texte en phrases
const splitTextIntoPhrases = (text) => {
    const sentenceRegex = /[^.!?\n]+(?:[.!?\n]|\n|$|\s+)/g;
    const phrases = text.match(sentenceRegex) || [text];

    // Nettoyer les phrases (supprimer les espaces en début et fin, et les sauts de ligne)
    return phrases.map(phrase => phrase.trim().replace(/\n/g, ' '));
}

// Fonction pour lire un chunk et lancer pico2wave
const readTextFile = async (event, picoCommand, currentLanguage, getMessage, mplayerCallback) => {
    return new Promise((resolve, reject) => {
        if (!getIsReading()) {
            return resolve();
        }

        exec(picoCommand, (error, stdout, stderr) => {
            if (!getIsReading()) {
                return resolve();
            }

            if (error || stderr) {
                const errMessage = error ? error.message : stderr;
                event.reply('speak-error', `Erreur: ${errMessage}`);
                return reject(errMessage);
            }

            const outputWavPath = path.join(__dirname, 'output.wav');
            const mplayerProcess = spawn('mplayer', ['-nolirc', '-quiet', outputWavPath], { stdio: ['pipe', 'ignore', 'ignore'] });

            mplayerCallback(mplayerProcess);

            mplayerProcess.on('exit', () => {
                if (getIsReading()) {
                    event.reply('speak-success', getMessage('readingFinished', currentLanguage));
                }
                mplayerCallback(null);
                resolve();
            });

            event.reply('speak-success', getMessage('readingInProgress', currentLanguage));
        });
    });
}

const readChunksSequentially = async (event, chunks, lang, currentLanguage, getMessage, mplayerProcess, sendToRenderer) => {
    console.log('Début de la lecture des morceaux de texte séquentiellement');
    setIsReading(true);

    for (let i = 0; i < chunks.length; i++) {
        if (!getIsReading()) {
            console.log('Lecture interrompue');
            break;
        }

        console.log(`Lecture du morceau de texte n°${i + 1} sur ${chunks.length}`);
        const escapedText = escapeSpecialChars(chunks[i]);
        const picoCommand = `pico2wave -l "${lang}" -w ${path.join(__dirname, 'output.wav')} "${escapedText}"`;

        try {
            // Informer le processus principal du statut de chaque chunk
            sendToRenderer('speak-progress', chunks[i]);

            // Lire le chunk
            await readTextFile(event, picoCommand, currentLanguage, getMessage, mplayerProcess);
        } catch (err) {
            console.error('Erreur lors de la lecture du texte', err);
            sendToRenderer('speak-error', `Erreur lors de la lecture du chunk : ${err}`);
            break;
        }
    }

    setIsReading(false);
    sendToRenderer('speak-complete', 'Lecture terminée');
}

// Vérifie si le conteneur Docker LibreTranslate existe et est en cours d'exécution
const checkAndStartLibreTranslate = () => {
    exec('docker inspect --format="{{.State.Running}}" libretranslate', (error, stdout, stderr) => {
        if (error) {
            console.error('Erreur lors de la vérification du conteneur LibreTranslate :', stderr);
            return;
        }

        const isRunning = stdout.trim() === 'true';
        if (isRunning) {
            console.log('LibreTranslate est déjà en cours d\'exécution.');
        } else {
            console.log('LibreTranslate ne fonctionne pas ou n\'existe pas, tentative de démarrage...');
            exec('docker start libretranslate', (err, stdout, stderr) => {
                if (err) {
                    console.error('Erreur lors du démarrage de LibreTranslate :', stderr);
                } else {
                    console.log('LibreTranslate démarré avec succès.');
                }
            });
        }
    });
}

// Vérifie la disponibilité de LibreTranslate en faisant une requête HTTP
const verifyLibreTranslate = () => {
    exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:5000', (error, stdout, stderr) => {
        if (error) {
            console.error('Erreur lors de la vérification de LibreTranslate :', stderr);
            checkAndStartLibreTranslate();
        } else if (stdout.trim() === '200') {
            console.log('LibreTranslate est accessible.');
        } else {
            console.log('LibreTranslate n\'est pas accessible, tentative de démarrage...');
            checkAndStartLibreTranslate();
        }
    });
}

// Fonction pour démarrer LibreTranslate si nécessaire
const startLibreTranslate = () => {
    exec('curl -I http://localhost:5000', (error, stdout, stderr) => {
        if (error) {
            console.log('LibreTranslate ne semble pas démarré ou une erreur réseau est survenue, tentative de démarrage...');

            // Démarre LibreTranslate
            exec('docker start libretranslate', (err, stdout, stderr) => {
                if (err) {
                    console.error('Erreur lors du démarrage de LibreTranslate :', err);
                } else {
                    console.log('LibreTranslate démarré avec succès.');
                }
            });
        } else {
            console.log('LibreTranslate déjà démarré.');
        }
    });
}

module.exports = {
    checkProgramAvailability,
    canRead,
    readChunksSequentially,
    CHAR_LIMIT,
    escapeSpecialChars,
    splitTextIntoPhrases,
    verifyLibreTranslate,
    startLibreTranslate
};
