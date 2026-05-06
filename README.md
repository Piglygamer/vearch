# Vearch

**A payment-routing layer for NFC implants.** Vearch is the middleman between
a chip on your hand and a real merchant. The chip stores a UID. The user adds
a real card via Stripe. A connected merchant POSTs the UID + amount to Vearch,
which charges the cardholder's saved Stripe payment method off-session and
routes funds to the merchant's Stripe Connect account.

> **Vearch is not a bank.** Vearch never holds customer funds, never sees a
> PAN, and is not a money transmitter. Stripe is the processor of record;
> merchants must complete their own Stripe Connect onboarding (Stripe handles
> their KYB). See [LEGAL.md](./LEGAL.md) for details.

## How a charge works

```
   chip (UID)        terminal app                      Vearch backend                     Stripe
       │                  │                                  │                              │
       │ ──── tap ───►    │                                  │                              │
       │                  │ ── POST /merchant.charge ──────► │                              │
       │                  │   { uid, amountCents }           │                              │
       │                  │   x-vearch-merchant-key: vmk_…   │                              │
       │                  │                                  │ resolve uid → user → pm_…    │
       │                  │                                  │ paymentIntents.create({      │
       │                  │                                  │   off_session: true,         │
       │                  │                                  │   confirm: true,             │
       │                  │                                  │   transfer_data: {           │
       │                  │                                  │     destination: acct_…      │
       │                  │                                  │   }                          │
       │                  │                                  │ }) ────────────────────────► │
       │                  │ ◄─── { approved, declineCode? }  │ ◄────────────────────────── │
```

Money flow: `cardholder card → Stripe → merchant's Stripe Connect account`.
Funds never sit in a Vearch-controlled balance.

## What's in the box

This repository contains both the **middleman bridge** (the real path
described above) and a **legacy simulator** (a set of pages and routers
written before the bridge that pretended Vearch was a bank, mocked an EMV
applet on the chip, and simulated card issuance). The simulator is kept
working for now but is **deprecated**; future work will remove it.

Use these for the bridge:

- **Server**:
  - `server/services/stripeCustomer.ts` — Stripe Customer + SetupIntent
  - `server/services/implantLink.ts` — UID ↔ user linking
  - `server/services/charge.ts` — `chargeByImplantUid(...)`, the off-session PI
  - `server/services/merchantAuth.ts` — `vmk_…` API key generation + lookup
  - `server/_core/stripeWebhook.ts` — verifies signatures and persists
    `payment_intent.*`, `payment_method.*`, and `charge.refunded` events
  - tRPC: `paymentMethods.{listMine,createSetupIntent,setDefault,detach}`,
    `implantsBridge.{listMine,link,unlink}`, `transactionsBridge.listMine`,
    `merchant.{charge,whoami}` (header-auth via `x-vearch-merchant-key`)
- **Client**:
  - `client/src/components/AddPaymentMethod.tsx` — Stripe Elements +
    SetupIntent. The PAN never leaves Stripe.
  - `client/src/components/LinkImplant.tsx` — Web NFC `NDEFReader` →
    `implantsBridge.link`.
  - `client/src/pages/TerminalDemo.tsx` (`/terminal`) — phone-side merchant
    terminal. Holds the API key in tab memory only.
- **Schema**:
  - `implants.uid` — the bytes the terminal reads off the chip
  - `paymentMethods` — read-only mirror of Stripe PaymentMethods
  - `merchants` — connected-account merchants and their hashed API keys
  - Migration: `drizzle/0005_middleman_bridge.sql`

## Running the bridge locally

```bash
# 1. Install
pnpm install

# 2. Env. The bridge requires Stripe TEST keys at minimum.
cp .env.example .env
# Edit .env to set:
#   STRIPE_SECRET_KEY=sk_test_...
#   STRIPE_WEBHOOK_SECRET=whsec_...
#   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
#   DATABASE_URL=mysql://...
#   DEMO_MODE=true   # shows test-mode banner; not required outside production

# 3. Apply schema
pnpm db:push    # against a real database
# OR: apply drizzle/0005_middleman_bridge.sql by hand against your DB.

# 4. Provision a test merchant (one-shot, in a node REPL or script):
#   import { provisionMerchant } from "./server/services/merchantAuth";
#   const { apiKey } = await provisionMerchant({
#     name: "Demo Coffee",
#     stripeAccountId: "acct_…", // a real connected account from Stripe Connect
#   });
#   // Save apiKey somewhere safe — it is shown once.

# 5. Run
pnpm dev
```

In production, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
`VITE_STRIPE_PUBLISHABLE_KEY` are required at boot; the server fails to
start if any are missing.

## Tests

The middleman bridge ships with the following test suites:

| File | What it covers |
| --- | --- |
| `server/charge.test.ts` | `chargeByImplantUid` — off_session + confirm, idempotency key forwarding, decline-code mapping (incl. `authentication_required`/3DS) |
| `server/stripeWebhook.test.ts` | Signature verification (real `Stripe.webhooks.generateTestHeaderString` fixtures), event dispatch table |
| `server/merchantAuth.test.ts` | API key generation, prefix lookup, constant-time hash compare |
| `server/merchantRouter.test.ts` | tRPC `merchant.charge` requires a valid `x-vearch-merchant-key` header |

