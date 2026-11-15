/**
 * Accessible, high-contrast, large-font email templates for seniors and caretakers.
 */

function wrapHtml(title, contentHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 20px;
      line-height: 1.6;
      color: #000000;
      background-color: #ffffff;
      margin: 0;
      padding: 24px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      border: 3px solid #000000;
      padding: 24px;
      border-radius: 8px;
    }
    .header {
      font-size: 26px;
      font-weight: bold;
      border-bottom: 3px solid #000000;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .highlight-box {
      background-color: #f0f4f8;
      border-left: 6px solid #0284c7;
      padding: 16px;
      margin: 20px 0;
      font-size: 22px;
    }
    .urgent-box {
      background-color: #fef2f2;
      border-left: 6px solid #b91c1c;
      padding: 16px;
      margin: 20px 0;
      font-size: 22px;
      font-weight: bold;
    }
    .footer {
      margin-top: 28px;
      padding-top: 14px;
      border-top: 1px solid #777777;
      font-size: 16px;
      color: #333333;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">CareCircle Healthcare Alert</div>
    ${contentHtml}
    <div class="footer">
      This is an automated notification from CareCircle. Putting the elderly person at the center of decisions.
    </div>
  </div>
</body>
</html>`;
}

/**
 * 1. Upcoming Dose Reminder (15 minutes before)
 */
function upcomingDoseTemplate({ elderName, medName, dosage, scheduledTime, instructions }) {
  const subject = `[CareCircle] ⏰ Upcoming Medicine: ${medName} at ${scheduledTime}`;
  const text = `Hello ${elderName},\n\nThis is your reminder to take your medication in 15 minutes:\n\nMedication: ${medName} (${dosage})\nScheduled Time: ${scheduledTime}\nInstructions: ${instructions}\n\nPlease take it on time and remember to stay hydrated.\n\n- CareCircle`;

  const html = wrapHtml(subject, `
    <p>Hello <strong>${elderName}</strong>,</p>
    <p>This is a friendly reminder that your medicine is scheduled in <strong>15 minutes</strong>:</p>
    <div class="highlight-box">
      <strong>${medName}</strong> (${dosage})<br>
      ⏰ Scheduled for: <strong>${scheduledTime}</strong><br>
      💡 Instructions: ${instructions}
    </div>
    <p>Please take your dose with water and mark it in your CareCircle dashboard once taken.</p>
  `);

  return { subject, html, text };
}

/**
 * 2. Missed Dose Reminder (30 minutes after schedule)
 */
function missedDoseTemplate({ elderName, medName, dosage, scheduledTime }) {
  const subject = `[CareCircle] ⚠️ Missed Medicine: ${medName} was due at ${scheduledTime}`;
  const text = `Hello ${elderName},\n\nOur system noticed that you haven't marked your scheduled medicine yet:\n\nMedication: ${medName} (${dosage})\nScheduled Time: ${scheduledTime}\n\nIf you have already taken it, please mark it as taken in CareCircle. If you need help, please reach out to your caretaker.\n\n- CareCircle`;

  const html = wrapHtml(subject, `
    <p>Hello <strong>${elderName}</strong>,</p>
    <div class="urgent-box">
      ⚠️ Dose Missed: ${medName} (${dosage}) was due at ${scheduledTime}.
    </div>
    <p>If you have already taken this medication, please mark it as taken on your dashboard so your care team is updated.</p>
    <p>If you felt unwell or skipped it, your caretakers will be notified shortly to ensure you are safe.</p>
  `);

  return { subject, html, text };
}

/**
 * 3. Escalation Alert to Caretakers/Family (60 minutes after schedule)
 */
function escalationAlertTemplate({ memberName, elderName, medName, dosage, scheduledTime }) {
  const subject = `[CareCircle Urgent] Alert: ${elderName} missed their ${scheduledTime} ${medName}`;
  const text = `Dear ${memberName},\n\nURGENT: ${elderName} has not taken their scheduled ${scheduledTime} ${medName} (${dosage}) and 60 minutes have elapsed.\n\nPlease check in on them to ensure they are safe.\n\n- CareCircle`;

  const html = wrapHtml(subject, `
    <p>Dear <strong>${memberName}</strong>,</p>
    <div class="urgent-box">
      🚨 ESCALATION: ${elderName} missed their ${scheduledTime} dose of ${medName} (${dosage}).
    </div>
    <p>Over 60 minutes have elapsed since the scheduled time, and the dose remains unmarked.</p>
    <p><strong>Action Recommended:</strong> Please contact or visit ${elderName} to verify their well-being.</p>
  `);

  return { subject, html, text };
}

/**
 * 4. Doctor Appointment Reminder (24h or 2h before)
 */
