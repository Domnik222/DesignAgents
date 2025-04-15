import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Determine __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the project root and file paths
const projectRoot = process.cwd(); // or use __dirname if your project root is here
const publicFolderPath = path.join(projectRoot, 'public');
const stylesFilePath = path.join(projectRoot, 'styles.json');

console.log('Project root path:', projectRoot);
console.log('Public folder path:', publicFolderPath);
console.log('styles.json path:', stylesFilePath);

// Ensure the public folder exists
if (!fs.existsSync(publicFolderPath)) {
  console.log('Creating public directory...');
  fs.mkdirSync(publicFolderPath);
} else {
  console.log('Public folder exists: true');
}

// Attempt to load styles.json
console.log('=== Loading styles.json ===');
console.log(`Checking styles.json at: ${stylesFilePath}`);
if (fs.existsSync(stylesFilePath)) {
  console.log('File exists: true');
  try {
    const stylesData = fs.readFileSync(stylesFilePath, 'utf-8');
    const styles = JSON.parse(stylesData);
    console.log('Loaded styles:', styles);
  } catch (error) {
    console.error('!!! ERROR PARSING styles.json !!!', error);
  }
} else {
  console.error('!!! ERROR LOADING STYLES !!!');
  console.error('styles.json not found in project root');
  // No changes—continue running without it.
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware: enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(publicFolderPath));

// Add a route for the root path '/' to serve your index.html from public folder
app.get('/', (req, res) => {
  // Assumes you have index.html in your public folder
  res.sendFile(path.join(publicFolderPath, 'index.html'));
});

// Define other routes for health and testing
app.get('/health', (req, res) => {
  res.send("Health OK");
});

app.get('/test-public', (req, res) => {
  res.send("Test public endpoint working");
});

// Main POST endpoint for generating images using DALL·E
app.post('/generate', async (req, res) => {
  const { prompt } = req.body;
  console.log("Prompt received:", prompt);

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const imageResponse = await openai.createImage({
      prompt: prompt,
      n: 1,               // Number of images to generate
      size: '1024x1024'   // Image size (adjust as needed)
    });

    const imageUrl = imageResponse.data.data[0].url;
    console.log("Generated Image URL:", imageUrl);

    res.json({ result: imageUrl });
  } catch (error) {
    console.error('❌ DALL·E API Error:', error?.response?.data || error.message || error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`🖼️ Image server running on port ${port}`);
  console.log(`• Health check: http://localhost:${port}/health`);
  console.log(`• Public test:  http://localhost:${port}/test-public`);
});
