# Regras para Desenvolvimento do GanhosPro

Este documento descreve a pilha de tecnologia utilizada no projeto GanhosPro e as diretrizes para o uso de bibliotecas, garantindo consistência e boas práticas de desenvolvimento.

## Pilha de Tecnologia

*   **React**: Biblioteca JavaScript para construção de interfaces de usuário.
*   **TypeScript**: Superset do JavaScript que adiciona tipagem estática, melhorando a robustez e manutenibilidade do código.
*   **Tailwind CSS**: Framework CSS utilitário para estilização rápida e responsiva.
*   **React Router DOM**: Biblioteca para roteamento declarativo na aplicação.
*   **Lucide React**: Coleção de ícones leves e personalizáveis.
*   **React Hot Toast**: Biblioteca para exibir notificações de feedback ao usuário.
*   **Recharts**: Biblioteca de gráficos para visualização de dados.
*   **jsPDF & jspdf-autotable**: Utilizadas para geração de documentos PDF.
*   **Google Generative AI**: SDK para integração com modelos de IA do Google, como o Gemini.
*   **Vite**: Ferramenta de build rápida para desenvolvimento front-end.
*   **Progressive Web App (PWA)**: A aplicação é configurada para funcionar offline e ser instalável em dispositivos móveis.
*   **Local Storage**: Utilizado para persistência de dados do usuário no navegador.

## Regras de Uso de Bibliotecas

Para manter a consistência e a eficiência, siga estas regras ao usar as bibliotecas:

*   **Estilização**:
    *   **Tailwind CSS**: Use exclusivamente classes do Tailwind CSS para toda a estilização.
    *   **shadcn/ui**: Prefira os componentes pré-construídos do shadcn/ui sempre que possível para elementos de UI comuns. Se precisar de modificações, crie um novo componente que envolva ou estenda o componente shadcn/ui, em vez de editar os arquivos originais.
*   **Roteamento**: Utilize `react-router-dom` para gerenciar todas as rotas da aplicação. As rotas principais devem ser mantidas em `src/App.tsx`.
*   **Ícones**: Use `lucide-react` para todos os ícones na aplicação.
*   **Notificações**: Para feedback ao usuário (sucesso, erro, informação), utilize `react-hot-toast`.
*   **Gráficos**: Para visualização de dados em gráficos, utilize `recharts`.
*   **Geração de PDF**: Para exportar dados em formato PDF, utilize `jspdf` em conjunto com `jspdf-autotable`.
*   **Integração com IA**: Todas as interações com modelos de IA devem ser feitas através do SDK `@google/generative-ai`.
*   **Persistência de Dados**: Para armazenar dados localmente no navegador, utilize o hook `useLocalStorage` existente.
*   **Estrutura de Arquivos**:
    *   Novos componentes devem ser criados em `src/components/`.
    *   Novas páginas (rotas principais) devem ser criadas em `src/pages/`.
    *   Arquivos de utilitários ou serviços devem ser colocados em `src/utils/` ou `src/services/` respectivamente.
    *   Nomes de diretórios devem ser em minúsculas.