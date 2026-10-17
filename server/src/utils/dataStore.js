/**
 * SolarShare - Centralized JSON Storage Layer
 * Manages persistent local JSON records using Node.js fs module.
 * Strictly avoids external databases; enforces atomic and safe read/write operations.
 * Automatically synchronizes between server/data and backend/data.
 */

const fs = require('fs');
const path = require('path');
const { initDatasets } = require('../simulation/dataGenerator');

const PRIMARY_DATA_DIR = path.resolve(__dirname, '../../../server/data');
const BACKEND_DATA_DIR = path.resolve(__dirname, '../../../backend/data');
const DATA_DIRS = [PRIMARY_DATA_DIR, BACKEND_DATA_DIR];

class DataStore {
  constructor() {
    this.ensureInitialized();
  }

  ensureInitialized() {
    DATA_DIRS.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Check if core files exist; if not, initialize deterministic datasets
    const sampleFile = path.join(PRIMARY_DATA_DIR, 'households.json');
    if (!fs.existsSync(sampleFile)) {
      initDatasets(DATA_DIRS);
    }
  }

  readJson(filename, defaultValue = null) {
    for (const dir of DATA_DIRS) {
      const filePath = path.join(dir, filename);
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf8');
          return JSON.parse(raw);
        } catch (err) {
          console.warn(`[DataStore] Failed reading ${filePath}: ${err.message}. Trying next.`);
        }
      }
    }
    return defaultValue;
  }

  writeJson(filename, data) {
    const serialized = JSON.stringify(data, null, 2);
    DATA_DIRS.forEach(dir => {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const filePath = path.join(dir, filename);
        // Write to temporary file then rename for atomic persistence
        const tempPath = `${filePath}.tmp.${Date.now()}`;
        fs.writeFileSync(tempPath, serialized, 'utf8');
        fs.renameSync(tempPath, filePath);
      } catch (err) {
        console.error(`[DataStore] Error persisting ${filename} to ${dir}:`, err.message);
      }
    });
  }

  getConfig() {
    return this.readJson('config.json', {
      referenceImportTariff: 8,
      referenceExportTariff: 2,
      minimumTradePrice: 2,
      maximumTradePrice: 8,
      platformFeePerKWh: 0.2,
      platformFeePayer: "buyer",
      dynamicPricingEnabled: true,
      defaultTradingIntervalMinutes: 60,
      gridEmissionFactorKgPerKWh: 0.82,
      dailyOperatingCost: 100,
      paymentProcessingCostPerKWh: 0.02,
      maintenanceCostPerKWh: 0.03
    });
  }

  saveConfig(config) {
    this.writeJson('config.json', config);
  }

  getHouseholds() {
    return this.readJson('households.json', []);
  }

  saveHouseholds(households) {
    this.writeJson('households.json', households);
  }

  getReadings() {
    return this.readJson('readings.json', []);
  }

  saveReadings(readings) {
    this.writeJson('readings.json', readings);
  }

  getTrades() {
    return this.readJson('trades.json', []);
  }

  saveTrades(trades) {
    this.writeJson('trades.json', trades);
  }

  getLedger() {
    return this.readJson('ledger.json', []);
  }

  saveLedger(ledger) {
    this.writeJson('ledger.json', ledger);
  }

  getCompanyFinance() {
    return this.readJson('company_finance.json', {
      totalEnergyTradedKWh: 0.0,
      transactionFeesCollectedINR: 0.0,
      totalCompanyRevenueINR: 0.0,
      dailyOperatingCostINR: 100.0,
      variableOperatingCostsINR: 0.0,
      totalOperatingCostINR: 100.0,
      estimatedProfitLossINR: -100.0,
      isProfitable: false,
      sellerGrossEarningsINR: 0.0,
      buyerGrossEnergyCostINR: 0.0,
      buyerPlatformFeesINR: 0.0,
      buyerTotalCostINR: 0.0,
      calculations: {}
    });
  }

  saveCompanyFinance(finance) {
    this.writeJson('company_finance.json', finance);
  }
}

const dataStore = new DataStore();

module.exports = {
  DataStore,
  dataStore
};
