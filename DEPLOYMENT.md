# Deployment Guide

This project now supports a split deployment:

- Frontend on Vercel
- Backend API on a separate Node host
- MySQL-compatible database on a separate provider

If you want a free full-stack path for the backend, the app server can run on Oracle Cloud Always Free. You will still need a MySQL-compatible database provider, because the app uses MySQL/Drizzle and Oracle's free database options are not MySQL.

## 1) Prerequisites

- Node.js 22+
- pnpm 10+
- MySQL-compatible database

## 2) Configure Environment

Create a `.env` file from `.env.example` and set values. Use separate frontend and backend environment variables.

Frontend build-time variables:

- `VITE_APP_ID` (required)
- `VITE_API_BASE_URL` (required)
- `VITE_OAUTH_PORTAL_URL` (required)
- `VITE_OAUTH_CALLBACK_URL` (required)

Backend runtime variables:

- `DATABASE_URL` (required)
- `JWT_SECRET` (required)
- `OAUTH_SERVER_URL` (required)
- `OAUTH_CALLBACK_URL` (required)
- `FRONTEND_URL` (required)
- `VITE_APP_ID` (required)
- `PORT` (optional, defaults to `3000`)
- `OWNER_OPEN_ID` (optional)
- `BUILT_IN_FORGE_API_URL` (optional)
- `BUILT_IN_FORGE_API_KEY` (optional)

The server now fails fast in production if required variables are missing.

## 3) Install and Build

```bash
pnpm install --frozen-lockfile
pnpm run build
```

For Vercel, the frontend build is isolated through `vite.config.vercel.ts` and `vercel.json`, which outputs the static site to `vercel-dist`.

## 4) Run Database Migrations

```bash
pnpm run db:migrate
```

If you need to generate migration files first:

```bash
pnpm run db:generate
pnpm run db:migrate
```

## 5) Start in Production

```bash
pnpm run start:prod
```

Health check endpoint:

- `GET /health`

## 6) One-command Deployment Verification

```bash
pnpm run deploy:check
```

This runs typecheck, tests, and a production build.

## 7) Docker Deployment

Build image:

```bash
docker build -t utme-mock:latest .
```

Run container:

```bash
docker run --rm -p 3000:3000 --env-file .env utme-mock:latest
```

## 8) Hosting Notes

- Set startup command to `pnpm run start:prod`.
- Expose port `3000` (or set `PORT` from your host).
- Ensure your reverse proxy forwards `x-forwarded-proto` so secure cookie logic works behind HTTPS.

## 9) Vercel Frontend

Use Vercel for the UI only.

### Vercel settings

- Build command: `pnpm run build:vercel`
- Output directory: `vercel-dist`
- Install command: `pnpm install --frozen-lockfile`
- Root directory: repository root

### Vercel environment variables

- `VITE_APP_ID`
- `VITE_API_BASE_URL`
- `VITE_OAUTH_PORTAL_URL`
- `VITE_OAUTH_CALLBACK_URL`

### Important

- `VITE_API_BASE_URL` must point to your backend API, not Vercel.
- `VITE_OAUTH_CALLBACK_URL` must point to the backend callback URL.
- `VITE_OAUTH_PORTAL_URL` stays pointed at the auth portal provider.

## 10) Backend Hosting Options

You can keep the backend on Oracle Cloud Always Free, Render, Railway, Fly.io, or a VPS.

If you use Oracle Cloud Always Free, follow the steps below.

## 11) Oracle Cloud Always Free

Use this if you want the app server on a free VM.

### Recommended layout

- Oracle Cloud Always Free Compute Instance for the Node/Express app.
- Separate MySQL-compatible database host for `DATABASE_URL`.
- Optional object storage or CDN later, if you add media uploads.

### Step-by-step

1. Create an Always Free Ubuntu VM in Oracle Cloud.
2. Reserve or note the public IP address for the VM.
3. In the OCI security list or network security group, allow inbound `22`, `80`, and `443`.
4. SSH into the VM.
5. Install Docker and Docker Compose, then enable the Docker service.
6. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `JWT_SECRET`, `OAUTH_SERVER_URL`, and `VITE_APP_ID`.
7. From the project directory, run `pnpm install --frozen-lockfile` locally and copy the app to the VM, or clone the repo directly on the VM.
8. Run `pnpm run db:migrate` against the MySQL database.
9. Build the app image with `docker build -t utme-mock:latest .`.
10. Run the container with `docker run -d --name utme-mock --restart unless-stopped -p 3000:3000 --env-file .env utme-mock:latest`.
11. Confirm the app is healthy at `http://127.0.0.1:3000/health`.
12. Put Nginx or Caddy on the VM in front of the container if you want HTTPS.
13. Point your domain to the Oracle VM public IP.
14. Update OAuth and app settings to use the public backend URL.

### Docker commands

```bash
docker build -t utme-mock:latest .
docker run -d --name utme-mock --restart unless-stopped -p 3000:3000 --env-file .env utme-mock:latest
docker logs -f utme-mock
```

### Nginx reverse proxy example

```nginx
server {
  listen 80;
  server_name your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

### Health check

- `GET /health`

### Notes

- Keep `PORT` set to `3000` unless your reverse proxy uses a different backend port.
- If you use HTTPS through a proxy, make sure it forwards `x-forwarded-proto`.
