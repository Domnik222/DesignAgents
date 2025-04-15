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
app.use(express.json({ limit: '5mb' }));

// Corrected public folder path
const publicPath = path.join(process.cwd(), 'public');
console.log('Public folder path:', publicPath);
console.log('Public folder exists:', fs.existsSync(publicPath));

// Create public directory if it doesn't exist
if (!fs.existsSync(publicPath)) {
  fs.mkdirSync(publicPath);
  console.log('Created public directory');
}

app.use(express.static(publicPath));

// Ensure JSON responses for API routes
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

// Corrected styles.json path with enhanced error handling
let styleProfiles;
try {
  const profilesPath = path.join(process.cwd(), 'styles.json');
  console.log('Attempting to load styles.json from:', profilesPath);
  console.log('styles.json exists:', fs.existsSync(profilesPath));
  
  if (!fs.existsSync(profilesPath)) {
    throw new Error('styles.json not found in project root');
  }

  const fileContent = fs.readFileSync(profilesPath, 'utf-8');
  styleProfiles = JSON.parse(fileContent);
  console.log('Successfully loaded style profiles:', Object.keys(styleProfiles));
} catch (error) {
  console.error('Failed to load styles.json:', error.message);
  styleProfiles = { 
    style1: {
      name: 'Default',
      description: 'Default style',
      designDirectives: {},
      visualCharacteristics: {}
    }
  };
}

// Image generation endpoint
app.post('/generate-image', async (req, res) => {
  try {
    const { prompt, size = '1024x1024', quality = 'standard' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Image description required' });
    }
    if (prompt.length > 1000) {
      return res.status(400).json({ error: 'Prompt too long (max 1000 chars)' });
    }

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'DALL-E Image Generator',
    limits: '20 requests/hour',
    stylesLoaded: !!styleProfiles
  });
});

// Test route for public folder
app.get('/test-public', (req, res) => {
  try {
    res.sendFile(path.join(publicPath, 'test.txt'));
  } catch (error) {
    res.status(500).json({ error: 'Public folder test failed', details: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🖼️ Image server running on port ${PORT}`);
  console.log(`• Endpoint: POST http://localhost:${PORT}/generate-image`);
  console.log(`• Health check: GET http://localhost:${PORT}/health`);
  console.log(`• Public folder test: GET http://localhost:${PORT}/test-public`);
});
