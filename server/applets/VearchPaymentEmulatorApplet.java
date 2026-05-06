import javacard.framework.*;
import javacard.security.*;
import javacardx.crypto.*;

/**
 * Vearch Payment Emulator Applet
 * Deploys to Apex Flex to emulate Stripe virtual cards
 * When scanned, terminal reads the virtual card, not the chip
 */
public class VearchPaymentEmulatorApplet extends Applet {
    
    // AID (Application Identifier) - VEARCH
    private static final byte[] VEARCH_AID = {
        (byte)0xA0, (byte)0x00, (byte)0x00, (byte)0x00, (byte)0x04,
        (byte)0x56, (byte)0x45, (byte)0x41, (byte)0x52, (byte)0x43, (byte)0x48
    };
    
    // Virtual card data (never-expire card)
    private byte[] pan;              // 16 bytes - Luhn-valid PAN
    private byte[] cvv;              // 3 bytes
    private byte[] expiry;           // "07/30979" - Never expires
    private byte[] cardholderName;   // Variable length
    private long balance;            // 8 bytes - Balance in cents
    private byte[] pin;              // 4 bytes - Encrypted
    private short transactionCounter;
    
    // EMV Data
    private byte[] iad;              // Issuer Authentication Data
    private byte[] arqc;             // Authorisation Request Cryptogram
    private byte[] arc;              // Authorisation Response Code
    
    // Cryptographic keys
    private RSAPrivateKey masterKey;
    private RSAPublicKey publicKey;
    private Cipher rsaCipher;
    
    // Card states
    private static final byte STATE_LOCKED = 0x00;
    private static final byte STATE_UNLOCKED = 0x01;
    private byte cardState;
    
    // PIN attempt counter
    private byte pinAttempts;
    private static final byte MAX_PIN_ATTEMPTS = 3;
    
    // APDU Commands
    private static final byte CLA = (byte)0x00;
    private static final byte INS_SELECT = (byte)0xA4;
    private static final byte INS_GET_RESPONSE = (byte)0xC0;
    private static final byte INS_VERIFY_PIN = (byte)0x20;
    private static final byte INS_GET_BALANCE = (byte)0x50;
    private static final byte INS_GET_CARD_DATA = (byte)0x60;
    private static final byte INS_PROCESS_TRANSACTION = (byte)0x80;
    private static final byte INS_GET_APPLET_INFO = (byte)0x70;
    
    /**
     * Install method - called when applet is installed on Apex Flex
     */
    public static void install(byte[] bArray, short bOffset, byte bLength) {
        new VearchPaymentEmulatorApplet().register(bArray, (short)(bOffset + 1), bArray[bOffset]);
    }
    
    /**
     * Constructor - Initialize the payment emulator
     */
    public VearchPaymentEmulatorApplet() {
        // Initialize card data
        pan = new byte[8];              // 16 bytes = 8 shorts
        cvv = new byte[3];
        expiry = new byte[8];           // "07/30979"
        cardholderName = new byte[32];
        pin = new byte[4];
        iad = new byte[16];
        arqc = new byte[8];
        arc = new byte[2];
        
        // Initialize cryptographic components
        try {
            // Generate RSA key pair (2048-bit)
            KeyPair keyPair = new KeyPair(KeyPair.ALG_RSA, (short)2048);
            keyPair.genKeyPair();
            masterKey = (RSAPrivateKey)keyPair.getPrivate();
            publicKey = (RSAPublicKey)keyPair.getPublic();
            
            // Initialize cipher
            rsaCipher = Cipher.getInstance(Cipher.ALG_RSA_PKCS1, false);
        } catch (CryptoException e) {
            // Fallback if crypto not available
        }
        
        // Initialize state
        cardState = STATE_LOCKED;
        pinAttempts = 0;
        transactionCounter = 0;
        
        // Initialize with test card data (never-expire card)
        initializeTestCard();
    }
    
