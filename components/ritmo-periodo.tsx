"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatarNumero } from "@/lib/formato";
import type { BaldeSerie, SerieMeta } from "@/lib/metricas";
import styles from "./ritmo-periodo.module.css";

function formatadorDeBalde(meta: SerieMeta): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: meta.timezone,
    ...(meta.granularity === "hour"
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "short" }),
  });
}

export function RitmoPeriodo({ serie, meta }: { serie: BaldeSerie[]; meta: SerieMeta }) {
  const formatador = formatadorDeBalde(meta);
  const indicePico = serie.reduce(
    (melhor, item, indice) => (item.mensagens > (serie[melhor]?.mensagens ?? -1) ? indice : melhor),
    0,
  );
  const pico = serie[indicePico];
  const total = serie.reduce((soma, item) => soma + item.mensagens, 0);
  const rotuloPico = pico ? formatador.format(new Date(pico.instante)) : "—";
  const descricao =
    total === 0
      ? "Ritmo do período: nenhuma mensagem no intervalo selecionado."
      : `Ritmo do período: ${formatarNumero(total)} mensagens. Pico de ${formatarNumero(pico.mensagens)} em ${rotuloPico}.`;
  const dados = serie.map((item, indice) => ({
    ...item,
    eixo: formatador.format(new Date(item.instante)),
    rotuloPico: indice === indicePico && item.mensagens > 0 ? formatarNumero(item.mensagens) : "",
  }));

  return (
    <section className={styles.card} role="img" aria-label={descricao}>
      <header className={styles.cabecalho}>
        <div>
          <p>Fluxo de mensagens</p>
          <h2>Ritmo do período</h2>
        </div>
        <div className={styles.resumo}>
          <span>Pico</span>
          <strong className="numero">
            {total === 0 ? "—" : `${rotuloPico} · ${formatarNumero(pico.mensagens)}`}
          </strong>
        </div>
      </header>

      {total === 0 ? (
        <div className={styles.vazio}>Ainda não há mensagens neste recorte.</div>
      ) : (
        <div className={styles.grafico} aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 21, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis
                dataKey="eixo"
                axisLine={false}
                tickLine={false}
                minTickGap={28}
                tick={{ fill: "var(--muted-light)", fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                width={30}
                tick={{ fill: "var(--muted-light)", fontSize: 11 }}
                tickFormatter={(valor) => formatarNumero(Number(valor))}
              />
              <Tooltip
                cursor={{ fill: "var(--surface-soft)" }}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-sm)",
                  boxShadow: "var(--shadow-soft)",
                  color: "var(--ink)",
                  fontSize: 12,
                }}
                formatter={(valor) => [formatarNumero(Number(valor)), "Mensagens"]}
              />
              <Bar dataKey="mensagens" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false}>
                {dados.map((item, indice) => (
                  <Cell
                    key={item.instante}
                    fill={indice === indicePico ? "var(--primary)" : "var(--primary-soft)"}
                  />
                ))}
                <LabelList
                  dataKey="rotuloPico"
                  position="top"
                  fill="var(--primary-dark)"
                  fontSize={11}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
