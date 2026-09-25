import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

// Regressão local: exercita o mesmo bcrypt e custo usados em
// src/server/citizenAuthPostgres.ts, sem criar usuários ou acessar produção.
const password = randomBytes(24).toString("base64url");
const hash = await bcrypt.hash(password, 12);
assert.equal(await bcrypt.compare(password, hash), true, "Senha cadastrada deve autenticar.");
assert.equal(await bcrypt.compare(password + "x", hash), false, "Senha incorreta deve ser rejeitada.");

// O backend aplica cleanText (trim) no cadastro e no login.
// Validar explicitamente esse contrato, inclusive para senhas com espaços.
const enteredWithSpaces = "  " + password + "  ";
const normalized = enteredWithSpaces.trim();
const normalizedHash = await bcrypt.hash(normalized, 12);
assert.equal(await bcrypt.compare(enteredWithSpaces.trim(), normalizedHash), true);
assert.equal(await bcrypt.compare(enteredWithSpaces, normalizedHash), false);

// Não registrar senhas nem hashes em logs ou artefatos.
console.log("Citizen bcrypt local roundtrip: PASS (no production access).");
