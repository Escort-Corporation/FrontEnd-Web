import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  errorMessage,
  fleetApi,
  formatDateTime,
  type CarrierDriver,
  type Vehicle,
} from "../../lib/platformApi";
import { ATTACHMENT_TYPES, Button, Card, EmptyState, Field, inputClass, Message, PageShell } from "./ui";

const VEHICLE_TYPES = ["truck", "carreta", "bitrem", "vuc", "toco"];

const VEHICLE_STATUS_LABEL: Record<Vehicle["status"], string> = {
  active: "Ativo",
  inactive: "Inativo",
  maintenance: "Em manutenção",
};

/**
 * ECF: veiculos e motoristas. So veiculo ativo de ECF vira oferta no matching; o motorista
 * cadastrado no app passa a operar as viagens da ECF depois de vinculado pelo e-mail.
 */
export function CarrierFleet() {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [drivers, setDrivers] = useState<CarrierDriver[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [nextVehicles, nextDrivers] = await Promise.all([fleetApi.listVehicles(), fleetApi.listDrivers()]);
      setVehicles(nextVehicles);
      setDrivers(nextDrivers);
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
      title="Minha frota"
      description="Cadastre os caminhões que podem receber ofertas e vincule os motoristas que vão operar as viagens pelo aplicativo."
    >
      <Message kind="error" text={error} />
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <VehiclesCard vehicles={vehicles} onChanged={load} />
        <DriversCard drivers={drivers} onChanged={load} />
      </div>
    </PageShell>
  );
}

function VehiclesCard({ vehicles, onChanged }: { vehicles: Vehicle[] | null; onChanged: () => Promise<void> }) {
  const empty = {
    plate: "",
    make: "",
    model: "",
    year: String(new Date().getFullYear()),
    vehicleType: "truck",
    attachment: "",
    capacityKg: "",
    axles: "",
  };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string }>({ kind: "success", text: "" });
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.plate.trim() || !form.make.trim() || !form.model.trim() || !(Number(form.capacityKg) > 0)) {
      setMessage({ kind: "error", text: "Informe placa, marca, modelo e capacidade." });
      return;
    }
    setBusy(true);
    try {
      await fleetApi.createVehicle({
        plate: form.plate.trim(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        vehicle_type: form.vehicleType,
        ...(form.attachment ? { attachment_type: form.attachment } : {}),
        weight_capacity_kg: Number(form.capacityKg),
        ...(Number(form.axles) > 0 ? { axle_count: Number(form.axles) } : {}),
      });
      setForm(empty);
      setMessage({ kind: "success", text: "Veículo cadastrado." });
      await onChanged();
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(id: string) {
    setBusy(true);
    try {
      await fleetApi.deactivateVehicle(id);
      setMessage({ kind: "success", text: "Veículo desativado. Ele deixa de receber ofertas." });
      await onChanged();
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Veículos">
      {vehicles === null && <EmptyState text="Carregando..." />}
      {vehicles?.length === 0 && <EmptyState text="Nenhum veículo cadastrado." />}
      {vehicles && vehicles.length > 0 && (
        <ul className="divide-y text-sm mb-5">
          {vehicles.map((v) => (
            <li key={v.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>{v.plate}</strong> · {v.make} {v.model} {v.year} · {v.weight_capacity_kg.toLocaleString("pt-BR")} kg
                {v.attachment_type ? ` · ${v.attachment_type}` : ""} · {VEHICLE_STATUS_LABEL[v.status]}
              </span>
              {v.status === "active" && (
                <Button variant="danger" disabled={busy} onClick={() => void deactivate(v.id)}>
                  Desativar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
        <h3 className="font-bold text-gray-900">Cadastrar veículo</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Placa">
            <input className={inputClass} value={form.plate} onChange={(e) => set("plate")(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Ano">
            <input type="number" className={inputClass} value={form.year} onChange={(e) => set("year")(e.target.value)} />
          </Field>
          <Field label="Marca">
            <input className={inputClass} value={form.make} onChange={(e) => set("make")(e.target.value)} />
          </Field>
          <Field label="Modelo">
            <input className={inputClass} value={form.model} onChange={(e) => set("model")(e.target.value)} />
          </Field>
          <Field label="Tipo">
            <select className={inputClass} value={form.vehicleType} onChange={(e) => set("vehicleType")(e.target.value)}>
              {VEHICLE_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </Field>
          <Field label="Implemento">
            <select className={inputClass} value={form.attachment} onChange={(e) => set("attachment")(e.target.value)}>
              {ATTACHMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type || "Nenhum"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Capacidade (kg)">
            <input type="number" min="1" className={inputClass} value={form.capacityKg} onChange={(e) => set("capacityKg")(e.target.value)} />
          </Field>
          <Field label="Eixos" hint="Opcional; usado no piso ANTT">
            <input type="number" min="1" max="12" className={inputClass} value={form.axles} onChange={(e) => set("axles")(e.target.value)} />
          </Field>
        </div>
        <Message kind={message.kind} text={message.text} />
        <Button type="submit" disabled={busy}>
          Cadastrar veículo
        </Button>
      </form>
    </Card>
  );
}

function DriversCard({ drivers, onChanged }: { drivers: CarrierDriver[] | null; onChanged: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string }>({ kind: "success", text: "" });

  async function link(event: FormEvent) {
    event.preventDefault();
    if (!email.includes("@")) {
      setMessage({ kind: "error", text: "Informe o e-mail com que o motorista se cadastrou." });
      return;
    }
    setBusy(true);
    try {
      await fleetApi.linkDriver(email.trim().toLowerCase());
      setEmail("");
      setMessage({ kind: "success", text: "Motorista vinculado. Ele já vê as viagens da sua ECF no app." });
      await onChanged();
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function unlink(driverId: string) {
    setBusy(true);
    try {
      await fleetApi.unlinkDriver(driverId);
      setMessage({ kind: "success", text: "Vínculo encerrado." });
      await onChanged();
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Motoristas">
      {drivers === null && <EmptyState text="Carregando..." />}
      {drivers?.length === 0 && <EmptyState text="Nenhum motorista vinculado." />}
      {drivers && drivers.length > 0 && (
        <ul className="divide-y text-sm mb-5">
          {drivers.map((d) => (
            <li key={d.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>{d.full_name}</strong> · {d.email} · desde {formatDateTime(d.started_at)}
              </span>
              <Button variant="danger" disabled={busy} onClick={() => void unlink(d.driver_id)}>
                Desvincular
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={link} className="space-y-3 border-t pt-4">
        <h3 className="font-bold text-gray-900">Vincular motorista</h3>
        <p className="text-sm text-gray-600">
          O motorista cria a conta pelo aplicativo (ou no cadastro do site, como Motorista). Depois, informe o e-mail dele
          aqui. Ele é empregado da ECF e não recebe pagamento da Escort.
        </p>
        <Field label="E-mail do motorista">
          <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Message kind={message.kind} text={message.text} />
        <Button type="submit" disabled={busy}>
          Vincular
        </Button>
      </form>
    </Card>
  );
}
