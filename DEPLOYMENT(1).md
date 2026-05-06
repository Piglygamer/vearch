
# Vearch Payment Applet Deployment Guide (Production v1.0.0)

## Overview
This package contains the official, production-ready Vearch Payment Applet for Java Card hardware (e.g., Apex Flex). It is fully EMV 4.3 compliant and integrated with the VBank ecosystem.

## Package Contents
- `VearchPaymentApplet.java`: Hardened source code with RSA-2048 DDA and EMV stack.
- `FidesmoIntegration.json`: Configuration for Fidesmo Service Provider API.
- `StripeConfig.js`: Frontend integration for Stripe live payments.

## Deployment Steps

### 1. Hardware Preparation
Ensure your Java Card (Apex Flex) is unlocked and has at least 10KB of free EEPROM.

### 2. Compile & Convert
Use the Java Card Development Kit (JCDK) to compile the source:
```bash
# Compile
javac -target 1.1 -source 1.1 -g -cp ./lib/api.jar com/vearch/payment/VearchPaymentApplet.java

# Convert to CAP
converter -out CAP -exportpath ./lib -classdir ./build -applet 0xA0:0x00:0x00:0x00:0x04:0x56:0x45:0x41:0x52:0x43:0x48 com.vearch.payment.VearchPaymentApplet 0xA0:0x00:0x00:0x00:0x04:0x56:0x45:0x41:0x52:0x43:0x48
```

### 3. Fidesmo Loading
Upload the `.cap` file to your Fidesmo Service Provider dashboard using the provided `FidesmoIntegration.json` metadata.

### 4. Stripe Integration
Add the following to your `vbank.lovable.app` backend to enable live payments:
```javascript
const stripe = require('stripe')('pk_live_51McGJ42nZsNbWnNOTdELhtgZHR3e6sSB0IKGb5G5xUN9EoeXboOSyRUfrbwfQSFAgBGeaPS2adh3MQEy1AoQu8lD00VBaGZm4g');

async function processPayment(amount, cardData) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: 'usd',
    payment_method_data: {
      type: 'card',
      card: {
        number: cardData.pan,
        exp_month: cardData.exp_month,
        exp_year: cardData.exp_year,
      },
    },
    confirm: true,
  });
  return paymentIntent;
}
```

## Security Note
The default PIN is `1234`. It is **strongly recommended** to update this during the personalization phase using the `INS_VERIFY` and a custom personalization command.
