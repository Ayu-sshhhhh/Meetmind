'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.OPENAI_API_KEY = '';
process.env.MEETMIND_LOCAL_TRANSCRIPTION = 'false';
process.env.MEETMIND_LOCAL_DIARIZATION = 'false';

const { createAppServer } = require('../server.js');

async function withServer(run) {
  const server = createAppServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
    });
  }
}

test('GET /api/health returns the health payload', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(typeof payload.mode, 'string');
    assert.equal(typeof payload.capabilities, 'object');
  });
});

test('GET / serves the application shell', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/html/i);
    assert.match(html, /MeetMind/i);
    assert.match(html, /Analyze a Meeting/i);
  });
});

test('POST /api/process handles pasted transcript input', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'paste',
        title: 'Sprint Sync',
        text: [
          'Alex: We need to ship the dashboard update this week.',
          'Sam: I will finish QA by Friday.',
          'Alex: Decision: keep the existing onboarding flow for this release.'
        ].join('\n')
      })
    });

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.meta.source, 'paste');
    assert.equal(payload.meta.analysisModel, 'local-fallback');
    assert.match(payload.data.summary.body, /\S/);
    assert.match(payload.data.summary.body, /onboarding flow|finish qa|dashboard update/i);
    assert.ok(Array.isArray(payload.data.importantPoints));
    assert.ok(payload.data.importantPoints.some(point => /onboarding flow|dashboard update|finish qa/i.test(point.title)));
    assert.ok(payload.data.summary.sections);
    assert.ok(payload.data.summary.sections.outcomes.some(item => /onboarding flow|dashboard update/i.test(item)));
    assert.ok(payload.data.summary.sections.nextSteps.some(item => /ship the dashboard update|finish qa/i.test(item)));
    assert.ok(Array.isArray(payload.data.lines));
    assert.ok(payload.data.lines.length >= 2);
  });
});

test('POST /api/process keeps local summaries grounded when no actions are present', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'paste',
        title: 'Feedback Review',
        text: [
          'Alex: We reviewed customer feedback from March.',
          'Sam: The login complaints came up again.',
          'Alex: The main concern is password reset confusion.'
        ].join('\n')
      })
    });

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.meta.analysisModel, 'local-fallback');
    assert.doesNotMatch(payload.data.summary.body, /concrete next steps|ownership|follow-up work/i);
    assert.match(payload.data.summary.body, /customer feedback|login complaints|password reset confusion/i);
    assert.ok(Array.isArray(payload.data.importantPoints));
    assert.ok(payload.data.importantPoints.some(point => /login complaints|password reset confusion/i.test(point.title)));
    assert.ok(payload.data.summary.sections);
    assert.ok(payload.data.summary.sections.risks.some(item => /login complaints|password reset confusion/i.test(item)));
    assert.doesNotMatch(payload.data.summary.body, /frequently mentioned topics included alex/i);
    assert.ok(payload.data.summary.topics.some(topic => /customer feedback|login complaints|password reset confusion/i.test(topic)));
    assert.ok(payload.data.summary.topics.every(topic => !/alex|sam/i.test(topic)));
  });
});

test('POST /api/process does not expose placeholder assignees for unlabeled transcript text', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'paste',
        title: 'Unlabeled Follow-up',
        text: 'We need to send the revised proposal tomorrow.'
      })
    });

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.meta.analysisModel, 'local-fallback');
    assert.equal(payload.data.actions[0]?.assignee, 'Unassigned');
    assert.equal(payload.data.summary.speakers.length, 0);
    assert.deepEqual(payload.data.participants, []);
  });
});

test('POST /api/process ignores date, time, and location metadata as participants', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'paste',
        title: 'Metadata Parsing',
        text: [
          'Date: April 6, 2026',
          'Time: 10:30 AM',
          'Location: Mumbai Office',
          'Alex: We reviewed the launch plan for next week.',
          'Sam: I will send the revised deck by Friday.'
        ].join('\n')
      })
    });

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.data.summary.speakers, ['Alex', 'Sam']);
    assert.ok(payload.data.participants.every(participant => !/date|time|location|mumbai office/i.test(participant.name)));
    assert.ok(payload.data.lines.every(line => !/date|time|location/i.test(line.speaker)));
  });
});
