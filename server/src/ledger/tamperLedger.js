/**
 * SolarShare - Tamper-Evident Transaction Ledger
 * Implements a cryptographic hash-linked audit ledger using Node.js built-in crypto (SHA-256).
 * Persists ledger to server/data/ledger_store.json to survive application restarts.
 * 
 * Complies with SDG 7 auditability and transparency principles.
 */

const fs = require('fs');
const path = require('path');
const { GENESIS_HASH, sha256, serializeTransaction } = require('../utils/cryptoHelper');

const DATA_DIR = path.join(__dirname, '../../data');
const LEDGER_FILE = path.join(DATA_DIR, 'ledger_store.json');

const BACKEND_LEDGER_FILE = path.resolve(__dirname, '../../../backend/data/ledger.json');
const SERVER_LEDGER_FILE = path.resolve(__dirname, '../../../server/data/ledger.json');

class TamperLedger {
  constructor(autoLoad = true, shouldPersist = true) {
    this.records = [];
    this.shouldPersist = shouldPersist;
    if (autoLoad) {
      this.loadFromDisk();
    }
  }

  /**
   * Loads persisted ledger blocks from disk if present.
   */
  loadFromDisk() {
    const candidates = [SERVER_LEDGER_FILE, LEDGER_FILE, BACKEND_LEDGER_FILE];
    for (const file of candidates) {
      try {
        if (fs.existsSync(file)) {
          const raw = fs.readFileSync(file, 'utf8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.records = parsed;
            console.log(`[SolarShare Ledger] Loaded ${this.records.length} historical blocks from ${path.basename(file)}.`);
            return;
          }
        }
      } catch (err) {
        console.warn(`[SolarShare Ledger] Could not load from ${file}: ${err.message}`);
      }
    }
  }

  /**
   * Persists ledger blocks to disk.
   */
  saveToDisk() {
    if (!this.shouldPersist) return;
    const targets = [LEDGER_FILE, SERVER_LEDGER_FILE, BACKEND_LEDGER_FILE];
    const serialized = JSON.stringify(this.records, null, 2);
    targets.forEach(target => {
      try {
        const dir = path.dirname(target);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(target, serialized, 'utf8');
      } catch (err) {
        console.error(`[SolarShare Ledger] Error saving ledger to ${target}:`, err.message);
      }
    });
  }

  /**
   * Appends a newly settled trade into the cryptographic ledger.
   * Calculates the current record hash using canonical serialization including previousHash.
   *
   * @param {Object} trade - Settled trade object
   * @param {string} runRef - Simulation run identifier
   * @returns {Object} Appended ledger block record
   */
  appendTransaction(trade, runRef = 'SIM-RUN-20261014-01') {
    const index = this.records.length;
    const previousHash = index === 0 
      ? GENESIS_HASH 
      : (this.records[index - 1].currentHash || this.records[index - 1].hash);

    const energyKWh = Number(Number(trade.energyKWh || 0).toFixed(2));
    const agreedPrice = Number(Number(trade.tradePriceINR || trade.agreedPrice || 0).toFixed(2));
    const totalValue = Number(Number(trade.totalValueINR || trade.totalValue || (energyKWh * agreedPrice)).toFixed(2));
    const gridBenchmarkTariff = Number(Number(trade.gridBenchmarkTariff || 8.00).toFixed(2));
    
    // Financial formulas
    const buyerSavingsPerUnit = Number((gridBenchmarkTariff - agreedPrice).toFixed(2));
    const buyerTotalSavings = Number(Number(trade.buyerGrossSavingsINR !== undefined ? trade.buyerGrossSavingsINR : (energyKWh * buyerSavingsPerUnit)).toFixed(2));
    const sellerRevenue = Number(Number(trade.sellerEarningsINR !== undefined ? trade.sellerEarningsINR : totalValue).toFixed(2));

    const isV2 = Boolean(trade.sellerZone || trade.buyerZone || trade.version === 2);
    const sellerZone = String(trade.sellerZone || 'ZONE-A');
    const buyerZone = String(trade.buyerZone || 'ZONE-A');
    const lossKWh = Number(Number(trade.lossKWh || 0).toFixed(2));
    const deliveredEnergyKWh = Number(Number(trade.deliveredEnergyKWh !== undefined ? trade.deliveredEnergyKWh : (energyKWh - lossKWh)).toFixed(2));
    const wheelingFeeINR = Number(Number(trade.wheelingFeeINR || 0).toFixed(2));
    const isCrossZone = Boolean(trade.isCrossZone !== undefined ? trade.isCrossZone : (sellerZone !== buyerZone));

    const block = {
      index,
      version: isV2 ? 2 : 1,
      transactionId: trade.tradeId || trade.transactionId,
      timestamp: trade.timestamp || new Date().toISOString(),
      simulationRunRef: String(trade.simulationRunRef || runRef),
      simulationHour: Number(trade.simulationHour || 0),
      sellerId: String(trade.sellerId || ''),
      sellerName: String(trade.sellerName || ''),
      sellerZone: sellerZone,
      buyerId: String(trade.buyerId || ''),
      buyerName: String(trade.buyerName || ''),
      buyerZone: buyerZone,
      isCrossZone: isCrossZone,
      energyKWh: energyKWh,
      lossKWh: lossKWh,
      deliveredEnergyKWh: deliveredEnergyKWh,
      sellerAsk: Number(Number(trade.sellerAskINR || trade.sellerAsk || 0).toFixed(2)),
      buyerBid: Number(Number(trade.buyerBidINR || trade.buyerBid || 0).toFixed(2)),
      agreedPrice: agreedPrice,
      totalValue: totalValue,
      platformFeeINR: Number(Number(trade.platformFeeINR || 0).toFixed(2)),
      wheelingFeeINR: wheelingFeeINR,
      gridBenchmarkTariff: gridBenchmarkTariff,
      buyerSavingsPerUnit: buyerSavingsPerUnit,
      buyerTotalSavings: buyerTotalSavings,
      sellerRevenue: sellerRevenue,
      settlementStatus: String(trade.status || 'SETTLED'),
      trades: [trade],
      previousHash: previousHash,
      currentHash: '', // Populated below after canonical serialization
      hash: '',
      verificationStatus: 'VALID'
    };

    // Canonical serialization before hashing
    const serializedPayload = serializeTransaction(block);
    block.currentHash = sha256(serializedPayload);
    block.hash = block.currentHash;

    this.records.push(block);
    this.saveToDisk();

    return block;
  }

