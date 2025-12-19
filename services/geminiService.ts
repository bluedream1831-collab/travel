import { GoogleGenAI } from "@google/genai";
import { Platform, Tone, GenerationResult, AIModel } from "../types";

export interface ImagePart {
  inlineData: {
    data: string;
    mimeType: string;
  }
}

/**
 * Utility to extract JSON from a string that might contain text around it.
 */
function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }
  return text;
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
      ? `\n⚠️ 【用戶客製化風格】\n請務必遵循：${customStyle}\n` 
      : "";

    // Determine which tool to use based on the model
    const isGemini25 = model.includes('2.5');
    const tool = isGemini25 ? { googleMaps: {} } : { googleSearch: {} };

    const systemInstruction = `
      你是一位專業的旅遊社群媒體經營者。
      
      【地點偵測與資訊檢索】
      1. 使用你擁有的工具 (${isGemini25 ? 'Google Maps' : 'Google Search'}) 來驗證地點。
      2. 分析照片中的招牌、地標、建築。
      3. ${isGemini25 ? '請務必在地圖上找到具體名稱。' : '請搜尋該地點最新的旅遊評價與資訊。'}

      【輸出規範】
      - 禁止使用 Markdown 標題或粗體。
      - 僅輸出純 JSON。
      - 格式範例：
      {
        "analysis": {
          "detectedName": "名稱",
          "confidence": "HIGH",
          "evidence": "原因",
          "mapsUrl": "Google Maps 或 參考網址"
        },
        "posts": [
          {
            "platform": "Instagram",
            "content": "內容",
            "hashtags": ["標籤"]
          }
        ]
      }
    `;

    const prompt = `
      任務：
      1. 分析照片地點。座標參考：${userLocation ? `${userLocation.lat}, ${userLocation.lng}` : "無"}。用戶提供：${details.locationName || "未提供"}。
      2. 撰寫貼文：${platformNames}。風格：${tone}。${extraStyleInstruction}
      3. 行程亮點：${details.highlights || "依照片發揮"}。個人感受：${details.feelings || "依照片發揮"}。
      
      請嚴格輸出 JSON。
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
            ...imageParts,
            { text: prompt }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        // Rules: googleMaps/googleSearch incompatible with responseMimeType: 'application/json'
        tools: [tool],
        toolConfig: (isGemini25 && userLocation) ? {
          retrievalConfig: {
            latLng: {
              latitude: userLocation.lat,
              longitude: userLocation.lng
            }
          }
        } : undefined
      },
    });

    const text = response.text;
    if (!text) throw new Error("API 回傳為空");

    // Stronger JSON extraction
    const cleanJson = extractJson(text.trim());

    try {
      const parsedResult = JSON.parse(cleanJson) as GenerationResult;

      // Logic to pull URL from grounding metadata if JSON didn't include it
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks && groundingChunks.length > 0) {
        // Find first available URI from Maps or Search
        const firstSource = groundingChunks.find((c: any) => c.maps?.uri || c.web?.uri);
        if (firstSource && !parsedResult.analysis.mapsUrl) {
          parsedResult.analysis.mapsUrl = firstSource.maps?.uri || firstSource.web?.uri;
        }
      }

      parsedResult.posts = parsedResult.posts.map(post => ({
        ...post,
        content: post.content.replace(/\\n/g, '\n').replace(/\*\*/g, '')
      }));

      return parsedResult;
    } catch (parseError) {
      console.error("Parse Error. Raw Output:", text);
      throw new Error("AI 輸出格式不符合 JSON，請嘗試重新生成。");
    }

  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    throw error;
  }
};