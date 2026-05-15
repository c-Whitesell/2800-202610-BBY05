// ── AI Service ────────────────────────────────────────────────
// Single place that owns the Gemini model instance.
// Import and call generateAIResponse() anywhere in the app.

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

/**
 * Send a prompt to Gemini and return the text response.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function generateAIResponse(prompt) {
  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = { generateAIResponse };
