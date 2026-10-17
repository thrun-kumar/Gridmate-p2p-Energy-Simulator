/**
 * SolarShare - Deterministic Dataset Generator
 * Generates synthetic households, 24-hour generation & consumption readings,
 * system configuration, and financial data structures compliant with SDG 7.
 */

const fs = require('fs');
const path = require('path');
const { sha256 } = require('../utils/cryptoHelper');

const CONFIG_DATA = {
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
  maintenanceCostPerKWh: 0.03,
  gridConnectedTrading: true,
  intraZoneLossPercent: 1.5,
  interZoneLossPercent: 3.5,
  intraZoneWheelingRateINR: 0.10,
  interZoneWheelingRateINR: 0.25
};

const HOUSEHOLDS = [
  {
    id: "HH-01",
    name: "Green Meadows Villa",
    solarCapacityKW: 10.0,
    role: "prosumer",
    participantType: "PROSUMER",
    zone: "ZONE-A",
    gridConnectionStatus: "CONNECTED",
    exportCapacityKW: 10.0,
    importCapacityKW: 5.0,
    autoTradeEnabled: false,
    minimumAcceptedPrice: null,
    maximumAcceptedPrice: null,
    walletBalance: 5000.0,
    createdAt: "2026-10-14T00:00:00.000Z",
    description: "Eco-villa with 10.0 kW rooftop solar generating reliable clean energy surplus.",
    baseDemandProfile: [0.6, 0.5, 0.4, 0.4, 0.5, 0.8, 1.4, 2.0, 1.8, 1.2, 1.0, 0.9, 0.9, 1.0, 1.1, 1.3, 1.8, 2.4, 3.0, 2.8, 2.2, 1.6, 1.1, 0.8]
  },
  {
    id: "HH-02",
    name: "Apex Tech Park",
    solarCapacityKW: 0.0,
    role: "consumer",
    participantType: "CONSUMER",
    zone: "ZONE-B",
    gridConnectionStatus: "CONNECTED",
    exportCapacityKW: 0.0,
    importCapacityKW: 15.0,
    autoTradeEnabled: true,
    minimumAcceptedPrice: null,
    maximumAcceptedPrice: null,
    walletBalance: 15000.0,
    createdAt: "2026-10-14T00:00:00.000Z",
    description: "Commercial technology park with high daytime continuous energy deficit seeking clean peer power.",
    baseDemandProfile: [1.2, 1.0, 1.0, 1.0, 1.2, 1.8, 3.5, 6.2, 8.0, 8.5, 8.4, 8.2, 7.8, 8.0, 8.2, 8.0, 7.2, 5.5, 3.8, 2.5, 2.0, 1.8, 1.5, 1.3]
  },
  {
    id: "HH-03",
    name: "Sunshine Heights",
    solarCapacityKW: 8.0,
    role: "prosumer",
    participantType: "PROSUMER",
    zone: "ZONE-A",
    gridConnectionStatus: "CONNECTED",
    exportCapacityKW: 8.0,
    importCapacityKW: 6.0,
    autoTradeEnabled: true,
    minimumAcceptedPrice: null,
    maximumAcceptedPrice: null,
    walletBalance: 4200.0,
    createdAt: "2026-10-14T00:00:00.000Z",
    description: "Residential community clubhouse equipped with 8.0 kW high-yield solar installation.",
    baseDemandProfile: [0.8, 0.6, 0.5, 0.5, 0.6, 1.0, 1.8, 2.2, 2.0, 1.5, 1.2, 1.1, 1.1, 1.2, 1.3, 1.6, 2.1, 2.8, 3.2, 3.0, 2.5, 1.9, 1.4, 1.0]
  },
  {
    id: "HH-04",
    name: "Riverdale Residential",
    solarCapacityKW: 0.0,
    role: "consumer",
    participantType: "CONSUMER",
    zone: "ZONE-C",
    gridConnectionStatus: "CONNECTED",
    exportCapacityKW: 0.0,
    importCapacityKW: 5.0,
    autoTradeEnabled: true,
    minimumAcceptedPrice: null,
    maximumAcceptedPrice: null,
    walletBalance: 3500.0,
    createdAt: "2026-10-14T00:00:00.000Z",
    description: "Apartment residence without rooftop solar access, relying on peer solar energy.",
    baseDemandProfile: [0.5, 0.4, 0.4, 0.4, 0.5, 0.7, 1.2, 1.6, 1.4, 1.0, 0.9, 0.8, 0.8, 0.9, 1.0, 1.2, 1.5, 2.0, 2.5, 2.4, 2.0, 1.5, 1.0, 0.7]
  },
  {
    id: "HH-05",
    name: "Banyan Grove Home",
    solarCapacityKW: 0.0,
    role: "consumer",
    participantType: "CONSUMER",
    zone: "ZONE-C",
    gridConnectionStatus: "CONNECTED",
    exportCapacityKW: 0.0,
    importCapacityKW: 5.0,
    autoTradeEnabled: true,
    minimumAcceptedPrice: null,
    maximumAcceptedPrice: null,
    walletBalance: 4000.0,
    createdAt: "2026-10-14T00:00:00.000Z",
    description: "Large family home purchasing clean peer solar to reduce standard retail discom bills.",
    baseDemandProfile: [0.6, 0.5, 0.4, 0.4, 0.5, 0.9, 1.5, 1.9, 1.6, 1.2, 1.0, 0.9, 0.9, 1.0, 1.1, 1.3, 1.7, 2.3, 2.8, 2.6, 2.2, 1.6, 1.1, 0.8]
  },
  {
    id: "HH-06",
    name: "Pinnacle Duplex",
    solarCapacityKW: 6.0,
    role: "prosumer",
    participantType: "PROSUMER",
    zone: "ZONE-C",
    gridConnectionStatus: "CONNECTED",
    exportCapacityKW: 6.0,
    importCapacityKW: 5.0,
    autoTradeEnabled: true,
    minimumAcceptedPrice: null,
    maximumAcceptedPrice: null,
    walletBalance: 3800.0,
    createdAt: "2026-10-14T00:00:00.000Z",
    description: "Residential duplex with 6.0 kW solar array generating reliable surplus.",
    baseDemandProfile: [0.5, 0.4, 0.4, 0.3, 0.4, 0.7, 1.3, 1.8, 1.5, 1.1, 0.9, 0.8, 0.8, 0.9, 1.0, 1.2, 1.6, 2.1, 2.6, 2.4, 1.9, 1.4, 0.9, 0.6]
  },
  {
    id: "HH-07",
    name: "Metro St. Jude Clinic",
    solarCapacityKW: 0.0,
    role: "consumer",
    participantType: "CONSUMER",
    zone: "ZONE-B",
    gridConnectionStatus: "CONNECTED",
    exportCapacityKW: 0.0,
    importCapacityKW: 10.0,
    autoTradeEnabled: true,
    minimumAcceptedPrice: null,
    maximumAcceptedPrice: null,
    walletBalance: 9000.0,
    createdAt: "2026-10-14T00:00:00.000Z",
    description: "Healthcare clinic with continuous daytime and evening medical load, purchasing green power.",
    baseDemandProfile: [1.5, 1.4, 1.4, 1.4, 1.5, 1.8, 2.5, 3.5, 4.2, 4.5, 4.6, 4.5, 4.4, 4.5, 4.6, 4.5, 4.2, 3.8, 3.2, 2.8, 2.5, 2.2, 1.8, 1.6]
  },
  {
    id: "HH-08",
    name: "EcoVibe Smart Residency",
    solarCapacityKW: 4.0,
    role: "prosumer",
    participantType: "PROSUMER",
    zone: "ZONE-A",
    gridConnectionStatus: "CONNECTED",
    exportCapacityKW: 4.0,
    importCapacityKW: 5.0,
    autoTradeEnabled: true,
    minimumAcceptedPrice: null,
    maximumAcceptedPrice: null,
    walletBalance: 3200.0,
    createdAt: "2026-10-14T00:00:00.000Z",
    description: "Smart residential prosumer with 4.0 kW solar capacity and automated load management.",
    baseDemandProfile: [0.4, 0.3, 0.3, 0.3, 0.4, 0.6, 1.1, 1.5, 1.3, 0.9, 0.8, 0.7, 0.7, 0.8, 0.9, 1.0, 1.3, 1.8, 2.2, 2.0, 1.7, 1.2, 0.8, 0.5]
  },
  {
    id: "HH-09",
    name: "Lotus Garden Homes",
    solarCapacityKW: 5.0,
    role: "prosumer",
    participantType: "PROSUMER",
    zone: "ZONE-A",
    gridConnectionStatus: "CONNECTED",
    exportCapacityKW: 5.0,
    importCapacityKW: 5.0,
    autoTradeEnabled: true,
    minimumAcceptedPrice: null,
    maximumAcceptedPrice: null,
    walletBalance: 3600.0,
    createdAt: "2026-10-14T00:00:00.000Z",
    description: "Townhouse cluster with 5.0 kW solar capacity exporting midday surplus into the local grid.",
    baseDemandProfile: [0.5, 0.4, 0.3, 0.3, 0.4, 0.7, 1.2, 1.6, 1.4, 1.0, 0.8, 0.8, 0.8, 0.9, 1.0, 1.2, 1.5, 2.0, 2.5, 2.3, 1.8, 1.3, 0.8, 0.6]
  },
  {
    id: "HH-10",
    name: "Central Market Complex",
    solarCapacityKW: 4.0,
    role: "mixed",
    participantType: "COMMERCIAL_MIXED",
    zone: "ZONE-B",
    gridConnectionStatus: "CONNECTED",
    exportCapacityKW: 4.0,
    importCapacityKW: 12.0,
    autoTradeEnabled: true,
    minimumAcceptedPrice: null,
    maximumAcceptedPrice: null,
    walletBalance: 12000.0,
    createdAt: "2026-10-14T00:00:00.000Z",
    description: "Mixed-use commercial and community retail centre with 4.0 kW solar installation and high daytime commercial demand.",
    baseDemandProfile: [1.5, 1.2, 1.0, 1.0, 1.2, 1.8, 3.2, 5.5, 7.2, 7.8, 8.0, 8.2, 8.0, 8.1, 8.2, 7.9, 7.0, 5.8, 4.2, 3.0, 2.4, 2.0, 1.8, 1.5]
  },
  {
    id: "HH-11",
    name: "Sunrise Apartments",
    solarCapacityKW: 12.0,
    role: "prosumer",
    participantType: "PROSUMER",
    zone: "ZONE-A",
    gridConnectionStatus: "CONNECTED",
    exportCapacityKW: 12.0,
    importCapacityKW: 8.0,
    autoTradeEnabled: true,
    minimumAcceptedPrice: null,
    maximumAcceptedPrice: null,
    walletBalance: 6500.0,
    createdAt: "2026-10-14T00:00:00.000Z",
    description: "Multi-tenant residential complex with high-yield 12.0 kW rooftop community solar.",
    baseDemandProfile: [0.9, 0.7, 0.6, 0.6, 0.7, 1.2, 2.0, 2.6, 2.3, 1.8, 1.5, 1.4, 1.4, 1.5, 1.6, 2.0, 2.6, 3.4, 4.2, 3.8, 3.0, 2.2, 1.6, 1.1]
  },
  {
    id: "HH-12",
    name: "Community Learning Centre",
    solarCapacityKW: 0.0,
    role: "consumer",
    participantType: "CONSUMER",
    zone: "ZONE-B",
    gridConnectionStatus: "CONNECTED",
    exportCapacityKW: 0.0,
    importCapacityKW: 8.0,
    autoTradeEnabled: true,
    minimumAcceptedPrice: null,
    maximumAcceptedPrice: null,
    walletBalance: 4500.0,
    createdAt: "2026-10-14T00:00:00.000Z",
    description: "Public educational centre with daytime computer labs and classrooms, seeking low-cost clean power.",
    baseDemandProfile: [0.8, 0.6, 0.5, 0.5, 0.6, 0.8, 1.5, 3.2, 4.8, 5.2, 5.4, 5.5, 5.2, 5.3, 5.4, 5.0, 4.0, 2.8, 1.8, 1.4, 1.2, 1.0, 0.9, 0.8]
  }
];

