import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Platform, Tone, GeneratedPost } from "../types";

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
): Promise<GeneratedPost[]> => {
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

    // System instruction is more effective for enforcing formatting rules
    const systemInstruction = `
      你是一位專業的旅遊社群媒體經營者 (Social Media Manager)。
      你的任務是根據圖片與資訊，撰寫高品質的社群貼文。

      【絕對格式禁令 (Violation = Failure)】
      你的輸出將被用戶直接複製貼上，因此 **嚴格禁止** 使用任何 Markdown 語法，這會讓版面混亂。
      1. ❌ **禁止使用 Markdown 標題** (如 ###, ##, #)。
         - ✅ 正確：【京都之旅】 或 🇯🇵 京都之旅
         - ❌ 錯誤：### 京都之旅
      2. ❌ **禁止使用 Markdown 粗體/斜體** (如 **文字**, *文字*)。
         - ✅ 正確：這真的「太好吃了」 / 這真的 ✨太好吃了✨
         - ❌ 錯誤：這真的**太好吃了**
      3. ❌ **禁止使用 Markdown 列點** (如 -, *)。
         - ✅ 正確：使用 Emoji 作為列點 (如 🔸, 📍, 👉, ✨)。
      
      請確保產出的內容是「純文字 (Plain Text) + Emoji」，美觀且易讀。
    `;

    const prompt = `
      請分析我上傳的旅遊照片（視覺內容、氛圍、地點線索），並為我撰寫適合以下平台的文案：${platformNames}。
      
      【風格設定】
      基礎風格：${tone}
      ${extraStyleInstruction}
      
      【旅遊資訊細節】
      📍 地點/景點：${details.locationName || "未提供，請根據照片或上下文推斷"}
      ✨ 行程亮點 (美食、設施、記憶點)：${details.highlights || "未提供，請根據照片細節發揮"}
      ❤️ 個人感受 (氛圍、心得)：${details.feelings || "未提供，請營造適合照片的情境"}

      【各平台撰寫要求】
      請將上述資訊自然地融入文章中，不要生硬地條列。

      1. **Instagram 版 (視覺與氛圍導向)**
         - **重點**：營造「當下的感覺」，文字要輕盈、有畫面感。
         - **字數**：150-250 字。
         - **結構**：
           - 一句吸引人的心情開場 (Hook)。
           - 簡短描述照片中的亮點或小故事（融入使用者提供的亮點與感受）。
           - 結尾引導互動（例如：「你也有來過這裡嗎？」）。
         - **Hashtags**：提供 10-15 個熱門且精準的標籤。

      2. **Facebook 版 (社群與故事導向)**
         - **重點**：像在跟老朋友分享故事，口語化，引起共鳴。
         - **字數**：300-500 字。
         - **結構**：
           - 生活化的標題 (記得用【】或 Emoji，勿用 #)。
           - 完整的旅遊小故事（發生了什麼趣事？遇到了誰？）。
           - 包含 1-2 個實用的旅遊建議。
           - 結尾開放式問句。
         - **Hashtags**：3-5 個 Hashtags。

      3. **Fanggezi (方格子) 版 (深度旅遊/散文導向)**
         - **重點**：深度體驗、心靈省思、人文觀察，文字優美，適合閱讀。
         - **字數**：600-1000 字。
         - **結構**：
           - **文章標題**：具吸引力且帶有文藝感的標題。
           - **前言**：旅行的動機與背景。
           - **核心段落**：景點深度描寫、旅行反思。
           - **結語**：這趟旅行帶來的意義。
         - **Hashtags**：5-8 個關鍵字。

      4. **Pixnet (痞客邦) 版 (實用攻略/SEO 導向)**
         - **重點**：懶人包風格、資訊量大、強調「必吃/必去/交通」，方便搜尋引擎抓取。
         - **字數**：600-1000 字。
         - **結構**：
           - **吸睛標題**：包含具體地點 + 強力關鍵字 (e.g., 2024必去、懶人包、交通攻略)。
           - **前言**：快速破題 (這篇要介紹什麼)。
           - **詳細介紹**：分段清楚，強調特色與體驗。
           - **實用資訊欄 (Info Box)**：務必列出地址、營業時間、交通方式 (請用 Emoji 🔸 列點)。
         - **Hashtags**：8-10 個高搜尋量關鍵字。

      請直接依照 JSON 格式回傳結果。
    `;

    const responseSchema: Schema = {
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
            description: "Title of the post (Must be provided for Vocus/Facebook/Pixnet). NO Markdown allowed."
          },
          content: {
            type: Type.STRING,
            description: "The main body text of the post. Use \\n for line breaks. Strictly NO Markdown bold/headers allowed. Use Emojis for formatting."
          },
          hashtags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of hashtags without the #"
          }
        },
        required: ["platform", "content", "hashtags"]
      }
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
      // Clean up markdown code blocks if the model includes them
      let jsonStr = response.text.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (jsonStr.startsWith("```")) {
         jsonStr = jsonStr.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      return JSON.parse(jsonStr) as GeneratedPost[];
    }
    
    throw new Error("API 回傳內容為空");

  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    // Ensure we re-throw a proper Error object
    if (error instanceof Error) {
        throw error;
    } else {
        throw new Error(JSON.stringify(error));
    }
  }
};