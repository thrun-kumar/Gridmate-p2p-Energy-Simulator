/**
 * SolarShare - Grid Network Abstraction & Smart Metering Module
 * 
 * Supports multi-zone topology, route transfer capacity constraints,
 * modeled transmission delivery losses, wheeling/network transit charges,
 * and deterministic capacity allocation for Continuous Double Auction matching.
 * 
 * Strict SDG 7 Modeling Principles:
 * - Distinguishes commercial energy allocation contractually from physical electron flow.
 * - Explicitly marks smart meter records as SIMULATED.
 * - Accurately models transmission losses: Delivered = Injected * (1 - L).
 */

const DEFAULT_ZONES = {
  'ZONE-A': {
    id: 'ZONE-A',
    name: 'North Residential Substation',
    type: 'RESIDENTIAL',
    substationCapacityKW: 50.0,
    voltageLevelKV: 11.0,
    description: 'High-density residential neighborhood with distributed rooftop solar prosumers.'
  },
  'ZONE-B': {
    id: 'ZONE-B',
    name: 'Central Commercial Substation',
    type: 'COMMERCIAL',
    substationCapacityKW: 60.0,
    voltageLevelKV: 11.0,
    description: 'Commercial business district with tech parks, clinics, and offices with 0 kW solar.'
  },
  'ZONE-C': {
    id: 'ZONE-C',
    name: 'South Mixed Substation',
    type: 'MIXED',
    substationCapacityKW: 45.0,
    voltageLevelKV: 11.0,
    description: 'Mixed residential-light commercial zone with hybrid prosumers and standard consumers.'
  }
};

const DEFAULT_ROUTES = [
  // Intra-zone routes (same substation)
  {
    routeId: 'ROUTE-A-A',
    fromZone: 'ZONE-A',
    toZone: 'ZONE-A',
    status: 'CONNECTED',
    transferCapacityKWh: 100.0,
    utilizedCapacityKWh: 0.0,
    lossPercentage: 1.5,
    wheelingChargeINRPerKWh: 0.10,
    isCrossZone: false,
    description: 'Local North Substation feeder circuit'
  },
  {
    routeId: 'ROUTE-B-B',
    fromZone: 'ZONE-B',
    toZone: 'ZONE-B',
    status: 'CONNECTED',
    transferCapacityKWh: 100.0,
    utilizedCapacityKWh: 0.0,
    lossPercentage: 1.5,
    wheelingChargeINRPerKWh: 0.10,
    isCrossZone: false,
    description: 'Local Commercial Substation distribution ring'
  },
  {
    routeId: 'ROUTE-C-C',
    fromZone: 'ZONE-C',
    toZone: 'ZONE-C',
    status: 'CONNECTED',
    transferCapacityKWh: 100.0,
    utilizedCapacityKWh: 0.0,
    lossPercentage: 1.5,
    wheelingChargeINRPerKWh: 0.10,
    isCrossZone: false,
    description: 'Local South Mixed Substation feeder'
  },
  // Inter-zone interties (between substations)
  {
    routeId: 'ROUTE-A-B',
    fromZone: 'ZONE-A',
    toZone: 'ZONE-B',
    status: 'CONNECTED',
    transferCapacityKWh: 35.0,
    utilizedCapacityKWh: 0.0,
    lossPercentage: 3.5,
    wheelingChargeINRPerKWh: 0.25,
    isCrossZone: true,
    description: 'North-to-Central 11kV medium-voltage grid intertie'
  },
  {
    routeId: 'ROUTE-B-A',
    fromZone: 'ZONE-B',
    toZone: 'ZONE-A',
    status: 'CONNECTED',
    transferCapacityKWh: 35.0,
    utilizedCapacityKWh: 0.0,
    lossPercentage: 3.5,
    wheelingChargeINRPerKWh: 0.25,
    isCrossZone: true,
    description: 'Central-to-North 11kV medium-voltage grid intertie'
  },
  {
    routeId: 'ROUTE-B-C',
    fromZone: 'ZONE-B',
    toZone: 'ZONE-C',
    status: 'CONNECTED',
    transferCapacityKWh: 30.0,
    utilizedCapacityKWh: 0.0,
    lossPercentage: 4.0,
    wheelingChargeINRPerKWh: 0.30,
    isCrossZone: true,
    description: 'Central-to-South medium-voltage interconnect'
  },
  {
    routeId: 'ROUTE-C-B',
    fromZone: 'ZONE-C',
    toZone: 'ZONE-B',
    status: 'CONNECTED',
    transferCapacityKWh: 30.0,
    utilizedCapacityKWh: 0.0,
    lossPercentage: 4.0,
    wheelingChargeINRPerKWh: 0.30,
    isCrossZone: true,
    description: 'South-to-Central medium-voltage interconnect'
  },
  {
    routeId: 'ROUTE-A-C',
    fromZone: 'ZONE-A',
    toZone: 'ZONE-C',
    status: 'CONNECTED',
    transferCapacityKWh: 25.0,
    utilizedCapacityKWh: 0.0,
    lossPercentage: 5.0,
    wheelingChargeINRPerKWh: 0.40,
    isCrossZone: true,
    description: 'North-to-South sub-transmission trunk line (long distance)'
  },
  {
    routeId: 'ROUTE-C-A',
    fromZone: 'ZONE-C',
    toZone: 'ZONE-A',
    status: 'CONNECTED',
    transferCapacityKWh: 25.0,
    utilizedCapacityKWh: 0.0,
    lossPercentage: 5.0,
    wheelingChargeINRPerKWh: 0.40,
    isCrossZone: true,
    description: 'South-to-North sub-transmission trunk line (long distance)'
  }
];

