# Evenly

> Auto-split expenses for couples and roommates. Privacy-first, offline-first.

A mobile app that automatically splits shared expenses, sets guardrails, and makes settling up effortless.

## Features (Planned)

- 🏦 **Bank Integration**: Connect via Plaid for automatic transaction import
- ⚖️ **Smart Splitting**: Even, income-weighted, or custom split modes
- 🎯 **Budgets & Guardrails**: Set limits and get notified before overspending
- 💰 **Easy Settlement**: One-tap deep links to Venmo, Cash App, Zelle
- 🔐 **Privacy-First**: End-to-end encryption, minimal data retention
- 📱 **Offline-First**: Works without internet, syncs when reconnected

## Tech Stack

**Mobile App**
- React Native (Expo)
- TypeScript
- React Query for data fetching
- Zustand for state management
- expo-sqlite for offline storage

**Server**
- Next.js 14 (App Router)
- TypeScript
- Supabase (Auth, Postgres, RLS)

**Integrations**
- Plaid (bank connections)
- Stripe (subscriptions)
- Sentry (error tracking)
- PostHog (analytics, opt-in only)

## Project Structure

```
evenly/
├── apps/
│   ├── mobile/          # Expo React Native app
│   └── server/          # Next.js API server
├── packages/
│   ├── split-engine/    # Pure TS split calculation logic
│   ├── ui/              # Shared RN components
│   └── config/          # Shared configs (tsconfig, eslint)
└── docs/
    └── ADRs/            # Architecture decision records
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Expo CLI
- iOS Simulator (macOS) or Android Emulator

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd evenly
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Start development servers**
   ```bash
   # Start both mobile and server
   npm run dev

   # Or start individually
   npm run dev:mobile  # Mobile app on Expo
   npm run dev:server  # Server on http://localhost:3001
   ```

### Running the Mobile App

```bash
# iOS
cd apps/mobile && npx expo run:ios

# Android
cd apps/mobile && npx expo run:android

# Web (for testing)
cd apps/mobile && npx expo start --web
```

### Running the Server

```bash
cd apps/server
npm run dev
```

The server will be available at `http://localhost:3001`.

## Development

### Available Scripts

**Root level:**
- `npm run dev` - Start mobile and server concurrently
- `npm run build` - Build all workspaces
- `npm run test` - Run all tests
- `npm run lint` - Lint all packages
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Type-check all packages

**Mobile app:**
- `npm run dev --workspace=@evenly/mobile` - Start Expo dev server
- `npm run ios --workspace=@evenly/mobile` - Run on iOS
- `npm run android --workspace=@evenly/mobile` - Run on Android

**Server:**
- `npm run dev --workspace=@evenly/server` - Start Next.js dev server
- `npm run build --workspace=@evenly/server` - Build for production

**Split Engine:**
- `npm run test --workspace=@evenly/split-engine` - Run unit tests

### Testing

```bash
# Run all tests
npm run test

# Run tests for specific package
npm run test --workspace=@evenly/split-engine

# Watch mode
cd packages/split-engine && npm run test:watch
```

### Linting & Formatting

```bash
# Lint all packages
npm run lint

# Format all files
npm run format
```

## Connecting Plaid Sandbox

For development, use Plaid's sandbox environment:

1. Sign up at [plaid.com/docs](https://plaid.com/docs)
2. Get your sandbox credentials
3. Add to `.env`:
   ```
   PLAID_CLIENT_ID=your-client-id
   PLAID_SECRET=your-sandbox-secret
   PLAID_ENV=sandbox
   ```
4. Use sandbox test credentials:
   - Username: `user_good`
   - Password: `pass_good`
   - Institution: Any (e.g., "Chase")

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Copy your project URL and keys to `.env`
3. Run migrations (Phase 1):
   ```bash
   # Coming in Phase 1
   ```

## Building for Production

### Mobile (iOS/Android)

```bash
cd apps/mobile

# iOS
eas build --platform ios

# Android
eas build --platform android
```

### Server

```bash
cd apps/server
npm run build
npm run start
```

## Environment Variables

See `.env.example` for required environment variables.

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`

**Optional:**
- `SENTRY_DSN` - Error tracking
- `POSTHOG_API_KEY` - Analytics (opt-in)
- `STRIPE_SECRET_KEY` - Subscriptions

## Project Phases

This project is being built in phases:

- ✅ **Phase 0**: Project Setup (current)
- ⬜ **Phase 1**: Database Schema + RLS
- ⬜ **Phase 2**: Split Engine Package
- ⬜ **Phase 3**: Server APIs (Plaid, Webhooks)
- ⬜ **Phase 4**: Mobile App Core Screens
- ⬜ **Phase 5**: Categorization & Rules
- ⬜ **Phase 6**: Budgets & Guardrails
- ⬜ **Phase 7**: Settlements & Ledger
- ⬜ **Phase 8**: Subscription Paywall
- ⬜ **Phase 9**: App Hardening & Store Readiness
- ⬜ **Phase 10**: Documentation & Deliverables

## Contributing

This is a personal project, but suggestions and bug reports are welcome via issues.

## License

Private - All Rights Reserved

## Privacy & Security

- All sensitive data is encrypted
- Plaid tokens are never logged
- RLS policies protect cross-household access
- Opt-in analytics only
- No P2P money movement (deep links only)

## Support

For issues or questions, please open a GitHub issue.
