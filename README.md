# Battersea K9 — App

Mobile app, backend API, and admin dashboard for Battersea K9.

## Structure

| Directory | Purpose |
|---|---|
| `api/` | Node.js + Express + PostgreSQL backend |
| `app/` | Expo React Native mobile app |
| `admin/` | Vite + React admin dashboard |

## Getting started

### API
```bash
cd api
cp .env.example .env   # fill in your DB creds + JWT secrets
npm install
npm run migrate        # run migrations against your PostgreSQL DB
npm run dev
```

### App
```bash
cd app
npm install
npx expo start
```

### Admin
```bash
cd admin
npm install
npm run dev
```
