"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sair } from "@/app/(painel)/actions";
import styles from "./nav-topo.module.css";

type NavTopoProps = {
  nome: string;
  empresa: string;
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

export function NavTopo({ nome, empresa }: NavTopoProps) {
  const pathname = usePathname();

  function estaAtivo(href: string): boolean {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

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
                >
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

          <details className={styles.perfil}>
            <summary aria-label={`Abrir menu de ${nome}`}>
              <span className={styles.identidade}>
                <strong>{nome}</strong>
                <small>{empresa}</small>
              </span>
              <span className={styles.avatar} aria-hidden>
                {inicial(nome)}
              </span>
            </summary>
            <div className={styles.menuPerfil}>
              <div>
                <strong>{nome}</strong>
                <span>{empresa}</span>
              </div>
              <form action={sair}>
                <button type="submit">Sair com segurança</button>
              </form>
            </div>
          </details>
        </div>
      </header>
    </>
  );
}
