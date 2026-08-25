"use client";

import { useActionState, useMemo, useState } from "react";
import {
  alterarStatusUsuario,
  atualizarUsuario,
  criarUsuario,
  type EstadoUsuario,
} from "@/app/(painel)/configuracoes/actions";
import type { UsuarioGerenciado } from "@/lib/metricas";
import styles from "./gerenciador-usuarios.module.css";

type FiltroPapel = "todos" | UsuarioGerenciado["role"];
const INICIAL: EstadoUsuario = { erro: null, sucesso: null };

const PAPEIS: Record<UsuarioGerenciado["role"], string> = {
  admin: "Administrador",
  gestor: "Gestor",
  atendente: "Atendente",
};

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toLocaleUpperCase("pt-BR"))
    .join("");
}

function formatarTelefone(valor: string | null): string {
  if (!valor) return "Não cadastrado";
  if (valor.startsWith("55") && valor.length >= 12) {
    const ddd = valor.slice(2, 4);
    const numero = valor.slice(4);
    const corte = numero.length === 9 ? 5 : 4;
    return `+55 (${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
  }
  return `+${valor}`;
}

export function GerenciadorUsuarios({
  users,
  currentUserId,
  timezone,
}: {
  users: UsuarioGerenciado[];
  currentUserId: string;
  timezone: string;
}) {
  const [busca, setBusca] = useState("");
  const [papel, setPapel] = useState<FiltroPapel>("todos");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [novoAberto, setNovoAberto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return users.filter((user) => {
      if (!mostrarInativos && !user.isActive) return false;
      if (papel !== "todos" && user.role !== papel) return false;
      if (!termo) return true;
      return `${user.name} ${user.email}`.toLocaleLowerCase("pt-BR").includes(termo);
    });
  }, [busca, mostrarInativos, papel, users]);

  return (
    <>
      <section className={styles.ferramentas} aria-label="Ferramentas de usuários">
        <div className={styles.busca}>
          <span aria-hidden>⌕</span>
          <input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por nome ou e-mail"
            aria-label="Buscar usuários"
          />
        </div>
        <select value={papel} onChange={(evento) => setPapel(evento.target.value as FiltroPapel)}>
          <option value="todos">Todos os papéis</option>
          <option value="admin">Administradores</option>
          <option value="gestor">Gestores</option>
          <option value="atendente">Atendentes</option>
        </select>
        <label className={styles.checkInativos}>
          <input
            type="checkbox"
            checked={mostrarInativos}
            onChange={(evento) => setMostrarInativos(evento.target.checked)}
          />
          Mostrar inativos
        </label>
        <button className={styles.novo} type="button" onClick={() => setNovoAberto((atual) => !atual)}>
          <span aria-hidden>{novoAberto ? "×" : "+"}</span>
          {novoAberto ? "Fechar" : "Novo usuário"}
        </button>
      </section>

      {novoAberto ? <FormularioNovo onClose={() => setNovoAberto(false)} /> : null}

      <div className={styles.contagem} aria-live="polite">
        <strong className="numero">{filtrados.length}</strong>
        {filtrados.length === 1 ? " conta exibida" : " contas exibidas"}
      </div>

      {filtrados.length > 0 ? (
        <section className={styles.lista} aria-label="Contas da empresa">
          {filtrados.map((user) => (
            <CartaoUsuario
              key={user.id}
              user={user}
              timezone={timezone}
              propria={user.id === currentUserId}
              aberto={editando === user.id}
              onToggle={() => setEditando((atual) => atual === user.id ? null : user.id)}
            />
          ))}
        </section>
      ) : (
        <section className={styles.vazio}>
          <span aria-hidden>⌕</span>
          <div>
            <h2>Nenhuma conta encontrada</h2>
            <p>Ajuste a busca, o papel ou inclua contas inativas no resultado.</p>
          </div>
        </section>
      )}
    </>
  );
}

function FormularioNovo({ onClose }: { onClose: () => void }) {
  const [estado, acao, pendente] = useActionState(criarUsuario, INICIAL);
  const [role, setRole] = useState<UsuarioGerenciado["role"]>("atendente");

  return (
    <section className={styles.editor} aria-labelledby="titulo-novo-usuario">
      <header>
        <div>
          <p>Nova conta</p>
          <h2 id="titulo-novo-usuario">Adicionar uma pessoa</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar formulário">×</button>
      </header>
      <form action={acao} className={styles.formulario}>
        <Campo texto="Nome completo">
          <input name="name" required minLength={2} maxLength={120} autoComplete="name" />
        </Campo>
        <Campo texto="E-mail">
          <input name="email" type="email" required maxLength={254} autoComplete="email" />
        </Campo>
        <Campo texto="Papel">
          <select name="role" value={role} onChange={(evento) => setRole(evento.target.value as UsuarioGerenciado["role"])}>
            <option value="atendente">Atendente</option>
            <option value="gestor">Gestor</option>
            <option value="admin">Administrador</option>
          </select>
        </Campo>
        <Campo texto="WhatsApp de recuperação" dica={role === "atendente" ? "Não se aplica a atendentes" : "Com DDI e DDD"}>
          <input
            name="recoveryPhone"
            type="tel"
            inputMode="tel"
            required={role !== "atendente"}
            disabled={role === "atendente"}
            placeholder="5511999999999"
          />
        </Campo>
        <Campo texto="Senha inicial" dica="A pessoa poderá alterá-la depois">
          <input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" />
        </Campo>
        <div className={styles.linhaAcoes}>
          <Mensagem estado={estado} />
          <button className={styles.salvar} type="submit" disabled={pendente}>
            {pendente ? "Criando…" : "Criar conta"}
          </button>
        </div>
      </form>
    </section>
  );
}

function CartaoUsuario({
  user,
  timezone,
  propria,
  aberto,
  onToggle,
}: {
  user: UsuarioGerenciado;
  timezone: string;
  propria: boolean;
  aberto: boolean;
  onToggle: () => void;
}) {
  const datas = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <article className={styles.usuario} data-inativo={!user.isActive || undefined}>
      <div className={styles.resumoUsuario}>
        <span className={styles.avatar} aria-hidden>{iniciais(user.name)}</span>
        <div className={styles.identidade}>
          <div>
            <h2>{user.name}</h2>
            {propria ? <span className={styles.voce}>Esta é sua conta</span> : null}
          </div>
          <p>{user.email}</p>
        </div>
        <div className={styles.papelStatus}>
          <span className={styles.papel} data-papel={user.role}>{PAPEIS[user.role]}</span>
          <span className={user.isActive ? styles.ativo : styles.inativo}>
            <i aria-hidden /> {user.isActive ? "Ativo" : "Inativo"}
          </span>
        </div>
        <div className={styles.recuperacao} data-pendente={!user.recoveryPhone && user.role !== "atendente" || undefined}>
          <small>Recuperação</small>
          <strong>
            {!user.recoveryPhone && user.role !== "atendente"
              ? "Recuperação pendente"
              : user.role === "atendente"
                ? "Não aplicável"
                : formatarTelefone(user.recoveryPhone)}
          </strong>
        </div>
        <div className={styles.ultimoAcesso}>
          <small>Último acesso</small>
          <strong>{user.lastLoginAt ? datas.format(new Date(user.lastLoginAt)) : "Ainda não acessou"}</strong>
        </div>
        <button className={styles.editar} type="button" onClick={onToggle} aria-expanded={aberto}>
          {aberto ? "Fechar" : "Editar"}
        </button>
      </div>
      {aberto ? <FormularioEdicao user={user} propria={propria} /> : null}
    </article>
  );
}

function FormularioEdicao({ user, propria }: { user: UsuarioGerenciado; propria: boolean }) {
  const [estado, acao, pendente] = useActionState(atualizarUsuario, INICIAL);
  const [estadoStatus, acaoStatus, alterandoStatus] = useActionState(alterarStatusUsuario, INICIAL);
  const [role, setRole] = useState(user.role);

  return (
    <div className={styles.edicao}>
      <form action={acao} className={styles.formulario}>
        <input type="hidden" name="id" value={user.id} />
        <Campo texto="Nome completo">
          <input name="name" defaultValue={user.name} required minLength={2} maxLength={120} />
        </Campo>
        <Campo texto="E-mail">
          <input name="email" type="email" defaultValue={user.email} required maxLength={254} />
        </Campo>
        <Campo texto="Papel" dica={propria ? "Sua conta deve continuar administradora" : undefined}>
          <select
            name="role"
            value={role}
            disabled={propria}
            onChange={(evento) => setRole(evento.target.value as UsuarioGerenciado["role"])}
          >
            <option value="atendente">Atendente</option>
            <option value="gestor">Gestor</option>
            <option value="admin">Administrador</option>
          </select>
          {propria ? <input type="hidden" name="role" value="admin" /> : null}
        </Campo>
        <Campo texto="WhatsApp de recuperação" dica={role === "atendente" ? "Não se aplica a atendentes" : "Com DDI e DDD"}>
          <input
            name="recoveryPhone"
            type="tel"
            inputMode="tel"
            defaultValue={user.recoveryPhone ?? ""}
            required={role !== "atendente"}
            disabled={role === "atendente"}
            placeholder="5511999999999"
          />
        </Campo>
        <Campo texto="Nova senha" dica="Deixe vazio para manter a atual">
          <input name="password" type="password" minLength={10} maxLength={128} autoComplete="new-password" />
        </Campo>
        <div className={styles.linhaAcoes}>
          <Mensagem estado={estado} />
          <button className={styles.salvar} type="submit" disabled={pendente}>
            {pendente ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </form>

      <div className={styles.zonaStatus}>
        <div>
          <strong>{user.isActive ? "Desativar acesso" : "Reativar acesso"}</strong>
          <p>
            {user.isActive
              ? "Não excluímos o histórico. A pessoa deixa de entrar e pode ser reativada depois."
              : "A pessoa voltará a entrar com as credenciais já cadastradas."}
          </p>
        </div>
        <form action={acaoStatus}>
          <input type="hidden" name="id" value={user.id} />
          <input type="hidden" name="acao" value={user.isActive ? "desativar" : "reativar"} />
          <button
            className={user.isActive ? styles.desativar : styles.reativar}
            type="submit"
            disabled={alterandoStatus || propria}
            title={propria ? "Sua própria conta não pode ser desativada" : undefined}
          >
            {alterandoStatus
              ? "Aplicando…"
              : user.isActive
                ? "Desativar acesso"
                : "Reativar acesso"}
          </button>
        </form>
        <Mensagem estado={estadoStatus} />
      </div>
    </div>
  );
}

function Campo({
  texto,
  dica,
  children,
}: {
  texto: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.campo}>
      <span>{texto}{dica ? <small>{dica}</small> : null}</span>
      {children}
    </label>
  );
}

function Mensagem({ estado }: { estado: EstadoUsuario }) {
  if (!estado.erro && !estado.sucesso) return <span />;
  return (
    <p className={estado.erro ? styles.erro : styles.sucesso} role={estado.erro ? "alert" : "status"}>
      {estado.erro ?? estado.sucesso}
    </p>
  );
}
