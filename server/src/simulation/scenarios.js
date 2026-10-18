/**
 * SolarShare - Scenario Definitions for Weather & Grid Contingency Simulation
 * 
 * Supports UN SDG 7: Affordable and Clean Energy.
 * Provides deterministic simulation scenarios:
 * 1. SUNNY_DAY (Baseline): 95% solar yield, normal household demand, all grid routes operational.
 * 2. MONSOON_OVERCAST: 30% solar yield, normal demand, reduced solar generation.
 * 3. HEATWAVE_PEAK: 95% solar yield, 40% surge in household demand.
 * 4. ROUTE_FAILURE: Substation intertie ROUTE-A-B disconnected; cross-zone transfers blocked.
 */

const SCENARIOS = {
  SUNNY_DAY: {
    key: 'SUNNY_DAY',
    name: 'Sunny Day (Baseline)',
    shortName: 'Sunny Day',
    badge: '95% Solar Yield • Normal Load',
    weatherLabel: 'Sunny / High Yield (95%)',
    weatherFactor: 0.95,
    demandMultiplier: 1.0,
    routeFailure: null,
    isContingency: false,
    description: 'Optimal daytime conditions with 95% solar yield, normal household consumption profiles, and all grid network routes operational.'
  },
  MONSOON_OVERCAST: {
    key: 'MONSOON_OVERCAST',
    name: 'Monsoon Overcast',
    shortName: 'Monsoon Overcast',
    badge: '30% Solar Yield • Heavy Cloud Cover',
    weatherLabel: 'Monsoon Overcast / Low Yield (30%)',
    weatherFactor: 0.30,
    demandMultiplier: 1.0,
    routeFailure: null,
    isContingency: true,
    description: 'Heavy monsoon cloud cover reducing solar generation to 30% yield across prosumers, tightening local energy supply while household demand remains normal.'
  },
  HEATWAVE_PEAK: {
    key: 'HEATWAVE_PEAK',
    name: 'Heatwave Peak Load',
    shortName: 'Heatwave Peak',
    badge: '95% Solar Yield • +40% Demand Surge',
    weatherLabel: 'Heatwave Peak / High Yield (95%)',
    weatherFactor: 0.95,
    demandMultiplier: 1.40,
    routeFailure: null,
    isContingency: true,
    description: 'Summer heatwave driving high air-conditioning loads resulting in a 40% increase in household demand across all participants, under sunny 95% generation.'
  },
  ROUTE_FAILURE: {
    key: 'ROUTE_FAILURE',
    name: 'Substation Route Failure',
    shortName: 'Route Failure',
    badge: 'Route A-B Disconnected',
    weatherLabel: 'Sunny / Route A-B Down',
    weatherFactor: 0.95,
    demandMultiplier: 1.0,
    routeFailure: 'ROUTE-A-B',
    isContingency: true,
    description: 'Substation route failure on intertie ROUTE-A-B (North-to-Central), disconnecting Zone A and Zone B and rejecting cross-zone transfers while intra-zone trading continues.'
  }
};

module.exports = {
  SCENARIOS
};
