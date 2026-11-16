import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Contrast,
  CreditCard,
  KeyRound,
  Mail,
  ShieldCheck,
  Trash2,
  Type,
  UserCircle,
} from "lucide-react";
import { PageHero } from "../components/PageHero";
import { MIN_PASSWORD_LENGTH, useAuth, type Role } from "../auth/AuthContext";
import { useSubscription } from "../billing/SubscriptionContext";
import {
  fontScaleOptions,
  themeOptions,
  usePreferences,
  type FontScale,
  type Theme,
} from "../preferences/PreferencesContext";
import { plans } from "../data/billing";

const currencyFormat = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  empresa: "Empresa",
  motorista: "Motorista",
};

const cardClass = "bg-white rounded-2xl shadow-lg p-6 lg:p-8";
const inputClass =
  "w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-orange-600";
const labelClass = "block text-sm font-bold text-gray-700 mb-2";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function Profile() {
  const navigate = useNavigate();
  const { user, updateName, changePassword, deleteAccount } = useAuth();
  const { subscription, isPremium } = useSubscription();
  const { theme, setTheme, fontScale, setFontScale } = usePreferences();

  const [name, setName] = useState(user?.name ?? "");
  const [nameError, setNameError] = useState("");
  const [nameSaved, setNameSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // A rota e protegida, entao so cai aqui durante o redirecionamento da saida.
  if (!user) return null;

  function handleNameSubmit(event: FormEvent) {
    event.preventDefault();
    const error = updateName(name);

    setNameError(error?.message ?? "");
    setNameSaved(!error);
  }

  function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setPasswordSaved(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmação não confere com a nova senha.");
      return;
    }

    const error = changePassword(currentPassword, newPassword);
    if (error) {
      setPasswordError(error.message);
      return;
    }

    setPasswordError("");
    setPasswordSaved(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  function handleDelete() {
    deleteAccount();
    navigate("/", { replace: true });
  }

  const currentPlan = plans[subscription.planId];

  return (
    <div>
      <PageHero
        eyebrow="Minha conta"
        title="Perfil"
        description="Seus dados de acesso, preferências de exibição e situação do plano."
      />

      <section className="py-12 lg:py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Dados da conta */}
          <div className={cardClass}>
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-orange-100 p-3 rounded-xl">
                <UserCircle className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Dados da conta</h2>
                <p className="text-gray-600">O nome aparece no menu e nos registros da operação.</p>
              </div>
            </div>

            <form onSubmit={handleNameSubmit} className="space-y-5">
              <label className="block">
                <span className={labelClass}>Nome</span>
                <input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setNameError("");
                    setNameSaved(false);
                  }}
                  className={inputClass}
                />
              </label>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <span className={labelClass}>E-mail</span>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gray-100 text-gray-600">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    É o identificador de login, por isso não pode ser alterado por aqui.
                  </p>
                </div>
                <div>
                  <span className={labelClass}>Tipo de conta</span>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gray-100 text-gray-600">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    {roleLabels[user.role]}
                  </div>
                </div>
              </div>

              {nameError && <FormMessage kind="error" message={nameError} />}
              {nameSaved && <FormMessage kind="success" message="Nome atualizado." />}

              <button
                type="submit"
                className="bg-orange-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-700 transition-colors"
              >
                Salvar alterações
              </button>
            </form>
          </div>

          {/* Senha */}
          <div className={cardClass}>
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-orange-100 p-3 rounded-xl">
                <KeyRound className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Senha</h2>
                <p className="text-gray-600">
                  Mínimo de {MIN_PASSWORD_LENGTH} caracteres, igual ao cadastro.
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <label className="block">
                <span className={labelClass}>Senha atual</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => {
                    setCurrentPassword(event.target.value);
                    setPasswordError("");
                    setPasswordSaved(false);
                  }}
                  className={inputClass}
                />
              </label>

              <div className="grid sm:grid-cols-2 gap-5">
                <label className="block">
                  <span className={labelClass}>Nova senha</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      setPasswordError("");
                      setPasswordSaved(false);
                    }}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Confirmar nova senha</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setPasswordError("");
                      setPasswordSaved(false);
                    }}
                    className={inputClass}
                  />
                </label>
              </div>

              {passwordError && <FormMessage kind="error" message={passwordError} />}
              {passwordSaved && <FormMessage kind="success" message="Senha alterada." />}

              <button
                type="submit"
                className="bg-orange-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-700 transition-colors"
              >
                Alterar senha
              </button>
            </form>
          </div>

          {/* Acessibilidade */}
          <div className={cardClass}>
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-orange-100 p-3 rounded-xl">
                <Contrast className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Exibição</h2>
                <p className="text-gray-600">Vale para este navegador e fica salvo para a próxima visita.</p>
              </div>
            </div>

            <div className="space-y-6">
              <fieldset>
                <legend className={labelClass}>Tema</legend>
                <div className="grid sm:grid-cols-3 gap-3">
                  {themeOptions.map((option) => (
                    <OptionCard
                      key={option.id}
                      selected={theme === option.id}
                      onSelect={() => setTheme(option.id as Theme)}
                      label={option.label}
                      description={option.description}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className={labelClass}>
                  <span className="inline-flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    Tamanho do texto
                  </span>
                </legend>
                <div className="grid sm:grid-cols-3 gap-3">
                  {fontScaleOptions.map((option) => (
                    <OptionCard
                      key={option.id}
                      selected={fontScale === option.id}
                      onSelect={() => setFontScale(option.id as FontScale)}
                      label={option.label}
                      description={`Base de ${option.rootSize}`}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          </div>

          {/* Plano: so faz sentido para quem contrata */}
          {user.role === "empresa" && (
            <div className={cardClass}>
              <div className="flex items-start gap-4 mb-6">
                <div className="bg-orange-100 p-3 rounded-xl">
                  <CreditCard className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Plano</h2>
                  <p className="text-gray-600">{currentPlan.tagline}</p>
                </div>
              </div>

              <dl className="space-y-3 text-sm mb-6">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Plano atual</dt>
                  <dd className="font-bold text-gray-900">
                    {currentPlan.name}
                    {isPremium && ` · ${subscription.cycle}`}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Mensalidade</dt>
                  <dd className="font-bold text-gray-900">
                    {currentPlan.monthlyPrice === 0
                      ? "Grátis"
                      : `${currencyFormat.format(currentPlan.monthlyPrice)}/mês`}
                  </dd>
                </div>
                {isPremium && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">
                      {subscription.cancelAtPeriodEnd ? "Ativo até" : "Próxima cobrança"}
                    </dt>
                    <dd className="font-bold text-gray-900">{formatDate(subscription.renewsAt)}</dd>
                  </div>
                )}
              </dl>

              {subscription.cancelAtPeriodEnd && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">
                    A renovação automática está cancelada. Depois dessa data a conta volta ao plano gratuito.
                  </p>
                </div>
              )}

              <Link
                to="/planos"
                className="inline-block bg-orange-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-700 transition-colors"
              >
                Ver planos e faturas
              </Link>
            </div>
          )}

          {/* Encerrar conta */}
          <div className="bg-white rounded-2xl shadow-lg p-6 lg:p-8 border-2 border-red-100">
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-red-50 p-3 rounded-xl">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Encerrar conta</h2>
                <p className="text-gray-600">
                  Remove seus dados de acesso deste navegador. Não é possível desfazer.
                </p>
              </div>
            </div>

            {confirmingDelete ? (
              <div className="border-2 border-red-200 rounded-lg p-4">
                <p className="text-gray-700 mb-4">
                  Encerrar a conta <strong>{user.email}</strong>? Você será desconectado e os dados
                  de acesso serão apagados.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="bg-red-600 text-white px-5 py-3 rounded-lg font-bold hover:bg-red-700 transition-colors"
                  >
                    Sim, encerrar minha conta
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="border-2 border-gray-300 text-gray-700 px-5 py-3 rounded-lg font-bold hover:bg-gray-50 transition-colors"
                  >
                    Manter conta
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="border-2 border-red-200 text-red-700 px-5 py-3 rounded-lg font-bold hover:bg-red-50 transition-colors"
              >
                Encerrar conta
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function OptionCard({
  selected,
  onSelect,
  label,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`text-left border-2 rounded-xl p-4 transition-colors ${
        selected ? "border-orange-600 bg-orange-50" : "border-gray-200 hover:border-orange-300"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-gray-900">{label}</span>
        {selected && <Check className="w-4 h-4 text-orange-600 shrink-0" />}
      </div>
      <span className="block text-xs text-gray-600 mt-1">{description}</span>
    </button>
  );
}

function FormMessage({ kind, message }: { kind: "error" | "success"; message: string }) {
  const isError = kind === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`flex items-center gap-2 text-sm font-semibold ${
        isError ? "text-red-600" : "text-green-700"
      }`}
    >
      {isError ? (
        <AlertCircle className="w-4 h-4 shrink-0" />
      ) : (
        <Check className="w-4 h-4 shrink-0" />
      )}
      {message}
    </p>
  );
}
