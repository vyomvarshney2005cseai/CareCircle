/**
 * Speech Synthesis helper for Senior Accessibility.
 * Uses Web Speech API to read aloud medication schedules and instructions.
 */
const speech = {
  isSynthesisSupported() {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  },

  isRecognitionSupported() {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  },

  isSupported() {
    return this.isSynthesisSupported();
  },

  /**
   * Speak a given text string with graceful degradation.
   * @param {string} text
   */
  speak(text) {
    if (!this.isSynthesisSupported()) {
      if (typeof ui !== 'undefined' && ui.showAlert) {
        ui.showAlert('Audio readout is not supported by your browser.', 'info');
      }
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stop any ongoing speech

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.88; // Slightly deliberate cadence for seniors
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
    }
  },

  /**
   * Stop speaking.
   */
  stop() {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
  },

  /**
   * Read aloud today's doses list.
   * @param {string} elderName
   * @param {Array<object>} doses
   */
  readSchedule(elderName, doses) {
    if (!doses || doses.length === 0) {
      this.speak(`Hello ${elderName}. You have no medications scheduled for today. Have a wonderful day.`);
      return;
    }

    const pendingDoses = doses.filter((d) => d.status === 'pending');
    let message = `Hello ${elderName}. You have ${doses.length} scheduled doses today, with ${pendingDoses.length} remaining to take. `;

    doses.forEach((d, idx) => {
      const statusText = d.status === 'taken' ? 'already taken' : 'scheduled';
      message += `Dose ${idx + 1} at ${d.scheduledTime}: ${d.medicationName}, ${d.dosage}. ${d.instructions}. Status is ${statusText}. `;
    });

    message += 'Remember to stay hydrated and take your medicine on time.';
    this.speak(message);
  },

  /**
   * Listen to user speech using Web Speech Recognition.
   * @param {function(string): void} onResult
   * @param {function(any): void} onError
   * @returns {any}
   */
  startListening(onResult, onError) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (onError) onError(new Error('Speech recognition is not supported in this browser.'));
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      if (onResult) onResult(text);
    };

    recognition.onerror = (err) => {
      if (onError) onError(err);
    };

    recognition.start();
    return recognition;
  }
};