Run with `pnpm test`.

---

# Legacy simulator (deprecated)

> ⚠️ Everything below describes a deprecated set of features written before
> the middleman bridge: simulated EMV applets on the chip, fake virtual
> cards, simulated balances, simulated ACH, simulated crypto. None of these
> are part of the real payment path. They will be removed in a follow-up PR.
> The header that used to be here ("Immortal Implant Payment OS",
> "100% Functional", "PCI DSS compliant", "92 tests passing") was inaccurate
> — Vearch is not PCI-certified, has no concept of "immortal cards", and
> does not hold customer funds.

## Features (legacy)

### 🏦 Complete Banking Platform
- **Multi-User Accounts**: Register, authenticate, and manage accounts
- **Real Money Integration**: Stripe live keys for real deposits/withdrawals
- **Zero Fees**: No fees for any banking operations
- **Instant Settlement**: Real-time transaction processing

### 💳 Virtual EMV Cards
- **Immortal Cards**: Expiry date set to 7/5/30979 (essentially forever)
- **Auto-Renewal**: Cards automatically renew before expiration
- **Instant Issuance**: Create cards in seconds
- **Full EMV Compliance**: PCI DSS compliant

### 🔌 NFC Implant Integration
- **Apex Flex Support**: Full support for Apex Flex implants
- **Tap-to-Pay**: Direct payment from implant via EMV applet
- **Web NFC API**: Browser-based implant scanning
- **Secure Linking**: Encrypted implant-to-account linking

### 🛡️ Self-Healing Infrastructure
- **Continuous Monitoring**: 60-second health check intervals
- **Auto-Recovery**: Automatic repair of detected issues
- **Vulnerability Scanning**: Real-time threat detection
- **Data Integrity**: Automatic validation and repair

### 👨‍💼 Admin Dashboard
- **System Health**: Real-time monitoring of all services
- **User Management**: View and manage bank users
- **Payment Monitoring**: Track all transactions
- **Security Audit**: View security logs and status

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Tailwind CSS 4, shadcn/ui |
| **Backend** | Express 4, tRPC 11, Node.js |
| **Database** | MySQL with Drizzle ORM |
| **Payments** | Stripe (Connected Accounts) |
| **Authentication** | Manus OAuth |
| **Implants** | Web NFC API, Apex Flex |
| **Testing** | Vitest (92 tests passing) |
| **Deployment** | Manus Cloud |

## Quick Start

### Prerequisites
- Node.js 22+
- pnpm
- MySQL database
- Stripe account (live keys)

### Installation

```bash
# Clone repository
git clone https://github.com/vearchbank/vearch-vault.git
cd vearch-vault

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your Stripe keys and database URL

# Run migrations
pnpm db:push

# Start development server
pnpm dev
```

Visit `http://localhost:3000` to see the app.

### Running Tests

```bash
# Run all tests (92 tests)
pnpm test

# Run specific test file
pnpm test -- server/e2e.test.ts

# Watch mode
pnpm test -- --watch
```

## Project Structure

```
vearch-vault/
├── client/                    # React frontend
│   ├── src/
│   │   ├── pages/            # Page components
│   │   │   ├── Dashboard.tsx  # Main banking dashboard
│   │   │   ├── AdminDashboard.tsx  # Admin interface
│   │   │   └── Home.tsx       # Landing page
│   │   ├── components/        # Reusable components
│   │   │   ├── DepositModal.tsx
│   │   │   ├── WithdrawModal.tsx
│   │   │   ├── ImplantScanner.tsx
│   │   │   └── DashboardLayout.tsx
│   │   ├── lib/
│   │   │   └── trpc.ts        # tRPC client
│   │   ├── App.tsx            # Routes
│   │   └── main.tsx           # Entry point
│   └── index.html
├── server/                    # Express backend
│   ├── api/
│   │   ├── bank.ts           # Bank operations
│   │   ├── implants.ts       # Implant management
│   │   └── payments.ts       # Payment processing
│   ├── services/
│   │   ├── stripeService.ts  # Stripe integration
│   │   ├── paymentService.ts # Payment logic
│   │   └── selfHealingService.ts  # Health monitoring
│   ├── routers.ts            # tRPC procedures
│   ├── db.ts                 # Database queries
│   └── _core/                # Framework code
├── drizzle/
│   ├── schema.ts             # Database schema
│   └── migrations/           # SQL migrations
├── server/
│   ├── e2e.test.ts          # End-to-end tests
│   ├── auth.logout.test.ts  # Auth tests
│   └── services/
│       └── paymentService.test.ts  # Payment tests
├── DEPLOYMENT.md             # Deployment guide
└── README.md                 # This file
```

## Key Workflows

### User Registration & Banking

