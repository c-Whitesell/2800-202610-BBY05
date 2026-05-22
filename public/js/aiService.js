const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize the Gemini AI client and specify the model version
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

/**
 * Sends a text prompt to the Gemini AI model and retrieves the generated text response.
 * @param {string} prompt - The input text prompt to be processed by the AI.
 * @returns {Promise<string>} A promise that resolves to the generated text response from the model.
 */
async function generateAIResponse(prompt) {
  // Send the prompt to the model and await the generated content
  const result = await model.generateContent(prompt);

  return result.response.text();
}

module.exports = { generateAIResponse };
