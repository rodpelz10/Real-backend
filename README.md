# Food Delivery API

Express + MongoDB backend for the Crave food delivery application. Authentication uses email/password accounts stored in MongoDB, scrypt password hashing, and signed JWT sessions. Firebase is not required.

## Setup

Copy `.env.example` to `.env`, configure MongoDB and a private `JWT_SECRET` (at least 32 characters), and review the initial admin credentials. The backend creates the configured administrator account on startup if it does not exist. Change the example password before using this outside local development.

```bash
npm install
npm run dev
```

## Authentication endpoints

- `POST /api/auth/register` — create a customer account (`name`, `email`, `password`)
- `POST /api/auth/login` — sign in (`email`, `password`), returns a bearer token
- `GET /api/auth/me` — return the signed-in user's profile

Protected endpoints require `Authorization: Bearer <token>`. Menu changes and order monitoring require the admin role. Public registration always creates customer accounts.
