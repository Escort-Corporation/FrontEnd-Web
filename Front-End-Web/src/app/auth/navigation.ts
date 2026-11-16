import type { Role } from "./AuthContext";

/**
 * Para onde cada perfil vai ao entrar, e o que o logo aponta enquanto houver
 * sessao: logado, "inicio" e a area de trabalho da pessoa, nao a landing de
 * vendas. Login, cadastro e cabecalho leem daqui para nao divergirem.
 */
export const homeByRole: Record<Role, string> = {
  admin: "/admin-usuarios",
  empresa: "/cadastro-cargas",
  motorista: "/mapa-operacional",
};

/**
 * Paineis internos e quem pode abrir cada um.
 * Precisa espelhar os `roles` das rotas em routes.tsx: um item visivel para
 * quem nao tem permissao leva a pessoa a clicar e ser devolvida para a home.
 */
export const panelItems: { path: string; label: string; roles: Role[] }[] = [
  { path: "/cadastro-cargas", label: "Cadastro de cargas", roles: ["admin", "empresa"] },
  { path: "/gestao-lotes", label: "Gestão de lotes", roles: ["admin", "empresa"] },
  { path: "/mapa-operacional", label: "Mapa operacional", roles: ["admin", "empresa", "motorista"] },
  { path: "/painel-esg", label: "Painel ESG", roles: ["admin", "empresa"] },
  { path: "/economia-frete", label: "Economia de frete", roles: ["admin", "empresa"] },
  { path: "/performance", label: "Performance", roles: ["admin", "empresa"] },
  { path: "/admin-documentos", label: "Documentos", roles: ["admin"] },
  { path: "/admin-usuarios", label: "Usuários", roles: ["admin"] },
  { path: "/planos", label: "Planos e faturas", roles: ["empresa"] },
  { path: "/chaves-api", label: "Chaves de API", roles: ["empresa"] },
];

/** Quantos paineis aparecem soltos no topo antes de sobrar para o menu "Mais". */
export const INLINE_PANEL_LIMIT = 4;

export function panelsForRole(role: Role) {
  return panelItems.filter((item) => item.roles.includes(role));
}
