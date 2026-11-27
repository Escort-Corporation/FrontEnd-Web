/**
 * Cliente da plataforma (backend de microsservicos atras do gateway api-core).
 *
 * Toda chamada passa pelo gateway (VITE_AUTH_API_URL). A identidade vem sempre do token,
 * nunca de um id no corpo. Toda resposta fora de 2xx vira PlatformError com a mensagem do
 * envelope da plataforma: {"error": {"code", "message", "details"}}.
 */

export const GATEWAY_URL: string =
  (import.meta.env.VITE_AUTH_API_URL as string | undefined) ?? "http://localhost:8000";

const TOKEN_KEY = "escort-auth-token";

export function getAccessToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export class PlatformError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PlatformError";
    this.status = status;
    this.code = code;
  }
}

/** Texto para a tela a partir de qualquer erro. */
export function errorMessage(error: unknown): string {
  if (error instanceof PlatformError) {
    if (error.status === 401) return "Sua sessão expirou. Entre novamente.";
    if (error.status === 403) return error.message || "Você não tem permissão para esta ação.";
    if (error.status >= 500) return "O servidor falhou. Tente novamente em instantes.";
    return error.message || "Não foi possível concluir a operação.";
  }
  return "Sem conexão com o servidor. Tente novamente.";
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export async function request<T>(method: Method, path: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let code = "HTTP_ERROR";
    let message = "";
    try {
      const data = (await response.json()) as { error?: { code?: string; message?: string } };
      code = data.error?.code ?? code;
      message = data.error?.message ?? "";
    } catch {
      // corpo nao-JSON (ex.: pagina de erro do proxy): fica a mensagem generica
    }
    throw new PlatformError(response.status, code, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// --- Fretes (api-freight) ------------------------------------------------------------

export type FreightStatus = "published" | "matched" | "in_transit" | "delivered" | "cancelled";

export type Freight = {
  id: string;
  shipper_id: string;
  status: FreightStatus;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  pickup_starts_at: string;
  pickup_ends_at: string;
  weight_kg: number;
  volume_m3: number | null;
  cargo_type: string;
  required_attachment_type: string | null;
  freight_price_brl: number | null;
  requires_specific_time: boolean;
  matched_vehicle_id: string | null;
  matched_driver_id: string | null;
  created_at: string;
  updated_at: string;
};

export type FreightCreate = {
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  pickup_starts_at: string;
  pickup_ends_at: string;
  weight_kg: number;
  volume_m3?: number;
  cargo_type: string;
  required_attachment_type?: string;
  freight_price_brl?: number;
  requires_specific_time?: boolean;
};

export const freightsApi = {
  create: (payload: FreightCreate) => request<Freight>("POST", "/freights", payload),
  /** Fretes da ESF autenticada. */
  listMine: () => request<Freight[]>("GET", "/freights"),
  /** Fretes atribuidos a ECF autenticada (ou a ECF do motorista vinculado). */
  listAssigned: () => request<Freight[]>("GET", "/freights/assigned"),
  get: (id: string) => request<Freight>("GET", `/freights/${id}`),
  changeStatus: (id: string, status: FreightStatus) =>
    request<Freight>("PATCH", `/freights/${id}/status`, { status }),
};

// --- Matching (api-matching, prefixo /matching no gateway) ---------------------------

export type Candidate = {
  id: string;
  freight_id: string;
  vehicle_id: string;
  driver_id: string;
  score: number;
  rank: number;
  status: "generated" | "selected" | "rejected" | "expired" | "declined";
  expires_at: string;
  response_decision: "accepted" | "declined" | null;
  proposed_price_brl: number | null;
};

export type Offer = {
  candidate_id: string;
  freight_id: string;
  vehicle_id: string;
  status: Candidate["status"];
  expires_at: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  pickup_starts_at: string;
  pickup_ends_at: string;
  weight_kg: number;
  cargo_type: string | null;
  freight_price_brl: number | null;
  requires_specific_time: boolean;
  response_decision: "accepted" | "declined" | null;
  proposed_price_brl: number | null;
};

export const matchingApi = {
  generateCandidates: (freightId: string) =>
    request<Candidate[]>("POST", `/matching/freights/${freightId}/candidates`),
  listCandidates: (freightId: string) => request<Candidate[]>("GET", `/matching/freights/${freightId}/candidates`),
  selectCandidate: (candidateId: string) => request<Candidate>("POST", `/matching/candidates/${candidateId}/select`),
  listOffers: () => request<Offer[]>("GET", "/matching/offers"),
  respond: (
    candidateId: string,
    payload: { decision: "accepted" | "declined"; proposed_price_brl?: number; decline_reason?: string },
  ) => request<unknown>("POST", `/matching/candidates/${candidateId}/respond`, payload),
};

// --- Frota (api-fleet, prefixo /fleet no gateway) -----------------------------------

export type Vehicle = {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  vehicle_type: string;
  attachment_type: string | null;
  weight_capacity_kg: number;
  axle_count: number | null;
  status: "active" | "inactive" | "maintenance";
};

export type VehicleCreate = {
  plate: string;
  make: string;
  model: string;
  year: number;
  vehicle_type: string;
  attachment_type?: string;
  weight_capacity_kg: number;
  axle_count?: number;
};

export type CarrierDriver = {
  id: string;
  driver_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  started_at: string;
};

export const fleetApi = {
  listVehicles: () => request<Vehicle[]>("GET", "/fleet/vehicles"),
  createVehicle: (payload: VehicleCreate) => request<Vehicle>("POST", "/fleet/vehicles", payload),
  deactivateVehicle: (id: string) => request<Vehicle>("POST", `/fleet/vehicles/${id}/deactivate`),
  listDrivers: () => request<CarrierDriver[]>("GET", "/fleet/drivers"),
  linkDriver: (driverEmail: string) =>
    request<CarrierDriver>("POST", "/fleet/drivers", { driver_email: driverEmail }),
  unlinkDriver: (driverId: string) => request<void>("DELETE", `/fleet/drivers/${driverId}`),
};

// --- Rastreamento (api-tracking) -----------------------------------------------------

export type TrackedPosition = { freight_id: string; lat: number; lng: number; updated_at: string };

export const trackingApi = {
  /** Ultima posicao conhecida; null quando nao ha posicao recente (404). */
  lastPosition: async (freightId: string): Promise<TrackedPosition | null> => {
    try {
      return await request<TrackedPosition>("GET", `/tracking/${freightId}/position`);
    } catch (error) {
      if (error instanceof PlatformError && error.status === 404) return null;
      throw error;
    }
  },
};

// --- Formatacao ------------------------------------------------------------------------

export const FREIGHT_STATUS_LABEL: Record<FreightStatus, string> = {
  published: "Publicado",
  matched: "Transportadora escolhida",
  in_transit: "Em trânsito",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
