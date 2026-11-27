import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { errorMessage, freightsApi } from "../../lib/platformApi";
import { ATTACHMENT_TYPES, Button, Card, Field, inputClass, Message, PageShell } from "./ui";

const CARGO_TYPES = ["Geral", "Refrigerada", "Frágil", "Perigosa", "Granel", "Alto valor"];

/** "2026-12-01T08:00" (input datetime-local, horario local) -> ISO com fuso. */
function toIso(local: string): string {
  return new Date(local).toISOString();
}

/**
 * ESF publica um frete (POST /freights). O preco bruto e a base do split 85/15 e do
 * pagamento em escrow; sem ele, nao ha como pagar a ECF.
 */
export function PublishFreight() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    originCity: "",
    originState: "",
    destinationCity: "",
    destinationState: "",
    pickupStart: "",
    pickupEnd: "",
    weightKg: "",
    volumeM3: "",
    cargoType: "Geral",
    attachment: "",
    priceBrl: "",
    specificTime: false,
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  function validate(): string | null {
    if (!form.originCity.trim() || !/^[A-Za-z]{2}$/.test(form.originState)) return "Informe a cidade e a UF de origem.";
    if (!form.destinationCity.trim() || !/^[A-Za-z]{2}$/.test(form.destinationState))
      return "Informe a cidade e a UF de destino.";
    if (!form.pickupStart || !form.pickupEnd) return "Informe a janela de coleta.";
    if (new Date(form.pickupEnd) <= new Date(form.pickupStart)) return "O fim da coleta precisa ser depois do início.";
    if (new Date(form.pickupEnd) <= new Date()) return "A janela de coleta já terminou.";
    if (!(Number(form.weightKg) > 0)) return "Informe o peso em kg.";
    if (!(Number(form.priceBrl) > 0)) return "Informe o valor do frete.";
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    try {
      await freightsApi.create({
        origin_city: form.originCity.trim(),
        origin_state: form.originState.toUpperCase(),
        destination_city: form.destinationCity.trim(),
        destination_state: form.destinationState.toUpperCase(),
        pickup_starts_at: toIso(form.pickupStart),
        pickup_ends_at: toIso(form.pickupEnd),
        weight_kg: Number(form.weightKg),
        ...(Number(form.volumeM3) > 0 ? { volume_m3: Number(form.volumeM3) } : {}),
        cargo_type: form.cargoType,
        ...(form.attachment ? { required_attachment_type: form.attachment } : {}),
        freight_price_brl: Number(form.priceBrl),
        requires_specific_time: form.specificTime,
      });
      navigate("/meus-fretes", { replace: true, state: { published: true } });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell
      title="Publicar frete"
      description="Descreva a carga e a coleta. Depois de publicado, você busca as transportadoras (ECF) compatíveis em Meus fretes e escolhe uma."
    >
      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-[1fr_90px] gap-3">
            <Field label="Cidade de origem">
              <input className={inputClass} value={form.originCity} onChange={(e) => set("originCity")(e.target.value)} />
            </Field>
            <Field label="UF">
              <input
                className={inputClass}
                maxLength={2}
                value={form.originState}
                onChange={(e) => set("originState")(e.target.value.toUpperCase())}
              />
            </Field>
          </div>
          <div className="grid sm:grid-cols-[1fr_90px] gap-3">
            <Field label="Cidade de destino">
              <input
                className={inputClass}
                value={form.destinationCity}
                onChange={(e) => set("destinationCity")(e.target.value)}
              />
            </Field>
            <Field label="UF">
              <input
                className={inputClass}
                maxLength={2}
                value={form.destinationState}
                onChange={(e) => set("destinationState")(e.target.value.toUpperCase())}
              />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Início da coleta">
              <input
                type="datetime-local"
                className={inputClass}
                value={form.pickupStart}
                onChange={(e) => set("pickupStart")(e.target.value)}
              />
            </Field>
            <Field label="Fim da coleta">
              <input
                type="datetime-local"
                className={inputClass}
                value={form.pickupEnd}
                onChange={(e) => set("pickupEnd")(e.target.value)}
              />
            </Field>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.specificTime}
              onChange={(e) => set("specificTime")(e.target.checked)}
            />
            <span>
              <strong>Horário específico.</strong> Só aceito se houver caminhão de ECF livre nessa janela; sem caminhão, o
              pedido é recusado.
            </span>
          </label>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Peso (kg)">
              <input
                type="number"
                min="1"
                className={inputClass}
                value={form.weightKg}
                onChange={(e) => set("weightKg")(e.target.value)}
              />
            </Field>
            <Field label="Volume (m³)" hint="Opcional">
              <input
                type="number"
                min="0"
                step="0.1"
                className={inputClass}
                value={form.volumeM3}
                onChange={(e) => set("volumeM3")(e.target.value)}
              />
            </Field>
            <Field label="Tipo de carga">
              <select className={inputClass} value={form.cargoType} onChange={(e) => set("cargoType")(e.target.value)}>
                {CARGO_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Implemento exigido" hint="Vazio = qualquer caminhão compatível">
              <select className={inputClass} value={form.attachment} onChange={(e) => set("attachment")(e.target.value)}>
                {ATTACHMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type || "Qualquer"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Valor do frete (R$)" hint="Valor bruto. A ECF recebe 85% após a entrega confirmada.">
              <input
                type="number"
                min="1"
                step="0.01"
                className={inputClass}
                value={form.priceBrl}
                onChange={(e) => set("priceBrl")(e.target.value)}
              />
            </Field>
          </div>

          <Message kind="error" text={error} />

          <Button type="submit" disabled={submitting} className="w-full py-3">
            {submitting ? "Publicando..." : "Publicar frete"}
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
