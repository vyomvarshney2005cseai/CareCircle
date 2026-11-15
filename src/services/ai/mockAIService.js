const AIServiceInterface = require('./aiServiceInterface');
const {
  prescriptionScanResultSchema,
  assistantIntentSchema,
  safetyCheckResultSchema,
  adherenceInsightSchema
} = require('../../utils/aiSchemas');

/**
 * Deterministic mock implementation of Gemini AI services for zero-cost, reliable tests and local dev.
 */
class MockAIService extends AIServiceInterface {
  async scanPrescription({ buffer: _buffer, mimeType: _mimeType }) {
    // Return deterministic parsed prescription draft
    const rawResult = {
      medicines: [
        {
          name: 'Amoxicillin',
          dosage: '500mg',
          form: 'capsule',
          frequency: 'Three times daily',
          suggestedTimes: ['08:00', '14:00', '20:00'],
          instructions: 'Take with food and finish the full antibiotic course'
        },
        {
          name: 'Paracetamol',
          dosage: '650mg',
          form: 'tablet',
          frequency: 'As needed for fever/pain',
          suggestedTimes: ['12:00'],
          instructions: 'Take after meals if experiencing fever or joint discomfort'
        }
      ],
      notes: 'Prescription scanned by Gemini Vision (Mock mode)'
    };

    return prescriptionScanResultSchema.parse(rawResult);
  }

  async parseAssistantIntent(message, _context = {}) {
    const text = (message || '').toLowerCase();

    let raw;
    if (text.includes('took') || text.includes('taken') || text.includes('drank')) {
      raw = {
        action: 'mark_taken',
        reply: 'I found your scheduled dose. Would you like me to mark it as taken?',
        params: {
          medicationName: text.includes('blood pressure') ? 'blood pressure' : 'Metformin',
          time: '08:00'
        }
      };
    } else if (text.includes('due') || text.includes('today') || text.includes('schedule') || text.includes('what')) {
      raw = {
        action: 'query_today',
        reply: 'Here are your scheduled medications for today.',
        params: {}
      };
    } else if (text.includes('appointment') || text.includes('doctor') || text.includes('dr')) {
      raw = {
        action: 'add_appointment',
        reply: 'Shall I book this appointment for you?',
        params: {
          doctorName: 'Dr. Sharma',
          specialty: 'General Physician',
          location: 'City Care Hospital',
          dateTime: '2026-11-17T17:00:00.000Z',
          notes: 'Follow-up consultation'
        }
      };
    } else if (text.includes('week') || text.includes('adherence') || text.includes('progress') || text.includes('how was')) {
      raw = {
        action: 'query_adherence',
        reply: 'Here is your adherence summary for the past week.',
        params: {}
      };
    } else {
      raw = {
        action: 'unknown',
        reply: "I am your CareCircle assistant. You can ask me what is due today, to mark a dose as taken, or to book a doctor appointment.",
        params: {}
      };
    }

    return assistantIntentSchema.parse(raw);
  }

  async checkInteractions(medications) {
    const names = (medications || []).map((m) => (m.name || '').toLowerCase());
    const hasAspirin = names.some((n) => n.includes('aspirin'));
    const hasIbuprofen = names.some((n) => n.includes('ibuprofen') || n.includes('advil'));
    const hasBloodThinner = names.some((n) => n.includes('warfarin') || n.includes('eliquis') || n.includes('clopidogrel'));

    let raw;
    if ((hasAspirin && hasIbuprofen) || (hasBloodThinner && hasIbuprofen)) {
      raw = {
        severity: 'moderate',
        summary: 'Potential drug-drug interaction identified between blood thinner/antiplatelet and NSAID.',
        findings: [
          {
            medications: ['Aspirin', 'Ibuprofen'],
            type: 'interaction',
            severity: 'moderate',
            description: 'Concurrent use of Aspirin with Ibuprofen increases gastrointestinal bleeding risks and may reduce Aspirins cardioprotective efficacy.',
            recommendation: 'Consult your doctor before taking Ibuprofen alongside Aspirin. Acetaminophen (Paracetamol) may be preferred for pain.'
          }
        ],
        disclaimer: 'This safety check is AI-generated for informational awareness and is not a substitute for professional medical advice. Always consult your doctor or certified pharmacist before modifying your medication regimen.'
      };
    } else {
      raw = {
        severity: 'none',
        summary: 'No significant drug-drug interactions or duplicate therapies detected among the active medications.',
        findings: [],
        disclaimer: 'This safety check is AI-generated for informational awareness and is not a substitute for professional medical advice. Always consult your doctor or certified pharmacist before modifying your medication regimen.'
      };
    }

    return safetyCheckResultSchema.parse(raw);
  }

  async generateAdherenceInsight(_doseLogs, _medications) {
    const raw = {
      insight: 'Morning medication routine is strong when taken with breakfast. Evening doses on weekends show a slight delay — consider setting a gentle 7:30 PM reminder before dinner.',
      positiveNote: 'Your morning adherence streak is consistent!',
      recommendation: 'Anchor evening medications to an existing evening habit like dinner or tea.'
    };
    return adherenceInsightSchema.parse(raw);
  }
}

module.exports = MockAIService;
