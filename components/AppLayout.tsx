import React, { useEffect, useState, Suspense } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { Database, Settings as SettingsIcon, Crown, Home, Loader2 } from 'lucide-react';
// Importações lazy-loaded
const Dashboard = React.lazy(() => import('./Dashboard'));
const History = React.lazy(() => import('./History'));
const Settings = React.lazy(() => import('./Settings'));
const Premium = React.lazy(() => import('./Premium'));

import { RunRecord, AppSettings } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useOfflineSync } from '../hooks/useOfflineSync';

const AppLayout: React.FC = () => {
  const { 
    getAllRecords, 
    saveRecord: saveRecordOffline, 
    deleteRecord: deleteRecordOffline,
    isInitialized,
    pendingOperations,
  } = useOfflineSync();

  const [records, setRecords] = useState<RunRecord[]>([]);
  const [settings, setSettings] = useLocalStorage<AppSettings>('ganhospro_settings', { costPerKm: 0.75 });
  const [isPremium, setIsPremium] = useLocalStorage<boolean>('ganhospro_is_premium', false);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState<boolean>(true); // Novo estado de carregamento

  useEffect(() => {
    if (isInitialized) {
      const fetchRecords = async () => {
        setIsLoadingInitialData(true); // Inicia o carregamento
        const fetchedRecords = await getAllRecords();
        setRecords(fetchedRecords);
        setIsLoadingInitialData(false); // Finaliza o carregamento
      };
      fetchRecords();
    }
  }, [isInitialized, getAllRecords, pendingOperations.length]);

  const addOrUpdateRecord = async (record: RunRecord) => {
    const success = await saveRecordOffline(record);
    if (success) {
      setRecords(prevRecords => {
        const existingIndex = prevRecords.findIndex(r => r.id === record.id);
        if (existingIndex > -1) {
          const updatedRecords = [...prevRecords];
          updatedRecords[existingIndex] = record;
          return updatedRecords;
        } else {
          return [...prevRecords, record];
        }
      });
    }
    return success;
  };

  const deleteRecord = async (id: string) => {
    const success = await deleteRecordOffline(id);
    if (success) {
      setRecords(prevRecords => prevRecords.filter(r => r.id !== id));
    }
    return success;
  };

  return (
    <div className="flex flex-col h-screen font-sans">
      <main className="flex-grow overflow-y-auto bg-brand-dark p-4 pb-20">
        <Suspense fallback={<div className="text-center text-gray-400 mt-10"><Loader2 className="animate-spin mx-auto w-8 h-8 text-brand-primary" /><p className="mt-2">Carregando componente...</p></div>}>
          {isLoadingInitialData ? ( // Exibe o loader enquanto os dados iniciais estão sendo carregados
            <div className="text-center text-gray-400 mt-10">
              <Loader2 className="animate-spin mx-auto w-8 h-8 text-brand-primary" />
              <p className="mt-2">Carregando dados iniciais...</p>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard records={records} settings={settings} addOrUpdateRecord={addOrUpdateRecord} deleteRecord={deleteRecord} isPremium={isPremium} />} />
              <Route path="/history" element={<History records={records} deleteRecord={deleteRecord} settings={settings} />} />
              <Route path="/settings" element={<Settings settings={settings} setSettings={setSettings} isPremium={isPremium} />} />
              <Route path="/premium" element={<Premium records={records} settings={settings} isPremium={isPremium} setIsPremium={setIsPremium} />} />
            </Routes>
          )}
        </Suspense>
      </main>
      <footer className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 shadow-lg">
        <nav className="flex justify-around items-center h-16">
          <NavLink end to="/app" className={({ isActive }) => `flex flex-col items-center justify-center w-full text-xs transition-colors ${isActive ? 'text-brand-primary' : 'text-gray-400 hover:text-brand-primary'}`} aria-label="Ir para Início">
            <Home size={24} />
            <span>Início</span>
          </NavLink>
          <NavLink to="/app/history" className={({ isActive }) => `flex flex-col items-center justify-center w-full text-xs transition-colors ${isActive ? 'text-brand-primary' : 'text-gray-400 hover:text-brand-primary'}`} aria-label="Ir para Histórico">
            <Database size={24} />
            <span>Histórico</span>
          </NavLink>
           <NavLink to="/app/premium" className={({ isActive }) => `flex flex-col items-center justify-center w-full text-xs transition-colors ${isActive ? 'text-brand-primary' : 'text-gray-400 hover:text-brand-primary'}`} aria-label="Ir para Premium">
             <div className="relative">
              <Crown size={24} className={isPremium ? 'text-yellow-400' : 'text-brand-accent'} />
              {!isPremium && <span className="absolute -top-2 -right-2 bg-brand-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">PRO</span>}
             </div>
            <span>Premium</span>
          </NavLink>
          <NavLink to="/app/settings" className={({ isActive }) => `flex flex-col items-center justify-center w-full text-xs transition-colors ${isActive ? 'text-brand-primary' : 'text-gray-400 hover:text-brand-primary'}`} aria-label="Ir para Ajustes">
            <SettingsIcon size={24} />
            <span>Ajustes</span>
          </NavLink>
        </nav>
      </footer>
    </div>
  );
};

export default AppLayout;