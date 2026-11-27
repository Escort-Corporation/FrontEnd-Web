/** Pecas visuais compartilhadas pelas telas do fluxo do MVP (mesmo estilo do resto do site). */

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { FREIGHT_STATUS_LABEL, type FreightStatus } from "../../lib/platformApi";

/**
 * Implementos. O matching compara o implemento exigido pelo frete com o do veiculo por igualdade
 * de texto, entao o cadastro de frete e o de veiculo precisam usar exatamente esta lista.
 */
export const ATTACHMENT_TYPES = ["", "sider", "bau", "cacamba", "tanque", "graneleiro", "frigorifico"];

export const inputClass =
  "w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-orange-600";

export function PageShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="bg-gray-50 min-h-[calc(100vh-220px)] py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600 mb-8 max-w-3xl">{description}</p>
        <div className="space-y-6">{children}</div>
      </div>
    </section>
  );
}

export function Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-5 lg:p-6">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          {title && <h2 className="text-xl font-bold text-gray-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-bold text-gray-700 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

type Variant = "primary" | "secondary" | "danger";

const variantClass: Record<Variant, string> = {
  primary: "bg-orange-600 text-white hover:bg-orange-700",
  secondary: "border-2 border-gray-300 text-gray-700 hover:bg-gray-50",
  danger: "border-2 border-red-200 text-red-700 hover:bg-red-50",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClass[variant]} ${className}`}
    />
  );
}

export function Message({ kind, text }: { kind: "error" | "success" | "info"; text: string }) {
  if (!text) return null;
  const style = {
    error: "bg-red-50 text-red-700 border-red-200",
    success: "bg-green-50 text-green-700 border-green-200",
    info: "bg-gray-50 text-gray-700 border-gray-200",
  }[kind];
  return <p className={`border rounded-lg px-3 py-2 text-sm font-semibold ${style}`}>{text}</p>;
}

const statusStyle: Record<FreightStatus, string> = {
  published: "bg-blue-100 text-blue-800",
  matched: "bg-amber-100 text-amber-800",
  in_transit: "bg-orange-100 text-orange-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-gray-200 text-gray-700",
};

export function StatusBadge({ status }: { status: FreightStatus }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${statusStyle[status]}`}>
      {FREIGHT_STATUS_LABEL[status]}
    </span>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="text-gray-500 text-sm py-6 text-center">{text}</p>;
}

/** Rota "Cidade/UF → Cidade/UF". */
export function routeLabel(f: { origin_city: string; origin_state: string; destination_city: string; destination_state: string }) {
  return `${f.origin_city}/${f.origin_state} → ${f.destination_city}/${f.destination_state}`;
}
