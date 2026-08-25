import type { Metadata } from "next";
import Link from "next/link";
import { acordarTalk } from "@/lib/talk-client";
import { FormularioRedefinicao } from "./formulario";
import styles from "../login/login.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nova senha | Mavo Gerenciamento",
  robots: { index: false, follow: false },
};

function tokenValido(token: string | null): token is string {
  return token !== null && /^[A-Za-z0-9_-]{40,512}$/.test(token);
}

export default async function RedefinirPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  void acordarTalk();
  const valor = (await searchParams).token;
  const token = Array.isArray(valor) ? valor[0] ?? null : valor ?? null;
  const valido = tokenValido(token);

  return (
    <main className={styles.pagina}>
      <div className={styles.orbeUm} aria-hidden />
      <div className={styles.orbeDois} aria-hidden />
      <section className={styles.cartao} aria-labelledby="titulo-redefinicao">
        <header className={styles.cabecalho}>
          <div className={styles.marca} aria-label="Mavo Gerenciamento">
            <span className={styles.simbolo} aria-hidden>M</span>
            <span>Mavo</span>
          </div>
          <span className={styles.produto}>Gerenciamento</span>
        </header>

        <div className={styles.apresentacao}>
          <p className={styles.sobretitulo}>Proteja sua conta</p>
          <h1 id="titulo-redefinicao">Crie uma nova senha</h1>
          <p>Use uma senha exclusiva, fácil para você lembrar e difícil para outra pessoa adivinhar.</p>
        </div>

        {valido ? (
          <FormularioRedefinicao token={token} />
        ) : (
          <div className={`${styles.sucesso} ${styles.invalido}`} role="alert">
            <span aria-hidden>!</span>
            <h2>Link inválido</h2>
            <p>Este endereço está incompleto. Peça um novo link de recuperação.</p>
            <div className={styles.acoesConta}>
              <Link href="/esqueci">Pedir novo link</Link>
              <Link href="/login">Voltar para o login</Link>
            </div>
          </div>
        )}

        <footer className={styles.rodape}>
          O link expira em 30 minutos e deixa de funcionar após a alteração.
        </footer>
      </section>
    </main>
  );
}
