import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Role = "admin" | "empresa" | "motorista";

export type AuthUser = {
  name: string;
  email: string;
  role: Role;
};

/** Falha de operacao da conta, com texto pronto para a tela. */
export type AccountError = { message: string };

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** Devolve a conta autenticada, para quem precisa do perfil logo apos o login. */
  login: (email: string, password: string) => Promise<AuthUser | null>;
  /**
   * O cadastro exige CPF/CNPJ, CNH ou RNTRC, que o formulario do site nao coleta.
   * Ate o formulario pedir esses dados, a conta e criada pelo aplicativo.
   */
  register: (
    name: string,
    email: string,
    password: string,
    role: Extract<Role, "empresa" | "motorista">,
  ) => Promise<AccountError>;
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
 * no navegador: ela vai so no corpo do POST de login. O token fica em sessionStorage, para
 * durar a aba e nao o navegador inteiro.
 *
 * VITE_API_URL continua apontando para o backend Java legado (relatorios e roteirizacao);
 * por isso o login tem a propria variavel.
 */
const API_URL: string = (import.meta.env.VITE_AUTH_API_URL as string | undefined) ?? "http://localhost:8000";

const userKey = "escort-auth-user";
const tokenKey = "escort-auth-token";

type ProfileResponse = { full_name: string; email: string; user_type: string };
type UserLoginResponse = { profile: ProfileResponse; session: { access_token: string } };
type AdminLoginResponse = {
  admin: { full_name: string; email: string };
  session: { access_token: string };
};

const roleByUserType: Record<string, Exclude<Role, "admin">> = {
  trucker: "motorista",
  shipper: "empresa",
  carrier: "empresa",
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(userKey);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem(tokenKey);
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

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

/** Chamada autenticada. Devolve null em caso de sucesso, ou a mensagem a exibir. */
async function authedRequest(method: string, path: string, body?: unknown): Promise<AccountError | null> {
  const token = readToken();
  if (!token) return { message: "Sessão expirada. Entre novamente." };
  try {
    const response = await fetch(`${API_URL}${path}`, {
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
          if (userLogin) {
            const role = roleByUserType[userLogin.profile.user_type.toLowerCase()];
            if (!role) return null;
            return startSession(
              { name: userLogin.profile.full_name, email: userLogin.profile.email, role },
              userLogin.session.access_token,
            );
          }

          // Administradores tem login separado. O gateway de producao nao expoe /admin/*,
          // entao isto so funciona falando direto com o api-auth.
          const adminLogin = await postJson<AdminLoginResponse>("/admin/login", credentials);
          if (adminLogin) {
            return startSession(
              { name: adminLogin.admin.full_name, email: adminLogin.admin.email, role: "admin" },
              adminLogin.session.access_token,
            );
          }
          return null;
        } catch {
          return null;
        }
      },

      register: async () => ({
        message:
          "O cadastro pelo site ainda não está disponível. Crie sua conta pelo aplicativo ou fale com o administrador.",
      }),

      logout: () => {
        const token = readToken();
        endSession();
        if (token) {
          // Melhor esforco: a sessao local ja foi encerrada, o servidor so revoga o token.
          void fetch(`${API_URL}/auth/logout`, {
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
