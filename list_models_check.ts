import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

async function list() {
  try {
    console.log('--- Kullanılabilir Modeller ---');
    const models: any = await ai.models.list();
    if (models && typeof models.forEach === 'function') {
      models.forEach((m: any) => {
        console.log(`${m.name} (${m.displayName})`);
      });
    } else if (models && Array.isArray(models.models)) {
      models.models.forEach((m: any) => {
        console.log(`${m.name} (${m.displayName})`);
      });
    }
  } catch (err) {
    console.error('Hata:', err);
  }
}

list();
