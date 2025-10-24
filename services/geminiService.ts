import { GoogleGenerativeAI } from "@google/generative-ai";
import { RunRecord, AppSettings } from '../types';

// Validação e leitura da API Key (Vite)
const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY;
console.log("GEMINI_API_KEY lida em geminiService:", apiKey ? "[definida]" : "[NÃO DEFINIDA]");

// Instancia GoogleGenerativeAI diretamente
const ai = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const analyzeRecords = async (records: RunRecord[], settings: AppSettings): Promise<string> => {
    if (!apiKey || !ai) {
        console.error("GEMINI_API_KEY is not configured for analyzeRecords.");
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
        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: "Você é um especialista em finanças para motoristas de aplicativo. Seja direto, use a moeda Real (R$) e a métrica de quilômetros (KM)." });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error: any) {
        console.error("Gemini API error in analyzeRecords:", error);
        if (error.message && error.message.includes("API_KEY_INVALID")) {
            throw new Error("Chave de API do Gemini inválida. Verifique sua chave em .env.local.");
        } else if (error.message && error.message.includes("RESOURCE_EXHAUSTED")) {
            throw new Error("Limite de uso da API do Gemini atingido. Tente novamente mais tarde.");
        } else if (error.message && error.message.includes("NETWORK_ERROR")) {
            throw new Error("Erro de rede ao conectar com a IA. Verifique sua conexão.");
        }
        throw new Error(`Falha ao comunicar com o serviço de IA para a análise: ${error.message || 'Erro desconhecido'}`);
    }
};

export const getChatFollowUp = async (
  records: RunRecord[],
  settings: AppSettings,
  fullChatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[]
): Promise<string> => {
    if (!apiKey || !ai) {
        console.error("GEMINI_API_KEY is not configured for getChatFollowUp.");
        throw new Error("Chave de API do Gemini não configurada. Defina GEMINI_API_KEY em .env.local.");
    }

    const recordsSummary = records.map(r => {
        const date = new Date(r.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        const carCost = r.kmDriven * settings.costPerKm;
        const netProfit = r.totalEarnings - (r.additionalCosts || 0) - carCost;
        return `- Data: ${date}, Ganhos: R$${r.totalEarnings.toFixed(2)}, KM: ${r.kmDriven.toFixed(1)}, Lucro Líquido: R$${netProfit.toFixed(2)}, Horas Trabalhadas: ${r.hoursWorked?.toFixed(1) || 'N/A'}, Custos Adicionais: R$${(r.additionalCosts || 0).toFixed(2)}`;
    }).join('\n');

    const contextMessage = {
        role: 'user' as const,
        parts: [{ text: `Aqui estão todos os registros de corrida do usuário e suas configurações. Use-os para responder às perguntas de forma detalhada, se necessário. Custo por KM: R$${settings.costPerKm.toFixed(2)}\n\nRegistros:\n${recordsSummary}` }]
    };

    const latestUserMessage = fullChatHistory[fullChatHistory.length - 1];
    const conversationHistoryForGemini = fullChatHistory.slice(0, -1);

    const historyForChat = [
        contextMessage,
        ...conversationHistoryForGemini,
    ];

    try {
        const model = ai!.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const chat = model.startChat({
            history: historyForChat,
            systemInstruction: "Você é um especialista em finanças para motoristas de aplicativo. Responda às perguntas do usuário de forma curta e direta, usando os dados fornecidos e o histórico da conversa. Se a pergunta exigir detalhes específicos dos registros, consulte-os."
        });
        const result = await chat.sendMessage(latestUserMessage.parts[0].text);
        const response = await result.response;
        return response.text();
    } catch (error: any) {
        console.error("Gemini API error in getChatFollowUp:", error);
        if (error.message && error.message.includes("API_KEY_INVALID")) {
            throw new Error("Chave de API do Gemini inválida. Verifique sua chave em .env.local.");
        } else if (error.message && error.message.includes("RESOURCE_EXHAUSTED")) {
            throw new Error("Limite de uso da API do Gemini atingido. Tente novamente mais tarde.");
        } else if (error.message && error.message.includes("NETWORK_ERROR")) {
            throw new Error("Erro de rede ao conectar com a IA. Verifique sua conexão.");
        }
        throw new Error(`Falha ao comunicar com o serviço de IA para o chat: ${error.message || 'Erro desconhecido'}`);
    }
};


export const getIntelligentReportAnalysis = async (
  reportData: { date: string; value: number; metric: string; unit: string }[],
  metricLabel: string
): Promise<string> => {
  if (!apiKey || !ai) {
    console.error("GEMINI_API_KEY is not configured for getIntelligentReportAnalysis.");
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
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: "Seja um especialista financeiro que fornece insights rápidos e diretos. Use a moeda Real (R$) e a métrica de quilômetros (KM)." });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error("Gemini API error in getIntelligentReportAnalysis:", error);
    if (error.message && error.message.includes("API_KEY_INVALID")) {
            throw new Error("Chave de API do Gemini inválida. Verifique sua chave em .env.local.");
        } else if (error.message && error.message.includes("RESOURCE_EXHAUSTED")) {
            throw new Error("Limite de uso da API do Gemini atingido. Tente novamente mais tarde.");
        } else if (error.message && error.message.includes("NETWORK_ERROR")) {
            throw new Error("Erro de rede ao conectar com a IA. Verifique sua conexão.");
        }
    throw new Error(`Falha ao gerar o insight para o relatório: ${error.message || 'Erro desconhecido'}`);
  }
};