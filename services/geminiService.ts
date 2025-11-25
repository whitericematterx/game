import { GoogleGenAI } from "@google/genai";
import { BiomeType } from "../types";

const API_KEY = process.env.API_KEY || '';

let ai: GoogleGenAI | null = null;

if (API_KEY) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
}

export const generateLore = async (
    biome: BiomeType,
    timeOfDay: string,
    landmarkType: string
): Promise<{ title: string; content: string }> => {
    if (!ai) {
        return {
            title: "Signal Lost",
            content: "Neural link to archive offline. (Missing API Key)"
        };
    }

    try {
        const model = ai.models;
        const prompt = `
        You are the chronicle of an ancient, low-poly procedural world.
        The traveler has discovered a ${landmarkType} in the ${biome} biome during ${timeOfDay}.
        
        Generate a short, mysterious lore entry for this discovery. 
        The tone should be atmospheric, slightly sci-fi/fantasy, and cryptic.
        Max 50 words.
        
        Output strictly in JSON format:
        {
            "title": "A short 2-4 word title",
            "content": "The lore description."
        }
        `;

        const response = await model.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });
        
        const text = response.text;
        if (!text) throw new Error("No response text");

        return JSON.parse(text);

    } catch (error) {
        console.error("Lore generation failed:", error);
        return {
            title: "Static Interference",
            content: "The data fragment is corrupted. The monolith remains silent."
        };
    }
};