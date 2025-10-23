import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DollarSign, Route, Clock, Wrench, Calculator, Save, Info, Edit, ArrowLeft, Wifi, WifiOff, Clock3 } from 'lucide-react';
import { RunRecord, AppSettings, CalculationResult } from '../types';
import { safeRandomUUID } from '../utils/uuid';
import { useOfflineSync } from '../hooks/useOfflineSync';


interface DashboardProps {
  records: RunRecord[];
  settings: AppSettings;
  addOrUpdateRecord: (record: RunRecord) => void;
  deleteRecord: (id: string) => void;
  isPremium: boolean;
}

// Memoized InputField component
const InputField = React.memo<{ 
  icon: React.ReactNode; 
  label: string; 
  id: string; 
  value: string; 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  placeholder: string; 
  type?: string; 
  isHighlighted?: boolean 
}>(({ icon, label, id, value, onChange, placeholder, type = "number", isHighlighted = false }) => (
    <div className="mb-4">
        <label htmlFor={id} className={`flex items-center text-sm font-medium text-gray-300 mb-2 ${isHighlighted ? 'font-bold text-lg text-white' : ''}`}>
            {icon}
            <span className="ml-2">{label}</span>
        </label>
        <input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={`w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-primary focus:outline-none transition ${isHighlighted ? 'py-4 text-xl border-brand-primary' : ''}`}
            step="0.01"
            min="0"
        />
    </div>
));

// Memoized ResultCard component
const ResultCard = React.memo<{ title: string; value: string; color: string; }>(({ title, value, color }) => (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md text-center">
        <p className="text-sm text-gray-400">{title}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
));

