"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { urlComFiltro } from "@/lib/periodo";
import styles from "./barra-contexto.module.css";

export type OpcaoPilula = {
  valor: string;
  rotulo: string;
  cor?: string;
};

type PilulaFiltroProps = {
  parametro: string;
  aliases?: string[];
  rotulo: string;
  rotuloPadrao: string;
  valorAtual: string | null;
  opcoes: OpcaoPilula[];
  query: string;
};

export function PilulaFiltro({
  parametro,
  aliases = [],
  rotulo,
  rotuloPadrao,
  valorAtual,
  opcoes,
  query,
}: PilulaFiltroProps) {
  const router = useRouter();
  const pathname = usePathname();
  const details = useRef<HTMLDetailsElement>(null);
  const selecionada = opcoes.find((opcao) => opcao.valor === valorAtual);

  function selecionar(valor: string | null) {
    const atuais = new URLSearchParams(query);
    for (const alias of aliases) atuais.delete(alias);
    const destino = urlComFiltro(atuais, parametro, valor);
    details.current?.removeAttribute("open");
    router.push(`${pathname}${destino}`, { scroll: false });
  }

  return (
    <details className={styles.pilulaWrapper} ref={details}>
      <summary className={styles.pilula}>
        <span className={styles.rotulo}>{rotulo}</span>
        <strong>{selecionada?.rotulo ?? rotuloPadrao}</strong>
        <span className={styles.chevron} aria-hidden>
          ⌄
        </span>
      </summary>
      <div className={styles.popover} role="group" aria-label={`Opções de ${rotulo}`}>
        <button
          className={styles.opcao}
          data-selecionada={!valorAtual || undefined}
          type="button"
          onClick={() => selecionar(null)}
          aria-pressed={!valorAtual}
        >
          <span className={styles.marcadorNeutro} aria-hidden />
          {rotuloPadrao}
          {!valorAtual ? <span aria-hidden>✓</span> : null}
        </button>
        {opcoes.map((opcao) => (
          <button
            className={styles.opcao}
            data-selecionada={valorAtual === opcao.valor || undefined}
            type="button"
            key={opcao.valor}
            onClick={() => selecionar(opcao.valor)}
            aria-pressed={valorAtual === opcao.valor}
          >
            <span
              className={opcao.cor ? styles.marcadorCor : styles.marcadorNeutro}
              style={opcao.cor ? { backgroundColor: opcao.cor } : undefined}
              aria-hidden
            />
            {opcao.rotulo}
            {valorAtual === opcao.valor ? <span aria-hidden>✓</span> : null}
          </button>
        ))}
      </div>
    </details>
  );
}
