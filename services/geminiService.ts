
import { GoogleGenAI, Type } from "@google/genai";
import { Product, CustomerInfo, SelectedItem } from "../types";

export interface ChatUpdate {
  customerUpdate?: Partial<CustomerInfo>;
  itemsToAdd?: { model: string; quantity: number }[];
  paymentUpdate?: string;
  isComplete?: boolean;
  triggerPdf?: boolean;
}

export interface ChatResponse {
  reply: string;
  updates?: ChatUpdate;
}

export const processConversation = async (
  message: string,
  history: { role: "user" | "model"; parts: { text?: string; inlineData?: any }[] }[],
  currentContext: {
    customer: CustomerInfo;
    items: SelectedItem[];
    availableProducts: Product[];
  },
  images: { data: string; mimeType: string }[] = []
): Promise<ChatResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-pro-preview";

  const systemInstruction = `You are an expert sales assistant for AA2000 Security and Technology Solutions. 
Your goal is to help the admin create a complete Sales Quotation by extracting information from the conversation.

FIELD MAPPING GUIDE (Map user terms to these exact keys):
- "Attention To", "Name", "Recipient" -> fullName
- "Position", "Job Title" -> position
- "Company Name", "Company", "Organization" -> companyName
- "Email Address", "Email" -> email
- "Contact No.", "Tel No.", "Mobile No.", "Phone" -> phone
- "Address", "Location" -> address
- "Project For", "Project Name", "Project" -> projectFor
- "Project Site", "Site Location" -> projectSite
- "Contractor/End user", "Client Category", "Client Type" -> clientType (Must be one of: "SYSTEM_CONTRACTOR", "END_USER", "DEALER")
- "Labor Cost", "Installation Cost", "Service Fee" -> laborCost (Number)
- "Requires Labor", "With Installation" -> hasLabor (Boolean)
- "Scope of Work", "Labor Description" -> laborScope (String)
- "Mobilization Date", "Target Date" -> mobilizationDate (String)
- "Site Contact", "Site Representative" -> siteContactName (String)
- "Site Contact Number", "Site Phone" -> siteContactPhone (String)

CRITICAL VERIFICATION FOR PDF GENERATION:
Before you can generate a PDF document, the following MUST be present:
1. Recipient Name (customer.fullName)
2. Company Name (customer.companyName)
3. Email Address (customer.email)
4. Project Name (customer.projectFor)
5. At least one item in the list (items.length > 0)

CURRENT QUOTATION STATE:
- Customer: ${JSON.stringify(currentContext.customer)}
- Items Count: ${currentContext.items.length}

ATTACHED DATA HANDLING:
- If you see "CONTENT FROM EXCEL FILE" in the prompt, this is spreadsheet data the user has uploaded.
- Extract any relevant product models, quantities, and customer info from this data.
- Cross-reference product models with our Available Catalog: ${JSON.stringify(currentContext.availableProducts.map(p => ({ model: p.model, name: p.name })))}.

INSTRUCTIONS:
- If the user asks to "generate pdf", "create document", or "download quote":
  - Check if all 5 requirements above are met.
  - If NOT met: Respond by listing exactly what is still missing (e.g., "I still need the Company Name and at least one item before I can create the PDF.")
  - If MET: Set "triggerPdf" to true in the updates and confirm in your reply that the preview is opening.
- Be professional and concise.
- ALWAYS return a JSON object with:
  1. "reply": Your response string.
  2. "updates": (Optional) structured object:
     - "customerUpdate": Partial<CustomerInfo>
     - "itemsToAdd": Array of { "model": string, "quantity": number }
     - "paymentUpdate": string
     - "isComplete": boolean
     - "triggerPdf": boolean`;

  const userParts: any[] = [{ text: message }];

  if (images && images.length > 0) {
      images.forEach(img => {
          userParts.push({
              inlineData: {
                  data: img.data,
                  mimeType: img.mimeType
              }
          });
      });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        ...history,
        { role: "user", parts: userParts }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            updates: {
              type: Type.OBJECT,
              properties: {
                customerUpdate: {
                  type: Type.OBJECT,
                  properties: {
                    fullName: { type: Type.STRING, description: "Recipient name or Attention To" },
                    companyName: { type: Type.STRING },
                    email: { type: Type.STRING },
                    projectFor: { type: Type.STRING, description: "Project name or purpose" },
                    projectSite: { type: Type.STRING, description: "Physical location of the project" },
                    position: { type: Type.STRING },
                    phone: { type: Type.STRING, description: "11-digit mobile or tel number" },
                    address: { type: Type.STRING, description: "Company or billing address" },
                    clientType: { type: Type.STRING, description: "Must be SYSTEM_CONTRACTOR, END_USER, or DEALER" },
                    laborCost: { type: Type.NUMBER, description: "Manual pricing for labor services" },
                    hasLabor: { type: Type.BOOLEAN, description: "Whether labor services are required" },
                    laborScope: { type: Type.STRING, description: "Description of labor requirements" },
                    mobilizationDate: { type: Type.STRING, description: "Target date for mobilization" },
                    siteContactName: { type: Type.STRING, description: "Name of site contact person" },
                    siteContactPhone: { type: Type.STRING, description: "Phone number of site contact person" }
                  }
                },
                itemsToAdd: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      model: { type: Type.STRING },
                      quantity: { type: Type.INTEGER }
                    },
                    required: ["model", "quantity"]
                  }
                },
                paymentUpdate: { type: Type.STRING },
                isComplete: { type: Type.BOOLEAN },
                triggerPdf: { type: Type.BOOLEAN }
              }
            }
          },
          required: ["reply"]
        }
      }
    });

    return JSON.parse(response.text || '{"reply": "I encountered an error processing that."}');
  } catch (e: any) {
    console.error("Gemini Chat Error:", e);
    return { reply: "I'm having trouble connecting to my brain right now. Please try again." };
  }
};

export const parseRequest = async (prompt: string, availableProducts: Product[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-pro-preview";
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `User wants to add items to a quotation.
      Available Products: ${JSON.stringify(availableProducts.map(p => ({ id: p.id, model: p.model, name: p.name })))}
      User Request: "${prompt}"
      
      Match the user's request to the product models or names and specify quantities. 
      Return a JSON array of { id: number, quantity: number }. 
      If a product is not found, do not include it.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              quantity: { type: Type.INTEGER }
            },
            required: ["id", "quantity"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (e: any) {
    console.error("Gemini Text Service Error:", e);
    throw new Error(e.message || "Failed to process AI request");
  }
};

export const parseImageRequest = async (base64Data: string, mimeType: string, availableProducts: Product[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: `This is an image of a quotation, bill of materials, or a product list. 
            Extract the products and quantities mentioned. 
            Cross-reference them with our Available Catalog: ${JSON.stringify(availableProducts.map(p => ({ id: p.id, model: p.model, name: p.name })))}
            Return a JSON array of { id: number, quantity: number } for matched items only.
            
            IMPORTANT: Return ONLY the raw JSON string. Do not use Markdown formatting.`
          }
        ]
      }
    });

    let text = response.text || "[]";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(text);
  } catch (e: any) {
    console.error("Gemini Vision Service Error:", e);
    throw new Error(e.message || "Failed to process image request");
  }
};
