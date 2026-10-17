/**
 * SolarShare - Regulation-Aware Dynamic Pricing Engine
 * 
 * Computes transparent, auditable price recommendations based on:
 * - Live simulated date, time, and season
 * - Live microgrid surplus and demand pressure
 * - Configurable time-of-day and seasonal profiles
 * - Price change rate-of-change smoothing limits
 * - Strict clamping within active regulatory pricing rules (₹2.00 - ₹8.00)
 * 
 * Supports both:
 * A. Live Clock Mode (real-time elapsed simulation)
 * B. Demo Simulation Mode (operator advances hour by hour)
 */

const { pricingRuleService } = require('../services/pricingRuleService');
const { dataStore } = require('../utils/dataStore');

// Configurable Seasonal Solar Availability Profiles
const SEASONAL_PROFILES = {
  SUMMER: {
    name: 'Summer (High Solar)',
    months: [3, 4, 5], // March, April, May
    solarIrradianceMultiplier: 1.15,
    seasonalPriceAdjustmentINR: -0.25, // Abundant solar surplus drives price down
    description: 'High solar insolation, long daylight hours, peak rooftop export yield'
  },
  MONSOON: {
    name: 'Southwest / Northeast Monsoon',
    months: [6, 7, 8, 9, 10], // June through October
    solarIrradianceMultiplier: 0.75,
    seasonalPriceAdjustmentINR: +0.35, // Cloud cover reduces clean generation; scarcity premium
    description: 'Cloud cover, intermittent rain, reduced solar output, elevated grid reliance'
  },
  POST_MONSOON: {
    name: 'Post-Monsoon',
    months: [11], // November
    solarIrradianceMultiplier: 0.90,
    seasonalPriceAdjustmentINR: -0.05,
    description: 'Moderate clearness index with gradual solar recovery'
  },
  WINTER: {
    name: 'Winter',
    months: [12, 1, 2], // December, January, February
    solarIrradianceMultiplier: 0.95,
    seasonalPriceAdjustmentINR: +0.10,
    description: 'Mild ambient temperature, crisp mornings, standard midday insolation'
  }
};

// Hourly Time-of-Day Adjustment Profile (in INR/kWh)
const TIME_OF_DAY_ADJUSTMENTS = {
  0: 0.00,  1: 0.00,  2: 0.00,  3: 0.00,  4: 0.00,  5: 0.00,
  6: +0.05, 7: +0.10, 8: +0.15, 9: 0.00,
  10: -0.15, // Solar ramping up
  11: -0.35, // High solar generation
  12: -0.50, // Peak midday surplus incentive discount
  13: -0.40, // Peak midday surplus
  14: -0.25, // Afternoon solar
  15: -0.10,
  16: +0.05,
  17: +0.20, // Sunset, solar drops to 0
  18: +0.55, // Evening residential peak demand scarcity
  19: +0.65, // Peak evening deficit
  20: +0.50, // Peak evening deficit
  21: +0.30,
  22: +0.10,
  23: 0.00
};

// In-memory price history for smoothing and change tracking
let previousRecordedPrice = 5.00;
let currentClockMode = 'DEMO'; // 'DEMO' or 'LIVE'

function getSeasonFromDate(dateObj) {
  const month = (dateObj instanceof Date ? dateObj : new Date()).getMonth() + 1;
  for (const [key, profile] of Object.entries(SEASONAL_PROFILES)) {
    if (profile.months.includes(month)) return key;
  }
  return 'SUMMER';
}

/**
 * Computes demand pressure: deficit / (deficit + surplus)
 */
function computeDemandPressure(deficitKWh, surplusKWh) {
  const surplus = Math.max(0, Number(surplusKWh) || 0);
  const deficit = Math.max(0, Number(deficitKWh) || 0);
  const total = surplus + deficit;
  if (total <= 0.0001) return 0.5;
  return Number((deficit / total).toFixed(3));
}

