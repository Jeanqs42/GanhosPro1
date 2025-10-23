import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { Database, Settings as SettingsIcon, Crown, Home } from 'lucide-react';
import Dashboard from './Dashboard';
import History from './History';
import Settings from './Settings';
import Premium from './Premium';
import { RunRecord, AppSettings } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';

const AppLayout: React.FC = () => {
  const [records, setRecords] = useLocalStorage<RunRecord[]>('ganhospro_records', []);
  const [settings, setSettings] = useLocalStorage<AppSettings>('ganhospro_settings', { costPerKm: 0.75 });
  const [isPremium, setIsPremium] = useLocalStorage<boolean>('ganhospro_is_premium', false);

  const addOrUpdateRecord = (record: RunRecord) => {
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
  };

  const deleteRecord = (id: string) => {
    setRecords(prevRecords => prevRecords.filter(r => r.id !== id));
  };

  return (
    <div className="flex flex-col h-screen font-sans">
      <main className="flex-grow overflow-y-auto bg-brand-dark p-4 pb-20">
        <Routes>
          <Route path="/" element={<Dashboard records={records} settings={settings} addOrUpdateRecord={addOrUpdateRecord} deleteRecord={deleteRecord} isPremium={isPremium} />} />
          <Route path="/history" element={<History records={records} deleteRecord={deleteRecord} settings={settings} />} />
          <Route path="/settings" element={<Settings settings={settings} setSettings={setSettings} isPremium={isPremium} />} />
          <Route path="/premium" element={<Premium records={records} settings={settings} isPremium={isPremium} setIsPremium={setIsPremium} setSettings={setSettings} />} />
        </Routes>
      </main>
      <footer className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 shadow-lg">
        <nav className="flex justify-around items-center h-16">
          <NavLink end to="/" className={({ isActive }) => `flex flex-col items-center justify-center w-full text-xs transition-colors ${isActive ? 'text-brand-primary' : 'text-gray-400 hover:text-brand-primary'}`}>
            <Home size={24} />
            <span>Início</span>
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `flex flex-col items-center justify-center w-full text-xs transition-colors ${isActive ? 'text-brand-primary' : 'text-gray-400 hover:text-brand-primary'}`}>
            <Database size={24} />
            <span>Histórico</span>
          </NavLink>
           <NavLink to="/premium" className={({ isActive }) => `flex flex-col items-center justify-center w-full text-xs transition-colors ${isActive ? 'text-brand-primary' : 'text-gray-400 hover:text-brand-primary'}`}>
             <div className="relative">
              <Crown size={24} className={isPremium ? 'text-yellow-400' : 'text-brand-accent'} />
              {!isPremium && <span className="absolute -top-2 -right-2 bg-brand-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">PRO</span>}
             </div>
            <span>Premium</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `flex flex-col items-center justify-center w-full text-xs transition-colors ${isActive ? 'text-brand-primary' : 'text-gray-400 hover:text-brand-primary'}`}>
            <SettingsIcon size={24} />
            <span>Ajustes</span>
          </NavLink>
        </nav>
      </footer>
    </div>
  );
};

export default AppLayout;