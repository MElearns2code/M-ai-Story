const { GoogleGenAI } = require('@google/genai');

let cachedApiKey = null;
let cachedClient = null;

function getClient() {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;

  if (!apiKey) {
    const error = new Error('GOOGLE_GENAI_API_KEY is not set');
    error.code = 'MISSING_API_KEY';
    throw error;
  }

  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    cachedClient = new GoogleGenAI({ apiKey });
  }

  return cachedClient;
}

async function generateImage(prompt) {
  const client = getClient();

  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash-image-preview',
    contents: prompt
  });

  const candidates = response?.candidates || [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];
    const inlineData = parts.find((part) => part?.inlineData)?.inlineData;

    if (inlineData?.data) {
      return {
        data: inlineData.data,
        mimeType: inlineData.mimeType || 'image/png'
      };
    }
  }

  const error = new Error('No image content returned');
  error.code = 'NO_IMAGE';
  throw error;
}

module.exports = {
  generateImage
};
