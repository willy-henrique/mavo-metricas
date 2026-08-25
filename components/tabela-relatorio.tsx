import Link from "next/link";
import { formatarDecimal, formatarDuracao, formatarNumero } from "@/lib/formato";
import type { RelatorioTickets } from "@/lib/metricas";
import styles from "./tabela-relatorio.module.css";

type TabelaRelatorioProps = {
  dados: RelatorioTickets;
  timezone: string;
  query: string;
  possuiCursor: boolean;
};

const STATUS: Record<string, string> = {
  aguardando: "Na fila",
  em_atendimento: "Em atendimento",
  pendente_cliente: "Aguardando cliente",
  encerrado: "Encerrado",
};

function hrefComCursor(query: string, cursor: string): string {
  const params = new URLSearchParams(query);
  params.set("cursor", cursor);
  return `/relatorios?${params.toString()}`;
}

function hrefBase(query: string): string {
  return query ? `/relatorios?${query}` : "/relatorios";
}

function hrefCsv(query: string): string {
  return query ? `/api/relatorios/csv?${query}` : "/api/relatorios/csv";
}

function hrefPdf(query: string): string {
  return query ? `/api/relatorios/pdf?${query}` : "/api/relatorios/pdf";
}

export function TabelaRelatorio({
  dados,
  timezone,
  query,
  possuiCursor,
}: TabelaRelatorioProps) {
  const formatarData = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "short",
  });

  if (dados.linhas.length === 0) {
    return (
      <section className={styles.vazio} aria-labelledby="relatorio-vazio-titulo">
        <span aria-hidden>✓</span>
        <div>
          <h2 id="relatorio-vazio-titulo">Nenhum ticket neste recorte</h2>
          <p>Tente ampliar o período ou remover um dos filtros acima.</p>
          {possuiCursor ? <Link href={hrefBase(query)}>Voltar ao início</Link> : null}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="titulo-tabela-relatorio">
      <header className={styles.cabecalho}>
        <div>
          <p>Detalhamento operacional</p>
          <h2 id="titulo-tabela-relatorio">Tickets do período</h2>
          <span>
            {formatarNumero(dados.linhas.length)} nesta página · {formatarNumero(dados.total)} no
            recorte
          </span>
        </div>
        <div className={styles.exportacoes} aria-label="Exportar relatório">
          <a className={styles.exportarSecundario} href={hrefCsv(query)}>
            <svg viewBox="0 0 20 20" aria-hidden><path d="M10 3v9m0 0 3-3m-3 3L7 9M4 15.5h12" /></svg>
            Exportar CSV
          </a>
          <a className={styles.exportar} href={hrefPdf(query)}>
            <svg viewBox="0 0 20 20" aria-hidden><path d="M6 2.5h5l3 3v12H6v-15Zm5 0v3h3M8 10h4m-4 2.5h4" /></svg>
            Exportar PDF
          </a>
        </div>
      </header>

      <div className={styles.rolagem}>
        <table>
          <thead>
            <tr>
              <th scope="col">Ticket e contato</th>
              <th scope="col">Criado em</th>
              <th scope="col">Fila</th>
              <th scope="col">Atendente</th>
              <th scope="col">Status</th>
              <th scope="col" title="Tempo até a primeira resposta">
                TME
              </th>
              <th scope="col" title="Tempo até o encerramento">
                TMA
              </th>
              <th scope="col">SLA</th>
              <th scope="col">CSAT</th>
            </tr>
          </thead>
          <tbody>
            {dados.linhas.map((linha) => (
              <tr key={linha.id}>
                <th scope="row">
                  <span>
                    <strong>{linha.contatoNome}</strong>
                    <small>{linha.contatoTelefone}</small>
                  </span>
                  <code title={linha.id}>#{linha.id.slice(0, 8)}</code>
                </th>
                <td className="numero">{formatarData.format(new Date(linha.criadoEm))}</td>
                <td>{linha.fila}</td>
                <td>{linha.atendente}</td>
                <td>
                  <span className={styles.status} data-status={linha.status}>
                    {STATUS[linha.status] ?? linha.status.replaceAll("_", " ")}
                  </span>
                </td>
                <td className="numero">{formatarDuracao(linha.tmeSegundos)}</td>
                <td className="numero">{formatarDuracao(linha.tmaSegundos)}</td>
                <td>
                  <span className={linha.slaEstourado ? styles.slaRuim : styles.slaBom}>
                    <i aria-hidden />
                    {linha.slaEstourado ? "Estourado" : "No prazo"}
                  </span>
                </td>
                <td className="numero">
                  {linha.csat === null ? "—" : `${formatarDecimal(linha.csat)} / 5`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className={styles.paginacao} aria-label="Paginação do relatório">
        <span>Ordem: tickets mais recentes primeiro</span>
        <nav>
          {possuiCursor ? <Link href={hrefBase(query)}>Voltar ao início</Link> : null}
          {dados.proximoCursor ? (
            <Link className={styles.proxima} href={hrefComCursor(query, dados.proximoCursor)}>
              Próxima página <span aria-hidden>→</span>
            </Link>
          ) : (
            <span>Fim do relatório</span>
          )}
        </nav>
      </footer>
    </section>
  );
}
