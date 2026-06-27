# Nyota GCP Deployment Guide

This app is a single containerized service: Vite builds the React UI into `dist/`, and `server.js` serves both the API and the static frontend. The fastest GCP target is Cloud Run.

## Architecture

- Cloud Run: hosts the Nyota web app and API container.
- Artifact Registry: stores the Docker image.
- Secret Manager: stores `GEMINI_API_KEY` and `JWT_SECRET`.
- Cloud SQL for PostgreSQL: recommended production database for users, trials, billing state, audit logs, and tenant data.

Important: the current app still stores users in `data/nyota.db` with SQLite. That is acceptable for local development and demos, but Cloud Run filesystems are ephemeral. Before real customer trials, migrate `db.js` to Cloud SQL PostgreSQL or another durable database.

## One-Time GCP Setup

Replace the variables first:

```powershell
$PROJECT_ID = "nyota-prod"
$REGION = "us-central1"
$SERVICE = "nyota-app"
$REPO = "nyota"
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$SERVICE:latest"
```

Create or select the project:

```powershell
gcloud auth login
gcloud projects create $PROJECT_ID
gcloud config set project $PROJECT_ID
gcloud billing projects link $PROJECT_ID --billing-account YOUR_BILLING_ACCOUNT_ID
```

Enable required APIs:

```powershell
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com sqladmin.googleapis.com
```

Create Artifact Registry:

```powershell
gcloud artifacts repositories create $REPO --repository-format=docker --location=$REGION --description="Nyota containers"
gcloud auth configure-docker "$REGION-docker.pkg.dev"
```

## Secrets

Create secrets:

```powershell
printf "YOUR_GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY --data-file=-
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" | gcloud secrets create JWT_SECRET --data-file=-
```

Grant Cloud Run access to secrets:

```powershell
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
$SERVICE_ACCOUNT = "$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding GEMINI_API_KEY --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding JWT_SECRET --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
```

## Build And Deploy

Build and push the image:

```powershell
docker build -t $IMAGE .
docker push $IMAGE
```

Deploy to Cloud Run:

```powershell
gcloud run deploy $SERVICE `
  --image $IMAGE `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --port 3009 `
  --memory 2Gi `
  --cpu 2 `
  --set-env-vars NODE_ENV=production,TRIAL_DAYS=30 `
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest
```

Check health:

```powershell
$URL = gcloud run services describe $SERVICE --region $REGION --format="value(status.url)"
Invoke-RestMethod "$URL/api/health"
```

## 30-Day Trial Behavior

This repo now supports public trial signup:

- `POST /api/auth/register` creates a user with `subscription_status = trialing`.
- The trial starts immediately and ends after `TRIAL_DAYS`, defaulting to 30.
- Login and `/api/auth/me` return HTTP `402` when the trial is expired, canceled, or manually marked expired.
- Admins can see trial status in User Management and can switch users to `active`.

For a paid production launch, connect this to Stripe, Google Cloud Marketplace, or your sales-led provisioning process. The activation step should update `subscription_status` to `active` in the durable production database.

## Production Database Migration

Before inviting real users:

1. Create a Cloud SQL PostgreSQL instance.
2. Replace `better-sqlite3` usage in `db.js` with PostgreSQL queries.
3. Store connection details in Secret Manager.
4. Attach Cloud SQL to Cloud Run with `--add-cloudsql-instances`.
5. Add migrations for `users`, `organizations`, `subscriptions`, and audit tables.

Suggested initial subscription columns:

```sql
subscription_status text not null default 'trialing',
trial_started_at timestamptz,
trial_ends_at timestamptz,
subscription_started_at timestamptz,
subscription_ends_at timestamptz,
stripe_customer_id text,
stripe_subscription_id text
```

## Domain And HTTPS

After Cloud Run is deployed:

```powershell
gcloud beta run domain-mappings create --service $SERVICE --domain app.yourdomain.com --region $REGION
```

Then add the DNS records that Google Cloud shows for the domain mapping.

## Operational Notes

- Keep `JWT_SECRET` stable across revisions or users will be signed out.
- Use Cloud Logging for backend errors and Cloud Run revisions.
- Avoid committing `.env.local`, `data/nyota.db`, or customer uploads.
- Set max instances deliberately until the database layer is production-ready.
