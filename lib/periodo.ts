export const PERIODOS = [
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "ontem", rotulo: "Ontem" },
  { chave: "semana", rotulo: "Semana" },
  { chave: "mes", rotulo: "Mês" },
  { chave: "7d", rotulo: "7 dias" },
  { chave: "30d", rotulo: "30 dias" },
  { chave: "90d", rotulo: "90 dias" },
  { chave: "custom", rotulo: "Personalizado" },
] as const;

export type ChavePeriodo = (typeof PERIODOS)[number]["chave"];

const CHAVES = new Set<ChavePeriodo>(PERIODOS.map((periodo) => periodo.chave));

export function periodoDaUrl(params: URLSearchParams): {
  chave: ChavePeriodo;
  from?: string;
  to?: string;
} {
  const candidato = params.get("periodo") ?? "hoje";
  const chave = CHAVES.has(candidato as ChavePeriodo) ? (candidato as ChavePeriodo) : "hoje";
  if (chave !== "custom") return { chave };
  return {
    chave,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  };
}

export function urlComFiltro(
  atual: URLSearchParams,
  chave: string,
  valor: string | null,
): string {
  const proximo = new URLSearchParams(atual);
  if (valor === null || valor === "") proximo.delete(chave);
  else proximo.set(chave, valor);
  const query = proximo.toString();
  return query ? `?${query}` : "";
}