/**
 * Calculates hourly solar generation according to the formula:
 * G(h) = C_solar * max(0, sin((h - 6) * PI / 12))^1.5 * W
 */
function calculateSolarGeneration(capacityKW, hour, weatherFactor = 0.95) {
  if (capacityKW <= 0 || hour < 6 || hour > 18) {
    return 0;
  }
  const sinArg = ((hour - 6) * Math.PI) / 12;
  const sinVal = Math.sin(sinArg);
  if (sinVal <= 0) return 0;
  const insolation = Math.pow(sinVal, 1.5);
  return Number((capacityKW * insolation * weatherFactor).toFixed(2));
}

/**
 * Generates 24-hour readings dataset.
 */
function generateReadings() {
  const readings = [];
  const baseDate = "2026-10-14";
  const weatherFactors = [
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0,       // 00-05 Night
    0.92, 0.94, 0.96, 0.97, 0.98, 0.98, // 06-11 Morning
    0.99, 0.98, 0.97, 0.95, 0.93, 0.90, // 12-17 Afternoon
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0        // 18-23 Evening
  ];

  for (let h = 0; h < 24; h++) {
    const hourStr = String(h).padStart(2, '0');
    const timestamp = `${baseDate}T${hourStr}:00:00.000Z`;
    const weatherFactor = weatherFactors[h];

    const householdReadings = HOUSEHOLDS.map(hh => {
      const generatedKWh = calculateSolarGeneration(hh.solarCapacityKW, h, weatherFactor);
      const consumedKWh = Number(hh.baseDemandProfile[h].toFixed(2));
      const netEnergy = Number((generatedKWh - consumedKWh).toFixed(2));
      const surplusKWh = Number(Math.max(0, netEnergy).toFixed(2));
      const deficitKWh = Number(Math.max(0, -netEnergy).toFixed(2));

      return {
        householdId: hh.id,
        generatedKWh,
        consumedKWh,
        surplusKWh,
        deficitKWh
      };
    });

    readings.push({
      timestamp,
      hour: h,
      weatherFactor,
      householdReadings
    });
  }

  return readings;
}

