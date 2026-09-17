import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { CirclePlus, FileBarChart, FileText, Flag, Home as HomeIcon, LayoutDashboard, Lock, LogIn, LogOut, MapPinned, Radar, Search, ShieldCheck, User } from "lucide-react";

import Home from "./pages/Home";
import NovaDemanda from "./pages/NovaDemanda";
import ConsultaProtocolo from "./pages/ConsultaProtocolo";
import LGPDConsent from "./components/LGPDConsent";

const Login = lazy(() => import("./pages/Login"));
const RegisterCidadao = lazy(() => import("./pages/RegisterCidadao"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
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

function RouteFallback() {
  return <div className="py-20 text-center text-sm font-semibold text-[#69736d]">Carregando...</div>;
}

function Brand({ privateMode = false }: { privateMode?: boolean }) {
  return (
    <Link to={privateMode ? "/dashboard" : "/"} className="flex items-center gap-3" aria-label={privateMode ? "FISCALIZE - núcleo privado" : "FISCALIZE - início"}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dfe5e1] bg-white text-[#157a55] shadow-sm"><Radar className="h-[18px] w-[18px]" strokeWidth={2.2} /></span>
      <span><span className="block text-[19px] font-extrabold tracking-[-0.045em] text-[#101513]">FISCALIZE</span>{privateMode && <span className="hidden text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a928e] sm:block">Privado</span>}</span>
    </Link>
  );
}

function MobileNav({ user }: { user: any }) {
  const location = useLocation();
  const isAdmin = user?.type === "admin" && ["ADMIN", "SUPER_ADMIN"].includes(user?.perfil_acesso);
  const itemClass = (path: string) => `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 py-2 text-[10px] font-bold transition ${location.pathname === path ? "text-[#157a55]" : "text-[#78817c]"}`;
  const iconClass = (path: string) => location.pathname === path ? "h-5 w-5 stroke-[2.4]" : "h-5 w-5 stroke-[1.9]";

  return (
    <nav aria-label={isAdmin ? "Navegação privada" : "Navegação principal"} className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e4e8e5] bg-white/96 px-2 pt-1.5 backdrop-blur-xl lg:hidden pb-[max(env(safe-area-inset-bottom),0.35rem)]">
      <div className="mx-auto flex h-[62px] max-w-lg items-stretch gap-1">
        {isAdmin ? <>
          <Link to="/dashboard" className={itemClass("/dashboard")}><LayoutDashboard className={iconClass("/dashboard")} /><span>Painel</span></Link>
          <Link to="/admin/demandas" className={itemClass("/admin/demandas")}><FileText className={iconClass("/admin/demandas")} /><span>Triagem</span></Link>
          <Link to="/radar-manaus" className={itemClass("/radar-manaus")}><MapPinned className={iconClass("/radar-manaus")} /><span>Radar</span></Link>
          <Link to="/estrategia-2028" className={itemClass("/estrategia-2028")}><Flag className={iconClass("/estrategia-2028")} /><span>Estratégia</span></Link>
        </> : <>
          <Link to="/" className={itemClass("/")}><HomeIcon className={iconClass("/")} /><span>Início</span></Link>
          <Link to="/demandas/nova" className={itemClass("/demandas/nova")}><CirclePlus className={iconClass("/demandas/nova")} /><span>Registrar</span></Link>
          <Link to="/protocolo" className={itemClass("/protocolo")}><Search className={iconClass("/protocolo")} /><span>Acompanhar</span></Link>
          {!user && <Link to="/login" className={itemClass("/login")}><LogIn className={iconClass("/login")} /><span>Entrar</span></Link>}
        </>}
      </div>
    </nav>
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

  const isAdmin = user?.type === "admin" && ["ADMIN", "SUPER_ADMIN"].includes(user?.perfil_acesso);
  const onDemandForm = location.pathname === "/demandas/nova";
  const publicNavClass = (path: string) => `rounded-lg px-3 py-2 text-sm font-semibold transition ${location.pathname === path ? "text-[#101513]" : "text-[#69736d] hover:text-[#101513]"}`;
  const privateNavClass = (path: string) => `rounded-lg px-3 py-2 text-sm font-bold transition ${location.pathname === path ? "bg-white text-[#101513] shadow-sm" : "text-[#69736d] hover:bg-white/70 hover:text-[#101513]"}`;

  const publicOnly = (element: ReactNode) => authReady && isAdmin ? <Navigate to="/dashboard" replace /> : element;
  const adminOnly = (element: ReactNode) => {
    if (!authReady) return <RouteFallback />;
    if (!isAdmin) return <Navigate to="/" replace />;
    return element;
  };

  return (
    <div className="flex min-h-screen flex-col font-sans text-[#101513]">
      {!isAdmin && !onDemandForm && <LGPDConsent />}
      <header className="sticky top-0 z-30 border-b border-[#e7ebe8] bg-[#f7f8f6]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Brand privateMode={isAdmin} />
          {!isAdmin && !onDemandForm && <div className="lg:hidden"><Link to="/demandas/nova" className="primary-button min-h-10 rounded-lg px-4 py-2">Registrar</Link></div>}
          {isAdmin ? (
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação privada">
              <Link to="/dashboard" className={privateNavClass("/dashboard")}><span className="flex items-center gap-2"><LayoutDashboard className="h-4 w-4" />Painel</span></Link>
              <Link to="/admin/demandas" className={privateNavClass("/admin/demandas")}><span className="flex items-center gap-2"><FileText className="h-4 w-4" />Triagem</span></Link>
              <Link to="/radar-manaus" className={privateNavClass("/radar-manaus")}><span className="flex items-center gap-2"><MapPinned className="h-4 w-4" />Radar</span></Link>
              <Link to="/estrategia-2028" className={privateNavClass("/estrategia-2028")}><span className="flex items-center gap-2"><Flag className="h-4 w-4" />Estratégia</span></Link>
              <Link to="/admin" className={privateNavClass("/admin")}><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Governança</span></Link>
              <Link to="/admin/audit" className={privateNavClass("/admin/audit")}><span className="flex items-center gap-2"><Lock className="h-4 w-4" />Auditoria</span></Link>
              <Link to="/relatorios" className={privateNavClass("/relatorios")}><span className="flex items-center gap-2"><FileBarChart className="h-4 w-4" />Relatórios</span></Link>
              <div className="ml-2 flex items-center gap-2 border-l border-[#e0e5e2] pl-3"><div className="flex max-w-40 items-center gap-2 rounded-lg border border-[#e4e8e5] bg-white px-3 py-2 text-sm font-semibold text-[#56615b]"><User className="h-4 w-4" /><span className="truncate">{user.nome}</span></div><button onClick={handleLogout} aria-label="Sair" className="rounded-lg p-2 text-[#8a928e] transition hover:bg-red-50 hover:text-red-600"><LogOut className="h-4.5 w-4.5" /></button></div>
            </nav>
          ) : (
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação superior">
              <Link to="/" className={publicNavClass("/")}>Início</Link><Link to="/demandas/nova" className={publicNavClass("/demandas/nova")}>Registrar</Link><Link to="/protocolo" className={publicNavClass("/protocolo")}>Acompanhar</Link><Link to="/metodologia" className={publicNavClass("/metodologia")}>Como funciona</Link><Link to="/transparencia" className={publicNavClass("/transparencia")}>Sobre</Link>
              {user ? <div className="ml-3 flex items-center gap-2 border-l border-[#e0e5e2] pl-4"><div className="flex max-w-40 items-center gap-2 rounded-lg border border-[#e4e8e5] bg-white px-3 py-2 text-sm font-semibold text-[#56615b]"><User className="h-4 w-4" /><span className="truncate">{user.nome_completo}</span></div><button onClick={handleLogout} aria-label="Sair" className="rounded-lg p-2 text-[#8a928e] transition hover:bg-red-50 hover:text-red-600"><LogOut className="h-4.5 w-4.5" /></button></div> : <Link to="/login" className="ml-3 rounded-lg border border-[#dfe4e1] bg-white px-4 py-2.5 text-sm font-bold text-[#101513] shadow-sm">Entrar</Link>}
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-5 sm:px-6 sm:py-8 lg:px-8 lg:pb-8">
        <Suspense fallback={<RouteFallback />}><Routes>
          <Route path="/" element={publicOnly(<Home />)} />
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/register-cidadao" element={publicOnly(<RegisterCidadao />)} />
          <Route path="/demandas/nova" element={publicOnly(<NovaDemanda />)} />
          <Route path="/protocolo" element={<ConsultaProtocolo />} />
          <Route path="/metodologia" element={publicOnly(<Metodologia />)} />
          <Route path="/transparencia" element={publicOnly(<Transparencia />)} />
          <Route path="/termos" element={publicOnly(<Termos />)} />
          <Route path="/privacidade" element={publicOnly(<Privacidade />)} />
          <Route path="/dashboard" element={adminOnly(<DashboardPrivado />)} />
          <Route path="/admin" element={adminOnly(<AdminDashboard />)} />
          <Route path="/admin/demandas" element={adminOnly(<AdminDemandas />)} />
          <Route path="/admin/audit" element={adminOnly(<SecurityAudit />)} />
          <Route path="/radar-manaus" element={adminOnly(<RadarTerritorial />)} />
          <Route path="/estrategia-2028" element={adminOnly(<Estrategia2028 />)} />
          <Route path="/relatorios" element={adminOnly(<Relatorios />)} />
          <Route path="*" element={<Navigate to={isAdmin ? "/dashboard" : "/"} replace />} />
        </Routes></Suspense>
      </main>

      {!isAdmin && <footer className="mt-auto border-t border-[#e4e8e5] bg-white pb-24 pt-9 lg:pb-9"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between"><div className="max-w-xl"><div className="flex items-center gap-2.5"><Radar className="h-4 w-4 text-[#157a55]" /><span className="text-base font-extrabold">FISCALIZE</span></div><p className="mt-3 text-sm leading-relaxed text-[#69736d]">Um espaço para registrar, organizar e acompanhar problemas relatados em Manaus.</p></div><div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#69736d]"><Link to="/metodologia" className="hover:text-[#101513]">Como funciona</Link><Link to="/transparencia" className="hover:text-[#101513]">Sobre</Link><Link to="/privacidade" className="hover:text-[#101513]">Privacidade</Link><Link to="/termos" className="hover:text-[#101513]">Termos</Link></div></div><div className="mt-8 border-t border-[#eef0ee] pt-5 text-xs leading-relaxed text-[#8a928e]">© {new Date().getFullYear()} FISCALIZE.</div></div></footer>}
      <MobileNav user={user} />
    </div>
  );
}

export default function App() { return <Router><AppShell /></Router>; }