import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  errorMessage,
  formatBRL,
  formatDateTime,
  freightsApi,
  matchingApi,
  type Candidate,
  type Freight,
} from "../../lib/platformApi";
import { PositionInfo } from "./PositionInfo";
import { Button, Card, EmptyState, Message, PageShell, routeLabel, StatusBadge } from "./ui";

const RESPONSE_LABEL: Record<string, string> = {
  accepted: "Aceitou",
  declined: "Recusou",
};

/**
 * ESF: fretes publicados e o ciclo de cada um. Buscar transportadoras gera as ofertas
 * (POST /matching/freights/{id}/candidates); as ECFs aceitam, recusam ou contrapropoem;
 * a ESF escolhe uma. Depois acompanha a posicao e pode confirmar a entrega.
 */
export function MyFreights() {
  const location = useLocation();
  const justPublished = Boolean((location.state as { published?: boolean } | null)?.published);

  const [freights, setFreights] = useState<Freight[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setFreights(await freightsApi.listMine());
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell
      title="Meus fretes"
      description="Busque as transportadoras compatíveis, acompanhe as respostas e escolha quem transporta. O pagamento fica retido e só é liberado à ECF depois da entrega confirmada."
    >
      {justPublished && <Message kind="success" text="Frete publicado. Agora busque as transportadoras compatíveis." />}
      <Message kind="error" text={error} />
      <div className="flex justify-between items-center">
        <Button variant="secondary" onClick={() => void load()}>
          Atualizar
        </Button>
        <Link to="/publicar-frete" className="font-bold text-orange-600 hover:text-orange-700 text-sm">
          + Publicar frete
        </Link>
      </div>

      {freights === null && !error && <EmptyState text="Carregando..." />}
      {freights?.length === 0 && <EmptyState text="Você ainda não publicou fretes." />}
      {freights?.map((freight) => (
        <FreightCard key={freight.id} freight={freight} onChanged={load} />
      ))}
    </PageShell>
  );
}

function FreightCard({ freight, onChanged }: { freight: Freight; onChanged: () => Promise<void> }) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success" | "info"; text: string }>({ kind: "info", text: "" });

  const isOpen = freight.status === "published";

  const loadCandidates = useCallback(async () => {
    try {
      setCandidates(await matchingApi.listCandidates(freight.id));
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
    }
  }, [freight.id]);

  useEffect(() => {
    if (isOpen) void loadCandidates();
  }, [isOpen, loadCandidates]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      setMessage({ kind: "success", text: success });
      await onChanged();
      if (isOpen) await loadCandidates();
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function findCarriers() {
    setBusy(true);
    try {
      const generated = await matchingApi.generateCandidates(freight.id);
      setMessage(
        generated.length
          ? { kind: "success", text: `${generated.length} transportadora(s) compatível(is) receberam a oferta.` }
          : { kind: "info", text: "Nenhum caminhão de ECF compatível agora (capacidade, implemento ou horário)." },
      );
      await loadCandidates();
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const openCandidates = candidates?.filter((c) => c.status === "generated") ?? [];

  return (
    <Card
      title={routeLabel(freight)}
      actions={<StatusBadge status={freight.status} />}
    >
      <dl className="grid sm:grid-cols-4 gap-3 text-sm mb-4">
        <div>
          <dt className="text-gray-500">Coleta</dt>
          <dd className="font-semibold text-gray-900">{formatDateTime(freight.pickup_starts_at)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Carga</dt>
          <dd className="font-semibold text-gray-900">
            {freight.cargo_type} · {freight.weight_kg.toLocaleString("pt-BR")} kg
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Valor</dt>
          <dd className="font-semibold text-gray-900">{formatBRL(freight.freight_price_brl)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Publicado em</dt>
          <dd className="font-semibold text-gray-900">{formatDateTime(freight.created_at)}</dd>
        </div>
      </dl>

      <div className="space-y-3">
        <Message kind={message.kind} text={message.text} />

        {isOpen && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void findCarriers()}>
                Buscar transportadoras
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => void run(() => freightsApi.changeStatus(freight.id, "cancelled"), "Frete cancelado.")}
              >
                Cancelar frete
              </Button>
            </div>
            {candidates && candidates.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Compatibilidade</th>
                      <th className="py-2 pr-3">Resposta da ECF</th>
                      <th className="py-2 pr-3">Preço</th>
                      <th className="py-2 pr-3">Validade</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-bold">{c.rank}</td>
                        <td className="py-2 pr-3">{Math.round(c.score * 100)}%</td>
                        <td className="py-2 pr-3">
                          {c.status !== "generated"
                            ? c.status === "declined"
                              ? "Recusou"
                              : c.status === "expired"
                                ? "Expirou"
                                : c.status
                            : c.response_decision
                              ? RESPONSE_LABEL[c.response_decision]
                              : "Aguardando"}
                        </td>
                        <td className="py-2 pr-3">
                          {c.proposed_price_brl ? `Contraproposta ${formatBRL(c.proposed_price_brl)}` : "Preço publicado"}
                        </td>
                        <td className="py-2 pr-3">{formatDateTime(c.expires_at)}</td>
                        <td className="py-2 text-right">
                          {c.status === "generated" && (
                            <Button
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  () => matchingApi.selectCandidate(c.id),
                                  "Transportadora escolhida. Ela inicia a viagem pelo painel ou pelo app do motorista.",
                                )
                              }
                            >
                              Escolher
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {openCandidates.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Escolher uma oferta encerra as demais. Se a ECF fez contraproposta, ela vira o preço do frete.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {freight.status === "matched" && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-gray-700">Aguardando a transportadora iniciar a viagem.</p>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => void run(() => freightsApi.changeStatus(freight.id, "cancelled"), "Frete cancelado.")}
            >
              Cancelar frete
            </Button>
          </div>
        )}

        {freight.status === "in_transit" && (
          <>
            <PositionInfo freightId={freight.id} />
            <Button
              disabled={busy}
              onClick={() =>
                void run(
                  () => freightsApi.changeStatus(freight.id, "delivered"),
                  "Entrega confirmada. O pagamento retido é liberado à transportadora.",
                )
              }
            >
              Confirmar entrega
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
