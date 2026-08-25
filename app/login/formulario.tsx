"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { entrar, type EstadoLogin } from "./actions";
import styles from "./login.module.css";

const inicial: EstadoLogin = { erro: null };

export function FormularioLogin() {
  const [estado, acao, pendente] = useActionState(entrar, inicial);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [demorando, setDemorando] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDemorando(pendente),
      pendente ? 3_000 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [pendente]);

  return (
    <form action={acao} className={styles.formulario} noValidate>
      <div className={styles.campo}>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="voce@empresa.com.br"
          aria-describedby={estado.erro ? "erro-login" : undefined}
        />
      </div>

      <div className={styles.campo}>
        <div className={styles.linhaRotulo}>
          <label htmlFor="senha">Senha</label>
          <Link href="/esqueci">Esqueci minha senha</Link>
        </div>
        <div className={styles.senhaWrapper}>
          <input
            id="senha"
            name="senha"
            type={mostrarSenha ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Digite sua senha"
            aria-describedby={estado.erro ? "erro-login" : undefined}
          />
          <button
            className={styles.mostrarSenha}
            type="button"
            onClick={() => setMostrarSenha((atual) => !atual)}
            aria-pressed={mostrarSenha}
            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
          >
            {mostrarSenha ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      {estado.erro ? (
        <p id="erro-login" className={styles.erro} role="alert">
          {estado.erro}
        </p>
      ) : null}

      <button className={styles.entrar} type="submit" disabled={pendente}>
        {pendente ? <span className={styles.spinner} aria-hidden /> : null}
        {pendente ? "Entrando…" : "Entrar no painel"}
      </button>

      <div className={styles.estadoServidor} aria-live="polite">
        {demorando ? (
          <p>Estamos acordando o Mavo Talk. Isso pode levar alguns segundos.</p>
        ) : null}
      </div>
    </form>
  );
}
