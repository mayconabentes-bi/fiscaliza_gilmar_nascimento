import fs from "node:fs";

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const storage = fs.readFileSync("src/server/evidenceStorage.ts", "utf8");
const security = fs.readFileSync("src/server/goLiveSecurity.ts", "utf8");
const server = fs.readFileSync("server.ts", "utf8");
const demand = fs.readFileSync("src/server/citizenDemandPostgres.ts", "utf8");

expect(storage.includes("validateStorageServiceKey"), "Storage deve validar explicitamente a credencial privilegiada.");
expect(storage.includes('startsWith("sb_publishable_")'), "Chave publishable deve ser rejeitada no backend.");
expect(storage.includes('startsWith("sb_secret_")'), "Chave secret moderna deve ser reconhecida.");
expect(storage.includes('payload.role !== "service_role"'), "JWT legado deve exigir role service_role.");
expect(security.includes("assertProductionReadiness"), "Produção deve possuir gate explícito de readiness.");
expect(server.includes("await assertProductionReadiness()"), "Servidor deve validar dependências antes de aceitar tráfego.");
expect(demand.includes('prioridade = "MEDIA"'), "Prioridade pública deve ser definida pelo servidor.");
expect(!demand.includes("cleanEnum(req.body?.prioridade"), "Prioridade enviada pelo cliente não deve controlar a triagem.");
expect(demand.includes('municipio = "Manaus"'), "Município persistido deve ser fixado no backend.");
expect(demand.includes('uf = "AM"'), "UF persistida deve ser fixada no backend.");
expect(demand.includes('codigoIbgeInformado !== "1302603"'), "Código IBGE divergente de Manaus deve ser rejeitado.");

console.log("registration P0 hardening contract: ok");
