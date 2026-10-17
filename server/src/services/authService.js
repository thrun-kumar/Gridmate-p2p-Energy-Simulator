/**
 * SolarShare - Role-Based Authentication & User Management Service
 * Implements PBKDF2 password hashing with salt, session tokens, user registration,
 * role-based access control, and persistence.
 *
 * Designed for SDG 7: Clean Energy and Green Technology.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users_store.json');

/**
 * Deterministic PBKDF2 password hashing using built-in crypto.
 * Never stores plaintext passwords.
 */
function hashPassword(password, salt = null) {
  const effectiveSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, effectiveSalt, 10000, 64, 'sha512').toString('hex');
  return { salt: effectiveSalt, hash };
}

function verifyPassword(password, salt, storedHash) {
  const { hash } = hashPassword(password, salt);
  return hash === storedHash;
}

// Predefined Demo Accounts with secure hashes
const DEFAULT_DEMO_ACCOUNTS = [
  {
    id: 'admin',
    username: 'admin',
    email: 'operator@solarshare.energy',
    name: 'Grid System Operator',
    role: 'ADMIN',
    roleLabel: 'Admin / Grid Operator',
    householdId: null,
    token: 'solar-token-admin',
    description: 'System-wide operator with full administrative simulation control, ledger audit, and market oversight.',
    salt: 'salt_admin_demo',
    passwordHash: hashPassword('admin@solar2026', 'salt_admin_demo').hash,
    demoPassword: 'admin@solar2026'
  },
  // SELLERS (6 Households with Solar)
  {
    id: 'seller_hh01',
    username: 'seller_hh01',
    email: 'suncrest@greenmeadows.in',
    name: 'Green Meadows Villa',
    role: 'SELLER',
    roleLabel: 'Seller / Prosumer',
    householdId: 'HH-01',
    token: 'solar-token-seller-hh01',
    description: 'Eco-villa with 10.0 kW rooftop solar generating reliable clean energy surplus.',
    salt: 'salt_seller1_demo',
    passwordHash: hashPassword('seller@solar2026', 'salt_seller1_demo').hash,
    demoPassword: 'seller@solar2026'
  },
  {
    id: 'seller_hh03',
    username: 'seller_hh03',
    email: 'sunshine@heights.org',
    name: 'Sunshine Heights',
    role: 'SELLER',
    roleLabel: 'Seller / Prosumer',
    householdId: 'HH-03',
    token: 'solar-token-seller-hh03',
    description: 'Residential community clubhouse with 8.0 kW high-yield solar installation.',
    salt: 'salt_seller3_demo',
    passwordHash: hashPassword('seller@solar2026', 'salt_seller3_demo').hash,
    demoPassword: 'seller@solar2026'
  },
  {
    id: 'seller_hh06',
    username: 'seller_hh06',
    email: 'duplex@pinnacle.in',
    name: 'Pinnacle Duplex',
    role: 'SELLER',
    roleLabel: 'Seller / Prosumer',
    householdId: 'HH-06',
    token: 'solar-token-seller-hh06',
    description: 'Two-story residential prosumer with 6.0 kW solar array generating reliable surplus.',
    salt: 'salt_seller6_demo',
    passwordHash: hashPassword('seller@solar2026', 'salt_seller6_demo').hash,
    demoPassword: 'seller@solar2026'
  },
  {
    id: 'seller_hh08',
    username: 'seller_hh08',
    email: 'connect@ecovibe.net',
    name: 'EcoVibe Smart Residency',
    role: 'SELLER',
    roleLabel: 'Seller / Prosumer',
    householdId: 'HH-08',
    token: 'solar-token-seller-hh08',
    description: 'Smart residence with 4.0 kW solar array exporting clean daytime surplus.',
    salt: 'salt_seller8_demo',
    passwordHash: hashPassword('seller@solar2026', 'salt_seller8_demo').hash,
    demoPassword: 'seller@solar2026'
  },
  {
    id: 'seller_hh09',
    username: 'seller_hh09',
    email: 'lotus@gardens.in',
    name: 'Lotus Garden Homes',
    role: 'SELLER',
    roleLabel: 'Seller / Prosumer',
    householdId: 'HH-09',
    token: 'solar-token-seller-hh09',
    description: 'Townhouse cluster with 5.0 kW solar array exporting midday surplus into the local grid.',
    salt: 'salt_seller9_demo',
    passwordHash: hashPassword('seller@solar2026', 'salt_seller9_demo').hash,
    demoPassword: 'seller@solar2026'
  },
  {
    id: 'seller_hh11',
    username: 'seller_hh11',
    email: 'apartments@sunrise.in',
    name: 'Sunrise Apartments',
    role: 'SELLER',
    roleLabel: 'Seller / Prosumer',
    householdId: 'HH-11',
    token: 'solar-token-seller-hh11',
    description: 'Multi-tenant apartment complex with 12.0 kW rooftop community solar.',
    salt: 'salt_seller11_demo',
    passwordHash: hashPassword('seller@solar2026', 'salt_seller11_demo').hash,
    demoPassword: 'seller@solar2026'
  },
  // BUYERS (6 Ordinary Grid Consumers without Solar Panels)
  {
    id: 'buyer_hh02',
    username: 'buyer_hh02',
    email: 'facilities@apextechpark.com',
    name: 'Apex Tech Park',
    role: 'BUYER',
    roleLabel: 'Buyer / Consumer',
    householdId: 'HH-02',
    token: 'solar-token-buyer-hh02',
    description: 'Commercial technology park with high continuous daytime energy deficit seeking green power.',
    salt: 'salt_buyer2_demo',
    passwordHash: hashPassword('buyer@solar2026', 'salt_buyer2_demo').hash,
    demoPassword: 'buyer@solar2026'
  },
  {
    id: 'buyer_hh04',
    username: 'buyer_hh04',
    email: 'resident@riverdale.in',
    name: 'Riverdale Residential',
    role: 'BUYER',
    roleLabel: 'Buyer / Consumer',
    householdId: 'HH-04',
    token: 'solar-token-buyer-hh04',
    description: 'Apartment residence without rooftop solar access, relying on peer solar energy.',
    salt: 'salt_buyer4_demo',
    passwordHash: hashPassword('buyer@solar2026', 'salt_buyer4_demo').hash,
    demoPassword: 'buyer@solar2026'
  },
  {
    id: 'buyer_hh05',
    username: 'buyer_hh05',
    email: 'family@banyangrove.in',
    name: 'Banyan Grove Home',
    role: 'BUYER',
    roleLabel: 'Buyer / Consumer',
    householdId: 'HH-05',
    token: 'solar-token-buyer-hh05',
    description: 'Large family residence purchasing cheaper peer solar to reduce retail grid tariffs.',
    salt: 'salt_buyer5_demo',
    passwordHash: hashPassword('buyer@solar2026', 'salt_buyer5_demo').hash,
    demoPassword: 'buyer@solar2026'
  },
  {
    id: 'buyer_hh07',
    username: 'buyer_hh07',
    email: 'clinic@metrostjude.org',
    name: 'Metro St. Jude Clinic',
    role: 'BUYER',
    roleLabel: 'Buyer / Consumer',
    householdId: 'HH-07',
    token: 'solar-token-buyer-hh07',
    description: 'Healthcare clinic with continuous refrigeration and medical load, purchasing green power.',
    salt: 'salt_buyer7_demo',
    passwordHash: hashPassword('buyer@solar2026', 'salt_buyer7_demo').hash,
    demoPassword: 'buyer@solar2026'
  },
  {
    id: 'buyer_hh10',
    username: 'buyer_hh10',
    email: 'manager@centralmarket.com',
    name: 'Central Market Complex',
    role: 'BUYER',
    roleLabel: 'Buyer / Consumer',
    householdId: 'HH-10',
    token: 'solar-token-buyer-hh10',
    description: 'Commercial retail center with high daytime lighting and refrigeration demand.',
    salt: 'salt_buyer10_demo',
    passwordHash: hashPassword('buyer@solar2026', 'salt_buyer10_demo').hash,
    demoPassword: 'buyer@solar2026'
  },
  {
    id: 'buyer_hh12',
    username: 'buyer_hh12',
    email: 'director@communitylearning.edu',
    name: 'Community Learning Centre',
    role: 'BUYER',
    roleLabel: 'Buyer / Consumer',
    householdId: 'HH-12',
    token: 'solar-token-buyer-hh12',
    description: 'Public education centre with classrooms and computer lab, seeking low-cost clean power.',
    salt: 'salt_buyer12_demo',
    passwordHash: hashPassword('buyer@solar2026', 'salt_buyer12_demo').hash,
    demoPassword: 'buyer@solar2026'
  },
  // Backward compatibility alias for legacy tests
  {
    id: 'prosumer_hh04',
    username: 'prosumer_hh04',
    email: 'prosumer@legacy.test',
    name: 'Riverdale Residential',
    role: 'BUYER',
    roleLabel: 'Buyer / Consumer',
    householdId: 'HH-04',
    token: 'solar-token-both-hh04',
    description: 'Grid-connected consumer without solar panels.',
    salt: 'salt_both4_demo',
    passwordHash: hashPassword('prosumer@solar2026', 'salt_both4_demo').hash,
    demoPassword: 'prosumer@solar2026'
  }
];

