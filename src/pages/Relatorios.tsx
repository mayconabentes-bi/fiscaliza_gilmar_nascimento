import { useState } from "react";
import { Download, FileText, Filter, Table } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";

const columns = [
  { key: "protocolo", label: "Protocolo" },
  { key: "municipio", label: "Município" },
  { key: "bairro", label: "Bairro" },
  { key: "categoria", label: "Categoria" },
  { key: "descricao", label: "Descrição" },
  { key: "prioridade", label: "Prioridade" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Data" },
];

const pdfColumnWidths: Record<string, number> = {
  protocolo: 37,
  descricao: 74,
  municipio: 21,
  prioridade: 19,
  bairro: 27,
  categoria: 30,
  created_at: 30,
  status: 25,
};

export default function Relatorios() {
  const [filters, setFilters] = useState({ dataInicio: "", dataFim: "", municipio: "", tema: "" });
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/relatorios/gerar", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filtros: filters, colunas: selectedColumns.length ? selectedColumns : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar relatório.");
      setReportData(Array.isArray(data) ? data : []);
    } catch (err: any) { setError(err.message || "Erro ao gerar relatório."); }
    finally { setLoading(false); }
  };

  const activeColumns = selectedColumns.length ? selectedColumns : columns.filter((column) => column.key !== "descricao").map((column) => column.key);
  const columnLabel = (key: string) => columns.find((column) => column.key === key)?.label || key;

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text("Relatório privado de demandas", 8, 11);

    const columnStyles = Object.fromEntries(
      activeColumns.map((key, index) => [index, { cellWidth: pdfColumnWidths[key] || 24 }]),
    );

    autoTable(doc, {
      head: [activeColumns.map(columnLabel)],
      body: reportData.map((row) => activeColumns.map((column) => String(row[column] ?? ""))),
      startY: 16,
      margin: { left: 8, right: 8, bottom: 8 },
      styles: { fontSize: 7, cellPadding: 1.4, overflow: "linebreak", valign: "top" },
      headStyles: { fontSize: 7.5, fontStyle: "bold" },
      columnStyles,
      rowPageBreak: "avoid",
      showHead: "everyPage",
    });

    doc.save(`relatorio_demandas_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportCSV = () => {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      activeColumns.map((column) => escape(columnLabel(column))).join(";"),
      ...reportData.map((row) => activeColumns.map((column) => escape(row[column])).join(";")),
    ];
    const csv = rows.join("\r\n");
    saveAs(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), `relatorio_demandas_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-4 sm:py-8">
      <header><div className="section-kicker"><FileText className="h-4 w-4" /> Núcleo privado</div><h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">Relatórios de demandas</h1><p className="mt-2 text-sm text-[#69736d]">Gere recortes dos registros recebidos pelo canal público. Esta área é exclusiva do administrador.</p></header>

      <section className="surface-card p-5 sm:p-7">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-3"><label><span className="text-sm font-bold">Data inicial</span><input type="date" className="field" value={filters.dataInicio} onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })} /></label><label><span className="text-sm font-bold">Data final</span><input type="date" className="field" value={filters.dataFim} onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })} /></label></div>
          <label><span className="text-sm font-bold">Município</span><input className="field" value={filters.municipio} onChange={(e) => setFilters({ ...filters, municipio: e.target.value })} placeholder="Manaus" /></label>
          <label><span className="text-sm font-bold">Categoria</span><input className="field" value={filters.tema} onChange={(e) => setFilters({ ...filters, tema: e.target.value })} placeholder="Saúde, mobilidade..." /></label>
        </div>

        <div className="mt-7"><div className="flex items-center gap-2 font-extrabold"><Table className="h-4 w-4 text-[#157a55]" /> Colunas</div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{columns.map((column) => <label key={column.key} className="flex items-center gap-2 rounded-xl border border-[#e5e9e6] p-3 text-sm"><input type="checkbox" checked={selectedColumns.includes(column.key)} onChange={(e) => setSelectedColumns(e.target.checked ? [...selectedColumns, column.key] : selectedColumns.filter((key) => key !== column.key))} />{column.label}</label>)}</div></div>

        {error && <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <button onClick={handleGenerate} disabled={loading} className="primary-button mt-6 min-h-12 px-6">{loading ? "Gerando..." : "Gerar relatório"}<Filter className="h-4 w-4" /></button>
      </section>

      {reportData.length > 0 && <section className="surface-card p-5 sm:p-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-lg font-extrabold">Prévia · {reportData.length} registros</h2><div className="flex gap-2"><button onClick={exportPDF} className="secondary-button"><Download className="h-4 w-4" /> PDF</button><button onClick={exportCSV} className="secondary-button"><Download className="h-4 w-4" /> CSV</button></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-[#e5e9e6]">{activeColumns.map((column) => <th key={column} className="px-3 py-3 font-extrabold">{columnLabel(column)}</th>)}</tr></thead><tbody>{reportData.slice(0, 100).map((row, index) => <tr key={index} className="border-b border-[#eef0ee]">{activeColumns.map((column) => <td key={column} className="max-w-xs px-3 py-3 text-[#56615b]">{String(row[column] ?? "")}</td>)}</tr>)}</tbody></table></div></section>}
    </div>
  );
}
