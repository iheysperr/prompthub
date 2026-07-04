import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize GoogleGenAI client (Server-side only)
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
} else {
  console.warn("WARNING: GEMINI_API_KEY is not defined in the environment. AI playground features will show configuration warning.");
}

// File path for persisting user submissions
const SUBMISSIONS_FILE = path.join(process.cwd(), "user_submissions.json");
const ADS_FILE = path.join(process.cwd(), "advertisements.json");

// Helper to read submissions
function getSubmissions(): any[] {
  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      const data = fs.readFileSync(SUBMISSIONS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading submissions file:", err);
  }
  return [];
}

// Helper to save submissions
function saveSubmissions(submissions: any[]) {
  try {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing submissions file:", err);
  }
}

// Helper to read advertisements (seeds with default sponsor spots if empty)
function getAdvertisements(): any[] {
  try {
    if (fs.existsSync(ADS_FILE)) {
      const data = fs.readFileSync(ADS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading ads file:", err);
  }
  
  // High-quality seed ads representing real developer tooling sponsors
  const defaultAds = [
    {
      id: "ad-1",
      sponsorName: "Google Cloud AI",
      title: "Get $300 Credits for Gemini API",
      description: "Supercharge your applications with Gemini 1.5 Pro's 2M token context. Deploy direct-response agentic systems at scale.",
      imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&h=200&q=80",
      targetUrl: "https://ai.google.dev",
      badgeText: "Sponsor",
      badgeColor: "bg-blue-600 text-white",
      clicks: 142,
      views: 2450,
      isActive: true,
      startDate: "2026-01-01",
      position: "sidebar"
    },
    {
      id: "ad-2",
      sponsorName: "Pinecone Database",
      title: "Pinecone Serverless Vector Search",
      description: "Build semantic prompt retrieval and RAG architectures in milliseconds. Free tier gets up to 100K prompt embeddings.",
      imageUrl: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=200&h=200&q=80",
      targetUrl: "https://pinecone.io",
      badgeText: "Featured",
      badgeColor: "bg-emerald-600 text-white",
      clicks: 89,
      views: 1890,
      isActive: true,
      startDate: "2026-03-15",
      position: "top_feed"
    }
  ];
  saveAdvertisements(defaultAds);
  return defaultAds;
}

function saveAdvertisements(ads: any[]) {
  try {
    fs.writeFileSync(ADS_FILE, JSON.stringify(ads, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing ads file:", err);
  }
}

// -------------------------------------------------------------
// API ENDPOINTS
// -------------------------------------------------------------

// 1. Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 1b. Get active ads
app.get("/api/ads", (req, res) => {
  const ads = getAdvertisements();
  res.json(ads);
});

// 1c. Create or Edit advertisement
app.post("/api/ads", (req, res) => {
  try {
    const { id, sponsorName, title, description, imageUrl, targetUrl, badgeText, badgeColor, isActive, position } = req.body;
    
    if (!sponsorName || !title || !description || !targetUrl) {
      return res.status(400).json({ error: "Sponsor Name, Title, Description, and Target URL are required." });
    }

    const ads = getAdvertisements();
    
    if (id) {
      const index = ads.findIndex(a => a.id === id);
      if (index !== -1) {
        ads[index] = {
          ...ads[index],
          sponsorName,
          title,
          description,
          imageUrl: imageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&h=200&q=80",
          targetUrl,
          badgeText: badgeText || "Sponsored",
          badgeColor: badgeColor || "bg-indigo-500 text-white",
          isActive: isActive !== undefined ? isActive : ads[index].isActive,
          position: position || "sidebar"
        };
        saveAdvertisements(ads);
        return res.json(ads[index]);
      } else {
        return res.status(404).json({ error: "Advertisement not found." });
      }
    } else {
      const newAd = {
        id: `ad-${Date.now()}`,
        sponsorName,
        title,
        description,
        imageUrl: imageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&h=200&q=80",
        targetUrl,
        badgeText: badgeText || "Sponsored",
        badgeColor: badgeColor || "bg-indigo-500 text-white",
        clicks: 0,
        views: 0,
        isActive: isActive !== undefined ? isActive : true,
        startDate: new Date().toISOString().split('T')[0],
        position: position || "sidebar"
      };
      ads.push(newAd);
      saveAdvertisements(ads);
      return res.status(201).json(newAd);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// 1d. Track ad clicks
app.post("/api/ads/click", (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Ad ID is required." });
    }
    const ads = getAdvertisements();
    const index = ads.findIndex(a => a.id === id);
    if (index !== -1) {
      ads[index].clicks = (ads[index].clicks || 0) + 1;
      saveAdvertisements(ads);
      return res.json({ success: true, clicks: ads[index].clicks });
    }
    res.status(404).json({ error: "Ad not found." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1e. Track ad views
app.post("/api/ads/view", (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Ad ID is required." });
    }
    const ads = getAdvertisements();
    const index = ads.findIndex(a => a.id === id);
    if (index !== -1) {
      ads[index].views = (ads[index].views || 0) + 1;
      saveAdvertisements(ads);
      return res.json({ success: true, views: ads[index].views });
    }
    res.status(404).json({ error: "Ad not found." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1f. Delete Ad
app.post("/api/ads/delete", (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Ad ID is required." });
    }
    const ads = getAdvertisements();
    const filtered = ads.filter(a => a.id !== id);
    if (filtered.length === ads.length) {
      return res.status(404).json({ error: "Ad not found." });
    }
    saveAdvertisements(filtered);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get user submissions
app.get("/api/submissions", (req, res) => {
  const list = getSubmissions();
  res.json(list);
});

// 3. Submit a new prompt
app.post("/api/prompts/submit", (req, res) => {
  try {
    const { title, description, fullPrompt, category, tags, difficulty, aiModel, author } = req.body;

    if (!title || !description || !fullPrompt || !category) {
      return res.status(400).json({ error: "Title, description, prompt, and category are required." });
    }

    const submissions = getSubmissions();
    const newSubmission = {
      id: `custom-${Date.now()}`,
      title,
      description,
      fullPrompt,
      category,
      tags: Array.isArray(tags) ? tags : [tags],
      difficulty: difficulty || "Beginner",
      aiModel: aiModel || "ChatGPT",
      views: 12,
      likes: 1,
      copies: 0,
      author: author || "Community Designer",
      createdDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      status: "Approved", // Auto-approved in this demo to let users see their submission immediately
      isCustom: true
    };

    submissions.push(newSubmission);
    saveSubmissions(submissions);

    res.status(201).json(newSubmission);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// 4. Update approval status (For admin moderation panel)
app.post("/api/prompts/moderate", (req, res) => {
  try {
    const { id, status } = req.body; // Approved, Rejected, Pending
    if (!id || !status) {
      return res.status(400).json({ error: "Prompt ID and target status are required." });
    }

    const submissions = getSubmissions();
    const index = submissions.findIndex(s => s.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Submission not found." });
    }

    submissions[index].status = status;
    saveSubmissions(submissions);

    res.json(submissions[index]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Test/Run Prompt in Gemini Sandbox
app.post("/api/gemini/run", async (req, res) => {
  try {
    const { prompt, systemInstruction, userVariables } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt content is required." });
    }

    if (!ai) {
      return res.status(503).json({ 
        error: "Gemini API client is not initialized. Please ensure your GEMINI_API_KEY secret is configured." 
      });
    }

    // Replace variables in the format [VARIABLE_NAME] with user-provided values
    let interpolatedPrompt = prompt;
    if (userVariables && typeof userVariables === "object") {
      for (const [key, val] of Object.entries(userVariables)) {
        const regex = new RegExp(`\\[${key}\\]`, "g");
        interpolatedPrompt = interpolatedPrompt.replace(regex, String(val));
      }
    }

    // Run the prompt
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: interpolatedPrompt,
      config: systemInstruction ? { systemInstruction } : undefined
    });

    res.json({
      success: true,
      interpolatedPrompt,
      output: response.text
    });
  } catch (err: any) {
    console.error("Gemini invocation error:", err);
    res.status(500).json({ error: err.message || "Failed to communicate with Gemini API" });
  }
});

// 6. Optimize/Enhance Prompt with AI
app.post("/api/gemini/optimize", async (req, res) => {
  try {
    const { rawPrompt } = req.body;

    if (!rawPrompt) {
      return res.status(400).json({ error: "Raw prompt content is required." });
    }

    if (!ai) {
      return res.status(503).json({ 
        error: "Gemini API client is not initialized. Please ensure your GEMINI_API_KEY secret is configured." 
      });
    }

    const optimizationInstruction = 
      "You are a Senior Prompt Architect. Your job is to rewrite the user's basic draft prompt into an exceptionally engineered, clear, production-ready system prompt or complex instruction template.\n\n" +
      "Follow these rules:\n" +
      "1. Maintain the user's core intent but dramatically enhance structure.\n" +
      "2. Add a clear role/persona for the AI to adopt.\n" +
      "3. Use Markdown blocks, clear sections, bullet points, and delimiters.\n" +
      "4. Create parameter brackets (like [SETTING], [TOPIC], or [VARIABLE]) for any configurable parameters so users can customize it.\n" +
      "5. Outline precise constraints, tone guidelines, and negative limits (what NOT to do).\n" +
      "6. Return ONLY the newly designed prompt, without intro or meta commentary.";

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Draft to optimize: "${rawPrompt}"`,
      config: {
        systemInstruction: optimizationInstruction,
        temperature: 0.7,
      }
    });

    res.json({
      success: true,
      optimizedPrompt: response.text
    });
  } catch (err: any) {
    console.error("Gemini optimization error:", err);
    res.status(500).json({ error: err.message || "Failed to optimize prompt with Gemini" });
  }
});

// -------------------------------------------------------------
// VITE DEV SERVER OR STATIC ASSETS ROUTING
// -------------------------------------------------------------

async function setupFrontend() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupFrontend();
