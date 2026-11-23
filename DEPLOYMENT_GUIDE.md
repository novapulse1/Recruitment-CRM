# NovaPulse Hiring CRM — Production Deployment Guide

This guide walks you through connecting your **Google Sheet** to the **NovaPulse CRM Frontend** in under 5 minutes.

---

## What Has Already Been Completed Automatically

1. **Google Sheets `CONFIGURATION` Tab**:
   The required RBAC keys have already been written and verified in both your Dev Copy and Production Google Sheets:
   - `SUPER_ADMIN_EMAILS`: `novapulse739@gmail.com`
   - `MANAGEMENT_EMAILS`: `admin@novapulse.co.in`
   - `RECRUITMENT_MANAGER_EMAILS`: `manager@novapulse.co.in`
   - `FINANCE_EMAILS`: `finance@novapulse.co.in, accounts@novapulse.co.in`
   - `MANAGER_TEAM_MAPPING`: `{"manager@novapulse.co.in":["hr@novapulse.co.in","gjigyasa11@gmail.com"]}`
   - `RBAC_ENABLED`: `TRUE`

2. **All-In-One Apps Script Bundle Created**:
   - Location: `apps-script/NovaPulse_Complete_Backend.gs` (109 KB)
   - Contains all 14 service modules (Permission Engine, Data Scoping, Optimistic Locking, Duplicate Protection, Pipeline Calculation, and Web App Endpoints) combined into a single file for copy-paste deployment.

3. **Frontend Production Build**:
   - Compiled with `tsc && vite build` (zero errors).
   - Configured with `vercel.json` for single-page application routing.

---

## Step 1: Deploy Google Apps Script Web App (3 Minutes)

1. Open your Google Sheet in your web browser:
   * **Production Sheet**: [NOVAPULSE – CENTRAL RECRUITMENT DATABASE](https://docs.google.com/spreadsheets/d/11j17e5RTG0uLTXg41f_AfKMqAUtGCDXV2DusZ8Muq58/edit)
   * *(Or test first on your safe Dev Copy)*: [NOVAPULSE - CENTRAL RECRUITMENT DATABASE (DEV COPY)](https://docs.google.com/spreadsheets/d/162bNBPeryLIJ-M6yBt8uSK3YbKc8tN3qP1DkF4PwAd0/edit)

2. In the Google Sheets top menu, click **Extensions → Apps Script**.

3. In the script editor:
   - If an existing `Code.gs` is open, select all text (`Ctrl + A`) and delete it.
   - Open `apps-script/NovaPulse_Complete_Backend.gs` from this project, copy all its contents, and paste them into the editor.
   - Click the **Save** icon (disk icon or `Ctrl + S`).

4. Deploy the Web App:
   - Click the blue **Deploy** button at top-right → select **New deployment**.
   - Click the gear icon next to "Select type" and choose **Web app**.
   - Fill in:
     - **Description**: `NovaPulse CRM API v1.0`
     - **Execute as**: `Me (your google account)`
     - **Who has access**: `Anyone with Google account` (or `Anyone` if accessing via anonymous Webhooks)
   - Click **Deploy**.
   - Review and grant authorizations if prompted by Google.
   - **Copy the Web App URL** (format: `https://script.google.com/macros/s/AKfycb.../exec`).

---

## Step 2: Connect the Web App URL to the CRM (1 Minute)

You can connect the CRM in either of two ways:

### Option A: From Inside the App (Instant)
1. Open the CRM running at `http://127.0.0.1:5173/`.
2. In the left sidebar, click **Admin & System** (or click the Database icon at the bottom of the sidebar).
3. Under **Google Apps Script API Endpoint**, paste your Web App URL.
4. Click **Test & Save Connection**. The CRM will immediately switch from local mock data to live Google Sheet sync!

### Option B: In the Environment File
1. Open `frontend/.env`:
   ```env
   VITE_API_BASE_URL=https://script.google.com/macros/s/AKfycb.../exec
   ```
2. Restart or rebuild the frontend.

---

## Step 3: Deploy the Frontend to Hosting (Optional - 3 Minutes)

### Option 1: Vercel (Recommended)
```bash
cd "c:\Users\Admin\Desktop\Recuitment CRM\frontend"
npx vercel
```
Follow the 3 prompts (Link to existing project? `No`, Project name: `novapulse-crm`, Directory: `./`).

### Option 2: Netlify
Drag and drop the `frontend/dist` folder directly onto the [Netlify Drop](https://app.netlify.com/drop) page.

### Option 3: Firebase Hosting
```bash
cd "c:\Users\Admin\Desktop\Recuitment CRM\frontend"
npx firebase init hosting
npx firebase deploy
```
*(Public directory: `dist`)*

---

## Verification Checklist

- [x] All 5 roles tested (`SUPER_ADMIN`, `ADMIN`, `RECRUITMENT_MANAGER`, `HR_RECRUITER`, `FINANCE`)
- [x] Duplicate candidate override locked to Super Admin
- [x] Lead approval and rejection locked to Super Admin & Admin
- [x] Manager candidates scoped to team members (`Anshu` and `Jigyasha`)
- [x] HR Recruiter candidates scoped to personal email
- [x] Finance role candidate PII masked and candidate master blocked
- [x] Route guard displays 403 Access Denied on unauthorized navigation
- [x] Real-time Google Sheet CONFIGURATION synced and verified
