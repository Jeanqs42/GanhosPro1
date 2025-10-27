import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Crown, Zap, BarChart2, Unlock, Loader2, MessageSquare, ArrowLeft, BrainCircuit, CalendarDays, Calculator, FileBarChart2, User, Bot } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area, ReferenceLine, LineChart, Line } from 'recharts';
import { RunRecord, AppSettings } from '../types';
import { analyzeRecords, getChatFollowUp, getIntelligentReportAnalysis } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface PremiumProps {
  records: RunRecord[];
  settings: AppSettings;
  isPremium: boolean;
  setIsPremium: (isPremium: boolean) => void;
}

type ActiveTool = 'menu' | 'insights' | 'reports' | 'periodic';
type PeriodType = 'weekly' | 'monthly' | 'annual';

// Helper to get the start of the week (Sunday) for a given date
const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0 for Sunday, 1 for Monday, etc.
  const diff = d.getUTCDate() - day;
  d.setUTCDate(diff);
  return d;
};

// Helper to get a consistent week key (e.g., 'WYYYY-MM-DD' for Sunday)
const getWeekKey = (date: Date): string => {
  const startOfWeek = getStartOfWeek(date);
  return `W${startOfWeek.toISOString().slice(0, 10)}`;
};

const Premium: React.FC<PremiumProps> = ({ records, settings, isPremium, setIsPremium }) => {
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState<ActiveTool>('menu');

  const [analysis, setAnalysis] = useState<string>(localStorage.getItem('ganhospro_analysis') || '');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; parts: { text: string }[] }[]>(() => {
    try {
      const raw = localStorage.getItem('ganhospro_chat_history');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [isInsightsLoading, setIsInsightsLoading] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isReportLoading, setIsReportLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportInsight, setReportInsight] = useState<string>('');
  const [reportTotals, setReportTotals] = useState<{total: number, average: number, days: number} | null>(null);
  const [reportConfig, setReportConfig] = useState<{
    startDate: string;
    endDate: string;
    metric: string;
  }>({
    startDate: records.length > 0 ? [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0].date : new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    metric: 'netProfit'
  });
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);

  const metricsInfo: { [key: string]: { label: string; unit: string } } = {
    netProfit: { label: 'Lucro Líquido', unit: 'R$' },
    profitPerKm: { label: 'Lucro por KM', unit: 'R$/KM' },
    grossEarnings: { label: 'Ganhos Brutos', unit: 'R$' },
    grossEarningsPerKm: { label: 'R$/KM Bruto', unit: 'R$/KM' },
    totalCosts: { label: 'Custos Totais', unit: 'R$' },
    carCostOnly: { label: 'Custo do Carro', unit: 'R$' },
    additionalCostsOnly: { label: 'Custos Adicionais', unit: 'R$' },
    kmDriven: { label: 'KM Rodados', unit: 'KM' },
    hoursWorked: { label: 'Horas Trabalhadas', unit: 'h' },
  };

  useEffect(() => {
    if(activeTool === 'insights') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isChatLoading, activeTool]);

  useEffect(() => {
    localStorage.setItem('ganhospro_analysis', analysis || '');
    localStorage.setItem('ganhospro_chat_history', JSON.stringify(chatHistory));
  }, [analysis, chatHistory]);

  const handleUpgrade = () => {
    setIsPremium(true);
    toast.success('Parabéns! Você agora é um usuário Premium.');
  };

  const getPeriodKey = (dateStr: string, period: PeriodType): string => {
    const date = new Date(dateStr);
    date.setUTCHours(12);
    if (period === 'weekly') {
      const firstDay = getStartOfWeek(date);
      return `W${firstDay.toISOString().slice(0, 10)}`;
    }
    if (period === 'monthly') {
      return date.toISOString().slice(0, 7);
    }
    return date.getUTCFullYear().toString();
  };

  const formatPeriodLabel = (key: string, period: PeriodType): string => {
    if (period === 'weekly') {
      const date = new Date(key.substring(1));
      // Garante que a formatação use UTC para evitar problemas de fuso horário
      return `Semana ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })}`;
    } else if (period === 'monthly') {
      const [year, month] = key.split('-');
      return `${month}/${year.slice(2)}`;
    } else {
      return key;
    }
  };

  // Função para gerar a lista de períodos disponíveis (semanas, meses, anos)
  const availablePeriods = useMemo(() => {
    const periodsMap = new Map<string, string>(); // key -> label
    const sortedRecords = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedRecords.forEach(record => {
      if (periodType === 'weekly') {
        const key = getPeriodKey(record.date, 'weekly');
        periodsMap.set(key, formatPeriodLabel(key, 'weekly'));
      } else if (periodType === 'monthly') {
        const key = getPeriodKey(record.date, 'monthly');
        periodsMap.set(key, formatPeriodLabel(key, 'monthly'));
      } else { // annual
        const key = getPeriodKey(record.date, 'annual');
        periodsMap.set(key, formatPeriodLabel(key, 'annual'));
      }
    });

    return Array.from(periodsMap.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => new Date(a.key.replace('W', '')).getTime() - new Date(b.key.replace('W', '')).getTime());
  }, [records, periodType, formatPeriodLabel, getPeriodKey]);

  // Efeito para definir o selectedPeriodKey padrão (o mais recente) ou manter a seleção
  useEffect(() => {
    if (availablePeriods.length > 0) {
      const latestPeriodKey = availablePeriods[availablePeriods.length - 1].key;
      // Só define o padrão se não houver nada selecionado ou se a seleção atual não estiver nos períodos disponíveis
      if (!selectedPeriodKey || !availablePeriods.some(p => p.key === selectedPeriodKey)) {
        setSelectedPeriodKey(latestPeriodKey);
      }
    } else if (selectedPeriodKey !== null) { // Se não há períodos disponíveis, limpa a seleção
      setSelectedPeriodKey(null);
    }
  }, [periodType, availablePeriods, selectedPeriodKey]); // selectedPeriodKey como dependência para reagir a mudanças manuais

  // Função genérica para obter dados detalhados por dia ou mês dentro de um período selecionado
  const getDetailedPeriodData = useCallback((
    records: RunRecord[],
    settings: AppSettings,
    periodType: PeriodType,
    selectedPeriodKey: string | null,
    metricType: 'cumulative' | 'average' | 'sum', // 'sum' para somar valores por sub-período
    metricKey: 'netProfit' | 'kmDriven' | 'hoursWorked' | 'profitPerKm' | 'ganhosPorHora' | 'lucroLiquidoPorHora' | 'ganhosPorKmBruto' | 'margemLucro' | 'totalEarnings' | 'totalCosts'
  ) => {
    if (!selectedPeriodKey || selectedPeriodKey.trim() === '') {
      return [];
    }

    const filteredRecords = records.filter((r: RunRecord) => getPeriodKey(r.date, periodType) === selectedPeriodKey)
                                   .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const aggregatedData = new Map<string, { sum: number; count: number; }>();

    let aggregationUnit: 'day' | 'week' | 'month';
    let subPeriodStartDate: Date;
    let subPeriodEndDate: Date;

    // Determine aggregation unit and date range for initialization
    if (periodType === 'weekly') {
      aggregationUnit = 'day';
      const dateStringForStartDate = selectedPeriodKey.substring(1);
      subPeriodStartDate = new Date(dateStringForStartDate);
      if (isNaN(subPeriodStartDate.getTime())) {
        return [];
      }
      subPeriodEndDate = new Date(subPeriodStartDate);
      subPeriodEndDate.setDate(subPeriodStartDate.getDate() + 6);
      if (isNaN(subPeriodEndDate.getTime())) {
        return [];
      }
    } else if (periodType === 'monthly') {
      aggregationUnit = 'week';
      const [yearStr, monthStr] = selectedPeriodKey.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      if (isNaN(year) || isNaN(month)) {
        return [];
      }
      subPeriodStartDate = new Date(year, month - 1, 1); // First day of the month
      subPeriodEndDate = new Date(year, month, 0); // Last day of the month
      if (isNaN(subPeriodStartDate.getTime()) || isNaN(subPeriodEndDate.getTime())) {
        return [];
      }
    } else { // annual
      aggregationUnit = 'month';
      const year = Number(selectedPeriodKey);
      if (isNaN(year)) {
        return [];
      }
      subPeriodStartDate = new Date(year, 0, 1); // First day of the year
      subPeriodEndDate = new Date(year, 11, 31); // Last day of the year
      if (isNaN(subPeriodStartDate.getTime()) || isNaN(subPeriodEndDate.getTime())) {
        return [];
      }
    }

    // Initialize map with all sub-periods
    if (aggregationUnit === 'day') {
      for (let d = new Date(subPeriodStartDate); d <= subPeriodEndDate; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        aggregatedData.set(dateKey, { sum: 0, count: 0 });
      }
    } else if (aggregationUnit === 'week') {
      let currentWeekStart = getStartOfWeek(subPeriodStartDate);
      while (currentWeekStart.getTime() <= subPeriodEndDate.getTime()) {
        const weekKey = getWeekKey(currentWeekStart);
        aggregatedData.set(weekKey, { sum: 0, count: 0 });
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      }
    } else { // aggregationUnit === 'month'
      for (let m = new Date(subPeriodStartDate.getFullYear(), 0); m.getFullYear() === subPeriodStartDate.getFullYear(); m.setMonth(m.getMonth() + 1)) {
        const monthKey = m.toISOString().slice(0, 7);
        aggregatedData.set(monthKey, { sum: 0, count: 0 });
      }
    }

    filteredRecords.forEach(record => {
      const carCost = record.kmDriven * settings.costPerKm;
      const additionalCosts = record.additionalCosts || 0;
      const totalCosts = carCost + additionalCosts;
      const netProfit = record.totalEarnings - totalCosts;

      let key: string;
      const recordDate = new Date(record.date);
      if (aggregationUnit === 'day') {
        key = recordDate.toISOString().split('T')[0];
      } else if (aggregationUnit === 'week') {
        key = getWeekKey(recordDate);
      } else { // aggregationUnit === 'month'
        key = recordDate.toISOString().slice(0, 7);
      }

      let valueToAdd = 0;
      let shouldCount = false;

      switch (metricKey) {
        case 'netProfit': valueToAdd = netProfit; shouldCount = true; break;
        case 'kmDriven': valueToAdd = record.kmDriven; shouldCount = true; break;
        case 'hoursWorked': valueToAdd = record.hoursWorked || 0; shouldCount = true; break;
        case 'profitPerKm': valueToAdd = record.kmDriven > 0 ? netProfit / record.kmDriven : 0; shouldCount = record.kmDriven > 0; break;
        case 'ganhosPorHora': valueToAdd = (record.hoursWorked || 0) > 0 ? record.totalEarnings / (record.hoursWorked || 0) : 0; shouldCount = (record.hoursWorked || 0) > 0; break;
        case 'lucroLiquidoPorHora': valueToAdd = (record.hoursWorked || 0) > 0 ? netProfit / (record.hoursWorked || 0) : 0; shouldCount = (record.hoursWorked || 0) > 0; break;
        case 'ganhosPorKmBruto': valueToAdd = record.kmDriven > 0 ? record.totalEarnings / record.kmDriven : 0; shouldCount = record.kmDriven > 0; break;
        case 'margemLucro': valueToAdd = record.totalEarnings > 0 ? (netProfit / record.totalEarnings) * 100 : 0; shouldCount = record.totalEarnings > 0; break;
        case 'totalEarnings': valueToAdd = record.totalEarnings; shouldCount = true; break;
        case 'totalCosts': valueToAdd = totalCosts; shouldCount = true; break;
      }

      const entry = aggregatedData.get(key);
      if (entry) {
        entry.sum += valueToAdd;
        if (shouldCount) entry.count++;
      } else {
        aggregatedData.set(key, { sum: valueToAdd, count: shouldCount ? 1 : 0 });
      }
    });

    const sortedKeys = Array.from(aggregatedData.keys()).sort((a, b) => new Date(a.replace('W', '')).getTime() - new Date(b.replace('W', '')).getTime());

    let cumulativeTracker = 0;
    const finalData = sortedKeys.map(key => {
      const item = aggregatedData.get(key)!;
      let displayValue: number;

      if (metricType === 'cumulative') {
        cumulativeTracker += item.sum;
        displayValue = cumulativeTracker;
      } else if (metricType === 'average') {
        displayValue = item.count > 0 ? item.sum / item.count : 0;
      } else { // metricType === 'sum'
        displayValue = item.sum;
      }

      let nameLabel: string;
      if (aggregationUnit === 'day') {
        nameLabel = new Date(key).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      } else if (aggregationUnit === 'week') {
        nameLabel = formatPeriodLabel(key, 'weekly');
      } else { // aggregationUnit === 'month'
        nameLabel = formatPeriodLabel(key, 'monthly');
      }
      return {
        name: nameLabel,
        value: parseFloat(displayValue.toFixed(2)),
      };
    });
    return finalData;
  }, [records, settings, periodType, getPeriodKey, formatPeriodLabel]);

  const periodicData = useMemo(() => {
    const sortedRecords = [...records].sort((a: RunRecord, b: RunRecord) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const aggregated = sortedRecords.reduce((acc: any, record: RunRecord) => {
      const key = getPeriodKey(record.date, periodType);
      if (!acc[key]) {
        acc[key] = { key, totalEarnings: 0, totalCosts: 0, kmDriven: 0, daysCount: 0, totalHoursWorked: 0 };
      }
      const carCost = record.kmDriven * settings.costPerKm;
      acc[key].totalEarnings += record.totalEarnings;
      acc[key].totalCosts += carCost + (record.additionalCosts || 0);
      acc[key].kmDriven += record.kmDriven;
      acc[key].daysCount += 1;
      acc[key].totalHoursWorked += record.hoursWorked || 0;
      return acc;
    }, {} as any);

    const result = Object.values(aggregated).map((item: any) => {
      const netProfit = item.totalEarnings - item.totalCosts;
      const ganhosPorHora = item.totalHoursWorked > 0 ? parseFloat((item.totalEarnings / item.totalHoursWorked).toFixed(2)) : 0;
      const lucroLiquidoPorHora = item.totalHoursWorked > 0 ? parseFloat((netProfit / item.totalHoursWorked).toFixed(2)) : 0;

      return {
        name: formatPeriodLabel(item.key, periodType),
        key: item.key,
        ganhos: parseFloat(item.totalEarnings.toFixed(2)),
        custos: parseFloat(item.totalCosts.toFixed(2)),
        lucroLiquido: parseFloat(netProfit.toFixed(2)),
        lucroPorKm: item.kmDriven > 0 ? parseFloat((netProfit / item.kmDriven).toFixed(2)) : 0,
        kmRodados: parseFloat(item.kmDriven.toFixed(2)),
        ganhosPorKmBruto: item.kmDriven > 0 ? parseFloat((item.totalEarnings / item.kmDriven).toFixed(2)) : 0,
        margemLucro: item.totalEarnings > 0 ? parseFloat(((netProfit / item.totalEarnings) * 100).toFixed(2)) : 0,
        totalHoursWorked: parseFloat(item.totalHoursWorked.toFixed(1)),
        ganhosPorHora,
        lucroLiquidoPorHora,
      }
    });
    
    result.sort((a: any, b: any) => a.key.localeCompare(b.key));

    return result;
  }, [records, settings, periodType, formatPeriodLabel, getPeriodKey]);

  // Dados para Evolução do Lucro Líquido (AreaChart - cumulativo)
  const detailedLucroLiquidoData = useMemo(() => {
    return getDetailedPeriodData(records, settings, periodType, selectedPeriodKey, 'cumulative', 'netProfit');
  }, [records, settings, periodType, selectedPeriodKey, getDetailedPeriodData]);

  // Dados para KM Rodados (AreaChart - cumulativo)
  const cumulativeKmData = useMemo(() => {
    return getDetailedPeriodData(records, settings, periodType, selectedPeriodKey, 'cumulative', 'kmDriven');
  }, [records, settings, periodType, selectedPeriodKey, getDetailedPeriodData]);

  // Dados para Total de Horas Trabalhadas (AreaChart - cumulativo)
  const cumulativeHoursData = useMemo(() => {
    return getDetailedPeriodData(records, settings, periodType, selectedPeriodKey, 'cumulative', 'hoursWorked');
  }, [records, settings, periodType, selectedPeriodKey, getDetailedPeriodData]);

  // NOVO: Dados para Ganhos Brutos vs. Custos Totais (BarChart - total do período selecionado)
  const currentPeriodGanhosCustosData = useMemo(() => {
    if (!selectedPeriodKey) return [];
    const item = periodicData.find(p => p.key === selectedPeriodKey);
    if (!item) return [];
    return [{
      name: item.name, // Rótulo do período selecionado (ex: "Semana 01/07", "07/24", "2024")
      ganhos: item.ganhos,
      custos: item.custos,
    }];
  }, [periodicData, selectedPeriodKey]);

  // Dados para Desempenho de Lucro por KM (LineChart - média por sub-período)
  const detailedLucroPorKmData = useMemo(() => {
    return getDetailedPeriodData(records, settings, periodType, selectedPeriodKey, 'average', 'profitPerKm');
  }, [records, settings, periodType, selectedPeriodKey, getDetailedPeriodData]);

  // Dados para Ganhos por Hora (LineChart - média por sub-período)
  const detailedGanhosPorHoraData = useMemo(() => {
    return getDetailedPeriodData(records, settings, periodType, selectedPeriodKey, 'average', 'ganhosPorHora');
  }, [records, settings, periodType, selectedPeriodKey, getDetailedPeriodData]);

  // Dados para Lucro Líquido por Hora (LineChart - média por sub-período)
  const detailedLucroLiquidoPorHoraData = useMemo(() => {
    return getDetailedPeriodData(records, settings, periodType, selectedPeriodKey, 'average', 'lucroLiquidoPorHora');
  }, [records, settings, periodType, selectedPeriodKey, getDetailedPeriodData]);

  // Dados para R$/KM Bruto (LineChart - média por sub-período)
  const detailedGanhosPorKmBrutoData = useMemo(() => {
    return getDetailedPeriodData(records, settings, periodType, selectedPeriodKey, 'average', 'ganhosPorKmBruto');
  }, [records, settings, periodType, selectedPeriodKey, getDetailedPeriodData]);

  // Dados para Margem de Lucro (%) (LineChart - média por sub-período)
  const detailedMargemLucroData = useMemo(() => {
    return getDetailedPeriodData(records, settings, periodType, selectedPeriodKey, 'average', 'margemLucro');
  }, [records, settings, periodType, selectedPeriodKey, getDetailedPeriodData]);


  const handleAnalyze = async () => {
    if (records.length < 3) {
      toast.error('Você precisa de pelo menos 3 registros para uma análise significativa.');
      return;
    }
    setIsInsightsLoading(true);
    setAnalysis('');
    setChatHistory([]);
    try {
      const result = await analyzeRecords(records, settings);
      setAnalysis(result);
    } catch (error) {
      console.error('Error analyzing records:', error);
      toast.error('Ocorreu um erro ao analisar seus dados. Tente novamente.');
    } finally {
      setIsInsightsLoading(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    const question = chatInput;
    const newUserMessage = { role: 'user' as const, parts: [{ text: question }] };
    
    const newHistory = [...chatHistory, newUserMessage];
    setChatHistory(newHistory);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await getChatFollowUp(records, settings, newHistory);
      setChatHistory(prev => [...prev, { role: 'model' as const, parts: [{ text: response }] }]);
    } catch (error: any) {
      console.error('Chat error:', error);
      toast.error(`Erro: ${error.message || 'Ocorreu um erro desconhecido.'}`);
      setChatHistory(prev => prev.slice(0, -1));
    } finally {
      setIsChatLoading(false);
    }
  };

  const validateReportConfig = (): string | null => {
    if (!reportConfig.startDate || !reportConfig.endDate) return 'Selecione um período de datas.';
    const start = new Date(reportConfig.startDate);
    const end = new Date(reportConfig.endDate);
    if (start > end) return 'Data inicial não pode ser maior que a final.';
    if (!Object.keys(metricsInfo).includes(reportConfig.metric)) return 'Métrica inválida.';
    return null;
  };

  const handleGenerateReport = async () => {
    const errorMsg = validateReportConfig();
    if (errorMsg) { toast.error(errorMsg); return; }
    setIsReportLoading(true);
    setReportData([]);
    setReportInsight('');
    setReportTotals(null);

    const start = new Date(reportConfig.startDate);
    const end = new Date(reportConfig.endDate);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);

    const filteredRecords = records.filter((r: RunRecord) => {
      const recordDate = new Date(r.date);
      recordDate.setUTCHours(0, 0, 0, 0);
      return recordDate >= start && recordDate <= end;
    }).sort((a: RunRecord, b: RunRecord) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (filteredRecords.length === 0) {
      toast.error('Nenhum registro encontrado para o período selecionado.');
      setIsReportLoading(false);
      return;
    }

    const data = filteredRecords.map((r: RunRecord) => {
      const carCost = r.kmDriven * settings.costPerKm;
      const additionalCosts = r.additionalCosts || 0;
      const totalCosts = carCost + additionalCosts;
      const netProfit = r.totalEarnings - totalCosts;
      let value;
      switch (reportConfig.metric) {
        case 'profitPerKm': value = r.kmDriven > 0 ? netProfit / r.kmDriven : 0; break;
        case 'grossEarnings': value = r.totalEarnings; break;
        case 'grossEarningsPerKm': value = r.kmDriven > 0 ? r.totalEarnings / r.kmDriven : 0; break;
        case 'totalCosts': value = totalCosts; break;
        case 'carCostOnly': value = carCost; break;
        case 'additionalCostsOnly': value = additionalCosts; break;
        case 'kmDriven': value = r.kmDriven; break;
        case 'hoursWorked': value = r.hoursWorked || 0; break;
        default: value = netProfit;
      }
      return {
        date: new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
        value: parseFloat(value.toFixed(2)),
      };
    });

    setReportData(data);

    const total = data.reduce((sum: number, item: { value: number }) => sum + item.value, 0);
    const average = data.length > 0 ? total / data.length : 0;
    const days = data.length;

    setReportTotals({ total: parseFloat(total.toFixed(2)), average: parseFloat(average.toFixed(2)), days });

    try {
      const reportForAI = data.map((d: { date: string; value: number }) => ({ ...d, metric: reportConfig.metric, unit: metricsInfo[reportConfig.metric].unit }));
      const insight = await getIntelligentReportAnalysis(reportForAI, metricsInfo[reportConfig.metric].label);
      setReportInsight(insight);
    } catch(e) {
      toast.error('Não foi possível gerar o insight da IA.');
    } finally {
      setIsReportLoading(false);
    }
  };

  const LoadingButton: React.FC<{ loading: boolean; onClick: () => void; label: string; icon?: React.ReactNode; ariaLabel?: string }>= ({ loading, onClick, label, icon, ariaLabel }) => (
    <button
      onClick={onClick}
      disabled={loading}
      aria-label={ariaLabel || label}
      className={`flex items-center gap-2 ${loading ? 'bg-gray-600' : 'bg-brand-secondary hover:bg-emerald-700'} text-white font-semibold py-2 px-4 rounded-lg transition-colors`}
    >
      {loading ? <Loader2 className="animate-spin" size={18} /> : icon}
      <span>{label}</span>
    </button>
  );

  const renderHeader = (title: string, icon?: React.ReactNode) => (
    <div className="flex items-center mb-4">
      {activeTool !== 'menu' && (
        <button onClick={() => setActiveTool('menu')} className="p-2 rounded-full hover:bg-gray-700 mr-2" aria-label="Voltar ao menu Premium">
          <ArrowLeft size={20} />
        </button>
      )}
      <h1 className={`text-2xl font-bold text-center flex-grow flex items-center justify-center ${activeTool === 'menu' ? 'text-yellow-400' : 'text-brand-primary'}`}>
        {icon && <span className="mr-2">{icon}</span>}
        {title}
      </h1>
      {activeTool !== 'menu' && <div className="w-8"></div>}
    </div>
  );

  const renderMenu = () => (
    <>
      {renderHeader('GanhosPro Premium', <Crown/>)}
      <p className="text-center text-gray-300 mb-8">
        Escolha uma ferramenta abaixo para turbinar sua análise.
      </p>
      <div className="space-y-4">
        <button type="button" onClick={() => setActiveTool('insights')} aria-label="Abrir Insights com IA" className="w-full text-left bg-gray-800 p-6 rounded-lg shadow-lg hover:bg-gray-700/50 cursor-pointer transition-colors border border-transparent hover:border-brand-primary">
          <div className="flex items-center mb-2">
            <BrainCircuit size={24} className="text-brand-accent mr-3" />
            <h2 className="text-xl font-semibold">Insights com IA</h2>
          </div>
          <p className="text-gray-400 text-sm">Receba uma análise completa sobre sua performance geral e converse com a IA para tirar dúvidas.</p>
        </button>
        <button type="button" onClick={() => setActiveTool('reports')} aria-label="Abrir Relatórios Inteligentes" className="w-full text-left bg-gray-800 p-6 rounded-lg shadow-lg hover:bg-gray-700/50 cursor-pointer transition-colors border border-transparent hover:border-brand-primary">
          <div className="flex items-center mb-2">
            <FileBarChart2 size={24} className="text-brand-accent mr-3" />
            <h2 className="text-xl font-semibold">Relatórios Inteligentes</h2>
          </div>
          <p className="text-gray-400 text-sm">Crie relatórios personalizados com filtros, visualize em gráficos e receba um feedback rápido da IA.</p>
        </button>
        <button type="button" onClick={() => setActiveTool('periodic')} aria-label="Abrir Análise Periódica" className="w-full text-left bg-gray-800 p-6 rounded-lg shadow-lg hover:bg-gray-700/50 cursor-pointer transition-colors border border-transparent hover:border-brand-primary">
          <div className="flex items-center mb-2">
            <CalendarDays size={24} className="text-brand-accent mr-3" />
            <h2 className="text-xl font-semibold">Análise Periódica</h2>
          </div>
          <p className="text-gray-400 text-sm">Compare seus ganhos, custos e lucros em gráficos semanais, mensais ou anuais.</p>
        </button>
        <button type="button" onClick={() => navigate('/app/settings')} aria-label="Ir para Ajustes" className="w-full text-left bg-gray-800 p-6 rounded-lg shadow-lg hover:bg-gray-700/50 cursor-pointer transition-colors border border-transparent hover:border-brand-primary">
          <div className="flex items-center mb-2">
            <Calculator size={24} className="text-brand-accent mr-3" />
            <h2 className="text-xl font-semibold">Custo por KM Preciso</h2>
          </div>
          <p className="text-gray-400 text-sm">Acesse os Ajustes para usar a calculadora unificada e descobrir seu custo real por KM.</p>
        </button>
      </div>
    </>
  );

  const renderInsightsTool = () => (
    <div className="animate-fade-in-up">
      {renderHeader('Insights com IA', <BrainCircuit/>)}
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
        <LoadingButton
          loading={isInsightsLoading}
          onClick={handleAnalyze}
          label={isInsightsLoading ? 'Analisando...' : 'Analisar meus ganhos'}
          icon={<Zap size={20} className="mr-2"/>}
          ariaLabel="Analisar meus ganhos"
        />
        {analysis && (
          <div className="mt-6 bg-gray-900/50 p-4 rounded-lg">
            <h3 className="font-bold text-lg mb-2 text-brand-primary">Resultado da Análise:</h3>
            <div className="text-gray-300 text-sm leading-relaxed markdown-content">
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-brand-primary mt-4 mb-2" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-xl font-bold text-yellow-400 mt-3 mb-1" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-brand-light mt-2 mb-1" {...props} />,
                  p: ({node, ...props}) => <p className="mb-2" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc list-inside ml-4 mb-2 space-y-1" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal list-inside ml-4 mb-2 space-y-1" {...props} />,
                  li: ({node, ...props}) => <li className="text-gray-300" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
                  em: ({node, ...props}) => <em className="italic text-gray-400" {...props} />,
                  hr: ({node, ...props}) => <hr className="border-gray-600 my-4" {...props} />,
                }}
              >
                {analysis}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
      {analysis && (
        <div className="mt-6 bg-gray-800 p-4 rounded-lg shadow-xl">
          <h3 className="text-lg font-semibold mb-3 text-center text-yellow-400">Converse sobre a Análise</h3>
          <div className="h-64 overflow-y-auto bg-gray-900/50 rounded-lg p-3 space-y-4 mb-3" aria-live="polite" role="log">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex items-end gap-2 animate-fade-in-up ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-brand-secondary' : 'bg-gray-600'}`}>
                  {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm ${msg.role === 'user' ? 'bg-brand-primary text-white' : 'bg-gray-700 text-gray-200'}`}>
                  {msg.parts[0].text}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex items-end gap-2 animate-fade-in-up">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-600">
                  <Bot size={18} />
                </div>
                <div className="bg-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm">
                    <Loader2 className="animate-spin w-4 h-4"/>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleChatSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChatInput(e.target.value)}
              placeholder="Pergunte algo sobre o relatório..."
              className="flex-grow bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
              disabled={isChatLoading}
              aria-label="Campo de entrada para chat com a IA"
            />
            <button type="submit" className="bg-brand-secondary hover:bg-emerald-700 text-white p-2.5 rounded-lg disabled:opacity-50" aria-label="Enviar pergunta" disabled={isChatLoading || !chatInput.trim()}>
              <MessageSquare size={20} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
  
  const renderReportsTool = () => (
     <div className="animate-fade-in-up">
        {renderHeader('Relatórios Inteligentes', <FileBarChart2/>)}
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-300 mb-1">Início</label>
                    <input type="date" id="startDate" value={reportConfig.startDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReportConfig(p => ({...p, startDate: e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-brand-primary focus:outline-none" aria-label="Data de início do relatório"/>
                </div>
                <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-300 mb-1">Fim</label>
                    <input type="date" id="endDate" value={reportConfig.endDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReportConfig(p => ({...p, endDate: e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-brand-primary focus:outline-none" aria-label="Data de fim do relatório"/>
                </div>
            </div>
            <div>
                 <label htmlFor="metric" className="block text-sm font-medium text-gray-300 mb-1">Métrica</label>
                 <select id="metric" value={reportConfig.metric} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setReportConfig(p => ({...p, metric: e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-brand-primary focus:outline-none" aria-label="Métrica do relatório">
                    <option value="netProfit">Lucro Líquido</option>
                    <option value="profitPerKm">Lucro por KM</option>
                    <option value="grossEarnings">Ganhos Brutos</option>
                    <option value="grossEarningsPerKm">R$/KM Bruto</option>
                    <option value="totalCosts">Custos Totais</option>
                    <option value="carCostOnly">Custo do Carro</option>
                    <option value="additionalCostsOnly">Custos Adicionais</option>
                    <option value="kmDriven">KM Rodados</option>
                    <option value="hoursWorked">Horas Trabalhadas</option>
                 </select>
            </div>
            <LoadingButton
                loading={isReportLoading}
                onClick={handleGenerateReport}
                label={isReportLoading ? 'Gerando...' : 'Gerar Relatório'}
                icon={<BarChart2 size={20} className="mr-2"/>}
                ariaLabel="Gerar Relatório"
            />
        </div>

        {isReportLoading && <div className="text-center mt-6"><Loader2 className="animate-spin mx-auto w-8 h-8 text-brand-primary" /></div>}
        
        {reportData.length > 0 && !isReportLoading && (
            <div className="mt-6 bg-gray-800 p-4 rounded-lg shadow-xl animate-fade-in-up">
                <h3 className="font-bold text-lg mb-4 text-brand-primary text-center">Resultado do Relatório</h3>
                <div className="w-full h-64">
                    <ResponsiveContainer>
                        <BarChart data={reportData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                            <XAxis dataKey="date" stroke="#a0aec0" fontSize={12} />
                            <YAxis 
                                stroke="#a0aec0" 
                                fontSize={12} 
                                tickFormatter={(value: number) => {
                                    const unit = metricsInfo[reportConfig.metric].unit;
                                    if (unit === 'KM') return `${value} KM`;
                                    if (unit === 'h') return `${value} h`;
                                    return `R$${value}`;
                                }} 
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4a5568', color: '#f9fafb' }}
                                labelStyle={{ color: '#10b981' }}
                                formatter={(value: number) => {
                                    const unit = metricsInfo[reportConfig.metric].unit;
                                    if (unit === 'KM') return `${Number(value).toFixed(1)} KM`;
                                    if (unit === 'h') return `${Number(value).toFixed(1)} h`;
                                    return `${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`;
                                }}
                             />
                            <Bar dataKey="value" fill="#10b981" activeBar={false} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                
                {/* Seção de Totais */}
                {reportTotals && (
                    <div className="mt-4 bg-gradient-to-r from-brand-primary/20 to-brand-secondary/20 p-4 rounded-lg border border-brand-primary/30">
                        <h4 className="font-semibold text-brand-primary mb-3 text-center">📊 Resumo da Consulta</h4>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="bg-gray-800/50 p-3 rounded-lg">
                                <p className="text-xs text-gray-400 mb-1">Total</p>
                                <p className="font-bold text-white">
                                    {metricsInfo[reportConfig.metric].unit === 'KM' 
                                        ? `${reportTotals.total.toFixed(1)} KM`
                                        : metricsInfo[reportConfig.metric].unit === 'h'
                                            ? `${reportTotals.total.toFixed(1)} h`
                                            : reportTotals.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                    }
                                </p>
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded-lg">
                                <p className="text-xs text-gray-400 mb-1">Média Diária</p>
                                <p className="font-bold text-white">
                                    {metricsInfo[reportConfig.metric].unit === 'KM' 
                                        ? `${reportTotals.average.toFixed(1)} KM`
                                        : metricsInfo[reportConfig.metric].unit === 'h'
                                            ? `${reportTotals.average.toFixed(1)} h`
                                            : reportTotals.average.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                    }
                                </p>
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded-lg">
                                <p className="text-xs text-gray-400 mb-1">Período</p>
                                <p className="font-bold text-white">{reportTotals.days} dias</p>
                            </div>
                        </div>
                        <div className="mt-3 text-center">
                            <p className="text-xs text-gray-400">
                                {metricsInfo[reportConfig.metric].label} • {new Date(reportConfig.startDate).toLocaleDateString('pt-BR')} até {new Date(reportConfig.endDate).toLocaleDateString('pt-BR')}
                            </p>
                        </div>
                    </div>
                )}
                
                {reportInsight && (
                    <div className="mt-4 bg-gray-900/50 p-3 rounded-lg">
                         <p className="text-sm text-gray-300 text-center">{reportInsight}</p>
                    </div>
                )}
            </div>
        )}
     </div>
  );

  const renderPeriodicTool = () => {
    const totals = periodicData.find(p => p.key === selectedPeriodKey) || { ganhos: 0, custos: 0, lucroLiquido: 0, kmRodados: 0, totalHoursWorked: 0, ganhosPorHora: 0, lucroLiquidoPorHora: 0 };

    const tooltipContentStyle = { backgroundColor: '#1f2937', border: '1px solid #4a5568', color: '#f9fafb' };
    const tooltipLabelStyle = { color: '#10b981' };

    return (
        <div className="animate-fade-in-up">
            {renderHeader('Análise Periódica', <CalendarDays/>)}
            <div className="bg-gray-800 p-4 rounded-lg shadow-xl mb-4">
                <div className="flex justify-center bg-gray-700/50 rounded-lg p-1 mb-4">
                    {(['Semanal', 'Mensal', 'Anual'] as const).map(p => {
                        const periodMap: Record<'Semanal' | 'Mensal' | 'Anual', PeriodType> = { Semanal: 'weekly', Mensal: 'monthly', Anual: 'annual' };
                        const value = periodMap[p];
                        return (
                             <button key={p} onClick={() => setPeriodType(value)} aria-label={`Selecionar análise ${p.toLowerCase()}`} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${periodType === value ? 'bg-brand-primary text-white shadow' : 'text-gray-300 hover:bg-gray-600'}`}>
                                {p}
                            </button>
                        )
                    })}
                </div>

                {availablePeriods.length > 0 && (
                    <div className="mb-4">
                        <label htmlFor="period-select" className="sr-only">Selecionar Período</label>
                        <select
                            id="period-select"
                            value={selectedPeriodKey || ''}
                            onChange={(e) => setSelectedPeriodKey(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-brand-primary focus:outline-none"
                        >
                            {availablePeriods.map(p => (
                                <option key={p.key} value={p.key}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {periodicData.length === 0 || !selectedPeriodKey ? (
                 <div className="text-center text-gray-400 mt-10 bg-gray-800 p-6 rounded-lg">
                    <BarChart2 size={48} className="mx-auto mb-4" />
                    <h2 className="text-xl font-semibold">Dados Insuficientes</h2>
                    <p className="mt-2">Não há registros suficientes para gerar uma análise {periodType} ou o período selecionado.</p>
                </div>
            ) : (
                <div> {/* Adicionado um div wrapper para os múltiplos elementos */}
                    <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                        <div className="bg-gray-800 p-2 rounded-lg"><p className="text-xs text-blue-400">Ganhos</p><p className="font-bold text-sm text-blue-400">{totals.ganhos.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p></div>
                        <div className="bg-gray-800 p-2 rounded-lg"><p className="text-xs text-yellow-400">Custos</p><p className="font-bold text-sm text-yellow-400">{totals.custos.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p></div>
                        <div className="bg-gray-800 p-2 rounded-lg"><p className="text-xs text-green-400">Lucro</p><p className="font-bold text-sm text-green-400">{totals.lucroLiquido.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p></div>
                        <div className="bg-gray-800 p-2 rounded-lg"><p className="text-xs text-purple-400">Horas</p><p className="font-bold text-sm text-purple-400">{totals.totalHoursWorked.toFixed(1)} h</p></div>
                    </div>

                    <div className="space-y-6">
                        {/* Graph 1: Ganhos Brutos vs. Custos Totais (BarChart - Total do Período) */}
                        <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                            <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">Ganhos Brutos vs. Custos Totais</h3>
                            <div className="w-full h-60">
                                <ResponsiveContainer>
                                    <BarChart data={currentPeriodGanhosCustosData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="gradientGanhos" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/> {/* blue-600 */}
                                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.3}/>
                                            </linearGradient>
                                            <linearGradient id="gradientCustos" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/> {/* amber-500 */}
                                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                        <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`} />
                                        <Tooltip 
                                            contentStyle={tooltipContentStyle}
                                            labelStyle={tooltipLabelStyle}
                                            formatter={(value: number) => `${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`} 
                                        />
                                        <Legend wrapperStyle={{fontSize: "12px"}}/>
                                        <Bar dataKey="ganhos" fill="url(#gradientGanhos)" name="Ganhos" activeBar={false} />
                                        <Bar dataKey="custos" fill="url(#gradientCustos)" name="Custos" activeBar={false} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        {/* Graph 2: Evolução do Lucro Líquido (AreaChart) */}
                        <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                            <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">Evolução do Lucro Líquido</h3>
                            <div className="w-full h-60">
                                <ResponsiveContainer>
                                    <AreaChart data={detailedLucroLiquidoData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="colorLucro" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/> {/* brand-primary */}
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorPrejuizo" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/> {/* red-500 */}
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                        <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`} />
                                        <Tooltip 
                                            contentStyle={tooltipContentStyle}
                                            labelStyle={tooltipLabelStyle}
                                            formatter={(value: number) => `${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`} 
                                        />
                                        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                                        <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorLucro)" name="Lucro Líquido" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        {/* Graph 3: Desempenho de Lucro por KM (R$) (LineChart) */}
                        <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                            <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">Desempenho de Lucro por KM (R$)</h3>
                            <div className="w-full h-60">
                                <ResponsiveContainer>
                                    <LineChart data={detailedLucroPorKmData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                        <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`} />
                                        <Tooltip 
                                            contentStyle={tooltipContentStyle}
                                            labelStyle={tooltipLabelStyle}
                                            formatter={(value: number) => `${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}/KM`} 
                                        />
                                        <Line type="monotone" dataKey="value" name="Lucro/KM" stroke="#8b5cf6" activeDot={{ r: 6 }} /> {/* violet-500 */}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Graph 4: KM Rodados (AreaChart) */}
                        <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                            <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">KM Rodados</h3>
                            <div className="w-full h-60">
                                <ResponsiveContainer>
                                    <AreaChart data={cumulativeKmData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="gradientKm" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/> {/* cyan-500 */}
                                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.3}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                        <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `${value} KM`} />
                                        <Tooltip 
                                            contentStyle={tooltipContentStyle}
                                            labelStyle={tooltipLabelStyle}
                                            formatter={(value: number) => `${Number(value).toFixed(1)} KM`} 
                                        />
                                        <Area type="monotone" dataKey="value" name="KM" stroke="#06b6d4" fill="url(#gradientKm)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Graph 5: Total de Horas Trabalhadas (AreaChart) */}
                        <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                            <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">Total de Horas Trabalhadas</h3>
                            <div className="w-full h-60">
                                <ResponsiveContainer>
                                    <AreaChart data={cumulativeHoursData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="gradientHoras" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8}/> {/* fuchsia-500 */}
                                                <stop offset="95%" stopColor="#a855f7" stopOpacity={0.3}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                        <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `${value} h`} />
                                        <Tooltip 
                                            contentStyle={tooltipContentStyle}
                                            labelStyle={tooltipLabelStyle}
                                            formatter={(value: number) => `${Number(value).toFixed(1)} h`} 
                                        />
                                        <Area type="monotone" dataKey="value" name="Horas" stroke="#a855f7" fill="url(#gradientHoras)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Graph 6: Ganhos por Hora (R$/h) (LineChart) */}
                        <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                            <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">Ganhos por Hora (R$/h)</h3>
                            <div className="w-full h-60">
                                <ResponsiveContainer>
                                    <LineChart data={detailedGanhosPorHoraData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                        <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `R$${value}`} />
                                        <Tooltip 
                                            contentStyle={tooltipContentStyle}
                                            labelStyle={tooltipLabelStyle}
                                            formatter={(value: number) => `${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}/h`} 
                                        />
                                        <Line type="monotone" dataKey="value" name="Ganhos/h" stroke="#0ea5e9" activeDot={{ r: 6 }} /> {/* sky-500 */}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Graph 7: Lucro Líquido por Hora (R$/h) (LineChart) */}
                        <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                            <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">Lucro Líquido por Hora (R$/h)</h3>
                            <div className="w-full h-60">
                                <ResponsiveContainer>
                                    <LineChart data={detailedLucroLiquidoPorHoraData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                        <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `R$${value}`} />
                                        <Tooltip 
                                            contentStyle={tooltipContentStyle}
                                            labelStyle={tooltipLabelStyle}
                                            formatter={(value: number) => `${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}/h`} 
                                        />
                                        <Line type="monotone" dataKey="value" name="Lucro Líquido/h" stroke="#f97316" activeDot={{ r: 6 }} /> {/* orange-500 */}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Graph 8: R$/KM Bruto (LineChart) */}
                        <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                            <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">R$/KM Bruto</h3>
                            <div className="w-full h-60">
                                <ResponsiveContainer>
                                    <LineChart data={detailedGanhosPorKmBrutoData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                        <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`} />
                                        <Tooltip 
                                            contentStyle={tooltipContentStyle}
                                            labelStyle={tooltipLabelStyle}
                                            formatter={(value: number) => `${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}/KM`} 
                                        />
                                        <Line type="monotone" dataKey="value" name="R$/KM Bruto" stroke="#22c55e" activeDot={{ r: 6 }} /> {/* emerald-500 */}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Graph 9: Margem de Lucro (%) (LineChart) */}
                        <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                            <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">Margem de Lucro (%)</h3>
                            <div className="w-full h-60">
                                <ResponsiveContainer>
                                    <LineChart data={detailedMargemLucroData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                        <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `${value}%`} />
                                        <Tooltip 
                                            contentStyle={tooltipContentStyle}
                                            labelStyle={tooltipLabelStyle}
                                            formatter={(value: number) => `${Number(value).toFixed(1)}%`} 
                                        />
                                        <Line type="monotone" dataKey="value" name="Margem %" stroke="#e11d48" activeDot={{ r: 6 }} /> {/* rose-600 */}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="max-w-md mx-auto text-white">
      {!isPremium ? (
        <div className="text-center">
            <h1 className="text-3xl font-bold text-center mb-4 text-yellow-400 flex items-center justify-center">
                <Crown className="mr-2" /> GanhosPro Premium
            </h1>
            <p className="text-center text-gray-300 mb-8">
                Desbloqueie todo o potencial do app e maximize seus lucros.
            </p>
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl mb-6">
                <h2 className="text-xl font-semibold mb-4 text-brand-primary">Vantagens Premium</h2>
                <ul className="space-y-3 text-gray-300 text-left">
                <li className="flex items-start">
                    <BarChart2 className="w-5 h-5 mr-3 mt-1 text-green-400 flex-shrink-0" />
                    <span><span className="font-semibold text-white">Registros Ilimitados:</span> Salve seu histórico sem se preocupar com limites.</span>
                </li>
                 <li className="flex items-start">
                    <CalendarDays className="w-5 h-5 mr-3 mt-1 text-yellow-400 flex-shrink-0" />
                    <span><span className="font-semibold text-white">Análise Periódica:</span> Compare seus resultados por semana, mês ou ano.</span>
                </li>
                <li className="flex items-start">
                    <BrainCircuit className="w-5 h-5 mr-3 mt-1 text-yellow-400 flex-shrink-0" />
                    <span><span className="font-semibold text-white">Insights com IA:</span> Receba análises completas e converse com a IA.</span>
                </li>
                <li className="flex items-start">
                    <FileBarChart2 className="w-5 h-5 mr-3 mt-1 text-yellow-400 flex-shrink-0" />
                    <span><span className="font-semibold text-white">Relatórios Inteligentes:</span> Crie relatórios personalizados com gráficos.</span>
                </li>
                <li className="flex items-start">
                    <Calculator className="w-5 h-5 mr-3 mt-1 text-yellow-400 flex-shrink-0" />
                    <span><span className="font-semibold text-white">Custo por KM Preciso:</span> Calcule seu custo real com base em todos os seus gastos.</span>
                </li>
                </ul>
            </div>
            <p className="text-lg mb-4">Atualize para o Premium por um pagamento único.</p>
            <button
                onClick={handleUpgrade}
                className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-4 px-8 rounded-lg flex items-center justify-center transition-transform transform hover:scale-105 w-full text-lg"
                aria-label="Fazer Upgrade Agora para Premium"
            >
                <Unlock className="mr-2" /> Fazer Upgrade Agora
            </button>
        </div>
      ) : (
        <>
            {activeTool === 'menu' && renderMenu()}
            {activeTool === 'insights' && renderInsightsTool()}
            {activeTool === 'reports' && renderReportsTool()}
            {activeTool === 'periodic' && renderPeriodicTool()}
        </>
      )}
    </div>
  );
};

export default Premium;