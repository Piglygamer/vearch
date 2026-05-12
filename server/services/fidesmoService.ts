import axios from 'axios';

const FIDESMO_API = process.env.FIDESMO_API_URL || 'https://api.fidesmo.com/v3';
const FIDESMO_TOKEN = process.env.FIDESMO_API_TOKEN || '';
const VEARCH_APPLET_AID = 'A000000004564541524348';
const CALLBACK_BASE_URL = process.env.CALLBACK_BASE_URL || 'https://vbank.manus.space';

export interface FidesmoSession {
  sessionId: string;
  userId: string;
  cardId: string;
  status: 'pending' | 'installing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

// In-memory session tracking (replace with database in production)
const activeSessions = new Map<string, FidesmoSession>();

/**
 * Start Fidesmo NFC ring detection and applet installation
 */
export async function startFidesmoSession(userId: string, cardId: string): Promise<FidesmoSession> {
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const session: FidesmoSession = {
    sessionId,
    userId,
    cardId,
    status: 'pending',
    createdAt: new Date(),
  };

  activeSessions.set(sessionId, session);

  try {
    // Notify Fidesmo to prepare for NFC ring detection
    const response = await axios.post(
      `${FIDESMO_API}/ccm/install`,
      {
        id: VEARCH_APPLET_AID,
        module: VEARCH_APPLET_AID,
        application: VEARCH_APPLET_AID,
        selectable: true,
      },
      {
        headers: {
          'Authorization': `Bearer ${FIDESMO_TOKEN}`,
          'sessionId': sessionId,
          'callbackUrl': `${CALLBACK_BASE_URL}/api/fidesmo/callback/install`,
          'Content-Type': 'application/json',
        },
      }
    );

    session.status = 'installing';
    return session;
  } catch (error) {
    session.status = 'failed';
    session.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  }
}

/**
 * Handle Fidesmo installation callback
 */
export async function handleFidesmoCallback(
  sessionId: string,
  status: 'success' | 'failure',
  data?: Record<string, unknown>
): Promise<FidesmoSession | null> {
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    console.error(`[FIDESMO] Session not found: ${sessionId}`);
    return null;
  }

  if (status === 'success') {
    session.status = 'completed';
    session.completedAt = new Date();
    console.log(`[FIDESMO] Installation completed for session ${sessionId}`, data);
  } else {
    session.status = 'failed';
    session.errorMessage = data?.error as string || 'Installation failed';
    console.error(`[FIDESMO] Installation failed for session ${sessionId}`, data);
  }

  return session;
}

/**
 * Get session status
 */
export function getSessionStatus(sessionId: string): FidesmoSession | null {
  return activeSessions.get(sessionId) || null;
}

/**
 * Personalize card with Stripe virtual card data
 */
export async function personalizeCard(
  sessionId: string,
  cardNumber: string,
  expMonth: number,
  expYear: number,
  cvv: string,
  pin: string
): Promise<void> {
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  try {
    // Send personalization data to Fidesmo
    await axios.post(
      `${FIDESMO_API}/ccm/personalize`,
      {
        sessionId,
        cardData: {
          pan: cardNumber,
          expiry: `${expMonth}${expYear}`,
          cvv,
          pin,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${FIDESMO_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`[FIDESMO] Card personalized for session ${sessionId}`);
  } catch (error) {
    console.error(`[FIDESMO] Personalization failed:`, error);
    throw error;
  }
}

/**
 * Get applet AID for card
 */
export function getAppletAID(): string {
  return VEARCH_APPLET_AID;
}

/**
 * Verify Fidesmo webhook signature
 */
export function verifyFidesmoSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return hash === signature;
}

/**
 * Clean up old sessions (call periodically)
 */
export function cleanupOldSessions(maxAgeMs: number = 3600000): void {
  const now = Date.now();
  const sessionsToDelete: string[] = [];
  
  activeSessions.forEach((session, sessionId) => {
    if (now - session.createdAt.getTime() > maxAgeMs) {
      sessionsToDelete.push(sessionId);
    }
  });
  
  sessionsToDelete.forEach(sessionId => {
    activeSessions.delete(sessionId);
    console.log(`[FIDESMO] Cleaned up old session: ${sessionId}`);
  });
}
