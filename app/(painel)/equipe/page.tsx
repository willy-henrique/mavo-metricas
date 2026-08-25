import { redirect } from "next/navigation";
import { BarraContexto } from "@/components/barra-contexto";
import { TabelaEquipe } from "@/components/tabela-equipe";
import { carregarContextoPainel } from "@/lib/contexto-painel";
import { parametrosMetricas, type ParametrosBusca } from "@/lib/consulta-metricas";
import { formatarNumero } from "@/lib/formato";
import { agentesSchema, metricsMetaSchema, opcoesContextoSchema } from "@/lib/metricas";
import { periodoDaUrl } from "@/lib/periodo";
import { TalkError, talkGet } from "@/lib/talk-client";
import painelStyles from "../painel.module.css";
import styles from "./equipe.module.css";

export const dynamic = "force-dynamic";

async function carregarEquipe(token: string, query: string) {
  try {
    const [respostaAgentes, respostaFiltros] = await Promise.all([
      talkGet<unknown>(`/agents${query ? `?${query}` : ""}`, { token }),
      talkGet<unknown>("/filters", { token }),
    ]);
    metricsMetaSchema.parse(respostaAgentes.meta);
    metricsMetaSchema.parse(respostaFiltros.meta);
    return {
      estado: "pronto" as const,
      agentes: agentesSchema.parse(respostaAgentes.data),
      filtros: opcoesContextoSchema.parse(respostaFiltros.data),
    };
  } catch (erro) {
    return { estado: "erro" as const, erro };
  }
}

export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<ParametrosBusca>;
}) {
  const contexto = await carregarContextoPainel();
  if (contexto.estado === "anonimo" || contexto.estado === "invalido") {
    redirect("/login?motivo=sessao");
  }
  if (contexto.estado === "indisponivel") {
    return <EstadoEquipe titulo="O Mavo Talk está acordando" />;
  }

  const params = parametrosMetricas(await searchParams);
  const periodo = periodoDaUrl(params);
  const query = params.toString();
  const resultado = await carregarEquipe(contexto.sessao.token, query);

  if (resultado.estado === "erro") {
    if (
      resultado.erro instanceof TalkError &&
      (resultado.erro.status === 401 || resultado.erro.status === 403)
    ) {
      redirect("/login?motivo=sessao");
    }
    return <EstadoEquipe titulo="Produção da equipe indisponível agora" />;
  }

  const totalTickets = resultado.agentes.reduce((soma, agente) => soma + agente.tickets, 0);
  const totalEncerrados = resultado.agentes.reduce((soma, agente) => soma + agente.encerrados, 0);

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
            <p>Desempenho individual</p>
            <h1>Equipe</h1>
            <span>Compare volume, velocidade e qualidade no mesmo recorte.</span>
          </div>
          <div className={styles.resumo} aria-label="Resumo da equipe">
            <span>
              <strong className="numero">{formatarNumero(resultado.agentes.length)}</strong>
              atendentes ativos
            </span>
            <span>
              <strong className="numero">{formatarNumero(totalTickets)}</strong>
              tickets
            </span>
            <span>
              <strong className="numero">{formatarNumero(totalEncerrados)}</strong>
              encerrados
            </span>
          </div>
        </header>

        <TabelaEquipe agentes={resultado.agentes} />
      </div>
    </>
  );
}

function EstadoEquipe({ titulo }: { titulo: string }) {
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
