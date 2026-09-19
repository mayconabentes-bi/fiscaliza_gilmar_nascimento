import {
  allowedDemandStatusTargets,
  canTransitionDemandStatus,
  DEMAND_STATUS_VALUES,
  isDemandStatus,
} from "../src/shared/demandStatusWorkflow.js";

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

for (const status of DEMAND_STATUS_VALUES) {
  expect(isDemandStatus(status), `Status oficial deveria ser válido: ${status}`);
  expect(canTransitionDemandStatus(status, status), `Prioridade-only deve ser possível em ${status}`);
}

expect(!isDemandStatus("APAGADA"), "Status desconhecido deve ser recusado.");

for (const terminal of ["CONCLUIDA", "INDEFERIDA"] as const) {
  const targets = allowedDemandStatusTargets(terminal);
  expect(targets.length === 1 && targets[0] === terminal, `${terminal} deve ser terminal.`);
  expect(!canTransitionDemandStatus(terminal, "RECEBIDA"), `${terminal} não pode reabrir para RECEBIDA.`);
  expect(!canTransitionDemandStatus(terminal, "EM_EXECUCAO"), `${terminal} não pode voltar para execução.`);
}

expect(canTransitionDemandStatus("RECEBIDA", "EM_TRIAGEM"), "Recebida deve poder entrar em triagem.");
expect(canTransitionDemandStatus("RECEBIDA", "EM_ANALISE"), "Atalho observado RECEBIDA→EM_ANALISE deve ser preservado.");
expect(canTransitionDemandStatus("RECEBIDA", "EM_EXECUCAO"), "Atalho observado RECEBIDA→EM_EXECUCAO deve ser preservado.");
expect(canTransitionDemandStatus("RECEBIDA", "CONCLUIDA"), "Atalho observado RECEBIDA→CONCLUIDA deve ser preservado.");
expect(canTransitionDemandStatus("EM_TRIAGEM", "ENCAMINHADA"), "Fluxo observado EM_TRIAGEM→ENCAMINHADA deve ser preservado.");

expect(!canTransitionDemandStatus("EM_EXECUCAO", "RECEBIDA"), "Execução não pode regredir para recebida.");
expect(!canTransitionDemandStatus("EM_EXECUCAO", "EM_TRIAGEM"), "Execução não pode regredir para triagem.");
expect(!canTransitionDemandStatus("ENCAMINHADA", "RECEBIDA"), "Encaminhada não pode regredir para recebida.");

console.log("T4 demand status integrity runtime: ok");
