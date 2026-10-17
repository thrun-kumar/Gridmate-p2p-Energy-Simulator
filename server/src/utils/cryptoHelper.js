/**
 * SolarShare - Cryptographic Utility Module
 * Implements deterministic serialization and SHA-256 hashing using Node.js built-in crypto.
 * 
 * Supports Versioned Canonical Serialization:
 * - Version 1 (Historical records): Exact legacy 20 canonical fields preserved for 100% backward compatibility.
 * - Version 2 (Grid-Connected records): Extends canonical fields with grid zones, transmission losses, and wheeling fees.
 */

const crypto = require('crypto');

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Computes SHA-256 hash of a UTF-8 string.
 * @param {string} data - Input string
 * @returns {string} 64-character hexadecimal digest
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Generates a unique transaction identifier.
 * @returns {string} e.g. "TX-7F3A2B1C"
 */
function generateTxId() {
  return 'TX-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Deterministically serializes transaction fields in canonical alphabetical order.
 * CRITICAL: The current record hash and verification status are NOT included in its own hash input.
 * @param {Object} tx - The transaction record
 * @returns {string} Canonical JSON string
 */
function serializeTransaction(tx) {
  const agreed = Number(Number(tx.agreedPrice || tx.tradePriceINR || tx.tradePrice || 0).toFixed(2));
  const energy = Number(Number(tx.energyKWh || 0).toFixed(2));
  const totalVal = Number(Number(tx.totalValue || tx.totalValueINR || (energy * agreed) || 0).toFixed(2));
  const benchmark = Number(Number(tx.gridBenchmarkTariff || 8.00).toFixed(2));
  const savingsPerUnit = Number(Number(tx.buyerSavingsPerUnit !== undefined ? tx.buyerSavingsPerUnit : (benchmark - agreed)).toFixed(2));
  const buyerSavings = Number(Number(tx.buyerTotalSavings !== undefined ? tx.buyerTotalSavings : (energy * savingsPerUnit)).toFixed(2));
  const sellerRev = Number(Number(tx.sellerRevenue !== undefined ? tx.sellerRevenue : totalVal).toFixed(2));

  // Base V1 canonical fields
  const canonicalObj = {
    agreedPrice: agreed,
    buyerBid: Number(Number(tx.buyerBid || tx.buyerBidINR || 0).toFixed(2)),
    buyerId: String(tx.buyerId || ''),
    buyerName: String(tx.buyerName || ''),
    buyerSavingsPerUnit: savingsPerUnit,
    buyerTotalSavings: buyerSavings,
    energyKWh: energy,
    gridBenchmarkTariff: benchmark,
    index: Number(tx.index || 0),
    previousHash: String(tx.previousHash || GENESIS_HASH),
    sellerAsk: Number(Number(tx.sellerAsk || tx.sellerAskINR || 0).toFixed(2)),
    sellerId: String(tx.sellerId || ''),
    sellerName: String(tx.sellerName || ''),
    sellerRevenue: sellerRev,
    settlementStatus: String(tx.settlementStatus || tx.status || 'SETTLED'),
    simulationHour: Number(tx.simulationHour || 0),
    simulationRunRef: String(tx.simulationRunRef || 'RUN-01'),
    timestamp: String(tx.timestamp || ''),
    totalValue: totalVal,
    transactionId: String(tx.transactionId || tx.tradeId || '')
  };

  // Version 2: Extended Grid-Connected Fields
  const isV2 = tx.version === 2 || (tx.sellerZone !== undefined && tx.sellerZone !== null) || (tx.buyerZone !== undefined && tx.buyerZone !== null);
  if (isV2) {
    canonicalObj.buyerZone = String(tx.buyerZone || 'ZONE-A');
    canonicalObj.deliveredEnergyKWh = Number(Number(tx.deliveredEnergyKWh !== undefined ? tx.deliveredEnergyKWh : energy).toFixed(2));
    canonicalObj.lossKWh = Number(Number(tx.lossKWh || 0).toFixed(2));
    canonicalObj.platformFeeINR = Number(Number(tx.platformFeeINR || 0).toFixed(2));
    canonicalObj.sellerZone = String(tx.sellerZone || 'ZONE-A');
    canonicalObj.version = 2;
    canonicalObj.wheelingFeeINR = Number(Number(tx.wheelingFeeINR || 0).toFixed(2));
  }

  // Sort keys alphabetically for canonical consistency across runtimes
  const sortedKeys = Object.keys(canonicalObj).sort();
  const sortedObj = {};
  for (const key of sortedKeys) {
    sortedObj[key] = canonicalObj[key];
  }

  return JSON.stringify(sortedObj);
}

module.exports = {
  GENESIS_HASH,
  sha256,
  generateTxId,
  serializeTransaction
};
