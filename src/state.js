// state.js
let isReading = false;

module.exports = {
  setIsReading: (value) => {
    isReading = value;
  },
  getIsReading: () => isReading
};