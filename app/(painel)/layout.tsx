import { redirect } from "next/navigation";
import { NavTopo } from "@/components/nav-topo";
import { carregarContextoPainel } from "@/lib/contexto-painel";
import styles from "./painel.module.css";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const contexto = await carregarContextoPainel();
  if (contexto.estado === "anonimo" || contexto.estado === "invalido") {
    redirect("/login?motivo=sessao");
  }

  const pronto = contexto.estado === "pronto";
  const nome = pronto ? contexto.perfil.user.name : contexto.sessao.name;
  const empresa = pronto ? contexto.perfil.organization.name : "Sua empresa";

  return (
    <div className={styles.shell}>
      <NavTopo nome={nome} empresa={empresa} ativo="visao-geral" />
      {!pronto ? (
        <div className={styles.aviso} role="status">
          O Mavo Talk está acordando. Mostraremos o nome da sua empresa assim que ele responder.
        </div>
      ) : null}
      <main id="conteudo-principal">{children}</main>
    </div>
  );
}
