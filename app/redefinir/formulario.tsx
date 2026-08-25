"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { redefinirSenha, type EstadoRedefinicao } from "./actions";
import styles from "../login/login.module.css";

const inicial: EstadoRedefinicao = { estado: "inicial", erro: null };

export function FormularioRedefinicao({ token }: { token: string }) {
  const [estado, acao, pendente] = useActionState(redefinirSenha, inicial);
  const [mostrar, setMostrar] = useState(false);
  const [senha, setSenha] = useState("");

  useEffect(() => {
    if (estado.estado === "sucesso") window.history.replaceState(null, "", "/redefinir");
  }, [estado.estado]);

  if (estado.estado === "sucesso") {
    return (
      <div className={styles.sucesso} role="status">
        <span aria-hidden>✓</span>
        <h2>Senha alterada com sucesso</h2>
        <p>Seu link foi encerrado e a nova senha já pode ser usada.</p>
        <div className={styles.acoesConta}>
          <Link href="/login">Entrar no painel</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={acao} className={styles.formulario} noValidate>
      <input name="token" type="hidden" value={token} />
      <div className={styles.campo}>
        <label htmlFor="nova-senha">Nova senha</label>
        <div className={styles.senhaWrapper}>
          <input
            id="nova-senha"
            name="senha"
            type={mostrar ? "text" : "password"}
            minLength={10}
            maxLength={128}
            required
            autoComplete="new-password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            aria-describedby={`politica-senha${estado.erro ? " erro-redefinicao" : ""}`}
          />
          <button
            className={styles.mostrarSenha}
            type="button"
            onClick={() => setMostrar((atual) => !atual)}
            aria-pressed={mostrar}
          >
            {mostrar ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      <p id="politica-senha" className={styles.politica} data-valida={senha.length >= 10 || undefined}>
        Pelo menos 10 caracteres
      </p>

      <div className={styles.campo}>
        <label htmlFor="confirmar-senha">Confirmar nova senha</label>
        <input
          id="confirmar-senha"
          name="confirmacao"
          type={mostrar ? "text" : "password"}
          minLength={10}
          maxLength={128}
          required
          autoComplete="new-password"
          aria-describedby={estado.erro ? "erro-redefinicao" : undefined}
        />
      </div>

      {estado.erro ? (
        <p id="erro-redefinicao" className={styles.erro} role="alert">
          {estado.erro}
        </p>
      ) : null}

      <button className={styles.entrar} type="submit" disabled={pendente || senha.length < 10}>
        {pendente ? <span className={styles.spinner} aria-hidden /> : null}
        {pendente ? "Alterando…" : "Criar nova senha"}
      </button>
    </form>
  );
}
