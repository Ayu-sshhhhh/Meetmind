'use strict';

const http = require('node:http');
const { execFile, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');

const ROOT = __dirname;
const ENV = loadEnvFile(path.join(ROOT, '.env'));
const PORT = Number(process.env.PORT || ENV.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ENV.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const ANALYSIS_MODEL = process.env.MEETMIND_ANALYSIS_MODEL || ENV.MEETMIND_ANALYSIS_MODEL || 'gpt-4o-mini';
const OPENAI_TRANSCRIPTION_MODEL = process.env.MEETMIND_OPENAI_TRANSCRIPTION_MODEL || ENV.MEETMIND_OPENAI_TRANSCRIPTION_MODEL || process.env.MEETMIND_TRANSCRIPTION_MODEL || ENV.MEETMIND_TRANSCRIPTION_MODEL || 'gpt-4o-transcribe-diarize';
const MEDIA_PROCESSING_MODE = normalizeMode(process.env.MEETMIND_MEDIA_PROCESSING_MODE || ENV.MEETMIND_MEDIA_PROCESSING_MODE || 'auto');
const LOCAL_TRANSCRIPTION_ENABLED = String(process.env.MEETMIND_LOCAL_TRANSCRIPTION || ENV.MEETMIND_LOCAL_TRANSCRIPTION || 'true').toLowerCase() !== 'false';
const LOCAL_ONLY_MEDIA_PROCESSING = String(process.env.MEETMIND_LOCAL_ONLY_MEDIA_PROCESSING || ENV.MEETMIND_LOCAL_ONLY_MEDIA_PROCESSING || 'false').toLowerCase() !== 'false';
const LOCAL_WHISPER_MODEL = process.env.MEETMIND_LOCAL_WHISPER_MODEL || ENV.MEETMIND_LOCAL_WHISPER_MODEL || 'base';
const OPENAI_REQUEST_TIMEOUT_MS = Math.max(5 * 1000, Number(process.env.MEETMIND_OPENAI_TIMEOUT_MS || ENV.MEETMIND_OPENAI_TIMEOUT_MS || 120 * 1000) || 120 * 1000);
const LOCAL_DIARIZATION_ENABLED = String(process.env.MEETMIND_LOCAL_DIARIZATION || ENV.MEETMIND_LOCAL_DIARIZATION || 'true').toLowerCase() !== 'false';
const LOCAL_DIARIZATION_MODEL = process.env.MEETMIND_LOCAL_DIARIZATION_MODEL || ENV.MEETMIND_LOCAL_DIARIZATION_MODEL || 'pyannote/speaker-diarization-community-1';
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN || ENV.HUGGINGFACE_TOKEN || '';
const LOCAL_PYTHON_BIN = process.env.MEETMIND_PYTHON_BIN || ENV.MEETMIND_PYTHON_BIN || 'python';
const LOCAL_WHISPER_SCRIPT = path.join(ROOT, 'tools', 'faster_whisper_transcribe.py');
const HAS_OPENAI_KEY = hasUsableSecret(OPENAI_API_KEY);
const HAS_HUGGINGFACE_TOKEN = hasUsableSecret(HUGGINGFACE_TOKEN);
const ACTIVE_PROVIDER = HAS_OPENAI_KEY ? 'openai' : 'none';
const MAX_MEDIA_BYTES = 512 * 1024 * 1024;
const HEALTH_CACHE_TTL_MS = 30 * 1000;
let cachedLocalRuntimeHealth = null;
let cachedLocalRuntimeHealthAt = 0;

const STATIC_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const MEETING_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'actions', 'decisions', 'participantSentiments'],
  properties: {
    summary: {
      type: 'object',
      additionalProperties: false,
      required: ['body', 'topics'],
      properties: {
        body: { type: 'string' },
        topics: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['assignee', 'task', 'deadline', 'priority'],
        properties: {
          assignee: { type: 'string' },
          task: { type: 'string' },
          deadline: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] }
        }
      }
    },
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'context', 'speaker'],
        properties: {
          title: { type: 'string' },
          context: { type: 'string' },
          speaker: { type: 'string' }
        }
      }
    },
    participantSentiments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'sentiment'],
        properties: {
          name: { type: 'string' },
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'critical'] }
        }
      }
    }
  }
};

const ANALYSIS_INSTRUCTIONS = [
  'You analyze meeting transcripts for an action-oriented workspace.',
  'Return only JSON that matches the provided schema.',
  'Use only facts that are explicitly stated in the transcript.',
  'Do not invent attendees, decisions, actions, deadlines, sentiment, or outcomes.',
  'When the transcript is ambiguous or incomplete, keep the summary cautious and leave unsupported fields empty.',
  'Prefer short, grounded paraphrases over broad interpretation.',
  'Write a concise executive summary in 3 to 5 sentences.',
  'Extract up to 8 action items with assignee, task, deadline, and priority.',
  'Extract up to 6 key decisions with title, short context, and speaker.',
  'Participant sentiments must use only: positive, neutral, critical.',
  'If a deadline is missing, use "TBD".',
  'Do not use markdown, bullets, bold, italics, numbering, backticks, or emphasis markers in any field values.',
  'Do not wrap the JSON in markdown.'
].join(' ');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const parsed = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendError(res, statusCode, message, details) {
  json(res, statusCode, {
    ok: false,
    error: details ? `${message} ${details}`.trim() : message
  });
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeMode(value) {
  const mode = normalizeWhitespace(value).toLowerCase();
  if (mode === 'local' || mode === 'openai') return mode;
  return 'auto';
}

function hasUsableSecret(value) {
  const text = normalizeWhitespace(value);
  if (!text) return false;

  const lower = text.toLowerCase();
  return !(
    lower.startsWith('your_') ||
    lower.startsWith('your-') ||
    lower.includes('placeholder') ||
    lower.includes('replace_me') ||
    lower.endsWith('_here')
  );
}

function stripMarkdownFormatting(value) {
  let text = normalizeWhitespace(value);
  if (!text) return '';

  text = text
    .replace(/^\s*[-*+]\s+/g, '')
    .replace(/^\s*\d+[.)]\s+/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?;:]|$)/g, '$1$2')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?;:]|$)/g, '$1$2');

  return normalizeWhitespace(text);
}

function titleCaseSpeaker(value, fallbackIndex) {
  const cleaned = normalizeWhitespace(value);
  if (!cleaned) return `Speaker ${fallbackIndex}`;
  if (/^speaker[_\s-]*\d+$/i.test(cleaned)) {
    const num = cleaned.match(/\d+/)?.[0] || fallbackIndex;
    return `Speaker ${num}`;
  }
  if (/^[a-z0-9_-]+$/i.test(cleaned) && cleaned === cleaned.toLowerCase()) {
    return cleaned.split(/[_-]+/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }
  return cleaned;
}

function isPlaceholderSpeakerLabel(value) {
  return /^speaker(?:[\s_-]+)\d+$/i.test(normalizeWhitespace(value));
}

function getVisibleSpeakerNames(lines) {
  return [...new Set((Array.isArray(lines) ? lines : [])
    .map(line => normalizeWhitespace(line?.speaker))
    .filter(Boolean)
    .filter(speaker => !isPlaceholderSpeakerLabel(speaker)))];
}

function extractTopics(text, limit = 6) {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'that', 'this', 'from',
    'into', 'onto', 'there', 'their', 'about', 'have', 'will', 'would', 'could',
    'should', 'because', 'while', 'where', 'which', 'what', 'when', 'were', 'been',
    'they', 'them', 'our', 'your', 'you', 'are', 'was', 'not', 'need', 'next',
    'than', 'then', 'also', 'just', 'more', 'most', 'some', 'such'
  ]);
  const freq = new Map();
  normalizeWhitespace(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).forEach(word => {
    if (word.length < 4 || stopWords.has(word)) return;
    freq.set(word, (freq.get(word) || 0) + 1);
  });
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}

