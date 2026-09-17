import { useMemo, useState } from "react";
import { Download, FileText, Filter, ShieldCheck, Table } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";

const BRAND_BLUE = [31, 46, 110] as const;
const BRAND_ORANGE = [243, 106, 16] as const;
const TEXT_MUTED = [86, 97, 91] as const;

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

const formatDate = (value: string) => {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

export default function Relatorios() {
  const [filters, setFilters] = useState({ dataInicio: "", dataFim: "", municipio: "", tema: "" });
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
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
    } catch (err: any) {
      setError(err.message || "Erro ao gerar relatório.");
    } finally {
      setLoading(false);
    }
  };

  const activeColumns = selectedColumns.length
    ? selectedColumns
    : columns.filter((column) => column.key !== "descricao").map((column) => column.key);
  const columnLabel = (key: string) => columns.find((column) => column.key === key)?.label || key;

  const activeFilterSummary = useMemo(() => {
    const items = [
      filters.dataInicio ? `De ${formatDate(filters.dataInicio)}` : "",
      filters.dataFim ? `até ${formatDate(filters.dataFim)}` : "",
      filters.municipio ? `Município: ${filters.municipio}` : "",
      filters.tema ? `Categoria: ${filters.tema}` : "",
    ].filter(Boolean);
    return items.length ? items.join(" · ") : "Todos os registros autorizados para o recorte atual";
  }, [filters]);

  const exportPDF = () => {
    const generatedAt = new Date();
    const generatedAtLabel = generatedAt.toLocaleString("pt-BR");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setProperties({
      title: "FISCALIZE - Relatório privado de demandas",
      subject: "Relatório administrativo de demandas registradas no FISCALIZE",
      creator: "FISCALIZE",
    });

    doc.setFillColor(...BRAND_BLUE);
    doc.rect(0, 0, 297, 23, "F");
    doc.setFillColor(...BRAND_ORANGE);
    doc.rect(0, 23, 297, 1.8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("FISCALIZE", 8, 10);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text("Relatório privado de demandas · uso administrativo", 8, 16);
    doc.text(`${reportData.length} registro(s)`, 289, 10, { align: "right" });
    doc.text(`Gerado em ${generatedAtLabel}`, 289, 16, { align: "right" });

    doc.setTextColor(...TEXT_MUTED);
    doc.setFontSize(7.5);
    doc.text(`Recorte: ${activeFilterSummary}`, 8, 29, { maxWidth: 281 });

    const columnStyles = Object.fromEntries(
      activeColumns.map((key, index) => [index, { cellWidth: pdfColumnWidths[key] || 24 }]),
    );

    autoTable(doc, {
      head: [activeColumns.map(columnLabel)],
      body: reportData.map((row) => activeColumns.map((column) => String(row[column] ?? ""))),
      startY: 33,
      margin: { left: 8, right: 8, bottom: 14 },
      styles: {
        fontSize: 7,
        cellPadding: 1.6,
        overflow: "linebreak",
        valign: "top",
        textColor: [45, 54, 50],
        lineColor: [229, 233, 230],
        lineWidth: 0.1,
      },
      headStyles: {
        fontSize: 7.5,
        fontStyle: "bold",
        fillColor: [...BRAND_BLUE],
        textColor: [255, 255, 255],
        lineColor: [...BRAND_BLUE],
      },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles,
      rowPageBreak: "avoid",
      showHead: "everyPage",
    });

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(215, 224, 242);
      doc.line(8, 201, 289, 201);
      doc.setFontSize(6.7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_MUTED);
      doc.text("FISCALIZE · Documento privado. Compartilhe apenas quando houver finalidade administrativa legítima.", 8, 205);
      doc.text(`Página ${page} de ${pageCount}`, 289, 205, { align: "right" });
    }

    doc.save(`fiscalize_relatorio_demandas_${generatedAt.toISOString().slice(0, 10)}.pdf`);
  };

  const exportCSV = () => {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      activeColumns.map((column) => escape(columnLabel(column))).join(";"),
      ...reportData.map((row) => activeColumns.map((column) => escape(row[column])).join(";")),
    ];
    const csv = rows.join("\r\n");
    saveAs(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
      `fiscalize_relatorio_demandas_${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7 py-4 sm:space-y-8 sm:py-8" data-report-layout="responsive">
      <header className="overflow-hidden rounded-[28px] border border-[#d7e0f2] bg-white shadow-[0_18px_55px_rgba(31,46,110,0.08)]">
        <div className="h-1.5 bg-[#f36a10]" />
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="section-kicker"><FileText className="h-4 w-4" /> FISCALIZE · Relatórios</div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-[#1f2e6e] sm:text-4xl">Relatórios de demandas</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#69736d]">Monte recortes administrativos dos registros recebidos pelo canal público, revise a prévia e exporte apenas os campos necessários.</p>
          </div>
          <div className="rounded-2xl border border-[#d7e0f2] bg-[#eef2fb] px-4 py-3 text-sm text-[#1f2e6e]">
            <div className="flex items-center gap-2 font-extrabold"><ShieldCheck className="h-4 w-4" /> Área autenticada</div>
            <p className="mt-1 max-w-[260px] text-xs leading-5 text-[#56615b]">Os arquivos exportados podem conter dados internos. Use somente para finalidade administrativa legítima.</p>
          </div>
        </div>
      </header>

      <section className="surface-card overflow-hidden p-0">
        <div className="border-b border-[#d7e0f2] bg-[#eef2fb] px-5 py-4 sm:px-7">
          <div className="flex items-center gap-2 font-extrabold text-[#1f2e6e]"><Filter className="h-4 w-4 text-[#f36a10]" /> Defina o recorte</div>
          <p className="mt-1 text-xs text-[#69736d]">Filtros vazios mantêm o conjunto autorizado pelo serviço de relatórios.</p>
        </div>
        <div className="p-5 sm:p-7">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label><span className="text-sm font-bold text-[#1f2e6e]">Data inicial</span><input type="date" className="field" value={filters.dataInicio} onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })} /></label>
              <label><span className="text-sm font-bold text-[#1f2e6e]">Data final</span><input type="date" className="field" value={filters.dataFim} onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })} /></label>
            </div>
            <label><span className="text-sm font-bold text-[#1f2e6e]">Município</span><input className="field" value={filters.municipio} onChange={(e) => setFilters({ ...filters, municipio: e.target.value })} placeholder="Manaus" /></label>
            <label><span className="text-sm font-bold text-[#1f2e6e]">Categoria</span><input className="field" value={filters.tema} onChange={(e) => setFilters({ ...filters, tema: e.target.value })} placeholder="Saúde, mobilidade..." /></label>
          </div>

          <div className="mt-7">
            <div className="flex items-center gap-2 font-extrabold text-[#1f2e6e]"><Table className="h-4 w-4 text-[#f36a10]" /> Colunas do arquivo</div>
            <p className="mt-1 text-xs text-[#69736d]">Sem seleção manual, a descrição fica fora do relatório por padrão.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {columns.map((column) => (
                <label key={column.key} className="flex min-h-12 items-center gap-2 rounded-xl border border-[#d7e0f2] bg-white p-3 text-sm transition hover:bg-[#eef2fb]">
                  <input type="checkbox" checked={selectedColumns.includes(column.key)} onChange={(e) => setSelectedColumns(e.target.checked ? [...selectedColumns, column.key] : selectedColumns.filter((key) => key !== column.key))} />
                  {column.label}
                </label>
              ))}
            </div>
          </div>

          {error && <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <button onClick={handleGenerate} disabled={loading} className="primary-button mt-6 min-h-12 px-6">{loading ? "Gerando..." : "Gerar relatório"}<Filter className="h-4 w-4" /></button>
        </div>
      </section>

      {reportData.length > 0 && (
        <section className="surface-card overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-[#d7e0f2] bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <h2 className="text-lg font-extrabold text-[#1f2e6e]">Prévia · {reportData.length} registros</h2>
              <p className="mt-1 text-xs text-[#69736d]">{activeFilterSummary}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button onClick={exportPDF} className="secondary-button min-h-11 justify-center"><Download className="h-4 w-4" /> PDF</button>
              <button onClick={exportCSV} className="secondary-button min-h-11 justify-center"><Download className="h-4 w-4" /> CSV</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#1f2e6e] text-white"><tr>{activeColumns.map((column) => <th key={column} className="px-4 py-3 font-extrabold">{columnLabel(column)}</th>)}</tr></thead>
              <tbody>{reportData.slice(0, 100).map((row, index) => <tr key={index} className="border-b border-[#eef0ee] odd:bg-white even:bg-[#f8f9fc]">{activeColumns.map((column) => <td key={column} className="max-w-xs px-4 py-3 align-top text-[#56615b]">{String(row[column] ?? "")}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {reportData.length > 100 && <p className="border-t border-[#d7e0f2] px-5 py-3 text-xs text-[#69736d] sm:px-7">A prévia mostra os primeiros 100 registros. As exportações usam todo o conjunto retornado.</p>}
        </section>
      )}
    </div>
  );
}
