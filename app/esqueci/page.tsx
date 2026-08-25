import type { Metadata } from "next";
import { acordarTalk } from "@/lib/talk-client";
import { TemaToggle } from "@/components/tema-toggle";
import { FormularioRecuperacao } from "./formulario";
import styles from "../login/login.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recuperar senha | Mavo Gerenciamento",
  robots: { index: false, follow: false },
};

export default function EsqueciPage() {
  void acordarTalk();

  return (
    <main className={styles.pagina}>
      <TemaToggle flutuante />
      <div className={styles.orbeUm} aria-hidden />
      <div className={styles.orbeDois} aria-hidden />
      <section className={styles.cartao} aria-labelledby="titulo-recuperacao">
        <header className={styles.cabecalho}>
          <div className={styles.marca} aria-label="Mavo Gerenciamento">
            <span className={styles.simbolo} aria-hidden>M</span>
            <span>Mavo</span>
          </div>
          <span className={styles.produto}>Gerenciamento</span>
        </header>

        <div className={styles.apresentacao}>
          <p className={styles.sobretitulo}>Recuperação segura</p>
          <h1 id="titulo-recuperacao">Esqueceu sua senha?</h1>
          <p>Informe o e-mail da conta. As instruções chegam no WhatsApp cadastrado.</p>
        </div>

        <FormularioRecuperacao />
        <footer className={styles.rodape}>
          Por segurança, nunca informamos se um e-mail está ou não cadastrado.
        </footer>
      </section>
    </main>
  );
}
