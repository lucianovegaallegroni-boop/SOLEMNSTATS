# SolemnStats

SolemnStats is a full-stack web application. It features a backend API built with Express and TypeScript, alongside a modern frontend built with React, Vite, and Tailwind CSS. The project uses Supabase for a seamless database and authentication solution.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Recharts
- **Backend/API**: Node.js, Express, TypeScript (`tsx`)
- **Database & Auth**: Supabase

## Project Structure

- `/frontend`: Contains the React/Vite web application.
- `/api`: Contains the backend API services and related logic.
- `package.json`: Main project configuration containing workspaces/scripts to run both backend and frontend concurrently.

## Getting Started

First, ensure you have all dependencies installed for the root and frontend:
```bash
npm install
# The start script may also install frontend dependencies automatically
```

To run the project locally, ensure your Supabase environment variables are properly configured in your `.env` file, and then run:

```bash
npm run dev
```

This will concurrently start the backend (`npm run api`) and the frontend (`npm run dev --prefix frontend`).

## Test Credentials

For testing purposes, you can log into the application using the following test user credentials:

- **Email:** `test@solemnstats.com`
- **Password:** `TestPassword123!`

---
*Note: You can use scripts like `create_test_user.ts` to programmatically provision other test users against your Supabase instance.*
