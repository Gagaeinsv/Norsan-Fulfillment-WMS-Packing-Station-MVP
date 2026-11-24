export type CarrierMode = "mock" | "sandbox" | "live";

export interface CarrierShipmentRequest {
  orderId: string;
  orderNumber: string;
  recipientName: string;
  street: string;
  city: string;
  zip: string;
  province?: string;
  country: string;
  weightGrams: number;
  packageCount: number;
  courier?: string;
}

export interface CarrierShipmentResult {
  provider: string;
  mode: CarrierMode;
  trackingNumber: string;
  colliTrackings: string[];
  labelFormat: "html_thermal" | "pdf" | "zpl";
  idempotencyKey: string;
}

export interface CarrierProvider {
  readonly name: string;
  readonly mode: CarrierMode;
  isConfigured(): boolean;
  createLabel(req: CarrierShipmentRequest): Promise<CarrierShipmentResult>;
}

/** Deterministic mock tracking generator until live DHL Business API keys are provisioned. */
export class MockDhlCarrierProvider implements CarrierProvider {
  readonly name = "DHL Mock Adapter";
  readonly mode: CarrierMode = "mock";

  isConfigured(): boolean {
    return true;
  }

  async createLabel(req: CarrierShipmentRequest): Promise<CarrierShipmentResult> {
    const digits = req.orderNumber.replace(/[^0-9]/g, "").padStart(10, "0").slice(-10);
    const baseTracking = `JJD${digits}`;
    const totalColli = Math.max(1, req.packageCount || 1);
    const colliTrackings =
      totalColli === 1
        ? [baseTracking]
        : Array.from(
            { length: totalColli },
            (_, idx) => `${baseTracking}-${String(idx + 1).padStart(2, "0")}`,
          );

    return {
      provider: this.name,
      mode: this.mode,
      trackingNumber: baseTracking,
      colliTrackings,
      labelFormat: "html_thermal",
      idempotencyKey: `${req.orderId}:${totalColli}`,
    };
  }
}

/** Plug-and-play DHL Business API provider scaffold activated once .env credentials are set. */
export class DhlBusinessApiProvider implements CarrierProvider {
  readonly name = "DHL Business API";
  readonly mode: CarrierMode;
  private readonly apiKey: string;
  private readonly accountNumber: string;

  constructor() {
    this.apiKey = (process.env.DHL_API_KEY || "").trim();
    this.accountNumber = (process.env.DHL_ACCOUNT_NUMBER || "").trim();
    const envMode = (process.env.CARRIER_MODE || "").trim().toLowerCase();
    this.mode = envMode === "live" ? "live" : envMode === "sandbox" ? "sandbox" : "mock";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.accountNumber);
  }

  async createLabel(req: CarrierShipmentRequest): Promise<CarrierShipmentResult> {
    if (!this.isConfigured() || this.mode === "mock") {
      return new MockDhlCarrierProvider().createLabel(req);
    }

    throw new Error(
      "DHL live adapter scaffold ready: implement HTTP call once sandbox credentials and endpoint schema are confirmed.",
    );
  }
}

export function getActiveCarrierProvider(): CarrierProvider {
  const dhlProvider = new DhlBusinessApiProvider();
  if (dhlProvider.isConfigured() && dhlProvider.mode !== "mock") {
    return dhlProvider;
  }
  return new MockDhlCarrierProvider();
}

export function getCarrierIntegrationStatus() {
  const dhl = new DhlBusinessApiProvider();
  const mode = (process.env.CARRIER_MODE || "mock").trim().toLowerCase() as CarrierMode;
  return {
    provider: dhl.isConfigured() ? dhl.name : "DHL Mock Adapter",
    mode: mode === "live" || mode === "sandbox" ? mode : "mock",
    configured: dhl.isConfigured(),
    hasApiKey: Boolean((process.env.DHL_API_KEY || "").trim()),
    hasAccountNumber: Boolean((process.env.DHL_ACCOUNT_NUMBER || "").trim()),
  };
}

export function getIntegrationsReadiness() {
  const carrier = getCarrierIntegrationStatus();
  const hasSellyKey = Boolean((process.env.SELLY_API_KEY || "").trim());
  const hasAmazonToken = Boolean((process.env.AMAZON_SP_REFRESH_TOKEN || "").trim());

  return {
    dhl: {
      configured: carrier.configured,
      mode: carrier.mode,
      status: carrier.configured ? "ready" : "pending_credentials",
    },
    selly: {
      configured: hasSellyKey,
      mode: hasSellyKey ? "live" : "csv_fallback",
      status: hasSellyKey ? "ready" : "pending_credentials",
    },
    amazon: {
      configured: hasAmazonToken,
      mode: hasAmazonToken ? "live" : "manual_slip",
      status: hasAmazonToken ? "ready" : "pending_credentials",
    },
  };
}
