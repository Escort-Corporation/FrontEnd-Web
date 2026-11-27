import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { GATEWAY_URL, getAccessToken } from "../lib/platformApi";

export type Role = "admin" | "empresa" | "motorista";

/**
 * Tipo real da conta no api-auth. "empresa" cobre dois perfis com telas diferentes:
 * a ESF (embarcador, `shipper`) publica fretes; a ECF (transportadora, `carrier`) tem a frota.
 */
export type AccountKind = "admin" | "shipper" | "carrier" | "trucker";

export type AuthUser = {
  name: string;
  email: string;
  role: Role;
  kind: AccountKind;
};

/** Falha de operacao da conta, com texto pronto para a tela. */
export type AccountError = { message: string };

/** Dados do cadastro. Empresa (ESF/ECF) informa CNPJ; motorista informa CPF e CNH. */
export type SignUpInput =
  | {
      kind: "shipper" | "carrier";
      name: string;
      email: string;
      password: string;
      phone?: string;
      companyName: string;
      documentNumber: string;
      rntrcNumber?: string;
      city?: string;
      state?: string;
    }
  | {
      kind: "trucker";
      name: string;
      email: string;
      password: string;
      phone?: string;
      documentNumber: string;
      licenseNumber: string;
      licenseCategory: string;
      city?: string;
      state?: string;
    };

/** Resultado do cadastro: entra direto, ou precisa confirmar o e-mail antes. */
export type SignUpResult = { user: AuthUser | null; message: string | null; error: string | null };

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** Devolve a conta autenticada, para quem precisa do perfil logo apos o login. */
  login: (email: string, password: string) => Promise<AuthUser | null>;
  register: (input: SignUpInput) => Promise<SignUpResult>;
  logout: () => void;
  /** Null em caso de sucesso; com erro, a mensagem a exibir. */
  updateName: (name: string) => Promise<AccountError | null>;
  changePassword: (current: string, next: string) => Promise<AccountError | null>;
  deleteAccount: () => Promise<AccountError | null>;
};

/** Minimo exigido pelo api-auth no cadastro. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Autenticacao real pelo api-auth (Supabase Auth), atraves do gateway. Nenhuma senha fica
 * no navegador: ela vai so no corpo do POST. O token fica em sessionStorage, para durar a
 * aba e nao o navegador inteiro.
 */
const userKey = "escort-auth-user";
const tokenKey = "escort-auth-token";

type ProfileResponse = { full_name: string; email: string; user_type: string };
type Session = { access_token: string };
type UserLoginResponse = { profile: ProfileResponse; session: Session };
type SignUpResponse = { profile: ProfileResponse; session: Session | null; message: string | null };
type AdminLoginResponse = {
  admin: { full_name: string; email: string };
  session: Session;
};

const roleByKind: Record<Exclude<AccountKind, "admin">, Exclude<Role, "admin">> = {
  trucker: "motorista",
  shipper: "empresa",
  carrier: "empresa",
};

function toUser(profile: ProfileResponse): AuthUser | null {
  const kind = profile.user_type.toLowerCase() as Exclude<AccountKind, "admin">;
  const role = roleByKind[kind];
  if (!role) return null;
  return { name: profile.full_name, email: profile.email, role, kind };
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(userKey);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<AuthUser>;
    // Sessao gravada por uma versao anterior, sem o tipo da conta: pede login de novo.
    return stored.kind ? (stored as AuthUser) : null;
  } catch {
    return null;
  }
}

function persistSession(user: AuthUser, accessToken?: string) {
  try {
    sessionStorage.setItem(userKey, JSON.stringify(user));
    if (accessToken) sessionStorage.setItem(tokenKey, accessToken);
  } catch {
    // Armazenamento bloqueado: a sessao vale so ate recarregar a pagina.
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(userKey);
    sessionStorage.removeItem(tokenKey);
  } catch {
    // nada a fazer
  }
}

async function postJson<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.ok) return { ok: true, data: (await response.json()) as T };
  let message = "";
  try {
    const data = (await response.json()) as { error?: { message?: string } };
    message = data.error?.message ?? "";
  } catch {
    // corpo nao-JSON
  }
  return { ok: false, message };
}

