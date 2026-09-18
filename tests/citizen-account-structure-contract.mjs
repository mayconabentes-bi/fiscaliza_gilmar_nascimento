import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const auth = read("src/server/citizenAuthPostgres.ts");
const agePolicy = read("src/server/agePolicy.ts");
const register = read("src/pages/RegisterCidadao.tsx");
const privacy = read("src/pages/Privacidade.tsx");
const terms = read("src/pages/Termos.tsx");
const db = read("src/server/db.ts");
const cep = read("src/server/cepLookup.ts");
const migration = read("supabase/migrations/20260918154500_citizen_profile_cleanup.sql");

expect(!auth.includes("AGE_18_PLUS"), "Backend de cadastro não deve referenciar AGE_18_PLUS.");
expect(auth.includes("type AgeBand"), "Backend deve usar o tipo AgeBand real.");
expect(!agePolicy.includes('"AGE_18_PLUS"'), "Política etária não deve aceitar AGE_18_PLUS.");

for (const label of ["18 a 24", "25 a 34", "35 a 44", "45 a 59", "60 anos ou mais"]) {
  expect(privacy.includes(label), `Privacidade deve citar ${label}.`);
}
for (const label of ["18–24", "25–34", "35–44", "45–59", "60 anos ou mais"]) {
  expect(terms.includes(label), `Termos devem citar ${label}.`);
}

expect(!db.includes("indice_contribuicao_civica"), "SQLite não deve criar indice_contribuicao_civica.");
expect(!db.includes("nivel_verificacao"), "SQLite não deve criar nivel_verificacao.");
expect(migration.includes("drop column if exists indice_contribuicao_civica"), "Migration deve remover índice cívico.");
expect(migration.includes("drop column if exists nivel_verificacao"), "Migration deve remover nível de verificação.");

expect(register.includes("/api/localizacao/cep/"), "Cadastro deve usar a API interna de CEP.");
expect(register.includes('autoComplete="postal-code"'), "Cadastro deve otimizar entrada de CEP no mobile.");
expect(register.includes('inputMode="numeric"'), "CEP deve abrir teclado numérico no mobile.");
expect(register.includes("O CEP não é armazenado na sua conta"), "Cadastro deve explicar minimização do CEP.");
expect(!register.includes("cep: formData") && !register.includes("cep: cep"), "CEP não deve ser enviado no payload de criação de conta.");
expect(cep.includes("VIACEP_API_BASE") && cep.includes("AbortController"), "Backend de CEP deve manter timeout e provedor configurável.");

console.log("Citizen account structure contract OK: age bands, CEP minimization and legacy score cleanup.");
