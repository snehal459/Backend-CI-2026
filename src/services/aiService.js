const axios = require('axios');

const SYSTEM_PROMPT = `You are an expert DevOps AI assistant. You help engineers with:
- Kubernetes manifest analysis and troubleshooting
- Dockerfile best practices and optimization
- CI/CD pipeline design
- Infrastructure as Code (Terraform, CloudFormation)
- Cloud architecture (AWS, GCP, Azure)
- Security hardening and compliance
Provide concise, actionable advice.`;

async function analyzeWithAI(userMessage, context = '') {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  if (context) {
    messages.push({ role: 'user', content: `Context:\n${context}\n\nQuestion: ${userMessage}` });
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

  const response = await axios.post(
    `${baseURL}/chat/completions`,
    { model, messages, max_tokens: 1024 },
    { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
  );

  return response.data.choices[0].message.content;
}

function analyzeDockerfile(content) {
  const issues = [];
  const lines = content.split('\n');

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('FROM') && trimmed.includes(':latest')) {
      issues.push({ line: i + 1, severity: 'warning', message: 'Avoid using :latest tag — pin to a specific version for reproducibility' });
    }
    if (trimmed.startsWith('RUN') && trimmed.includes('apt-get install') && !trimmed.includes('--no-install-recommends')) {
      issues.push({ line: i + 1, severity: 'info', message: 'Use --no-install-recommends with apt-get to reduce image size' });
    }
    if (trimmed.startsWith('ADD') && !trimmed.includes('http')) {
      issues.push({ line: i + 1, severity: 'info', message: 'Prefer COPY over ADD unless you need URL fetching or tar extraction' });
    }
    if (trimmed === 'USER root' || (trimmed.startsWith('RUN') && trimmed.includes('chmod 777'))) {
      issues.push({ line: i + 1, severity: 'error', message: 'Avoid running as root or using chmod 777 — security risk' });
    }
  });

  const hasUser = lines.some(l => l.trim().startsWith('USER') && !l.trim().includes('root'));
  if (!hasUser) {
    issues.push({ line: null, severity: 'warning', message: 'No non-root USER instruction found — run containers as non-root' });
  }

  return { issues, score: Math.max(0, 100 - issues.length * 15) };
}

function analyzeK8sManifest(content) {
  const issues = [];
  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch {
    // treat as YAML-like string analysis
    parsed = null;
  }

  const text = content.toLowerCase();

  if (!text.includes('resources:') && !text.includes('"resources"')) {
    issues.push({ severity: 'warning', message: 'No resource requests/limits defined — set CPU and memory limits' });
  }
  if (!text.includes('livenessprobe') && !text.includes('"livenessprobe"')) {
    issues.push({ severity: 'info', message: 'No livenessProbe defined — add health checks for automatic recovery' });
  }
  if (!text.includes('readinessprobe') && !text.includes('"readinessprobe"')) {
    issues.push({ severity: 'info', message: 'No readinessProbe defined — add readiness checks to control traffic routing' });
  }
  if (text.includes('privileged: true')) {
    issues.push({ severity: 'error', message: 'Privileged container detected — avoid unless absolutely necessary' });
  }
  if (!text.includes('securitycontext') && !text.includes('"securitycontext"')) {
    issues.push({ severity: 'warning', message: 'No securityContext defined — set runAsNonRoot: true and readOnlyRootFilesystem: true' });
  }

  return { issues, score: Math.max(0, 100 - issues.length * 15) };
}

module.exports = { analyzeWithAI, analyzeDockerfile, analyzeK8sManifest };
