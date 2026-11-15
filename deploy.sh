#!/usr/bin/env bash
# ==============================================================================
# CareCircle - Google Cloud Run & Cloud Scheduler Deployment Script
# ==============================================================================

set -euo pipefail

export PATH="$PATH:/Users/vyomvarshney2005/google-cloud-sdk/bin"

SERVICE_NAME="carecircle"
REGION="${GCP_REGION:-asia-south1}"
PROJECT_ID="${GCP_PROJECT_ID:-project-c03ff828-a1f6-40d1-a87}"
TASK_TOKEN="${TASK_TOKEN:?Set TASK_TOKEN (e.g. export TASK_TOKEN=$(openssl rand -hex 24)) before deploying}"

echo "=========================================================="
echo " Deploying CareCircle to Google Cloud Run ($REGION)"
echo " Project: $PROJECT_ID | Service: $SERVICE_NAME"
echo "=========================================================="

# 1. Deploy container to Google Cloud Run
echo "==> Building and deploying Cloud Run service..."
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,DATA_STORE=memory,TASK_TOKEN=${TASK_TOKEN},GEMINI_MODEL=gemini-2.5-flash"

# Retrieve public Cloud Run service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format="value(status.url)")
echo "==> Deployed successfully: $SERVICE_URL"

# 2. Configure Cloud Scheduler cron jobs
echo "==> Configuring Cloud Scheduler proactive jobs..."

# Proactive Schedule Reminders (Every 5 minutes)
gcloud scheduler jobs create http carecircle-reminders \
  --project "$PROJECT_ID" \
  --location "$REGION" \
  --schedule "*/5 * * * *" \
  --time-zone "Asia/Kolkata" \
  --uri "${SERVICE_URL}/tasks/run-reminders" \
  --http-method POST \
  --headers "X-Task-Token=${TASK_TOKEN}" \
  --description "CareCircle proactive 5-minute reminder & escalation engine" \
  --attempt-deadline 180s 2>/dev/null || \
gcloud scheduler jobs update http carecircle-reminders \
  --project "$PROJECT_ID" \
  --location "$REGION" \
  --schedule "*/5 * * * *" \
  --time-zone "Asia/Kolkata" \
  --uri "${SERVICE_URL}/tasks/run-reminders" \
  --http-method POST \
  --headers "X-Task-Token=${TASK_TOKEN}" 2>/dev/null || true

# Weekly Adherence Digest (Every Monday at 9:00 AM)
gcloud scheduler jobs create http carecircle-weekly-digest \
  --project "$PROJECT_ID" \
  --location "$REGION" \
  --schedule "0 9 * * 1" \
  --time-zone "Asia/Kolkata" \
  --uri "${SERVICE_URL}/tasks/weekly-digest" \
  --http-method POST \
  --headers "X-Task-Token=${TASK_TOKEN}" \
  --description "CareCircle weekly adherence care digest for families" \
  --attempt-deadline 180s 2>/dev/null || \
gcloud scheduler jobs update http carecircle-weekly-digest \
  --project "$PROJECT_ID" \
  --location "$REGION" \
  --schedule "0 9 * * 1" \
  --time-zone "Asia/Kolkata" \
  --uri "${SERVICE_URL}/tasks/weekly-digest" \
  --http-method POST \
  --headers "X-Task-Token=${TASK_TOKEN}" 2>/dev/null || true

echo "=========================================================="
echo " CareCircle deployment complete!"
echo " Live URL: $SERVICE_URL"
echo " Health check: ${SERVICE_URL}/healthz"
echo "=========================================================="
