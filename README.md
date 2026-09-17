# DIYForms Backend

[![Watch the demo](https://img.youtube.com/vi/GoYlrgRueJA/maxresdefault.jpg)](https://youtu.be/GoYlrgRueJA)

Backend API for **DIYForms** — a minimalist form builder where users can create forms, collect responses, and view analytics.

Built with **Node.js**, **Express 5**, **MongoDB**, and **Redis**.

This README is written with **help** of AI

## Features

- **User authentication** — signup, login, logout, JWT access/refresh tokens, Google OAuth
- **Email verification & password recovery** — OTP-based flows via [Resend](https://resend.com)
- **Form management** — create, update, delete, publish, and archive forms with unique slugs
- **Question types** — text, textarea, number, radio, checkbox, and select (with validation rules)
- **Response collection** — public or restricted forms with per-user access control
- **Analytics** — aggregated stats for numeric, radio, checkbox, and select questions
- **Caching** — form data cached in Redis (Upstash) for faster reads
- **Observability** — Prometheus metrics exposed at `/metrics`

## Tech Stack

| Layer        | Technology                          |
| ------------ | ----------------------------------- |
| Runtime      | Node.js (ES modules)                |
| Framework    | Express 5                           |
| Database     | MongoDB (Mongoose)                  |
| Cache        | Redis (Upstash)                     |
| Auth         | JWT, bcrypt, Google OAuth           |
| Email        | Resend                              |
| Metrics      | prom-client                         |

## Project Structure

```
diyforms-backend/
├── src/
│   ├── index.js              # Entry point — DB connect & server start
│   ├── app.js                # Express app, routes, middleware
│   ├── env.config.js         # dotenv loader
│   ├── controllers/          # Route handlers
│   ├── routes/               # API route definitions
│   ├── models/               # Mongoose schemas
│   ├── middleware/           # Auth, errors, metrics
│   ├── db/                   # MongoDB & Redis connections
│   └── utils/                # Helpers (ApiError, ApiResponse, email, prometheus)
├── .env.sample               # Environment variable template
└── package.json
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MongoDB](https://www.mongodb.com/) instance (local or Atlas)
- [Upstash Redis](https://upstash.com/) instance
- [Resend](https://resend.com/) API key (for email OTP)
- Google OAuth credentials (optional, for Google login)

## Getting Started

### 1. Clone and install

```bash
git clone <repository-url>
cd diyforms-backend
npm install
```

### 2. Configure environment

Copy the sample env file and fill in your values:

```bash
cp .env.sample .env
```

| Variable | Description |
| -------- | ----------- |
| `port` | Server port (default: `8080`) |
| `db_url` | MongoDB connection URL (without database name) |
| `db_name` | MongoDB database name |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens |
| `JWT_ACCESS_EXPIRES_IN` | Access token expiry (e.g. `15m`) |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry (e.g. `7d`) |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `EMAIL_FROM_NAME` | Display name for outgoing emails |
| `EMAIL_CLIENT` | Sender email address |
| `CORS_ORIGIN` | Allowed frontend origin (e.g. `http://localhost:5173`) |
| `UPSTASH_REDIS_REST_HOST` | Upstash Redis host |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis password/token |
| `OAUTH2_KEYS_JSON` | Google OAuth client JSON (stringified) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `NODE_ENV` | `development` or `production` |

### 3. Run the server

```bash
npm start
```

## API Overview

All routes are prefixed with `/api/v1`.

### Users — `/api/v1/users`

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| POST | `/signup` | — | Register a new user |
| POST | `/login` | — | Login with email/username and password |
| POST | `/logout` | ✓ | Logout (clears tokens) |
| POST | `/refresh-token` | — | Refresh access token |
| GET | `/user` | ✓ | Get current user profile |
| POST | `/update-password` | ✓ | Change password |
| POST | `/update-name` | ✓ | Update display name |
| POST | `/send-email-otp` | ✓ | Send email verification OTP |
| POST | `/verify-email-otp` | ✓ | Verify email with OTP |
| GET | `/is-verified` | ✓ | Check email verification status |
| POST | `/forgot-password/send-otp` | — | Send password reset OTP |
| POST | `/forgot-password/verify-otp` | — | Reset password with OTP |
| POST | `/google-login` | — | Login with Google ID token |

### Forms — `/api/v1/forms`

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/` | ✓ | List forms owned by the current user |
| POST | `/` | ✓ | Create a new form |
| GET | `/:slug` | optional | Get a form by slug |
| POST | `/:slug` | ✓ | Update a form |
| DELETE | `/:slug` | ✓ | Delete a form |
| PATCH | `/:slug/stop-response` | ✓ | Pause response collection |
| PATCH | `/:slug/resume-response` | ✓ | Resume response collection |

### Responses — `/api/v1/responses`

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/:slug` | optional | Get form schema for filling out |
| POST | `/:slug` | optional | Submit a response |

Restricted forms require a logged-in, verified user with explicit access and allow only one submission per user.

### Analytics — `/api/v1/analytics`

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/:slug` | ✓ | Get analytics for a form (author only) |

### Metrics

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/metrics` | Prometheus metrics scrape endpoint |

## Authentication

Protected routes accept the access token via:

- **Cookie:** `accessToken`
- **Header:** `Authorization: Bearer <token>`

Refresh tokens are issued on login and can be exchanged at `/api/v1/users/refresh-token`.

## Form Question Types

| Type | Description |
| ---- | ----------- |
| `text` | Single-line text input |
| `textarea` | Multi-line text input |
| `number` | Numeric input with min/max validation |
| `radio` | Single choice from options |
| `checkbox` | Multiple choice from options |
| `select` | Dropdown selection |

Forms have a `settings.status` of `draft`, `published`, or `archived`, and can be marked `restricted` to limit submissions to invited users.
