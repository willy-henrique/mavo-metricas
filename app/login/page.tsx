import type { Metadata } from "next";
import { acordarTalk } from "@/lib/talk-client";
import { TemaToggle } from "@/components/tema-toggle";
import { FormularioLogin } from "./formulario";
import styles from "./login.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entrar | Mavo Gerenciamento",
};

export default function LoginPage() {
  void acordarTalk();

  return (
    <main className={styles.pagina}>
      <TemaToggle flutuante />
      <div className={styles.orbeUm} aria-hidden />
      <div className={styles.orbeDois} aria-hidden />

      <section className={styles.cartao} aria-labelledby="titulo-login">
        <header className={styles.cabecalho}>
          <div className={styles.marca} aria-label="Mavo Gerenciamento">
            <span className={styles.simbolo} aria-hidden>
              M
            </span>
            <span>Mavo</span>
          </div>
          <span className={styles.produto}>Gerenciamento</span>
        </header>

        <div className={styles.apresentacao}>
          <p className={styles.sobretitulo}>Painel da sua operação</p>
          <h1 id="titulo-login">Bem-vindo de volta</h1>
          <p>Acompanhe o atendimento da sua empresa com clareza, em um só lugar.</p>
        </div>

        <FormularioLogin />

        <footer className={styles.rodape}>
          Acesso seguro. Seus dados de atendimento permanecem protegidos no Mavo Talk.
        </footer>
      </section>
    </main>
  );
}