function humanJoin(items) {
  const cleaned = [...new Set((Array.isArray(items) ? items : [])
    .map(item => normalizeWhitespace(stripMarkdownFormatting(item)))
    .filter(Boolean))];

  if (cleaned.length === 0) return '';
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(', ')}, and ${cleaned[cleaned.length - 1]}`;
}

function lowercaseFirst(value) {
  const text = normalizeWhitespace(value);
  if (!text) return '';
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function toMeaningfulWordSet(text) {
  const ignored = new Set([
    'about', 'after', 'again', 'also', 'been', 'before', 'being', 'came', 'could',
    'decision', 'discuss', 'discussed', 'follow', 'from', 'have', 'into', 'need',
    'review', 'reviewed', 'should', 'that', 'their', 'them', 'they', 'this',
    'those', 'transcript', 'were', 'what', 'when', 'which', 'while', 'will', 'with',
    'would'
  ]);

  return new Set(normalizeWhitespace(stripMarkdownFormatting(text))
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 4 && !ignored.has(word)));
}

function hasStrongWordOverlap(left, right) {
  const leftWords = toMeaningfulWordSet(left);
  const rightWords = toMeaningfulWordSet(right);
  if (leftWords.size === 0 || rightWords.size === 0) return false;

  let overlap = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) overlap += 1;
  }

  return overlap >= Math.min(leftWords.size, rightWords.size, 2);
}

function extractTopicPhrases(lines, limit = 6) {
  const speakerWords = new Set(getVisibleSpeakerNames(lines)
    .flatMap(name => name.toLowerCase().split(/\s+/))
    .filter(Boolean));
  const ignoredWords = new Set([
    'about', 'after', 'again', 'align', 'aligned', 'around', 'before', 'because',
    'came', 'cover', 'covered', 'decision', 'decided', 'discuss', 'discussed',
    'concern', 'existing', 'finish', 'focus', 'focused', 'follow', 'for', 'friday', 'from', 'going',
    'keep', 'launch', 'march', 'monday', 'month', 'need', 'plan', 'planned',
    'main', 'prepare', 'priority', 'problem', 'project', 'qa', 'release', 'review',
    'reviewed', 'risk', 'saturday', 'schedule', 'send', 'ship', 'should', 'sprint',
    'strategy', 'sunday', 'team', 'the', 'thursday', 'this', 'today', 'tomorrow',
    'transcript', 'tuesday', 'urgent', 'week', 'wednesday', 'will', 'work'
  ]);
  const phrases = [];

  for (const line of Array.isArray(lines) ? lines : []) {
    const words = normalizeWhitespace(stripMarkdownFormatting(line?.text))
      .split(/\s+/)
      .map(word => word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
      .filter(Boolean);

    for (let index = 0; index < words.length; index += 1) {
      for (let size = 4; size >= 2; size -= 1) {
        const candidate = words.slice(index, index + size);
        if (candidate.length !== size) continue;
        if (candidate.some(word => word.length < 3 || speakerWords.has(word) || ignoredWords.has(word))) continue;

        phrases.push({
          phrase: candidate.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          score: size * 10 - index
        });
      }
    }
  }

  const selected = [];
  for (const entry of phrases.sort((a, b) => b.score - a.score || a.phrase.length - b.phrase.length)) {
    const canonical = entry.phrase.toLowerCase();
    if (selected.some(item => item.toLowerCase().includes(canonical) || canonical.includes(item.toLowerCase()))) continue;
    selected.push(entry.phrase);
    if (selected.length >= limit) break;
  }

  return selected;
}

function ensureTrailingPunctuation(value) {
  const text = normalizeWhitespace(stripMarkdownFormatting(value));
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function collectSummaryEvidence(lines, limit = 3) {
  const evidence = [];
  const seen = new Set();
  const keywords = /\b(decision|decided|agreed|plan|priority|goal|need to|should|will|follow up|follow-up|next step|deadline|risk|blocker|launch|ship)\b/i;

  function pushSentence(sentence, index, emphasis = 0) {
    const text = normalizeWhitespace(stripMarkdownFormatting(sentence));
    if (!text || text.length < 18) return;

    const canonical = text.toLowerCase();
    if (seen.has(canonical)) return;
    seen.add(canonical);

    evidence.push({
      text,
      index,
      score: emphasis + (keywords.test(text) ? 3 : 0) + (text.length <= 180 ? 1 : 0)
    });
  }

  (Array.isArray(lines) ? lines : []).forEach((line, index) => {
    const text = normalizeWhitespace(line?.text);
    if (!text) return;

    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length === 0) {
      pushSentence(text, index);
      return;
    }

    sentences.forEach((sentence, sentenceIndex) => {
      pushSentence(sentence, index, sentenceIndex === 0 ? 1 : 0);
    });
  });

  return evidence
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map(item => ensureTrailingPunctuation(item.text));
}

function formatActionSummary(action) {
  const assignee = normalizeWhitespace(stripMarkdownFormatting(action?.assignee));
  const taskText = normalizeWhitespace(stripMarkdownFormatting(action?.task))
    .replace(/\.$/, '')
    .replace(/^(?:we|i|you)\s+/i, '')
    .replace(/^(?:need(?:s)? to|should|must|will|going to|plan to|plans to)\s+/i, '');
  if (!taskText) return '';

  const task = ensureTrailingPunctuation(`to ${lowercaseFirst(taskText)}`);
  if (assignee && assignee !== 'Unassigned') {
    return `${assignee} committed ${task}`;
  }

  return `A follow-up captured in the transcript was ${task}`;
}

function formatDecisionSummary(decision) {
  const title = normalizeWhitespace(stripMarkdownFormatting(decision?.title)).replace(/^decision\s*:\s*/i, '');
  if (!title) return '';
  return `A recorded decision was ${ensureTrailingPunctuation(`to ${lowercaseFirst(title.replace(/\.$/, ''))}`)}`;
}

function buildFallbackSummary(lines) {
  const speakers = getVisibleSpeakerNames(lines);
  const transcript = lines.map(line => line.text).join(' ');
  const topics = extractTopics(transcript, 4);
  const evidence = collectSummaryEvidence(lines, 2);
  const parts = [];

  if (speakers.length > 1) {
    const speakerList = speakers.slice(0, 3).join(', ') + (speakers.length > 3 ? ` and ${speakers.length - 3} others` : '');
    parts.push(`The transcript included contributions from ${speakerList}.`);
  }
  if (topics.length > 0) {
    parts.push(`Frequently mentioned topics included ${topics.slice(0, 3).join(', ')}.`);
  }
  parts.push(...evidence);

  return normalizeWhitespace(parts.filter(Boolean).join(' '));
}

function parseTranscriptText(text) {
  const rawText = String(text || '');
  const rawLines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const ignoredLabels = new Set([
    'action items',
    'actions',
    'agenda',
    'attendees',
    'date',
    'decision',
    'decisions',
    'follow up',
    'follow-up',
    'key points',
    'location',
    'meeting notes',
    'next steps',
    'notes',
    'summary',
    'takeaways',
    'time',
    'topics',
    'transcript'
  ]);
  const metadataLinePatterns = [
    /^(meeting (started|ended)|recording (started|stopped)|transcript (started|ended)|live transcript)$/i,
    /^(date|time|location|venue|attendees|participants)\s*:/i,
    /^(joined|left|entered|exited|rejoined|disconnected|connected|is presenting|started presenting)/i,
    /^[A-Za-z0-9 .,'&/_-]{2,60}\s+(joined|left|entered|exited|rejoined|disconnected|connected|is presenting|started presenting)\b/i,
    /^(today|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+[a-z]+\s+\d{1,2},?\s+\d{4}$/i,
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}$/i,
    /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:,\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)?$/i,
    /^\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?$/i
  ];

  function normalizeSpeakerCandidate(value) {
    return normalizeWhitespace(value)
      .replace(/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}[,\s-]*/i, '')
      .replace(/^[\[(]?\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?[\])]?[\s-]*/i, '')
      .replace(/\s*[\[(]?\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?[\])]?$/i, '')
      .replace(/\s*[-|]\s*$/g, '')
      .trim();
  }

  function isMetadataLine(value) {
    const cleaned = normalizeWhitespace(value);
    if (!cleaned) return true;
    return metadataLinePatterns.some(pattern => pattern.test(cleaned));
  }

  function isLikelySpeakerLabel(label) {
    const cleaned = normalizeSpeakerCandidate(label);
    const lower = cleaned.toLowerCase();
    if (!cleaned || cleaned.length > 40) return false;
    if (ignoredLabels.has(lower)) return false;
    if (/\b(?:office|room|venue|campus|building|floor|headquarters|hq|address|meeting link|zoom|google meet|teams)\b/i.test(cleaned)) return false;
    if (/^(?:date|time|location|venue|attendees|participants)\b/i.test(lower)) return false;
    if (/^(?:\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})$/i.test(cleaned)) return false;
    if (/[.?!]/.test(cleaned)) return false;
    if (!/^[A-Za-z0-9][A-Za-z0-9 '&/_-]{0,39}$/.test(cleaned)) return false;
    const words = cleaned.split(/\s+/).filter(Boolean);
    return words.length > 0 && words.length <= 5;
  }

  function extractSpeakerTurn(rawLine) {
    const line = normalizeWhitespace(rawLine);
    if (!line || isMetadataLine(line)) return null;

    const patterns = [
      /^(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}[,\s-]+)?[\[(]?\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?[\])]?\s+([^:-]{2,60}?)[-:]\s+(.+)$/i,
      /^[\[(]?\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?[\])]?\s+([^:-]{2,60}?)[-:]\s+(.+)$/i,
      /^(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}[,\s-]+)?([^:]{2,60}?)\s+[\[(]?\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?[\])]?:\s+(.+)$/i,
      /^([^:]{2,60}?)\s+[\[(]?\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?[\])]?:\s+(.+)$/i,
      /^([^:]{2,60}?):\s+(.+)$/
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) continue;
      const speaker = normalizeSpeakerCandidate(match[1]);
      if (!isLikelySpeakerLabel(speaker)) continue;
      return {
        speaker,
        text: normalizeWhitespace(match[2])
      };
    }

    return null;
  }

  function extractSpeakerHeader(rawLine) {
    const line = normalizeWhitespace(rawLine);
    if (!line || isMetadataLine(line)) return null;
    const match = line.match(/^(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}[,\s-]+)?(.{2,60}?)\s+[\[(]?\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?[\])]?$/i);
    if (!match) return null;
    const speaker = normalizeSpeakerCandidate(match[1]);
    return isLikelySpeakerLabel(speaker) ? speaker : null;
  }

  const labeledLineCount = rawLines.reduce((count, rawLine) => {
    return count + (extractSpeakerTurn(rawLine) ? 1 : 0);
  }, 0);
  const looksLikeSpeakerTranscript = labeledLineCount >= 2;

  if (!looksLikeSpeakerTranscript) {
    const paragraphs = rawText
      .split(/\r?\n\s*\r?\n/)
      .map(paragraph => normalizeWhitespace(paragraph))
      .filter(paragraph => !isMetadataLine(paragraph))
      .filter(Boolean);
    const blocks = paragraphs.length > 0 ? paragraphs : [normalizeWhitespace(rawText)].filter(Boolean);
    return blocks.map(block => ({
      speaker: 'Speaker 1',
      text: block
    }));
  }

  const lines = [];
  let pendingSpeaker = '';
  for (const rawLine of rawLines) {
    if (isMetadataLine(rawLine)) continue;
    const turn = extractSpeakerTurn(rawLine);
    if (turn) {
      lines.push({
        speaker: titleCaseSpeaker(turn.speaker, lines.length + 1),
        text: turn.text
      });
      pendingSpeaker = '';
      continue;
    }

    const headerSpeaker = extractSpeakerHeader(rawLine);
    if (headerSpeaker) {
      pendingSpeaker = titleCaseSpeaker(headerSpeaker, lines.length + 1);
      continue;
    }

    const continuation = normalizeWhitespace(rawLine);
    if (!continuation) continue;
    if (lines.length === 0) {
      lines.push({
        speaker: pendingSpeaker || 'Speaker 1',
        text: continuation
      });
      pendingSpeaker = '';
      continue;
    }

    if (pendingSpeaker && pendingSpeaker !== lines[lines.length - 1].speaker) {
      lines.push({
        speaker: pendingSpeaker,
        text: continuation
      });
      pendingSpeaker = '';
      continue;
    }

    lines[lines.length - 1].text = normalizeWhitespace(`${lines[lines.length - 1].text} ${continuation}`);
  }

  return lines.filter(line => line.text.length > 1);
}

function mergeDiarizedSegments(segments) {
  const merged = [];
  let fallbackIndex = 1;

  for (const segment of Array.isArray(segments) ? segments : []) {
    const text = normalizeWhitespace(segment?.text);
    if (!text) continue;
    const speaker = titleCaseSpeaker(segment?.speaker, fallbackIndex);
    const start = typeof segment?.start === 'number' ? segment.start : null;
    const end = typeof segment?.end === 'number' ? segment.end : null;
    const previous = merged[merged.length - 1];
    const isSameSpeaker = previous && previous.speaker === speaker;
    const isCloseGap = previous && typeof previous.end === 'number' && typeof start === 'number' ? start - previous.end <= 1.5 : false;

    if (isSameSpeaker && isCloseGap) {
      previous.text = normalizeWhitespace(`${previous.text} ${text}`);
      previous.end = end ?? previous.end;
    } else {
      merged.push({ speaker, text, start, end });
    }

    fallbackIndex += 1;
  }

  return merged.map(({ speaker, text }) => ({ speaker, text }));
}

function formatTranscript(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map(line => `${line.speaker}: ${line.text}`)
    .join('\n');
}

function analyseSentiment(text) {
  const pos = /\b(great|excellent|perfect|good|agree|congratulations|proud|success|excited|happy|glad|appreciate|achieved|exceeded|positive|fantastic|wonderful|strong|clear|improve|growth|benefit|opportunity|win)\b/gi;
  const neg = /\b(problem|issue|concern|fail|behind|delay|miss|critical|urgent|block|difficult|challenge|risk|worried|frustrated|unclear|conflict|decline|loss|stuck|bad|wrong|error|complaint)\b/gi;
  const posCount = (String(text || '').match(pos) || []).length;
  const negCount = (String(text || '').match(neg) || []).length;
  if (posCount > negCount * 1.5) return 'positive';
  if (negCount > posCount * 1.5) return 'critical';
  return 'neutral';
}

function computeScore(lines, actions, decisions) {
  const wordCount = countWords(lines.map(line => line.text).join(' '));
  const speakerCount = Math.max(1, getVisibleSpeakerNames(lines).length);
  const actionScore = Math.min(100, actions.length * 14);
  const decisionScore = Math.min(100, decisions.length * 18);
  const engageScore = Math.min(100, speakerCount * 22);
  const lengthScore = wordCount > 120 ? Math.min(100, Math.round(wordCount / 8)) : 40;
  const overall = Math.round((actionScore * 0.3) + (decisionScore * 0.3) + (engageScore * 0.2) + (lengthScore * 0.2));
  return {
    overall: Math.min(98, overall),
    actionScore,
    decisionScore,
    engageScore,
    lengthScore
  };
}

function buildParticipants(lines, sentimentOverrides) {
  const totalWords = Math.max(1, countWords(lines.map(line => line.text).join(' ')));
  const buckets = new Map();

  for (const line of lines) {
    if (isPlaceholderSpeakerLabel(line?.speaker)) continue;
    if (!buckets.has(line.speaker)) {
      buckets.set(line.speaker, { turns: 0, words: 0, texts: [] });
    }
    const bucket = buckets.get(line.speaker);
    bucket.turns += 1;
    bucket.words += countWords(line.text);
    bucket.texts.push(line.text);
  }

  return [...buckets.entries()].map(([name, bucket]) => ({
    name,
    turns: bucket.turns,
    words: bucket.words,
    talkPct: Math.max(1, Math.round((bucket.words / totalWords) * 100)),
    sentiment: sentimentOverrides.get(name.toLowerCase()) || analyseSentiment(bucket.texts.join(' '))
  }));
}

function buildLocalSummary(lines) {
  const speakers = getVisibleSpeakerNames(lines);
  const actions = extractActionItemsLocallySafe(lines);
  const decisions = extractDecisionsLocallySafe(lines);
  const topics = extractTopicPhrases(lines, 6);
  const evidence = collectSummaryEvidence(lines, 4);
  const speakerList = speakers.length === 0
    ? 'the team'
    : speakers.slice(0, 3).join(', ') + (speakers.length > 3 ? ` and ${speakers.length - 3} others` : '');
  const parts = [];
  const seen = new Set();

  function pushPart(text) {
    const cleaned = normalizeWhitespace(text);
    if (!cleaned) return;
    const canonical = cleaned.toLowerCase();
    if (seen.has(canonical)) return;
    seen.add(canonical);
    parts.push(cleaned);
  }

  if (topics.length > 0) {
    if (speakers.length > 0) {
      pushPart(`${speakerList} discussed ${humanJoin(topics.slice(0, 3))}.`);
    } else {
      pushPart(`The transcript focused on ${humanJoin(topics.slice(0, 3))}.`);
    }
  } else if (speakers.length > 0) {
    pushPart(`This transcript includes ${speakerList}.`);
  }
  pushPart(formatDecisionSummary(decisions[0]));
  pushPart(formatActionSummary(actions[0]));

  const supportingEvidence = evidence.filter(sentence => {
    if (decisions[0]?.title && hasStrongWordOverlap(sentence, decisions[0].title)) return false;
    if (actions[0]?.task && hasStrongWordOverlap(sentence, actions[0].task)) return false;
    return true;
  });

  if (parts.length < 2) {
    supportingEvidence.slice(0, 2).forEach(pushPart);
  } else if (parts.length < 3) {
    supportingEvidence.slice(0, 1).forEach(pushPart);
  }

  const body = parts.slice(0, 4).join(' ');

  return {
    body: normalizeWhitespace(body),
    topics: topics.length > 0 ? topics : ['Meeting']
  };
}

function extractActionItemsLocally(lines) {
  const actionKeywords = [
    /\bi['’]?ll\b/i, /\bi will\b/i, /\bwe['’]?ll\b/i, /\bwe will\b/i, /\byou['’]?ll\b/i, /\byou will\b/i,
    /\bgoing to\b/i, /\bneed to\b/i, /\bshould\b/i, /\bresponsible for\b/i, /\bhandle\b/i,
    /\bcoordinate\b/i, /\bprepare\b/i, /\bschedule\b/i, /\bcreate\b/i, /\bdocument\b/i,
    /\bset up\b/i, /\bkick off\b/i, /\bupdate\b/i
  ];
  const datePattern = /\b(?:by|on|before|until|end of|next|this)\s+[\w,\s]+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|quarter|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}(?:st|nd|rd|th)?)/i;
  const seen = new Set();
  const actions = [];

  for (const line of Array.isArray(lines) ? lines : []) {
    const text = normalizeWhitespace(line?.text);
    if (!text || !actionKeywords.some(keyword => keyword.test(text))) continue;

    let priority = 'low';
    if (/\b(critical|urgent|asap|immediately|priority|must)\b/i.test(text)) priority = 'high';
    else if (/\b(need|should|important)\b/i.test(text)) priority = 'medium';

    let task = text;
    task = task.replace(/^\s*let['’]?s\s+/i, '');
    task = task.replace(/^\s*(?:i|we|you)\s+(?:need to|should|must)\s+/i, '');
    task = task.replace(/^\s*(?:i['’]?ll|i will|we['’]?ll|we will|you['’]?ll|you will)\s+/i, '');
    task = task.replace(/^\s*(?:need to|should|must)\s+/i, '');
    task = task.replace(/\.$/, '');
    task = stripMarkdownFormatting(task);
    if (!task) continue;
    task = task.charAt(0).toUpperCase() + task.slice(1);

    const dedupeKey = `${String(line?.speaker || '').toLowerCase()}|${task.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const deadlineMatch = text.match(datePattern);
    actions.push({
      assignee: stripMarkdownFormatting(line?.speaker) || 'Unassigned',
      task,
      deadline: deadlineMatch ? deadlineMatch[0].trim() : 'TBD',
      priority
    });

    if (actions.length >= 8) break;
  }

  return actions;
}

