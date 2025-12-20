
import { GoogleGenAI, Type } from "@google/genai";
import { Platform, Tone, GenerationResult, AIModel } from "../types";

export interface ImagePart {
  inlineData: {
    data: string;
    mimeType: string;
  }
}

/**
 * 建立一個穩定的 Google Maps 搜尋連結作為備案。
 */
function createFallbackUrl(name: string): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(name)}`;
}

export const generateSocialContent = async (
  imageParts: ImagePart[],
  platforms: Platform[],
  tone: Tone,
  customStyle: string,
  details: {
    locationName: string;
    highlights: string;
    feelings: string;
  },
  model: AIModel = AIModel.GEMINI_3_FLASH,
  userLocation?: { lat: number; lng: number }
): Promise<GenerationResult> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key 未設定。");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const platformNames = platforms.join(', ');
    const extraStyleInstruction = customStyle 
      ? `\n⚠️ 【用戶專屬風格 - 優先度最高】\n"${customStyle}"\n` 
      : "";

    const isGemini25 = model.includes('2.5');
    const tool = isGemini25 ? { googleMaps: {} } : { googleSearch: {} };

    // 定義 JSON Schema
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        analysis: {
          type: Type.OBJECT,
          properties: {
            detectedName: { type: Type.STRING },
            confidence: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
            evidence: { type: Type.STRING },
            mapsUrl: { type: Type.STRING }
          },
          required: ["detectedName", "confidence", "evidence", "mapsUrl"]
        },
        posts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              platform: { type: Type.STRING },
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              hashtags: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["platform", "content", "hashtags"]
          }
        }
      },
      required: ["analysis", "posts"]
    };

    const systemInstruction = `
      你是一位多才多藝的旅遊專家。
      
      【內容禁令：非常重要】
      1. 嚴禁使用 Markdown 標題符號 (例如 ###, ##, #)。
      2. 嚴禁使用 Markdown 粗體符號 (如 **text**)。
      3. 若需區分段落或標題，請直接使用全形括號或裝飾符號，例如：【必看亮點】、｜景點特色｜、◆ 交通建議。
      
      【撰寫策略】
      - Instagram/Threads/Facebook：活潑、Emoji 豐富、具吸引力，100-300字。
      - Fanggezi (方格子) / Pixnet (痞客邦)：深度長文 (600字+)，具文學性與細節。

      【技術規範】
      - 內容中使用 \\n 進行換行。
    `;

    const prompt = `
      任務：
      1. 分析照片地點。地點：${details.locationName || "自動偵測"}。座標：${userLocation ? `${userLocation.lat}, ${userLocation.lng}` : "無"}。
      2. 撰寫平台：${platformNames}。風格：${tone}。${extraStyleInstruction}
      3. 行程亮點：${details.highlights || "依照片發揮"}。個人感受：${details.feelings || "依照片發揮"}。
      
      請在文案中精確使用大量 Emoji，並確保完全不出現 ### 符號。
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [...imageParts, { text: prompt }]
      },
      config: {
        systemInstruction,
        tools: [tool],
        responseMimeType: "application/json",
        responseSchema
      },
    });

    const text = response.text;
    if (!text) throw new Error("AI 未能產生內容。");

    try {
      const parsedResult = JSON.parse(text) as GenerationResult;
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      let verifiedUrl = "";
      if (groundingChunks && groundingChunks.length > 0) {
        const firstSource = groundingChunks.find((c: any) => c.maps?.uri || c.web?.uri);
        verifiedUrl = firstSource?.maps?.uri || firstSource?.web?.uri || "";
      }

      if (verifiedUrl) parsedResult.analysis.mapsUrl = verifiedUrl;
      else if (!parsedResult.analysis.mapsUrl) parsedResult.analysis.mapsUrl = createFallbackUrl(parsedResult.analysis.detectedName);

      parsedResult.posts = parsedResult.posts.map(post => ({
        ...post,
        content: post.content.replace(/\\n/g, '\n').replace(/#/g, '') // 雙重保險過濾 #
      }));

      return parsedResult;
    } catch (parseError) {
      throw new Error("格式解析錯誤，請重試。");
    }
  } catch (error: any) {
    throw error;
  }
};
