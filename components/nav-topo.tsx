"use client";

import { useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { sair } from "@/app/(painel)/actions";
import { TemaToggle } from "./tema-toggle";
import styles from "./nav-topo.module.css";

type NavTopoProps = {
  nome: string;
  empresa: string;
  role: "admin" | "gestor";
};

const itens = [
  { chave: "visao-geral", rotulo: "Visão geral", href: "/", disponivel: true },
  { chave: "relatorios", rotulo: "Relatórios", href: "/relatorios", disponivel: true },
  { chave: "automatico", rotulo: "Automático", href: "/automatico", disponivel: true },
  { chave: "equipe", rotulo: "Equipe", href: "/equipe", disponivel: true },
];

function inicial(nome: string): string {
  return nome.trim().charAt(0).toLocaleUpperCase("pt-BR") || "M";
}

function IconeNav({ chave }: { chave: string }) {
  if (chave === "visao-geral") {
    return <svg viewBox="0 0 24 24" aria-hidden><path d="M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z" /></svg>;
  }
  if (chave === "relatorios") {
    return <svg viewBox="0 0 24 24" aria-hidden><path d="M5 20V10m7 10V4m7 16v-7M3 20h18" /></svg>;
  }
  if (chave === "automatico") {
    return <svg viewBox="0 0 24 24" aria-hidden><path d="M8 8h8a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4Zm4 0V4m-3 9h.1m5.9 0h.1M9 17h6" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden><path d="M16 20v-1.6a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20m7-9.6a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 9.6v-1.6a4 4 0 0 0-3-3.87m-3-12a4 4 0 0 1 0 7.74" /></svg>;
}

export function NavTopo({ nome, empresa, role }: NavTopoProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [destinoPendente, setDestinoPendente] = useState<string | null>(null);
  const [transicaoPendente, iniciarTransicao] = useTransition();

  function estaAtivo(href: string): boolean {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  function navegar(evento: MouseEvent<HTMLAnchorElement>, href: string) {
    if (
      evento.button !== 0
      || evento.metaKey
      || evento.ctrlKey
      || evento.shiftKey
      || evento.altKey
      || evento.currentTarget.target === "_blank"
    ) {
      return;
    }

    evento.preventDefault();
    if (href === pathname) return;
    setDestinoPendente(href);
    iniciarTransicao(() => router.push(href));
  }

  const navegando = transicaoPendente && destinoPendente !== null;
  const destinoRotulo = itens.find((item) => item.href === destinoPendente)?.rotulo;

  return (
    <>
      <a className={styles.pular} href="#conteudo-principal">
        Pular para o conteúdo
      </a>
      <header className={styles.cabecalho}>
        <div className={styles.interior}>
          <Link className={styles.marca} href="/" aria-label="Mavo Gerenciamento — início">
            <span className={styles.simbolo} aria-hidden>
              M
            </span>
            <span className={styles.nomeMarca}>Mavo</span>
          </Link>

          <nav className={styles.navegacao} aria-label="Navegação principal">
            {itens.map((item) =>
              item.disponivel ? (
                <Link
                  className={styles.link}
                  data-ativo={estaAtivo(item.href) || undefined}
                  href={item.href}
                  key={item.chave}
                  aria-current={estaAtivo(item.href) ? "page" : undefined}
                  aria-busy={navegando && destinoPendente === item.href ? true : undefined}
                  data-carregando={navegando && destinoPendente === item.href ? true : undefined}
                  onClick={(evento) => navegar(evento, item.href)}
                >
                  <IconeNav chave={item.chave} />
                  {item.rotulo}
                </Link>
              ) : (
                <span
                  className={styles.link}
                  data-desabilitado
                  key={item.chave}
                  aria-disabled="true"
                  title={`${item.rotulo} — em breve`}
                >
                  {item.rotulo}
                </span>
              ),
            )}
          </nav>

          <div className={styles.acoes}>
            <TemaToggle />
            <details className={styles.perfil}>
              <summary aria-label={`Abrir menu de ${nome}`}>
                <span className={styles.identidade}>
                  <strong>{nome}</strong>
                  <small>{empresa}</small>
                </span>
                <span className={styles.avatar} aria-hidden>
                  {inicial(nome)}
                </span>
                <svg className={styles.setaPerfil} viewBox="0 0 20 20" aria-hidden>
                  <path d="m6 8 4 4 4-4" />
                </svg>
              </summary>
              <div className={styles.menuPerfil}>
                <div>
                  <strong>{nome}</strong>
                  <span>{empresa}</span>
                </div>
                {role === "admin" ? (
                  <Link className={styles.menuLink} href="/configuracoes">
                    <span aria-hidden>⚙</span> Configurações da empresa
                  </Link>
                ) : null}
                <form action={sair}>
                  <button type="submit">Sair com segurança</button>
                </form>
              </div>
            </details>
          </div>
        </div>
        <span className={styles.progressoNavegacao} data-visivel={navegando || undefined} aria-hidden>
          <span />
        </span>
        <span className={styles.statusNavegacao} role="status" aria-live="polite">
          {navegando ? `Abrindo ${destinoRotulo ?? "página"}` : ""}
        </span>
      </header>
    </>
  );
}
