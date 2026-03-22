const express = require('express');
const { analyzeWithAI, analyzeDockerfile, analyzeK8sManifest } = require('../services/aiService');

const router = express.Router();

// POST /api/devops/chat - General DevOps AI chat
router.post('/chat', async (req, res) => {
  const { message, context } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  try {
    const answer = await analyzeWithAI(message, context);
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/devops/analyze/dockerfile - Static + AI Dockerfile analysis
router.post('/analyze/dockerfile', async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });

  const staticAnalysis = analyzeDockerfile(content);

  let aiSuggestions = null;
  if (process.env.OPENAI_API_KEY) {
    try {
      aiSuggestions = await analyzeWithAI('Review this Dockerfile and provide optimization tips', content);
    } catch {
      aiSuggestions = 'AI analysis unavailable';
    }
  }

  res.json({ ...staticAnalysis, aiSuggestions });
});

// POST /api/devops/analyze/k8s - Static + AI Kubernetes manifest analysis
router.post('/analyze/k8s', async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });

  const staticAnalysis = analyzeK8sManifest(content);

  let aiSuggestions = null;
  if (process.env.OPENAI_API_KEY) {
    try {
      aiSuggestions = await analyzeWithAI('Review this Kubernetes manifest and provide best practice recommendations', content);
    } catch {
      aiSuggestions = 'AI analysis unavailable';
    }
  }

  res.json({ ...staticAnalysis, aiSuggestions });
});

module.exports = router;
