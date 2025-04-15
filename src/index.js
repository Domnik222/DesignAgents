// src/index.js

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Determine project root and file paths
const projectRoot = process.cwd();
const stylesPath = path.join(projectRoot, 'styles.json');
const publicPath = path.join(projectRoot, 'public');

console.log('Project root path:', projectRoot);
console.log('Public folder path:', publicPath);
console.log('Styles.json path:', stylesPath);

// Ensure the public folder exists
if (!fs.existsSync(publicPath)) {
  console.log('Creating public directory...');
  fs.mkdirSync(publicPath);
} else {
  console.log('Public folder exists: true');
}

// Try to load styles.json; if missing or error, use a default fallback
let styles = {};
if (fs.existsSync(stylesPath)) {
  console.log("=== Loading styles.json ===");
  try {
    const data = fs.readFileSync(stylesPath, 'utf-8');
    styles = JSON.parse(data);
    console.log("Loaded styles:", styles);
  } catch (error) {
    console.error("!!! ERROR PARSING styles.json !!!", error);
  }
} else {
  console.error("!!! ERROR LOADING STYLES !!!");
  console.error("styles.json not found in project root");
  // Fallback default configuration:
  styles = { defaultStyle: "minimal", styles: [] };
}

// Initialize OpenAI with your API key from .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());

// Define basic routes
app.get('/health', (req, res) => {
  res.send("Health OK");
});

app.get('/test-public', (req, res) => {
  res.send("Test public endpoint working");
});

// Main POST endpoint for generating responses
app.post('/generate', async (req, res) => {
  const { prompt } = req.body;
  console.log("🟡 Prompt received:", prompt);

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Change this to 'gpt-4' if you have access
      messages: [
        { role: 'system', content: 'You are a helpful AI design agent.' },
        { role: 'user', content: prompt },
      ],
    });

    const aiResponse = completion.choices[0].message.content;
    console.log("🟢 AI Response:", aiResponse);
    res.json({ result: aiResponse });
  } catch (error) {
    console.error('❌ OpenAI API Error:', error?.response?.data || error.message || error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

app.listen(port, () => {
  console.log(`🖼️ Image server running on port ${port}`);
  console.log(`• Health check: http://localhost:${port}/health`);
  console.log(`• Public test:  http://localhost:${
