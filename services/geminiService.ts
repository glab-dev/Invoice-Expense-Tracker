
import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("Gemini API key not found. Please set the API_KEY environment variable.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

interface OcrResult {
  date: string; // "YYYY-MM-DD"
  description: string;
  amount: number;
  currency: string; // "CAD", "USD", etc.
  category: string;
}

export interface ExtractedExpense {
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
}

export interface ExtractedInvoiceItem {
    description: string;
    quantity: number;
    rate_description: string; // e.g., "day", "15 days"
    amount: number;
    start_date: string;
    end_date?: string;
}

export interface InvoiceOcrResult {
  companyName: string;
  companyAddress: string;
  date: string; // "YYYY-MM-DD"
  items: ExtractedInvoiceItem[];
  perDiemQuantity: number;
  expenses: ExtractedExpense[];
  notes: string;
}

/**
 * Extracts expense data from a receipt image using Gemini Vision.
 * @param imageBase64 The base64 encoded image string.
 * @param mimeType The MIME type of the image (e.g., 'image/jpeg').
 * @param availableCategories The user-defined list of categories to choose from.
 * @returns A promise that resolves to the extracted expense data.
 */
export const extractReceiptData = async (imageBase64: string, mimeType: string, availableCategories: string[]): Promise<OcrResult | null> => {
  if (!API_KEY) {
    console.error("Cannot call Gemini API: API key is missing.");
    return {
      date: new Date().toISOString().split('T')[0],
      description: "Mocked Receipt Item",
      amount: 123.45,
      currency: "CAD",
      category: availableCategories[0] || "Misc",
    };
  }
  try {
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType,
      },
    };

    const textPart = {
      text: `Analyze this receipt image. Extract the vendor name or a brief description, the transaction date (YYYY-MM-DD), the total amount, and the currency code (e.g., USD, CAD). Also, categorize it into one of the following: ${availableCategories.join(', ')}. Respond with ONLY a valid JSON object.`,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: 'Transaction date in YYYY-MM-DD format.' },
            description: { type: Type.STRING, description: 'Vendor name or a brief description of the purchase.' },
            amount: { type: Type.NUMBER, description: 'The total amount of the transaction.' },
            currency: { type: Type.STRING, description: 'The 3-letter currency code (e.g., USD, CAD, EUR).' },
            category: { type: Type.STRING, description: 'The expense category.', enum: availableCategories },
          },
          required: ['date', 'description', 'amount', 'currency', 'category'],
        }
      }
    });

    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);

    if (result && typeof result.amount === 'number' && typeof result.description === 'string') {
        return result as OcrResult;
    }

    return null;

  } catch (error) {
    console.error("Error processing receipt with Gemini:", error);
    return null;
  }
};


/**
 * Extracts structured invoice data from a document image using Gemini Vision.
 * @param fileBase64 The base64 encoded file string.
 * @param mimeType The MIME type of the file (e.g., 'application/pdf', 'image/jpeg').
 * @returns A promise that resolves to the extracted invoice data.
 */
export const extractInvoiceData = async (fileBase64: string, mimeType: string): Promise<InvoiceOcrResult | null> => {
  if (!API_KEY) {
    console.error("Cannot call Gemini API: API key is missing.");
    return null;
  }
  try {
    const filePart = {
      inlineData: {
        data: fileBase64,
        mimeType,
      },
    };

    const textPart = {
      text: "Analyze this invoice document. The invoice is being sent TO a client. Identify the client company being billed (often labeled 'Bill To:' or just being the main recipient address), not the sender or the 'Pay To' entity. Extract the client's company name, their billing address, and the primary invoice date (YYYY-MM-DD). For line items, extract their start/end dates, description, quantity, rate description (e.g., 'day', '15 days'), and total amount. Also separately extract any summarized Per Diem quantity (e.g., from 'PD's: $750 x15', extract just the number 15). Also separately extract a list of expenses (often in their own box); for each expense, get its description, date (YYYY-MM-DD), and amount. Finally, extract any notes or memos. Respond with ONLY a valid JSON object.",
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [filePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            companyName: { type: Type.STRING, description: "The client's company name." },
            companyAddress: { type: Type.STRING, description: "The client's billing address." },
            date: { type: Type.STRING, description: 'Invoice date in YYYY-MM-DD format.' },
            items: {
              type: Type.ARRAY,
              description: "List of line items from the invoice.",
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  rate_description: { type: Type.STRING, description: "e.g., 'day', '15 days'" },
                  amount: { type: Type.NUMBER },
                  start_date: { type: Type.STRING, description: "Line item start date in YYYY-MM-DD" },
                  end_date: { type: Type.STRING, description: "Line item end date in YYYY-MM-DD (optional)" }
                },
                required: ['description', 'quantity', 'rate_description', 'amount', 'start_date'],
              }
            },
            perDiemQuantity: { type: Type.NUMBER, description: "The total quantity of Per Diems (e.g., 15)." },
            expenses: {
                type: Type.ARRAY,
                description: "List of expenses found on the invoice.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        description: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        date: { type: Type.STRING, description: 'Expense date in YYYY-MM-DD format.'}
                    },
                    required: ['description', 'amount', 'date']
                }
            },
            notes: { type: Type.STRING, description: "Any notes or memos found on the invoice." },
          },
          required: ['companyName', 'companyAddress', 'date', 'items'],
        }
      }
    });
    
    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);

    if (!result.expenses) result.expenses = [];
    if (!result.perDiemQuantity) result.perDiemQuantity = 0;

    if (result && result.companyName && Array.isArray(result.items)) {
        return result as InvoiceOcrResult;
    }

    return null;
  } catch (error) {
    console.error("Error processing invoice with Gemini:", error);
    return null;
  }
};