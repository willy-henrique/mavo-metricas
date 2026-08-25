import { redirect } from "next/navigation";
import { BarraContexto, type OpcoesContexto } from "@/components/barra-contexto";
import { FunilBot } from "@/components/funil-bot";
import { carregarContextoPainel } from "@/lib/contexto-painel";
import { parametrosMetricas, type ParametrosBusca } from "@/lib/consulta-metricas";
import { desempenhoBotSchema, metricsMetaSchema } from "@/lib/metricas";
import { periodoDaUrl } from "@/lib/periodo";
import { TalkError, talkGet } from "@/lib/talk-client";
import painelStyles from "../painel.module.css";
import styles from "./automatico.module.css";

export const dynamic = "force-dynamic";

const SEM_FILTROS: OpcoesContexto = { filas: [], atendentes: [] };

async function carregarAutomatico(token: string, query: string) {
  try {
    const resposta = await talkGet<unknown>(`/bot${query ? `?${query}` : ""}`, { token });
    metricsMetaSchema.parse(resposta.meta);
    return { estado: "pronto" as const, dados: desempenhoBotSchema.parse(resposta.data) };
  } catch (erro) {
    return { estado: "erro" as const, erro };
  }
}

export default async function AutomaticoPage({
  searchParams,
}: {
  searchParams: Promise<ParametrosBusca>;
}) {
  const contexto = await carregarContextoPainel();
  if (contexto.estado === "anonimo" || contexto.estado === "invalido") {
    redirect("/login?motivo=sessao");
  }
  if (contexto.estado === "indisponivel") {
    return <EstadoAutomatico titulo="O Mavo Talk está acordando" />;
  }

  const params = parametrosMetricas(await searchParams);
  params.delete("fila");
  params.delete("atendente");
  params.delete("queue_id");
  params.delete("assignee_id");
  const periodo = periodoDaUrl(params);
  const query = params.toString();
  const resultado = await carregarAutomatico(contexto.sessao.token, query);

  if (resultado.estado === "erro") {
    if (
      resultado.erro instanceof TalkError &&
      (resultado.erro.status === 401 || resultado.erro.status === 403)
    ) {
      redirect("/login?motivo=sessao");
    }
    return <EstadoAutomatico titulo="Atendimento automático indisponível agora" />;
  }

  return (
    <>
      <BarraContexto
        empresa={contexto.perfil.organization.name}
        opcoes={SEM_FILTROS}
        periodoAtivo={periodo.chave}
        query={query}
        mostrarFiltrosOperacionais={false}
      />

      <div className={painelStyles.conteudo}>
        <header className={styles.cabecalhoPagina}>
          <p>Eficiência do bot</p>
          <h1>Atendimento automático</h1>
          <span>Veja quanto do volume foi absorvido antes de chegar à equipe.</span>
        </header>
        <FunilBot dados={resultado.dados} />
      </div>
    </>
  );
}

function EstadoAutomatico({ titulo }: { titulo: string }) {
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