/** Chamada autenticada. Devolve null em caso de sucesso, ou a mensagem a exibir. */
async function authedRequest(method: string, path: string, body?: unknown): Promise<AccountError | null> {
  const token = getAccessToken();
  if (!token) return { message: "Sessão expirada. Entre novamente." };
  try {
    const response = await fetch(`${GATEWAY_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (response.ok) return null;
    if (response.status === 401) return { message: "Sessão expirada. Entre novamente." };
    return { message: "Não foi possível concluir a operação. Tente novamente." };
  } catch {
    return { message: "Sem conexão com o servidor. Tente novamente." };
  }
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

/** Corpo do POST /auth/signup no formato do api-auth. */
function toSignUpBody(input: SignUpInput) {
  const base = {
    email: input.email.trim().toLowerCase(),
    password: input.password,
    full_name: input.name.trim(),
    phone: input.phone?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim().toUpperCase() || null,
  };
  if (input.kind === "trucker") {
    return {
      ...base,
      user_type: "trucker",
      document_number: onlyDigits(input.documentNumber),
      license_number: onlyDigits(input.licenseNumber),
      license_category: input.licenseCategory.trim().toUpperCase(),
    };
  }
  return {
    ...base,
    user_type: input.kind,
    entity_type: "company",
    company_name: input.companyName.trim(),
    document_number: onlyDigits(input.documentNumber),
    ...(input.kind === "carrier" && input.rntrcNumber ? { rntrc_number: onlyDigits(input.rntrcNumber) } : {}),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  const value = useMemo<AuthContextValue>(() => {
    function startSession(nextUser: AuthUser, accessToken: string) {
      persistSession(nextUser, accessToken);
      setUser(nextUser);
      return nextUser;
    }

    function endSession() {
      clearSession();
      setUser(null);
    }

    return {
      user,
      isAuthenticated: Boolean(user),

      login: async (email, password) => {
        const credentials = { email: email.trim(), password };
        try {
          const userLogin = await postJson<UserLoginResponse>("/auth/login", credentials);
          if (userLogin.ok) {
            const nextUser = toUser(userLogin.data.profile);
            return nextUser ? startSession(nextUser, userLogin.data.session.access_token) : null;
          }

          // Administradores tem login separado. O gateway de producao nao expoe /admin/*,
          // entao isto so funciona falando direto com o api-auth.
          const adminLogin = await postJson<AdminLoginResponse>("/admin/login", credentials);
          if (adminLogin.ok) {
            return startSession(
              {
                name: adminLogin.data.admin.full_name,
                email: adminLogin.data.admin.email,
                role: "admin",
                kind: "admin",
              },
              adminLogin.data.session.access_token,
            );
          }
          return null;
        } catch {
          return null;
        }
      },

      register: async (input) => {
        try {
          const result = await postJson<SignUpResponse>("/auth/signup", toSignUpBody(input));
          if (!result.ok) {
            return { user: null, message: null, error: result.message || "Não foi possível criar a conta." };
          }
          const nextUser = toUser(result.data.profile);
          if (nextUser && result.data.session) {
            return { user: startSession(nextUser, result.data.session.access_token), message: null, error: null };
          }
          // Projeto com confirmacao de e-mail: a conta existe, mas so entra depois de confirmar.
          return {
            user: null,
            message: result.data.message ?? "Conta criada. Confirme seu e-mail para entrar.",
            error: null,
          };
        } catch {
          return { user: null, message: null, error: "Sem conexão com o servidor. Tente novamente." };
        }
      },

      logout: () => {
        const token = getAccessToken();
        endSession();
        if (token) {
          // Melhor esforco: a sessao local ja foi encerrada, o servidor so revoga o token.
          void fetch(`${GATEWAY_URL}/auth/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => undefined);
        }
      },

      updateName: async (name) => {
        if (!user) return { message: "Sessão expirada. Entre novamente." };
        if (user.role === "admin") return { message: "O nome do administrador não é editável por aqui." };

        const trimmed = name.trim();
        if (trimmed.length < 3) return { message: "O nome precisa ter pelo menos 3 caracteres." };

        const error = await authedRequest("PATCH", "/users/me", { full_name: trimmed });
        if (error) return error;

        const nextUser = { ...user, name: trimmed };
        persistSession(nextUser);
        setUser(nextUser);
        return null;
      },

      // O api-auth nao tem troca de senha autenticada; o caminho e o link por e-mail.
      changePassword: async () => ({
        message: "A troca de senha pelo site ainda não está disponível. Use a recuperação de senha do aplicativo.",
      }),

      deleteAccount: async () => {
        if (!user) return { message: "Sessão expirada. Entre novamente." };
        if (user.role === "admin") return { message: "A conta de administrador não pode ser excluída por aqui." };

        const error = await authedRequest("DELETE", "/users/me");
        if (error) return error;
        endSession();
        return null;
      },
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
