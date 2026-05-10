import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

async function list() {
  try {
    console.log('--- Kullanılabilir Modeller ---');
    const models = await ai.models.list();
    models.forEach(m => {
      console.log(`${m.name} (${m.displayName})`);
    });
  } catch (err) {
    console.error('Hata:', err);
  }
}

list();