class GridNetworkManager {
  constructor(customZones = null, customRoutes = null) {
    this.zones = customZones ? JSON.parse(JSON.stringify(customZones)) : JSON.parse(JSON.stringify(DEFAULT_ZONES));
    this.routes = customRoutes ? JSON.parse(JSON.stringify(customRoutes)) : JSON.parse(JSON.stringify(DEFAULT_ROUTES));
    this.meterRecords = [];
  }

  /**
   * Resets route utilization at the beginning of each simulation interval.
   */
  resetIntervalCapacity() {
    this.routes.forEach(r => {
      r.utilizedCapacityKWh = 0.0;
    });
  }

  /**
   * Returns a route configuration between two network zones.
   */
  getRoute(fromZone, toZone) {
    const origin = fromZone || 'ZONE-A';
    const dest = toZone || 'ZONE-A';
    let route = this.routes.find(r => r.fromZone === origin && r.toZone === dest);
    if (!route) {
      // Fallback symmetric lookup
      route = this.routes.find(r => 
        (r.fromZone === origin && r.toZone === dest) ||
        (r.fromZone === dest && r.toZone === origin)
      );
    }
    if (!route) {
      // Synthetic fallback disconnected route
      return {
        routeId: `ROUTE-${origin}-${dest}`,
        fromZone: origin,
        toZone: dest,
        status: 'DISCONNECTED',
        transferCapacityKWh: 0.0,
        utilizedCapacityKWh: 0.0,
        lossPercentage: 5.0,
        wheelingChargeINRPerKWh: 0.50,
        isCrossZone: origin !== dest,
        description: 'Unrouted grid path'
      };
    }
    return route;
  }

  /**
   * Evaluates if a trade between two zones can be accommodated given route status and remaining capacity.
   * 
   * @param {string} fromZone 
   * @param {string} toZone 
   * @param {number} requestedKWh 
   * @returns {Object} { allowed: boolean, maxAllowedKWh: number, reason: string|null, route: Object }
   */
  canAccommodate(fromZone, toZone, requestedKWh) {
    const route = this.getRoute(fromZone, toZone);
    if (!route || route.status !== 'CONNECTED') {
      return {
        allowed: false,
        maxAllowedKWh: 0,
        reason: 'ROUTE_DISCONNECTED',
        message: `Grid intertie between ${fromZone} and ${toZone} is currently DISCONNECTED or unavailable.`,
        route
      };
    }

    const remaining = Math.max(0, Number((route.transferCapacityKWh - (route.utilizedCapacityKWh || 0)).toFixed(2)));
    if (remaining <= 0.001) {
      return {
        allowed: false,
        maxAllowedKWh: 0,
        reason: 'ROUTE_CAPACITY_EXHAUSTED',
        message: `Transfer capacity of route ${route.routeId} (${route.transferCapacityKWh} kWh) is completely exhausted for this hour.`,
        route
      };
    }

    const allocatable = Math.min(Number(requestedKWh.toFixed(2)), remaining);
    return {
      allowed: true,
      maxAllowedKWh: allocatable,
      isPartial: allocatable < requestedKWh,
      remainingRouteCapacityKWh: remaining,
      route
    };
  }

  /**
   * Allocates transfer capacity across the relevant route upon trade matching.
   */
  allocateCapacity(fromZone, toZone, amountKWh) {
    const route = this.getRoute(fromZone, toZone);
    if (!route) return false;
    const addAmt = Number(amountKWh.toFixed(2));
    route.utilizedCapacityKWh = Number(((route.utilizedCapacityKWh || 0) + addAmt).toFixed(2));
    return true;
  }

