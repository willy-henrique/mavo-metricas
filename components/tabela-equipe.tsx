"use client";

import { useMemo, useState } from "react";
import { formatarDecimal, formatarDuracao, formatarNumero } from "@/lib/formato";
import type { ProducaoAtendente } from "@/lib/metricas";
import styles from "./tabela-equipe.module.css";

type ChaveOrdenacao =
  | "nome"
  | "tickets"
  | "encerrados"
  | "tmeSegundos"
  | "tmaSegundos"
  | "csat"
  | "mensagensEnviadas";

type Direcao = "asc" | "desc";

const COLUNAS: Array<{ chave: ChaveOrdenacao; rotulo: string; dica?: string }> = [
  { chave: "nome", rotulo: "Atendente" },
  { chave: "tickets", rotulo: "Tickets" },
  { chave: "encerrados", rotulo: "Encerrados" },
  { chave: "tmeSegundos", rotulo: "TME", dica: "Tempo médio até a primeira resposta" },
  { chave: "tmaSegundos", rotulo: "TMA", dica: "Tempo médio até o encerramento" },
  { chave: "csat", rotulo: "CSAT" },
  { chave: "mensagensEnviadas", rotulo: "Mensagens" },
];

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toLocaleUpperCase("pt-BR"))
    .join("");
}

export function TabelaEquipe({ agentes }: { agentes: ProducaoAtendente[] }) {
  const [ordenacao, setOrdenacao] = useState<{ chave: ChaveOrdenacao; direcao: Direcao }>({
    chave: "tickets",
    direcao: "desc",
  });

  const ordenados = useMemo(() => {
    return [...agentes].sort((a, b) => {
      const aValor = a[ordenacao.chave];
      const bValor = b[ordenacao.chave];
      if (aValor === null && bValor === null) return a.nome.localeCompare(b.nome, "pt-BR");
      if (aValor === null) return 1;
      if (bValor === null) return -1;

      const comparacao =
        typeof aValor === "string"
          ? aValor.localeCompare(String(bValor), "pt-BR", { sensitivity: "base" })
          : Number(aValor) - Number(bValor);
      if (comparacao === 0) return a.nome.localeCompare(b.nome, "pt-BR");
      return ordenacao.direcao === "asc" ? comparacao : -comparacao;
    });
  }, [agentes, ordenacao]);

  function ordenar(chave: ChaveOrdenacao) {
    setOrdenacao((atual) => ({
      chave,
      direcao:
        atual.chave === chave ? (atual.direcao === "asc" ? "desc" : "asc") : chave === "nome" ? "asc" : "desc",
    }));
  }

  if (agentes.length === 0) {
    return (
      <section className={styles.vazio} aria-labelledby="equipe-vazia-titulo">
        <span aria-hidden>👤</span>
        <div>
          <h2 id="equipe-vazia-titulo">Nenhum atendente ativo</h2>
          <p>Ative ou cadastre atendentes no Mavo Talk para acompanhar a produção aqui.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="titulo-tabela-equipe">
      <header className={styles.cabecalho}>
        <div>
          <p>Comparativo individual</p>
          <h2 id="titulo-tabela-equipe">Produção por atendente</h2>
        </div>
        <span>Selecione uma coluna para ordenar</span>
      </header>

      <div className={styles.rolagem}>
        <table>
          <thead>
            <tr>
              {COLUNAS.map((coluna) => {
                const ativa = ordenacao.chave === coluna.chave;
                return (
                  <th
                    key={coluna.chave}
                    scope="col"
                    aria-sort={
                      ativa ? (ordenacao.direcao === "asc" ? "ascending" : "descending") : "none"
                    }
                    title={coluna.dica}
                  >
                    <button type="button" onClick={() => ordenar(coluna.chave)}>
                      {coluna.rotulo}
                      <span aria-hidden>{ativa ? (ordenacao.direcao === "asc" ? "↑" : "↓") : "↕"}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ordenados.map((agente) => (
              <tr key={agente.id}>
                <th scope="row">
                  <span className={styles.avatar} aria-hidden>
                    {iniciais(agente.nome)}
                  </span>
                  <span>
                    <strong>{agente.nome}</strong>
                    <small>{agente.tickets === 0 ? "Sem tickets no período" : "Atendente ativo"}</small>
                  </span>
                </th>
                <td className="numero">{formatarNumero(agente.tickets)}</td>
                <td className="numero">{formatarNumero(agente.encerrados)}</td>
                <td className="numero">{formatarDuracao(agente.tmeSegundos)}</td>
                <td className="numero">{formatarDuracao(agente.tmaSegundos)}</td>
                <td className="numero">
                  {agente.csat === null ? "—" : formatarDecimal(agente.csat)}
                  {agente.csatRespostas > 0 ? (
                    <small title={`${formatarNumero(agente.csatRespostas)} respostas`}>
                      {formatarNumero(agente.csatRespostas)} resp.
                    </small>
                  ) : null}
                </td>
                <td className="numero">{formatarNumero(agente.mensagensEnviadas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
