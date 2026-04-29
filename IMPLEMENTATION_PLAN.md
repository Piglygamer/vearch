# Vearch Bank - Full Implementation Plan

## Phase 1: Real Crypto Integration (Testnet)

### Bitcoin Testnet
- Use **Blockchair API** or **Blockchain.com API** for testnet Bitcoin
- Generate HD wallet using `bip39` + `bitcoinjs-lib`
- Endpoints:
  - `POST /api/trpc/bank.generateCryptoAddress` → returns testnet BTC address
  - `POST /api/trpc/bank.depositCrypto` → sends testnet BTC to user address (via faucet or test funds)
  - `GET /api/trpc/bank.checkCryptoConfirmation` → polls blockchain for confirmations

### Ethereum Testnet (Sepolia)
- Use **Infura** or **Alchemy** free tier for Sepolia testnet
- Generate wallet using `ethers.js`
- Endpoints:
  - `POST /api/trpc/bank.generateEthAddress` → returns Sepolia address
  - `POST /api/trpc/bank.depositEth` → sends testnet ETH (via faucet)
  - `GET /api/trpc/bank.checkEthConfirmation` → checks transaction status

### Implementation
- Store generated addresses in `wallets` table with `cryptoAddress` and `cryptoNetwork` fields
- Track pending transactions in `transactions` table with blockchain tx hash
- Poll blockchain every 30 seconds for confirmations (update transaction status)

---

## Phase 2: Real Bank Integration (Plaid + Stripe)

### Plaid Integration
- Use **Plaid API** (free tier) to link bank accounts
- Flow:
  1. User clicks "Link Bank Account"
  2. Opens Plaid Link modal
  3. User selects bank and authenticates
  4. Plaid returns `public_token`
  5. Backend exchanges `public_token` for `access_token`
  6. Store `access_token` in database (encrypted)

### Stripe Connect Integration
- Use **Stripe Connect** for ACH transfers
- Flow:
  1. Create Stripe Connected Account for each user
  2. Link Plaid bank account to Stripe
  3. Use Stripe Payouts API for withdrawals
  4. Use Stripe ACH transfers for deposits

### Implementation
- New table: `bankAccounts` (userId, plaidAccessToken, stripeAccountId, accountMask)
- New endpoints:
  - `POST /api/trpc/bank.linkBankAccount` → initiates Plaid Link
  - `POST /api/trpc/bank.exchangePlaidToken` → exchanges token
  - `POST /api/trpc/bank.depositViaAch` → initiates ACH deposit
  - `POST /api/trpc/bank.withdrawViaAch` → initiates ACH withdrawal

---

## Phase 3: User Onboarding

### Signup Flow
1. Email + password signup
2. Email verification (send code to email)
3. KYC document upload (ID + selfie)
4. Implant linking (NFC scan or manual ID entry)
5. Redirect to dashboard

### Implementation
- New table: `kycDocuments` (userId, idPhotoUrl, selfieUrl, status: pending|approved|rejected)
- New endpoints:
  - `POST /api/trpc/auth.signup` → create user
  - `POST /api/trpc/auth.verifyEmail` → verify code
  - `POST /api/trpc/auth.uploadKycDocuments` → upload ID + selfie
  - `POST /api/trpc/implant.linkImplant` → link implant to user

### Frontend
- New page: `Onboarding.tsx` with multi-step form
- Step 1: Email signup
- Step 2: Email verification
- Step 3: KYC document upload
- Step 4: Implant linking
- Step 5: Success → redirect to dashboard

---

## Phase 4: Connect Everything

### Deposit Modal
- User selects payment method (crypto or bank)
- If crypto: show generated address, QR code, and confirmation tracker
- If bank: show Plaid Link button
- Real-time status updates as blockchain confirms or ACH processes

### Withdrawal Modal
- User selects destination (crypto address or bank account)
- System initiates real transaction
- Real-time status tracking

### Dashboard
- Show real balances from blockchain + bank accounts
- Show real transaction history with blockchain tx hashes
- Show pending transactions with estimated completion time

---

## Phase 5: Testing & Deployment

### Testing
- Test crypto deposit with testnet faucet
- Test bank linking with Plaid sandbox
- Test ACH transfer with Stripe sandbox
- Test KYC document upload
- Test implant linking
- End-to-end flow testing

### Deployment
- Deploy to production
- Set up production Plaid/Stripe keys
- Set up production blockchain RPC endpoints
- Monitor transactions and errors

---

## API Keys & Secrets Required

1. **Crypto**
   - Infura API key (Ethereum)
   - Blockchair API key (Bitcoin)

2. **Banking**
   - Plaid Client ID + Secret
   - Stripe API Key + Publishable Key
   - Stripe Connect Account

3. **Email**
   - SendGrid API key (for verification emails)

4. **Storage**
   - S3 bucket for KYC documents (already set up)

---

## Database Schema Changes

### New Tables
- `bankAccounts` (userId, plaidAccessToken, stripeAccountId, accountMask, status)
- `kycDocuments` (userId, idPhotoUrl, selfieUrl, status, createdAt, approvedAt)
- `cryptoAddresses` (userId, address, network: bitcoin|ethereum, createdAt)

### Schema Updates
- `wallets`: add `cryptoBalance`, `bankBalance`, `totalBalance`
- `transactions`: add `blockchainTxHash`, `achTraceNumber`, `confirmations`
- `users`: add `kycStatus`, `implantLinked`, `emailVerified`

---

## Credit Budget (28 credits)

- Phase 1 (Crypto): ~6 credits
- Phase 2 (Banking): ~8 credits
- Phase 3 (Onboarding): ~6 credits
- Phase 4 (Integration): ~4 credits
- Phase 5 (Testing): ~4 credits

**Total: ~28 credits** (tight budget, no room for major rewrites)
