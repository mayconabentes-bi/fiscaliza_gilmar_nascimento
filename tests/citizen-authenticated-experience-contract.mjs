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
const protocol = read("src/pages/ConsultaProtocolo.tsx");

expect(login.includes('type === "admin" ? "/dashboard" : "/meus-registros"'), "Login cidadão deve abrir Meus registros.");
expect(login.includes('const initialType = searchParams.get("admin") === "1" ? "admin" : "cidadao"'), "Login deve manter cidadão como modo padrão e aceitar admin explícito.");
expect(login.includes('sm:hidden') && login.includes('Acesso administrativo'), "Acesso administrativo deve ficar secundário no mobile.");
expect(login.includes('aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}') && login.includes('type={showPassword ? "text" : "password"}'), "Login deve permitir revelar a senha somente por ação explícita.");
expect(login.includes('res.status === 429') && login.includes('Muitas tentativas. Aguarde alguns minutos'), "Login deve orientar rate limit sem revelar detalhes internos.");
expect(login.includes('localStorage.setItem("user"') && !login.includes('localStorage.setItem("token"') && !login.includes('localStorage.setItem("password"'), "Frontend pode hidratar usuário visual, mas nunca deve persistir token ou senha no localStorage.");
expect(login.includes("registrationState?.registrationSuccess") && login.includes("Conta criada com sucesso."), "Login deve confirmar visualmente o cadastro concluído.");
expect(login.includes('useState(() => registrationState?.email || "")'), "Login deve preencher o e-mail recebido por estado de navegação, sem query string.");
expect(login.includes("firstAccess: Boolean(registrationState?.registrationSuccess)"), "Login após cadastro deve sinalizar primeiro acesso para Meus registros.");
expect(login.includes('searchParams.get("sessao") === "expirada"') && login.includes("Sua sessão terminou."), "Login deve orientar retorno após expiração da sessão.");
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
expect(records.includes("data-first-access") && records.includes("Sua conta está pronta."), "Primeiro acesso deve confirmar que a conta está pronta.");
expect(records.includes('response.status === 401 || response.status === 403') && records.includes('localStorage.removeItem("user")') && records.includes('window.location.replace("/login?sessao=expirada")'), "Meus registros deve recuperar de sessão expirada sem deixar o cidadão preso.");
expect(profile.includes("Perfil") && profile.includes("Faixa etária") && profile.includes("Localidade"), "Perfil deve exibir os dados básicos da conta.");
expect(profile.includes('"/api/minha-conta/demandas"') && profile.includes("Seus registros") && profile.includes("Ver todos") && profile.includes("slice(0, 3)"), "Perfil deve mostrar resumo dos registros vinculados.");
expect(profile.includes('response.status === 401 || response.status === 403') && profile.includes('window.location.replace("/login?sessao=expirada")'), "Perfil deve recuperar de sessão expirada sem deixar estado autenticado obsoleto.");
expect(profile.includes('state={{ email: user?.email || "", fromProfile: true }}') && profile.includes('/recuperar-acesso?modo=senha'), "Perfil deve abrir recuperação com e-mail da conta via navigation state, sem expô-lo na URL.");
expect(profile.includes('state={{ fromAccount: true }}'), "Registros recentes do perfil devem preservar contexto ao abrir o acompanhamento.");
expect(demandForm.includes('user?.type === "cidadao"') && demandForm.includes('to="/meus-registros"') && demandForm.includes("Ver meus registros"), "Confirmação de envio autenticado deve oferecer Ver meus registros.");
expect(demandForm.includes('faixa_etaria: user?.type === "cidadao" ? String(user?.faixa_etaria || "") : ""'), "Nova demanda autenticada deve reutilizar a faixa etária da conta quando disponível.");
expect(demandForm.includes('disabled={user?.type === "cidadao" && Boolean(user?.faixa_etaria)}'), "Faixa etária da conta deve ficar protegida contra alteração acidental no formulário.");
expect(demandForm.includes('readOnly={user?.type === "cidadao"}') && demandForm.includes("Nome da sua conta."), "Nome autenticado deve ser apresentado como dado da conta no formulário.");
expect(app.includes('<NovaDemanda user={user} />'), "Shell deve informar a sessão cidadã ao formulário para exibir o atalho pós-envio.");
expect(app.includes('<ConsultaProtocolo user={user} />'), "Shell deve informar a sessão cidadã à consulta sem exigir autenticação para a rota pública.");
expect(records.includes('state={{ fromAccount: true }}') && records.includes("Ver andamento"), "Meus registros deve preservar contexto ao abrir acompanhamento.");
expect(demandForm.includes('state={{ fromSubmission: true }}'), "Envio concluído deve preservar contexto ao abrir o protocolo recém-gerado.");
expect(protocol.includes('data-account-followup-context') && protocol.includes('data-account-followup-return') && protocol.includes("Voltar aos meus registros"), "Acompanhamento autenticado deve oferecer retorno explícito à conta.");
expect(protocol.includes('const isCitizen = user?.type === "cidadao"'), "A integração da conta no protocolo deve ser apenas contextual e não tornar a consulta pública privada.");

for (const source of [postgres, local]) {
  // A identidade do cidadão autenticado deve vir da conta, não de campos manipuláveis do formulário.
  expect(source.includes('app.get("/api/minha-conta/demandas"'), "Backend deve oferecer endpoint privado de Meus registros.");
  expect(source.includes("citizenClaims(req)"), "Endpoint de Meus registros deve exigir claims cidadãs.");
  expect(source.includes("where usuario_id =") || source.includes("WHERE usuario_id = ?"), "Endpoint deve filtrar registros pelo usuário autenticado.");
  expect(source.includes('Cache-Control", "no-store, private"'), "Resposta da conta deve impedir cache público.");
}

expect(postgres.includes("select id, nome_completo, status, faixa_etaria") && postgres.includes("nome = cleanText(user.nome_completo"), "Backend Postgres deve usar nome e faixa etária da conta em demanda autenticada.");
expect(postgres.includes("faixa_etaria: faixaEtaria"), "Fingerprint idempotente deve usar a faixa etária efetiva validada pelo servidor.");
expect(local.includes('SELECT nome_completo, status FROM usuarios WHERE id = ?') && local.includes("nome = cleanText(account.nome_completo"), "Backend local deve manter o nome da conta como autoridade no registro autenticado.");

// isInternal = ADMIN/SUPER_ADMIN + equipe de setor (COORDENADOR/ATENDENTE).
expect(app.includes('{!isInternal && !isCitizen && <footer'), "Conta cidadã e equipe interna não devem exibir o rodapé/navegação pública.");
expect(app.includes('!isInternal && !isCitizen && !onDemandForm && <LGPDConsent />'), "Conta autenticada (cidadã ou equipe interna) não deve repetir o aviso público de consentimento.");
expect(app.includes('if (!response.ok || data?.success !== true)') && app.includes('Por segurança, você continua conectado.'), "Logout deve falhar fechado se o servidor não confirmar a limpeza da sessão.");
expect(app.includes('window.location.replace(target)') && app.includes('"/login?saida=1"') && app.includes('"/login?admin=1&saida=1"'), "Logout confirmado deve voltar ao login adequado e permitir reentrada.");
expect(app.includes('data-logout-error') && app.includes('role="alert"'), "Falha de logout deve ser comunicada de forma acessível.");
expect(app.includes('<RecoverAccess onSessionReset={() => setUser(null)} />'), "Troca de senha deve limpar também o estado React da sessão atual.");

console.log("Citizen authenticated experience contract OK: Meus registros, Registrar, Acompanhar, Perfil e Sair.");