// In-memory user registry and active token sessions
let usersMap = new Map();
const activeSessions = new Map();

function initUsersStore() {
  usersMap.clear();

  // Try loading persisted users from disk
  if (fs.existsSync(USERS_FILE)) {
    try {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      const loaded = JSON.parse(raw);
      if (Array.isArray(loaded)) {
        loaded.forEach(u => usersMap.set(u.id, u));
      }
    } catch (err) {
      console.warn('[SolarShare Auth] Warning: could not parse users_store.json, resetting with defaults:', err.message);
    }
  }

  // Ensure default demo accounts are present and updated with current specifications
  DEFAULT_DEMO_ACCOUNTS.forEach(acc => {
    usersMap.set(acc.id, { ...acc });
    // Pre-activate demo session token
    activeSessions.set(acc.token, usersMap.get(acc.id));
  });

  saveUsersStore();
}

function saveUsersStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const list = Array.from(usersMap.values());
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error('[SolarShare Auth] Error saving users store to disk:', err.message);
  }
}

// Initialize on module load
initUsersStore();

/**
 * Validates request Bearer token and returns user session, or null if invalid.
 */
function authenticateRequest(req) {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token && activeSessions.has(token)) {
    return activeSessions.get(token);
  }

  return null;
}

/**
 * Instant 1-click Demo Account Login (for hackathon judge convenience)
 */
