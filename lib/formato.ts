const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatarNumero(valor: number): string {
  if (!Number.isFinite(valor)) return "—";
  return NUMERO.format(Math.round(valor));
}

export function formatarDecimal(valor: number | null): string {
  if (valor === null || !Number.isFinite(valor)) return "—";
  return DECIMAL.format(valor);
}

export function formatarDuracao(segundos: number | null): string {
  if (segundos === null || !Number.isFinite(segundos) || segundos < 0) return "—";
  const totalSegundos = Math.round(segundos);
  if (totalSegundos < 60) return `${totalSegundos}s`;

  const totalMinutos = Math.round(totalSegundos / 60);
  if (totalMinutos < 60) return `${totalMinutos}min`;

  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  return minutos === 0 ? `${horas}h` : `${horas}h${String(minutos).padStart(2, "0")}`;
}

export function formatarPorcentagem(fracao: number | null): string {
  if (fracao === null || !Number.isFinite(fracao)) return "—";
  return `${Math.round(fracao * 100)}%`;
}

export type VariacaoFormatada = {
  texto: string;
  sentido: "alta" | "baixa" | "estavel";
};

export function formatarVariacao(atual: number, anterior: number): VariacaoFormatada {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior)) {
    return { texto: "sem base de comparação", sentido: "estavel" };
  }
  if (anterior === 0) {
    if (atual === 0) return { texto: "sem mudança", sentido: "estavel" };
    return { texto: "sem base de comparação", sentido: atual > 0 ? "alta" : "baixa" };
  }

  const fracao = (atual - anterior) / Math.abs(anterior);
  const porcentagem = Math.abs(Math.round(fracao * 100));
  if (porcentagem === 0) return { texto: "sem mudança", sentido: "estavel" };
  return {
    texto: `${porcentagem}% ${fracao > 0 ? "acima" : "abaixo"} do período anterior`,
    sentido: fracao > 0 ? "alta" : "baixa",
  };
}
