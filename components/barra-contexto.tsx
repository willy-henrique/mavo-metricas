"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { PERIODOS, type ChavePeriodo } from "@/lib/periodo";
import { PilulaFiltro } from "./pilula-filtro";
import styles from "./barra-contexto.module.css";

export type OpcoesContexto = {
  filas: Array<{ id: string; nome: string; cor: string }>;
  atendentes: Array<{ id: string; nome: string }>;
};

type BarraContextoProps = {
  empresa: string;
  opcoes: OpcoesContexto;
  periodoAtivo: ChavePeriodo;
  query: string;
};

function valorData(valor: string | null): string {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : "";
}

export function BarraContexto({ empresa, opcoes, periodoAtivo, query }: BarraContextoProps) {
  const router = useRouter();
  const pathname = usePathname();
  const detailsPeriodo = useRef<HTMLDetailsElement>(null);
  const params = useMemo(() => new URLSearchParams(query), [query]);
  const [customVisivel, setCustomVisivel] = useState(periodoAtivo === "custom");
  const [from, setFrom] = useState(() => valorData(params.get("from")));
  const [to, setTo] = useState(() => valorData(params.get("to")));
  const [erroCustom, setErroCustom] = useState<string | null>(null);
  const periodo = PERIODOS.find((item) => item.chave === periodoAtivo) ?? PERIODOS[0];

  function navegar(proximos: URLSearchParams) {
    const sufixo = proximos.toString();
    router.push(`${pathname}${sufixo ? `?${sufixo}` : ""}`, { scroll: false });
  }

  function selecionarPeriodo(chave: ChavePeriodo) {
    if (chave === "custom") {
      setCustomVisivel(true);
      return;
    }
    const proximos = new URLSearchParams(params);
    proximos.set("periodo", chave);
    proximos.delete("from");
    proximos.delete("to");
    detailsPeriodo.current?.removeAttribute("open");
    navegar(proximos);
  }

  function atualizarCustom(campo: "from" | "to", valor: string) {
    const proximoFrom = campo === "from" ? valor : from;
    const proximoTo = campo === "to" ? valor : to;
    if (campo === "from") setFrom(valor);
    else setTo(valor);

    if (!proximoFrom || !proximoTo) {
      setErroCustom(null);
      return;
    }
    if (proximoTo <= proximoFrom) {
      setErroCustom("A data final precisa ser posterior à inicial.");
      return;
    }

    setErroCustom(null);
    const proximos = new URLSearchParams(params);
    proximos.set("periodo", "custom");
    proximos.set("from", proximoFrom);
    proximos.set("to", proximoTo);
    detailsPeriodo.current?.removeAttribute("open");
    navegar(proximos);
  }

  return (
    <section className={styles.barra} aria-label="Contexto dos indicadores">
      <div className={styles.interior}>
        <div className={styles.empresa} title={empresa}>
          <span className={styles.empresaIcone} aria-hidden>
            E
          </span>
          <span>
            <small>Empresa</small>
            <strong>{empresa}</strong>
          </span>
        </div>

        <span className={styles.divisor} aria-hidden />

        <details className={styles.pilulaWrapper} ref={detailsPeriodo}>
          <summary className={styles.pilula}>
            <span className={styles.rotulo}>Período</span>
            <strong>{periodo.rotulo}</strong>
            <span className={styles.chevron} aria-hidden>
              ⌄
            </span>
          </summary>
          <div className={`${styles.popover} ${styles.popoverPeriodo}`}>
            <div className={styles.periodosRapidos} aria-label="Períodos rápidos">
              {PERIODOS.filter((item) => item.chave !== "custom").map((item) => (
                <button
                  className={styles.opcao}
                  data-selecionada={periodoAtivo === item.chave || undefined}
                  type="button"
                  key={item.chave}
                  onClick={() => selecionarPeriodo(item.chave)}
                  aria-pressed={periodoAtivo === item.chave}
                >
                  {item.rotulo}
                  {periodoAtivo === item.chave ? <span aria-hidden>✓</span> : null}
                </button>
              ))}
              <button
                className={styles.opcao}
                data-selecionada={periodoAtivo === "custom" || undefined}
                type="button"
                onClick={() => selecionarPeriodo("custom")}
                aria-expanded={customVisivel}
              >
                Personalizado
                {periodoAtivo === "custom" ? <span aria-hidden>✓</span> : null}
              </button>
            </div>

            {customVisivel ? (
              <div className={styles.custom}>
                <p>As datas são interpretadas no fuso da empresa.</p>
                <label>
                  De
                  <input
                    type="date"
                    value={from}
                    onChange={(evento) => atualizarCustom("from", evento.target.value)}
                  />
                </label>
                <label>
                  Até (limite exclusivo)
                  <input
                    type="date"
                    value={to}
                    onChange={(evento) => atualizarCustom("to", evento.target.value)}
                  />
                </label>
                <span className={styles.dica}>O intervalo muda assim que as duas datas forem válidas.</span>
                {erroCustom ? (
                  <span className={styles.erroCustom} role="alert">
                    {erroCustom}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </details>

        <PilulaFiltro
          parametro="fila"
          aliases={["queue_id"]}
          rotulo="Fila"
          rotuloPadrao="Todas as filas"
          valorAtual={params.get("fila") ?? params.get("queue_id")}
          opcoes={opcoes.filas.map((fila) => ({
            valor: fila.id,
            rotulo: fila.nome,
            cor: fila.cor,
          }))}
          query={query}
        />

        <PilulaFiltro
          parametro="atendente"
          aliases={["assignee_id"]}
          rotulo="Atendente"
          rotuloPadrao="Todos os atendentes"
          valorAtual={params.get("atendente") ?? params.get("assignee_id")}
          opcoes={opcoes.atendentes.map((atendente) => ({
            valor: atendente.id,
            rotulo: atendente.nome,
          }))}
          query={query}
        />
      </div>
    </section>
  );
}
