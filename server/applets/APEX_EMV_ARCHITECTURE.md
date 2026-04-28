# Apex Flex EMV Applet Architecture

## Overview

The Apex Flex EMV applet transforms the implant into a **real payment device** capable of processing NFC transactions directly on the chip. This applet runs on the Apex Flex's Java Card environment and communicates with Vearch Bank for transaction authorization.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NFC Terminal (Reader)                    │
└────────────────────────┬────────────────────────────────────┘
                         │ NFC Communication
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Apex Flex Implant (Java Card)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        EMV Applet (VearchEMV.cap)                    │  │
│  │  - NFC Interface Handler                             │  │
│  │  - EMV Transaction Logic                             │  │
│  │  - Cryptographic Operations (RSA, AES)               │  │
│  │  - Secure Storage (PAN, CVV, Keys)                   │  │
│  │  - Transaction Counter & Limits                      │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS/TLS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            Vearch Bank Backend (API Server)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  /api/applet/authorize      - Authorize transaction  │  │
│  │  /api/applet/confirm        - Confirm payment        │  │
│  │  /api/applet/update         - Update applet code     │  │
│  │  /api/applet/balance        - Get wallet balance     │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Stripe Payment Processor                   │
│  - Process charge from user's Stripe account                │
│  - Settlement to bank account                               │
└─────────────────────────────────────────────────────────────┘
```

## EMV Applet Components

### 1. NFC Interface Handler
- Listens for ISO/IEC 14443-A (Type 2/4) NFC messages
- Implements APDU (Application Protocol Data Unit) processing
- Handles SELECT, GET RESPONSE, and DATA commands

### 2. EMV Transaction Logic
- **Initiate Transaction**: Terminal sends transaction amount
- **Authenticate**: Applet verifies with Vearch Bank backend
- **Generate Cryptogram**: Signs transaction with private key
- **Send Response**: Terminal receives authorization response

### 3. Cryptographic Operations
- **RSA-2048**: Sign transactions with private key
- **AES-128**: Encrypt sensitive data (PAN, CVV)
- **HMAC-SHA256**: Verify transaction integrity

### 4. Secure Storage
- **Encrypted PAN**: Card number stored encrypted on chip
- **Private Key**: Used to sign transactions (never leaves chip)
- **Session Keys**: Temporary keys for each transaction
- **Transaction Log**: Last 10 transactions stored on chip

### 5. Transaction Limits
- **Per-Transaction Limit**: $500 (configurable)
- **Daily Limit**: $5,000 (configurable)
- **Velocity Check**: Max 10 transactions per hour

## Payment Flow

### Step 1: User Taps Implant on Terminal
```
User → Tap Apex Flex on NFC Terminal
Terminal → Sends SELECT command to applet
Applet → Responds with AID (Application Identifier)
```

### Step 2: Terminal Initiates Transaction
```
Terminal → Sends transaction amount + merchant ID
Applet → Validates against daily/hourly limits
Applet → Generates transaction ID (TID)
```

### Step 3: Applet Requests Authorization from Vearch Bank
```
Applet → HTTPS POST /api/applet/authorize
Body: {
  transactionId: "TID_12345",
  amount: 25.50,
  merchantId: "MERCHANT_ABC",
  implantId: "APEX_XYZ789",
  timestamp: 1704067200
}

Vearch Bank → Verifies user's wallet balance
Vearch Bank → Checks Stripe account for funds
Vearch Bank → Returns: { authorized: true, authCode: "AUTH123" }
```

### Step 4: Applet Signs Transaction
```
Applet → Creates transaction data:
  - Amount
  - Merchant ID
  - Authorization code
  - Timestamp
  - Random nonce

Applet → Signs with private key (RSA-2048)
Applet → Generates cryptogram (signed transaction proof)
```

### Step 5: Terminal Receives Response
```
Applet → Sends cryptogram + auth code to terminal
Terminal → Displays "Payment Approved"
Terminal → Stores transaction receipt
```

### Step 6: Settlement
```
Vearch Bank → Processes charge via Stripe
Stripe → Deducts from user's bank account
Stripe → Settles with merchant's bank
```

## Applet Deployment via Fedezmo

### Installation Process
1. User downloads Vearch Bank applet from Fedezmo marketplace
2. Fedezmo app communicates with Apex Flex via NFC
3. Applet is loaded onto the chip's secure storage
4. User's wallet credentials are provisioned
5. Applet is activated and ready for payments

### Applet Update Mechanism
- Vearch Bank periodically checks for applet updates
- If new version available, Fedezmo app downloads it
- User approves update via Fedezmo interface
- New applet is loaded, old version backed up
- Automatic rollback if update fails

## Security Considerations

### Private Key Protection
- Private key is generated on-chip and never exported
- Key is stored in secure element (SE) with PIN protection
- Transactions require PIN verification (optional)

### Transaction Verification
- Each transaction is cryptographically signed
- Terminal verifies signature with public key
- Vearch Bank verifies transaction authenticity

### Replay Attack Prevention
- Each transaction includes unique nonce
- Transaction counter incremented after each payment
- Timestamp validation prevents old transactions

### Velocity Checks
- Applet tracks transaction count per hour
- Applet tracks cumulative daily amount
- Limits enforced on-chip before authorization request

## API Endpoints for Applet

### POST /api/applet/authorize
Authorize a transaction from the applet.

```
Request:
{
  transactionId: string,
  amount: number,
  merchantId: string,
  implantId: string,
  timestamp: number
}

Response:
{
  authorized: boolean,
  authCode: string,
  declineReason?: string
}
```

### POST /api/applet/confirm
Confirm transaction completion (for settlement).

```
Request:
{
  transactionId: string,
  cryptogram: string,
  authCode: string
}

Response:
{
  confirmed: boolean,
  settlementId: string
}
```

### POST /api/applet/update
Check for and download applet updates.

```
Request:
{
  implantId: string,
  currentVersion: string
}

Response:
{
  updateAvailable: boolean,
  newVersion?: string,
  appletUrl?: string,
  checksum?: string
}
```

### GET /api/applet/balance
Get current wallet balance (called by applet).

```
Request:
{
  implantId: string
}

Response:
{
  balance: number,
  currency: string,
  lastUpdated: timestamp
}
```

## Fedezmo Integration

### Fedezmo App Communication
- Fedezmo app acts as bridge between Vearch Bank and Apex Flex
- Uses NFC for applet installation/updates
- Uses Bluetooth for user notifications
- Stores applet configuration locally

### Applet Lifecycle in Fedezmo
1. **Discovery**: Fedezmo detects Apex Flex
2. **Installation**: Downloads and installs applet
3. **Provisioning**: Sets up wallet credentials
4. **Activation**: Enables payment capability
5. **Monitoring**: Tracks transaction history
6. **Updates**: Manages applet versions

## EMV Certification Path

### Level 1: EMV Compliance
- Implement EMV 3-D Secure protocol
- Support standard EMV transaction flow
- Pass EMV test vectors

### Level 2: Visa/Mastercard Certification
- Register with Visa/Mastercard as issuer
- Submit applet for security review
- Pass penetration testing

### Level 3: Production Deployment
- Deploy applet to Fedezmo marketplace
- Enable real transactions with merchants
- Monitor fraud and security metrics

## Future Enhancements

- **Biometric Authentication**: Add fingerprint verification before payment
- **Multi-Currency Support**: Handle transactions in different currencies
- **Loyalty Integration**: Store loyalty points on chip
- **Offline Payments**: Support transactions without internet connection
- **Peer-to-Peer**: Enable implant-to-implant payments
