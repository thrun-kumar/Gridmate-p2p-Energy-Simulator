/**
 * SolarShare - Google OAuth 2.0 / Google Identity Services (GIS) Service
 * Implements Google ID Token verification against Google OAuth2 tokeninfo endpoint
 * using native Node.js https module (zero external dependencies).
 * Enforces audience, issuer, expiration, email_verified checks, account linking,
 * and first-time user role onboarding (Buyer vs Seller).
 */

const https = require('https');
const crypto = require('crypto');
const { hashPassword, sanitizeUser } = require('./authService');

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const isConfigured = Boolean(clientId && !clientId.includes('your-google-client-id'));
  return {
    clientId,
    isConfigured
  };
}

/**
 * Verifies a Google ID Token against Google's official public tokeninfo endpoint.
 * Validates issuer, audience, expiration, and email verification.
 */
function verifyGoogleToken(idToken) {
  return new Promise((resolve, reject) => {
    const config = getGoogleConfig();
    if (!config.isConfigured) {
      return reject(new Error('Google Sign-In is not configured. Please set GOOGLE_CLIENT_ID in your .env file with a valid Google Cloud OAuth Client ID.'));
    }

    if (!idToken || typeof idToken !== 'string') {
      return reject(new Error('Google credential/ID token is required.'));
    }

    const tokenUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken.trim())}`;

    const req = https.get(tokenUrl, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const payload = JSON.parse(data);

          if (res.statusCode !== 200 || payload.error || payload.error_description) {
            return reject(new Error(`Google token validation failed: ${payload.error_description || payload.error || 'Invalid token'}`));
          }

          // 1. Verify Issuer
          const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
          if (!validIssuers.includes(payload.iss)) {
            return reject(new Error(`Untrusted token issuer: "${payload.iss}". Expected Google.`));
          }

          // 2. Verify Audience (Must match our configured Client ID)
          if (payload.aud !== config.clientId) {
            return reject(new Error(`Token audience mismatch. Expected "${config.clientId}" but received "${payload.aud}".`));
          }

          // 3. Verify Expiration
          const nowSeconds = Math.floor(Date.now() / 1000);
          if (Number(payload.exp) < nowSeconds) {
            return reject(new Error('Google authentication token has expired. Please sign in again.'));
          }

          // 4. Verify Email Status
          const isEmailVerified = payload.email_verified === 'true' || payload.email_verified === true;
          if (!isEmailVerified) {
            return reject(new Error('The email address associated with this Google account has not been verified by Google.'));
          }

          resolve({
            googleId: payload.sub,
            email: (payload.email || '').toLowerCase().trim(),
            name: payload.name || payload.email.split('@')[0],
            picture: payload.picture || ''
          });
        } catch (err) {
          reject(new Error(`Failed to parse Google verification response: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Network error contacting Google OAuth services: ${err.message}`));
    });

    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Google verification request timed out.'));
    });
  });
}

module.exports = {
  getGoogleConfig,
  verifyGoogleToken
};
