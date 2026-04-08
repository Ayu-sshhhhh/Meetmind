'use strict';

const path = require('node:path');
const { buildHealthPayload } = require(path.join(__dirname, '..', 'server.js'));

function printList(title, items) {
  if (!Array.isArray(items) || items.length === 0) return;
  console.log(`${title}:`);
  items.forEach(item => console.log(`- ${item}`));
}

function packageStatus(checked, present) {
  if (!checked) return 'not checked';
  return present ? 'found' : 'missing';
}

const report = buildHealthPayload(true);
const local = report.capabilities.local;
const diarization = local.diarization;

console.log('MeetMind Doctor');
console.log('===============');
console.log(`Mode: ${report.mode}`);
console.log(`Configured: ${report.configured ? 'yes' : 'no'}`);
console.log(`Analysis model: ${report.analysisModel}`);
console.log(`Transcription route: ${report.transcriptionModel}`);
console.log('');
console.log(`OpenAI configured: ${report.capabilities.openai.configured ? 'yes' : 'no'}`);
console.log(`Local transcription enabled: ${local.enabled ? 'yes' : 'no'}`);
console.log(`Local transcription ready: ${local.ready ? 'yes' : 'no'}`);
console.log(`Configured Python bin: ${local.configuredPythonBin}`);
console.log(`Resolved Python bin: ${local.pythonBin}`);
console.log(`Python runtime: ${local.pythonVersion || 'not detected'}`);
console.log('');
console.log('Python packages:');
console.log(`- faster-whisper: ${packageStatus(local.dependenciesChecked, local.packageChecks.fasterWhisper)}`);
console.log(`- torchaudio: ${packageStatus(local.dependenciesChecked, local.packageChecks.torchaudio)}`);
console.log(`- pyannote.audio: ${packageStatus(local.dependenciesChecked, local.packageChecks.pyannoteAudio)}`);
console.log('');
console.log(`Diarization enabled: ${diarization.enabled ? 'yes' : 'no'}`);
console.log(`Diarization token present: ${diarization.tokenPresent ? 'yes' : 'no'}`);
console.log(`Diarization ready: ${diarization.ready ? 'yes' : 'no'}`);
console.log('');

printList('Issues', local.issues);
printList('Notes', local.warnings);

if (!report.configured) {
  process.exitCode = 1;
}
