# Apex Flex EMV Applet for Vearch Bank

## Overview
This EMV applet enables Apex Flex implants to function as contactless payment devices, allowing users to tap their implant on NFC terminals to make payments directly from their Vearch Bank account.

## Architecture

### Applet Components
1. **EMV Kernel** — Handles EMV transaction protocol
2. **Vearch Bank Connector** — Communicates with backend API
3. **Cryptographic Module** — Manages card credentials and signing
4. **Transaction Logger** — Records all payments

### Payment Flow
```
User taps implant on NFC terminal
    ↓
Applet receives transaction request
    ↓
Applet contacts Vearch Bank API (/api/payments/authorize)
    ↓
Backend validates and authorizes payment
    ↓
Applet receives authorization code
    ↓
Applet sends response to terminal
    ↓
Payment complete
```

## Deployment via Fedezmo

### Prerequisites
- Apex Flex implant with Fedezmo app installed
- Vearch Bank account with linked implant
- NFC payment terminal support

### Deployment Steps

1. **Generate Applet Package**
   ```bash
   npm run build:applet
   ```

2. **Upload to Fedezmo**
   - Open Fedezmo app on Apex Flex
   - Navigate to "Install Applet"
   - Select Vearch Bank EMV applet
   - Confirm installation

3. **Activate Payment Mode**
   - In Fedezmo: Settings → Payment Applets
   - Select Vearch Bank EMV
   - Tap implant on terminal to activate

## API Endpoints

### POST /api/payments/authorize
Authorize a payment from the applet

**Request:**
```json
{
  "implantId": "APEX-FLEX-001",
  "amount": 25.50,
  "currency": "USD",
  "merchantId": "MERCHANT-123",
  "transactionId": "TXN-UUID"
}
```

**Response:**
```json
{
  "success": true,
  "authCode": "AUTH123456",
  "status": "approved",
  "transactionId": "TXN-UUID",
  "balance": 974.50
}
```

### POST /api/payments/confirm
Confirm transaction completion

**Request:**
```json
{
  "transactionId": "TXN-UUID",
  "status": "completed"
}
```

## Security

- **Credential Storage**: Encrypted on-chip storage
- **Transaction Signing**: ECDSA with implant-specific keys
- **Communication**: TLS 1.3 for all API calls
- **Rate Limiting**: Max 10 transactions per minute per implant
- **Fraud Detection**: Real-time anomaly detection on backend

## Auto-Renewal

The applet automatically renews its credentials before expiration:
- Checks expiration 30 days before deadline
- Requests new credentials from backend
- Updates on-chip storage
- Seamless operation with no user intervention

## Troubleshooting

### Applet Not Responding
1. Restart Fedezmo app
2. Re-tap implant on terminal
3. Check Vearch Bank account status

### Payment Declined
1. Verify sufficient balance
2. Check account onboarding status
3. Review transaction logs

### Credential Expired
- Applet auto-renews, no action needed
- Manual renewal: Settings → Renew Credentials

## Development

### Build Applet
```bash
cd server/applets
npm install
npm run build
```

### Test Applet
```bash
npm run test
```

### Deploy to Testnet
```bash
npm run deploy:testnet
```

## Support
For issues, contact: support@vearchbank.com
