"use client";

import { useEffect, useState } from "react";
import { formatarDuracao, formatarNumero } from "@/lib/formato";
import type { SnapshotAgora } from "@/lib/metricas";
import styles from "./coluna-agora.module.css";

const INTERVALO_MS = 20_000;

export function ColunaAgora({ inicial }: { inicial: SnapshotAgora }) {
  const [dados, setDados] = useState(inicial);
  const [desatualizado, setDesatualizado] = useState(false);

  useEffect(() => {
    let ativo = true;
    let intervalo: ReturnType<typeof setInterval> | null = null;
    let requisicao: AbortController | null = null;

    async function buscar() {
      if (document.hidden || requisicao) return;
      const atual = new AbortController();
      requisicao = atual;

      try {
        const resposta = await fetch("/api/live", {
          cache: "no-store",
          signal: atual.signal,
        });
        if (!resposta.ok) throw new Error("Falha ao atualizar o bloco Agora");
        const novo = (await resposta.json()) as SnapshotAgora;
        if (!ativo) return;
        setDados(novo);
        setDesatualizado(false);
      } catch {
        if (ativo && !atual.signal.aborted) setDesatualizado(true);
      } finally {
        if (requisicao === atual) requisicao = null;
      }
    }

    function iniciar() {
      if (document.hidden || intervalo) return;
      intervalo = setInterval(() => void buscar(), INTERVALO_MS);
    }

    function parar() {
      if (intervalo) clearInterval(intervalo);
      intervalo = null;
      requisicao?.abort();
      requisicao = null;
    }

    function aoMudarVisibilidade() {
      if (document.hidden) {
        parar();
      } else {
        void buscar();
        iniciar();
      }
    }

    iniciar();
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      ativo = false;
      parar();
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, []);

  return (
    <aside className={styles.card} aria-labelledby="titulo-agora">
      <header className={styles.cabecalho}>
        <div>
          <span className={styles.status} data-desatualizado={desatualizado || undefined}>
            <span aria-hidden />
            {desatualizado ? "Sem conexão" : "Ao vivo"}
          </span>
          <h2 id="titulo-agora">Agora</h2>
        </div>
        <svg viewBox="0 0 24 24" aria-hidden className={styles.icone}>
          <path d="M4 12h3l2-5 4 10 2-5h5" />
        </svg>
      </header>

      <dl className={styles.metricas}>
        <Metrica rotulo="Na fila" valor={formatarNumero(dados.naFila)} destaque />
        <Metrica rotulo="Em atendimento" valor={formatarNumero(dados.emAtendimento)} />
        <Metrica rotulo="Aguardando cliente" valor={formatarNumero(dados.pendenteCliente)} />
        <Metrica
          rotulo="Espera mais longa"
          valor={formatarDuracao(dados.esperaMaisLongaSegundos)}
        />
      </dl>

      {dados.slaEmRisco > 0 ? (
        <div className={styles.alerta} role="status">
          <svg viewBox="0 0 20 20" aria-hidden>
            <path d="M10 3 2.8 16h14.4L10 3Zm0 4.5v3.8m0 2.2v.1" />
          </svg>
          <span>
            <strong>{formatarNumero(dados.slaEmRisco)}</strong>{" "}
            {dados.slaEmRisco === 1 ? "conversa perto" : "conversas perto"} do prazo de resposta
          </span>
        </div>
      ) : (
        <div className={styles.slaOk}>
          <span aria-hidden>✓</span>
          Nenhum SLA em risco
        </div>
      )}

      <p className={styles.rodape} aria-live="polite">
        {desatualizado
          ? "Mostrando o último estado conhecido. Tentaremos novamente."
          : "Atualização automática a cada 20 segundos."}
      </p>
    </aside>
  );
}

function Metrica({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className={styles.metrica} data-destaque={destaque || undefined}>
      <dt>{rotulo}</dt>
      <dd className="numero">{valor}</dd>
    </div>
  );
}
