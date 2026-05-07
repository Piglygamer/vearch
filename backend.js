const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');

const MY_STRIPE_SECRET_KEY = "sk_live_PASTE_YOUR_REAL_STRIPE_KEY_HERE";
const MY_FIDESMO_TOKEN = "PASTE_YOUR_REAL_FIDESMO_TOKEN_HERE";
const MY_LIVE_WEBSITE_URL = "https://your-custom-netlify-domain.netlify.app/"; 

const stripe = require('stripe')(MY_STRIPE_SECRET_KEY); 

const app = express();
app.use(express.json());

const FIDESMO_API = 'https://api.fidesmo.com/v3';
const APPLET_AID = 'A000000004564541524348';

app.post('/mint-virtual-card', async (req, res) => {
    try {
        const virtualPan = "4532" + Math.floor(100000000000 + Math.random() * 900000000000); 
        res.json({ success: true, virtualPan: virtualPan });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/fidesmo/callback/install/:userId', async (req, res) => {
    const { statusCode, sessionId } = req.body;
    const { userId } = req.params;

    if (statusCode === 200) {
        const userVirtualPan = "4532123456789010"; 
        const panHex = Buffer.from(userVirtualPan, 'hex').toString('hex');

        try {
            await axios.post(${FIDESMO_API}/ccm/personalize, {
                application: APPLET_AID,
                data: 5A08${panHex},
                encoding: "tlv"
            }, {
                headers: {
                    'Authorization': Bearer ${MY_FIDESMO_TOKEN},
                    'sessionId': sessionId,
                    'callbackUrl': ${MY_LIVE_WEBSITE_URL}/.netlify/functions/api/fidesmo/callback/complete/${userId}
                }
            });
        } catch (err) {
            console.error('Fidesmo Error:', err.message);
        }
    }
    res.status(200).send();
});

app.post('/fidesmo/callback/complete/:userId', (req, res) => {
    res.status(200).send();
});

module.exports.handler = serverless(app);
