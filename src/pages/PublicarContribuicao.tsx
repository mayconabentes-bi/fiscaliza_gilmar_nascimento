import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function PublicarContribuicao() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const [formData, setFormData] = useState({
    tipo_participacao: "proposta",
    area_tematica: "saude",
    municipio: user?.municipio || "",
    conteudo: "",
  });
  const [error, setError] = useState("");

  if (!user || user.type !== "cidadao") {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-slate-900">Acesso Restrito</h2>
        <p className="mt-2 text-slate-600">Apenas cidadãos cadastrados podem publicar contribuições.</p>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/publicacoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao publicar");
      }

      if (data.status_moderacao === "rejeitado") {
        setError("Sua contribuição foi rejeitada pela moderação automática por conter termos inadequados.");
      } else {
        navigate("/temas");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Publicar Contribuição Cívica</h1>
        <p className="mt-2 text-slate-600">
          Sua contribuição deve ser estruturada, objetiva e focada em políticas públicas ou economia.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md text-sm border border-red-100">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="tipo_participacao" className="block text-sm font-medium leading-6 text-slate-900">
              Tipo de Participação
            </label>
            <select
              id="tipo_participacao"
              name="tipo_participacao"
              value={formData.tipo_participacao}
              onChange={handleChange}
              className="mt-2 block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6 px-3"
            >
              <option value="proposta">Proposta</option>
              <option value="avaliacao">Avaliação</option>
              <option value="sugestao">Sugestão</option>
              <option value="relato">Relato</option>
            </select>
          </div>

          <div>
            <label htmlFor="area_tematica" className="block text-sm font-medium leading-6 text-slate-900">
              Área Temática
            </label>
            <select
              id="area_tematica"
              name="area_tematica"
              value={formData.area_tematica}
              onChange={handleChange}
              className="mt-2 block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6 px-3"
            >
              <option value="saude">Saúde</option>
              <option value="educacao">Educação</option>
              <option value="seguranca">Segurança Pública</option>
              <option value="infraestrutura">Infraestrutura</option>
              <option value="economia">Economia e Emprego</option>
              <option value="meio_ambiente">Meio Ambiente</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="municipio" className="block text-sm font-medium leading-6 text-slate-900">
            Município Afetado
          </label>
          <input
            id="municipio"
            name="municipio"
            type="text"
            required
            value={formData.municipio}
            onChange={handleChange}
            className="mt-2 block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6 px-3"
          />
        </div>

        <div>
          <label htmlFor="conteudo" className="block text-sm font-medium leading-6 text-slate-900">
            Conteúdo da Contribuição
          </label>
          <p className="text-xs text-slate-500 mt-1 mb-2">
            Descreva claramente o problema ou proposta. Evite discursos emocionais ou ataques.
          </p>
          <textarea
            id="conteudo"
            name="conteudo"
            rows={6}
            required
            value={formData.conteudo}
            onChange={handleChange}
            className="block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6 px-3"
          />
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            Publicar Contribuição
          </button>
        </div>
      </form>
    </div>
  );
}
