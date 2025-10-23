import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/AppLayout';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/app/*" element={<AppLayout />} />
        <Route path="/*" element={<AppLayout />} /> {/* Alterado para carregar AppLayout diretamente */}
      </Routes>
    </BrowserRouter>
  );
};

export default App;