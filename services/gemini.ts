import { GoogleGenAI, Type } from "@google/genai";
import { VocabularyItem } from "../types";

// Initialize the API client.
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export interface ParsedVocabulary {
  vocabulary: VocabularyItem[];
}

const MODEL_NAME = "gemini-2.5-flash";

export const parseContentWithGemini = async (
  text: string, 
  fileBase64?: string,
  mimeType: string = 'image/jpeg'
): Promise<ParsedVocabulary> => {
  
  if (!apiKey) {
    throw new Error("Missing API Key. Please ensure process.env.API_KEY is set.");
  }

  // Define schema for structured JSON output - VOCABULARY ONLY
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      vocabulary: {
        type: Type.ARRAY,
        description: "List of key vocabulary words found in the content.",
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING, description: "The English word or phrase." },
            ipa: { type: Type.STRING, description: "IPA phonetic transcription (e.g. /wɜːrd/)." },
            definition: { type: Type.STRING, description: "Chinese definition/translation." },
            example: { type: Type.STRING, description: "A short English example sentence containing the word." }
          },
          required: ["word", "definition", "example"]
        }
      }
    },
    required: ["vocabulary"]
  };

  const parts: any[] = [];
  
  // If we have a file (Image or PDF)
  if (fileBase64) {
    const base64Data = fileBase64.split(',')[1] || fileBase64;
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    });
  }

  // Add text instruction
  const prompt = `
    You are an expert, rigorous English linguistics tutor. 
    Analyze the provided content (Text, Image, PDF document, or URL Link).
    
    CRITICAL INSTRUCTION:
    You must extract a COMPREHENSIVE list. Do NOT limit yourself to just 5 or 10 words.
    You must scan the entire document/text and extract:
    1. All difficult vocabulary.
    2. All idiomatic phrases and collocations.
    3. Important key sentences (treat these as a "phrase" entry if they are short, or extract the key structure).
    
    SELF-CORRECTION CHECK:
    - Have I missed any phrasal verbs?
    - Have I missed any C1/C2 level words?
    - Have I included all key terms from the text?
    
    Ensure NO important language point is missed.
    
    For each extracted item:
    1. Provide the Word/Phrase.
    2. Provide IPA phonetic transcription (e.g., /.../).
    3. Provide the Chinese definition.
    4. Provide a simple English example sentence.
    
    If the text input below looks like a URL (starts with http), please attempt to retrieve or infer the content from that URL to perform the extraction.

    Input Context:
    ${text}
  `;
  
  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.3, 
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");
    
    return JSON.parse(jsonText) as ParsedVocabulary;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const parseStoryWithGemini = async (
  text: string,
  fileBase64?: string,
  mimeType: string = 'image/jpeg'
): Promise<string> => {
  if (!apiKey) throw new Error("Missing API Key");

  const parts: any[] = [];
  if (fileBase64) {
    const base64Data = fileBase64.split(',')[1] || fileBase64;
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    });
  }

  const prompt = `
    You are an expert editor and document parser.
    Extract the full English text content from the provided input (Text, File, or URL).
    
    CRITICAL FORMATTING REQUIREMENTS:
    1. **PRESERVE BOLDING**: If the original document has bold words (or words that look visually emphasized/heavy), you MUST retain them using Markdown syntax (double asterisks: **word**). 
    2. **IDENTIFY KEYWORDS**: If the input is plain text without formatting, identify difficult English words or key phrases and apply **bold** markdown to them automatically.
    3. Return ONLY the content. Do not add intro/outro.
    4. Preserve paragraph structure.
    
    Input Context:
    ${text}
  `;
  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
      config: {
        temperature: 0.3,
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Story Parsing Error:", error);
    throw error;
  }
};
