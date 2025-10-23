import { GoogleGenAI } from "@google/genai";
import { RunRecord, AppSettings } from '../types';

// Validação e leitura da API Key (Vite)
const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY;
console.log("GEMINI_API_KEY lida em geminiService:", apiKey ? "[definida]" : "[NÃO DEFINIDA]");
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

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
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "Você é um especialista em finanças para motoristas de aplicativo. Seja direto, use a moeda Real (R$) e a métrica de quilômetros (KM)."
            }
        });
        return response.text;
    } catch (error) {
        console.error("Gemini API error in analyzeRecords:", error);
        throw new Error("Falha ao comunicar com o serviço de IA. Verifique sua chave de API e tente novamente.");
    }
};

export const getChatFollowUp = async (
  originalAnalysis: string,
  chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[],
  userQuestion: string
): Promise<string> => {
    if (!apiKey || !ai) {
        throw new Error("Chave de API do Gemini não configurada. Defina GEMINI_API_KEY em .env.local.");
    }

    const history = [
        { role: 'user' as const, parts: [{ text: `Esta é a análise original que você me forneceu:\n\n${originalAnalysis}` }] },
        { role: 'model' as const, parts: [{ text: "Entendido. Estou pronto para responder perguntas sobre esta análise." }] },
        ...chatHistory.slice(0, -1), // Send history without the last user message
    ];

    try {
        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: history,
            config: {
                systemInstruction: "Você é um especialista em finanças para motoristas de aplicativo. Responda às perguntas do usuário de forma curta e direta, com base na análise original e no histórico da conversa."
            }
        });
        const response = await chat.sendMessage({ message: userQuestion });
        return response.text;
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "Seja um especialista financeiro que fornece insights rápidos e diretos. Use a moeda Real (R$) e a métrica de quilômetros (KM)."
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API error in getIntelligentReportAnalysis:", error);
    throw new Error("Falha ao gerar o insight para o relatório.");
  }
};