/**
 * Generates Genesis Block for audit ledger.
 */
function createGenesisLedger() {
  const genesisTimestamp = "2026-10-14T00:00:00.000Z";
  const previousHash = "0000000000000000000000000000000000000000000000000000000000000000";
  const trades = [];
  const hash = sha256(`0${genesisTimestamp}${JSON.stringify(trades)}${previousHash}`);

  return [
    {
      index: 0,
      timestamp: genesisTimestamp,
      trades,
      previousHash,
      hash,
      description: "SolarShare Genesis Block - SDG 7 Cryptographic Audit Ledger Anchor"
    }
  ];
}

/**
 * Generates initial company finance structure.
 */
function createInitialCompanyFinance() {
  return {
    totalEnergyTradedKWh: 0.0,
    transactionFeesCollectedINR: 0.0,
    totalCompanyRevenueINR: 0.0,
    dailyOperatingCostINR: CONFIG_DATA.dailyOperatingCost,
    variableOperatingCostsINR: 0.0,
    totalOperatingCostINR: CONFIG_DATA.dailyOperatingCost,
    estimatedProfitLossINR: -CONFIG_DATA.dailyOperatingCost,
    isProfitable: false,
    sellerGrossEarningsINR: 0.0,
    buyerGrossEnergyCostINR: 0.0,
    buyerPlatformFeesINR: 0.0,
    buyerTotalCostINR: 0.0,
    calculations: {
      platformFeeFormula: "tradedKWh * platformFeePerKWh (₹0.20/kWh)",
      operatingCostFormula: "dailyOperatingCost (₹100) + tradedKWh * (processingFee ₹0.02 + maintenanceFee ₹0.03)",
      profitFormula: "totalCompanyRevenue - totalOperatingCost"
    },
    updatedAt: new Date().toISOString()
  };
}