```
1. User visits app
2. Clicks "Create Bank Account"
3. Authenticates via Manus OAuth
4. Stripe onboarding link provided
5. User completes Stripe setup
6. Bank account activated
```

### Deposit Flow

```
1. User clicks "Deposit Now"
2. Modal opens with Stripe CardElement
3. User enters card details
4. Payment processed via Stripe
5. Funds added to wallet
6. Transaction recorded
```

### Implant Linking

```
1. User clicks "Link Implant"
2. Browser requests NFC permission
3. User taps implant on device
4. Implant ID captured
5. Implant linked to account
6. Ready for tap-to-pay
```

### Tap-to-Pay

```
1. User taps implant on NFC terminal
2. EMV applet initiates payment
3. Applet contacts backend API
4. Backend authorizes payment
5. Payment processed via Stripe
6. Funds deducted from wallet
7. Terminal shows approval
```

## API Documentation

### Bank Operations

**Create Bank Account**
```
POST /api/bank/account/create
{
  "email": "user@example.com",
  "name": "John Doe"
}
```

**Deposit Money**
```
POST /api/bank/deposit
{
  "amount": 100.00,
  "paymentMethodId": "pm_xxx"
}
```

**Withdraw Money**
```
POST /api/bank/withdraw
{
  "amount": 50.00,
  "bankAccountId": "ba_xxx"
}
```

### Implant Operations

**Link Implant**
```
POST /api/implants/link
{
  "nfcId": "NFC-123456",
  "implantType": "apex_flex"
}
```

**Get Implants**
```
GET /api/implants/list
```

### Payment Processing

**Authorize Payment**
```
POST /api/payments/authorize
{
  "implantId": "implant-123",
  "amount": 25.50,
  "currency": "USD",
  "merchantId": "merchant-456"
}
```

## Configuration

### Environment Variables

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Database
DATABASE_URL=mysql://user:pass@host/vearchbank

# OAuth
VITE_OAUTH_PORTAL_URL=https://oauth.manus.im
OAUTH_SERVER_URL=https://oauth-api.manus.im
VITE_APP_ID=your_app_id

# Security
JWT_SECRET=your_jwt_secret_key
```

### Database Schema

The system uses MySQL with Drizzle ORM. Key tables:

- **users** - User accounts with roles
- **bankAccounts** - Stripe Connected Accounts
- **cards** - Virtual EMV cards
- **implants** - Linked NFC implants
- **wallets** - User wallets with balances
- **transactions** - All payment transactions
- **systemHealth** - Health monitoring logs

## Testing

### Test Coverage

- **92 Total Tests** (all passing)
  - 40 Dashboard tests
  - 24 Payment service tests
  - 27 E2E tests
  - 1 Auth test

### Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test -- --coverage

# Watch mode
pnpm test -- --watch

# Specific test file
pnpm test -- server/e2e.test.ts
```

## Deployment

### Deploy to Manus Cloud

```bash
# Create checkpoint
pnpm save-checkpoint "Production release v1.0.0"

# Click Publish button in Manus UI
```

### Deploy to Custom Server

```bash
# Build for production
pnpm build

# Start server
NODE_ENV=production node dist/server/_core/index.js

# Verify deployment
curl https://your-domain.com/api/health
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Monitoring & Operations

### Health Dashboard

Access admin dashboard at `/admin` (admin role required):
- System health status
- User management
- Payment monitoring
- Security audit logs

### Health Checks

System performs automatic health checks every 60 seconds:
- ✓ Database connectivity
- ✓ Stripe API status
- ✓ NFC service availability
- ✓ Auto-renewal service status

### Logs

Monitor logs in `.manus-logs/`:
- `devserver.log` - Server logs
- `browserConsole.log` - Client errors
- `networkRequests.log` - API requests
- `sessionReplay.log` - User interactions

## Security

### Data Protection
- All card data encrypted at rest
- TLS 1.3 for all communications
- JWT tokens for sessions
- Rate limiting: 10 payments/min per implant

### Compliance
- PCI DSS compliant
- GDPR compliant
- SOC 2 Type II ready
- Regular security audits

## Troubleshooting

### Deposits Not Processing
1. Verify Stripe API keys
2. Check database connectivity
3. Review Stripe webhook logs
4. Restart payment service

### Implant Not Linking
1. Enable NFC in browser
2. Verify Apex Flex compatibility
3. Check user account status
4. Review NFC service logs

### System Health Degraded
1. Run diagnostics via admin dashboard
2. Check system resources
3. Review error logs
4. Trigger auto-healing

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

## Support

- **Documentation**: https://docs.vearchbank.com
- **Issues**: https://github.com/vearchbank/vearch-vault/issues
- **Email**: support@vearchbank.com
- **Status**: https://status.vearchbank.com

## License

Vearch Bank © 2026. All rights reserved.

## Roadmap

- [ ] Mobile app (iOS/Android)
- [ ] Multi-currency support
- [ ] Crypto integration
- [ ] Advanced analytics
- [ ] API marketplace
- [ ] White-label platform

---

**Built with ❤️ for the future of implant banking.**
