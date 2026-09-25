import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const app = read("src/App.tsx");
const login = read("src/pages/Login.tsx");
const records = read("src/pages/MeusRegistros.tsx");
const profile = read("src/pages/PerfilCidadao.tsx");
const postgres = read("src/server/citizenDemandPostgres.ts");
const local = read("src/server/routes.ts");
const demandForm = read("src/pages/NovaDemanda.tsx");
const registration = read("src/pages/RegisterCidadao.tsx");
const citizenAuth = read("src/server/citizenAuthPostgres.ts");

// Contrato de ponta a ponta: um teste HTTP que omite type recebe 403,
// mesmo com e-mail e senha corretos. Impedir falso diagnóstico 401.
expect(registration.includes('fetch("/api/auth/register/cidadao"'), "Cadastro público deve chamar o endpoint cidadão.");
expect(registration.includes("body: JSON.stringify(formData)"), "Cadastro deve enviar os dados do formulário, incluindo password.");
expect(login.includes('type === "admin" ? "/api/auth/admin/login" : "/api/auth/login"'), "Login Pessoa deve chamar endpoint cidadão, não o administrativo.");
expect(login.includes('{ email: normalizedEmail, password, type: "cidadao" }'), "Login Pessoa deve enviar type cidadão exigido pelo backend.");
expect(citizenAuth.includes('req.body?.type !== "cidadao"'), "Backend exige type cidadão no login; smoke HTTP deve enviá-lo.");
expect(citizenAuth.includes('await bcrypt.hash(password, 12)') && citizenAuth.includes('await bcrypt.compare(password, String(user.password_hash))'), "Cadastro e login devem usar bcrypt para a senha.");
expect(citizenAuth.includes('normalizedEmail = cleanEmail(req.body?.email)') && citizenAuth.includes('lower(email) = lower('), "Cadastro/login devem normalizar e buscar e-mail sem diferença de caixa.");


expect(login.includes('navigate(type === "admin" ? "/dashboard" : "/meus-registros")'), "Login cidadão deve abrir Meus registros.");
expect(login.includes('const initialType = searchParams.get("admin") === "1" ? "admin" : "cidadao"'), "Login deve manter cidadão como modo padrão e aceitar admin explícito.");
expect(login.includes('sm:hidden') && login.includes('Acesso administrativo'), "Acesso administrativo deve ficar secundário no mobile.");
expect(login.includes('aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}') && login.includes('type={showPassword ? "text" : "password"}'), "Login deve permitir revelar a senha somente por ação explícita.");
expect(login.includes('res.status === 429') && login.includes('Muitas tentativas. Aguarde alguns minutos'), "Login deve orientar rate limit sem revelar detalhes internos.");
expect(login.includes('localStorage.setItem("user"') && !login.includes('localStorage.setItem("token"') && !login.includes('localStorage.setItem("password"'), "Frontend pode hidratar usuário visual, mas nunca deve persistir token ou senha no localStorage.");
expect(app.includes('path="/meus-registros"') && app.includes('citizenOnly(<MeusRegistros />)'), "Meus registros deve ser rota exclusiva do cidadão autenticado.");
expect(app.includes('path="/perfil"') && app.includes('citizenOnly(<PerfilCidadao user={user} />)'), "Perfil deve ser rota exclusiva do cidadão autenticado.");
expect(app.includes('isCitizen ? <Navigate to="/meus-registros" replace />'), "A raiz autenticada deve redirecionar cidadão para Meus registros.");

const citizenMobileBlock = app.slice(app.indexOf('isCitizen ? <>'), app.indexOf('</> : <>', app.indexOf('isCitizen ? <>')));
for (const label of ["Registrar", "Acompanhar", "Perfil", "Sair"]) {
  expect(citizenMobileBlock.includes(`<span>${label}</span>`), `Menu mobile cidadão deve conter ${label}.`);
}
expect(!citizenMobileBlock.includes("<span>Início</span>"), "Menu mobile cidadão não deve exibir Início.");
expect(!citizenMobileBlock.includes("<span>Entrar</span>"), "Menu mobile cidadão autenticado não deve exibir Entrar.");
expect(app.includes('aria-label="Navegação da conta"'), "Desktop deve ter navegação específica da conta.");
expect(app.includes('to="/perfil"') && app.includes(">Perfil</Link>"), "Desktop cidadão deve conter Perfil.");
expect(app.includes('data-mobile-logout="user"') && app.includes('aria-label="Sair da conta"'), "Logout cidadão deve permanecer visível no mobile.");
expect(citizenMobileBlock.includes('to="/meus-registros"') && citizenMobileBlock.includes("<span>Acompanhar</span>"), "Acompanhar no mobile autenticado deve abrir Meus registros.");
expect(app.includes('aria-label="Navegação da conta"') && app.includes('to="/meus-registros" className={publicNavClass("/meus-registros")}>Acompanhar</Link>'), "Acompanhar no desktop autenticado deve abrir Meus registros.");

expect(records.includes("/api/minha-conta/demandas"), "Tela Meus registros deve carregar somente a API privada da conta.");
expect(records.includes('to={`/protocolo?codigo='), "Cada registro deve abrir o acompanhamento pelo protocolo.");
expect(records.includes("Você ainda não tem registros nesta conta."), "Tela deve ter estado vazio orientando novo registro.");
expect(records.includes('data-citizen-followup-list') && records.includes('Registrar nova ocorrência'), "Meus registros deve priorizar a lista vinculada e o novo registro.");
expect(records.includes('Consultar outro protocolo') && !records.includes('Novo problema'), "Consulta manual deve ser secundária, sem repetir o card Registrar/Acompanhar.");
expect(records.includes('aria-label="Atualizar meus registros"'), "Atualização da lista deve permanecer acessível no mobile.");
expect(profile.includes("Perfil") && profile.includes("Faixa etária") && profile.includes("Localidade"), "Perfil deve exibir os dados básicos da conta.");
expect(profile.includes('"/api/minha-conta/demandas"') && profile.includes("Seus registros") && profile.includes("Ver todos") && profile.includes("slice(0, 3)"), "Perfil deve mostrar resumo dos registros vinculados.");
expect(demandForm.includes('user?.type === "cidadao"') && demandForm.includes('to="/meus-registros"') && demandForm.includes("Ver meus registros"), "Confirmação de envio autenticado deve oferecer Ver meus registros.");
expect(app.includes('<NovaDemanda user={user} />'), "Shell deve informar a sessão cidadã ao formulário para exibir o atalho pós-envio.");

for (const source of [postgres, local]) {
  expect(source.includes('app.get("/api/minha-conta/demandas"'), "Backend deve oferecer endpoint privado de Meus registros.");
  expect(source.includes("citizenClaims(req)"), "Endpoint de Meus registros deve exigir claims cidadãs.");
  expect(source.includes("where usuario_id =") || source.includes("WHERE usuario_id = ?"), "Endpoint deve filtrar registros pelo usuário autenticado.");
  expect(source.includes('Cache-Control", "no-store, private"'), "Resposta da conta deve impedir cache público.");
}

// isInternal = ADMIN/SUPER_ADMIN + equipe de setor (COORDENADOR/ATENDENTE).
expect(app.includes('{!isInternal && !isCitizen && <footer'), "Conta cidadã e equipe interna não devem exibir o rodapé/navegação pública.");
expect(app.includes('!isInternal && !isCitizen && !onDemandForm && <LGPDConsent />'), "Conta autenticada (cidadã ou equipe interna) não deve repetir o aviso público de consentimento.");

console.log("Citizen authenticated experience contract OK: Meus registros, Registrar, Acompanhar, Perfil e Sair.");