  /**
   * Retrieves all ledger records in append order.
   * @returns {Array} Array of ledger records
   */
  getRecords() {
    return [...this.records];
  }

  /**
   * Verifies the cryptographic integrity of an arbitrary records array.
   */
  verify(recordsToVerify = null) {
    const list = recordsToVerify || this.records;

    if (!list || list.length === 0) {
      return {
        isValid: true,
        valid: true,
        checkedBlocks: 0,
        corruptedBlockId: null,
        verifiedCount: 0,
        genesisHash: GENESIS_HASH,
        message: 'Ledger is currently empty. Awaiting first simulation trades.',
        details: []
      };
    }

    const verificationDetails = [];

    for (let i = 0; i < list.length; i++) {
      const record = list[i];

      // Check 1: Previous hash link
      if (i === 0) {
        if (record.previousHash !== GENESIS_HASH && record.previousHash !== '0000000000000000000000000000000000000000000000000000000000000000') {
          return {
            isValid: false,
            valid: false,
            checkedBlocks: 0,
            corruptedBlockId: record.transactionId || record.blockId || 0,
            brokenIndex: 0,
            transactionId: record.transactionId,
            reason: 'Genesis violation: Block 0 does not point to the documented Genesis hash.',
            expectedPreviousHash: GENESIS_HASH,
            actualPreviousHash: record.previousHash,
            verifiedCount: 0
          };
        }
      } else {
        const prevBlock = list[i - 1];
        const prevExpectedHash = prevBlock.currentHash || prevBlock.hash;
        if (record.previousHash !== prevExpectedHash) {
          return {
            isValid: false,
            valid: false,
            checkedBlocks: i,
            corruptedBlockId: record.transactionId || record.blockId || i,
            brokenIndex: i,
            transactionId: record.transactionId,
            reason: `Broken hash chain at block #${i}. Previous hash link mismatch with block #${i - 1}.`,
            expectedPreviousHash: prevExpectedHash,
            actualPreviousHash: record.previousHash,
            verifiedCount: i
          };
        }
      }

      // Check 2: Content integrity by hash recalculation
      const canonicalPayload = serializeTransaction(record);
      const recalculatedHash = sha256(canonicalPayload);
      const storedHash = record.currentHash || record.hash;

      if (recalculatedHash !== storedHash) {
        return {
          isValid: false,
          valid: false,
          checkedBlocks: i,
          corruptedBlockId: record.transactionId || record.blockId || i,
          brokenIndex: i,
          transactionId: record.transactionId,
          reason: `Cryptographic integrity failure at block #${i} (TX: ${record.transactionId}). Recalculated hash does not match stored hash. Data was tampered!`,
          expectedHash: recalculatedHash,
          storedHash: storedHash,
          verifiedCount: i
        };
      }

      verificationDetails.push({
        index: i,
        transactionId: record.transactionId,
        hashPrefix: (storedHash || '').substring(0, 10) + '...',
        verified: true
      });
    }

    const latest = list[list.length - 1];
    return {
      isValid: true,
      valid: true,
      checkedBlocks: list.length,
      corruptedBlockId: null,
      verifiedCount: list.length,
      genesisHash: GENESIS_HASH,
      latestHash: latest.currentHash || latest.hash,
      message: `Ledger cryptographic integrity verified successfully across all ${list.length} transaction blocks. Zero discrepancies detected.`,
      details: verificationDetails
    };
  }

