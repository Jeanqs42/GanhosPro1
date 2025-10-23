import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { RunRecord, AppSettings } from '../types';

export interface ExportOptions {
  separator?: string;
  locale?: string;
  currency?: string;
  filenamePrefix?: string;
}

function formatCurrency(value: number, locale = 'pt-BR', currency = 'BRL') {
  return value.toLocaleString(locale, { style: 'currency', currency });
}

export function exportCSV(records: RunRecord[], settings: AppSettings, opts: ExportOptions = {}) {
  const { separator = ',', locale = 'pt-BR', currency = 'BRL', filenamePrefix = 'historico_ganhospro' } = opts;
  if (!records || records.length === 0) {
    throw new Error('Sem registros para exportar.');
  }
  const headers = [
    'ID',
    'Data',
    `Ganhos Totais (${currency})`,
    'KM Rodados',
    'Horas Trabalhadas',
    `Custos Adicionais (${currency})`,
    `Lucro Líquido (${currency})`
  ];
  const rows = records.map(record => {
    const carCost = record.kmDriven * settings.costPerKm;
    const netProfit = record.totalEarnings - (record.additionalCosts || 0) - carCost;
    return [
      record.id,
      new Date(record.date).toLocaleDateString(locale, { timeZone: 'UTC' }),
      record.totalEarnings.toFixed(2),
      record.kmDriven.toFixed(2),
      record.hoursWorked?.toFixed(2) || '0.00',
      record.additionalCosts?.toFixed(2) || '0.00',
      netProfit.toFixed(2)
    ].join(separator);
  });
  const csvContent = [headers.join(separator), ...rows].join('\n');
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportPDF(records: RunRecord[], settings: AppSettings, opts: ExportOptions = {}) {
  const { locale = 'pt-BR', currency = 'BRL', filenamePrefix = 'relatorio_ganhospro' } = opts;
  if (!records || records.length === 0) {
    throw new Error('Sem registros para exportar.');
  }
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Relatório de Corridas - GanhosPro', 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);

  const totalEarnings = records.reduce((sum, r) => sum + r.totalEarnings, 0);
  const totalKm = records.reduce((sum, r) => sum + r.kmDriven, 0);
  const totalNetProfit = records.reduce((sum, r) => {
    const carCost = r.kmDriven * settings.costPerKm;
    const additionalCosts = r.additionalCosts || 0;
    const netProfit = r.totalEarnings - additionalCosts - carCost;
    return sum + netProfit;
  }, 0);

  const summaryY = 32;
  doc.text(`Lucro Líquido Total: ${formatCurrency(totalNetProfit, locale, currency)}`, 14, summaryY);
  doc.text(`Ganhos Totais: ${formatCurrency(totalEarnings, locale, currency)}`, 14, summaryY + 7);
  doc.text(`KM Rodados Totais: ${totalKm.toFixed(1)} km`, 14, summaryY + 14);

  const tableColumns = ['Data', `Ganhos (${currency})`, 'KM', `Custos (${currency})`, `Lucro Líquido (${currency})`];
  const tableRows = records.map(record => {
    const carCost = record.kmDriven * settings.costPerKm;
    const additionalCosts = record.additionalCosts || 0;
    const totalCosts = carCost + additionalCosts;
    const netProfit = record.totalEarnings - totalCosts;
    return [
      new Date(record.date).toLocaleDateString(locale, { timeZone: 'UTC' }),
      record.totalEarnings.toFixed(2),
      record.kmDriven.toFixed(1),
      totalCosts.toFixed(2),
      netProfit.toFixed(2)
    ];
  });

  (doc as any).autoTable({
    head: [tableColumns],
    body: tableRows,
    startY: 55,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: 255 },
    styles: { cellPadding: 2, fontSize: 10 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 14, right: 14 },
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150);
    const text = `Gerado em ${new Date().toLocaleDateString(locale)} | Página ${i} de ${pageCount}`;
    const textWidth = doc.getStringUnitWidth(text) * doc.getFontSize() / (doc as any).internal.scaleFactor;
    const textOffset = ((doc as any).internal.pageSize.width - textWidth) / 2;
    doc.text(text, textOffset, (doc as any).internal.pageSize.height - 10);
  }

  const filename = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}