  /**
   * Calculates energy losses, delivered energy, and wheeling charges for a trade.
   * 
   * Settlement convention:
   * Seller injects injectedEnergyKWh.
   * Route loss fraction L = lossPercentage / 100.
   * lossKWh = injectedEnergyKWh * L.
   * deliveredEnergyKWh = injectedEnergyKWh * (1 - L).
   * wheelingFeeINR = injectedEnergyKWh * wheelingChargeINRPerKWh.
   */
  calculateTransmissionMetrics(fromZone, toZone, injectedEnergyKWh) {
    const route = this.getRoute(fromZone, toZone);
    const lossPercentage = (route && route.lossPercentage !== undefined) ? Number(route.lossPercentage) : 1.5;
    const lossFraction = Math.max(0, Math.min(0.99, lossPercentage / 100));
    const wheelingRate = (route && route.wheelingChargeINRPerKWh !== undefined) ? Number(route.wheelingChargeINRPerKWh) : 0.10;

    const injected = Number(Number(injectedEnergyKWh || 0).toFixed(2));
    const lossKWh = Number((injected * lossFraction).toFixed(2));
    const deliveredEnergyKWh = Number((injected - lossKWh).toFixed(2));
    const wheelingFeeINR = Number((injected * wheelingRate).toFixed(2));

    return {
      routeId: route ? route.routeId : `ROUTE-${fromZone}-${toZone}`,
      fromZone,
      toZone,
      isCrossZone: fromZone !== toZone,
      injectedEnergyKWh: injected,
      lossPercentage,
      lossFraction,
      lossKWh,
      deliveredEnergyKWh,
      wheelingRateINRPerKWh: wheelingRate,
      wheelingFeeINR,
      routeStatus: route ? route.status : 'CONNECTED'
    };
  }

  /**
   * Updates route operational status (e.g., simulating disconnected lines for grid contingency testing).
   */
  setRouteStatus(routeId, status) {
    const route = this.routes.find(r => r.routeId === routeId);
    if (!route) {
      throw new Error(`Route "${routeId}" not found in grid network.`);
    }
    route.status = status === 'DISCONNECTED' ? 'DISCONNECTED' : 'CONNECTED';
    return route;
  }

  /**
   * Updates route transfer capacity for capacity limit testing.
   */
  setRouteCapacity(routeId, capacityKWh) {
    const route = this.routes.find(r => r.routeId === routeId);
    if (!route) {
      throw new Error(`Route "${routeId}" not found in grid network.`);
    }
    route.transferCapacityKWh = Math.max(0, Number(Number(capacityKWh).toFixed(2)));
    return route;
  }

  /**
   * Generates a simulated smart meter reading record for a participant.
   */
  createMeterRecord({ household, currentHour, timestamp, solarGenerationKWh, consumptionKWh, exportedKWh, importedKWh }) {
    const rec = {
      recordId: `MTR-${household.id}-H${String(currentHour).padStart(2, '0')}-${Date.now().toString().slice(-4)}`,
      participantId: household.id,
      participantName: household.name,
      participantType: household.participantType || (household.solarCapacityKW > 0 ? 'PROSUMER' : 'CONSUMER'),
      networkZone: household.zone || 'ZONE-A',
      gridConnectionStatus: household.gridConnectionStatus || 'CONNECTED',
      timestamp: timestamp || new Date().toISOString(),
      simulationHour: currentHour,
      solarGenerationKWh: Number(Number(solarGenerationKWh || 0).toFixed(2)),
      consumptionKWh: Number(Number(consumptionKWh || 0).toFixed(2)),
      availableExportKWh: Number(Number(exportedKWh || 0).toFixed(2)),
      gridImportKWh: Number(Number(importedKWh || 0).toFixed(2)),
      meterStatus: 'NORMAL',
      measurementSource: 'SIMULATED',
      disclaimer: 'Simulated smart meter reading for algorithmic research and simulation only.'
    };
    this.meterRecords.push(rec);
    return rec;
  }

  /**
   * Returns current network state snapshot for API / UI.
   */
  getNetworkState() {
    return {
      zones: Object.values(this.zones),
      routes: this.routes.map(r => ({
        ...r,
        remainingCapacityKWh: Math.max(0, Number((r.transferCapacityKWh - (r.utilizedCapacityKWh || 0)).toFixed(2))),
        utilizationPercent: r.transferCapacityKWh > 0 
          ? Number(((r.utilizedCapacityKWh || 0) / r.transferCapacityKWh * 100).toFixed(1))
          : 0
      })),
      totalRoutesCount: this.routes.length,
      connectedRoutesCount: this.routes.filter(r => r.status === 'CONNECTED').length,
      modelDisclaimer: 'Commercial energy allocation model over simulated shared grid topology. Does not track individual electron trajectories.'
    };
  }

  getRoutes() {
    return this.routes;
  }

  getMeterReadings() {
    return this.meterRecords;
  }
}

// Global Singleton for in-memory network state
const gridNetwork = new GridNetworkManager();

module.exports = {
  DEFAULT_ZONES,
  DEFAULT_ROUTES,
  GridNetworkManager,
  gridNetwork
};
