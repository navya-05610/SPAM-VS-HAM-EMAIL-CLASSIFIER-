# Spam vs Ham Email Classifier

A full-stack React + Express app that classifies email content as spam or ham, explains the decision with a lightweight Naive Bayes model, and enriches the result with Gemini-powered threat analysis.

## Features

- Real-time spam/ham analyzer with a classical Naive Bayes classifier
- Gemini 3.8 Flash semantic threat review for phishing and social-engineering signals
- Synthetic email generator for security testing and benchmark scenarios
- Rewrite flow for turning text into spammy or clean business-safe copy
- Vocabulary and explainability dashboards for model interpretability
- Benchmark library and evaluation thresholds for tuning and comparison

## Tech Stack

- React + Vite + TypeScript
- Express server for API routes and production static hosting
- Tailwind CSS for UI styling
- Google Gemini API for AI classification and generation

## Local Setup

Prerequisites:

- Node.js 18+
- A Google Gemini API key

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a local environment file and add your Gemini API key:
   ```bash
   copy NUL .env
   ```
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
3. Start the app locally:
   ```bash
   npm run dev
   ```
4. Open the app in a browser at:
   ```text
   http://localhost:3000
   ```

## Production Deployment

This project is configured for Render deployment via the included [render.yaml](render.yaml).

Required environment variable on the host:

- `GEMINI_API_KEY`

Build and start commands:

```bash
npm ci && npm run build
npm start
```

The server runs in production mode, serves the built frontend from the `dist` directory, and exposes the JSON API routes used by the app.

## Project Structure

- `src/` — frontend React application
- `src/lib/nlpClassifier.ts` — Naive Bayes email classification logic
- `server.ts` — Express server and Gemini API integrations
- `render.yaml` — Render deployment configuration
- `vite.config.ts` — Vite build configuration

## Notes

- The app expects `GEMINI_API_KEY` in the runtime environment for AI-backed classification and rewriting.
- The frontend calls the server endpoints under `/api/...`, so deployment must keep the Express server active alongside the static frontend assets.
