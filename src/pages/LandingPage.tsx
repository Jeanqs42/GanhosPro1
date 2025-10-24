import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, BarChart2, Smartphone, Apple, Crown, BrainCircuit, FileBarChart2, CalendarDays, Calculator } from 'lucide-react'; // Removido Route, Clock, Download, Android

interface LandingPageProps {
  onEnterApp: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp }) => {
  const navigate = useNavigate();

  const handleEnterAppClick = () => {
    onEnterApp();
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-brand-dark text-brand-light font-sans antialiased">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden bg-gradient-to-br from-brand-dark to-gray-900">
        <div className="absolute inset-0 opacity-20" style={{
          background: `radial-gradient(circle at 20% 30%, rgba(16, 185, 129, 0.1), transparent 40%),
                       radial-gradient(circle at 80% 70%, rgba(245, 158, 11, 0.08), transparent 40%)`
        }}></div>
        <div className="container mx-auto px-4 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="md:w-1/2 text-center md:text-left animate-fade-in-up">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
              <DollarSign size={40} className="text-brand-primary" />
              <h1 className="text-4xl md:text-5xl font-extrabold text-white">GanhosPro</h1>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4 text-white">
              Seu Lucro Real por KM e Hora
            </h2>
            <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-md mx-auto md:mx-0">
              A ferramenta essencial para motoristas de aplicativo transformarem dados de corrida em inteligência financeira.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <button
                onClick={handleEnterAppClick}
                className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105 shadow-lg"
              >
                Entrar no App
              </button>
              <a
                href="#features"
                className="bg-brand-accent hover:opacity-90 text-gray-900 font-bold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105 shadow-lg"
              >
                Saber Mais
              </a>
            </div>
          </div>
          <div className="md:w-1/2 flex justify-center items-center mt-12 md:mt-0 animate-fade-in-up delay-200">
            <div className="relative w-64 h-auto aspect-[9/18] bg-gray-800 rounded-[2.5rem] border-[10px] border-gray-700 shadow-2xl p-2 transform rotate-y-[-15deg] rotate-x-[10deg] transition-transform duration-500 hover:rotate-y-0 hover:rotate-x-0">
              <div className="w-full h-full bg-gray-900 rounded-[2rem] p-4 flex flex-col">
                <div className="text-center text-brand-primary font-semibold text-xl mb-4">GanhosPro</div>
                <div className="bg-gray-700 rounded-xl p-3 text-center mb-3">
                  <p className="text-sm text-gray-400">Lucro Líquido</p>
                  <span className="text-3xl font-bold text-green-400">R$ 125,30</span>
                </div>
                <div className="grid grid-cols-2 gap-2 flex-grow">
                  <div className="bg-gray-700 rounded-xl p-2 text-center">
                    <p className="text-xs text-gray-400">Lucro/KM</p>
                    <span className="text-lg font-bold text-green-400">R$ 0,70</span>
                  </div>
                  <div className="bg-gray-700 rounded-xl p-2 text-center">
                    <p className="text-xs text-gray-400">KM Rodados</p>
                    <span className="text-lg font-bold text-blue-400">180 km</span>
                  </div>
                  <div className="bg-gray-700 rounded-xl p-2 text-center">
                    <p className="text-xs text-gray-400">Ganhos Brutos</p>
                    <span className="text-lg font-bold text-yellow-400">R$ 250,00</span>
                  </div>
                  <div className="bg-gray-700 rounded-xl p-2 text-center">
                    <p className="text-xs text-gray-400">Horas</p>
                    <span className="text-lg font-bold text-purple-400">8.5h</span>
                  </div>
                </div>
                <p className="mt-auto text-center text-gray-600 text-xs font-semibold select-none">GanhosPro</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24 bg-gray-900">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-brand-primary">Recursos que Impulsionam seu Lucro</h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-12">
            Ferramentas poderosas para você ter controle total sobre suas finanças e otimizar cada corrida.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 hover:border-brand-primary transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-primary/10 text-brand-primary mx-auto mb-6">
                <Calculator size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Calculadora Diária Inteligente</h3>
              <p className="text-gray-400">Calcule seu lucro líquido por KM e por hora em segundos, considerando todos os seus custos.</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 hover:border-brand-primary transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-primary/10 text-brand-primary mx-auto mb-6">
                <BarChart2 size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Histórico Detalhado</h3>
              <p className="text-gray-400">Acompanhe todas as suas corridas, visualize tendências e exporte seus dados para análise.</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 hover:border-brand-accent transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-accent/10 text-brand-accent mx-auto mb-6">
                <Crown size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Recursos Premium (IA)</h3>
              <p className="text-gray-400">Desbloqueie análises avançadas com IA, relatórios inteligentes e muito mais para maximizar seus ganhos.</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 hover:border-brand-accent transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-accent/10 text-brand-accent mx-auto mb-6">
                <BrainCircuit size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Insights Personalizados</h3>
              <p className="text-gray-400">Receba dicas e análises da nossa IA para otimizar suas rotas e horários de trabalho.</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 hover:border-brand-accent transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-accent/10 text-brand-accent mx-auto mb-6">
                <FileBarChart2 size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Relatórios e Gráficos</h3>
              <p className="text-gray-400">Visualize seu desempenho com gráficos claros e relatórios detalhados por período.</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 hover:border-brand-accent transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-accent/10 text-brand-accent mx-auto mb-6">
                <CalendarDays size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Análise Periódica</h3>
              <p className="text-gray-400">Compare seus ganhos, custos e lucros em gráficos semanais, mensais ou anuais.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Install Section */}
      <section className="py-16 md:py-24 bg-brand-dark">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-brand-primary">Instale o GanhosPro</h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-12">
            Acesse o aplicativo diretamente do seu navegador ou instale-o em seu dispositivo.
          </p>
          <div className="flex flex-col md:flex-row gap-8 justify-center">
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700 w-full md:max-w-sm">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-lime-400/10 text-lime-400 mx-auto mb-6">
                <Smartphone size={32} />
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-white">Android</h3>
              <ol className="list-decimal list-inside text-left text-gray-400 space-y-2">
                <li>Abra o GanhosPro no Chrome.</li>
                <li>Toque no menu (três pontos) no canto superior direito.</li>
                <li>Selecione "Adicionar à tela inicial" ou "Instalar aplicativo".</li>
                <li>Confirme a instalação.</li>
              </ol>
            </div>
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700 w-full md:max-w-sm">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-400/10 text-blue-400 mx-auto mb-6">
                <Apple size={32} />
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-white">iOS</h3>
              <ol className="list-decimal list-inside text-left text-gray-400 space-y-2">
                <li>Abra o GanhosPro no Safari.</li>
                <li>Toque no ícone de "Compartilhar" (quadrado com seta para cima).</li>
                <li>Selecione "Adicionar à Tela de Início".</li>
                <li>Confirme a adição.</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-brand-secondary to-brand-primary text-center text-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Pronto para Maximizar seus Ganhos?</h2>
          <p className="text-lg md:text-xl mb-8 opacity-90">
            Comece a usar o GanhosPro hoje e transforme a forma como você gerencia suas corridas.
          </p>
          <button
            onClick={handleEnterAppClick}
            className="bg-white hover:bg-gray-100 text-brand-dark font-bold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105 shadow-lg"
          >
            <span className="flex items-center justify-center">
              <Smartphone size={24} className="mr-2" />
              Acessar o Aplicativo
            </span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-8 text-center text-gray-400 text-sm">
        <div className="container mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} GanhosPro. Todos os direitos reservados.</p>
          <p className="mt-2">Feito com paixão para motoristas de aplicativo.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;