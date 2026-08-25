import { periodoDaUrl } from "@/lib/periodo";

export type ParametrosBusca = Record<string, string | string[] | undefined>;

const PARAMETROS_ACEITOS = [
  "periodo",
  "from",
  "to",
  "fila",
  "atendente",
  "queue_id",
  "assignee_id",
] as const;

export function parametrosMetricas(entrada: ParametrosBusca): URLSearchParams {
  const params = new URLSearchParams();
  for (const chave of PARAMETROS_ACEITOS) {
    const bruto = entrada[chave];
    const valor = Array.isArray(bruto) ? bruto[0] : bruto;
    if (valor?.trim()) params.set(chave, valor.trim());
  }

  const resolvido = periodoDaUrl(params);
  if (params.has("periodo") && params.get("periodo") !== resolvido.chave) {
    params.set("periodo", resolvido.chave);
    params.delete("from");
    params.delete("to");
  }
  return params;
}
