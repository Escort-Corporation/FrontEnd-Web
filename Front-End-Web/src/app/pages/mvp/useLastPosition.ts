import { useEffect, useState } from "react";
import { trackingApi, type TrackedPosition } from "../../lib/platformApi";

const POLL_MS = 15_000;

/**
 * Ultima posicao do frete pelo REST do api-tracking, atualizada a cada 15 s enquanto
 * `enabled`. O WebSocket daria tempo real, mas o polling basta para o painel e sobrevive
 * ao "dormir" do plano gratuito sem logica de reconexao.
 */
export function useLastPosition(freightId: string, enabled: boolean) {
  const [position, setPosition] = useState<TrackedPosition | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load() {
      try {
        const next = await trackingApi.lastPosition(freightId);
        if (!cancelled) {
          setPosition(next);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    void load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [freightId, enabled]);

  return { position, error };
}
