import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import LandingPage from './src/pages/LandingPage'; // CORREÇÃO 7: Caminho de importação corrigido
import { useLocalStorage } from './hooks/useLocalStorage';

const App: React.FC = () => {
  // Estado para verificar se o usuário já visitou a landing page
  const [hasVisitedLanding, setHasVisitedLanding] = useLocalStorage<boolean>('ganhospro_has_visited_landing', false);

  // Função para marcar que o usuário entrou no app
  const handleEnterApp = () => {
    setHasVisitedLanding(true);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Rota para a interface principal do aplicativo */}
        <Route path="/app/*" element={<AppLayout />} />
        
        {/* Rota inicial: exibe a LandingPage ou redireciona para /app */}
        <Route 
          path="/" 
          element={
            hasVisitedLanding ? (
              <Navigate to="/app" replace /> // Se já visitou, vai para o app
            ) : (
              <LandingPage onEnterApp={handleEnterApp} /> // Se não, mostra a landing page
            )
          } 
        />
        
        {/* Redireciona qualquer outra rota não correspondida para a raiz */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;