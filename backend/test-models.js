require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  // Actually, to list models via REST API since the Node SDK might not have a direct list method in all versions:
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    console.log("AVAILABLE MODELS:");
    data.models.forEach(m => {
      if(m.supportedGenerationMethods.includes('generateContent')) {
        console.log(`- ${m.name}`);
      }
    });
  } catch (err) {
    console.error("Error fetching models:", err);
  }
}

listModels();