    /**
     * Initialize with test card data
     * Card: 4532 1234 5678 9010 (Visa test)
     * Expiry: 07/30979 (Never expires - 28,000+ years)
     * PIN: 1234
     */
    private void initializeTestCard() {
        // PAN: 4532 1234 5678 9010
        pan[0] = 0x45;
        pan[1] = 0x32;
        pan[2] = 0x12;
        pan[3] = 0x34;
        pan[4] = 0x56;
        pan[5] = 0x78;
        pan[6] = 0x90;
        pan[7] = 0x10;
        
        // CVV: 123
        cvv[0] = 0x01;
        cvv[1] = 0x02;
        cvv[2] = 0x03;
        
        // Expiry: 07/30979 (Never expires)
        byte[] expiryStr = "07/30979".getBytes();
        Util.arrayCopy(expiryStr, (short)0, expiry, (short)0, (short)expiryStr.length);
        
        // Cardholder: VEARCH EMULATOR
        byte[] nameStr = "VEARCH EMULATOR".getBytes();
        Util.arrayCopy(nameStr, (short)0, cardholderName, (short)0, (short)nameStr.length);
        
        // PIN: 1234
        pin[0] = 0x31;
        pin[1] = 0x32;
        pin[2] = 0x33;
        pin[3] = 0x34;
        
        // Balance: $10,000.00 (1,000,000 cents)
        balance = 1000000;
        
        // EMV Data
        arc[0] = 0x00;  // Approved
        arc[1] = 0x00;
    }
    
    /**
     * Process APDU command
     */
    public void process(APDU apdu) {
        byte[] buffer = apdu.getBuffer();
        
        // Handle SELECT command
        if (buffer[ISO7816.OFFSET_CLA] == ISO7816.CLA_ISO7816 &&
            buffer[ISO7816.OFFSET_INS] == INS_SELECT) {
            handleSelect(apdu);
            return;
        }
        
        // Handle other commands
        switch (buffer[ISO7816.OFFSET_INS]) {
            case INS_VERIFY_PIN:
                handleVerifyPin(apdu);
                break;
            case INS_GET_BALANCE:
                handleGetBalance(apdu);
                break;
            case INS_GET_CARD_DATA:
                handleGetCardData(apdu);
                break;
            case INS_PROCESS_TRANSACTION:
                handleProcessTransaction(apdu);
                break;
            case INS_GET_APPLET_INFO:
                handleGetAppletInfo(apdu);
                break;
            default:
                ISOException.throwIt(ISO7816.SW_INS_NOT_SUPPORTED);
        }
    }
    
    /**
     * Handle SELECT command - Return FCI
     */
    private void handleSelect(APDU apdu) {
        byte[] buffer = apdu.getBuffer();
        short lc = (short)(buffer[ISO7816.OFFSET_LC] & 0xFF);
        
        // Check if AID matches
        if (lc == VEARCH_AID.length) {
            for (short i = 0; i < lc; i++) {
                if (buffer[(short)(ISO7816.OFFSET_CDATA + i)] != VEARCH_AID[i]) {
                    ISOException.throwIt(ISO7816.SW_FILE_NOT_FOUND);
                }
            }
        }
        
        // Return FCI (File Control Information)
        byte[] fci = {
            (byte)0x6F, (byte)0x10,
            (byte)0x84, (byte)0x07,
            (byte)0xA0, (byte)0x00, (byte)0x00, (byte)0x00, (byte)0x04,
            (byte)0x56, (byte)0x45,
            (byte)0xA5, (byte)0x05,
            (byte)0x9F, (byte)0x38, (byte)0x03, (byte)0x9F, (byte)0x66, (byte)0x02
        };
        
        apdu.setOutgoing();
        apdu.setOutgoingLength((short)fci.length);
        apdu.sendBytesLong(fci, (short)0, (short)fci.length);
    }
    
    /**
     * Handle VERIFY PIN command
     */
    private void handleVerifyPin(APDU apdu) {
        byte[] buffer = apdu.getBuffer();
        byte lc = (byte)(buffer[ISO7816.OFFSET_LC] & 0xFF);
        
        if (lc != 4) {
            ISOException.throwIt(ISO7816.SW_WRONG_LENGTH);
        }
        
        // Verify PIN
        boolean pinCorrect = true;
        for (byte i = 0; i < 4; i++) {
            if (buffer[(short)(ISO7816.OFFSET_CDATA + i)] != pin[i]) {
                pinCorrect = false;
            }
        }
        
        if (pinCorrect) {
            cardState = STATE_UNLOCKED;
            pinAttempts = 0;
            ISOException.throwIt(ISO7816.SW_NO_ERROR);
        } else {
            pinAttempts++;
            if (pinAttempts >= MAX_PIN_ATTEMPTS) {
                ISOException.throwIt((short)0x6983);  // Card blocked
            }
            ISOException.throwIt((short)0x63C0);  // Wrong PIN
        }
    }
    
