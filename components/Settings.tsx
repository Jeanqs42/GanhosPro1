import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Save, Info, Calculator, Droplet, Zap, Blend, PlusCircle, Car, Wrench, Shield, FileText, Route, Crown, Loader2 } from 'lucide-react';
import { AppSettings } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface SettingsProps {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  isPremium: boolean;
}

const InputField: React.FC<{ 
    icon?: React.ReactNode; 
    label: string; 
    helper?: string; 
    id: string; 
    value: string; 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
    placeholder: string; 
    error?: string; // Novo prop para mensagem de erro
}> = ({ icon, label, helper, id, value, onChange, placeholder, error }) => (
    <div className="mb-3">
        <label htmlFor={id} className="flex items-center text-sm font-medium text-gray-300 mb-1">
            {icon}
            <span className={icon ? "ml-2" : ""}>{label}</span>
            {helper && <span className="ml-1 text-xs text-gray-400">({helper})</span>}
        </label>
        <input
            id={id}
            type="number"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={`w-full bg-gray-700 border rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-primary focus:outline-none transition ${error ? 'border-red-500' : 'border-gray-600'}`}
            step="0.01"
            min="0"
            aria-label={label}
        />
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
);

const Settings: React.FC<SettingsProps> = ({ settings, setSettings, isPremium }) => {
  const navigate = useNavigate();
  const [costPerKm, setCostPerKm] = useState<string>(settings.costPerKm.toString());
  const [activeTab, setActiveTab] = useLocalStorage<'combustion' | 'hybrid' | 'electric'>('settings_active_tab', 'combustion');

  // Fuel calculator states
  const [refuelCost, setRefuelCost] = useLocalStorage<string>('settings_refuel_cost', '');
  const [kmOnRefuel, setKmOnRefuel] = useLocalStorage<string>('settings_km_on_refuel', '');
  const [chargeCost, setChargeCost] = useLocalStorage<string>('settings_charge_cost', '');
  const [autonomy, setAutonomy] = useLocalStorage<string>('settings_autonomy', '');
  const [totalGasolineCost, setTotalGasolineCost] = useLocalStorage<string>('settings_total_gasoline_cost', '');
  const [totalElectricCost, setTotalElectricCost] = useLocalStorage<string>('settings_total_electric_cost', '');
  const [totalKmDriven, setTotalKmDriven] = useLocalStorage<string>('settings_total_km_driven', '');
  
  // Advanced calculator states
  const [advancedCosts, setAdvancedCosts] = useLocalStorage<{
    vehicle: string;
    maintenance: string;
    insurance: string;
    taxes: string;
    others: string;
    monthlyKm: string;
  }>('settings_advanced_costs', {
    vehicle: '',
    maintenance: '',
    insurance: '',
    taxes: '',
    others: '',
    monthlyKm: ''
  });

  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [isCalculatingCost, setIsCalculatingCost] = useState<boolean>(false);

  // Estados para erros de validação
  const [errors, setErrors] = useState<{
    costPerKm?: string;
    refuelCost?: string;
    kmOnRefuel?: string;
    chargeCost?: string;
    autonomy?: string;
    totalGasolineCost?: string;
    totalElectricCost?: string;
    totalKmDriven?: string;
    vehicle?: string;
    maintenance?: string;
    insurance?: string;
    taxes?: string;
    others?: string;
    monthlyKm?: string;
  }>({});

  const validateCostPerKm = () => {
    const cost = parseFloat(costPerKm);
    if (isNaN(cost) || cost < 0) {
      setErrors(prev => ({ ...prev, costPerKm: 'Por favor, insira um valor válido e não negativo para o custo por KM.' }));
      return false;
    }
    setErrors(prev => ({ ...prev, costPerKm: undefined }));
    return true;
  };

  const validateFuelCalculator = () => {
    const newErrors: typeof errors = {};
    let isValid = true;

    if (activeTab === 'combustion') {
      const refuelCostVal = parseFloat(refuelCost);
      const kmOnRefuelVal = parseFloat(kmOnRefuel);
      if (isNaN(refuelCostVal) || refuelCostVal <= 0) { newErrors.refuelCost = 'Valor do Abastecimento é obrigatório e deve ser maior que zero.'; isValid = false; }
      if (isNaN(kmOnRefuelVal) || kmOnRefuelVal <= 0) { newErrors.kmOnRefuel = 'KM Rodados é obrigatório e deve ser maior que zero.'; isValid = false; }
    } else if (activeTab === 'electric') {
      const chargeCostVal = parseFloat(chargeCost);
      const autonomyVal = parseFloat(autonomy);
      if (isNaN(chargeCostVal) || chargeCostVal < 0) { newErrors.chargeCost = 'Custo da Recarga Completa é obrigatório e não pode ser negativo.'; isValid = false; }
      if (isNaN(autonomyVal) || autonomyVal <= 0) { newErrors.autonomy = 'Autonomia é obrigatória e deve ser maior que zero.'; isValid = false; }
    } else if (activeTab === 'hybrid') {
      const totalGasolineCostVal = parseFloat(totalGasolineCost);
      const totalElectricCostVal = parseFloat(totalElectricCost);
      const totalKmDrivenVal = parseFloat(totalKmDriven);
      if (isNaN(totalGasolineCostVal) || totalGasolineCostVal < 0) { newErrors.totalGasolineCost = 'Gasto Total com Combustível é obrigatório e não pode ser negativo.'; isValid = false; }
      if (isNaN(totalElectricCostVal) || totalElectricCostVal < 0) { newErrors.totalElectricCost = 'Gasto Total com Eletricidade é obrigatório e não pode ser negativo.'; isValid = false; }
      if (isNaN(totalKmDrivenVal) || totalKmDrivenVal <= 0) { newErrors.totalKmDriven = 'Total de KM Rodados é obrigatório e deve ser maior que zero.'; isValid = false; }
    }
    setErrors(prev => ({ ...prev, ...newErrors }));
    return isValid;
  };

  const validateAdvancedCosts = () => {
    const newErrors: typeof errors = {};
    let isValid = true;

    const { vehicle, maintenance, insurance, taxes, others, monthlyKm: kmString } = advancedCosts;
    const monthlyKm = parseFloat(kmString);

    const anyAdvancedCostFilled = 
      (parseFloat(vehicle) || 0) > 0 || 
      (parseFloat(maintenance) || 0) > 0 || 
      (parseFloat(insurance) || 0) > 0 || 
      (parseFloat(taxes) || 0) > 0 || 
      (parseFloat(others) || 0) > 0;

    if (anyAdvancedCostFilled && (isNaN(monthlyKm) || monthlyKm <= 0)) {
      newErrors.monthlyKm = 'A "Média de KMs Rodados" é obrigatória e deve ser maior que zero ao adicionar outros custos.';
      isValid = false;
    }

    // Validação para garantir que os campos numéricos são válidos e não negativos
    if (vehicle && (isNaN(parseFloat(vehicle)) || parseFloat(vehicle) < 0)) { newErrors.vehicle = 'Valor inválido.'; isValid = false; }
    if (maintenance && (isNaN(parseFloat(maintenance)) || parseFloat(maintenance) < 0)) { newErrors.maintenance = 'Valor inválido.'; isValid = false; }
    if (insurance && (isNaN(parseFloat(insurance)) || parseFloat(insurance) < 0)) { newErrors.insurance = 'Valor inválido.'; isValid = false; }
    if (taxes && (isNaN(parseFloat(taxes)) || parseFloat(taxes) < 0)) { newErrors.taxes = 'Valor inválido.'; isValid = false; }
    if (others && (isNaN(parseFloat(others)) || parseFloat(others) < 0)) { newErrors.others = 'Valor inválido.'; isValid = false; }

    setErrors(prev => ({ ...prev, ...newErrors }));
    return isValid;
  };

  const handleAdvancedCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setAdvancedCosts(prev => ({ ...prev, [id]: value }));
    setErrors(prev => ({ ...prev, [id]: undefined })); // Limpa erro ao digitar
  };

  const handleSave = async () => {
    if (!validateCostPerKm()) {
      toast.error('Por favor, corrija os erros no formulário.');
      return;
    }
    setIsSavingSettings(true);
    const cost = parseFloat(costPerKm);
    setSettings({ costPerKm: cost });
    toast.success('Configurações salvas!');
    setIsSavingSettings(false);
  };

  const calculateAndSetCost = async () => {
    setErrors({}); // Limpa todos os erros antes de validar
    let fuelCostPerKm = 0;
    let advancedCostPerKm = 0;
    let hasFuelInput = false;
    let hasAdvancedInput = false;

    // Validação da calculadora de combustível
    if (activeTab === 'combustion') {
        const refuelCostVal = parseFloat(refuelCost);
        const kmOnRefuelVal = parseFloat(kmOnRefuel);
        if (!isNaN(refuelCostVal) && refuelCostVal > 0 && !isNaN(kmOnRefuelVal) && kmOnRefuelVal > 0) {
            fuelCostPerKm = refuelCostVal / kmOnRefuelVal;
            hasFuelInput = true;
        } else if (refuelCost.trim() !== '' || kmOnRefuel.trim() !== '') { // Se algum campo foi preenchido, mas inválido
            validateFuelCalculator();
            toast.error('Por favor, preencha corretamente os campos da calculadora de combustível.');
            setIsCalculatingCost(false);
            return;
        }
    } else if (activeTab === 'electric') {
        const chargeCostVal = parseFloat(chargeCost);
        const autonomyVal = parseFloat(autonomy);
        if (!isNaN(chargeCostVal) && chargeCostVal >= 0 && !isNaN(autonomyVal) && autonomyVal > 0) {
            fuelCostPerKm = chargeCostVal / autonomyVal;
            hasFuelInput = true;
        } else if (chargeCost.trim() !== '' || autonomy.trim() !== '') {
            validateFuelCalculator();
            toast.error('Por favor, preencha corretamente os campos da calculadora de combustível.');
            setIsCalculatingCost(false);
            return;
        }
    } else if (activeTab === 'hybrid') {
        const totalGasolineCostVal = parseFloat(totalGasolineCost);
        const totalElectricCostVal = parseFloat(totalElectricCost);
        const totalKmDrivenVal = parseFloat(totalKmDriven);
        if (!isNaN(totalGasolineCostVal) && totalGasolineCostVal >= 0 && !isNaN(totalElectricCostVal) && totalElectricCostVal >= 0 && !isNaN(totalKmDrivenVal) && totalKmDrivenVal > 0) {
            fuelCostPerKm = (totalGasolineCostVal + totalElectricCostVal) / totalKmDrivenVal;
            hasFuelInput = true;
        } else if (totalGasolineCost.trim() !== '' || totalElectricCost.trim() !== '' || totalKmDriven.trim() !== '') {
            validateFuelCalculator();
            toast.error('Por favor, preencha corretamente os campos da calculadora de combustível.');
            setIsCalculatingCost(false);
            return;
        }
    }
    
    // Validação de custos avançados (se Premium)
    if (isPremium) {
        const { vehicle, maintenance, insurance, taxes, others, monthlyKm: kmString } = advancedCosts;
        const monthlyKm = parseFloat(kmString) || 0;
        const anyAdvancedCostFilled = (parseFloat(vehicle) || 0) > 0 || (parseFloat(maintenance) || 0) > 0 || (parseFloat(insurance) || 0) > 0 || (parseFloat(taxes) || 0) > 0 || (parseFloat(others) || 0) > 0;

        if (anyAdvancedCostFilled) {
            hasAdvancedInput = true;
            if (!validateAdvancedCosts()) {
                toast.error('Por favor, corrija os erros nos custos fixos e variáveis.');
                setIsCalculatingCost(false);
                return;
            }
            if (monthlyKm > 0) {
                const totalMonthlyAdvancedCost = 
                  (parseFloat(vehicle) || 0) +
                  (parseFloat(maintenance) || 0) +
                  (parseFloat(insurance) || 0) +
                  ((parseFloat(taxes) || 0) / 12) +
                  (parseFloat(others) || 0);
                
                advancedCostPerKm = totalMonthlyAdvancedCost / monthlyKm;
            }
        } else if (monthlyKm > 0) { // Se monthlyKm foi preenchido mas nenhum outro custo avançado
            if (!validateAdvancedCosts()) {
                toast.error('Por favor, corrija os erros nos custos fixos e variáveis.');
                setIsCalculatingCost(false);
                return;
            }
        }
    }
    
    if (!hasFuelInput && !hasAdvancedInput) {
        toast.error('Preencha os campos de pelo menos uma das seções da calculadora para obter um resultado.');
        setIsCalculatingCost(false);
        return;
    }

    setIsCalculatingCost(true);
    const totalCost = fuelCostPerKm + advancedCostPerKm;
    
    const finalCost = totalCost.toFixed(2);
    setCostPerKm(finalCost);
    toast.success(`Custo por KM atualizado para R$ ${finalCost}. Clique em Salvar para confirmar.`);
    setIsCalculatingCost(false);
  };


  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6 text-brand-primary">Ajustes</h1>
      
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl mb-6">
        <label htmlFor="costPerKm" className="block text-sm font-medium text-gray-300 mb-2">
          Custo por KM (R$)
        </label>
        <input
          id="costPerKm"
          type="number"
          value={costPerKm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setCostPerKm(e.target.value); setErrors(prev => ({ ...prev, costPerKm: undefined })); }}
          placeholder="Ex: 0.75"
          className={`w-full bg-gray-700 border rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-primary focus:outline-none transition ${errors.costPerKm ? 'border-red-500' : 'border-gray-600'}`}
          step="0.01"
          min="0"
          aria-label="Custo por KM"
        />
        {errors.costPerKm && <p className="text-red-400 text-xs mt-1">{errors.costPerKm}</p>}
        <button onClick={handleSave} disabled={isSavingSettings} className="w-full mt-4 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-transform transform hover:scale-105" aria-label="Salvar Custo por KM">
          {isSavingSettings ? <Loader2 className="animate-spin mr-2" size={20} /> : <Save size={20} className="mr-2" />}
          {isSavingSettings ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div className="bg-gray-800 p-4 rounded-lg shadow-xl mb-6">
            <h2 className="text-lg font-semibold text-center mb-4 flex items-center justify-center text-brand-light">
                <Calculator size={20} className="mr-2 text-brand-accent" />
                Não sabe seu custo? Calcule aqui!
            </h2>
            <div className="flex border-b border-gray-700 mb-4">
                <button 
                    onClick={() => { setActiveTab('combustion'); setErrors({}); }} 
                    className={`flex-1 py-2 text-sm font-medium flex items-center justify-center transition-colors ${activeTab === 'combustion' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400 hover:text-white'}`}
                    aria-label="Selecionar calculadora de combustão"
                >
                    <Droplet size={16} className="mr-2" /> Combustão
                </button>
                <button 
                    onClick={() => { setActiveTab('hybrid'); setErrors({}); }}
                    className={`flex-1 py-2 text-sm font-medium flex items-center justify-center transition-colors ${activeTab === 'hybrid' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400 hover:text-white'}`}
                    aria-label="Selecionar calculadora de híbrido"
                >
                    <Blend size={16} className="mr-2" /> Híbrido
                </button>
                <button 
                    onClick={() => { setActiveTab('electric'); setErrors({}); }}
                    className={`flex-1 py-2 text-sm font-medium flex items-center justify-center transition-colors ${activeTab === 'electric' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400 hover:text-white'}`}
                    aria-label="Selecionar calculadora de elétrico"
                >
                    <Zap size={16} className="mr-2" /> Elétrico
                </button>
            </div>
            
            <div className="animate-fade-in">
                {activeTab === 'combustion' && (
                    <>
                        <div className="bg-gray-700/50 p-3 rounded-lg text-xs text-center text-gray-300 mb-4">
                        Use os dados do seu último abastecimento para um cálculo preciso.
                        </div>
                        <InputField label="Valor do Abastecimento (R$)" id="refuelCost" value={refuelCost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setRefuelCost(e.target.value); setErrors(prev => ({ ...prev, refuelCost: undefined })); }} placeholder="Ex: 250.00" error={errors.refuelCost} />
                        <InputField label="KM Rodados" id="kmOnRefuel" value={kmOnRefuel} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setKmOnRefuel(e.target.value); setErrors(prev => ({ ...prev, kmOnRefuel: undefined })); }} placeholder="Ex: 450" error={errors.kmOnRefuel} />
                    </>
                )}
                
                {activeTab === 'electric' && (
                    <>
                        <InputField label="Custo da Recarga Completa (R$)" id="chargeCost" value={chargeCost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setChargeCost(e.target.value); setErrors(prev => ({ ...prev, chargeCost: undefined })); }} placeholder="Ex: 40.00" error={errors.chargeCost} />
                        <InputField label="Autonomia com Carga Completa (KM)" id="autonomy" value={autonomy} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setAutonomy(e.target.value); setErrors(prev => ({ ...prev, autonomy: undefined })); }} placeholder="Ex: 350" error={errors.autonomy} />
                    </>
                )}

                {activeTab === 'hybrid' && (
                    <>
                        <InputField label="Gasto Total com Combustível (R$)" id="totalGasolineCost" value={totalGasolineCost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTotalGasolineCost(e.target.value); setErrors(prev => ({ ...prev, totalGasolineCost: undefined })); }} placeholder="Ex: 350.00" error={errors.totalGasolineCost} />
                        <InputField label="Gasto Total com Eletricidade (R$)" id="totalElectricCost" value={totalElectricCost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTotalElectricCost(e.target.value); setErrors(prev => ({ ...prev, totalElectricCost: undefined })); }} placeholder="Ex: 80.00" error={errors.totalElectricCost} />
                        <InputField label="Total de KM Rodados" id="totalKmDriven" value={totalKmDriven} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTotalKmDriven(e.target.value); setErrors(prev => ({ ...prev, totalKmDriven: undefined })); }} placeholder="Ex: 1200" error={errors.totalKmDriven} />
                    </>
                )}
            </div>

            {isPremium ? (
                <div className="animate-fade-in">
                    <hr className="border-gray-600 my-6" />
                    <h3 className="text-lg font-semibold text-center mb-4 flex items-center justify-center text-brand-light">
                        <PlusCircle size={20} className="mr-2 text-brand-accent" />
                        Adicionar Custos Fixos e Variáveis
                    </h3>
                    <div className="space-y-3">
                        <InputField icon={<Car size={18}/>} label="Parcela ou Aluguel" id="vehicle" value={advancedCosts.vehicle} onChange={handleAdvancedCostChange} placeholder="Ex: 1500" helper="mensal" error={errors.vehicle} />
                        <InputField icon={<Wrench size={18}/>} label="Manutenção" id="maintenance" value={advancedCosts.maintenance} onChange={handleAdvancedCostChange} placeholder="Ex: 300" helper="média mensal" error={errors.maintenance} />
                        <InputField icon={<Shield size={18}/>} label="Seguro" id="insurance" value={advancedCosts.insurance} onChange={handleAdvancedCostChange} placeholder="Ex: 250" helper="mensal" error={errors.insurance} />
                        <InputField icon={<FileText size={18}/>} label="Impostos e Licenciamento" id="taxes" value={advancedCosts.taxes} onChange={handleAdvancedCostChange} placeholder="Ex: 1800" helper="anual" error={errors.taxes} />
                        <InputField icon={<PlusCircle size={18}/>} label="Outros Custos" id="others" value={advancedCosts.others} onChange={handleAdvancedCostChange} placeholder="Ex: 100" helper="média mensal" error={errors.others} />
                        <hr className="border-gray-600 my-2" />
                        <InputField icon={<Route size={18}/>} label="Média de KMs Rodados" id="monthlyKm" value={advancedCosts.monthlyKm} onChange={handleAdvancedCostChange} placeholder="Ex: 5000" helper="por mês" error={errors.monthlyKm} />
                    </div>
                </div>
            ) : (
                <div className="mt-6 bg-gray-900/50 p-4 rounded-lg text-center">
                    <p className="font-bold text-yellow-300 flex items-center justify-center"><Crown size={18} className="mr-2"/> Função Premium</p>
                    <p className="text-sm text-gray-300 mt-2 mb-3">
                    Tenha um cálculo completo adicionando custos de manutenção, seguro e mais para um R$/KM ultra preciso.
                    </p>
                    <button onClick={() => navigate('/premium')} className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-2 px-4 rounded-lg text-sm transition-colors" aria-label="Desbloquear com Premium">
                        Desbloquear com Premium
                    </button>
                </div>
            )}


            <button onClick={calculateAndSetCost} disabled={isCalculatingCost} className="w-full mt-6 bg-brand-accent hover:opacity-90 text-gray-900 font-bold py-3 px-4 rounded-lg flex items-center justify-center transition" aria-label={isPremium ? 'Calcular Custo Total e Usar' : 'Calcular Custo e Usar'}>
                {isCalculatingCost ? <Loader2 className="animate-spin mr-2" size={20} /> : null}
                {isCalculatingCost ? 'Calculando...' : (isPremium ? 'Calcular Custo Total e Usar' : 'Calcular Custo e Usar')}
            </button>
      </div>

      <div className="bg-blue-900 border border-blue-700 text-blue-200 px-4 py-3 rounded-lg text-sm flex items-start">
        <Info size={18} className="mr-3 mt-1 flex-shrink-0" />
        <div>
          <strong className="font-bold">Como calcular seu custo por KM?</strong>
          <p className="mt-1">
            Some seus custos mensais com combustível, manutenção, seguro, depreciação e impostos. Divida o total pela quantidade de KMs que você roda em um mês para obter uma estimativa.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;