import { useCallback, useEffect, useState } from "react";
import {
  errorMessage,
  formatBRL,
  formatDateTime,
  freightsApi,
  matchingApi,
  type Freight,
  type Offer,
} from "../../lib/platformApi";
import { PositionInfo } from "./PositionInfo";
import { Button, Card, EmptyState, inputClass, Message, PageShell, routeLabel, StatusBadge } from "./ui";

/**
 * ECF: ofertas recebidas e viagens atribuidas.
 * - Oferta: aceitar pelo preco publicado, aceitar com contraproposta ou recusar. Recusar nao
 *   tem custo nenhum (nao afeta ranking nem ofertas futuras). A escolha final e da ESF.
 * - Viagem: depois de escolhida, a ECF (ou o motorista pelo app) inicia e confirma a entrega.
 */
export function CarrierOffers() {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [trips, setTrips] = useState<Freight[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [nextOffers, nextTrips] = await Promise.all([matchingApi.listOffers(), freightsApi.listAssigned()]);
      setOffers(nextOffers);
      setTrips(nextTrips);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeTrips = trips?.filter((t) => t.status === "matched" || t.status === "in_transit") ?? [];
  const pastTrips = trips?.filter((t) => t.status === "delivered" || t.status === "cancelled") ?? [];

  return (
    <PageShell
      title="Ofertas e viagens"
      description="Responda às ofertas de frete compatíveis com a sua frota e opere as viagens que o embarcador escolheu para você. O repasse (85% do frete) é liberado após a entrega confirmada."
    >
      <Message kind="error" text={error} />
      <Button variant="secondary" onClick={() => void load()}>
        Atualizar
      </Button>

      <Card title="Ofertas abertas">
        {offers === null && !error && <EmptyState text="Carregando..." />}
        {offers?.length === 0 && (
          <EmptyState text="Nenhuma oferta aberta. As ofertas aparecem quando um embarcador busca transportadoras compatíveis com seus veículos." />
        )}
        <div className="space-y-4">
          {offers?.map((offer) => <OfferRow key={offer.candidate_id} offer={offer} onChanged={load} />)}
        </div>
      </Card>

      <Card title="Viagens em andamento">
        {trips === null && !error && <EmptyState text="Carregando..." />}
        {trips !== null && activeTrips.length === 0 && <EmptyState text="Nenhuma viagem em andamento." />}
        <div className="space-y-4">
          {activeTrips.map((trip) => <TripRow key={trip.id} trip={trip} onChanged={load} />)}
        </div>
      </Card>

      {pastTrips.length > 0 && (
        <Card title="Histórico">
          <ul className="divide-y text-sm">
            {pastTrips.map((trip) => (
              <li key={trip.id} className="py-2 flex flex-wrap justify-between gap-2">
                <span className="font-semibold text-gray-900">{routeLabel(trip)}</span>
                <span className="flex items-center gap-3">
                  {formatBRL(trip.freight_price_brl)} <StatusBadge status={trip.status} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageShell>
  );
}

function OfferRow({ offer, onChanged }: { offer: Offer; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<"idle" | "counter" | "decline">("idle");
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string }>({ kind: "success", text: "" });

  async function respond(payload: Parameters<typeof matchingApi.respond>[1], success: string) {
    setBusy(true);
    try {
      await matchingApi.respond(offer.candidate_id, payload);
      setMessage({ kind: "success", text: success });
      await onChanged();
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const answered = offer.response_decision !== null;

  return (
    <div className="border-2 border-gray-100 rounded-xl p-4">
      <div className="flex flex-wrap justify-between gap-2 mb-2">
        <span className="font-bold text-gray-900">{routeLabel(offer)}</span>
        <span className="font-bold text-gray-900">{formatBRL(offer.freight_price_brl)}</span>
      </div>
      <p className="text-sm text-gray-600 mb-3">
        Coleta {formatDateTime(offer.pickup_starts_at)} até {formatDateTime(offer.pickup_ends_at)} ·{" "}
        {offer.cargo_type ?? "Carga"} · {offer.weight_kg.toLocaleString("pt-BR")} kg
        {offer.requires_specific_time && " · horário específico"} · oferta válida até {formatDateTime(offer.expires_at)}
      </p>

      <Message kind={message.kind} text={message.text} />

      {answered ? (
        <p className="text-sm font-semibold text-gray-700">
          {offer.response_decision === "accepted"
            ? offer.proposed_price_brl
              ? `Você aceitou com contraproposta de ${formatBRL(offer.proposed_price_brl)}. Aguardando o embarcador.`
              : "Você aceitou pelo preço publicado. Aguardando o embarcador."
            : "Você recusou esta oferta."}
        </p>
      ) : mode === "counter" ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-xs font-bold text-gray-700 mb-1">Seu preço (R$)</span>
            <input type="number" min="1" step="0.01" className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <Button
            disabled={busy || !(Number(price) > 0)}
            onClick={() =>
              void respond(
                { decision: "accepted", proposed_price_brl: Number(price) },
                "Contraproposta enviada ao embarcador.",
              )
            }
          >
            Enviar contraproposta
          </Button>
          <Button variant="secondary" onClick={() => setMode("idle")}>
            Voltar
          </Button>
        </div>
      ) : mode === "decline" ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block flex-1 min-w-[200px]">
            <span className="block text-xs font-bold text-gray-700 mb-1">Motivo (opcional)</span>
            <input className={inputClass} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() =>
              void respond(
                { decision: "declined", ...(reason.trim() ? { decline_reason: reason.trim() } : {}) },
                "Oferta recusada. Recusar não afeta suas próximas ofertas.",
              )
            }
          >
            Confirmar recusa
          </Button>
          <Button variant="secondary" onClick={() => setMode("idle")}>
            Voltar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void respond({ decision: "accepted" }, "Oferta aceita. Aguardando o embarcador.")}>
            Aceitar pelo preço publicado
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setMode("counter")}>
            Fazer contraproposta
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => setMode("decline")}>
            Recusar
          </Button>
        </div>
      )}
    </div>
  );
}

function TripRow({ trip, onChanged }: { trip: Freight; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string }>({ kind: "success", text: "" });

  async function change(status: Freight["status"], success: string) {
    setBusy(true);
    try {
      await freightsApi.changeStatus(trip.id, status);
      setMessage({ kind: "success", text: success });
      await onChanged();
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-2 border-gray-100 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <span className="font-bold text-gray-900">{routeLabel(trip)}</span>
        <span className="flex items-center gap-3 text-sm font-bold">
          {formatBRL(trip.freight_price_brl)} <StatusBadge status={trip.status} />
        </span>
      </div>
      <p className="text-sm text-gray-600">
        Coleta {formatDateTime(trip.pickup_starts_at)} · {trip.cargo_type} · {trip.weight_kg.toLocaleString("pt-BR")} kg
      </p>
      <Message kind={message.kind} text={message.text} />
      {trip.status === "matched" && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void change("in_transit", "Viagem iniciada.")}>
            Iniciar viagem
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void change("cancelled", "Viagem cancelada.")}>
            Cancelar
          </Button>
        </div>
      )}
      {trip.status === "in_transit" && (
        <>
          <PositionInfo freightId={trip.id} />
          <Button
            disabled={busy}
            onClick={() => void change("delivered", "Entrega confirmada. O repasse será liberado.")}
          >
            Confirmar entrega
          </Button>
        </>
      )}
    </div>
  );
}