/**
 * Saves all generated datasets into target directories.
 */
function initDatasets(targetDirs = []) {
  const readings = generateReadings();
  const cleanedHouseholds = HOUSEHOLDS.map(({ baseDemandProfile, ...rest }) => rest);
  const genesisLedger = createGenesisLedger();
  const initialFinance = createInitialCompanyFinance();
  const initialTrades = [];

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(CONFIG_DATA, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'households.json'), JSON.stringify(cleanedHouseholds, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'readings.json'), JSON.stringify(readings, null, 2), 'utf8');
    
    // Only write trades, ledger, finance if not already existing
    const tradesPath = path.join(dir, 'trades.json');
    if (!fs.existsSync(tradesPath)) {
      fs.writeFileSync(tradesPath, JSON.stringify(initialTrades, null, 2), 'utf8');
    }

    const ledgerPath = path.join(dir, 'ledger.json');
    if (!fs.existsSync(ledgerPath)) {
      fs.writeFileSync(ledgerPath, JSON.stringify(genesisLedger, null, 2), 'utf8');
    }

    const financePath = path.join(dir, 'company_finance.json');
    if (!fs.existsSync(financePath)) {
      fs.writeFileSync(financePath, JSON.stringify(initialFinance, null, 2), 'utf8');
    }
  }

  console.log(`[DatasetGenerator] Initialized datasets across ${targetDirs.length} target directories.`);
}

module.exports = {
  CONFIG_DATA,
  HOUSEHOLDS,
  calculateSolarGeneration,
  generateReadings,
  createGenesisLedger,
  createInitialCompanyFinance,
  initDatasets
};
