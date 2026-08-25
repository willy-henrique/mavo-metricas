import { redirect } from "next/navigation";
import { carregarContextoPainel } from "@/lib/contexto-painel";
import styles from "./painel.module.css";

export default async function InicioPainel() {
  const contexto = await carregarContextoPainel();
  if (contexto.estado === "anonimo" || contexto.estado === "invalido") {
    redirect("/login?motivo=sessao");
  }

  if (contexto.estado === "indisponivel") {
    return (
      <section className={styles.carregando} aria-labelledby="titulo-acordando">
        <span className={styles.pulso} aria-hidden />
        <div>
          <p className={styles.sobretitulo}>Preparando seu painel</p>
          <h1 id="titulo-acordando">O Mavo Talk está acordando</h1>
          <p>Atualize esta página em alguns segundos. Sua sessão está preservada.</p>
        </div>
      </section>
    );
  }

  return (
    <div className={styles.inicio}>
      <header className={styles.hero}>
        <p className={styles.sobretitulo}>Sua operação</p>
        <h1>{contexto.perfil.organization.name}</h1>
        <p>Uma visão simples e segura do atendimento da sua empresa no WhatsApp.</p>
      </header>

      <section className={styles.vazio} aria-labelledby="titulo-proxima-entrega">
        <span className={styles.iconePronto} aria-hidden>
          ✓
        </span>
        <div>
          <h2 id="titulo-proxima-entrega">Acesso configurado</h2>
          <p>Os indicadores aparecem aqui na próxima entrega.</p>
        </div>
        <span className={styles.etiqueta}>Conexão segura</span>
      </section>
    </div>
  );
}
