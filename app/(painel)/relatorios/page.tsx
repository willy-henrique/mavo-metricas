import { redirect } from "next/navigation";
import { BarraContexto } from "@/components/barra-contexto";
import { PainelClientes } from "@/components/painel-clientes";
import { TabelaRelatorio } from "@/components/tabela-relatorio";
import { carregarContextoPainel } from "@/lib/contexto-painel";
import { parametrosMetricas, type ParametrosBusca } from "@/lib/consulta-metricas";
import { formatarDuracao, formatarNumero } from "@/lib/formato";
import {
  metricasClientesSchema,
  metricasFilasSchema,
  metricsMetaSchema,
  opcoesContextoSchema,
  relatorioTicketsSchema,
} from "@/lib/metricas";
import { periodoDaUrl } from "@/lib/periodo";
import { TalkError, talkGet } from "@/lib/talk-client";
import painelStyles from "../painel.module.css";
import styles from "./relatorios.module.css";

export const dynamic = "force-dynamic";

function valorUnico(valor: string | string[] | undefined): string | null {
  const primeiro = Array.isArray(valor) ? valor[0] : valor;
  return primeiro?.trim() || null;
}

function cursorSeguro(valor: string | null): string | null {
  return valor && /^[a-z0-9_-]{1,512}$/i.test(valor) ? valor : null;
}

async function carregarRelatorios(token: string, query: string, cursor: string | null) {
  const paramsRelatorio = new URLSearchParams(query);
  paramsRelatorio.set("limite", "50");
  if (cursor) paramsRelatorio.set("cursor", cursor);

  try {
    const [respostaRelatorio, respostaClientes, respostaFilas, respostaFiltros] = await Promise.all([
      talkGet<unknown>(`/reports/tickets?${paramsRelatorio.toString()}`, { token }),
      talkGet<unknown>(`/customers${query ? `?${query}` : ""}`, { token }),
      talkGet<unknown>(`/queues${query ? `?${query}` : ""}`, { token }),
      talkGet<unknown>("/filters", { token }),
    ]);
    const meta = metricsMetaSchema.parse(respostaRelatorio.meta);
    metricsMetaSchema.parse(respostaClientes.meta);
    metricsMetaSchema.parse(respostaFilas.meta);
    metricsMetaSchema.parse(respostaFiltros.meta);
    return {
      estado: "pronto" as const,
      relatorio: relatorioTicketsSchema.parse(respostaRelatorio.data),
      clientes: metricasClientesSchema.parse(respostaClientes.data),
      filas: metricasFilasSchema.parse(respostaFilas.data),
      filtros: opcoesContextoSchema.parse(respostaFiltros.data),
      meta,
    };
  } catch (erro) {
    return { estado: "erro" as const, erro };
  }
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<ParametrosBusca>;
}) {
  const contexto = await carregarContextoPainel();
  if (contexto.estado === "anonimo" || contexto.estado === "invalido") {
    redirect("/login?motivo=sessao");
  }
  if (contexto.estado === "indisponivel") {
    return <EstadoRelatorios titulo="O Mavo Talk está acordando" />;
  }

  const busca = await searchParams;
  const params = parametrosMetricas(busca);
  const periodo = periodoDaUrl(params);
  const query = params.toString();
  const cursor = cursorSeguro(valorUnico(busca.cursor));
  const resultado = await carregarRelatorios(contexto.sessao.token, query, cursor);

  if (resultado.estado === "erro") {
    if (
      resultado.erro instanceof TalkError
      && (resultado.erro.status === 401 || resultado.erro.status === 403)
    ) {
      redirect("/login?motivo=sessao");
    }
    return <EstadoRelatorios titulo="Relatórios indisponíveis agora" />;
  }

  const filasComVolume = resultado.filas.filter((fila) => fila.tickets > 0).length;
  const slaEstourado = resultado.filas.reduce((soma, fila) => soma + fila.slaEstourado, 0);
  const maiorVolume = Math.max(1, ...resultado.filas.map((fila) => fila.tickets));

  return (
    <>
      <BarraContexto
        empresa={contexto.perfil.organization.name}
        opcoes={resultado.filtros}
        periodoAtivo={periodo.chave}
        query={query}
      />

      <div className={painelStyles.conteudo}>
        <header className={styles.cabecalhoPagina}>
          <div>
            <p>Diagnóstico operacional</p>
            <h1>Relatórios</h1>
            <span>Identifique recorrência por cliente, volume por fila e o detalhe de cada chamado.</span>
          </div>
          <div className={styles.resumo} aria-label="Resumo do relatório">
            <span>
              <strong className="numero">{formatarNumero(resultado.relatorio.total)}</strong>
              tickets
            </span>
            <span>
              <strong className="numero">{formatarNumero(filasComVolume)}</strong>
              filas com volume
            </span>
            <span data-alerta={slaEstourado > 0 || undefined}>
              <strong className="numero">{formatarNumero(slaEstourado)}</strong>
              SLA estourado
            </span>
          </div>
        </header>

        <div className={styles.clientes}>
          <PainelClientes
            metricas={resultado.clientes}
            timezone={resultado.meta.timezone}
            query={query}
            exibirAtalhoRelatorios={false}
          />
        </div>

        <section className={styles.filas} aria-labelledby="titulo-filas-relatorio">
          <header>
            <div>
              <p>Distribuição do período</p>
              <h2 id="titulo-filas-relatorio">Volume por fila</h2>
            </div>
            <span>{formatarNumero(resultado.filas.length)} filas no comparativo</span>
          </header>

          {resultado.filas.length > 0 ? (
            <div className={styles.listaFilas}>
              {resultado.filas.map((fila) => (
                <article key={fila.id}>
                  <div className={styles.nomeFila}>
                    <i style={{ backgroundColor: fila.cor }} aria-hidden />
                    <span>
                      <strong>{fila.nome}</strong>
                      <small>
                        TME {formatarDuracao(fila.tmeSegundos)} · {formatarNumero(fila.slaEstourado)}
                        {" "}fora do SLA
                      </small>
                    </span>
                    <b className="numero">{formatarNumero(fila.tickets)}</b>
                  </div>
                  <div className={styles.trilho} aria-hidden>
                    <span
                      style={{
                        backgroundColor: fila.cor,
                        width: `${Math.max(2, (fila.tickets / maiorVolume) * 100)}%`,
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.filasVazias}>Nenhuma fila encontrada para este recorte.</p>
          )}
        </section>

        <TabelaRelatorio
          dados={resultado.relatorio}
          timezone={resultado.meta.timezone}
          query={query}
          possuiCursor={cursor !== null}
        />
      </div>
    </>
  );
}

function EstadoRelatorios({ titulo }: { titulo: string }) {
  return (
    <div className={painelStyles.conteudo}>
      <section className={styles.estado}>
        <span aria-hidden />
        <div>
          <p>Preparando sua análise</p>
          <h1>{titulo}</h1>
          <small>Atualize a página em alguns segundos. Sua sessão está preservada.</small>
        </div>
      </section>
    </div>
  );
}
