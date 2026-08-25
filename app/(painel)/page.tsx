import { redirect } from "next/navigation";
import { BarraContexto } from "@/components/barra-contexto";
import { ColunaAgora } from "@/components/coluna-agora";
import { MetricaHeroi } from "@/components/metrica-heroi";
import { MetricaSecundaria } from "@/components/metrica-secundaria";
import { RitmoPeriodo } from "@/components/ritmo-periodo";
import { carregarContextoPainel } from "@/lib/contexto-painel";
import { parametrosMetricas, type ParametrosBusca } from "@/lib/consulta-metricas";
import {
  formatarDecimal,
  formatarDuracao,
  formatarNumero,
  formatarPorcentagem,
} from "@/lib/formato";
import {
  metricsMetaSchema,
  opcoesContextoSchema,
  overviewSchema,
  serieMetaSchema,
  serieTemporalSchema,
  snapshotAgoraSchema,
} from "@/lib/metricas";
import { PERIODOS, periodoDaUrl } from "@/lib/periodo";
import { TalkError, talkGet } from "@/lib/talk-client";
import styles from "./painel.module.css";

export const dynamic = "force-dynamic";

function horaDaAtualizacao(instante: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(instante));
  } catch {
    return "agora";
  }
}

async function carregarIndicadores(token: string, query: string) {
  try {
    const [respostaLive, respostaOverview, respostaSerie, respostaFiltros] = await Promise.all([
      talkGet<unknown>("/live", { token }),
      talkGet<unknown>(`/overview${query ? `?${query}` : ""}`, { token }),
      talkGet<unknown>(`/timeseries${query ? `?${query}` : ""}`, { token }),
      talkGet<unknown>("/filters", { token }),
    ]);

    const filtrosMeta = metricsMetaSchema.parse(respostaFiltros.meta);
    return {
      estado: "pronto" as const,
      live: snapshotAgoraSchema.parse(respostaLive.data),
      overview: overviewSchema.parse(respostaOverview.data),
      serie: serieTemporalSchema.parse(respostaSerie.data),
      filtros: opcoesContextoSchema.parse(respostaFiltros.data),
      overviewMeta: metricsMetaSchema.parse(respostaOverview.meta),
      serieMeta: serieMetaSchema.parse(respostaSerie.meta),
      filtrosMeta,
    };
  } catch (erro) {
    return { estado: "erro" as const, erro };
  }
}

