import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Path configuration
const rootPath = path.join(__dirname, '../..');
const publicPath = path.join(rootPath, 'public');
const stylesPath = path.join(rootPath, 'styles.json');

// Debug paths
console.log('Project root path:', rootPath);
console.log('Public folder path:', publicPath);
console.log('styles.json path:', stylesPath);

// Create public directory if missing
if (!fs.existsSync(publicPath)) {
  console.log('Creating public directory...');
  fs.mkdirSync(publicPath, { recursive: true });
}

// Verify and serve static files
console.log('Public folder exists:', fs.existsSync(publicPath));
app.use(express.static(publicPath));

// Load style profiles
let styleProfiles;
try {
  console.log('\n=== Loading styles.json ===');
  console.log('Checking styles.json at:', stylesPath);
  console.log('File exists:', fs.existsSync(stylesPath));
  
  if (!fs.existsSync(stylesPath)) {
    throw new Error('styles.json not found in project root');
  }

  const fileContent = fs.readFileSync(stylesPath, 'utf-8');
  styleProfiles = JSON.parse(fileContent);
  console.log('Successfully loaded style profiles:', Object.keys(styleProfiles));
  
} catch (error) {
  console.error('\n!!! ERROR LOADING STYLES !!!');
  console.error(error.message);
  styleProfiles = {
    style1: {
      name: 'Emergency Default',
      description: 'Fallback style - check styles.json configuration',
      designDirectives: {},
      visualCharacteristics: {}
    }
  };
}

// Rest of your existing endpoints (generate-image, health check, etc.)
// ... keep the existing endpoints unchanged ...

// Enhanced health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'DALL-E Image Generator',
    public_folder: {
      path: publicPath,
      exists: fs.existsSync(publicPath)
    },
    styles: {
      path: stylesPath,
      exists: fs.existsSync(stylesPath),
      loaded_profiles: Object.keys(styleProfiles)
    }
  });
});

// Public folder test endpoint
app.get('/test-public', (req, res) => {
  const testFile = path.join(publicPath, 'test.txt');
  try {
    if (!fs.existsSync(testFile)) {
      fs.writeFileSync(testFile, 'Public folder working correctly!');
    }
    res.sendFile(testFile);
  } catch (error) {
    res.status(500).json({
      error: 'Public folder test failed',
      details: error.message,
      path: testFile
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🖼️ Image server running on port ${PORT}`);
  console.log(`• Health check: http://localhost:${PORT}/health`);
  console.log(`• Public test:  http://localhost:${PORT}/test-public`);
});
