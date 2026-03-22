const request = require('supertest');
const app = require('../src/app');
const aiService = require('../src/services/aiService');

jest.mock('../src/services/aiService', () => ({
  analyzeWithAI: jest.fn(),
  analyzeDockerfile: jest.requireActual('../src/services/aiService').analyzeDockerfile,
  analyzeK8sManifest: jest.requireActual('../src/services/aiService').analyzeK8sManifest,
}));

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'DevOps AI Tool' });
  });
});

describe('POST /api/devops/chat', () => {
  it('returns 400 when message is missing', async () => {
    const res = await request(app).post('/api/devops/chat').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('message is required');
  });

  it('returns AI answer on valid message', async () => {
    aiService.analyzeWithAI.mockResolvedValue('Use Helm for K8s deployments.');
    const res = await request(app).post('/api/devops/chat').send({ message: 'How to deploy to K8s?' });
    expect(res.status).toBe(200);
    expect(res.body.answer).toBe('Use Helm for K8s deployments.');
  });

  it('returns 500 when AI service throws', async () => {
    aiService.analyzeWithAI.mockRejectedValue(new Error('API key missing'));
    const res = await request(app).post('/api/devops/chat').send({ message: 'test' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('API key missing');
  });
});

describe('POST /api/devops/analyze/dockerfile', () => {
  it('returns 400 when content is missing', async () => {
    const res = await request(app).post('/api/devops/analyze/dockerfile').send({});
    expect(res.status).toBe(400);
  });

  it('detects :latest tag warning', async () => {
    const content = 'FROM node:latest\nRUN npm install';
    const res = await request(app).post('/api/devops/analyze/dockerfile').send({ content });
    expect(res.status).toBe(200);
    expect(res.body.issues.some(i => i.message.includes(':latest'))).toBe(true);
  });

  it('detects missing non-root USER', async () => {
    const content = 'FROM node:18\nRUN npm install';
    const res = await request(app).post('/api/devops/analyze/dockerfile').send({ content });
    expect(res.body.issues.some(i => i.message.includes('non-root'))).toBe(true);
  });

  it('returns score 100 for clean Dockerfile', async () => {
    const content = 'FROM node:18-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci --only=production\nUSER node\nCMD ["node","index.js"]';
    const res = await request(app).post('/api/devops/analyze/dockerfile').send({ content });
    expect(res.body.score).toBe(100);
    expect(res.body.issues).toHaveLength(0);
  });
});

describe('POST /api/devops/analyze/k8s', () => {
  it('returns 400 when content is missing', async () => {
    const res = await request(app).post('/api/devops/analyze/k8s').send({});
    expect(res.status).toBe(400);
  });

  it('detects missing resource limits', async () => {
    const content = 'apiVersion: apps/v1\nkind: Deployment\nspec:\n  containers:\n  - name: app\n    image: nginx';
    const res = await request(app).post('/api/devops/analyze/k8s').send({ content });
    expect(res.body.issues.some(i => i.message.includes('resource'))).toBe(true);
  });

  it('detects privileged container', async () => {
    const content = 'spec:\n  containers:\n  - securityContext:\n      privileged: true\n    resources:\n      limits:\n        cpu: 100m\n    livenessProbe: {}\n    readinessProbe: {}\n    securityContext: {}';
    const res = await request(app).post('/api/devops/analyze/k8s').send({ content });
    expect(res.body.issues.some(i => i.message.includes('Privileged'))).toBe(true);
  });
});

describe('analyzeDockerfile (unit)', () => {
  const { analyzeDockerfile } = require('../src/services/aiService');

  it('flags ADD instruction', () => {
    const result = analyzeDockerfile('FROM node:18\nADD . /app\nUSER node');
    expect(result.issues.some(i => i.message.includes('COPY over ADD'))).toBe(true);
  });

  it('flags chmod 777', () => {
    const result = analyzeDockerfile('FROM node:18\nRUN chmod 777 /app\nUSER node');
    expect(result.issues.some(i => i.message.includes('chmod 777'))).toBe(true);
  });
});

describe('analyzeK8sManifest (unit)', () => {
  const { analyzeK8sManifest } = require('../src/services/aiService');

  it('flags missing livenessProbe', () => {
    const result = analyzeK8sManifest('resources: {}\nreadinessProbe: {}\nsecurityContext: {}');
    expect(result.issues.some(i => i.message.includes('livenessProbe'))).toBe(true);
  });

  it('returns score 100 for fully configured manifest', () => {
    const content = 'resources: {}\nlivenessprobe: {}\nreadinessprobe: {}\nsecuritycontext: {}';
    const result = analyzeK8sManifest(content);
    expect(result.score).toBe(100);
  });
});
