import { GoogleGenAI } from "@google/genai";
import { RunRecord, AppSettings } from '../types';

// Validação e leitura da API Key (Vite)
const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY;
console.log("GEMINI_API_KEY lida em geminiService:", apiKey ? "[definida]" : "[NÃO DEFINIDA]");
const ai: GoogleGenAI | null = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const analyzeRecords = async (records: RunRecord[], settings: AppSettings): Promise<string> => {
    if (!apiKey || !ai) {
        throw new Error("Chave de API do Gemini não configurada. Defina GEMINI_API_KEY em .env.local.");
    }

    const recordsSummary = records.map(r => {
        const date = new Date(r.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        const carCost = r.kmDriven * settings.costPerKm;
        const netProfit = r.totalEarnings - (r.additionalCosts || 0) - carCost;
        return `- Data: ${date}, Ganhos: R$${r.totalEarnings.toFixed(2)}, KM: ${r.kmDriven.toFixed(1)}, Lucro Líquido: R$${netProfit.toFixed(2)}`;
    }).join('\n');

    const prompt = `
        Você é um assistente financeiro especializado em analisar dados de motoristas de aplicativo.
        Analise os seguintes registros de ganhos de um motorista. O custo por KM configurado é de R$${settings.costPerKm.toFixed(2)}.

        Registros:
        ${recordsSummary}

        Com base nesses dados, forneça uma análise concisa e útil. Inclua:
        1.  Um resumo geral do desempenho (Média de lucro líquido diário, média de R$/KM rodado líquido).
        2.  Identifique o dia mais lucrativo e o menos lucrativo.
        3.  Ofereça 2-3 dicas práticas e acionáveis para que o motorista possa aumentar seus lucros, com base nos dados fornecidos.

        Formate sua resposta de forma clara e amigável. Use bullets points para as dicas.
    `;

    try {
        const model = ai!.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Usando operador de asserção de não-nulo
        const result = await model.generateContent(prompt);
        const response = result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini API error in analyzeRecords:", error);
        throw new Error("Falha ao comunicar com o serviço de IA. Verifique sua chave de API e tente novamente.");
    }
};

export const getChatFollowUp = async (
  originalAnalysis: string,
  chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[],
  userQuestion: string,
  records: RunRecord[], // Novo parâmetro
  settings: AppSettings // Novo parâmetro
): Promise<string> => {
    if (!apiKey || !ai) {
        throw new Error("Chave de API do Gemini não configurada. Defina GEMINI_API_KEY em .env.local.");
    }

    // Prepare um contexto detalhado para a IA, incluindo registros brutos e configurações
    const detailedContext = `
        Você é um assistente financeiro especializado em analisar dados de motoristas de aplicativo.
        Aqui está a análise original que você forneceu:
        ${originalAnalysis}

        E aqui estão os dados brutos dos registros do motorista, juntamente com as configurações atuais:
        Configurações: Custo por KM = R$${settings.costPerKm.toFixed(2)}
        Registros Detalhados:
        ${records.map(r => `- Data: ${new Date(r.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}, Ganhos: R$${r.totalEarnings.toFixed(2)}, KM: ${r.kmDriven.toFixed(1)}, Horas: ${r.hoursWorked?.toFixed(1) || 'N/A'}, Custos Adicionais: R$${r.additionalCosts?.toFixed(2) || '0.00'}`).join('\n')}
    `;

    const history = [
        { role: 'user' as const, parts: [{ text: detailedContext }] },
        { role: 'model' as const, parts: [{ text: "Entendido. Tenho acesso à análise original, aos dados brutos dos registros e às configurações. Estou pronto para responder perguntas detalhadas." }] },
        ...chatHistory.slice(0, -1), // Envia o histórico sem a última mensagem do usuário, que será a 'userQuestion'
    ];

    try {
        const chat = ai!.getGenerativeModel({ model: 'gemini-1.5-flash' }).startChat({ // Usando operador de asserção de não-nulo
            history: history,
            generationConfig: {
                temperature: 0.7, // Permite respostas um pouco mais variadas
            },
            safetySettings: [ // Configurações de segurança para evitar respostas inadequadas
                {
                    category: 'HARM_CATEGORY_HARASSMENT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_HATE_SPEECH',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                    threshold: 'BLOCK_NONE',
                },
            ],
        });
        const result = await chat.sendMessage(userQuestion);
        const response = result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini API error in getChatFollowUp:", error);
        throw new Error("Falha ao comunicar com o serviço de IA para o chat.");
    }
};


export const getIntelligentReportAnalysis = async (
  reportData: { date: string; value: number; metric: string; unit: string }[],
  metricLabel: string
): Promise<string> => {
  if (!apiKey || !ai) {
    throw new Error("Chave de API do Gemini não configurada. Defina GEMINI_API_KEY em .env.local.");
  }

  const dataSummary = reportData
    .map(d => `Data: ${d.date}, Valor: ${d.value.toFixed(2)} ${d.unit}`)
    .join('\n');

  const prompt = `
    Você é um assistente financeiro conciso.
    Analise os seguintes dados de um relatório personalizado de um motorista de aplicativo sobre a métrica "${metricLabel}".

    Dados do Relatório:
    ${dataSummary}

    Forneça um feedback de UMA frase ou no máximo duas, resumindo o desempenho ou destacando um ponto importante (como o melhor dia ou uma tendência).
    Seja extremamente direto e objetivo. Exemplo: "Seu desempenho teve um pico no dia X, mas mostrou uma queda nos dias seguintes." ou "Sua média de ${metricLabel} se manteve estável durante o período."
  `;

  try {
    const model = ai!.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Usando operador de asserção de não-nulo
    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini API error in getIntelligentReportAnalysis:", error);
    throw new Error("Falha ao gerar o insight para o relatório.");
  }
};