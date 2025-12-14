import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Platform, Tone, GenerationResult } from "../types";

// Ensure API Key exists before initializing
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API Key is missing!");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "dummy_key_for_build" });

// Defined type for the input we expect from App.tsx
export interface ImagePart {
  inlineData: {
    data: string;
    mimeType: string;
  }
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
  }
): Promise<GenerationResult> => {
  // Runtime check for API Key
  if (!process.env.API_KEY) {
    throw new Error("API Key 未設定。請確認 Vercel 的 Environment Variables 是否已設定 API_KEY。");
  }

  try {
    const platformNames = platforms.join(', ');
    
    // Construct extra style instructions
    const extraStyleInstruction = customStyle 
      ? `\n⚠️ 【用戶客製化風格 (優先級最高)】\n請務必遵循此風格要求：${customStyle}\n語氣需完全符合上述描述。\n` 
      : "";

    const systemInstruction = `
      你是一位專業的旅遊社群媒體經營者 (Social Media Manager) 與 視覺偵探。
      
      你的任務分為兩部分：
      1. **視覺偵探分析**：仔細分析照片中的細節（文字、地標、建築風格、植被）來推斷地點，並給出信心指數。
      2. **文案撰寫**：根據分析結果與用戶提供的資訊，撰寫高品質的社群貼文。

      【絕對格式禁令】
      - 禁止使用 Markdown 標題 (###)。
      - 禁止使用 Markdown 粗體 (**text**)。
      - 請使用 Emoji 進行排版與列點。
    `;

    const prompt = `
      請處理以下任務：

      第一步：【地點偵測分析】
      請根據照片內容推斷地點。
      - 如果看到明確的招牌文字 (OCR)、知名地標 (如台北101)，信心指數為 **HIGH**。
      - 如果依賴建築風格或模糊特徵推測 (如日本神社但不知哪間)，信心指數為 **MEDIUM**。
      - 如果完全無法辨識，只能看出「海邊」或「山上」，信心指數為 **LOW**。
      - 如果用戶有提供「地點/景點名稱」(${details.locationName || "無"})，請以此為準，信心指數設為 **HIGH**，但仍需分析照片是否符合該地點。

      第二步：【文案撰寫】
      目標平台：${platformNames}
      
      【風格設定】
      基礎風格：${tone}
      ${extraStyleInstruction}
      
      【旅遊資訊細節】
      📍 地點：${details.locationName ? details.locationName : "請使用你第一步分析出的地點名稱"}
      ✨ 行程亮點：${details.highlights || "未提供，請根據照片細節發揮"}
      ❤️ 個人感受：${details.feelings || "未提供，請營造適合照片的情境"}

      【各平台撰寫要求】
      1. **Instagram**: 150-250字，輕盈、氛圍感、互動性強。
      2. **Facebook**: 300-500字，像朋友分享故事，口語化。
      3. **Threads**: 500字以內（通常較短），**極度口語化**，適合「碎碎念」或「引發共鳴」的短文。第一句要有梗或吸引人，段落之間要有留白。
      4. **Fanggezi (方格子)**: 600-1000字，深度體驗、文藝感、標題要吸引人。
      5. **Pixnet (痞客邦)**: 600-1000字，實用攻略、SEO導向、條列資訊。

      請依照 JSON 格式回傳，包含「分析結果 (analysis)」與「貼文列表 (posts)」。
    `;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        analysis: {
          type: Type.OBJECT,
          properties: {
            detectedName: { type: Type.STRING, description: "The specific location name inferred from images or user input." },
            confidence: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"], description: "Confidence level of location detection." },
            evidence: { type: Type.STRING, description: "Short explanation of why this location was chosen (e.g., 'Visible sign saying X', 'Famous landmark Y detected')." }
          },
          required: ["detectedName", "confidence", "evidence"]
        },
        posts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              platform: {
                type: Type.STRING,
                enum: Object.values(Platform),
                description: "Target social media platform"
              },
              title: {
                type: Type.STRING,
                description: "Title of the post (Must be provided for Vocus/Facebook/Pixnet). For Threads, leave it empty or use a punchline. NO Markdown allowed."
              },
              content: {
                type: Type.STRING,
                description: "The main body text. Use \\n for line breaks. NO Markdown bold/headers."
              },
              hashtags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of hashtags without #"
              }
            },
            required: ["platform", "content", "hashtags"]
          }
        }
      },
      required: ["analysis", "posts"]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
            ...imageParts,
            { text: prompt }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    if (response.text) {
      let jsonStr = response.text.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (jsonStr.startsWith("```")) {
         jsonStr = jsonStr.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      return JSON.parse(jsonStr) as GenerationResult;
    }
    
    throw new Error("API 回傳內容為空");

  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    if (error instanceof Error) {
        throw error;
    } else {
        throw new Error(JSON.stringify(error));
    }
  }
};