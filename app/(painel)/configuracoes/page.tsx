import Link from "next/link";
import { redirect } from "next/navigation";
import { GerenciadorUsuarios } from "@/components/gerenciador-usuarios";
import { carregarContextoPainel } from "@/lib/contexto-painel";
import { formatarNumero } from "@/lib/formato";
import { usuariosGerenciadosSchema } from "@/lib/metricas";
import { TalkError, talkGet } from "@/lib/talk-client";
import painelStyles from "../painel.module.css";
import styles from "./configuracoes.module.css";

export const dynamic = "force-dynamic";

type ResultadoUsuarios =
  | { estado: "pronto"; dados: ReturnType<typeof usuariosGerenciadosSchema.parse> }
  | { estado: "sessao_invalida" }
  | { estado: "indisponivel" };

async function carregarUsuarios(token: string): Promise<ResultadoUsuarios> {
  try {
    const resposta = await talkGet<unknown>("/users", { token });
    return { estado: "pronto", dados: usuariosGerenciadosSchema.parse(resposta.data) };
  } catch (erro) {
    if (erro instanceof TalkError && (erro.status === 401 || erro.status === 403)) {
      return { estado: "sessao_invalida" };
    }
    return { estado: "indisponivel" };
  }
}

export default async function ConfiguracoesPage() {
  const contexto = await carregarContextoPainel();
  if (contexto.estado === "anonimo" || contexto.estado === "invalido") {
    redirect("/login?motivo=sessao");
  }
  if (contexto.estado === "indisponivel") {
    return <EstadoConfiguracoes titulo="O Mavo Talk está acordando" />;
  }
  if (contexto.perfil.user.role !== "admin") {
    return (
      <div className={painelStyles.conteudo}>
        <section className={styles.semAcesso}>
          <span aria-hidden>↗</span>
          <div>
            <p>Área administrativa</p>
            <h1>Somente administradores acessam configurações</h1>
            <small>Seu acesso de gestor continua disponível nas telas de análise.</small>
            <Link href="/">Voltar para a visão geral</Link>
          </div>
        </section>
      </div>
    );
  }

  const resultado = await carregarUsuarios(contexto.sessao.token);
  if (resultado.estado === "sessao_invalida") {
    redirect("/login?motivo=sessao");
  }
  if (resultado.estado === "indisponivel") {
    return <EstadoConfiguracoes titulo="Configurações indisponíveis agora" />;
  }

  const { dados } = resultado;
  const ativos = dados.users.filter((user) => user.isActive).length;
  const administradores = dados.users.filter(
    (user) => user.isActive && user.role === "admin",
  ).length;
  const recuperacaoPendente = dados.users.filter(
    (user) => user.isActive && user.role !== "atendente" && !user.recoveryPhone,
  ).length;

  return (
    <div className={painelStyles.conteudo}>
      <header className={styles.cabecalhoPagina}>
        <div>
          <p>Administração da empresa</p>
          <h1>Configurações</h1>
          <span>Controle quem entra, o nível de acesso e o canal de recuperação.</span>
        </div>
        <div className={styles.resumo} aria-label="Resumo das contas">
          <span>
            <strong className="numero">{formatarNumero(ativos)}</strong>
            contas ativas
          </span>
          <span>
            <strong className="numero">{formatarNumero(administradores)}</strong>
            administradores
          </span>
          <span data-alerta={recuperacaoPendente > 0 || undefined}>
            <strong className="numero">{formatarNumero(recuperacaoPendente)}</strong>
            recuperação pendente
          </span>
        </div>
      </header>

      {recuperacaoPendente > 0 ? (
        <aside className={styles.avisoRecuperacao} role="status">
          <span aria-hidden>!</span>
          <p>
            Cadastre o WhatsApp de recuperação das contas de gestão. Sem ele, a pessoa não
            consegue redefinir a própria senha.
          </p>
        </aside>
      ) : null}

      <GerenciadorUsuarios
        users={dados.users}
        currentUserId={contexto.perfil.user.id}
        timezone={contexto.perfil.organization.timezone}
      />
    </div>
  );
}

function EstadoConfiguracoes({ titulo }: { titulo: string }) {
  return (
    <div className={painelStyles.conteudo}>
      <section className={styles.estado}>
        <span aria-hidden />
        <div>
          <p>Preparando sua empresa</p>
          <h1>{titulo}</h1>
          <small>Atualize a página em alguns segundos. Sua sessão está preservada.</small>
        </div>
      </section>
    </div>
  );
}