export default async function VisaoGeral({
  searchParams,
}: {
  searchParams: Promise<ParametrosBusca>;
}) {
  const contexto = await carregarContextoPainel();
  if (contexto.estado === "anonimo" || contexto.estado === "invalido") {
    redirect("/login?motivo=sessao");
  }

  if (contexto.estado === "indisponivel") {
    return (
      <div className={styles.conteudo}>
        <EstadoPainel
          titulo="O Mavo Talk está acordando"
          descricao="Atualize esta página em alguns segundos. Sua sessão está preservada."
        />
      </div>
    );
  }

  const params = parametrosMetricas(await searchParams);
  const periodo = periodoDaUrl(params);
  const query = params.toString();
  const token = contexto.sessao.token;

  const indicadores = await carregarIndicadores(token, query);
  if (indicadores.estado === "erro") {
    const { erro } = indicadores;
    if (erro instanceof TalkError && (erro.status === 401 || erro.status === 403)) {
      redirect("/login?motivo=sessao");
    }
    const periodoInvalido =
      erro instanceof TalkError &&
      (erro.code === "invalid_period" || erro.code === "period_too_long");
    const acordando = erro instanceof TalkError && erro.status >= 500;
    return (
      <div className={styles.conteudo}>
        <EstadoPainel
          titulo={periodoInvalido ? "Esse período não pode ser consultado" : "Indicadores indisponíveis agora"}
          descricao={
            periodoInvalido
              ? "Revise as datas. O intervalo máximo permitido é de 90 dias."
              : acordando
                ? "O Mavo Talk pode estar acordando. Atualize a página em alguns segundos."
                : "Não foi possível carregar os indicadores. Tente novamente em instantes."
          }
        />
      </div>
    );
  }

  const { live, overview, serie, filtros, overviewMeta, serieMeta } = indicadores;
  const periodoRotulo = PERIODOS.find((item) => item.chave === periodo.chave)?.rotulo ?? "Hoje";
  const atual = overview.atual;
  const mensagens = atual.mensagensEnviadas + atual.mensagensRecebidas;
  const atualizado = horaDaAtualizacao(overviewMeta.generatedAt, overviewMeta.timezone);

  return (
    <>
      <BarraContexto
        empresa={contexto.perfil.organization.name}
        opcoes={filtros}
        periodoAtivo={periodo.chave}
        query={query}
      />

      <div className={styles.conteudo}>
        <header className={styles.cabecalhoPagina}>
          <div>
            <p className={styles.sobretitulo}>Operação no WhatsApp</p>
            <h1>Visão geral</h1>
            <p>O essencial para entender o ritmo e a qualidade do atendimento.</p>
          </div>
          <p className={styles.atualizacao}>
            <span aria-hidden /> Dados do período atualizados às {atualizado}
          </p>
        </header>

        <div className={styles.gradeDashboard}>
          <ColunaAgora inicial={live} />

          <div className={styles.periodo}>
            <MetricaHeroi overview={overview} serie={serie} periodo={periodoRotulo} />

            <div className={styles.secundarias}>
              <MetricaSecundaria
                  rotulo="Mensagens"
                  valor={formatarNumero(mensagens)}
                  apoio={`${formatarNumero(atual.mensagensRecebidas)} recebidas · ${formatarNumero(atual.mensagensEnviadas)} enviadas`}
              />
              <MetricaSecundaria
                  rotulo="Taxa de resolução"
                  valor={formatarPorcentagem(atual.taxaResolucao)}
                  apoio={`${formatarNumero(atual.encerrados)} de ${formatarNumero(atual.tickets)} tickets encerrados`}
                  tom={atual.taxaResolucao !== null && atual.taxaResolucao >= 0.8 ? "positivo" : "padrao"}
              />
              <MetricaSecundaria
                  rotulo="CSAT"
                  valor={atual.csat === null ? "—" : `${formatarDecimal(atual.csat)} / 5`}
                  apoio={
                    atual.csatRespostas === 0
                      ? "Sem respostas no período"
                      : `${formatarNumero(atual.csatRespostas)} ${atual.csatRespostas === 1 ? "resposta" : "respostas"}`
                  }
              />
              <MetricaSecundaria
                  rotulo="Tempo médio de espera"
                  valor={formatarDuracao(atual.tmeSegundos)}
                  apoio="Até a primeira resposta"
              />
              <MetricaSecundaria
                  rotulo="Tempo médio de atendimento"
                  valor={formatarDuracao(atual.tmaSegundos)}
                  apoio="Da abertura ao encerramento"
              />
              <MetricaSecundaria
                  rotulo="SLA estourado"
                  valor={formatarNumero(atual.slaEstourado)}
                  apoio={atual.slaEstourado === 0 ? "Nenhum ticket fora do prazo" : "Tickets fora do prazo de resposta"}
                  tom={atual.slaEstourado > 0 ? "alerta" : "positivo"}
              />
            </div>

            <RitmoPeriodo serie={serie} meta={serieMeta} />
          </div>
        </div>
      </div>
    </>
  );
}

function EstadoPainel({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <section className={styles.carregando} aria-labelledby="titulo-estado-painel">
      <span className={styles.pulso} aria-hidden />
      <div>
        <p className={styles.sobretitulo}>Preparando seu painel</p>
        <h1 id="titulo-estado-painel">{titulo}</h1>
        <p>{descricao}</p>
      </div>
    </section>
  );
}
