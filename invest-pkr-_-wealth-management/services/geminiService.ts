
import { GoogleGenAI } from "@google/genai";

// Fix: Ensure GoogleGenAI is initialized correctly and follow best practices for model interaction.
export const getFinancialAdvice = async (balance: number, totalInvested: number) => {
  // Always create a new instance inside the function to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an AI financial advisor for 'INVEST PKR', a VIP investment platform. 
      The user currently has a balance of Rs. ${balance} and has invested Rs. ${totalInvested}.
      Provide a short, 2-sentence encouraging advice on how to grow their portfolio using VIP tiers.`,
      config: {
        temperature: 0.7,
        // Removed maxOutputTokens to ensure consistency with thinkingBudget requirements and avoid potential response blocking.
      }
    });
    return response.text;
  } catch (error) {
    console.error("AI Advice Error:", error);
    return "Keep investing in higher VIP tiers to maximize your daily passive income!";
  }
};

export const getChatResponse = async (userMessage: string, balance: number) => {
  // Always create a new instance inside the function to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `System: You are an expert investment consultant for INVEST PKR. User balance: Rs. ${balance}.
      User: ${userMessage}`,
      config: {
        temperature: 0.8,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Chat Error:", error);
    return "I'm currently optimizing my algorithms. How can I help you with your VIP plans today?";
  }
};