/**
 * Calculates the fair, regulation-validated recommended market price.
 * 
 * Formula:
 * Recommended price = clamp(
 *    Base price
 *    + Demand adjustment
 *    + Time-of-day adjustment
 *    + Seasonal adjustment,
 *    Permitted minimum,
 *    Permitted maximum
 * )
 * 
 * @param {number} totalSurplusKWh - Total solar surplus offered by sellers
 * @param {number} totalDeficitKWh - Total eligible energy demand needed by buyers
 * @param {Object} options - Calculation options (hour, date, season, previousPrice, rule)
 */
function calculateRecommendedPrice(totalSurplusKWh, totalDeficitKWh, options = {}) {
  const activeRule = options.overrideRule || pricingRuleService.getActiveRule();
  const minPrice = Number(activeRule.minimumPermittedPriceINR || 2.00);
  const maxPrice = Number(activeRule.maximumPermittedPriceINR || 8.00);
  const basePrice = Number(((minPrice + maxPrice) / 2).toFixed(2)); // Midpoint benchmark ₹5.00

  const surplus = Math.max(0, Number(totalSurplusKWh) || 0);
  const deficit = Math.max(0, Number(totalDeficitKWh) || 0);

  // Parse simulated time & season
  const hour = options.currentHour !== undefined ? options.currentHour : (new Date().getHours());
  const simDate = options.simulatedDateTime ? new Date(options.simulatedDateTime) : new Date();
  const season = (options.season || getSeasonFromDate(simDate)).toUpperCase();
  const seasonProfile = SEASONAL_PROFILES[season] || SEASONAL_PROFILES.SUMMER;

  // Zero supply & zero demand edge condition
  if (surplus <= 0.0001 && deficit <= 0.0001) {
    return {
      recommendedPriceINR: null,
      rawSuggestedPriceINR: null,
      basePriceINR: basePrice,
      demandPressure: null,
      demandAdjustmentINR: 0.00,
      timeOfDayAdjustmentINR: 0.00,
      seasonalAdjustmentINR: 0.00,
      totalSurplusKWh: 0.0,
      totalDeficitKWh: 0.0,
      season,
      seasonName: seasonProfile.name,
      currentHour: hour,
      clockMode: currentClockMode,
      marketStatus: 'INACTIVE',
      statusLabel: 'No Active Supply or Demand',
      explanation: 'No active seller surplus or buyer demand reported in this interval. Baseline benchmark price applied.',
      priceLimits: { minPrice, maxPrice },
      ruleId: activeRule.ruleId,
      ruleVersion: activeRule.version,
      ruleSource: activeRule.ruleSource,
      disclaimer: activeRule.disclaimer,
      timestamp: simDate.toISOString()
    };
  }

  // 1. Demand Pressure Adjustment
  const demandPressure = computeDemandPressure(deficit, surplus);
  // Ranges from -₹1.50 (100% surplus) to +₹1.50 (100% deficit)
  const demandAdjustment = Number(((demandPressure - 0.5) * 3.00).toFixed(2));

  // 2. Time-of-Day Adjustment
  const timeAdjustment = Number((TIME_OF_DAY_ADJUSTMENTS[hour] || 0.00).toFixed(2));

  // 3. Seasonal Adjustment
  const seasonAdjustment = Number((seasonProfile.seasonalPriceAdjustmentINR || 0.00).toFixed(2));

  // Raw suggested price
  const rawSuggestedPrice = Number((basePrice + demandAdjustment + timeAdjustment + seasonAdjustment).toFixed(2));

  // 4. Price Smoothing / Rate-of-Change Clamping (Max ±₹1.20/hour)
  let smoothedPrice = rawSuggestedPrice;
  const previousPrice = options.previousPriceINR !== undefined ? Number(options.previousPriceINR) : previousRecordedPrice;
  let smoothingApplied = false;

  const maxAllowedStepChange = Number(options.maxHourlyChangeINR || 1.20);
  if (previousPrice !== null && !isNaN(previousPrice) && previousPrice > 0) {
    const delta = rawSuggestedPrice - previousPrice;
    if (Math.abs(delta) > maxAllowedStepChange) {
      smoothedPrice = Number((previousPrice + (delta > 0 ? maxAllowedStepChange : -maxAllowedStepChange)).toFixed(2));
      smoothingApplied = true;
    }
  }

  // 5. Strict Clamping within Active Pricing Rule
  const clampedPrice = Math.max(minPrice, Math.min(maxPrice, smoothedPrice));
  const finalPrice = Number(clampedPrice.toFixed(2));

  // Update in-memory tracker
  previousRecordedPrice = finalPrice;

  // Percentage change
  let priceChangePercentage = 0;
  if (previousPrice > 0) {
    priceChangePercentage = Number((((finalPrice - previousPrice) / previousPrice) * 100).toFixed(1));
  }

  // Market status classification
  let marketStatus = 'BALANCED';
  let statusLabel = 'Balanced Clean Energy Market';
  let explanation = '';

  if (demandPressure < 0.35) {
    marketStatus = 'SURPLUS';
    statusLabel = 'Abundant Solar Surplus';
    explanation = `Price decreased to ₹${finalPrice.toFixed(2)}/kWh because local solar generation (${surplus.toFixed(1)} kWh) exceeds consumer demand (${deficit.toFixed(1)} kWh). Clean energy is discounted to incentivize immediate local absorption.`;
  } else if (demandPressure > 0.65) {
    marketStatus = 'DEFICIT';
    statusLabel = 'High Electricity Deficit';
    explanation = `Price increased to ₹${finalPrice.toFixed(2)}/kWh because consumer demand (${deficit.toFixed(1)} kWh) outpaces available clean surplus (${surplus.toFixed(1)} kWh). Price signals reward solar prosumers while remaining strictly below retail grid tariffs.`;
  } else {
    marketStatus = 'BALANCED';
    statusLabel = 'Balanced Microgrid';
    explanation = `Supply (${surplus.toFixed(1)} kWh) and demand (${deficit.toFixed(1)} kWh) are balanced. Fair price clears at ₹${finalPrice.toFixed(2)}/kWh, delivering mutual financial savings to both sellers and buyers.`;
  }

  if (smoothingApplied) {
    explanation += ` (Rate-of-change smoothing applied: jump capped to ±₹${maxAllowedStepChange.toFixed(2)}/h for price stability).`;
  }

  return {
    recommendedPriceINR: finalPrice,
    rawSuggestedPriceINR: rawSuggestedPrice,
    basePriceINR: basePrice,
    demandPressure: Number(demandPressure.toFixed(3)),
    demandAdjustmentINR: demandAdjustment,
    timeOfDayAdjustmentINR: timeAdjustment,
    seasonalAdjustmentINR: seasonAdjustment,
    totalSurplusKWh: Number(surplus.toFixed(2)),
    totalDeficitKWh: Number(deficit.toFixed(2)),
    netCommunityBalanceKWh: Number((surplus - deficit).toFixed(2)),
    season,
    seasonName: seasonProfile.name,
    currentHour: hour,
    clockMode: options.clockMode || currentClockMode,
    smoothingApplied,
    previousPriceINR: previousPrice,
    priceChangePercentage,
    priceExplanation: explanation,
    explanation,
    marketStatus,
    statusLabel,
    priceLimits: { minPrice, maxPrice },
    ruleId: activeRule.ruleId,
    ruleVersion: activeRule.version,
    ruleName: activeRule.name,
    ruleSource: activeRule.ruleSource,
    disclaimer: activeRule.disclaimer,
    timestamp: simDate.toISOString()
  };
}

function setClockMode(mode) {
  currentClockMode = mode === 'LIVE' ? 'LIVE' : 'DEMO';
  return currentClockMode;
}

function getClockMode() {
  return currentClockMode;
}

module.exports = {
  calculateRecommendedPrice,
  computeDemandPressure,
  SEASONAL_PROFILES,
  TIME_OF_DAY_ADJUSTMENTS,
  getSeasonFromDate,
  setClockMode,
  getClockMode
};