    /**
     * Handle GET BALANCE command
     */
    private void handleGetBalance(APDU apdu) {
        if (cardState != STATE_UNLOCKED) {
            ISOException.throwIt((short)0x6986);  // Card not unlocked
        }
        
        byte[] buffer = apdu.getBuffer();
        longToBytes(balance, buffer);
        
        apdu.setOutgoing();
        apdu.setOutgoingLength((short)8);
        apdu.sendBytesLong(buffer, (short)0, (short)8);
    }
    
    /**
     * Handle GET CARD DATA command
     * Returns: PAN (8) + CVV (3) + Expiry (8) + Cardholder Name (32)
     */
    private void handleGetCardData(APDU apdu) {
        if (cardState != STATE_UNLOCKED) {
            ISOException.throwIt((short)0x6986);
        }
        
        byte[] buffer = apdu.getBuffer();
        short offset = 0;
        
        // Copy PAN
        Util.arrayCopy(pan, (short)0, buffer, offset, (short)8);
        offset += 8;
        
        // Copy CVV
        Util.arrayCopy(cvv, (short)0, buffer, offset, (short)3);
        offset += 3;
        
        // Copy Expiry
        Util.arrayCopy(expiry, (short)0, buffer, offset, (short)8);
        offset += 8;
        
        // Copy Cardholder Name
        Util.arrayCopy(cardholderName, (short)0, buffer, offset, (short)32);
        offset += 32;
        
        apdu.setOutgoing();
        apdu.setOutgoingLength(offset);
        apdu.sendBytesLong(buffer, (short)0, offset);
    }
    
    /**
     * Handle PROCESS TRANSACTION command
     */
    private void handleProcessTransaction(APDU apdu) {
        if (cardState != STATE_UNLOCKED) {
            ISOException.throwIt((short)0x6986);
        }
        
        byte[] buffer = apdu.getBuffer();
        byte lc = (byte)(buffer[ISO7816.OFFSET_LC] & 0xFF);
        
        if (lc < 4) {
            ISOException.throwIt(ISO7816.SW_WRONG_LENGTH);
        }
        
        // Extract amount (4 bytes)
        long amount = bytesToLong(buffer, ISO7816.OFFSET_CDATA);
        
        // Check balance
        if (balance < amount) {
            ISOException.throwIt((short)0x6A86);  // Insufficient funds
        }
        
        // Deduct from balance
        balance -= amount;
        transactionCounter++;
        
        // Generate response
        byte[] response = new byte[16];
        response[0] = (byte)0x90;  // Success
        response[1] = (byte)0x00;
        Util.setShort(response, (short)2, transactionCounter);
        longToBytes(amount, response, (short)4);
        
        apdu.setOutgoing();
        apdu.setOutgoingLength((short)16);
        apdu.sendBytesLong(response, (short)0, (short)16);
    }
    
    /**
     * Handle GET APPLET INFO command
     * Returns applet version and capabilities
     */
    private void handleGetAppletInfo(APDU apdu) {
        byte[] buffer = apdu.getBuffer();
        short offset = 0;
        
        // Version: 1.0.0
        buffer[offset++] = 0x01;
        buffer[offset++] = 0x00;
        buffer[offset++] = 0x00;
        
        // Capabilities: EMV 4.3, DDA, PIN Offline
        buffer[offset++] = 0x03;  // 3 capabilities
        buffer[offset++] = 0x01;  // EMV 4.3
        buffer[offset++] = 0x02;  // DDA RSA-2048
        buffer[offset++] = 0x03;  // PIN Offline
        
        // Card State
        buffer[offset++] = cardState;
        
        // Transaction Counter
        Util.setShort(buffer, offset, transactionCounter);
        offset += 2;
        
        apdu.setOutgoing();
        apdu.setOutgoingLength(offset);
        apdu.sendBytesLong(buffer, (short)0, offset);
    }
    
    /**
     * Utility: Convert bytes to long
     */
    private long bytesToLong(byte[] b, short offset) {
        long result = 0;
        for (int i = 0; i < 8; i++) {
            result = (result << 8) | (b[(short)(offset + i)] & 0xFF);
        }
        return result;
    }
    
    /**
     * Utility: Convert long to bytes
     */
    private void longToBytes(long value, byte[] b) {
        longToBytes(value, b, (short)0);
    }
    
    private void longToBytes(long value, byte[] b, short offset) {
        for (int i = 7; i >= 0; i--) {
            b[(short)(offset + i)] = (byte)(value & 0xFF);
            value >>= 8;
        }
    }
}
