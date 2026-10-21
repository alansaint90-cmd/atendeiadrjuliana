"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function mensagemFalha(status: number): string {
  if (status === 401 || status === 403) return "E-mail ou senha incorretos.";
  if (status === 429) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (status >= 500) return "O serviço está temporariamente indisponível. Tente novamente em instantes.";
  return "Confira o e-mail e a senha e tente novamente.";
}

interface CampoSenhaProps {
  id: string;
  titulo: string;
  valor: string;
  aoAlterar: (valor: string) => void;
  nova?: boolean;
}

function CampoSenha({ id, titulo, valor, aoAlterar, nova = false }: CampoSenhaProps) {
  const [visivel, setVisivel] = useState(false);
  return <div className="campo-senha">
    <label htmlFor={id}>{titulo}</label>
    <div className="campo-senha-controle">
      <input id={id} type={visivel ? "text" : "password"} required
        maxLength={256} minLength={nova ? 15 : undefined} autoComplete={nova ? "new-password" : "current-password"} value={valor} onChange={e => aoAlterar(e.target.value)} />
      <button type="button" className="campo-senha-olho" aria-label={visivel ? `Ocultar ${titulo.toLowerCase()}` : `Mostrar ${titulo.toLowerCase()}`}
        aria-pressed={visivel} onClick={() => setVisivel(!visivel)}>
        {visivel ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M6.5 6.8C4.5 8 3 9.8 2 12c2 4.3 5.7 7 10 7 1.9 0 3.6-.3 5.1-1.1M9.9 5.2C10.6 5.1 11.3 5 12 5c4.3 0 8 2.7 10 7-.6 1.3-1.4 2.4-2.4 3.4" />
        </svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M2 12c2-4.3 5.7-7 10-7s8 2.7 10 7c-2 4.3-5.7 7-10 7S4 16.3 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>}
      </button>
    </div>
  </div>;
}

export function FormularioLogin({ primeiroAcesso = false }: { primeiroAcesso?: boolean } = {}) {
  const router = useRouter();
  const [convite, setConvite] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    setErro("");
    if (primeiroAcesso && senha !== confirmacao) { setErro("As senhas não coincidem."); return; }
    setCarregando(true);
    try {
      const resposta = await fetch(primeiroAcesso ? "/api/auth/passkey" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(primeiroAcesso ? { acao: "concluir_registro_senha", convite: convite.trim(), senha } : { email, senha, lembrar: true }),
      });
      if (!resposta.ok) {
        setErro(primeiroAcesso ? "Não foi possível ativar o acesso. Confira o código e use uma senha de pelo menos 15 caracteres que não tenha sido exposta em vazamentos. Se o código expirou, peça um novo convite ao administrador." : mensagemFalha(resposta.status));
        return;
      }
      setSenha(""); setConfirmacao(""); setConvite("");
      router.push("/");
      router.refresh();
    } catch {
      setErro("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return <section className="form-card">
    <h1>{primeiroAcesso ? "Primeiro acesso" : "Entrar no Atende AI"}</h1>
    <p>{primeiroAcesso ? "Use o código fornecido pelo administrador para definir sua senha. O convite expira em 15 minutos." : "Acesse com seu e-mail e senha."}</p>
    {erro && <p role="alert">{erro}</p>}
    <form onSubmit={e => { e.preventDefault(); void entrar(); }}>
      {primeiroAcesso ? <>
        <label htmlFor="codigo-convite">Código de primeiro acesso</label>
        <input id="codigo-convite" required minLength={43} maxLength={43} autoComplete="off" autoCapitalize="none" spellCheck={false}
          value={convite} onChange={e => setConvite(e.target.value)} />
      </> : <>
      <label htmlFor="login-email">E-mail</label>
      <input id="login-email" type="email" required maxLength={254} autoComplete="username"
        value={email} onChange={e => setEmail(e.target.value)} />
      </>}
      <CampoSenha id="login-senha" titulo={primeiroAcesso ? "Nova senha" : "Senha"} valor={senha} aoAlterar={setSenha} nova={primeiroAcesso} />
      {primeiroAcesso && <>
        <p>Use de 15 a 256 caracteres. Você pode usar uma frase longa.</p>
        <CampoSenha id="confirmar-senha" titulo="Confirmar senha" valor={confirmacao} aoAlterar={setConfirmacao} nova />
      </>}
      <button type="submit" className="primary" disabled={carregando}>{carregando ? "Aguarde…" : primeiroAcesso ? "Definir senha e acessar" : "Entrar"}</button>
    </form>
    <p><a href={primeiroAcesso ? "/entrar" : "/entrar/primeiro-acesso"}>{primeiroAcesso ? "Voltar para entrar" : "Primeiro acesso"}</a></p>
  </section>;
}
