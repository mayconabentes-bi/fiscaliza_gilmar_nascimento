import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { ChevronDown, CirclePlus, FileBarChart, FileText, Flag, Home as HomeIcon, LayoutDashboard, Lock, LogIn, LogOut, MapPinned, MoreHorizontal, Radar, Search, ShieldCheck, User, Users } from "lucide-react";

import Home from "./pages/Home";
import NovaDemanda from "./pages/NovaDemanda";
import ConsultaProtocolo from "./pages/ConsultaProtocolo";
import LGPDConsent from "./components/LGPDConsent";

const Login = lazy(() => import("./pages/Login"));
const RegisterCidadao = lazy(() => import("./pages/RegisterCidadao"));
const RecoverAccess = lazy(() => import("./pages/RecoverAccess"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminEquipe = lazy(() => import("./pages/AdminEquipe"));
const DashboardPrivado = lazy(() => import("./pages/DashboardPrivado"));
const Metodologia = lazy(() => import("./pages/Metodologia"));
const Estrategia2028 = lazy(() => import("./pages/Estrategia2028"));
const RadarTerritorial = lazy(() => import("./pages/RadarTerritorial"));
const Privacidade = lazy(() => import("./pages/Privacidade"));
const Termos = lazy(() => import("./pages/Termos"));
const Transparencia = lazy(() => import("./pages/Transparencia"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const SecurityAudit = lazy(() => import("./pages/SecurityAudit"));
const AdminDemandas = lazy(() => import("./pages/AdminDemandas"));
const MeusRegistros = lazy(() => import("./pages/MeusRegistros"));
const PerfilCidadao = lazy(() => import("./pages/PerfilCidadao"));

// Papéis internos:
// - ADMIN / SUPER_ADMIN: acesso total ao núcleo privado.
// - COORDENADOR / ATENDENTE: equipe de setor; no frontend só enxergam a Triagem.
// A autorização real continua no backend (requireInternalAccess + lista fechada de rotas).
const SECTOR_STAFF_PROFILES = ["COORDENADOR", "ATENDENTE"];

function isFullAdminUser(user: any) {
  return user?.type === "admin" && ["ADMIN", "SUPER_ADMIN"].includes(user?.perfil_acesso);
}

function isSectorStaffUser(user: any) {
  return user?.type === "admin" && SECTOR_STAFF_PROFILES.includes(user?.perfil_acesso);
}

// Ferramentas administrativas secundárias: aparecem no botão "Mais" (computador e celular).
const ADMIN_MORE_ITEMS = [
  { to: "/admin", label: "Governança", description: "Moderação e controles", icon: ShieldCheck },
  { to: "/admin/equipe", label: "Equipe", description: "Usuários, papéis e setores", icon: Users },
  { to: "/admin/audit", label: "Auditoria", description: "Integridade e segurança", icon: Lock },
  { to: "/relatorios", label: "Relatórios", description: "Saídas analíticas", icon: FileBarChart },
];

function RouteFallback() {
  return <div className="py-20 text-center text-sm font-semibold text-[#657089]">Carregando...</div>;
}

function Brand({ privateMode = false, citizenMode = false, privateHome = "/dashboard" }: { privateMode?: boolean; citizenMode?: boolean; privateHome?: string }) {
  const homePath = privateMode ? privateHome : citizenMode ? "/meus-registros" : "/";
  const ariaLabel = privateMode ? "FISCALIZE - núcleo privado" : citizenMode ? "FISCALIZE - meus registros" : "FISCALIZE - início";
  return (
    <Link to={homePath} className="flex min-w-0 items-center gap-2.5 sm:gap-3" aria-label={ariaLabel}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#d7e0f2] bg-[#032673] shadow-sm"><img src="/app-icon.svg" alt="" className="h-full w-full object-cover" /></span>
      <span className="min-w-0"><span className="block text-[18px] font-extrabold tracking-[-0.045em] text-[#1f2e6e] sm:text-[19px]">FISCALIZE</span>{privateMode && <span className="hidden text-[10px] font-bold uppercase tracking-[0.12em] text-[#657089] sm:block">Núcleo privado</span>}</span>
      {!privateMode && <span className="brand-signature-mark hidden sm:block" aria-hidden="true"><img src="/brand/gilmar-nascimento-oficial.png" alt="" /></span>}
    </Link>
  );
}

function DesktopMoreMenu() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const moreActive = ADMIN_MORE_ITEMS.some((item) => item.to === location.pathname);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Abrir mais ferramentas administrativas"
        className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold transition ${open || moreActive ? "bg-white text-[#1f2e6e] shadow-sm" : "text-[#657089] hover:bg-white/80 hover:text-[#1f2e6e]"}`}
      >
        <span className="flex items-center gap-2"><MoreHorizontal className="h-4 w-4" />Mais<ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} /></span>
      </button>
      {open && (
        <>
          <button type="button" tabIndex={-1} aria-label="Fechar menu" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
          <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 overflow-hidden rounded-2xl border border-[#d7e0f2] bg-white p-2 shadow-[0_24px_60px_rgba(23,32,51,0.18)]">
            {ADMIN_MORE_ITEMS.map(({ to, label, description, icon: Icon }) => (
              <Link key={to} to={to} role="menuitem" className={`flex items-start gap-3 rounded-xl p-3 transition ${location.pathname === to ? "bg-[#eef2fb]" : "hover:bg-[#fafbfe]"}`}>
                <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#1f2e6e]" />
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold text-[#172033]">{label}</span>
                  <span className="mt-0.5 block text-xs text-[#7b8599]">{description}</span>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MobileNav({ user, onLogout }: { user: any; onLogout: () => void | Promise<void> }) {
  const location = useLocation();
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const isAdmin = isFullAdminUser(user);
  const isSectorStaff = isSectorStaffUser(user);
  const isCitizen = user?.type === "cidadao";
  const secondaryAdminPaths = ["/estrategia-2028", ...ADMIN_MORE_ITEMS.map((item) => item.to)];
  const moreActive = secondaryAdminPaths.includes(location.pathname);
  const itemClass = (path: string) => `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 py-2 text-[10px] font-bold transition ${location.pathname === path ? "text-[#1f2e6e]" : "text-[#727d94]"}`;
  const actionClass = "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 py-2 text-[10px] font-bold text-[#727d94] transition hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c94d06]";
  const iconClass = (path: string) => location.pathname === path ? "h-5 w-5 stroke-[2.4]" : "h-5 w-5 stroke-[1.9]";

  useEffect(() => {
    setAdminMenuOpen(false);
  }, [location.pathname]);

  const adminMoreItems = [
    { to: "/estrategia-2028", label: "Estratégia", description: "Leitura estratégica", icon: Flag },
    ...ADMIN_MORE_ITEMS,
  ];

  return (
    <>
      {isAdmin && adminMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar menu administrativo"
            onClick={() => setAdminMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px] lg:hidden"
          />
          <div className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg overflow-hidden rounded-3xl border border-[#d7e0f2] bg-white shadow-[0_24px_60px_rgba(23,32,51,0.24)] lg:hidden">
            <div className="flex items-center justify-between border-b border-[#eef2fb] px-4 py-3">
              <div>
                <p className="text-sm font-extrabold text-[#172033]">Mais ferramentas</p>
                <p className="mt-0.5 text-xs text-[#7b8599]">Núcleo privado FISCALIZE</p>
              </div>
              <button type="button" onClick={() => setAdminMenuOpen(false)} className="rounded-xl px-3 py-2 text-xs font-bold text-[#657089] hover:bg-[#f5f7fb]">Fechar</button>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {adminMoreItems.map(({ to, label, description, icon: Icon }) => (
                <Link key={to} to={to} className={`rounded-2xl border p-3 transition ${location.pathname === to ? "border-[#b9c7e4] bg-[#eef2fb]" : "border-[#e4e9f2] bg-white hover:bg-[#fafbfe]"}`}>
                  <Icon className="h-5 w-5 text-[#1f2e6e]" />
                  <span className="mt-3 block text-sm font-extrabold text-[#172033]">{label}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-[#7b8599]">{description}</span>
                </Link>
              ))}
            </div>
            <div className="border-t border-[#eef2fb] p-3">
              <button type="button" onClick={onLogout} data-mobile-logout="admin" aria-label="Sair da área administrativa" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-extrabold text-red-700">
                <LogOut className="h-4.5 w-4.5" /> Sair da área administrativa
              </button>
            </div>
          </div>
        </>
      )}

      <nav aria-label={isAdmin || isSectorStaff ? "Navegação privada" : "Navegação principal"} className="fixed inset-x-0 bottom-0 z-50 border-t border-[#dde4ef] bg-white/96 px-2 pt-1.5 backdrop-blur-xl lg:hidden pb-[max(env(safe-area-inset-bottom),0.35rem)]">
        <div className="mx-auto flex h-[62px] max-w-lg items-stretch gap-1">
          {isAdmin ? <>
            <Link to="/dashboard" className={itemClass("/dashboard")}><LayoutDashboard className={iconClass("/dashboard")} /><span>Painel</span></Link>
            <Link to="/admin/demandas" className={itemClass("/admin/demandas")}><FileText className={iconClass("/admin/demandas")} /><span>Triagem</span></Link>
            <Link to="/radar-manaus" className={itemClass("/radar-manaus")}><MapPinned className={iconClass("/radar-manaus")} /><span>Radar</span></Link>
            <button
              type="button"
              onClick={() => setAdminMenuOpen((open) => !open)}
              aria-expanded={adminMenuOpen}
              aria-label="Abrir mais ferramentas administrativas"
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 py-2 text-[10px] font-bold transition ${adminMenuOpen || moreActive ? "text-[#1f2e6e]" : "text-[#727d94]"}`}
            >
              <MoreHorizontal className={adminMenuOpen || moreActive ? "h-5 w-5 stroke-[2.4]" : "h-5 w-5 stroke-[1.9]"} />
              <span>Mais</span>
            </button>
          </> : isSectorStaff ? <>
            <Link to="/admin/demandas" className={itemClass("/admin/demandas")}><FileText className={iconClass("/admin/demandas")} /><span>Triagem</span></Link>
            <button type="button" onClick={onLogout} data-mobile-logout="setor" aria-label="Sair da área da equipe" className={actionClass}><LogOut className="h-5 w-5 stroke-[1.9]" /><span>Sair</span></button>
          </> : isCitizen ? <>
            <Link to="/demandas/nova" className={itemClass("/demandas/nova")}><CirclePlus className={iconClass("/demandas/nova")} /><span>Registrar</span></Link>
            <Link to="/meus-registros" className={itemClass("/meus-registros")}><Search className={iconClass("/meus-registros")} /><span>Acompanhar</span></Link>
            <Link to="/perfil" className={itemClass("/perfil")}><User className={iconClass("/perfil")} /><span>Perfil</span></Link>
            <button type="button" onClick={onLogout} data-mobile-logout="user" aria-label="Sair da conta" className={actionClass}><LogOut className="h-5 w-5 stroke-[1.9]" /><span>Sair</span></button>
          </> : <>
            <Link to="/" className={itemClass("/")}><HomeIcon className={iconClass("/")} /><span>Início</span></Link>
            <Link to="/demandas/nova" className={itemClass("/demandas/nova")}><CirclePlus className={iconClass("/demandas/nova")} /><span>Registrar</span></Link>
            <Link to="/protocolo" className={itemClass("/protocolo")}><Search className={iconClass("/protocolo")} /><span>Acompanhar</span></Link>
            <Link to="/login" className={itemClass("/login")}><LogIn className={iconClass("/login")} /><span>Entrar</span></Link>
          </>}
        </div>
      </nav>
    </>
  );
}
function AppShell() {
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let active = true;
    const hydrateSession = async () => {
      const storedUser = localStorage.getItem("user");
      let hasStoredUser = false;

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          hasStoredUser = Boolean(parsedUser);
          if (active) {
            setUser(parsedUser);
            setAuthReady(true);
          }
        } catch {
          localStorage.removeItem("user");
        }
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch("/api/auth/session", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.authenticated && data?.user) {
            localStorage.setItem("user", JSON.stringify(data.user));
            if (active) setUser(data.user);
          } else {
            localStorage.removeItem("user");
            if (active) setUser(null);
          }
        } else if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("user");
          if (active) setUser(null);
        }
      } catch (error: any) {
        if (error?.name !== "AbortError") console.warn("Falha transitória ao validar sessão:", error);
        // Se o backend estiver lento, mantém a sessão visual já criada pelo login.
      } finally {
        window.clearTimeout(timeout);
        if (active && !hasStoredUser) setAuthReady(true);
      }
    };

    hydrateSession();
    return () => { active = false; };
  }, []);

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); } catch (error) { console.error("Logout error:", error); }
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/";
  };

  const isAdmin = isFullAdminUser(user);
  const isSectorStaff = isSectorStaffUser(user);
  const isInternal = isAdmin || isSectorStaff;
  const privateHome = isAdmin ? "/dashboard" : "/admin/demandas";
  const isCitizen = user?.type === "cidadao";
  const onDemandForm = location.pathname === "/demandas/nova";
  const publicNavClass = (path: string) => `rounded-lg px-3 py-2 text-sm font-semibold transition ${location.pathname === path ? "bg-[#eef2fb] text-[#1f2e6e]" : "text-[#657089] hover:bg-white hover:text-[#1f2e6e]"}`;
  const privateNavClass = (path: string) => `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold transition ${location.pathname === path ? "bg-white text-[#1f2e6e] shadow-sm" : "text-[#657089] hover:bg-white/80 hover:text-[#1f2e6e]"}`;
  const privateSection = location.pathname === "/dashboard" ? "Painel" : location.pathname === "/admin/demandas" ? "Triagem" : location.pathname === "/radar-manaus" ? "Radar territorial" : location.pathname === "/estrategia-2028" ? "Estratégia" : location.pathname === "/admin" ? "Governança" : location.pathname === "/admin/equipe" ? "Equipe" : location.pathname === "/admin/audit" ? "Auditoria" : location.pathname === "/relatorios" ? "Relatórios" : "Área privada";

  const publicOnly = (element: ReactNode) => authReady && isInternal ? <Navigate to={privateHome} replace /> : element;
  const citizenOnly = (element: ReactNode) => {
    if (!authReady) return <RouteFallback />;
    if (isInternal) return <Navigate to={privateHome} replace />;
    if (!isCitizen) return <Navigate to="/login" replace />;
    return element;
  };
  const homeRoute = !authReady ? <RouteFallback /> : isInternal ? <Navigate to={privateHome} replace /> : isCitizen ? <Navigate to="/meus-registros" replace /> : <Home />;
  // Somente ADMIN/SUPER_ADMIN. Equipe de setor que tentar abrir volta para a Triagem.
  const adminOnly = (element: ReactNode) => {
    if (!authReady) return <RouteFallback />;
    if (isSectorStaff) return <Navigate to={privateHome} replace />;
    if (!isAdmin) return <Navigate to="/" replace />;
    return element;
  };
  // Qualquer usuário interno ativo (admin ou equipe de setor). O backend filtra os dados pelo setor.
  const internalOnly = (element: ReactNode) => {
    if (!authReady) return <RouteFallback />;
    if (!isInternal) return <Navigate to="/" replace />;
    return element;
  };

  const userChip = (name: string) => (
    <div className="ml-2 flex items-center gap-2 border-l border-[#d7e0f2] pl-3"><div className="flex max-w-40 items-center gap-2 rounded-lg border border-[#dde4ef] bg-white px-3 py-2 text-sm font-semibold text-[#526078]"><User className="h-4 w-4 shrink-0" /><span className="truncate">{name}</span></div><button onClick={handleLogout} aria-label="Sair" className="rounded-lg p-2 text-[#7b8599] transition hover:bg-red-50 hover:text-red-600"><LogOut className="h-4.5 w-4.5" /></button></div>
  );

  return (
    <div className={`flex min-h-screen flex-col font-sans text-[#172033] ${isInternal ? "private-shell" : ""}`}>
      {!isInternal && !isCitizen && !onDemandForm && <LGPDConsent />}
      <div className="brand-accent-bar" aria-hidden="true" />
      <header className="sticky top-0 z-30 border-b border-[#dde4ef] bg-[#f5f7fb]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Brand privateMode={isInternal} citizenMode={isCitizen} privateHome={privateHome} />
          {!isInternal && !onDemandForm && location.pathname !== "/" && <div className="lg:hidden"><Link to="/demandas/nova" className="primary-button min-h-10 rounded-lg px-4 py-2">Registrar</Link></div>}
          {isAdmin ? (
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação privada">
              <Link to="/dashboard" className={privateNavClass("/dashboard")}><span className="flex items-center gap-2"><LayoutDashboard className="h-4 w-4" />Painel</span></Link>
              <Link to="/admin/demandas" className={privateNavClass("/admin/demandas")}><span className="flex items-center gap-2"><FileText className="h-4 w-4" />Triagem</span></Link>
              <Link to="/radar-manaus" className={privateNavClass("/radar-manaus")}><span className="flex items-center gap-2"><MapPinned className="h-4 w-4" />Radar</span></Link>
              <Link to="/estrategia-2028" className={privateNavClass("/estrategia-2028")}><span className="flex items-center gap-2"><Flag className="h-4 w-4" />Estratégia</span></Link>
              <DesktopMoreMenu />
              {userChip(user.nome)}
            </nav>
          ) : isSectorStaff ? (
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação privada">
              <Link to="/admin/demandas" className={privateNavClass("/admin/demandas")}><span className="flex items-center gap-2"><FileText className="h-4 w-4" />Triagem</span></Link>
              {userChip(user.nome)}
            </nav>
          ) : isCitizen ? (
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação da conta">
              <Link to="/demandas/nova" className={publicNavClass("/demandas/nova")}>Registrar</Link>
              <Link to="/meus-registros" className={publicNavClass("/meus-registros")}>Acompanhar</Link>
              <Link to="/perfil" className={publicNavClass("/perfil")}>Perfil</Link>
              <div className="ml-3 flex items-center gap-2 border-l border-[#d7e0f2] pl-4"><div className="flex max-w-40 items-center gap-2 rounded-lg border border-[#dde4ef] bg-white px-3 py-2 text-sm font-semibold text-[#526078]"><User className="h-4 w-4" /><span className="truncate">{user.nome_completo}</span></div><button onClick={handleLogout} aria-label="Sair" className="rounded-lg p-2 text-[#7b8599] transition hover:bg-red-50 hover:text-red-600"><LogOut className="h-4.5 w-4.5" /></button></div>
            </nav>
          ) : (
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação superior">
              <Link to="/" className={publicNavClass("/")}>Início</Link><Link to="/demandas/nova" className={publicNavClass("/demandas/nova")}>Registrar</Link><Link to="/protocolo" className={publicNavClass("/protocolo")}>Acompanhar</Link><Link to="/metodologia" className={publicNavClass("/metodologia")}>Como funciona</Link><Link to="/transparencia" className={publicNavClass("/transparencia")}>Sobre</Link>
              <Link to="/login" className="ml-3 rounded-lg border border-[#cfd8e8] bg-white px-4 py-2.5 text-sm font-bold text-[#1f2e6e] shadow-sm transition hover:border-[#aebcda]">Entrar</Link>
            </nav>
          )}
        </div>
      </header>

      <main data-private-route={isInternal ? location.pathname : undefined} className={`mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-5 sm:px-6 sm:py-8 lg:px-8 lg:pb-8 ${isInternal ? "private-area" : ""}`}>
        {isInternal && <div className="private-context-bar"><span className="private-context-access"><Lock className="h-3.5 w-3.5" /> Acesso autenticado</span><span className="private-context-module">{privateSection}</span></div>}
        <Suspense fallback={<RouteFallback />}><Routes>
          <Route path="/" element={homeRoute} />
          <Route path="/login" element={authReady && isCitizen ? <Navigate to="/meus-registros" replace /> : authReady && isInternal ? <Navigate to={privateHome} replace /> : <Login setUser={setUser} />} />
          <Route path="/register-cidadao" element={publicOnly(<RegisterCidadao />)} />
          <Route path="/recuperar-acesso" element={<RecoverAccess />} />
          <Route path="/demandas/nova" element={publicOnly(<NovaDemanda user={user} />)} />
          <Route path="/protocolo" element={<ConsultaProtocolo />} />
          <Route path="/meus-registros" element={citizenOnly(<MeusRegistros />)} />
          <Route path="/perfil" element={citizenOnly(<PerfilCidadao user={user} />)} />
          <Route path="/metodologia" element={publicOnly(<Metodologia />)} />
          <Route path="/transparencia" element={publicOnly(<Transparencia />)} />
          <Route path="/termos" element={publicOnly(<Termos />)} />
          <Route path="/privacidade" element={publicOnly(<Privacidade />)} />
          <Route path="/dashboard" element={adminOnly(<DashboardPrivado />)} />
          <Route path="/admin" element={adminOnly(<AdminDashboard />)} />
          <Route path="/admin/demandas" element={internalOnly(<AdminDemandas />)} />
          <Route path="/admin/equipe" element={adminOnly(<AdminEquipe user={user} />)} />
          <Route path="/admin/audit" element={adminOnly(<SecurityAudit />)} />
          <Route path="/radar-manaus" element={adminOnly(<RadarTerritorial />)} />
          <Route path="/estrategia-2028" element={adminOnly(<Estrategia2028 />)} />
          <Route path="/relatorios" element={adminOnly(<Relatorios />)} />
          <Route path="*" element={<Navigate to={isInternal ? privateHome : isCitizen ? "/meus-registros" : "/"} replace />} />
        </Routes></Suspense>
      </main>

      {!isInternal && !isCitizen && <footer className="mt-auto border-t border-[#d7e0f2] bg-white pb-24 pt-9 lg:pb-9"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between"><div className="flex max-w-2xl flex-col gap-5 sm:flex-row sm:items-start"><span className="brand-signature-mark brand-signature-mark--footer" aria-hidden="true"><img src="/brand/gilmar-nascimento-oficial.png" alt="" /></span><div className="max-w-xl"><div className="flex items-center gap-2.5"><Radar className="h-4 w-4 text-[#1f2e6e]" /><span className="text-base font-extrabold text-[#1f2e6e]">FISCALIZE</span></div><p className="mt-3 text-sm leading-relaxed text-[#657089]">Um espaço para registrar, organizar e acompanhar problemas relatados em Manaus.</p></div></div><div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#657089]"><Link to="/metodologia" className="hover:text-[#1f2e6e]">Como funciona</Link><Link to="/transparencia" className="hover:text-[#1f2e6e]">Sobre</Link><Link to="/privacidade" className="hover:text-[#1f2e6e]">Privacidade</Link><Link to="/termos" className="hover:text-[#1f2e6e]">Termos</Link></div></div><div className="mt-8 border-t border-[#eef2fb] pt-5 text-xs leading-relaxed text-[#7b8599]">© {new Date().getFullYear()} FISCALIZE.</div></div></footer>}
      <MobileNav user={user} onLogout={handleLogout} />
    </div>
  );
}

export default function App() { return <Router><AppShell /></Router>; }