function appointmentReminderTemplate({ memberName, elderName, doctorName, specialty, location, formattedDateTime, hoursBefore }) {
  const timeDesc = hoursBefore === 2 ? 'in 2 Hours' : 'Tomorrow';
  const subject = `[CareCircle] 🩺 Doctor Appointment ${timeDesc}: Dr. ${doctorName}`;
  const text = `Hello ${memberName},\n\nReminder: ${elderName} has an upcoming doctor appointment ${timeDesc}:\n\nDoctor: Dr. ${doctorName} (${specialty})\nDate & Time: ${formattedDateTime}\nLocation: ${location}\n\n- CareCircle`;

  const html = wrapHtml(subject, `
    <p>Hello <strong>${memberName}</strong>,</p>
    <p>Reminder: <strong>${elderName}</strong> has a doctor appointment <strong>${timeDesc}</strong>:</p>
    <div class="highlight-box">
      👨‍⚕️ <strong>Dr. ${doctorName}</strong> (${specialty})<br>
      📅 <strong>${formattedDateTime}</strong><br>
      📍 Location: <strong>${location}</strong>
    </div>
    <p>Please make sure any previous medical reports and current medication lists are prepared.</p>
  `);

  return { subject, html, text };
}

/**
 * 5. Refill Threshold Alert
 */
function refillAlertTemplate({ memberName, elderName, medName, stockCount, refillThreshold }) {
  const subject = `[CareCircle] 💊 Low Stock Warning: ${medName} needs a refill`;
  const text = `Hello ${memberName},\n\nMedication stock alert for ${elderName}:\n\n${medName} only has ${stockCount} dose(s) remaining (Refill threshold: ${refillThreshold}).\n\nPlease refill the prescription soon.\n\n- CareCircle`;

  const html = wrapHtml(subject, `
    <p>Hello <strong>${memberName}</strong>,</p>
    <div class="urgent-box" style="border-left-color: #b45309; background-color: #fefce8;">
      💊 Low Stock Alert for ${elderName}: <strong>${medName}</strong> has only <strong>${stockCount}</strong> dose(s) left.
    </div>
    <p>The stock has fallen to or below the refill threshold of <strong>${refillThreshold}</strong>.</p>
    <p>Please contact the pharmacy or doctor to arrange a refill.</p>
  `);

  return { subject, html, text };
}

/**
 * 6. Weekly Care Digest
 */
function weeklyDigestTemplate({ memberName, elderName, periodStr, totalDoses, takenDoses, missedDoses, adherenceRate, streakDays, upcomingAppts, aiInsight }) {
  const subject = `[CareCircle] 📊 Weekly Care Digest for ${elderName} (${adherenceRate}% Adherence)`;
  const insightText = aiInsight ? `\n\nAI Routine Insight: "${aiInsight}"` : '';
  const text = `Dear ${memberName},\n\nHere is the Weekly Care Digest for ${elderName} (${periodStr}):\n\nAdherence Rate: ${adherenceRate}%\nTotal Doses: ${totalDoses}\nDoses Taken: ${takenDoses}\nDoses Missed: ${missedDoses}\nActive Streak: ${streakDays} days${insightText}\nUpcoming Appointments: ${upcomingAppts.length}\n\nKeep up the great collaborative care!\n\n- CareCircle`;

  const apptListHtml = upcomingAppts.length > 0
    ? upcomingAppts.map((a) => `<li><strong>Dr. ${a.doctorName}</strong> (${a.specialty}) on ${a.dateTime}</li>`).join('')
    : '<li>No appointments scheduled for next week.</li>';

  const insightHtml = aiInsight
    ? `<div class="highlight-box" style="border-left-color: #0284c7; background-color: #f0f9ff; margin-top: 14px;">
        🤖 <strong>CareCircle AI Adherence Insight:</strong><br>
        <em>"${aiInsight}"</em>
       </div>`
    : '';

  const html = wrapHtml(subject, `
    <p>Dear <strong>${memberName}</strong>,</p>
    <p>Here is your weekly summary of <strong>${elderName}</strong>'s health routine (${periodStr}):</p>
    <div class="highlight-box">
      📈 <strong>Adherence Rate:</strong> ${adherenceRate}%<br>
      ✅ <strong>Doses Taken:</strong> ${takenDoses} of ${totalDoses}<br>
      ⚠️ <strong>Doses Missed:</strong> ${missedDoses}<br>
      🔥 <strong>Consistency Streak:</strong> ${streakDays} days
    </div>
    ${insightHtml}
    <h3>Upcoming Appointments Next Week:</h3>
    <ul>${apptListHtml}</ul>
    <p>Thank you for keeping ${elderName} supported and healthy!</p>
  `);

  return { subject, html, text };
}

/**
 * 7. Test Reminder Template
 */
function testReminderTemplate({ elderName }) {
  const subject = `[CareCircle] 🔔 Test Notification for ${elderName}`;
  const text = `Hello ${elderName},\n\nThis is a test notification from your CareCircle platform to confirm that your proactive email delivery is working properly.\n\nAll systems operational!\n\n- CareCircle`;
  const html = wrapHtml(subject, `
    <p>Hello <strong>${elderName}</strong>,</p>
    <div class="highlight-box" style="border-left-color: #15803d; background-color: #f0fdf4;">
      ✅ Test Notification Successful!
    </div>
    <p>This confirms that email reminders for medication schedules, doctor appointments, and refill alerts are properly connected.</p>
  `);
  return { subject, html, text };
}

module.exports = {
  upcomingDoseTemplate,
  missedDoseTemplate,
  escalationAlertTemplate,
  appointmentReminderTemplate,
  refillAlertTemplate,
  weeklyDigestTemplate,
  testReminderTemplate
};
