import Link from "next/link";
import {
  formatarDecimal,
  formatarNumero,
  formatarPorcentagem,
} from "@/lib/formato";
import type { MetricasClientes } from "@/lib/metricas";
import styles from "./painel-clientes.module.css";

type PainelClientesProps = {
  metricas: MetricasClientes;
  timezone: string;
  query: string;
  exibirAtalhoRelatorios?: boolean;
};

function formatarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  const nacional = digitos.startsWith("55") && digitos.length > 11 ? digitos.slice(2) : digitos;
  if (nacional.length === 11) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  }
  if (nacional.length === 10) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  }
  return valor;
}

function formatarUltimoChamado(instante: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(instante));
  } catch {
    return "Data indisponível";
  }
}

export function PainelClientes({
  metricas,
  timezone,
  query,
  exibirAtalhoRelatorios = true,
}: PainelClientesProps) {
  const { resumo, ranking } = metricas;
  const maiorVolume = Math.max(1, ...ranking.map((cliente) => cliente.tickets));
  const relatoriosHref = query ? `/relatorios?${query}` : "/relatorios";

  return (
    <section className={styles.painel} aria-labelledby="titulo-clientes-recorrentes">
      <header className={styles.cabecalho}>
        <div>
          <p>Retenção e recorrência</p>
          <h2 id="titulo-clientes-recorrentes">Quem mais abriu chamados</h2>
          <span>
            Encontre clientes recorrentes e sinais que merecem acompanhamento antes de virarem
            insatisfação.
          </span>
        </div>
        {exibirAtalhoRelatorios ? <Link href={relatoriosHref}>Ver chamados</Link> : null}
      </header>

      <div className={styles.resumo} aria-label="Resumo dos clientes no período">
        <article>
          <span>Clientes atendidos</span>
          <strong className="numero">{formatarNumero(resumo.clientesAtendidos)}</strong>
          <small>Clientes únicos no período</small>
        </article>
        <article>
          <span>Recorrentes</span>
          <strong className="numero">{formatarNumero(resumo.clientesRecorrentes)}</strong>
          <small>
            {formatarPorcentagem(resumo.taxaRecorrencia)} abriram 2 ou mais chamados
          </small>
        </article>
        <article data-alerta={resumo.clientesEmAtencao > 0 || undefined}>
          <span>Precisam de atenção</span>
          <strong className="numero">{formatarNumero(resumo.clientesEmAtencao)}</strong>
          <small>Chamado aberto, SLA estourado ou nota baixa</small>
        </article>
      </div>

      {ranking.length > 0 ? (
        <ol className={styles.ranking} aria-label="Ranking de clientes por quantidade de chamados">
          {ranking.map((cliente, indice) => (
            <li key={cliente.id} data-atencao={cliente.emAtencao || undefined}>
              <span className={`${styles.posicao} numero`} aria-label={`${indice + 1}º lugar`}>
                {indice + 1}
              </span>

              <div className={styles.identidade}>
                <strong>{cliente.nome}</strong>
                <span>
                  {formatarTelefone(cliente.telefone)} · último chamado em{" "}
                  {formatarUltimoChamado(cliente.ultimoChamadoEm, timezone)}
                </span>
                <div className={styles.sinais} aria-label={`Sinais de ${cliente.nome}`}>
                  {cliente.abertos > 0 ? (
                    <small data-tom="alerta">
                      {formatarNumero(cliente.abertos)} {cliente.abertos === 1 ? "aberto" : "abertos"}
                    </small>
                  ) : null}
                  {cliente.slaEstourado > 0 ? (
                    <small data-tom="alerta">
                      {formatarNumero(cliente.slaEstourado)} fora do SLA
                    </small>
                  ) : null}
                  {cliente.avaliacoesNegativas > 0 ? (
                    <small data-tom="alerta">
                      {formatarNumero(cliente.avaliacoesNegativas)} {cliente.avaliacoesNegativas === 1 ? "nota baixa" : "notas baixas"}
                    </small>
                  ) : null}
                  {cliente.csat !== null ? (
                    <small>CSAT {formatarDecimal(cliente.csat)}</small>
                  ) : null}
                  {!cliente.emAtencao ? <small data-tom="ok">Sem sinal crítico</small> : null}
                </div>
              </div>

              <div className={styles.volume}>
                <strong className="numero">{formatarNumero(cliente.tickets)}</strong>
                <span>{cliente.tickets === 1 ? "chamado" : "chamados"}</span>
              </div>

              <div className={styles.trilho} aria-hidden>
                <span style={{ width: `${Math.max(4, (cliente.tickets / maiorVolume) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className={styles.vazio}>
          <strong>Nenhum cliente neste recorte</strong>
          <span>Quando novos chamados entrarem, o ranking aparecerá aqui.</span>
        </div>
      )}

      <p className={styles.criterio}>
        “Precisa de atenção” é um sinal operacional, não uma previsão de cancelamento.
      </p>
    </section>
  );
}
