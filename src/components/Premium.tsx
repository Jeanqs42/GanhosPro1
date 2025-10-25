import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Crown, Zap, BarChart2, Unlock, Loader2, MessageSquare, ArrowLeft, BrainCircuit, CalendarDays, Calculator, FileBarChart2, User, Bot } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area, ReferenceLine } from 'recharts';
import { RunRecord, AppSettings } from '../../types';
import { analyzeRecords, getChatFollowUp, getIntelligentReportAnalysis } from '../../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface PremiumProps {
  records: RunRecord[];
  settings: AppSettings;
  isPremium: boolean;
  setIsPremium: (isPremium: boolean) => void;
}

type ActiveTool = 'menu' | 'insights' | 'reports' | 'periodic';
type PeriodType = 'weekly' | 'monthly' | 'annual';

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
    kmDriven: { label: 'KM Rodados por Dia', unit: 'KM' },
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
      const firstDay = new Date(date.setDate(date.getDate() - date.getUTCDay()));
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
      return `Semana ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
    } else if (period === 'monthly') {
      const [year, month] = key.split('-');
      return `${month}/${year.slice(2)}`;
    } else {
      return key;
    }
  };

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

    if (!selectedPeriodKey && result.length > 0) {
      setSelectedPeriodKey(result[result.length - 1].key);
    }

    return result;
  }, [records, settings, periodType, selectedPeriodKey]);

  const detailedPeriodicData = useMemo(() => {
    if (!selectedPeriodKey) return [];

    const filteredRecords = records.filter((r: RunRecord) => getPeriodKey(r.date, periodType) === selectedPeriodKey)
                                   .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const dailyDataMap = new Map<string, { date: string; lucroLiquido: number }>();
    let cumulativeProfit = 0;

    const startDate = new Date(selectedPeriodKey.includes('W') ? selectedPeriodKey.substring(1) : selectedPeriodKey);
    let endDate = new Date(startDate);

    if (periodType === 'weekly') {
      endDate.setDate(startDate.getDate() + 6);
    } else if (periodType === 'monthly') {
      endDate.setMonth(startDate.getMonth() + 1);
      endDate.setDate(0);
    } else {
      endDate.setFullYear(startDate.getFullYear() + 1);
      endDate.setDate(0);
      endDate.setMonth(11);
    }

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      dailyDataMap.set(dateKey, { date: dateKey, lucroLiquido: 0 });
    }

    filteredRecords.forEach(record => {
      const dateKey = new Date(record.date).toISOString().split('T')[0];
      const carCost = record.kmDriven * settings.costPerKm;
      const netProfit = record.totalEarnings - (record.additionalCosts || 0) - carCost;
      
      const existing = dailyDataMap.get(dateKey);
      if (existing) {
        existing.lucroLiquido += netProfit;
      } else {
        dailyDataMap.set(dateKey, { date: dateKey, lucroLiquido: netProfit });
      }
    });

    const result = Array.from(dailyDataMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return result.map(item => {
      cumulativeProfit += item.lucroLiquido;
      return {
        name: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        lucroLiquido: parseFloat(cumulativeProfit.toFixed(2)),
      };
    });

  }, [records, settings, periodType, selectedPeriodKey]);

  useEffect(() => {
    if (periodicData.length > 0) {
      setSelectedPeriodKey(periodicData[periodicData.length - 1].key);
    } else {
      setSelectedPeriodKey(null);
    }
  }, [periodType, periodicData.length]);

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
                    <option value="netProfit">Lucro Líquido por Dia</option>
                    <option value="profitPerKm">Lucro por KM</option>
                    <option value="grossEarnings">Ganhos Brutos por Dia</option>
                    <option value="grossEarningsPerKm">R$/KM Bruto</option>
                    <option value="totalCosts">Custos Totais por Dia</option>
                    <option value="carCostOnly">Custo do Carro por Dia</option>
                    <option value="additionalCostsOnly">Custos Adicionais por Dia</option>
                    <option value="kmDriven">KM Rodados por Dia</option>
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
                            <YAxis stroke="#a0aec0" fontSize={12} tickFormatter={(value: number) => metricsInfo[reportConfig.metric].unit === 'KM' ? `${value} KM` : `R$${value}`} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4a5568', color: '#f9fafb' }}
                                labelStyle={{ color: '#10b981' }}
                                formatter={(value: number) => [
                                    metricsInfo[reportConfig.metric].unit === 'KM' ? `${Number(value).toFixed(1)} KM` : `${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`,
                                    metricsInfo[reportConfig.metric].label
                                ]}
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
                                        : reportTotals.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                    }
                                </p>
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded-lg">
                                <p className="text-xs text-gray-400 mb-1">Média Diária</p>
                                <p className="font-bold text-white">
                                    {metricsInfo[reportConfig.metric].unit === 'KM' 
                                        ? `${reportTotals.average.toFixed(1)} KM`
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

  // Helper para calcular a mudança percentual
  const calculateChange = (current: number, previous: number): string => {
    if (previous === 0) {
      return current > 0 ? '+∞%' : 'N/A'; // Aumento infinito se o anterior era 0 e o atual é positivo
    }
    const change = ((current - previous) / previous) * 100;
    if (change > 0) return `+${change.toFixed(1)}%`;
    if (change < 0) return `${change.toFixed(1)}%`;
    return '0%';
  };

  const renderPeriodicTool = () => {
    const totals = periodicData.reduce((acc: { ganhos: number; custos: number; lucroLiquido: number; kmRodados: number; totalHoursWorked: number; ganhosPorHora: number; lucroLiquidoPorHora: number }, item: any) => {
        acc.ganhos += item.ganhos;
        acc.custos += item.custos;
        acc.lucroLiquido += item.lucroLiquido;
        acc.kmRodados += item.kmRodados;
        acc.totalHoursWorked += item.totalHoursWorked;
        // Para ganhosPorHora e lucroLiquidoPorHora, a média é mais relevante para o total
        // Mas para o resumo, vamos somar e depois calcular a média se necessário, ou usar os valores já calculados por período.
        // Por enquanto, para o resumo geral, manteremos a soma dos totais e calcularemos a média no display se for o caso.
        return acc;
    }, { ganhos: 0, custos: 0, lucroLiquido: 0, kmRodados: 0, totalHoursWorked: 0, ganhosPorHora: 0, lucroLiquidoPorHora: 0 });

    // Comparação de Períodos
    const lastPeriodData = periodicData.length > 0 ? periodicData[periodicData.length - 1] : null;
    const previousPeriodData = periodicData.length > 1 ? periodicData[periodicData.length - 2] : null;

    const comparisonMetrics = [
      { label: 'Lucro Líquido', current: lastPeriodData?.lucroLiquido, previous: previousPeriodData?.lucroLiquido, unit: 'R$' },
      { label: 'Ganhos Brutos', current: lastPeriodData?.ganhos, previous: previousPeriodData?.ganhos, unit: 'R$' },
      { label: 'Custos Totais', current: lastPeriodData?.custos, previous: previousPeriodData?.custos, unit: 'R$' },
      { label: 'KM Rodados', current: lastPeriodData?.kmRodados, previous: previousPeriodData?.kmRodados, unit: 'KM' },
      { label: 'Horas Trabalhadas', current: lastPeriodData?.totalHoursWorked, previous: previousPeriodData?.totalHoursWorked, unit: 'h' },
      { label: 'Ganhos por Hora', current: lastPeriodData?.ganhosPorHora, previous: previousPeriodData?.ganhosPorHora, unit: 'R$/h' },
      { label: 'Lucro por Hora', current: lastPeriodData?.lucroLiquidoPorHora, previous: previousPeriodData?.lucroLiquidoPorHora, unit: 'R$/h' },
    ];

    const tooltipContentStyle = { backgroundColor: '#1f2937', border: '1px solid #4a5568', color: '#f9fafb' };
    const tooltipLabelStyle = { color: '#10b981' };

    return (
        <div className="animate-fade-in-up">
            {renderHeader('Análise Periódica', <CalendarDays/>)}
            <div className="bg-gray-800 p-4 rounded-lg shadow-xl mb-4">
                <div className="flex justify-center bg-gray-700/50 rounded-lg p-1">
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
            </div>

            {periodicData.length === 0 ? (
                 <div className="text-center text-gray-400 mt-10 bg-gray-800 p-6 rounded-lg">
                    <BarChart2 size={48} className="mx-auto mb-4" />
                    <h2 className="text-xl font-semibold">Dados Insuficientes</h2>
                    <p className="mt-2">Não há registros suficientes para gerar uma análise {periodType}.</p>
                </div>
            ) : (
                <>
                <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                    <div className="bg-gray-800 p-2 rounded-lg"><p className="text-xs text-gray-400">Ganhos</p><p className="font-bold text-sm text-blue-400">{totals.ganhos.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p></div>
                    <div className="bg-gray-800 p-2 rounded-lg"><p className="text-xs text-gray-400">Custos</p><p className="font-bold text-sm text-brand-accent">{totals.custos.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p></div>
                    <div className="bg-gray-800 p-2 rounded-lg"><p className="text-xs text-gray-400">Lucro</p><p className="font-bold text-sm text-brand-primary">{totals.lucroLiquido.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p></div>
                    <div className="bg-gray-800 p-2 rounded-lg"><p className="font-bold text-sm text-purple-400">{totals.totalHoursWorked.toFixed(1)} h</p></div>
                </div>

                {/* Novo: Resumo de Comparação de Períodos */}
                {previousPeriodData && lastPeriodData && (
                  <div className="bg-gray-800 p-4 rounded-lg shadow-xl mb-6 animate-fade-in-up">
                    <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">
                      Comparação: {lastPeriodData.name} vs {previousPeriodData.name}
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      {comparisonMetrics.map((metric, index) => (
                        <div key={index} className="bg-gray-700/50 p-2 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">{metric.label}</p>
                          <p className={`font-bold text-sm ${
                            (metric.current || 0) >= (metric.previous || 0) ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {calculateChange(metric.current || 0, metric.previous || 0)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                    {/* Graph 1: Ganhos Brutos vs. Custos Totais */}
                    <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                        <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">Ganhos Brutos vs. Custos Totais</h3>
                        <div className="w-full h-60">
                            <ResponsiveContainer>
                                <BarChart data={periodicData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="gradientGanhos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/> {/* brand-primary */}
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
                                        </linearGradient>
                                        <linearGradient id="gradientCustos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/> {/* brand-accent */}
                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                    <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                    <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`} />
                                    <Tooltip 
                                        contentStyle={tooltipContentStyle}
                                        labelStyle={tooltipLabelStyle}
                                        formatter={(value: number, name: string) => [`${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`, name === 'ganhos' ? 'Ganhos' : 'Custos']} 
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
                        {periodicData.length > 0 && (
                          <div className="mb-4">
                            <label htmlFor="period-select" className="sr-only">Selecionar Período</label>
                            <select
                              id="period-select"
                              value={selectedPeriodKey || ''}
                              onChange={(e) => setSelectedPeriodKey(e.target.value)}
                              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-brand-primary focus:outline-none"
                            >
                              {periodicData.map(p => (
                                <option key={p.key} value={p.key}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="w-full h-60">
                            <ResponsiveContainer>
                                <AreaChart data={detailedPeriodicData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="colorLucro" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorPrejuizo" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                    <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                    <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`} />
                                    <Tooltip 
                                        contentStyle={tooltipContentStyle}
                                        labelStyle={tooltipLabelStyle}
                                        formatter={(value: number) => [`${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`, 'Lucro Líquido Acumulado']} 
                                    />
                                    <Legend wrapperStyle={{fontSize: "12px"}}/> {/* Adicionado Legend */}
                                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                                    <Area type="monotone" dataKey="lucroLiquido" stroke="#10b981" fillOpacity={1} fill="url(#colorLucro)" name="Lucro Líquido" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                     {/* Graph 3: Desempenho de Lucro por KM (R$) */}
                    <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                        <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">Desempenho de Lucro por KM (R$)</h3>
                        <div className="w-full h-60">
                           <ResponsiveContainer>
                                <BarChart data={periodicData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="gradientLucroKm" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/> {/* brand-primary */}
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                    <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                    <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`} />
                                    <Tooltip 
                                        contentStyle={tooltipContentStyle}
                                        labelStyle={tooltipLabelStyle}
                                        formatter={(value: number) => [`${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`, 'Lucro/KM']} 
                                    />
                                    <Legend wrapperStyle={{fontSize: "12px"}}/>
                                    <Bar dataKey="lucroPorKm" name="Lucro/KM" fill="url(#gradientLucroKm)" activeBar={false} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Graph 4: KM Rodados */}
                    <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                        <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">KM Rodados</h3>
                        <div className="w-full h-60">
                           <ResponsiveContainer>
                                <BarChart data={periodicData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="gradientKm" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.8}/> {/* blue-400 */}
                                            <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.3}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                    <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                    <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `${value} KM`} />
                                    <Tooltip 
                                        contentStyle={tooltipContentStyle}
                                        labelStyle={tooltipLabelStyle}
                                        formatter={(value: number) => [`${Number(value).toFixed(1)} KM`, 'KM Rodados']} 
                                    />
                                    <Legend wrapperStyle={{fontSize: "12px"}}/>
                                    <Bar dataKey="kmRodados" name="KM" fill="url(#gradientKm)" activeBar={false} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Graph 5: Total de Horas Trabalhadas */}
                    <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                        <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">Total de Horas Trabalhadas</h3>
                        <div className="w-full h-60">
                           <ResponsiveContainer>
                                <BarChart data={periodicData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="gradientHoras" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.8}/> {/* purple-400 */}
                                            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.3}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                    <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                    <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `${value} h`} />
                                    <Tooltip 
                                        contentStyle={tooltipContentStyle}
                                        labelStyle={tooltipLabelStyle}
                                        formatter={(value: number) => [`${Number(value).toFixed(1)} h`, 'Horas Trabalhadas']} 
                                    />
                                    <Legend wrapperStyle={{fontSize: "12px"}}/>
                                    <Bar dataKey="totalHoursWorked" name="Horas" fill="url(#gradientHoras)" activeBar={false} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Graph 6: Ganhos por Hora */}
                    <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                        <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">Ganhos por Hora (R$/h)</h3>
                        <div className="w-full h-60">
                           <ResponsiveContainer>
                                <BarChart data={periodicData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="gradientGanhosPorHora" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/> {/* brand-primary */}
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                    <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                    <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `R$${value}`} />
                                    <Tooltip 
                                        contentStyle={tooltipContentStyle}
                                        labelStyle={tooltipLabelStyle}
                                        formatter={(value: number) => [`${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}/h`, 'Ganhos por Hora']} 
                                    />
                                    <Legend wrapperStyle={{fontSize: "12px"}}/>
                                    <Bar dataKey="ganhosPorHora" name="Ganhos/h" fill="url(#gradientGanhosPorHora)" activeBar={false} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Graph 7: Lucro Líquido por Hora */}
                    <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                        <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">Lucro Líquido por Hora (R$/h)</h3>
                        <div className="w-full h-60">
                           <ResponsiveContainer>
                                <BarChart data={periodicData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="gradientLucroLiquidoPorHora" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/> {/* brand-primary */}
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                    <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                    <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `R$${value}`} />
                                    <Tooltip 
                                        contentStyle={tooltipContentStyle}
                                        labelStyle={tooltipLabelStyle}
                                        formatter={(value: number) => [`${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}/h`, 'Lucro Líquido por Hora']} 
                                    />
                                    <Legend wrapperStyle={{fontSize: "12px"}}/>
                                    <Bar dataKey="lucroLiquidoPorHora" name="Lucro Líquido/h" fill="url(#gradientLucroLiquidoPorHora)" activeBar={false} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Graph 8: R$/KM Bruto (antigo 6) */}
                    <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                        <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">R$/KM Bruto</h3>
                        <div className="w-full h-60">
                           <ResponsiveContainer>
                                <BarChart data={periodicData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="gradientGanhosKmBruto" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/> {/* brand-primary */}
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                    <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                    <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`} />
                                    <Tooltip 
                                        contentStyle={tooltipContentStyle}
                                        labelStyle={tooltipLabelStyle}
                                        formatter={(value: number) => [`${Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`, 'R$/KM Bruto']} 
                                    />
                                    <Legend wrapperStyle={{fontSize: "12px"}}/>
                                    <Bar dataKey="ganhosPorKmBruto" name="R$/KM Bruto" fill="url(#gradientGanhosKmBruto)" activeBar={false} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Graph 9: Margem de Lucro (%) (antigo 7) */}
                    <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
                        <h3 className="font-semibold text-base mb-4 text-brand-primary text-center">Margem de Lucro (%)</h3>
                        <div className="w-full h-60">
                           <ResponsiveContainer>
                                <BarChart data={periodicData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="gradientMargem" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#e11d48" stopOpacity={0.8}/> {/* rose-500 */}
                                            <stop offset="95%" stopColor="#e11d48" stopOpacity={0.3}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                    <XAxis dataKey="name" stroke="#a0aec0" fontSize={11} />
                                    <YAxis stroke="#a0aec0" fontSize={11} tickFormatter={(value: number) => `${value}%`} />
                                    <Tooltip 
                                        contentStyle={tooltipContentStyle}
                                        labelStyle={tooltipLabelStyle}
                                        formatter={(value: number) => [`${Number(value).toFixed(1)}%`, 'Margem de Lucro']} 
                                    />
                                    <Legend wrapperStyle={{fontSize: "12px"}}/>
                                    <Bar dataKey="margemLucro" name="Margem %" fill="url(#gradientMargem)" activeBar={false} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
                </>
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