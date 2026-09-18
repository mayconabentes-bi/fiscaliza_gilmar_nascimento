import fs from "node:fs";

const expect = (condition, message) => { if (!condition) throw new Error(message); };
const form = fs.readFileSync("src/pages/NovaDemanda.tsx", "utf8");
const image = fs.readFileSync("src/lib/mobileImage.ts", "utf8");
const demand = fs.readFileSync("src/server/citizenDemandPostgres.ts", "utf8");
const admin = fs.readFileSync("src/server/privateAdminPostgresRoutes.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260918110000_demand_multi_evidence.sql", "utf8");
const app = fs.readFileSync("src/server/app.ts", "utf8");

expect(form.includes("const MAX_PHOTOS = 7"), "Formulário deve limitar a 7 fotos.");
expect(form.includes('capture="environment"') && form.includes("multiple"), "Câmera e galeria devem possuir seletores independentes.");
expect(form.includes("handleCameraPhoto") && form.includes("handleGalleryPhotos"), "Fluxos de câmera e galeria devem ser independentes.");
expect(form.includes("foto_evidencias_base64: photos.map"), "Payload deve enviar a coleção de fotos.");
expect(form.includes("removePhoto"), "Usuário deve conseguir remover foto antes do envio.");
expect(!image.includes("createImageBitmap"), "Processamento mobile não deve depender de createImageBitmap.");
expect(image.includes("MAX_OUTPUT_BYTES = 300 * 1024"), "Cada foto deve ser otimizada para o orçamento serverless.");
expect(image.includes("new Image()") && image.includes("URL.createObjectURL"), "Decodificação deve usar caminho compatível com navegadores móveis.");
expect(demand.includes("fotoEvidenciasBase64.length > 7"), "Backend deve rejeitar mais de 7 fotos.");
expect(demand.includes("Promise.allSettled") && demand.includes("public.demanda_evidencias"), "Backend deve persistir múltiplas evidências e limpar uploads parciais.");
expect(admin.includes("/api/admin/demandas/:id/evidencias"), "Admin deve listar todas as fotos da demanda.");
expect(migration.includes("ordem between 1 and 7") && migration.includes("enable row level security"), "Migration deve limitar 7 fotos e manter RLS.");
expect(app.includes('express.json({ limit: "4mb" })'), "API deve aceitar payload otimizado de até 7 fotos.");

console.log("photo-evidence-contract: ok");
