/**
 * Speech Synthesis helper for Senior Accessibility.
 * Uses Web Speech API to read aloud medication schedules and instructions.
 */
const speech = {
  isSupported() {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  },

  /**
   * Speak a given text string.
   * @param {string} text
   */
  speak(text) {
    if (!this.isSupported()) {
      // eslint-disable-next-line no-alert
      alert('Speech synthesis is not supported on this browser.');
      return;
    }

    window.speechSynthesis.cancel(); // Stop any ongoing speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower, easy to understand for elderly
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    window.speechSynthesis.speak(utterance);
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
  }
};
