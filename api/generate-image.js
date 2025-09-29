const { readBody, sendJson, sendOptions } = require('../lib/http');
const { generateImage } = require('../lib/genai');

module.exports = async function generateImageHandler(req, res) {
  if (req.method === 'OPTIONS') {
    sendOptions(res);
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  let rawBody = '';
  try {
    rawBody = await readBody(req);
  } catch (error) {
    const statusCode = error?.statusCode || 400;
    sendJson(res, statusCode, {
      error: statusCode === 413 ? 'Payload too large' : 'Failed to read request body'
    });
    return;
  }

  let prompt = '';
  try {
    const parsed = JSON.parse(rawBody || '{}');
    prompt = typeof parsed.prompt === 'string' ? parsed.prompt.trim() : '';
  } catch (error) {
    sendJson(res, 400, { error: 'Invalid JSON payload' });
    return;
  }

  if (!prompt) {
    sendJson(res, 422, { error: 'Prompt is required' });
    return;
  }

  try {
    console.log('Generating image for prompt:', prompt);

    const result = await generateImage(prompt);

    console.log('Image generated successfully');

    sendJson(res, 200, {
      imageBase64: result.data,
      mimeType: result.mimeType,
      prompt
    });
  } catch (error) {
    if (error?.code === 'MISSING_API_KEY') {
      sendJson(res, 500, { error: 'Server missing configuration' });
      return;
    }

    if (error?.code === 'NO_IMAGE') {
      sendJson(res, 502, { error: 'No image content returned' });
      return;
    }

    console.error('Image generation error:', error);
    sendJson(res, 500, { error: 'Unexpected server error: ' + error.message });
  }
};
