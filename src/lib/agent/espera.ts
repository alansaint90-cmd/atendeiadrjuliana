/** Prazo mínimo configurado no chatbot, sem bloquear o lease com sleep. */
export function deveAguardarResposta(delay: number, timestamp: number, agora = Date.now()): boolean {
  return agora < timestamp * 1000 + delay * 1000;
}
