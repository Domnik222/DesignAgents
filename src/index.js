import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 2,
  timeout: 20000
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '5mb' })); // Parse JSON bodies

// Debug the public folder path
const publicPath = path.join(process.cwd(), 'public'); // Look for public/ in src/
console.log('Public folder path:', publicPath);
console.log('Public folder exists:', fs.existsSync(publicPath));
app.use(express.static(publicPath)); // Serve static files from the 'public' folder in src/

// Ensure all responses are JSON (for API routes)
app.use((req, res, next) => {
  if (req.path.startsWith('/generate-image') || req.path.startsWith('/health')) {
    res.setHeader('Content-Type', 'application/json');
  }
  next();
});

// Rate limiter (20 requests/hour)
const imageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many image generation requests. Limit: 20/hour.',
  headers: true
});

app.use('/generate-image', imageLimiter);

// Load style profiles from external JSON file
let styleProfiles;
try {
  const profilesPath = path.join(process.cwd(), 'styles.json'); // Look for styles.json in src/
  console.log('Attempting to load styles.json from:', profilesPath);
  console.log('styles.json exists:', fs.existsSync(profilesPath));
  const fileContent = fs.readFileSync(profilesPath, 'utf-8');
  console.log('styles.json content:', fileContent); // Debug log
  styleProfiles = JSON.parse(fileContent);
} catch (error) {
  console.error('Failed to load styles.json:', error.message);
  styleProfiles = { style1: { name: 'Default', description: 'Default style', designDirectives: {}, visualCharacteristics: {} } }; // Fallback
}

// Endpoint to generate images using the loaded JSON
app.post('/generate-image', async (req, res) => {
  try {
    const { prompt, size = '1024x1024', quality = 'standard' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Image description required' });
    }
    if (prompt.length > 1000) {
      return res.status(400).json({ error: 'Prompt too long (max 1000 chars)' });
    }

    // Select the desired style profile (hard-coded "style1" for now)
    const style = styleProfiles.style1;
    const styleGuide = `Style Profile: ${style.name}. Description: ${style.description}. Design Directives: ${Object.entries(style.designDirectives)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')}. Visual Characteristics: ${Object.entries(style.visualCharacteristics)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')}.`;

    const finalPrompt = `Professional digital artwork, 4K resolution. ${styleGuide} Please create an image that depicts: ${prompt}`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      n: 1,
      size: size,
      quality: quality,
      response_format: "url",
      style: "vivid"
    });

    res.status(200).json({
      image_url: response.data[0].url,
      revised_prompt: response.data[0].revised_prompt,
      size: size,
      quality: quality
    });
    
  } catch (error) {
    console.error('DALL-E Error:', error);
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
    const errorMessage = error.message.includes('content policy')
      ? 'Prompt rejected: violates content policy'
      : error.message.includes('billing')
        ? 'API billing issue'
        : 'Image generation failed';

    res.status(error.status || 500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'DALL-E Image Generator',
    limits: '20 requests/hour'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🖼️ Image server running on port ${PORT}`);
  console.log(`• Endpoint: POST http://localhost:${PORT}/generate-image`);
});