const Dashboard: React.FC<DashboardProps> = ({ records, settings, addOrUpdateRecord, deleteRecord, isPremium }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const recordFromState = location.state?.record as RunRecord | undefined;
    
    // Hook de sincronização offline
    const {
        isOnline,
        isInitialized,
        hasPendingOperations,
        syncInProgress,
        saveRecord: saveRecordOffline,
        getAllRecords: getAllRecordsOffline,
        deleteRecord: deleteRecordOffline,
        forcSync,
        // add lastSyncTime from hook
        lastSyncTime,
    } = useOfflineSync();

    const [isDetailsView, setIsDetailsView] = useState(!!recordFromState);
    const [id, setId] = useState(recordFromState?.id || safeRandomUUID());
    const [date, setDate] = useState(recordFromState?.date || new Date().toISOString().split('T')[0]);
    const [totalEarnings, setTotalEarnings] = useState(recordFromState?.totalEarnings?.toString() || '');
    const [kmDriven, setKmDriven] = useState(recordFromState?.kmDriven?.toString() || '');
    const [hoursWorked, setHoursWorked] = useState(recordFromState?.hoursWorked?.toString() || '');
    const [additionalCosts, setAdditionalCosts] = useState(recordFromState?.additionalCosts?.toString() || '');
    // Result calculation is now handled by useMemo below
    const [hasCalculated, setHasCalculated] = useState(!!recordFromState);

    const handleCalculateClick = () => {
        const earnings = parseFloat(totalEarnings);
        const km = parseFloat(kmDriven);

        if (isNaN(earnings) || isNaN(km) || earnings <= 0 || km <= 0) {
            toast.error('Ganhos do Dia e KM Rodado são obrigatórios e devem ser maiores que zero.');
            return;
        }

        const existingRecord = records.find(r => r.date === date && r.id !== id);

        if (existingRecord) {
             toast((t) => (
                <div className="flex flex-col items-center text-center p-2">
                    <h3 className="font-bold text-lg mb-2 text-yellow-400">Aviso de Sobrescrita</h3>
                    <p className="text-sm mb-4">
                        Já existe um registro para {new Date(date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}.
                        Deseja continuar? O registro antigo será substituído ao salvar.
                    </p>
                    <div className="flex w-full space-x-2">
                         <button
                            onClick={() => toast.dismiss(t.id)}
                            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => {
                                toast.dismiss(t.id);
                                setHasCalculated(true);
                            }}
                            className="flex-1 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                        >
                            Continuar
                        </button>
                    </div>
                </div>
            ), {
                duration: Infinity,
            });
        } else {
            setHasCalculated(true);
        }
    };
    
    useEffect(() => {
        if (recordFromState) {
            // Se um registro é passado via state, preencha os campos do formulário
            setId(recordFromState.id);
            setDate(recordFromState.date);
            setTotalEarnings(recordFromState.totalEarnings?.toString() || '');
            setKmDriven(recordFromState.kmDriven?.toString() || '');
            setHoursWorked(recordFromState.hoursWorked?.toString() || '');
            setAdditionalCosts(recordFromState.additionalCosts?.toString() || '');
            setIsDetailsView(true); // Mostra a visualização de detalhes inicialmente
            setHasCalculated(true); // Assume que já foi calculado para exibição
        } else {
            // Se nenhum registro é passado, garanta que o formulário esteja limpo para um novo cálculo.
            // Não chame handleReset() aqui, pois ele limpa o location.state.
            // Em vez disso, apenas defina os estados para seus valores iniciais vazios.
            setId(safeRandomUUID()); // Gera um novo ID para um novo registro
            setDate(new Date().toISOString().split('T')[0]);
            setTotalEarnings('');
            setKmDriven('');
            setHoursWorked('');
            setAdditionalCosts('');
            setIsDetailsView(false); // Garante que estamos no modo de entrada
            setHasCalculated(false); // Garante que estamos no modo de entrada
        }
    }, [recordFromState, settings]);


    const handleSave = async () => {
        if (!hasCalculated) {
            toast.error('Clique em "Calcular" antes de salvar.');
            return;
        }
        if (!result) {
            toast.error('Calcule os resultados antes de salvar.');
            return;
        }

        const { isUpdating, recordToOverwrite, canSaveNewRecord } = recordValidation;

        if (!canSaveNewRecord) {
            toast((t) => (
                <div className="flex flex-col items-center text-center p-2">
                    <h3 className="font-bold text-lg mb-2 text-brand-primary">Limite Gratuito Atingido</h3>
                    <p className="text-sm mb-4">
                        Você atingiu o limite de 15 registros. Para continuar, apague um registro antigo ou assine o Premium para registros ilimitados.
                    </p>
                    <div className="flex w-full space-x-2">
                         <button
                            onClick={() => {
                                navigate('/history');
                                toast.dismiss(t.id);
                            }}
                            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                        >
                            Ver Histórico
                        </button>
                        <button
                            onClick={() => {
                                navigate('/premium');
                                toast.dismiss(t.id);
                            }}
                            className="flex-1 bg-brand-accent hover:opacity-90 text-gray-900 font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                        >
                            Ir para Premium
                        </button>
                    </div>
                </div>
            ), {
                duration: Infinity,
            });
            return;
        }

        const record: RunRecord = {
            id, // Use the current ID state, which is from recordFromState if editing
            date,
            totalEarnings: parseFloat(totalEarnings),
            kmDriven: parseFloat(kmDriven),
            hoursWorked: hoursWorked ? parseFloat(hoursWorked) : undefined,
            additionalCosts: additionalCosts ? parseFloat(additionalCosts) : undefined,
        };

        // Usar sincronização offline
        const saveSuccess = await saveRecordOffline(record);
        
        if (!saveSuccess) {
            toast.error('Erro ao salvar registro. Tente novamente.');
            return;
        }

        // Se houver registro para sobrescrever, deletar o antigo
        if (recordToOverwrite) {
            await deleteRecordOffline(recordToOverwrite.id);
        }

        // Atualizar estado local para refletir imediatamente
        addOrUpdateRecord(record);
        if (recordToOverwrite) {
            deleteRecord(recordToOverwrite.id);
        }
        
        let successMessage: string;
        if (recordToOverwrite) {
             successMessage = 'Registro sobrescrito com sucesso!';
        } else if (isUpdating) {
            successMessage = 'Registro atualizado!';
        } else {
            successMessage = 'Registro salvo com sucesso!';
        }

        toast.success(successMessage);
        navigate('/history');
    };

    const handleReset = () => {
        setId(safeRandomUUID());
        setDate(new Date().toISOString().split('T')[0]);
        setTotalEarnings('');
        setKmDriven('');
        setHoursWorked('');
        setAdditionalCosts('');
        setIsDetailsView(false);
        setHasCalculated(false);
        navigate('/', { state: {}, replace: true });
    };

    // Memoized calculation function
    const calculateResults = useCallback((
        totalEarnings: number,
        kmDriven: number,
        hoursWorked: number | undefined,
        additionalCosts: number | undefined,
        costPerKm: number
    ): CalculationResult => {
        const carCost = kmDriven * costPerKm;
        const totalCosts = carCost + (additionalCosts || 0);
        const grossProfit = totalEarnings - carCost;
        const netProfit = totalEarnings - totalCosts;
        const grossEarningsPerKm = totalEarnings / kmDriven;
        const profitPerKm = netProfit / kmDriven;
        const grossEarningsPerHour = hoursWorked ? totalEarnings / hoursWorked : 0;
        const profitPerHour = hoursWorked ? netProfit / hoursWorked : 0;

        return {
            totalEarnings,
            grossEarningsPerKm,
            grossProfit,
            carCost,
            netProfit,
            profitPerKm,
            profitPerHour,
            grossEarningsPerHour,
        };
    }, []);

    // Memoized result calculation
    const result = useMemo(() => {
        const earnings = parseFloat(totalEarnings);
        const km = parseFloat(kmDriven);
        const hours = hoursWorked ? parseFloat(hoursWorked) : undefined;
        const costs = additionalCosts ? parseFloat(additionalCosts) : undefined;

        if (isNaN(earnings) || isNaN(km) || earnings <= 0 || km <= 0) {
            return null;
        }

        return calculateResults(earnings, km, hours, costs, settings.costPerKm);
    }, [totalEarnings, kmDriven, hoursWorked, additionalCosts, settings.costPerKm, calculateResults]);

    // Memoized formatted results
    const formattedResults = useMemo(() => {
      if (!result) return null;
      return {
        totalEarnings: result.totalEarnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        grossEarningsPerKm: result.grossEarningsPerKm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        grossProfit: result.grossProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        carCost: result.carCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        netProfit: result.netProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        profitPerKm: result.profitPerKm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        profitPerHour: result.profitPerHour.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        grossEarningsPerHour: result.grossEarningsPerHour.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      }
    }, [result]);

    // Memoized record validation
    const recordValidation = useMemo(() => {
        const isUpdating = records.some(r => r.id === id);
        const recordToOverwrite = records.find(r => r.date === date && r.id !== id);
        const canSaveNewRecord = isPremium || isUpdating || recordToOverwrite || records.length < 15;
        
        return { isUpdating, recordToOverwrite, canSaveNewRecord };
    }, [records, id, date, isPremium]);

    const renderResultView = (isDetails: boolean) => (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl animate-fade-in-up mb-4">
            <h2 className="text-xl font-semibold text-center mb-4">
                {isDetails ? `Detalhes de ${new Date(date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : 'Resumo do Dia'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 bg-gray-900/50 p-4 rounded-lg shadow-md text-center">
                    <p className="text-base font-medium text-gray-300">Lucro Líquido</p>
                    <p className={`text-4xl font-bold ${result!.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formattedResults!.netProfit}</p>
                </div>
                <ResultCard title="Lucro/KM" value={formattedResults!.profitPerKm} color={result!.profitPerKm >= 0 ? 'text-green-400' : 'text-red-400'} />
                <ResultCard title="Lucro/Hora" value={formattedResults!.profitPerHour} color={result!.profitPerHour >= 0 ? 'text-green-400' : 'text-red-400'} />
                <ResultCard title="Ganho Bruto" value={formattedResults!.totalEarnings} color="text-blue-400" />
                <ResultCard title="Custo do Carro" value={formattedResults!.carCost} color="text-yellow-400" />
                <ResultCard title="R$/KM Bruto" value={formattedResults!.grossEarningsPerKm} color="text-indigo-400" />
                <ResultCard title="R$/Hora Bruto" value={formattedResults!.grossEarningsPerHour} color="text-purple-400" />
            </div>
             {isDetails ? (
                <>
                    <button onClick={() => { setIsDetailsView(false); setHasCalculated(false); }} className="w-full mt-6 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-transform transform hover:scale-105">
                        <Edit size={20} className="mr-2"/>
                        Editar Registro
                    </button>
                    <button onClick={() => navigate('/history')} className="w-full mt-4 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition">
                        <ArrowLeft size={20} className="mr-2" />
                        Voltar ao Histórico
                    </button>
                </>
             ) : (
                <>
                    <button onClick={handleSave} className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-transform transform hover:scale-105">
                        <Save size={20} className="mr-2"/>
                        {recordFromState ? 'Atualizar Registro' : 'Salvar Registro'}
                    </button>
                    <button onClick={handleReset} className="w-full mt-4 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition">
                        <Calculator size={20} className="mr-2" />
                        Fazer Novo Cálculo
                    </button>
                </>
             )}
        </div>
    );

    return (
        <div className="max-w-md mx-auto">
             <h1 className="text-2xl font-bold text-center mb-2 text-brand-primary">
                 {isDetailsView ? 'Detalhes do Registro' : (hasCalculated && result ? 'Seu Resultado' : (recordFromState ? 'Editar Registro' : 'Calculadora Diária'))}
            </h1>
            <div className="flex items-center justify-center mb-4 text-xs text-gray-400" aria-live="polite">
                {isOnline ? (
                    <span className="flex items-center"><Wifi size={14} className="mr-1"/> Online</span>
                ) : (
                    <span className="flex items-center"><WifiOff size={14} className="mr-1"/> Offline</span>
                )}
                {syncInProgress ? (
                    <span className="ml-3">Sincronizando…</span>
                ) : hasPendingOperations ? (
                    <button onClick={forcSync} className="ml-3 underline">Sincronizar</button>
                ) : lastSyncTime ? (
                    <span className="ml-3 flex items-center"><Clock3 size={14} className="mr-1"/> Última sync: {new Date(lastSyncTime).toLocaleTimeString('pt-BR')}</span>
                ) : null}
            </div>

            {settings.costPerKm === 0 && (
                <div className="bg-yellow-900 border border-yellow-700 text-yellow-200 px-4 py-3 rounded-lg relative mb-4 text-sm flex items-start" role="alert">
                    <Info size={18} className="mr-3 mt-1 flex-shrink-0" />
                    <div>
                        <strong className="font-bold">Atenção!</strong>
                        <span className="block sm:inline ml-1">Seu custo por KM está definido como 0. Vá para a tela de <button onClick={() => navigate('/settings')} className="font-bold underline">Ajustes</button> para configurar e obter cálculos precisos.</span>
                    </div>
                </div>
            )}
            
            {hasCalculated && result && !isDetailsView ? renderResultView(false) : null}
            {hasCalculated && result && isDetailsView ? renderResultView(true) : null}

            {!hasCalculated && (
                <div className="bg-gray-800 p-6 rounded-lg shadow-xl mb-4 animate-fade-in-up"> {/* Alterado mb-6 para mb-4 */}
                    <InputField icon={<DollarSign size={18}/>} label="Ganhos do Dia (R$)" id="totalEarnings" value={totalEarnings} onChange={e => setTotalEarnings(e.target.value)} placeholder="Ex: 250.50" isHighlighted />
                    <InputField icon={<Route size={18}/>} label="KM Rodado" id="kmDriven" value={kmDriven} onChange={e => setKmDriven(e.target.value)} placeholder="Ex: 180" isHighlighted />
                    <InputField icon={<Clock size={18}/>} label="Horas Trabalhadas (Opcional)" id="hoursWorked" value={hoursWorked} onChange={e => setHoursWorked(e.target.value)} placeholder="Ex: 8.5" />
                    <InputField icon={<Wrench size={18}/>} label="Custos Adicionais (Opcional)" id="additionalCosts" value={additionalCosts} onChange={e => setAdditionalCosts(e.target.value)} placeholder="Ex: 25 (água, balas)" />
                    <div className="mb-4">
                        <label htmlFor="date" className="flex items-center text-sm font-medium text-gray-300 mb-2">
                            <span className="ml-2">Data</span>
                        </label>
                        <input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-primary focus:outline-none transition" />
                    </div>
                    <button onClick={handleCalculateClick} className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-transform transform hover:scale-105">
                        <Calculator size={20} className="mr-2"/>
                        Calcular
                    </button>
                </div>
            )}
        </div>
    );
};

export default Dashboard;