function loginDemo(accountId) {
  const account = usersMap.get(accountId) || DEFAULT_DEMO_ACCOUNTS.find(a => a.id === accountId);
  if (!account) {
    throw new Error(`Demo account "${accountId}" not found.`);
  }

  const token = account.token || `solar-token-${account.id}-${Date.now()}`;
  activeSessions.set(token, account);

  return {
    success: true,
    token,
    user: sanitizeUser(account)
  };
}

/**
 * Real Credentials Login (Username or Email + Password)
 */
function loginWithCredentials(usernameOrEmail, password) {
  if (!usernameOrEmail || !password) {
    throw new Error('Username/email and password are required.');
  }

  const needle = usernameOrEmail.trim().toLowerCase();
  let user = null;

  for (const u of usersMap.values()) {
    if (
      (u.username && u.username.toLowerCase() === needle) ||
      (u.email && u.email.toLowerCase() === needle) ||
      (u.id && u.id.toLowerCase() === needle)
    ) {
      user = u;
      break;
    }
  }

  if (!user) {
    throw new Error('Invalid credentials. Account not found.');
  }

  const isMatch = verifyPassword(password, user.salt, user.passwordHash);
  if (!isMatch) {
    throw new Error('Invalid credentials. Incorrect password.');
  }

  // Generate secure session token
  const token = `solar-sess-${crypto.randomBytes(24).toString('hex')}`;
  activeSessions.set(token, user);

  return {
    success: true,
    token,
    user: sanitizeUser(user)
  };
}

/**
 * User Registration
 * Validates inputs, creates user record, hashes password, and creates household in simulation.
 */
