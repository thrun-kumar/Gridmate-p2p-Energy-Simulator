/**
 * GRIDMATE - Settlement & Financial Calculation Service
 * 
 * Configurable demonstration economic baselines:
 * - Simulated Grid Import Retail Tariff: ₹8.00 / kWh
 * - Simulated Solar Feed-in Export Compensation: ₹2.00 / kWh
 * - Platform Clearing Fee: ₹0.10 / kWh (optional / transparent)
 * - Estimated Grid Emission Factor: 0.82 kg CO2e / kWh
 */

const CONFIG = {
  GRID_IMPORT_TARIFF_INR_PER_KWH: 8.00,
  EXPORT_COMPENSATION_INR_PER_KWH: 2.00,
  PLATFORM_FEE_INR_PER_KWH: 0.10,
  EMISSIONS_FACTOR_KG_PER_KWH: 0.82
};

/**
 * Calculates bilateral settlement metrics for a single matched trade.
 *
 * @param {Object} trade - Matched trade object
 * @returns {Object} Enriched settlement calculation
 */
function calculateTradeSettlement(trade) {
  const energyKWh = Number(trade.energyKWh.toFixed(2));
  const tradePrice = Number(trade.tradePriceINR.toFixed(2));
  
  // Total nominal transaction value
  const tradeValueINR = Number((energyKWh * tradePrice).toFixed(2));

  // Platform fee (transparent nominal fee)
  const platformFeeINR = Number((energyKWh * CONFIG.PLATFORM_FEE_INR_PER_KWH).toFixed(2));

  // Buyer calculations:
  // Buyer gross savings vs standard grid retail tariff (₹8.00/kWh)
  const buyerGridBaselineCostINR = Number((energyKWh * CONFIG.GRID_IMPORT_TARIFF_INR_PER_KWH).toFixed(2));
  const buyerPaymentINR = tradeValueINR;
  const buyerGrossSavingsINR = Number((buyerGridBaselineCostINR - buyerPaymentINR).toFixed(2));
  const buyerNetSavingsINR = Number((buyerGrossSavingsINR - platformFeeINR).toFixed(2));

  // Seller calculations:
  // Seller earnings vs standard discom feed-in export compensation (₹2.00/kWh)
  const sellerExportBaselineRevenueINR = Number((energyKWh * CONFIG.EXPORT_COMPENSATION_INR_PER_KWH).toFixed(2));
  const sellerEarningsINR = tradeValueINR;
  const sellerAdditionalEarningsINR = Number((sellerEarningsINR - sellerExportBaselineRevenueINR).toFixed(2));
  const sellerNetAdditionalEarningsINR = Number((sellerAdditionalEarningsINR - platformFeeINR).toFixed(2));

  // Environmental impact estimation
  const avoidedEmissionsKg = Number((energyKWh * CONFIG.EMISSIONS_FACTOR_KG_PER_KWH).toFixed(2));

  return {
    ...trade,
    tradeValueINR,
    platformFeeINR,
    buyerPaymentINR,
    sellerEarningsINR,
    buyerGridBaselineCostINR,
    buyerGrossSavingsINR,
    buyerNetSavingsINR,
    sellerExportBaselineRevenueINR,
    sellerAdditionalEarningsINR,
    sellerNetAdditionalEarningsINR,
    avoidedEmissionsKg,
    isBuyerFinanciallyBeneficial: buyerGrossSavingsINR > 0,
    isSellerFinanciallyBeneficial: sellerAdditionalEarningsINR > 0
  };
}

/**
 * Updates cumulative participant balances across all households.
 * 
 * @param {Array} households - Array of household state objects
 * @param {Array} settledTrades - Array of settled trades with settlement metrics
 */
function updateParticipantBalances(households, settledTrades) {
  const hhMap = new Map();
  households.forEach(h => hhMap.set(h.id, h));

  settledTrades.forEach(trade => {
    // Update Seller
    const seller = hhMap.get(trade.sellerId);
    if (seller) {
      seller.totalEnergySoldKWh = Number(((seller.totalEnergySoldKWh || 0) + trade.energyKWh).toFixed(2));
      seller.totalEarningsINR = Number(((seller.totalEarningsINR || 0) + trade.sellerEarningsINR).toFixed(2));
      seller.totalSellerAdditionalEarningsINR = Number(((seller.totalSellerAdditionalEarningsINR || 0) + trade.sellerAdditionalEarningsINR).toFixed(2));
      seller.totalTradesCount = (seller.totalTradesCount || 0) + 1;
    }

    // Update Buyer
    const buyer = hhMap.get(trade.buyerId);
    if (buyer) {
      buyer.totalEnergyBoughtKWh = Number(((buyer.totalEnergyBoughtKWh || 0) + trade.energyKWh).toFixed(2));
      buyer.totalExpenditureINR = Number(((buyer.totalExpenditureINR || 0) + trade.buyerPaymentINR).toFixed(2));
      buyer.totalBuyerSavingsINR = Number(((buyer.totalBuyerSavingsINR || 0) + trade.buyerGrossSavingsINR).toFixed(2));
      buyer.totalTradesCount = (buyer.totalTradesCount || 0) + 1;
    }
  });
}

module.exports = {
  CONFIG,
  calculateTradeSettlement,
  updateParticipantBalances
};
