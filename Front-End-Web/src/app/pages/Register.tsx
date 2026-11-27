import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Building2, Package, Truck, UserPlus } from "lucide-react";
import { MIN_PASSWORD_LENGTH, useAuth, type SignUpInput } from "../auth/AuthContext";
import { homeForUser } from "../auth/navigation";

type Kind = SignUpInput["kind"];

const accountTypes: { kind: Kind; label: string; description: string; icon: typeof Building2 }[] = [
  { kind: "shipper", label: "Embarcador (ESF)", description: "Publica fretes e escolhe a transportadora.", icon: Package },
  { kind: "carrier", label: "Transportadora (ECF)", description: "Tem a frota, recebe ofertas e opera as viagens.", icon: Building2 },
  { kind: "trucker", label: "Motorista", description: "Motorista de uma ECF. Usa o aplicativo.", icon: Truck },
];

const LICENSE_CATEGORIES = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"];

const inputClass =
  "w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-orange-600";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-bold text-gray-700 mb-2">{label}</span>
      {children}
    </label>
  );
}

const onlyDigits = (value: string) => value.replace(/\D/g, "");

export function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [kind, setKind] = useState<Kind>("shipper");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [rntrcNumber, setRntrcNumber] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseCategory, setLicenseCategory] = useState("E");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isCompany = kind !== "trucker";

  function validate(): string | null {
    if (name.trim().length < 3) return "Informe o nome completo do responsável.";
    if (password.length < MIN_PASSWORD_LENGTH) return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    if (isCompany) {
      if (!companyName.trim()) return "Informe a razão social.";
      if (onlyDigits(documentNumber).length !== 14) return "O CNPJ tem 14 dígitos.";
    } else {
      if (onlyDigits(documentNumber).length !== 11) return "O CPF tem 11 dígitos.";
      if (onlyDigits(licenseNumber).length !== 11) return "O número da CNH tem 11 dígitos.";
    }
    if (state && !/^[A-Za-z]{2}$/.test(state.trim())) return "A UF tem 2 letras (ex.: SP).";
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    const common = { name, email, password, phone, city, state };
    const input: SignUpInput = isCompany
      ? { ...common, kind: kind as "shipper" | "carrier", companyName, documentNumber, rntrcNumber }
      : { ...common, kind: "trucker", documentNumber, licenseNumber, licenseCategory };

    setSubmitting(true);
    const result = await register(input);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setError("");
    if (result.user) {
      navigate(homeForUser(result.user), { replace: true });
      return;
    }
    setNotice(result.message ?? "Conta criada. Confirme seu e-mail para entrar.");
  };

  return (
    <section className="min-h-[calc(100vh-220px)] bg-gray-50 py-16 flex items-center">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1fr_480px] gap-10 items-start">
        <div>
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full font-bold text-sm mb-6">
            <UserPlus className="w-4 h-4" />
            Novo acesso
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-5">Crie seu cadastro</h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            O embarcador (ESF) publica fretes e escolhe quem transporta. A transportadora (ECF) cadastra a frota e os
            motoristas, recebe as ofertas e opera as viagens. O motorista é empregado da ECF e usa o aplicativo; depois
            do cadastro, a ECF o vincula pelo e-mail.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Cadastro</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <span className="block text-sm font-bold text-gray-700 mb-2">Tipo de conta</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {accountTypes.map((type) => (
                  <button
                    key={type.kind}
                    type="button"
                    onClick={() => {
                      setKind(type.kind);
                      setError("");
                    }}
                    className={`text-left border-2 rounded-lg p-3 transition-colors ${
                      kind === type.kind ? "border-orange-600 bg-orange-50" : "border-gray-200 hover:border-orange-300"
                    }`}
                  >
                    <type.icon className="w-5 h-5 text-orange-600 mb-1" />
                    <div className="font-bold text-gray-900 text-sm">{type.label}</div>
                    <div className="text-xs text-gray-500">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <Field label={isCompany ? "Nome do responsável" : "Nome completo"}>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </Field>

            {isCompany && (
              <>
                <Field label="Razão social">
                  <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} />
                </Field>
                <Field label="CNPJ">
                  <input
                    required
                    inputMode="numeric"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                {kind === "carrier" && (
                  <Field label="RNTRC (opcional)">
                    <input
                      inputMode="numeric"
                      value={rntrcNumber}
                      onChange={(e) => setRntrcNumber(e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                )}
              </>
            )}

            {!isCompany && (
              <>
                <Field label="CPF">
                  <input
                    required
                    inputMode="numeric"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <div className="grid grid-cols-[1fr_120px] gap-3">
                  <Field label="Número da CNH">
                    <input
                      required
                      inputMode="numeric"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Categoria">
                    <select value={licenseCategory} onChange={(e) => setLicenseCategory(e.target.value)} className={inputClass}>
                      {LICENSE_CATEGORIES.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </>
            )}

            <div className="grid grid-cols-[1fr_90px] gap-3">
              <Field label="Cidade (opcional)">
                <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
              </Field>
              <Field label="UF">
                <input maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} className={inputClass} />
              </Field>
            </div>

            <Field label="Telefone (opcional)">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </Field>
            <Field label="E-mail">
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Senha">
              <input
                required
                type="password"
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </Field>

            {error && <p className="text-red-600 font-semibold text-sm">{error}</p>}
            {notice && <p className="text-green-700 font-semibold text-sm">{notice}</p>}

            <button
              disabled={submitting}
              className="w-full bg-orange-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <UserPlus className="w-5 h-5" />
              {submitting ? "Criando conta..." : "Criar conta"}
            </button>
          </form>
          <p className="text-sm text-gray-600 mt-6 text-center">
            Ja tem acesso?{" "}
            <Link to="/login" className="font-bold text-orange-600 hover:text-orange-700">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
