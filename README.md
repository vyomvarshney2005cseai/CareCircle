# CareCircle ⭕
> **Collaborative Elderly Care & Medication Management Platform**  
> *Smarter, accessible, reliable, collaborative — with the elderly person always at the center of decisions.*

Built for hackathon evaluation against strict rubrics: **Code Quality, Security, Efficiency, Testing, Accessibility, Problem-Statement Alignment, and Google Cloud Services Integration**.

---

## 🌟 Key Innovations & Problem Alignment

1. **Elder-Centred Decision Model**:
   - The elderly individual is the primary owner and authority of their CareCircle.
   - When **"Require Elder Approval for Edits"** is enabled, any medication or appointment change created or modified by a caretaker or family member is held in a pending state (`202 Accepted`).
   - The elder receives an actionable approval banner on their dashboard with full transparency to approve or reject proposed changes before anything changes in their actual schedule.
2. **Accessible Senior Design (WCAG AAA Inspired)**:
   - Built-in **Senior / High Contrast Mode** toggle: scales base typography to 20px+ and touch targets to $\ge 64$px.
   - **Giant "✓ I Took It" Dose Buttons** with high contrast and one-tap confirmation.
   - **Web Speech API Audio Assistant**: A dedicated *"🔊 Read Schedule Aloud"* button speaks today's medicine times and instructions clearly for seniors with visual impairments or tremors.
   - Low-stock visual warning badges alerting caretakers and elders when supplies drop below refill thresholds.
3. **Collaborative Access & Passcode System**:
   - Elders generate single-use, 8-character secure alphanumeric invite passcodes shown **only once** to share with caretakers or family members.
   - Passcodes are hashed with `bcryptjs`.
   - Granular role-based permissions (`canViewMeds`, `canEditMeds`, `canViewAppointments`, `canEditAppointments`, `canViewAdherence`, `receiveAlerts`).
   - 5-attempt brute-force protection with automatic 15-minute account lockout.
   - Comprehensive, tamper-evident **Activity Audit Log** tracking who performed or proposed every action.

---

## 🏗️ Architecture & Technology Stack

- **Runtime & Backend**: Node.js 20 + Express serving REST API under `/api` and static frontend under `/public` (zero build step, standard semantic HTML5/CSS3/ES6+).
- **Google Cloud Services**:
  - **Google Cloud Firestore (`@google-cloud/firestore`)**: Enterprise NoSQL subcollection data model (`profiles/{profileId}/members`, `medications`, `doseLogs`, `appointments`, `auditLog`, `pendingChanges`).
  - **Repository Layer Abstraction (`src/repositories`)**: Seamless dual-mode architecture:
    - `MemoryRepository`: In-memory implementation for instant local dev and zero-credential CI testing.
    - `FirestoreRepository`: Native Google Cloud Firestore implementation.
  - **Google Cloud Run Ready**: Containerized with `Dockerfile` using `node:20-slim`, non-root user (`USER node`), dynamic `PORT` binding, and health check.
- **Security & Quality**:
  - `zod` for request payload validation.
  - `bcryptjs` for passcode hashing.
  - `jsonwebtoken` signed sessions via `httpOnly`, `SameSite=Strict`, `Secure` cookies.
  - `helmet` (CSP configured), `cors`, `express-rate-limit` (global & auth limiters).
  - `pino` structured logging.
  - Consistent error handling returning `{ error: { code, message } }`.
  - Clean extension points: `src/services/notificationService.js` (idempotent notification keys) and `src/services/aiService.js` (Gemini API stubs).

---

## 📂 Project Structure

