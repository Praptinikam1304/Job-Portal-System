# Northstar Job Portal

A MERN job portal with candidate, employer, and admin workspaces. The client can be explored in demo mode without a database; accounts and persisted workflows use the Express API and MongoDB.

## Start locally

Requirements: Node.js 20.19+ and either a local MongoDB server or a MongoDB Atlas connection string.

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set `MONGODB_URI` and a unique `JWT_SECRET`. On Windows PowerShell: `Copy-Item .env.example .env`.
3. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` to create an administrator on the first server start. Use a fresh email; existing accounts are not promoted.
4. Start the API and Vite client together: `npm run dev`
5. Open `http://localhost:5173`.

To explore the frontend without MongoDB, run `npm run client:dev`. Demo mode includes sample jobs, applications, and a role switcher. You can create a device-local demo profile or continue as a guest; demo changes are not synced to a server. Persisted accounts and PDF resume parsing need the API and MongoDB.

## Workspaces

- Candidates can browse and filter jobs, apply once per listing, track application status, upload PDF or text resumes, and rank active jobs by matching skills.
- Employers can create listings, review applicants, and update application stages. New listings require admin approval before they appear in public search.
- Admins can review and approve or reject pending listings.
- Passwords are hashed with bcrypt. Protected API endpoints use seven-day JWT bearer tokens.

Resume parsing extracts skills from PDF or plain text and stores up to 50 KB of extracted text. Matching is a transparent overlap score: shared listed job skills divided by all listed job skills. The parser recognizes a built-in set of common technical and workplace skills; it is not an AI or a substitute for reviewing the resume.

## LinkedIn import

LinkedIn import is optional. Create a LinkedIn Developer App and enable **Sign In with LinkedIn using OpenID Connect**. Set `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, and `LINKEDIN_REDIRECT_URI` in `.env`; register the exact redirect URI with LinkedIn. Local callback URL: `http://localhost:5000/api/auth/linkedin/callback`. The integration imports the member's name and verified email through LinkedIn's OpenID Connect userinfo endpoint. LinkedIn must approve the application and requested product/scopes.

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/profile`
- `GET /api/jobs`, `GET /api/jobs/matches`, `POST /api/jobs`
- `POST /api/profile/resume`, `POST /api/jobs/:jobId/applications`, `GET /api/applications`
- `PATCH /api/applications/:applicationId`, `GET /api/employer/jobs`
- `GET /api/admin/jobs`, `PATCH /api/admin/jobs/:jobId/moderate`
- `GET /api/health`

Run checks with `npm run build`, `npm run lint`, and `node --check server/index.js`.