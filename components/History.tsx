import React, { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { RunRecord, AppSettings } from '../types';
import { Trash2, Calendar, Route, FileDown, FileText, Wifi, WifiOff, Clock3 } from 'lucide-react';
import { exportCSV, exportPDF } from '../utils/export';
import { useOfflineSync } from '../hooks/useOfflineSync';

interface HistoryProps {
  records: RunRecord[];
  deleteRecord: (id: string) => void;
  settings: AppSettings;
}

const History: React.FC<HistoryProps> = ({ records, deleteRecord, settings }) => {
  const navigate = useNavigate();
  
  const {
    isOnline,
    hasPendingOperations,
    syncInProgress,
    forcSync,
    getAllRecords,
    deleteRecord: deleteRecordOffline,
    pendingOperations,
    lastSyncTime,
  } = useOfflineSync();

  const [offlineRecords, setOfflineRecords] = useState<RunRecord[] | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const recs = await getAllRecords();
        if (mounted) setOfflineRecords(recs);
      } catch (e) {
        // silently fallback
      }
    })();
    return () => { mounted = false; };
  }, [getAllRecords]);

  const sortedRecords = useMemo(() => {
    const list = offlineRecords ?? records;
    return [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [offlineRecords, records]);

  const handleViewDetails = (record: RunRecord) => {
    navigate('/', { state: { record: record } });
  };

  const handleDelete = (id: string, recordDate: string) => {
    toast((t) => (
        <div className="flex flex-col items-center text-center p-2">
            <h3 className="font-bold text-lg mb-2 text-red-400">Confirmar Exclusão</h3>
            <p className="text-sm mb-4">
                Tem certeza que deseja apagar o registro do dia {new Date(recordDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}?
                <br/>
                <span className="font-bold">Esta ação não pode ser desfeita.</span>
            </p>
            <div className="flex w-full space-x-2">
                 <button
                    onClick={() => toast.dismiss(t.id)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                >
                    Cancelar
                </button>
                <button
                    onClick={async () => {
                        const success = await deleteRecordOffline(id);
                        if (!success) {
                          toast.error('Falha ao apagar. Tente novamente.');
                          return;
                        }
                        setOfflineRecords(prev => prev ? prev.filter(r => r.id !== id) : prev);
                        deleteRecord(id);
                        toast.dismiss(t.id);
                        toast.success('Registro apagado com sucesso!');
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                >
                    Confirmar
                </button>
            </div>
        </div>
    ), {
        duration: Infinity,
    });
  };

  const handleExportCSV = () => {
    const list = offlineRecords ?? records;
    if (list.length === 0) {
      toast.error('Não há registros para exportar.');
      return;
    }
    try {
      exportCSV(sortedRecords, settings, { separator: ',', locale: 'pt-BR', currency: 'BRL' });
      toast.success('Exportação para CSV iniciada!');
    } catch (e) {
      toast.error('Falha ao exportar CSV.');
    }
  };

  const totalEarnings = useMemo(() => (offlineRecords ?? records).reduce((sum, r) => sum + r.totalEarnings, 0), [offlineRecords, records]);
  const totalKm = useMemo(() => (offlineRecords ?? records).reduce((sum, r) => sum + r.kmDriven, 0), [offlineRecords, records]);
  const totalNetProfit = useMemo(() => {
    const list = offlineRecords ?? records;
    return list.reduce((sum, r) => {
      const carCost = r.kmDriven * settings.costPerKm;
      const additionalCosts = r.additionalCosts || 0;
      const netProfit = r.totalEarnings - additionalCosts - carCost;
      return sum + netProfit;
    }, 0);
  }, [offlineRecords, records, settings.costPerKm]);

  const handleExportPDF = () => {
    const list = offlineRecords ?? records;
    if (list.length === 0) {
      toast.error('Não há registros para exportar.');
      return;
    }
    try {
      exportPDF(sortedRecords, settings, { locale: 'pt-BR', currency: 'BRL' });
      toast.success('Exportação para PDF iniciada!');
    } catch (e) {
      toast.error('Falha ao exportar PDF.');
    }
  };

  if ((offlineRecords ?? records).length === 0) {
    return (
      <div className="text-center text-gray-400 mt-10">
        <Calendar size={48} className="mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Nenhum registro encontrado</h2>
        <p className="mt-2">Comece a adicionar suas corridas na tela de Início.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold text-brand-primary">Histórico de Corridas</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            aria-label="Exportar para PDF"
          >
            <FileText size={18} />
            <span>PDF</span>
          </button>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-brand-secondary hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            aria-label="Exportar para CSV"
          >
            <FileDown size={18} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      <div className="flex items-center mb-6 text-xs text-gray-400" aria-live="polite">
        {isOnline ? (
          <span className="flex items-center mr-3"><Wifi size={14} className="mr-1"/> Online</span>
        ) : (
          <span className="flex items-center mr-3"><WifiOff size={14} className="mr-1"/> Offline</span>
        )}
        {syncInProgress ? (
          <span>Sincronizando…</span>
        ) : hasPendingOperations ? (
          <span className="flex items-center">
            {pendingOperations.length} operações aguardando sincronização
            <button onClick={forcSync} className="ml-2 underline">Sincronizar</button>
          </span>
        ) : lastSyncTime ? (
          <span className="flex items-center"><Clock3 size={14} className="mr-1"/> Última sync: {new Date(lastSyncTime).toLocaleTimeString('pt-BR')}</span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-400">Lucro Líquido Total</p>
            <p className={`text-2xl font-bold ${totalNetProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalNetProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-400">Ganhos Totais</p>
            <p className="text-2xl font-bold text-brand-primary">{totalEarnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-400">KM Rodados Totais</p>
            <p className="text-2xl font-bold text-yellow-400">{totalKm.toFixed(1)} km</p>
        </div>
      </div>
      
      <div className="space-y-4">
        {sortedRecords.map((record) => {
          const carCost = record.kmDriven * settings.costPerKm;
          const netProfit = record.totalEarnings - (record.additionalCosts || 0) - carCost;
          
          return (
            <div 
                key={record.id} 
                className="bg-gray-800 rounded-lg shadow-md transition-all duration-300 overflow-hidden p-4 flex items-center justify-between cursor-pointer hover:bg-gray-700/50"
                onClick={() => handleViewDetails(record)}
            >
                <div className="flex items-center gap-4">
                    <Calendar size={24} className="text-gray-400 flex-shrink-0" />
                    <div>
                        <p className="font-bold text-lg text-white">{new Date(record.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                        <p className="flex items-center text-sm text-gray-400">
                            <Route size={14} className="mr-1.5" /> {record.kmDriven.toFixed(1)} km
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Lucro Líquido</p>
                        <p className={`font-bold text-lg ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{netProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(record.id, record.date); }} 
                        className="p-2 bg-red-600 hover:bg-red-700 rounded-full text-white transition-transform transform hover:scale-110" 
                        aria-label="Deletar"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default History;