```
.
├── Dockerfile                  # Cloud Run deployment (node:20-slim, non-root user)
├── .env.example                # Documented configuration template
├── jest.config.js              # Test configuration
├── package.json
├── public/                     # Semantic, accessible frontend
│   ├── index.html              # Single page app shell
│   ├── css/styles.css          # Senior mode & responsive healthcare styling
│   └── js/
│       ├── api.js              # Fetch client with credentials
│       ├── auth.js             # Session state & auth flows
│       ├── speech.js           # Web Speech API assistant
│       ├── ui.js               # Senior mode & modal controller
│       └── app.js              # Dashboard, doses, meds, approvals, audit
├── src/
│   ├── app.js                  # Express application setup
│   ├── server.js               # Entry point listening on PORT
│   ├── config.js               # Environment config validated via Zod
│   ├── constants/              # Roles & permissions definitions
│   ├── errors/appError.js      # Structured AppError class
│   ├── middlewares/            # Auth, rate limiter, requirePermission, errorHandler
│   ├── repositories/           # Interface + Memory & Firestore implementations
│   ├── services/               # Auth, Schedule, Meds, Appts, Approval, Audit
│   └── utils/                  # Passcode, DateUtils, Logger, Validators
└── tests/
    ├── testHelper.js
    ├── unit/                   # Passcode, Validators, MemoryRepository
    └── integration/            # Auth, Permissions, Meds, Sched, Appts, Approval, E2E
```

---

## 🚀 Getting Started

### 1. Installation
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
By default, `DATA_STORE=memory` is set, allowing instant local testing without GCP credentials.

To use Google Cloud Firestore:
```env
DATA_STORE=firestore
GCP_PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```

### 3. Run Automated Tests
```bash
npm test
```
Runs 11 test suites (27 tests) verifying permissions, auth, lockout, schedule generation, stock decrementing, adherence calculation, and elder approval flows.

### 4. Start Local Server
```bash
npm start
```
Open **`http://localhost:8080`** in your browser.

---

## 🐳 Docker & Google Cloud Run Deployment

Build container image:
```bash
docker build -t carecircle:latest .
```

Run container locally:
```bash
docker run -p 8080:8080 -e PORT=8080 carecircle:latest
```

Deploy to Google Cloud Run:
```bash
gcloud run deploy carecircle \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATA_STORE=firestore,GCP_PROJECT_ID=your-project-id
```

---

## 📡 API Reference Overview

| Method | Endpoint | Description | Permission |
|---|---|---|---|
| `GET` | `/healthz` | Container healthcheck & runtime info | Public |
| `POST` | `/api/auth/register-elder` | Register elder profile & owner | Public (Rate-limited) |
| `POST` | `/api/auth/join` | Join with 8-char invite passcode | Public (Rate-limited) |
| `POST` | `/api/auth/login` | Login with profileId, email, passcode | Public (5-try lockout) |
| `POST` | `/api/auth/logout` | Clear session cookie | Authenticated |
| `GET` | `/api/auth/me` | Current session details | Authenticated |
| `GET` | `/api/profiles/:id/schedule/today` | Today's doses with statuses | `canViewMeds` |
| `POST` | `/api/profiles/:id/schedule/doses/:id/action` | Mark dose taken/skipped/snoozed | `canViewMeds` |
| `GET` | `/api/profiles/:id/schedule/adherence` | 7-day and 30-day adherence % | `canViewAdherence` |
| `GET/POST` | `/api/profiles/:id/medications` | List / Add medications | `canViewMeds` / `canEditMeds` |
| `GET/POST` | `/api/profiles/:id/appointments` | List / Book appointments | `canViewAppts` / `canEditAppts` |
| `GET/POST` | `/api/profiles/:id/members/invites` | List / Generate 8-char invite | Elder Only |
| `PUT` | `/api/profiles/:id/settings` | Toggle elder approval requirement | Elder Only |
| `GET/POST` | `/api/profiles/:id/pending-changes` | Review & approve/reject changes | Elder Only |
| `GET` | `/api/profiles/:id/audit` | Chronological activity audit trail | Authenticated |

---

## ♿ Accessibility Features

- **Large Click Target Sizes**: Main action buttons are $64\text{px}+$ in height with bold contrast.
- **WCAG High-Contrast Mode**: Dedicated switch switching to a high-contrast dark-on-light theme with $7:1+$ contrast ratio.
- **Audio Schedule Narration**: Native Web Speech API integration that articulates the daily schedule out loud.
- **Low-Stock Alerting**: Proactive visual and data-level indicators when stock drops below threshold.