  /**
   * Alias for verify() - verifies the complete cryptographic hash chain.
   */
  verifyChain(recordsToVerify = null) {
    return this.verify(recordsToVerify);
  }

  /**
   * Safely simulates a tampering attempt on an isolated in-memory deep copy.
   */
  simulateTamperTest(targetIndex = null, fieldToAlter = 'energyKWh', alteredValue = 999.99) {
    if (this.records.length === 0) {
      return {
        success: false,
        message: 'Cannot run tamper simulation test: ledger contains no completed transactions yet.'
      };
    }

    const idx = targetIndex !== null && targetIndex >= 0 && targetIndex < this.records.length
      ? targetIndex
      : Math.max(0, this.records.length - 1);

    const clonedLedger = JSON.parse(JSON.stringify(this.records));
    const originalRecord = { ...clonedLedger[idx] };
    const originalValue = originalRecord[fieldToAlter];

    // Deliberately alter the specified field in the isolated copy
    clonedLedger[idx][fieldToAlter] = alteredValue;

    const verificationOnTamperedCopy = this.verify(clonedLedger);

    return {
      success: true,
      testDescription: 'Cryptographic Tamper Detection Demonstration on Isolated Clone',
      isAuthoritativeLedgerAffected: false,
      tamperedBlockIndex: idx,
      transactionId: originalRecord.transactionId,
      fieldAltered: fieldToAlter,
      originalValue: originalValue,
      tamperedValue: alteredValue,
      originalHash: originalRecord.currentHash,
      verificationResult: verificationOnTamperedCopy,
      tamperDetectedSuccessfully: !verificationOnTamperedCopy.isValid,
      explanation: 'Notice how the cryptographic hash of block #' + idx + ' instantly failed verification. Because SHA-256 is an avalanche function, changing even one cent or 0.1 kWh completely alters the hash digest, alerting the marketplace auditor.'
    };
  }

  /**
   * Generates standard RFC 4180 CSV export string containing all ledger records.
   */
  toCSV() {
    const headers = [
      'Block Index',
      'Transaction ID',
      'Timestamp',
      'Simulation Run',
      'Simulation Hour',
      'Seller ID',
      'Seller Name',
      'Buyer ID',
      'Buyer Name',
      'Energy Traded (kWh)',
      'Seller Ask Price (INR/kWh)',
      'Buyer Bid Price (INR/kWh)',
      'Agreed Clearing Price (INR/kWh)',
      'Total Transaction Value (INR)',
      'Grid Benchmark Tariff (INR/kWh)',
      'Buyer Savings Per Unit (INR/kWh)',
      'Buyer Total Savings (INR)',
      'Seller Revenue (INR)',
      'Settlement Status',
      'Previous Hash',
      'Block Hash (SHA-256)',
      'Integrity Status',
      'Seller Zone',
      'Buyer Zone',
      'Cross-Zone',
      'Delivery Loss (kWh)',
      'Delivered Energy (kWh)',
      'Wheeling Fee (INR)',
      'Platform Fee (INR)'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = [headers.map(escapeCsv).join(',')];

    this.records.forEach(r => {
      const row = [
        r.index,
        r.transactionId,
        r.timestamp,
        r.simulationRunRef,
        r.simulationHour,
        r.sellerId,
        r.sellerName,
        r.buyerId,
        r.buyerName,
        Number(r.energyKWh || 0).toFixed(2),
        Number(r.sellerAsk || 0).toFixed(2),
        Number(r.buyerBid || 0).toFixed(2),
        Number(r.agreedPrice || 0).toFixed(2),
        Number(r.totalValue || 0).toFixed(2),
        Number(r.gridBenchmarkTariff || 8.00).toFixed(2),
        Number(r.buyerSavingsPerUnit || 0).toFixed(2),
        Number(r.buyerTotalSavings || 0).toFixed(2),
        Number(r.sellerRevenue || 0).toFixed(2),
        r.settlementStatus || 'SETTLED',
        r.previousHash,
        r.currentHash,
        r.verificationStatus || 'VALID',
        r.sellerZone || 'ZONE-A',
        r.buyerZone || 'ZONE-A',
        r.isCrossZone ? 'TRUE' : 'FALSE',
        Number(r.lossKWh || 0).toFixed(2),
        Number(r.deliveredEnergyKWh !== undefined ? r.deliveredEnergyKWh : r.energyKWh || 0).toFixed(2),
        Number(r.wheelingFeeINR || 0).toFixed(2),
        Number(r.platformFeeINR || 0).toFixed(2)
      ];
      rows.push(row.map(escapeCsv).join(','));
    });

    return rows.join('\r\n');
  }

  /**
   * Clears in-memory ledger and resets file.
   */
  reset() {
    this.records = [];
    this.saveToDisk();
  }
}

module.exports = {
  TamperLedger
};
