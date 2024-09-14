// state.js
let isReading = false;
let displayTrad = false;

module.exports = {
  setIsReading: (value) => {
    isReading = value;
  },
  getIsReading: () => (isReading),

  setDisplayTrad: (value) => {
    displayTrad = value;
  },
  getDisplayTrad: () => displayTrad,
};