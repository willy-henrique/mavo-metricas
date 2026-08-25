"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";
import { formatarNumero, formatarVariacao } from "@/lib/formato";
import type { BaldeSerie, Overview } from "@/lib/metricas";
import styles from "./metrica-heroi.module.css";

export function MetricaHeroi({
  overview,
  serie,
  periodo,
}: {
  overview: Overview;
  serie: BaldeSerie[];
  periodo: string;
}) {
  const variacao = formatarVariacao(overview.atual.tickets, overview.anterior.tickets);
  const seta = variacao.sentido === "alta" ? "↗" : variacao.sentido === "baixa" ? "↘" : "→";

  return (
    <section className={styles.card} aria-labelledby="rotulo-tickets-periodo">
      <div className={styles.texto}>
        <p className={styles.rotulo} id="rotulo-tickets-periodo">
          Tickets · {periodo}
        </p>
        <div className={styles.valorLinha}>
          <strong className="numero">{formatarNumero(overview.atual.tickets)}</strong>
          <span className={styles.variacao} data-sentido={variacao.sentido}>
            <span aria-hidden>{seta}</span>
            {variacao.texto}
          </span>
        </div>
        <p className={styles.apoio}>
          {formatarNumero(overview.atual.encerrados)} encerrados no recorte selecionado
        </p>
      </div>

      <div className={styles.sparkline} aria-hidden>
        {serie.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie} margin={{ top: 8, right: 2, bottom: 4, left: 2 }}>
              <Line
                type="monotone"
                dataKey="tickets"
                stroke="var(--primary)"
                strokeWidth={2.2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <span />
        )}
      </div>
    </section>
  );
}