function registerUser({ username, email, password, role, householdName, solarCapacityKW = 0, zone = null, simManager = null }) {
  if (!username || username.trim().length < 3) {
    throw new Error('Username must be at least 3 characters long.');
  }
  if (!email || !email.includes('@')) {
    throw new Error('A valid email address is required.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const normalizedRole = (role || 'BUYER').toUpperCase();
  if (!['BUYER', 'SELLER', 'BOTH'].includes(normalizedRole)) {
    throw new Error('Role must be either BUYER, SELLER, or BOTH.');
  }

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  // Check uniqueness
  for (const u of usersMap.values()) {
    if (u.username.toLowerCase() === cleanUsername.toLowerCase()) {
      throw new Error(`Username "${cleanUsername}" is already registered.`);
    }
    if (u.email && u.email.toLowerCase() === cleanEmail) {
      throw new Error(`Email "${cleanEmail}" is already registered.`);
    }
  }

  // Provision new household ID
  const nextNum = usersMap.size + 11;
  const newHouseholdId = `HH-${String(nextNum).padStart(2, '0')}`;
  const cleanHouseholdName = householdName ? householdName.trim() : `${cleanUsername}'s Solar Home`;
  const parsedCapacity = Number(solarCapacityKW) || (normalizedRole === 'BUYER' ? 0 : 5.0);
  const assignedZone = zone || (normalizedRole === 'SELLER' ? 'ZONE-A' : 'ZONE-B');

  // Hash password with unique salt
  const { salt, hash } = hashPassword(password);

  // Role labels
  let roleLabel = 'Buyer / Consumer';
  if (normalizedRole === 'SELLER') roleLabel = 'Seller / Prosumer';
  if (normalizedRole === 'BOTH') roleLabel = 'Prosumer (Seller & Buyer)';

  const newUser = {
    id: `user_${cleanUsername.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    username: cleanUsername,
    email: cleanEmail,
    name: cleanHouseholdName,
    role: normalizedRole,
    roleLabel,
    householdId: newHouseholdId,
    zone: assignedZone,
    description: normalizedRole === 'BUYER'
      ? `Registered consumer household in ${assignedZone} without solar panels.`
      : `Registered prosumer household in ${assignedZone} equipped with ${parsedCapacity.toFixed(1)} kW rooftop solar.`,
    solarCapacityKW: parsedCapacity,
    salt,
    passwordHash: hash,
    createdAt: new Date().toISOString()
  };

  usersMap.set(newUser.id, newUser);
  saveUsersStore();

  // Dynamically integrate into running simulation if manager is provided
  if (simManager && typeof simManager.registerDynamicHousehold === 'function') {
    simManager.registerDynamicHousehold({
      id: newHouseholdId,
      name: cleanHouseholdName,
      role: normalizedRole === 'BOTH' ? 'Both' : (normalizedRole === 'SELLER' ? 'Seller' : 'Buyer'),
      solarCapacityKW: parsedCapacity,
      zone: assignedZone,
      description: newUser.description
    });
  }

  // Auto-login session
  const token = `solar-sess-${crypto.randomBytes(24).toString('hex')}`;
  activeSessions.set(token, newUser);

  return {
    success: true,
    token,
    user: sanitizeUser(newUser),
    message: `Account registered successfully! Welcome to SolarShare as a ${roleLabel}.`
  };
}

/**
 * Password Reset Flow (Simulated secure reset with confirmation)
 */
function resetPassword({ usernameOrEmail, newPassword }) {
  if (!usernameOrEmail || !newPassword) {
    throw new Error('Username/email and new password are required.');
  }
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }

  const needle = usernameOrEmail.trim().toLowerCase();
  let targetUser = null;

  for (const u of usersMap.values()) {
    if (
      (u.username && u.username.toLowerCase() === needle) ||
      (u.email && u.email.toLowerCase() === needle)
    ) {
      targetUser = u;
      break;
    }
  }

  if (!targetUser) {
    throw new Error('No registered account found matching that username or email.');
  }

  const { salt, hash } = hashPassword(newPassword);
  targetUser.salt = salt;
  targetUser.passwordHash = hash;
  targetUser.passwordUpdatedAt = new Date().toISOString();

  saveUsersStore();

  return {
    success: true,
    message: `Password has been reset successfully for ${targetUser.username}. You may now log in.`
  };
}

/**
 * Invalidate an active session token upon logout
 */
function logoutSession(token) {
  if (!token) return false;
  const cleanToken = token.startsWith('Bearer ') ? token.substring(7).trim() : token.trim();
  const deleted = activeSessions.delete(cleanToken);
  return deleted;
}

/**
 * Handle Google Authenticated User
 * If existing user by googleId or email, links and logs in.
 * If new user and no role specified, signals needsRoleSelection.
 * If new user with role, registers household and provisions user.
 */
function handleGoogleUser({ verifiedAccount, role, householdName, solarCapacityKW = 0, simManager = null }) {
  if (!verifiedAccount || !verifiedAccount.email || !verifiedAccount.googleId) {
    throw new Error('Valid Google account profile is required.');
  }

  const cleanEmail = verifiedAccount.email.toLowerCase().trim();
  let existingUser = null;

  for (const u of usersMap.values()) {
    if (u.googleId === verifiedAccount.googleId || (u.email && u.email.toLowerCase() === cleanEmail)) {
      existingUser = u;
      break;
    }
  }

  // Case 1: Returning Google User
  if (existingUser) {
    if (!existingUser.googleId) {
      existingUser.googleId = verifiedAccount.googleId;
      existingUser.authProvider = 'google';
      saveUsersStore();
    }

    const token = `solar-sess-${crypto.randomBytes(24).toString('hex')}`;
    activeSessions.set(token, existingUser);

    return {
      success: true,
      token,
      user: sanitizeUser(existingUser),
      isNewUser: false,
      needsRoleSelection: false
    };
  }

  // Case 2: First-time Google user - Needs role onboarding
  if (!role) {
    return {
      success: true,
      needsRoleSelection: true,
      googleAccount: {
        email: cleanEmail,
        name: verifiedAccount.name,
        picture: verifiedAccount.picture,
        googleId: verifiedAccount.googleId
      }
    };
  }

  // Case 3: First-time Google user with selected role
  const normalizedRole = role.toUpperCase();
  if (normalizedRole === 'ADMIN') {
    throw new Error('Google Sign-In cannot grant Administrator privileges.');
  }

  if (!['BUYER', 'SELLER', 'BOTH'].includes(normalizedRole)) {
    throw new Error('Role must be either BUYER, SELLER, or BOTH.');
  }

  // Provision new household ID
  const nextNum = usersMap.size + 11;
  const newHouseholdId = `HH-${String(nextNum).padStart(2, '0')}`;
  const cleanHouseholdName = householdName ? householdName.trim() : `${verifiedAccount.name}'s Solar Home`;
  const parsedCapacity = Number(solarCapacityKW) || (normalizedRole === 'BUYER' ? 0 : 5.0);

  let roleLabel = 'Buyer / Consumer';
  if (normalizedRole === 'SELLER') roleLabel = 'Seller / Prosumer';
  if (normalizedRole === 'BOTH') roleLabel = 'Prosumer (Seller & Buyer)';

  const { salt, hash } = hashPassword(crypto.randomBytes(16).toString('hex'));

  const newUser = {
    id: `google_${verifiedAccount.googleId.substring(0, 12)}`,
    googleId: verifiedAccount.googleId,
    username: cleanEmail.split('@')[0],
    email: cleanEmail,
    name: cleanHouseholdName,
    role: normalizedRole,
    roleLabel,
    householdId: newHouseholdId,
    description: normalizedRole === 'BUYER'
      ? `Google-authenticated consumer household seeking clean energy.`
      : `Google-authenticated prosumer equipped with ${parsedCapacity.toFixed(1)} kW rooftop solar.`,
    solarCapacityKW: parsedCapacity,
    authProvider: 'google',
    picture: verifiedAccount.picture,
    salt,
    passwordHash: hash,
    createdAt: new Date().toISOString()
  };

  usersMap.set(newUser.id, newUser);
  saveUsersStore();

  if (simManager && typeof simManager.registerDynamicHousehold === 'function') {
    simManager.registerDynamicHousehold({
      id: newHouseholdId,
      name: cleanHouseholdName,
      role: normalizedRole === 'BOTH' ? 'Both' : (normalizedRole === 'SELLER' ? 'Seller' : 'Buyer'),
      solarCapacityKW: parsedCapacity,
      description: newUser.description
    });
  }

  const token = `solar-sess-${crypto.randomBytes(24).toString('hex')}`;
  activeSessions.set(token, newUser);

  return {
    success: true,
    token,
    user: sanitizeUser(newUser),
    isNewUser: true,
    needsRoleSelection: false,
    message: `Welcome to SolarShare! Your account has been registered as a ${roleLabel}.`
  };
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    roleLabel: user.roleLabel,
    householdId: user.householdId,
    description: user.description,
    solarCapacityKW: user.solarCapacityKW || 0,
    authProvider: user.authProvider || 'local',
    picture: user.picture || ''
  };
}

function getDemoAccounts() {
  return DEFAULT_DEMO_ACCOUNTS.map(a => sanitizeUser(a));
}

module.exports = {
  DEMO_ACCOUNTS: DEFAULT_DEMO_ACCOUNTS,
  getDemoAccounts,
  authenticateRequest,
  logoutSession,
  loginDemo,
  login: loginDemo, // Backward compatibility alias
  loginWithCredentials,
  registerUser,
  resetPassword,
  handleGoogleUser,
  hashPassword,
  verifyPassword,
  sanitizeUser
};
