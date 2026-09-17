import React, { useState } from "react";
import { Terminal, Lock, Code } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function DevAccess() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const handleAccess = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple "secret" code for demonstration
    if (code === "sudo_root_access_2026") {
      const devUser = {
        id: "dev-master",
        nome_completo: "Desenvolvedor Master",
        email: "dev@system.root",
        plano: "developer", // Special plan
        is_developer: true,
        role: "admin"
      };
      localStorage.setItem("user", JSON.stringify(devUser));
      localStorage.setItem("token", "dev-token-bypass");
      // Force reload to apply changes in App.tsx
      window.location.href = "/"; 
    } else {
      alert("Acesso Negado: Código incorreto.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-emerald-500">
            <Terminal className="w-8 h-8" />
          </div>
        </div>
        
        <h1 className="text-2xl font-mono font-bold text-emerald-500 text-center mb-2">
          SYSTEM_ROOT_ACCESS
        </h1>
        <p className="text-slate-500 text-center mb-8 font-mono text-sm">
          Acesso restrito a desenvolvedores autorizados.
        </p>

        <form onSubmit={handleAccess} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">ACCESS_KEY</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-600" />
              <input 
                type="password" 
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-emerald-500 font-mono focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                placeholder="Enter access code..."
              />
            </div>
          </div>
          
          <button 
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-slate-950 font-bold py-3 rounded-lg font-mono transition-colors flex items-center justify-center gap-2"
          >
            <Code className="w-4 h-4" />
            INITIALIZE_SESSION
          </button>
        </form>
      </div>
    </div>
  );
}