function extractDecisionsLocally(lines) {
  const decisionKeywords = [
    /\bdecision(?:\s*:|\s+(?:is|was|has been)\b)/i,
    /\bdecided\b/i, /\bagreed\b/i, /\bgoing with\b/i,
    /\bwe['’]?re moving to\b/i, /\bwe['’]?ve chosen\b/i,
    /\bour approach\b/i, /\bprioritize\b/i,
    /\boverall.*direction\b/i, /\bnorth star\b/i
  ];
  const decisions = [];
  const seen = new Set();

  for (let index = 0; index < (Array.isArray(lines) ? lines.length : 0); index += 1) {
    const line = lines[index];
    const text = normalizeWhitespace(line?.text);
    if (!text || !decisionKeywords.some(keyword => keyword.test(text))) continue;

    let title = stripMarkdownFormatting(text);
    if (title.length > 80) title = `${title.slice(0, 77)}...`;
    const dedupeKey = title.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const context = normalizeWhitespace(lines[index - 1]?.text || lines[index + 1]?.text || '');
    decisions.push({
      title,
      context: stripMarkdownFormatting(context),
      speaker: stripMarkdownFormatting(line?.speaker) || 'Unknown'
    });

    if (decisions.length >= 6) break;
  }

  return decisions;
}

function extractActionItemsLocallySafe(lines) {
  const actionKeywords = [
    /\bi[\u2019']?ll\b/i, /\bi will\b/i, /\bwe[\u2019']?ll\b/i, /\bwe will\b/i, /\byou[\u2019']?ll\b/i, /\byou will\b/i,
    /\bgoing to\b/i, /\bneed to\b/i, /\bshould\b/i, /\bresponsible for\b/i, /\bhandle\b/i,
    /\bcoordinate\b/i, /\bprepare\b/i, /\bschedule\b/i, /\bcreate\b/i, /\bdocument\b/i,
    /\bset up\b/i, /\bkick off\b/i, /\bupdate\b/i
  ];
  const datePattern = /\b(?:by|on|before|until|end of|next|this)\s+[\w,\s]+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|quarter|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}(?:st|nd|rd|th)?)/i;
  const seen = new Set();
  const actions = [];

  for (const line of Array.isArray(lines) ? lines : []) {
    const text = normalizeWhitespace(line?.text);
    if (!text || !actionKeywords.some(keyword => keyword.test(text))) continue;

    let priority = 'low';
    if (/\b(critical|urgent|asap|immediately|priority|must)\b/i.test(text)) priority = 'high';
    else if (/\b(need|should|important)\b/i.test(text)) priority = 'medium';

    let task = text;
    task = task.replace(/^\s*let[\u2019']?s\s+/i, '');
    task = task.replace(/^\s*(?:i|we|you)\s+(?:need to|should|must)\s+/i, '');
    task = task.replace(/^\s*(?:i[\u2019']?ll|i will|we[\u2019']?ll|we will|you[\u2019']?ll|you will)\s+/i, '');
    task = task.replace(/^\s*(?:need to|should|must)\s+/i, '');
    task = task.replace(/\.$/, '');
    task = stripMarkdownFormatting(task);
    if (!task) continue;
    task = task.charAt(0).toUpperCase() + task.slice(1);

    const dedupeKey = `${String(line?.speaker || '').toLowerCase()}|${task.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const deadlineMatch = text.match(datePattern);
    actions.push({
      assignee: stripMarkdownFormatting(line?.speaker) || 'Unassigned',
      task,
      deadline: deadlineMatch ? deadlineMatch[0].trim() : 'TBD',
      priority
    });

    if (actions.length >= 8) break;
  }

  return actions;
}

function extractDecisionsLocallySafe(lines) {
  const decisionKeywords = [
    /\bdecision(?:\s*:|\s+(?:is|was|has been)\b)/i,
    /\bdecided\b/i, /\bagreed\b/i, /\bgoing with\b/i,
    /\bwe[\u2019']?re moving to\b/i, /\bwe[\u2019']?ve chosen\b/i,
    /\bour approach\b/i, /\bprioritize\b/i,
    /\boverall.*direction\b/i, /\bnorth star\b/i
  ];
  const decisions = [];
  const seen = new Set();

  for (let index = 0; index < (Array.isArray(lines) ? lines.length : 0); index += 1) {
    const line = lines[index];
    const text = normalizeWhitespace(line?.text);
    if (!text || !decisionKeywords.some(keyword => keyword.test(text))) continue;

    let title = stripMarkdownFormatting(text);
    if (title.length > 80) title = `${title.slice(0, 77)}...`;
    const dedupeKey = title.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const context = normalizeWhitespace(lines[index - 1]?.text || lines[index + 1]?.text || '');
    decisions.push({
      title,
      context: stripMarkdownFormatting(context),
      speaker: stripMarkdownFormatting(line?.speaker) || 'Unknown'
    });

    if (decisions.length >= 6) break;
  }

  return decisions;
}

function buildParticipantSentimentOverrides(lines) {
  return buildParticipants(Array.isArray(lines) ? lines : [], new Map())
    .map(({ name, sentiment }) => ({ name, sentiment }));
}

function analyzeTranscriptLocally(lines) {
  return {
    summary: buildLocalSummary(lines),
    actions: extractActionItemsLocallySafe(lines),
    decisions: extractDecisionsLocallySafe(lines),
    participantSentiments: buildParticipantSentimentOverrides(lines)
  };
}

function isProviderAccessIssue(error) {
  const message = normalizeWhitespace(error?.message).toLowerCase();
  const statusCode = Number(error?.statusCode);

  return Boolean(message) && (
    message.includes('openai_api_key is missing') ||
    message.includes('openai accepted the api key') ||
    message.includes('openai rejected it') ||
    message.includes('quota') ||
    message.includes('billing') ||
    message.includes('credit') ||
    message.includes('rate limit') ||
    message.includes('authentication') ||
    message.includes('permission') ||
    message.includes('fetch failed') ||
    message.includes('timed out') ||
    message.includes('timeout') ||
    statusCode === 401 ||
    statusCode === 403 ||
    statusCode === 429 ||
    statusCode === 504
  );
}

function isLocalTranscriptionIssue(error) {
  const message = normalizeWhitespace(error?.message).toLowerCase();
  return Boolean(message) && (
    message.includes('local faster-whisper') ||
    message.includes('whispermodel') ||
    message.includes('ctranslate2') ||
    message.includes('pyav') ||
    message.includes('failed to open input') ||
    message.includes('no such file') ||
    message.includes('the local faster-whisper helper script is missing')
  );
}

function normalizeActions(actions) {
  return (Array.isArray(actions) ? actions : [])
    .map(action => ({
      assignee: isPlaceholderSpeakerLabel(action?.assignee)
        ? 'Unassigned'
        : (stripMarkdownFormatting(action?.assignee) || 'Unassigned'),
      task: stripMarkdownFormatting(action?.task),
      deadline: stripMarkdownFormatting(action?.deadline) || 'TBD',
      priority: ['low', 'medium', 'high'].includes(action?.priority) ? action.priority : 'medium'
    }))
    .filter(action => action.task)
    .slice(0, 8);
}

function normalizeDecisions(decisions) {
  return (Array.isArray(decisions) ? decisions : [])
    .map(decision => ({
      title: cleanDecisionTitle(decision?.title),
      context: stripMarkdownFormatting(decision?.context),
      speaker: isPlaceholderSpeakerLabel(decision?.speaker)
        ? 'Unknown'
        : (stripMarkdownFormatting(decision?.speaker) || 'Unknown')
    }))
    .filter(decision => decision.title)
    .slice(0, 6);
}

function normalizeSentiments(items) {
  const overrides = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const name = stripMarkdownFormatting(item?.name).toLowerCase();
    if (!name) continue;
    const sentiment = ['positive', 'neutral', 'critical'].includes(item?.sentiment) ? item.sentiment : 'neutral';
    overrides.set(name, sentiment);
  }
  return overrides;
}

function cleanDecisionTitle(value) {
  return normalizeWhitespace(stripMarkdownFormatting(value))
    .replace(/^decision\s*:?\s*/i, '')
    .replace(/^we (?:decided|agreed)\s+(?:to\s+)?/i, '')
    .replace(/^agreed\s+(?:to\s+)?/i, '')
    .replace(/^decided\s+(?:to\s+)?/i, '')
    .replace(/\.$/, '');
}

function formatActionHeadline(action) {
  const task = normalizeWhitespace(stripMarkdownFormatting(action?.task)).replace(/\.$/, '');
  if (!task) return '';

  const assignee = normalizeWhitespace(stripMarkdownFormatting(action?.assignee));
  const deadline = normalizeWhitespace(stripMarkdownFormatting(action?.deadline));
  const prefix = assignee && assignee !== 'Unassigned'
    ? `${assignee} to ${lowercaseFirst(task)}`
    : `Follow up to ${lowercaseFirst(task)}`;

  if (deadline && deadline !== 'TBD') return `${prefix} by ${deadline}`;
  return prefix;
}

function formatDecisionHeadline(decision) {
  const title = cleanDecisionTitle(decision?.title);
  if (!title) return '';
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function extractRiskHighlights(lines, limit = 3) {
  const riskKeywords = /\b(risk|blocker|blocked|issue|issues|concern|concerns|delay|delayed|complaint|complaints|confusion|unclear|problem|problems|stuck|gap|gaps|dependency|dependencies)\b/i;
  const linesWithRisk = (Array.isArray(lines) ? lines : [])
    .map(line => ensureTrailingPunctuation(line?.text))
    .filter(text => text && riskKeywords.test(text));
  const seen = new Set();
  const results = [];

  for (const sentence of linesWithRisk) {
    const canonical = sentence.toLowerCase();
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    results.push(sentence);
    if (results.length >= limit) break;
  }

  return results;
}

function buildSummarySections(lines, summaryBody, topics, actions, decisions) {
  const normalizedTopics = [...new Set((Array.isArray(topics) ? topics : [])
    .map(topic => normalizeWhitespace(stripMarkdownFormatting(topic)))
    .filter(Boolean))]
    .slice(0, 4);
  const outcomes = [];
  const risks = extractRiskHighlights(lines, 3);
  const nextSteps = [];
  const seenOutcomes = new Set();

  for (const decision of Array.isArray(decisions) ? decisions : []) {
    const headline = formatDecisionHeadline(decision);
    if (!headline) continue;
    const entry = `Decision: ${headline}`;
    const canonical = entry.toLowerCase();
    if (seenOutcomes.has(canonical)) continue;
    seenOutcomes.add(canonical);
    outcomes.push(entry);
    if (outcomes.length >= 2) break;
  }

  for (const action of Array.isArray(actions) ? actions : []) {
    const headline = formatActionHeadline(action);
    if (!headline) continue;
    if (outcomes.length < 3) {
      const outcomeEntry = `Commitment: ${headline}`;
      const canonical = outcomeEntry.toLowerCase();
      if (!seenOutcomes.has(canonical)) {
        seenOutcomes.add(canonical);
        outcomes.push(outcomeEntry);
      }
    }

    if (nextSteps.length < 3) {
      nextSteps.push(headline);
    }
  }

  if (outcomes.length === 0) {
    collectSummaryEvidence(lines, 2).forEach(sentence => {
      if (outcomes.length < 2) outcomes.push(sentence);
    });
  }

  return {
    overview: normalizeWhitespace(summaryBody),
    themes: normalizedTopics,
    outcomes: outcomes.slice(0, 3),
    risks: risks.slice(0, 3),
    nextSteps: nextSteps.slice(0, 3)
  };
}

function buildImportantPoints(lines, summarySections, actions, decisions) {
  const points = [];
  const seen = new Set();

  function pushPoint(type, title, detail = '') {
    const cleanTitle = normalizeWhitespace(stripMarkdownFormatting(title)).replace(/\.$/, '');
    const cleanDetail = normalizeWhitespace(stripMarkdownFormatting(detail));
    if (!cleanTitle) return;
    const canonical = `${type}|${cleanTitle}`.toLowerCase();
    if (seen.has(canonical)) return;
    seen.add(canonical);
    points.push({ type, title: cleanTitle, detail: cleanDetail });
  }

  (Array.isArray(decisions) ? decisions : []).forEach(decision => {
    const headline = formatDecisionHeadline(decision);
    if (!headline) return;
    pushPoint('decision', headline, decision?.context || `Captured from ${decision?.speaker || 'the transcript'}.`);
  });

  (Array.isArray(summarySections?.risks) ? summarySections.risks : []).forEach(risk => {
    pushPoint('risk', risk, 'Flagged as a risk or blocker in the transcript.');
  });

  (Array.isArray(actions) ? actions : []).forEach(action => {
    const headline = formatActionHeadline(action);
    if (!headline) return;
    const priority = normalizeWhitespace(action?.priority).toUpperCase() || 'MEDIUM';
    pushPoint('action', headline, `Follow-up item with ${priority} priority.`);
  });

  collectSummaryEvidence(lines, 4).forEach(sentence => {
    if (points.length >= 6) return;
    pushPoint('discussion', sentence, 'High-signal discussion point from the transcript.');
  });

  return points.slice(0, 6);
}

function buildMeetingResult(lines, analysis) {
  const normalizedLines = Array.isArray(lines) ? lines.filter(line => line?.speaker && line?.text) : [];
  const transcriptText = formatTranscript(normalizedLines);
  const wordCount = countWords(transcriptText);
  const speakers = getVisibleSpeakerNames(normalizedLines);
  const summaryTopics = (Array.isArray(analysis?.summary?.topics) ? analysis.summary.topics : [])
    .map(topic => stripMarkdownFormatting(topic))
    .filter(Boolean)
    .slice(0, 8);
  const summary = {
    body: stripMarkdownFormatting(analysis?.summary?.body) || buildFallbackSummary(normalizedLines),
    topics: summaryTopics.length > 0 ? summaryTopics : extractTopics(transcriptText),
    speakers,
    wordCount,
    duration: Math.max(1, Math.round(wordCount / 130))
  };
  const actions = normalizeActions(analysis?.actions);
  const decisions = normalizeDecisions(analysis?.decisions);
  const participantSentiments = normalizeSentiments(analysis?.participantSentiments);
  const participants = buildParticipants(normalizedLines, participantSentiments);
  const summarySections = buildSummarySections(normalizedLines, summary.body, summary.topics, actions, decisions);
  summary.sections = summarySections;
  const importantPoints = buildImportantPoints(normalizedLines, summarySections, actions, decisions);
  const score = computeScore(normalizedLines, actions, decisions);

  return {
    summary,
    importantPoints,
    actions,
    decisions,
    lines: normalizedLines,
    score,
    participants,
    transcriptText
  };
}

function parseStructuredJson(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('The model returned an empty response.');

  const fenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const firstBrace = fenced.indexOf('{');
  const lastBrace = fenced.lastIndexOf('}');
  const candidate = firstBrace >= 0 && lastBrace > firstBrace ? fenced.slice(firstBrace, lastBrace + 1) : fenced;
  return JSON.parse(candidate);
}

function isAbortLikeError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

function createOpenAITimeoutSignal() {
  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(OPENAI_REQUEST_TIMEOUT_MS);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), OPENAI_REQUEST_TIMEOUT_MS).unref?.();
  return controller.signal;
}

async function fetchOpenAI(url, options) {
  try {
    return await fetch(url, {
      ...options,
      signal: createOpenAITimeoutSignal()
    });
  } catch (error) {
    if (isAbortLikeError(error)) {
      const timeoutError = new Error(`OpenAI request timed out after ${Math.round(OPENAI_REQUEST_TIMEOUT_MS / 1000)} seconds.`);
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  }
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function summarizeProviderMessage(message) {
  return normalizeWhitespace(String(message || '').replace(/\s*\*\s+/g, ' '));
}

function friendlyProviderMessage(message, statusCode) {
  const raw = summarizeProviderMessage(message);
  const lower = raw.toLowerCase();

  if (statusCode === 429) {
    if (lower.includes('insufficient_quota') || lower.includes('quota') || lower.includes('billing') || lower.includes('credit')) {
      return 'OpenAI accepted the API key, but this account or project has no available credits or has hit its quota. Add billing or credits in OpenAI, or switch to a key with available usage. Restart the server only if you changed the local API key.';
    }
    if (lower.includes('rate limit')) {
      return 'OpenAI temporarily refused the request because this key hit a rate limit. Wait a moment and try again.';
    }
  }

  if ((statusCode === 401 || statusCode === 403) && (lower.includes('api key') || lower.includes('authentication') || lower.includes('permission'))) {
    return 'The OPENAI_API_KEY was read, but OpenAI rejected it. Make sure the key is valid for the account or project you want to use, then restart the server if you updated the key locally.';
  }

  return raw || 'Provider request failed.';
}

function toProviderError(responsePayload, statusCode) {
  const rawMessage = typeof responsePayload === 'string'
    ? responsePayload
    : responsePayload?.error?.message || responsePayload?.message || 'Provider request failed.';
  const error = new Error(friendlyProviderMessage(rawMessage, statusCode));
  error.statusCode = statusCode;
  return error;
}

function extractChatCompletionText(message) {
  if (typeof message?.content === 'string' && message.content.trim()) {
    return message.content.trim();
  }

  const parts = Array.isArray(message?.content) ? message.content : [];
  return parts
    .map(part => {
      if (typeof part?.text === 'string') return part.text;
      if (typeof part?.text?.value === 'string') return part.text.value;
      return '';
    })
    .join('\n')
    .trim();
}

function guessMimeType(file) {
  const explicit = normalizeWhitespace(file?.type);
  if (explicit) return explicit;

  const ext = path.extname(file?.name || '').toLowerCase();
  const map = {
    '.m4a': 'audio/mp4',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.webm': 'audio/webm'
  };
  return map[ext] || 'application/octet-stream';
}

function buildJsonSchemaFormat(name, schema) {
  return {
    type: 'json_schema',
    json_schema: {
      name,
      strict: true,
      schema
    }
  };
}

function prefersVerboseJsonTranscription(model) {
  const lower = normalizeWhitespace(model).toLowerCase();
  return lower.includes('whisper');
}

function describeConfiguredTranscriptionMode() {
  const localLabel = LOCAL_DIARIZATION_ENABLED && HAS_HUGGINGFACE_TOKEN
    ? `local-faster-whisper+pyannote:${LOCAL_WHISPER_MODEL}`
    : `local-faster-whisper:${LOCAL_WHISPER_MODEL}`;
  const openAiLabel = `openai:${OPENAI_TRANSCRIPTION_MODEL}`;

  if (LOCAL_ONLY_MEDIA_PROCESSING) return localLabel;

  if (MEDIA_PROCESSING_MODE === 'openai') {
    return LOCAL_TRANSCRIPTION_ENABLED ? `${openAiLabel} -> ${localLabel}` : openAiLabel;
  }

  if (MEDIA_PROCESSING_MODE === 'local') {
    return HAS_OPENAI_KEY ? `${localLabel} -> ${openAiLabel}` : localLabel;
  }

  if (HAS_OPENAI_KEY) {
    return LOCAL_TRANSCRIPTION_ENABLED ? `${openAiLabel} -> ${localLabel}` : openAiLabel;
  }

  return LOCAL_TRANSCRIPTION_ENABLED ? localLabel : openAiLabel;
}

function summarizeSpawnFailure(result, fallbackMessage) {
  if (!result) return fallbackMessage;
  if (result.error?.code === 'EPERM' || result.error?.code === 'EACCES') {
    return 'The current environment blocked launching this process. If you are running MeetMind inside a restricted sandbox, start it from a normal local terminal instead.';
  }
  if (result.error?.message) return normalizeWhitespace(result.error.message);

  const output = normalizeWhitespace(`${result.stderr || ''} ${result.stdout || ''}`);
  return output || fallbackMessage;
}

function inspectConfiguredPythonPath(command) {
  const normalizedCommand = normalizeWhitespace(command);
  if (!normalizedCommand) {
    return {
      isPathLike: false,
      resolvedPath: '',
      exists: false
    };
  }

  const isWindowsDrivePath = /^[a-zA-Z]:[\\/]/.test(normalizedCommand);
  const isUncPath = normalizedCommand.startsWith('\\\\');
  const isRelativePath = normalizedCommand.startsWith('.\\')
    || normalizedCommand.startsWith('./')
    || normalizedCommand.startsWith('..\\')
    || normalizedCommand.startsWith('../');
  const hasPathSeparator = normalizedCommand.includes('\\') || normalizedCommand.includes('/');
  const isPathLike = isWindowsDrivePath || isUncPath || isRelativePath || hasPathSeparator;
  const resolvedPath = isPathLike ? path.resolve(ROOT, normalizedCommand) : '';

  return {
    isPathLike,
    resolvedPath,
    exists: isPathLike ? fs.existsSync(resolvedPath) : false
  };
}

function formatCommandForDisplay(command, args = []) {
  return [command].concat(Array.isArray(args) ? args : []).join(' ').trim();
}

function addPythonRuntimeCandidate(candidates, seen, command, args = [], source = 'fallback') {
  const normalizedCommand = normalizeWhitespace(command);
  if (!normalizedCommand) return;

  const normalizedArgs = Array.isArray(args) ? args.filter(Boolean) : [];
  const key = `${normalizedCommand}\n${normalizedArgs.join('\n')}`;
  if (seen.has(key)) return;

  seen.add(key);
  candidates.push({
    command: normalizedCommand,
    args: normalizedArgs,
    source
  });
}

function buildPythonRuntimeCandidates() {
  const candidates = [];
  const seen = new Set();
  const configuredPython = inspectConfiguredPythonPath(LOCAL_PYTHON_BIN);
  if (!configuredPython.isPathLike || configuredPython.exists) {
    addPythonRuntimeCandidate(candidates, seen, LOCAL_PYTHON_BIN, [], 'configured');
  }

  const localCandidates = process.platform === 'win32'
    ? [
        path.join(ROOT, '.venv312', 'Scripts', 'python.exe'),
        path.join(ROOT, '.venv', 'Scripts', 'python.exe'),
        path.join(ROOT, 'venv', 'Scripts', 'python.exe')
      ]
    : [
        path.join(ROOT, '.venv312', 'bin', 'python'),
        path.join(ROOT, '.venv', 'bin', 'python'),
        path.join(ROOT, 'venv', 'bin', 'python')
      ];

  localCandidates
    .filter(candidate => fs.existsSync(candidate))
    .forEach(candidate => addPythonRuntimeCandidate(candidates, seen, candidate));

  if (process.platform === 'win32') {
    addPythonRuntimeCandidate(candidates, seen, 'py', ['-3.12']);
    addPythonRuntimeCandidate(candidates, seen, 'py', ['-3']);
    addPythonRuntimeCandidate(candidates, seen, 'python');
  } else {
    addPythonRuntimeCandidate(candidates, seen, 'python3');
    addPythonRuntimeCandidate(candidates, seen, 'python');
  }

  return candidates;
}

function runPythonRuntimeProbe(candidate, args, options = {}) {
  return spawnSync(candidate.command, candidate.args.concat(args), {
    cwd: ROOT,
    encoding: 'utf8',
    ...options
  });
}

function resolveLocalPythonRuntime() {
  const failures = [];

  for (const candidate of buildPythonRuntimeCandidates()) {
    const probe = runPythonRuntimeProbe(candidate, ['--version'], { timeout: 10 * 1000 });
    if (!probe.error && probe.status === 0) {
      return {
        available: true,
        command: candidate.command,
        args: candidate.args,
        displayCommand: formatCommandForDisplay(candidate.command, candidate.args),
        source: candidate.source,
        version: normalizeWhitespace(`${probe.stdout || ''} ${probe.stderr || ''}`),
        failures
      };
    }

    failures.push({ candidate, probe });
  }

  return {
    available: false,
    command: '',
    args: [],
    displayCommand: '',
    source: 'unresolved',
    version: '',
    failures
  };
}

function collectLocalRuntimeHealth(force = false) {
  const now = Date.now();
  if (!force && cachedLocalRuntimeHealth && (now - cachedLocalRuntimeHealthAt) < HEALTH_CACHE_TTL_MS) {
    return cachedLocalRuntimeHealth;
  }

  const helperScriptPresent = fs.existsSync(LOCAL_WHISPER_SCRIPT);
  const packageChecks = {
    fasterWhisper: false,
    pyannoteAudio: false,
    torchaudio: false
  };
  const issues = [];
  const warnings = [];
  let packageProbeSucceeded = false;
  let pythonAvailable = false;
  let pythonVersion = '';
  let pythonCommand = '';
  let pythonArgs = [];
  let pythonDisplayCommand = '';
  const configuredPython = inspectConfiguredPythonPath(LOCAL_PYTHON_BIN);

  if (!LOCAL_TRANSCRIPTION_ENABLED) {
    const report = {
      enabled: false,
      ready: false,
      helperScriptPresent,
      configuredPythonBin: LOCAL_PYTHON_BIN,
      pythonBin: LOCAL_PYTHON_BIN,
      pythonCommand,
      pythonArgs,
      pythonAvailable,
      pythonVersion,
      dependenciesChecked: false,
      packageChecks,
      diarizationReady: false,
      issues,
      warnings
    };
    cachedLocalRuntimeHealth = report;
    cachedLocalRuntimeHealthAt = now;
    return report;
  }

  if (!helperScriptPresent) {
    issues.push('Missing local helper script: tools/faster_whisper_transcribe.py.');
  }

  const pythonRuntime = resolveLocalPythonRuntime();

  if (pythonRuntime.available) {
    pythonAvailable = true;
    pythonVersion = pythonRuntime.version;
    pythonCommand = pythonRuntime.command;
    pythonArgs = pythonRuntime.args;
    pythonDisplayCommand = pythonRuntime.displayCommand;
    if (configuredPython.isPathLike && !configuredPython.exists) {
      warnings.push(
        `Configured Python runtime "${LOCAL_PYTHON_BIN}" was not found, so MeetMind is using "${pythonDisplayCommand}" instead.`
      );
    } else if (pythonRuntime.source !== 'configured') {
      warnings.push(
        `Configured Python runtime "${LOCAL_PYTHON_BIN}" was unavailable, so MeetMind is using "${pythonDisplayCommand}" instead.`
      );
    }
  } else {
    if (configuredPython.isPathLike && !configuredPython.exists) {
      issues.push(
        `Configured Python runtime "${LOCAL_PYTHON_BIN}" was not found. This usually means the project folder was moved or renamed. Update MEETMIND_PYTHON_BIN or remove it to let MeetMind auto-detect the local virtual environment.`
      );
    } else {
      const configuredFailure = pythonRuntime.failures.find(entry => entry.candidate.source === 'configured') || pythonRuntime.failures[0];
      issues.push(
        `Could not start Python from "${LOCAL_PYTHON_BIN}". ${summarizeSpawnFailure(configuredFailure?.probe, 'Install Python or update MEETMIND_PYTHON_BIN.')}`
      );
    }

    if (pythonRuntime.failures.length > 0) {
      const fallbackFailure = pythonRuntime.failures.find(entry => entry.candidate.source !== 'configured') || pythonRuntime.failures[0];
      if (fallbackFailure) {
        issues.push(
          `MeetMind also could not start any fallback Python runtime. ${summarizeSpawnFailure(fallbackFailure.probe, 'Install Python or update MEETMIND_PYTHON_BIN.')}`
        );
      }
    }
  }

  if (pythonAvailable) {
    const inspectScript = [
      'import importlib.util, json',
      'modules = {"fasterWhisper": "faster_whisper", "torchaudio": "torchaudio", "pyannoteAudio": "pyannote.audio"}',
      'print(json.dumps({name: bool(importlib.util.find_spec(module_name)) for name, module_name in modules.items()}))'
    ].join('; ');
    const packageProbe = runPythonRuntimeProbe(
      { command: pythonCommand, args: pythonArgs },
      ['-c', inspectScript],
      { timeout: 15 * 1000 }
    );

    if (!packageProbe.error && packageProbe.status === 0) {
      try {
        const parsed = JSON.parse(String(packageProbe.stdout || '').trim() || '{}');
        packageChecks.fasterWhisper = Boolean(parsed.fasterWhisper);
        packageChecks.torchaudio = Boolean(parsed.torchaudio);
        packageChecks.pyannoteAudio = Boolean(parsed.pyannoteAudio);
        packageProbeSucceeded = true;
      } catch (error) {
        warnings.push('Python dependency check returned an unreadable result. Run `npm run doctor` for more detail.');
      }
    } else {
    warnings.push(
      `Python dependency check could not finish. ${summarizeSpawnFailure(packageProbe, 'Install the local transcription packages and try again.')}`
    );
  }
}

  if (packageProbeSucceeded && !packageChecks.fasterWhisper) {
    issues.push('Python package "faster-whisper" is missing.');
  }
  if (packageProbeSucceeded && !packageChecks.torchaudio) {
    issues.push('Python package "torchaudio" is missing.');
  }
  if (LOCAL_DIARIZATION_ENABLED && !HAS_HUGGINGFACE_TOKEN) {
    warnings.push('Speaker diarization is enabled, but HUGGINGFACE_TOKEN is missing in .env.');
  }
  if (packageProbeSucceeded && LOCAL_DIARIZATION_ENABLED && HAS_HUGGINGFACE_TOKEN && !packageChecks.pyannoteAudio) {
    warnings.push('Speaker diarization is configured, but the Python package "pyannote.audio" is missing.');
  }

  const ready = helperScriptPresent && pythonAvailable && packageChecks.fasterWhisper && packageChecks.torchaudio;
  const diarizationReady = LOCAL_DIARIZATION_ENABLED && HAS_HUGGINGFACE_TOKEN && packageChecks.pyannoteAudio;
  const report = {
    enabled: true,
    ready,
    helperScriptPresent,
    configuredPythonBin: LOCAL_PYTHON_BIN,
    pythonBin: pythonDisplayCommand || LOCAL_PYTHON_BIN,
    pythonCommand,
    pythonArgs,
    pythonAvailable,
    pythonVersion,
    dependenciesChecked: packageProbeSucceeded,
    packageChecks,
    diarizationReady,
    issues,
    warnings
  };

  cachedLocalRuntimeHealth = report;
  cachedLocalRuntimeHealthAt = now;
  return report;
}

function determineAppMode(localReady) {
  if (HAS_OPENAI_KEY && localReady) return 'hybrid';
  if (HAS_OPENAI_KEY) return 'cloud';
  if (localReady) return 'local';
  return 'unconfigured';
}

function buildHealthPayload(forceRuntimeRefresh = false) {
  const localRuntime = collectLocalRuntimeHealth(forceRuntimeRefresh);
  const mode = determineAppMode(localRuntime.ready);

  return {
    ok: true,
    configured: mode !== 'unconfigured',
    mode,
    provider: ACTIVE_PROVIDER,
    analysisModel: ANALYSIS_MODEL,
    transcriptionModel: describeConfiguredTranscriptionMode(),
    capabilities: {
      openai: {
        configured: HAS_OPENAI_KEY,
        analysisModel: ANALYSIS_MODEL,
        transcriptionModel: OPENAI_TRANSCRIPTION_MODEL
      },
      local: {
        enabled: LOCAL_TRANSCRIPTION_ENABLED,
        ready: localRuntime.ready,
        helperScriptPresent: localRuntime.helperScriptPresent,
        pythonAvailable: localRuntime.pythonAvailable,
        configuredPythonBin: localRuntime.configuredPythonBin,
        pythonBin: localRuntime.pythonBin,
        pythonCommand: localRuntime.pythonCommand,
        pythonArgs: localRuntime.pythonArgs,
        pythonVersion: localRuntime.pythonVersion,
        dependenciesChecked: localRuntime.dependenciesChecked,
        whisperModel: LOCAL_WHISPER_MODEL,
        packageChecks: localRuntime.packageChecks,
        issues: localRuntime.issues,
        warnings: localRuntime.warnings,
        diarization: {
          enabled: LOCAL_DIARIZATION_ENABLED,
          tokenPresent: HAS_HUGGINGFACE_TOKEN,
          model: LOCAL_DIARIZATION_MODEL,
          ready: localRuntime.diarizationReady
        }
      }
    }
  };
}

function sanitizeUploadName(name) {
  const base = path.basename(String(name || 'meeting.webm')).replace(/[^a-zA-Z0-9._-]+/g, '-');
  return base || 'meeting.webm';
}

function createWorkspaceTempDir() {
  const baseDir = path.join(ROOT, '.meetmind-temp');
  fs.mkdirSync(baseDir, { recursive: true });
  return fs.mkdtempSync(path.join(baseDir, 'job-'));
}

async function writeIncomingFileToTemp(file) {
  const tempDir = createWorkspaceTempDir();
  const fileName = sanitizeUploadName(file?.name);
  const filePath = path.join(tempDir, fileName);
  const arrayBuffer = await file.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
  return {
    tempDir,
    filePath
  };
}

function removeTempDir(tempDir) {
  if (!tempDir) return;
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (error) {}
}

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        const details = normalizeWhitespace(stderr || stdout || error.message);
        const wrapped = new Error(details || `Failed to run ${command}.`);
        wrapped.cause = error;
        reject(wrapped);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

async function transcribeMediaLocally(file, liveTranscript) {
  if (!LOCAL_TRANSCRIPTION_ENABLED) {
    throw new Error('Local faster-whisper transcription is disabled.');
  }
  if (!fs.existsSync(LOCAL_WHISPER_SCRIPT)) {
    throw new Error('The local faster-whisper helper script is missing.');
  }

  const localRuntime = collectLocalRuntimeHealth();
  if (!localRuntime.pythonAvailable || !localRuntime.pythonCommand) {
    throw new Error(localRuntime.issues.find(issue => issue.includes('Could not start Python')) || 'A usable Python runtime could not be started.');
  }

  const { tempDir, filePath } = await writeIncomingFileToTemp(file);

  try {
    const args = [LOCAL_WHISPER_SCRIPT, filePath, '--model', LOCAL_WHISPER_MODEL];
    if (LOCAL_DIARIZATION_ENABLED && HAS_HUGGINGFACE_TOKEN) {
      args.push('--hf-token', HUGGINGFACE_TOKEN, '--diarization-model', LOCAL_DIARIZATION_MODEL);
    }

    const { stdout } = await execFileAsync(
      localRuntime.pythonCommand,
      localRuntime.pythonArgs.concat(args),
      {
        cwd: ROOT,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60 * 60 * 1000
      }
    );

    const payload = JSON.parse(String(stdout || '').trim() || '{}');
    let transcriptText = normalizeWhitespace(stripMarkdownFormatting(payload?.text));
    const rawSegments = (Array.isArray(payload?.segments) ? payload.segments : [])
      .map(segment => ({
        speaker: stripMarkdownFormatting(segment?.speaker),
        text: stripMarkdownFormatting(segment?.text),
        start: typeof segment?.start === 'number' ? segment.start : null,
        end: typeof segment?.end === 'number' ? segment.end : null
      }))
      .filter(segment => segment.text);
    const hasSpeakerLabels = rawSegments.some(segment => normalizeWhitespace(segment.speaker));
    let lines = hasSpeakerLabels
      ? mergeDiarizedSegments(rawSegments.map(segment => ({
          speaker: segment.speaker,
          text: segment.text,
          start: segment.start,
          end: segment.end
        })))
      : rawSegments.map(segment => ({
          speaker: 'Speaker 1',
          text: segment.text
        }));
    const warnings = (Array.isArray(payload?.warnings) ? payload.warnings : [])
      .map(item => normalizeWhitespace(item))
      .filter(Boolean);

    if (!transcriptText && rawSegments.length > 0) {
      transcriptText = normalizeWhitespace(rawSegments.map(segment => segment.text).join(' '));
    }
    if (lines.length === 0 && transcriptText) {
      lines = [{
        speaker: 'Speaker 1',
        text: transcriptText
      }];
    }
    if (lines.length === 0 && liveTranscript) {
      transcriptText = normalizeWhitespace(liveTranscript);
      lines = parseTranscriptText(liveTranscript);
      warnings.push('Local faster-whisper could not decode the media cleanly, so MeetMind used the captured live transcript instead.');
    } else if (hasSpeakerLabels) {
      warnings.push('The file was transcribed locally with faster-whisper and speaker-separated with pyannote on this PC.');
    } else if (LOCAL_DIARIZATION_ENABLED && !HAS_HUGGINGFACE_TOKEN) {
      warnings.push('Local transcription worked, but speaker diarization is disabled because HUGGINGFACE_TOKEN is missing in the local .env file.');
    } else {
      warnings.push('The file was transcribed locally with faster-whisper on this PC. Speaker diarization was not available for this file, so the transcript is labeled as Speaker 1.');
    }

    return {
      transcriptText,
      lines,
      transcriptionModel: hasSpeakerLabels
        ? `local-faster-whisper+pyannote:${LOCAL_WHISPER_MODEL}`
        : `local-faster-whisper:${LOCAL_WHISPER_MODEL}`,
      warnings
    };
  } finally {
    removeTempDir(tempDir);
  }
}

async function generateOpenAIStructuredContent(model, instructions, inputText, schema, schemaName) {
  const response = await fetchOpenAI(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: instructions
        },
        {
          role: 'user',
          content: inputText
        }
      ],
      response_format: buildJsonSchemaFormat(schemaName, schema)
    })
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw toProviderError(payload, response.status);
  }

  const message = payload?.choices?.[0]?.message;
  if (message?.refusal) {
    throw new Error(`OpenAI refused the request. ${message.refusal}`);
  }

  return parseStructuredJson(extractChatCompletionText(message));
}

async function transcribeMediaWithOpenAI(file, liveTranscript) {
  if (!HAS_OPENAI_KEY) {
    throw new Error('OPENAI_API_KEY is missing. Add it to your local .env file.');
  }

  if (typeof file?.size === 'number' && file.size > MAX_MEDIA_BYTES) {
    throw new Error('The selected file is larger than the current upload limit. Compress it or split it before processing.');
  }

  const form = new FormData();
  form.append('file', file, file?.name || 'meeting.webm');
  form.append('model', OPENAI_TRANSCRIPTION_MODEL);

  const useVerboseJson = prefersVerboseJsonTranscription(OPENAI_TRANSCRIPTION_MODEL);
  form.append('response_format', useVerboseJson ? 'verbose_json' : 'diarized_json');
  if (!useVerboseJson) {
    form.append('chunking_strategy', 'auto');
  }

  const response = await fetchOpenAI(`${OPENAI_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: form
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw toProviderError(payload, response.status);
  }

  const rawSegments = (Array.isArray(payload?.segments) ? payload.segments : []).map(segment => ({
    speaker: stripMarkdownFormatting(segment?.speaker),
    text: stripMarkdownFormatting(segment?.text || segment?.content),
    start: typeof segment?.start === 'number' ? segment.start : null,
    end: typeof segment?.end === 'number' ? segment.end : null
  }));
  const hasSpeakerLabels = rawSegments.some(segment => normalizeWhitespace(segment.speaker));
  const warnings = [];

  let lines = hasSpeakerLabels ? mergeDiarizedSegments(rawSegments) : [];
  let transcriptText = normalizeWhitespace(stripMarkdownFormatting(payload?.text));

  if (!transcriptText && rawSegments.length > 0) {
    transcriptText = normalizeWhitespace(rawSegments.map(segment => segment.text).filter(Boolean).join(' '));
  }

  if (lines.length === 0 && transcriptText) {
    lines = parseTranscriptText(transcriptText);
  }
  if (!hasSpeakerLabels && rawSegments.length > 0 && transcriptText) {
    warnings.push('OpenAI Whisper transcribed the file, but it did not provide speaker diarization. MeetMind estimated speaker turns from the transcript text.');
  }
  if (lines.length === 0 && liveTranscript) {
    transcriptText = normalizeWhitespace(liveTranscript);
    lines = parseTranscriptText(liveTranscript);
  }
  if (!transcriptText && lines.length > 0) {
    transcriptText = formatTranscript(lines);
  }

  return {
    transcriptText,
    lines,
    transcriptionModel: OPENAI_TRANSCRIPTION_MODEL,
    warnings
  };
}

async function transcribeMedia(file, liveTranscript) {
  if (typeof file?.size === 'number' && file.size > MAX_MEDIA_BYTES) {
    throw new Error('The selected file is larger than 512 MB. Compress it or split it before processing.');
  }

  const localAvailable = LOCAL_TRANSCRIPTION_ENABLED;
  const openAiAvailable = HAS_OPENAI_KEY;
  let attempts = [];
  if (LOCAL_ONLY_MEDIA_PROCESSING) {
    attempts = ['local'];
  } else if (MEDIA_PROCESSING_MODE === 'openai') {
    attempts = ['openai', 'local'];
  } else if (MEDIA_PROCESSING_MODE === 'local') {
    attempts = ['local', 'openai'];
  } else {
    attempts = openAiAvailable ? ['openai', 'local'] : ['local'];
  }
  const failureMessages = [];

  for (const method of attempts) {
    if (method === 'local') {
      if (!localAvailable) continue;
      try {
        const result = await transcribeMediaLocally(file, liveTranscript);
        if (failureMessages.length > 0) {
          result.warnings = [
            ...failureMessages,
            ...(Array.isArray(result.warnings) ? result.warnings : [])
          ];
        }
        return result;
      } catch (error) {
        failureMessages.push(`Local faster-whisper transcription was unavailable. ${error.message}`);
        continue;
      }
    }

    if (method === 'openai') {
      if (!openAiAvailable) continue;
      try {
        const result = await transcribeMediaWithOpenAI(file, liveTranscript);
        if (failureMessages.length > 0) {
          result.warnings = [
            ...failureMessages,
            ...(Array.isArray(result.warnings) ? result.warnings : [])
          ];
        }
        return result;
      } catch (error) {
        if (localAvailable) {
          failureMessages.push(
            isProviderAccessIssue(error)
              ? 'OpenAI transcription was unavailable, so MeetMind kept using local processing.'
              : 'OpenAI transcription failed, so MeetMind switched to local processing.'
          );
          continue;
        }
        throw error;
      }
    }
  }

  if (liveTranscript) {
    return {
      transcriptText: normalizeWhitespace(liveTranscript),
      lines: parseTranscriptText(liveTranscript),
      transcriptionModel: 'browser-live-transcript',
      warnings: [
        ...failureMessages,
        'File transcription was unavailable, so MeetMind used the captured live transcript instead.'
      ].filter(Boolean)
    };
  }

  if (failureMessages.length > 0) {
    throw new Error(failureMessages.join(' '));
  }

  throw new Error('No media transcription method is currently available.');
}

async function analyzeTranscript(lines) {
  if (!HAS_OPENAI_KEY) {
    throw new Error('OPENAI_API_KEY is missing. Add it to your local .env file.');
  }

  const transcriptText = formatTranscript(lines);
  return generateOpenAIStructuredContent(
    ANALYSIS_MODEL,
    ANALYSIS_INSTRUCTIONS,
    `Analyze this meeting transcript:\n\n${transcriptText}`,
    MEETING_ANALYSIS_SCHEMA,
    'meeting_analysis'
  );
}

async function parseIncomingRequest(req) {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    const request = new Request(`http://localhost:${PORT}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: Readable.toWeb(req),
      duplex: 'half'
    });
    const form = await request.formData();
    return {
      source: normalizeWhitespace(form.get('source')) || 'upload',
      title: normalizeWhitespace(form.get('title')),
      liveTranscript: normalizeWhitespace(form.get('liveTranscript')),
      file: form.get('file'),
      text: ''
    };
  }

  const bodyChunks = [];
  for await (const chunk of req) {
    bodyChunks.push(chunk);
  }
  const rawBody = Buffer.concat(bodyChunks).toString('utf8');
  let payload = {};
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      const invalidJsonError = new Error('The request body must contain valid JSON.');
      invalidJsonError.statusCode = 400;
      throw invalidJsonError;
    }
  }
  return {
    source: normalizeWhitespace(payload.source) || 'paste',
    title: normalizeWhitespace(payload.title),
    liveTranscript: normalizeWhitespace(payload.liveTranscript),
    file: null,
    text: String(payload.text || '')
  };
}

async function handleProcess(req, res) {
  try {
    const input = await parseIncomingRequest(req);
    let transcriptText = '';
    let lines = [];
    let transcriptionModel = null;
    let analysisModel = ANALYSIS_MODEL;
    const warnings = [];

    if (input.file && typeof input.file.arrayBuffer === 'function') {
      try {
        const mediaResult = await transcribeMedia(input.file, input.liveTranscript);
        transcriptText = mediaResult.transcriptText;
        lines = mediaResult.lines;
        transcriptionModel = mediaResult.transcriptionModel;
        if (Array.isArray(mediaResult.warnings) && mediaResult.warnings.length > 0) {
          warnings.push(...mediaResult.warnings);
        }
      } catch (error) {
        if (input.liveTranscript.trim() && (isProviderAccessIssue(error) || isLocalTranscriptionIssue(error))) {
          transcriptText = normalizeWhitespace(input.liveTranscript);
          lines = parseTranscriptText(input.liveTranscript);
          transcriptionModel = 'browser-live-transcript';
          warnings.push('File transcription was unavailable, so MeetMind used the captured live transcript instead.');
        } else {
          throw error;
        }
      }
    } else if (input.text.trim()) {
      transcriptText = normalizeWhitespace(input.text);
      lines = parseTranscriptText(input.text);
    } else if (input.liveTranscript.trim()) {
      transcriptText = input.liveTranscript;
      lines = parseTranscriptText(input.liveTranscript);
    } else {
      sendError(res, 400, 'No meeting content was provided.');
      return;
    }

    if (lines.length === 0 && transcriptText) {
      lines = parseTranscriptText(transcriptText);
    }
    if (lines.length === 0) {
      sendError(res, 400, 'The transcript could not be parsed into meeting lines.');
      return;
    }

    let analysis;
    try {
      analysis = await analyzeTranscript(lines);
    } catch (error) {
      if (isProviderAccessIssue(error)) {
        analysis = analyzeTranscriptLocally(lines);
        analysisModel = 'local-fallback';
        warnings.push('OpenAI analysis was unavailable, so MeetMind generated a local fallback summary from the transcript text.');
      } else {
        throw error;
      }
    }

    const result = buildMeetingResult(lines, analysis);

    json(res, 200, {
      ok: true,
      data: result,
      meta: {
        title: input.title || 'Meeting',
        source: input.source,
        transcriptionModel,
        analysisModel,
        warnings
      }
    });
  } catch (error) {
    sendError(res, error.statusCode || 500, 'Processing failed.', error.message);
  }
}

function serveStatic(req, res, pathname) {
  const relativePath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(path.join(ROOT, relativePath));
  if (!safePath.startsWith(ROOT)) {
    sendError(res, 403, 'Access denied.');
    return;
  }
  if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
    sendError(res, 404, 'File not found.');
    return;
  }

  const ext = path.extname(safePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': STATIC_TYPES[ext] || 'application/octet-stream'
  });
  fs.createReadStream(safePath).pipe(res);
}

function createAppServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      json(res, 200, {
        ok: true,
        ...buildHealthPayload()
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/process') {
      await handleProcess(req, res);
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      serveStatic(req, res, url.pathname);
      return;
    }

    sendError(res, 405, 'Method not allowed.');
  });
}

if (require.main === module) {
  const server = createAppServer();
  server.listen(PORT, () => {
    console.log(`MeetMind server running at http://localhost:${PORT}`);
    const health = buildHealthPayload(true);
    if (LOCAL_TRANSCRIPTION_ENABLED) {
      console.log(`Local faster-whisper transcription enabled with model: ${LOCAL_WHISPER_MODEL}`);
      if (health.capabilities.local.pythonVersion) {
        console.log(`Detected Python runtime: ${health.capabilities.local.pythonVersion}`);
      }
      if (LOCAL_DIARIZATION_ENABLED) {
        console.log(HAS_HUGGINGFACE_TOKEN
          ? `Local pyannote diarization configured with model: ${LOCAL_DIARIZATION_MODEL}`
          : 'Local pyannote diarization is enabled in config, but HUGGINGFACE_TOKEN is missing.');
      }
    }
    console.log(`App mode: ${health.mode}`);
    console.log(`Media processing mode: ${LOCAL_ONLY_MEDIA_PROCESSING ? 'local-only' : MEDIA_PROCESSING_MODE}`);
    if (!HAS_OPENAI_KEY) {
      console.log('OPENAI_API_KEY is not set. MeetMind will use local transcription for files and local fallback analysis for transcript insights.');
    } else {
      console.log(`Using provider: ${ACTIVE_PROVIDER}`);
    }
    health.capabilities.local.issues.forEach(issue => console.log(`[Local setup issue] ${issue}`));
    health.capabilities.local.warnings.forEach(warning => console.log(`[Local setup note] ${warning}`));
  });
}

module.exports = {
  ANALYSIS_MODEL,
  OPENAI_TRANSCRIPTION_MODEL,
  MAX_MEDIA_BYTES,
  buildHealthPayload,
  buildMeetingResult,
  createAppServer,
  parseTranscriptText
};
