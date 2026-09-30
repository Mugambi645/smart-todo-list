process.env.USE_LOCAL_FALLBACK = 'true';
const request = require('supertest');
const app = require('../index');
const { classifyTask } = require('../services/classifier');

describe('health check', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('classifier local fallback', () => {
  it('flags urgent language as high priority', async () => {
    const result = await classifyTask('URGENT: pay the electricity bill today');
    expect(result.priority).toBe('high');
  });

  it('categorizes shopping-related tasks', async () => {
    const result = await classifyTask('buy groceries for the week');
    expect(result.category).toBe('Shopping');
  });
});
