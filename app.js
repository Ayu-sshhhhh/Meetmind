/* ============================================================
   MeetMind — AI Meeting Intelligence Platform
   app.js — Full application logic
   ============================================================ */

'use strict';

// ===== HERO WAVE BARS =====
(function buildHeroWave() {
  const container = document.getElementById('hero-wave');
  if (!container) return;
  const count = 48;
  for (let i = 0; i < count; i++) {
    const bar = document.createElement('div');
    bar.className = 'wave-bar';
    const height = 20 + Math.random() * 60;
    const dur = 0.8 + Math.random() * 1.4;
    const delay = Math.random() * 1.5;
    bar.style.cssText = `
      height: ${height}px;
      --dur: ${dur}s;
      animation-delay: ${delay}s;
    `;
    container.appendChild(bar);
  }
})();

// ===== THEME TOGGLE =====
(function initTheme() {
  const btn = document.getElementById('theme-toggle-btn');
  const stored = localStorage.getItem('meetmind_theme');
  if (stored === 'light') { document.body.classList.add('light-mode'); btn.textContent = '☀️'; }
  btn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-mode');
    btn.textContent = isLight ? '☀️' : '🌙';
    localStorage.setItem('meetmind_theme', isLight ? 'light' : 'dark');
  });
})();

// ===== SIDEBAR =====
const sidebar = document.getElementById('sidebar');
const mainWrapper = document.getElementById('main-wrapper');
document.getElementById('open-sidebar-btn').addEventListener('click', () => {
  sidebar.classList.add('open');
});
document.getElementById('sidebar-toggle').addEventListener('click', () => {
  sidebar.classList.remove('open');
});

// ===== STATUS =====
function setStatus(text, type = 'idle') {
  const dot = document.getElementById('status-dot');
  const label = document.getElementById('status-label');
  label.textContent = text;
  dot.className = 'status-dot';
  if (type === 'processing') dot.classList.add('processing');
  if (type === 'error') dot.classList.add('error');
}

// ===== TOAST =====
function showToast(msg, type = 'info', duration = 3200) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

function clearLaunchBanner() {
  const existing = document.getElementById('launch-banner');
  if (existing) existing.remove();
}

function showLaunchBanner(options) {
  clearLaunchBanner();

  const notes = Array.isArray(options.notes) ? options.notes.filter(Boolean) : [];
  const notesMarkup = notes.length > 0
    ? `<ul class="launch-banner-notes">${notes.map(note => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`
    : '';

  const banner = document.createElement('div');
  banner.id = 'launch-banner';
  banner.className = `launch-banner ${options.type || 'info'}`;
  banner.innerHTML = `
    <div class="launch-banner-body">
      <strong>${escapeHtml(options.title || 'MeetMind startup notice')}</strong>
      <p>${escapeHtml(options.message || '')}</p>
      ${notesMarkup}
    </div>
    <button class="launch-banner-close" type="button" aria-label="Dismiss startup notice">Close</button>
  `;

  banner.querySelector('.launch-banner-close').addEventListener('click', () => {
    banner.remove();
  });

  document.body.prepend(banner);
}

// ===== INPUT TABS =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
  });
});

// ===== DROP ZONE =====
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const filePreview = document.getElementById('file-preview');
const uploadControls = document.getElementById('upload-controls');
const dropOverlay = dropZone.querySelector('.drop-overlay');

let currentFile = null;
const MAX_MEDIA_BYTES = 512 * 1024 * 1024;

dropZone.addEventListener('click', (e) => {
  if (!e.target.closest('label')) fileInput.click();
});
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
  dropOverlay.classList.add('visible');
});
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
  dropOverlay.classList.remove('visible');
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  dropOverlay.classList.remove('visible');
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelect(file);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFileSelect(fileInput.files[0]);
});

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function handleFileSelect(file) {
  const allowed = ['audio/', 'video/'];
  if (!allowed.some(t => file.type.startsWith(t))) {
    showToast('Unsupported file type. Please upload audio or video.', 'error');
    return;
  }
  if (file.size > MAX_MEDIA_BYTES) {
    showToast('Files larger than 512 MB need to be compressed or split before processing.', 'error');
    return;
  }
  currentFile = file;
  document.getElementById('preview-name').textContent = file.name;
  document.getElementById('preview-size').textContent = formatBytes(file.size);
  const audioPlayer = document.getElementById('audio-player');
  const audioWrap = document.getElementById('audio-player-wrap');
  audioPlayer.src = URL.createObjectURL(file);
  audioWrap.classList.remove('hidden');
  const thumb = filePreview.querySelector('.file-thumb');
  thumb.textContent = file.type.startsWith('video/') ? '🎬' : '🎵';
  filePreview.classList.remove('hidden');
  uploadControls.classList.remove('hidden');
  showToast(`"${file.name}" loaded successfully`, 'success');
}

function resetSelectedFile() {
  currentFile = null;
  fileInput.value = '';

  const audioPlayer = document.getElementById('audio-player');
  audioPlayer.pause();
  audioPlayer.removeAttribute('src');
  audioPlayer.load();

  document.getElementById('audio-player-wrap').classList.add('hidden');
  filePreview.classList.add('hidden');
  uploadControls.classList.add('hidden');
}

document.getElementById('remove-file-btn').addEventListener('click', () => {
  resetSelectedFile();
});

// ===== RECORD PANEL HELPERS =====
const recordAudioChip = document.getElementById('record-audio-chip');
const recordLiveChip = document.getElementById('record-live-chip');
const recordSpeakerChip = document.getElementById('record-speaker-chip');
const recordHelperText = document.getElementById('record-helper-text');
const liveTextEl = document.getElementById('live-text');
const liveWordCountEl = document.getElementById('live-word-count');
const liveEngineBadgeEl = document.getElementById('live-engine-badge');
const liveTranscriptWrap = document.getElementById('live-transcript');
const recordControls = document.getElementById('record-controls');

function normalizeInlineText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function countInlineWords(value) {
  return normalizeInlineText(value).split(' ').filter(Boolean).length;
}

function setRecordChip(element, text, state = 'idle') {
  if (!element) return;
  element.textContent = text;
  element.dataset.state = state;
}

function setRecordHelper(text) {
  if (recordHelperText) {
    recordHelperText.textContent = text;
  }
}

function setLivePreview(text, engineLabel = 'Browser captions') {
  if (liveTextEl) {
    liveTextEl.textContent = text || 'Listening…';
  }
  if (liveEngineBadgeEl) {
    liveEngineBadgeEl.textContent = engineLabel;
  }
  if (liveWordCountEl) {
    const words = countInlineWords(text);
    liveWordCountEl.textContent = `${words} word${words === 1 ? '' : 's'}`;
  }
}

function resetRecordPanelState() {
  setRecordChip(recordAudioChip, 'Audio capture: idle', 'idle');
  setRecordChip(recordLiveChip, 'Live transcript: idle', 'idle');
  setRecordChip(recordSpeakerChip, 'Speaker split: available only when OpenAI or local diarization succeeds', 'info');
  setRecordHelper('For the best results, keep this tab open in Chrome or Edge and stay close to the microphone.');
  setLivePreview('Listening…', 'Browser captions');
}

resetRecordPanelState();

// ===== AUDIO ENGINE (RECORDER) =====
const AudioEngine = (() => {
  let mediaRecorder = null;
  let stream = null;
  let audioCtx = null;
  let analyser = null;
  let sourceNode = null;
  let processorNode = null;
  let silentGainNode = null;
  let animFrameId = null;
  let startTime = null;
  let timerInterval = null;
  let chunks = [];
  let pcmChunks = [];
  let pcmSampleRate = 48000;
  let recordedBlob = null;
  let recordedMimeType = '';
  let recorderMode = 'idle';
  let isStopping = false;
  let stopPromise = null;
  let resolveStopPromise = null;

  const canvas = document.getElementById('waveform-canvas');
  const ctx2d = canvas.getContext('2d');
  const recBtn = document.getElementById('record-btn');
  const recIcon = document.getElementById('rec-icon');
  const recBtnLabel = document.getElementById('rec-btn-label');
  const recTimer = document.getElementById('rec-timer');
  const recStatus = document.getElementById('rec-status-label');

  function getPreferredAudioConstraints() {
    return {
      audio: {
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 48000 },
        sampleSize: { ideal: 16 },
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true }
      }
    };
  }

  async function getMicrophoneStream() {
    try {
      return await navigator.mediaDevices.getUserMedia(getPreferredAudioConstraints());
    } catch (error) {
      return navigator.mediaDevices.getUserMedia({ audio: true });
    }
  }

  function canUseMicrophoneOnThisPage() {
    if (window.isSecureContext) return true;
    const hostname = String(window.location?.hostname || '').toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  }

  function encodeWavFromChunks(buffers, sampleRate) {
    const normalizedBuffers = Array.isArray(buffers) ? buffers.filter(buffer => buffer?.length) : [];
    const totalSamples = normalizedBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
    if (!totalSamples) return null;

    const wavBuffer = new ArrayBuffer(44 + totalSamples * 2);
    const view = new DataView(wavBuffer);
    let offset = 0;

    function writeAscii(value) {
      for (let i = 0; i < value.length; i++) {
        view.setUint8(offset++, value.charCodeAt(i));
      }
    }

    writeAscii('RIFF');
    view.setUint32(offset, 36 + totalSamples * 2, true); offset += 4;
    writeAscii('WAVE');
    writeAscii('fmt ');
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * 2, true); offset += 4;
    view.setUint16(offset, 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    writeAscii('data');
    view.setUint32(offset, totalSamples * 2, true); offset += 4;

    normalizedBuffers.forEach(buffer => {
      for (let i = 0; i < buffer.length; i++) {
        const sample = Math.max(-1, Math.min(1, buffer[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    });

    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  function clearVisualizer() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = null;
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function cleanupMediaResources() {
    clearVisualizer();
    if (processorNode) {
      try { processorNode.disconnect(); } catch (error) {}
    }
    processorNode = null;
    if (silentGainNode) {
      try { silentGainNode.disconnect(); } catch (error) {}
    }
    silentGainNode = null;
    if (sourceNode) {
      try { sourceNode.disconnect(); } catch (error) {}
    }
    sourceNode = null;
    if (stream) {
      stream.getTracks().forEach(track => {
        try { track.stop(); } catch (error) {}
      });
    }
    stream = null;
    if (audioCtx) {
      try { audioCtx.close(); } catch (error) {}
    }
    audioCtx = null;
    analyser = null;
  }

  function setIdleButtonState() {
    recBtn.disabled = false;
    recBtn.classList.remove('recording');
    recIcon.textContent = '🎙️';
    recBtnLabel.textContent = 'Start Recording';
  }

  function setRecordingButtonState() {
    recBtn.disabled = false;
    recBtn.classList.add('recording');
    recIcon.textContent = 'Stop';
    recBtnLabel.textContent = 'Stop Recording';
  }

  function setFinalizingButtonState() {
    recBtn.disabled = true;
    recBtn.classList.remove('recording');
    recIcon.textContent = '…';
    recBtnLabel.textContent = 'Finalizing';
  }

  function finishRecording(blob) {
    recordedBlob = blob && blob.size > 0 ? blob : null;
    cleanupMediaResources();
    mediaRecorder = null;
    recorderMode = 'idle';
    pcmChunks = [];
    isStopping = false;
    stopPromise = null;
    setIdleButtonState();
    drawIdle();

    if (recordedBlob && recordedBlob.size > 0) {
      recordControls.classList.remove('hidden');
      setStatus('Recording ready', 'idle');
      recStatus.textContent = `Recording complete - ${Math.max(1, Math.round(recordedBlob.size / 1024))} KB captured`;
      setRecordChip(recordAudioChip, 'Audio capture: ready to process', 'good');
      setRecordHelper('Review the live transcript, add an optional title, or re-record before processing.');
      if (typeof resolveStopPromise === 'function') {
        resolveStopPromise(recordedBlob);
        resolveStopPromise = null;
      }
      return;
    }

    recordControls.classList.add('hidden');
    setStatus('Recording failed', 'error');
    recStatus.textContent = 'No audio was captured. Please try again.';
    setRecordChip(recordAudioChip, 'Audio capture: no usable audio detected', 'error');
    setRecordHelper('Check microphone access and try again. Headsets and quieter rooms usually give better results.');
    showToast('No audio was captured. Check microphone permission and try again.', 'error', 4200);
    if (typeof resolveStopPromise === 'function') {
      resolveStopPromise(recordedBlob);
      resolveStopPromise = null;
    }
  }

  function startPcmRecorder() {
    if (!audioCtx || !sourceNode || typeof audioCtx.createScriptProcessor !== 'function') {
      throw new Error('This browser could not start live audio capture. Try Chrome or Edge on HTTPS or localhost.');
    }

    pcmChunks = [];
    pcmSampleRate = audioCtx.sampleRate || 48000;
    recordedMimeType = 'audio/wav';
    processorNode = audioCtx.createScriptProcessor(4096, 1, 1);
    processorNode.onaudioprocess = (event) => {
      const channel = event.inputBuffer?.getChannelData(0);
      if (!channel?.length) return;
      pcmChunks.push(new Float32Array(channel));
    };

    silentGainNode = audioCtx.createGain();
    silentGainNode.gain.value = 0;
    sourceNode.connect(processorNode);
    processorNode.connect(silentGainNode);
    silentGainNode.connect(audioCtx.destination);
    recorderMode = 'pcm';
  }

  async function startRecordingCompat() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support microphone recording.');
      }
      if (!canUseMicrophoneOnThisPage()) {
        throw new Error('Microphone recording requires HTTPS or localhost in this browser.');
      }
      if (typeof MediaRecorder === 'undefined' && !(window.AudioContext || window.webkitAudioContext)) {
        throw new Error('This browser does not support live audio recording.');
      }

      recordedBlob = null;
      recordedMimeType = '';
      chunks = [];
      pcmChunks = [];
      recorderMode = 'idle';
      recTimer.textContent = '00:00';
      recordControls.classList.add('hidden');
      liveTranscriptWrap.classList.remove('hidden');
      Transcriber.reset();
      setRecordChip(recordAudioChip, 'Audio capture: connecting to microphone…', 'working');
      setRecordChip(recordLiveChip, 'Live transcript: starting browser captions…', 'working');
      setRecordHelper('Keep this tab open while recording. MeetMind will try to keep browser captions running in the background.');

      stream = await getMicrophoneStream();
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (typeof audioCtx.resume === 'function' && audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      sourceNode = audioCtx.createMediaStreamSource(stream);
      sourceNode.connect(analyser);

      const preferredMimeType = getSupportedRecordingMimeType();
      recordedMimeType = preferredMimeType || 'audio/wav';
      if (typeof MediaRecorder !== 'undefined') {
        try {
          mediaRecorder = preferredMimeType
            ? new MediaRecorder(stream, { mimeType: preferredMimeType, audioBitsPerSecond: 128000 })
            : new MediaRecorder(stream, { audioBitsPerSecond: 128000 });
          recorderMode = 'media-recorder';
        } catch (error) {
          mediaRecorder = null;
          recorderMode = 'idle';
        }
      }

      if (mediaRecorder) {
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };

        mediaRecorder.onerror = (event) => {
          const message = event?.error?.message || 'Recording failed in this browser.';
          recStatus.textContent = message;
          setStatus('Recording failed', 'error');
          setRecordChip(recordAudioChip, 'Audio capture: browser recorder failed', 'error');
          showToast(message, 'error', 4200);
        };

        mediaRecorder.onstop = () => {
          const blobType = chunks[0]?.type || recordedMimeType || 'audio/webm';
          const blob = chunks.length > 0 ? new Blob(chunks, { type: blobType }) : null;
          finishRecording(blob);
        };

        try {
          mediaRecorder.start(1000);
        } catch (error) {
          mediaRecorder = null;
          recorderMode = 'idle';
          startPcmRecorder();
        }
      } else {
        startPcmRecorder();
      }
      startTime = Date.now();
      timerInterval = setInterval(() => {
        recTimer.textContent = formatTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      animate();

      setRecordingButtonState();
      recStatus.textContent = 'Recording in progress...';
      setStatus('Recording...', 'processing');
      setRecordChip(
        recordAudioChip,
        recorderMode === 'pcm'
          ? 'Audio capture: recording from microphone with browser fallback'
          : 'Audio capture: recording from microphone',
        'good'
      );
      setRecordChip(recordLiveChip, 'Live transcript: browser captions are listening', 'working');
      Transcriber.startLive();
    } catch (err) {
      const message = err?.message || 'Microphone access denied or unavailable.';
      cleanupMediaResources();
      mediaRecorder = null;
      recorderMode = 'idle';
      setIdleButtonState();
      drawIdle();
      setStatus('Recording failed', 'error');
      recStatus.textContent = message;
      setRecordChip(recordAudioChip, 'Audio capture: microphone access failed', 'error');
      setRecordHelper('Allow microphone access in the browser and try again.');
      showToast(message, 'error', 4200);
    }
  }

  function getSupportedRecordingMimeType() {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
      return '';
    }

    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
      'audio/mpeg'
    ];

    return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
  }

  function drawIdle() {
    const W = canvas.offsetWidth * window.devicePixelRatio || canvas.width;
    const H = canvas.height;
    canvas.width = W;
    ctx2d.clearRect(0, 0, W, H);

    // idle line
    ctx2d.beginPath();
    ctx2d.moveTo(0, H / 2);
    ctx2d.lineTo(W, H / 2);
    ctx2d.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx2d.lineWidth = 2;
    ctx2d.stroke();
  }

  function drawWave(dataArray) {
    const W = canvas.width;
    const H = canvas.height;
    ctx2d.clearRect(0, 0, W, H);

    const gradient = ctx2d.createLinearGradient(0, 0, W, 0);
    gradient.addColorStop(0, '#6366f1');
    gradient.addColorStop(1, '#06b6d4');

    ctx2d.beginPath();
    const sliceWidth = W / dataArray.length;
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * H) / 2;
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
      x += sliceWidth;
    }
    ctx2d.lineTo(W, H / 2);
    ctx2d.strokeStyle = gradient;
    ctx2d.lineWidth = 2.5;
    ctx2d.stroke();
  }

  function animate() {
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.fftSize);
    function loop() {
      if (!analyser) return;
      animFrameId = requestAnimationFrame(loop);
      analyser.getByteTimeDomainData(dataArray);
      drawWave(dataArray);
    }
    loop();
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  async function startRecording() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      mediaRecorder = new MediaRecorder(stream);
      chunks = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = () => {
        recordedBlob = new Blob(chunks, { type: 'audio/webm' });
        document.getElementById('record-controls').classList.remove('hidden');
        setStatus('Recording ready', 'idle');
        recStatus.textContent = 'Recording complete — ready to process';
      };
      mediaRecorder.start();
      startTime = Date.now();
      timerInterval = setInterval(() => {
        recTimer.textContent = formatTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      animate();

      recBtn.classList.add('recording');
      recIcon.textContent = '⏹️';
      recBtnLabel.textContent = 'Stop Recording';
      recStatus.textContent = '● Recording in progress…';
      document.getElementById('live-transcript').classList.remove('hidden');
      setStatus('Recording…', 'processing');
      Transcriber.startLive();
    } catch (err) {
      showToast('Microphone access denied or unavailable.', 'error');
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (animFrameId) cancelAnimationFrame(animFrameId);
    clearInterval(timerInterval);
    if (audioCtx) audioCtx.close();
    recBtn.classList.remove('recording');
    recIcon.textContent = '🎙️';
    recBtnLabel.textContent = 'Start Recording';
    drawIdle();
    Transcriber.stopLive();
  }

  async function stopRecordingSafely() {
    if (recorderMode === 'idle') {
      return recordedBlob;
    }
    if (isStopping && stopPromise) {
      return stopPromise;
    }

    isStopping = true;
    setFinalizingButtonState();
    recStatus.textContent = 'Finalizing recording...';
    setStatus('Finalizing recording...', 'processing');
    setRecordChip(recordAudioChip, 'Audio capture: finalizing recording…', 'working');
    setRecordChip(recordLiveChip, 'Live transcript: finalizing captions', 'working');
    Transcriber.stopLive();

    stopPromise = new Promise(resolve => {
      resolveStopPromise = resolve;
    });

    if (recorderMode === 'pcm') {
      const wavBlob = encodeWavFromChunks(pcmChunks, pcmSampleRate);
      finishRecording(wavBlob);
      return stopPromise;
    }

    try {
      if (typeof mediaRecorder.requestData === 'function') {
        try { mediaRecorder.requestData(); } catch (error) {}
      }
      mediaRecorder.stop();
    } catch (error) {
      finishRecording(recordedBlob);
    }

    return stopPromise;
  }

  drawIdle();

  recBtn.addEventListener('click', async () => {
    if (recorderMode !== 'idle') {
      await stopRecordingSafely();
      return;
    }
    startRecordingCompat();
  });

  return {
    getBlob: () => recordedBlob,
    getMimeType: () => recordedBlob?.type || recordedMimeType || '',
    isRecording: () => recorderMode !== 'idle',
    stop: stopRecordingSafely,
    reset: () => {
      if (recorderMode !== 'idle') return;
      recordedBlob = null;
      recordedMimeType = '';
      chunks = [];
      pcmChunks = [];
      mediaRecorder = null;
      recorderMode = 'idle';
      cleanupMediaResources();
      recTimer.textContent = '00:00';
      recStatus.textContent = 'Ready to record';
      recordControls.classList.add('hidden');
      liveTranscriptWrap.classList.add('hidden');
      setIdleButtonState();
      resetRecordPanelState();
      Transcriber.reset();
      document.getElementById('live-text').textContent = 'Listening…';
      drawIdle();
    }
  };
})();

// ===== TRANSCRIBER =====
const Transcriber = (() => {
  let recognition = null;
  let liveTranscript = '';
  let interimTranscript = '';
  let shouldRestart = false;
  let restartTimer = null;

  function getRecognitionLanguage() {
    return normalizeInlineText(
      document.documentElement?.lang ||
      navigator.language ||
      navigator.languages?.[0] ||
      'en-US'
    ) || 'en-US';
  }

  function renderTranscript() {
    const combined = normalizeInlineText(`${liveTranscript} ${interimTranscript}`);
    setLivePreview(combined || 'Listening…', 'Browser captions');
  }

  function scheduleRestart(reasonText) {
    if (!shouldRestart) return;
    clearTimeout(restartTimer);
    setRecordChip(recordLiveChip, reasonText || 'Live transcript: reconnecting browser captions…', 'working');
    restartTimer = setTimeout(() => {
      if (!shouldRestart) return;
      startRecognition();
    }, 450);
  }

  function startRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setRecordChip(recordLiveChip, 'Live transcript: not supported in this browser', 'error');
      setRecordHelper('Use Chrome or Edge if you want browser live captions while recording.');
      setLivePreview('Live transcription is not supported in this browser. Recording will still be processed.', 'Browser captions unavailable');
      return;
    }

    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = getRecognitionLanguage();

    recognition.onstart = () => {
      setRecordChip(recordLiveChip, 'Live transcript: listening continuously', 'good');
      setRecordHelper('Browser captions are active. If they pause, MeetMind will try to reconnect automatically.');
      renderTranscript();
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i]?.[0]?.transcript || '';
        if (event.results[i].isFinal) final += `${chunk} `;
        else interim += chunk;
      }
      if (final) {
        liveTranscript = normalizeInlineText(`${liveTranscript} ${final}`);
      }
      interimTranscript = normalizeInlineText(interim);
      renderTranscript();
    };

    recognition.onerror = (event) => {
      const code = event?.error || 'unknown';
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        shouldRestart = false;
        setRecordChip(recordLiveChip, 'Live transcript: microphone or speech permission denied', 'error');
        setRecordHelper('Allow microphone and speech recognition permissions if you want live captions.');
        showToast('Browser live transcript needs microphone or speech-recognition permission.', 'error', 4200);
        return;
      }
      if (code === 'audio-capture') {
        shouldRestart = false;
        setRecordChip(recordLiveChip, 'Live transcript: browser could not capture speech audio', 'error');
        setRecordHelper('Recording can still continue, but browser live captions could not start.');
        return;
      }
      if (code === 'network') {
        scheduleRestart('Live transcript: reconnecting after a network interruption…');
        return;
      }
      if (code === 'aborted' || code === 'no-speech') {
        scheduleRestart('Live transcript: paused, reconnecting…');
        return;
      }
      scheduleRestart('Live transcript: restarting browser captions…');
    };

    recognition.onend = () => {
      recognition = null;
      interimTranscript = '';
      renderTranscript();
      if (shouldRestart) {
        scheduleRestart('Live transcript: reconnecting browser captions…');
      } else {
        setRecordChip(recordLiveChip, liveTranscript ? 'Live transcript: captured from browser captions' : 'Live transcript: stopped', liveTranscript ? 'good' : 'idle');
      }
    };

    try {
      recognition.start();
    } catch (error) {
      scheduleRestart('Live transcript: retrying browser captions…');
    }
  }

  function startLive() {
    shouldRestart = true;
    clearTimeout(restartTimer);
    restartTimer = null;
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setRecordChip(recordLiveChip, 'Live transcript: not supported in this browser', 'error');
      setRecordHelper('Use Chrome or Edge if you want browser live captions while recording.');
      setLivePreview('Live transcription is not supported in this browser. Recording will still be processed.', 'Browser captions unavailable');
      return;
    }
    startRecognition();
    return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      liveTranscript += final;
      document.getElementById('live-text').textContent = liveTranscript + interim || 'Listening…';
    };
    recognition.onerror = () => {};
    recognition.start();
  }

  function stopLive() {
    shouldRestart = false;
    clearTimeout(restartTimer);
    restartTimer = null;
    if (recognition) { try { recognition.stop(); } catch (error) {} }
    recognition = null;
    interimTranscript = '';
    renderTranscript();
    if (liveTranscript) {
      setRecordChip(recordLiveChip, 'Live transcript: captured from browser captions', 'good');
    } else {
      setRecordChip(recordLiveChip, 'Live transcript: no browser captions were captured', 'idle');
    }
    return;
    if (recognition) { try { recognition.stop(); } catch(e) {} }
  }

  function getLiveTranscript() { return normalizeInlineText(liveTranscript); }
  function reset() {
    shouldRestart = false;
    clearTimeout(restartTimer);
    restartTimer = null;
    if (recognition) { try { recognition.stop(); } catch (error) {} }
    recognition = null;
    liveTranscript = '';
    interimTranscript = '';
    setLivePreview('Listening…', 'Browser captions');
    setRecordChip(recordLiveChip, 'Live transcript: idle', 'idle');
    return;
  }

  // Simulate transcription from a file (since we can't actually decode audio in-browser without a backend)
  function simulateFileTranscription(file) {
    const templates = [
      [
        { speaker: 'Alex Chen', text: 'Good morning everyone. Thanks for joining today\'s product roadmap review. Let\'s get started with Q2 priorities.' },
        { speaker: 'Sarah Mitchell', text: 'Sure. I\'ve been looking at the data from Q1 and our user engagement metrics were up 23 percent compared to last quarter.' },
        { speaker: 'James Park', text: 'That\'s excellent. The mobile app improvements really paid off. We need to double down on that approach.' },
        { speaker: 'Alex Chen', text: 'Agreed. So our decision is to prioritize mobile-first features for the entire Q2 roadmap. James, can you lead that effort?' },
        { speaker: 'James Park', text: 'Absolutely. I\'ll have a detailed plan ready by next Friday, April 5th.' },
        { speaker: 'Sarah Mitchell', text: 'I\'ll work on the analytics dashboard to track the new KPIs. I\'ll need the requirements from the product team by end of week.' },
        { speaker: 'Alex Chen', text: 'Let\'s also address the customer feedback backlog. We\'ve received over 200 feature requests regarding the search functionality.' },
        { speaker: 'James Park', text: 'Yes, we\'ve decided to completely overhaul the search experience. We\'re moving to an AI-powered semantic search engine.' },
        { speaker: 'Sarah Mitchell', text: 'I can coordinate with the design team to create wireframes. Target date would be April 12th.' },
        { speaker: 'Alex Chen', text: 'Perfect. One more thing — we need to decide on the pricing model for the enterprise tier.' },
        { speaker: 'James Park', text: 'Based on competitor analysis, we\'ve agreed to go with a per-seat pricing model starting at 15 dollars per user per month.' },
        { speaker: 'Sarah Mitchell', text: 'Marketing will need to update all the pricing pages and prepare the announcement. I\'ll handle that by April 8th.' },
        { speaker: 'Alex Chen', text: 'Great. Let\'s wrap up. Thanks everyone for your contributions today. We have clear next steps and deadlines. Talk next week.' },
      ],
      [
        { speaker: 'Maria Torres', text: 'Welcome to the engineering all-hands. I want to start by recognizing the incredible work the team did on the platform migration.' },
        { speaker: 'David Kim', text: 'The migration to the new microservices architecture is complete. We saw a 40 percent reduction in latency which exceeded our target of 30 percent.' },
        { speaker: 'Lisa Patel', text: 'The QA team tested over 1,200 scenarios. We found and fixed 47 critical bugs before go-live. Really proud of this result.' },
        { speaker: 'Maria Torres', text: 'Excellent work. Now let\'s talk about what\'s next. We\'ve decided to adopt Kubernetes for container orchestration starting in May.' },
        { speaker: 'David Kim', text: 'I\'ll need to set up the training program for the engineering team. I\'ll schedule workshops for the week of April 15th.' },
        { speaker: 'Lisa Patel', text: 'QA processes will also need to be updated. I\'ll document the new testing protocols for containerized services by April 10th.' },
        { speaker: 'Maria Torres', text: 'We also need to establish an on-call rotation. The decision was made to move to a 24/7 coverage model with 3 engineers per shift.' },
        { speaker: 'David Kim', text: 'I\'ll create the on-call schedule and compensation policy document. Deadline is this Friday.' },
        { speaker: 'Maria Torres', text: 'Lisa, can you also coordinate with the security team on the new compliance requirements?' },
        { speaker: 'Lisa Patel', text: 'Yes, I\'ll schedule a sync with the security team for next Tuesday and have a gap analysis done by April 18th.' },
        { speaker: 'Maria Torres', text: 'Perfect. Our overarching decision is to achieve SOC 2 Type II certification by end of Q3. That\'s our north star goal.' },
        { speaker: 'David Kim', text: 'We\'re fully aligned on that. I\'ll kick off the certification process with the external auditors this week.' },
      ]
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  return { startLive, stopLive, getLiveTranscript, reset, simulateFileTranscription };
})();

// ===== SENTIMENT ENGINE =====
function analyseSentiment(text) {
  const pos = /\b(great|excellent|perfect|good|agree|congratulations|proud|success|excited|happy|glad|appreciate|achieved|exceeded|positive|fantastic|wonderful|strong|clear|improve|growth|benefit|opportunity|win)\b/gi;
  const neg = /\b(problem|issue|concern|fail|behind|delay|miss|critical|urgent|block|difficult|challenge|risk|worried|frustrated|unclear|conflict|decline|loss|stuck|bad|wrong|error|complaint)\b/gi;
  const posCount = (text.match(pos) || []).length;
  const negCount = (text.match(neg) || []).length;
  if (posCount > negCount * 1.5) return 'positive';
  if (negCount > posCount * 1.5) return 'critical';
  return 'neutral';
}

// ===== AI PROCESSOR =====
const AIProcessor = (() => {

  function extractSummary(lines) {
    const speakers = [...new Set(lines.map(l => l.speaker).filter(speaker => !isPlaceholderSpeakerLabel(speaker)))];
    const words = lines.map(l => l.text).join(' ');
    const wordCount = words.split(' ').length;

    // Topic extraction — simple keyword frequency
    const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','this','that','is','are','was','were','we','i','you','they','it','our','also','can','will','need','let']);
    const freq = {};
    words.toLowerCase().replace(/[^a-z\s]/g,'').split(/\s+/).forEach(w => {
      if (w.length > 3 && !stopWords.has(w)) freq[w] = (freq[w] || 0) + 1;
    });
    const topics = Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0, 6).map(([w]) => w);

    const duration = Math.round(wordCount / 130); // avg speaking pace

    return {
      body: buildSummaryText(lines, speakers, topics),
      topics: topics.map(t => t.charAt(0).toUpperCase() + t.slice(1)),
      speakers,
      wordCount,
      duration
    };
  }

  function buildSummaryText(lines, speakers, topics) {
    const speakerList = speakers.slice(0, 3).join(', ') + (speakers.length > 3 ? ` and ${speakers.length - 3} others` : '');

    // Find sentences with high-value keywords
    const sentences = lines.map(l => l.text);
    const keyPhrases = ['decided','decision','agreed','plan','target','goal','priority','focus','strategy','objective','important','critical','key','major'];
    const highlightSentences = sentences.filter(s => keyPhrases.some(kp => s.toLowerCase().includes(kp)));

    let summary = speakers.length > 0
      ? `This meeting involved ${speakerList} and covered ${topics.slice(0,3).join(', ')} as central themes. `
      : `This meeting covered ${topics.slice(0,3).join(', ')} as central themes. `;
    if (highlightSentences.length > 0) {
      summary += `Key discussion points included: "${highlightSentences[0]}" `;
      if (highlightSentences[1]) summary += `and "${highlightSentences[1]}" `;
    }
    summary += `The group made clear progress toward shared objectives, establishing responsibilities and timelines. `;
    summary += `Overall, the meeting resulted in actionable outcomes with specific owners assigned to deliverables.`;
    return summary;
  }

  function extractActionItems(lines) {
    const actionKeywords = [
      /\bi['']ll\b/i, /\bwill\b/i, /\bgoing to\b/i, /\bneed to\b/i,
      /\bshould\b/i, /\bresponsible for\b/i, /\bhandle\b/i,
      /\bcoordinate\b/i, /\bprepare\b/i, /\bschedule\b/i, /\bcreate\b/i,
      /\bdocument\b/i, /\bset up\b/i, /\bkick off\b/i, /\bupdate\b/i
    ];
    const datePattern = /\b(by|on|before|until|end of|next|this)\s+([\w,\s]+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|quarter|april|may|june|january|february|march|\d{1,2}(?:st|nd|rd|th)?))/gi;
    const priorityWords = { high: /critical|urgent|asap|immediately|priority|must/i, medium: /need|should|important/i };

    const actions = [];
    lines.forEach(line => {
      if (actionKeywords.some(kw => kw.test(line.text))) {
        const dateMatch = line.text.match(datePattern);
        let priority = 'low';
        if (priorityWords.high.test(line.text)) priority = 'high';
        else if (priorityWords.medium.test(line.text)) priority = 'medium';

        // Clean up the text into a task description
        let task = line.text
          .replace(/^(i'll|i will|we will|we'll|you'll|you will)\s*/i, '')
          .replace(/\.$/, '');
        task = task.charAt(0).toUpperCase() + task.slice(1);

        actions.push({
          assignee: isPlaceholderSpeakerLabel(line.speaker) ? 'Unassigned' : line.speaker,
          task,
          deadline: dateMatch ? dateMatch[0].trim() : 'TBD',
          priority
        });
      }
    });

    // Deduplicate and cap at 8
    return actions.slice(0, 8);
  }

  function extractDecisions(lines) {
    const decisionKeywords = [
      /\bdecision\s+(?:is|was|has been)\b/i,
      /\bdecided\b/i, /\bagreed\b/i, /\bgoing with\b/i,
      /\bwe['']re moving to\b/i, /\bwe['']ve chosen\b/i,
      /\bwe will\b/i, /\bour approach\b/i, /\bprioritize\b/i,
      /\boverall.*direction\b/i, /\bnorth star\b/i
    ];

    const decisions = [];
    lines.forEach((line, idx) => {
      if (decisionKeywords.some(kw => kw.test(line.text))) {
        // Get context from adjacent line
        const context = lines[idx - 1]?.text || lines[idx + 1]?.text || '';
        let title = line.text.length > 80 ? line.text.substring(0, 77) + '…' : line.text;
        title = title.charAt(0).toUpperCase() + title.slice(1);
        decisions.push({ title, context, speaker: isPlaceholderSpeakerLabel(line.speaker) ? 'Unknown' : line.speaker });
      }
    });
    return decisions.slice(0, 6);
  }

  function computeScore(lines, actions, decisions) {
    const wordCount = lines.map(l => l.text).join(' ').split(/\s+/).length;
    const speakerCount = Math.max(1, new Set(lines.map(l => l.speaker).filter(speaker => !isPlaceholderSpeakerLabel(speaker))).size);
    const actionScore   = Math.min(100, actions.length * 14);
    const decisionScore = Math.min(100, decisions.length * 18);
    const engageScore   = Math.min(100, speakerCount * 22);
    const lengthScore   = wordCount > 120 ? Math.min(100, wordCount / 8) : 40;
    const overall = Math.round((actionScore * 0.3 + decisionScore * 0.3 + engageScore * 0.2 + lengthScore * 0.2));
    return { overall: Math.min(98, overall), actionScore, decisionScore, engageScore, lengthScore };
  }

  function buildParticipants(lines) {
    const map = {};
    const totalWords = lines.map(l => l.text).join(' ').split(/\s+/).length;
    lines.forEach(l => {
      if (isPlaceholderSpeakerLabel(l.speaker)) return;
      if (!map[l.speaker]) map[l.speaker] = { turns: 0, words: 0, texts: [] };
      const wc = l.text.split(/\s+/).length;
      map[l.speaker].turns++;
      map[l.speaker].words += wc;
      map[l.speaker].texts.push(l.text);
    });
    return Object.entries(map).map(([name, d]) => ({
      name,
      turns: d.turns,
      words: d.words,
      talkPct: Math.round(d.words / totalWords * 100),
      sentiment: analyseSentiment(d.texts.join(' '))
    }));
  }

  function process(lines) {
    const summary = extractSummary(lines);
    const actions = extractActionItems(lines);
    const decisions = extractDecisions(lines);
    const score = computeScore(lines, actions, decisions);
    const participants = buildParticipants(lines);
    return { summary, actions, decisions, lines, score, participants };
  }

  return { process };
})();

const LocalSummaryEngine = (() => {
  function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function countWords(text) {
    return normalizeWhitespace(text).split(/\s+/).filter(Boolean).length;
  }

  function humanJoin(items) {
    const cleaned = [...new Set((Array.isArray(items) ? items : [])
      .map(item => normalizeWhitespace(item))
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

  function ensureTrailingPunctuation(value) {
    const text = normalizeWhitespace(value);
    if (!text) return '';
    return /[.!?]$/.test(text) ? text : `${text}.`;
  }

  function getVisibleSpeakers(lines) {
    return [...new Set((Array.isArray(lines) ? lines : [])
      .map(line => normalizeWhitespace(line?.speaker))
      .filter(speaker => speaker && !isPlaceholderSpeakerLabel(speaker)))];
  }

  function toMeaningfulWordSet(text) {
    const ignored = new Set([
      'about', 'after', 'again', 'also', 'been', 'before', 'being', 'came', 'could',
      'decision', 'discuss', 'discussed', 'follow', 'from', 'have', 'into', 'need',
      'review', 'reviewed', 'should', 'that', 'their', 'them', 'they', 'this',
      'those', 'transcript', 'were', 'what', 'when', 'which', 'while', 'will', 'with',
      'would'
    ]);

    return new Set(normalizeWhitespace(text)
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
    const speakerWords = new Set(getVisibleSpeakers(lines)
      .flatMap(name => name.toLowerCase().split(/\s+/))
      .filter(Boolean));
    const ignoredWords = new Set([
      'about', 'after', 'again', 'align', 'aligned', 'around', 'before', 'because',
      'came', 'concern', 'cover', 'covered', 'decision', 'decided', 'discuss',
      'discussed', 'existing', 'finish', 'focus', 'focused', 'follow', 'for',
      'friday', 'from', 'going', 'keep', 'launch', 'main', 'march', 'monday',
      'month', 'need', 'plan', 'planned', 'prepare', 'priority', 'problem',
      'project', 'qa', 'release', 'review', 'reviewed', 'risk', 'saturday',
      'schedule', 'send', 'ship', 'should', 'sprint', 'strategy', 'sunday', 'team',
      'the', 'thursday', 'this', 'today', 'tomorrow', 'transcript', 'tuesday',
      'urgent', 'week', 'wednesday', 'will', 'work'
    ]);
    const phrases = [];

    for (const line of Array.isArray(lines) ? lines : []) {
      const words = normalizeWhitespace(line?.text)
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

  function collectSummaryEvidence(lines, limit = 4) {
    const evidence = [];
    const seen = new Set();
    const keywords = /\b(decision|decided|agreed|plan|priority|goal|need to|should|will|follow up|follow-up|next step|deadline|risk|blocker|launch|ship|issue|concern)\b/i;

    function pushSentence(sentence, index, emphasis = 0) {
      const text = normalizeWhitespace(sentence);
      if (!text || text.length < 18) return;

      const canonical = text.toLowerCase();
      if (seen.has(canonical)) return;
      seen.add(canonical);

      evidence.push({
        text: ensureTrailingPunctuation(text),
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
      .map(item => item.text);
  }

  function chunkLinesByWordBudget(lines, maxWords = 180) {
    const chunks = [];
    let current = [];
    let currentWords = 0;

    (Array.isArray(lines) ? lines : []).forEach(line => {
      const words = countWords(line?.text);
      if (current.length > 0 && currentWords + words > maxWords) {
        chunks.push(current);
        current = [];
        currentWords = 0;
      }
      current.push(line);
      currentWords += words;
    });

    if (current.length > 0) chunks.push(current);
    return chunks;
  }

  function buildChunkCoverage(lines) {
    const chunks = chunkLinesByWordBudget(lines, 180);
    if (chunks.length < 2) return [];

    const firstTopics = extractTopicPhrases(chunks[0], 2);
    const lastTopics = extractTopicPhrases(chunks[chunks.length - 1], 2);
    const middleTopics = chunks.length > 2 ? extractTopicPhrases(chunks[Math.floor(chunks.length / 2)], 2) : [];
    const coverage = [];

    if (firstTopics.length > 0 && lastTopics.length > 0) {
      coverage.push(`The conversation moved from ${humanJoin(firstTopics)} toward ${humanJoin(lastTopics)}.`);
    }
    if (middleTopics.length > 0 && !coverage.some(sentence => hasStrongWordOverlap(sentence, middleTopics.join(' ')))) {
      coverage.push(`Midway through the meeting, the discussion centered on ${humanJoin(middleTopics)}.`);
    }

    return coverage.slice(0, 2);
  }

  function computeLocalConfidence(lines, actions, decisions, speakers, sections) {
    const wordCount = countWords(lines.map(line => line.text).join(' '));
    let score = 0;

    if (wordCount >= 180) score += 3;
    else if (wordCount >= 90) score += 2;
    else if (wordCount >= 40) score += 1;

    if (actions.length > 0) score += 2;
    if (decisions.length > 0) score += 2;
    if (speakers.length > 1) score += 2;
    else if (speakers.length === 1) score += 1;
    if (normalizeWhitespace(sections?.risks?.[0])) score += 1;
    if (normalizeWhitespace(sections?.outcomes?.[0])) score += 1;

    const notes = [];
    if (speakers.length === 0) notes.push('Speaker attribution may be incomplete because no named speakers were detected.');
    if (wordCount < 60) notes.push('This was a short transcript, so the summary is based on limited evidence.');
    if (actions.length === 0 && decisions.length === 0) notes.push('No explicit owners or decisions were clearly stated, so the summary stays cautious.');

    if (score >= 8) {
      return { level: 'high', label: 'High confidence', note: notes[0] || 'This summary is grounded in multiple signals across the transcript.' };
    }
    if (score >= 4) {
      return { level: 'medium', label: 'Medium confidence', note: notes[0] || 'Some conclusions are based on partial evidence, so wording remains conservative.' };
    }
    return { level: 'low', label: 'Low confidence', note: notes[0] || 'The transcript structure was limited, so this summary should be treated as directional.' };
  }

  function cleanDecisionTitle(value) {
    return normalizeWhitespace(value)
      .replace(/^decision\s*:?\s*/i, '')
      .replace(/^we (?:decided|agreed)\s+(?:to\s+)?/i, '')
      .replace(/^agreed\s+(?:to\s+)?/i, '')
      .replace(/^decided\s+(?:to\s+)?/i, '')
      .replace(/\.$/, '');
  }

  function formatActionHeadline(action) {
    const task = normalizeWhitespace(action?.task).replace(/\.$/, '');
    if (!task) return '';

    const assignee = normalizeWhitespace(action?.assignee);
    const deadline = normalizeWhitespace(action?.deadline);
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

  function formatActionSummary(action) {
    const taskText = normalizeWhitespace(action?.task)
      .replace(/\.$/, '')
      .replace(/^(?:we|i|you)\s+/i, '')
      .replace(/^(?:need(?:s)? to|should|must|will|going to|plan to|plans to)\s+/i, '');
    if (!taskText) return '';

    const task = ensureTrailingPunctuation(`to ${lowercaseFirst(taskText)}`);
    const assignee = normalizeWhitespace(action?.assignee);
    if (assignee && assignee !== 'Unassigned') return `${assignee} committed ${task}`;
    return `A follow-up captured in the transcript was ${task}`;
  }

  function formatDecisionSummary(decision) {
    const title = cleanDecisionTitle(decision?.title);
    if (!title) return '';
    return `A recorded decision was ${ensureTrailingPunctuation(`to ${lowercaseFirst(title)}`)}`;
  }

  function extractRiskHighlights(lines, limit = 3) {
    const riskKeywords = /\b(risk|blocker|blocked|issue|issues|concern|concerns|delay|delayed|complaint|complaints|confusion|unclear|problem|problems|stuck|gap|gaps|dependency|dependencies)\b/i;
    const seen = new Set();
    const results = [];

    for (const line of Array.isArray(lines) ? lines : []) {
      const sentence = ensureTrailingPunctuation(line?.text);
      if (!sentence || !riskKeywords.test(sentence)) continue;
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
      .map(topic => normalizeWhitespace(topic))
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
      if (nextSteps.length < 3) nextSteps.push(headline);
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

  function extractActionItems(lines) {
    const actionKeywords = [
      /\bi['’]?ll\b/i, /\bi will\b/i, /\bwe['’]?ll\b/i, /\bwe will\b/i, /\byou['’]?ll\b/i, /\byou will\b/i,
      /\bgoing to\b/i, /\bneed to\b/i, /\bshould\b/i, /\bresponsible for\b/i, /\bhandle\b/i,
      /\bcoordinate\b/i, /\bprepare\b/i, /\bschedule\b/i, /\bcreate\b/i, /\bdocument\b/i,
      /\bset up\b/i, /\bkick off\b/i, /\bupdate\b/i
    ];
    const datePattern = /\b(?:by|on|before|until|end of|next|this)\s+[\w,\s]+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|quarter|april|may|june|january|february|march|\d{1,2}(?:st|nd|rd|th)?)/i;
    const priorityWords = { high: /critical|urgent|asap|immediately|priority|must/i, medium: /need|should|important/i };
    const seen = new Set();
    const actions = [];

    lines.forEach(line => {
      const text = normalizeWhitespace(line?.text);
      if (!text || !actionKeywords.some(kw => kw.test(text))) return;

      const dateMatch = text.match(datePattern);
      let priority = 'low';
      if (priorityWords.high.test(text)) priority = 'high';
      else if (priorityWords.medium.test(text)) priority = 'medium';

      let task = text;
      task = task.replace(/^\s*let['’]?s\s+/i, '');
      task = task.replace(/^\s*(?:i|we|you)\s+(?:need to|should|must)\s+/i, '');
      task = task.replace(/^\s*(?:i['’]?ll|i will|we['’]?ll|we will|you['’]?ll|you will)\s+/i, '');
      task = task.replace(/^\s*(?:need to|should|must)\s+/i, '');
      task = task.replace(/\.$/, '');
      task = normalizeWhitespace(task);
      if (!task) return;
      task = task.charAt(0).toUpperCase() + task.slice(1);

      const assignee = isPlaceholderSpeakerLabel(line?.speaker) ? 'Unassigned' : normalizeWhitespace(line?.speaker) || 'Unassigned';
      const dedupeKey = `${assignee.toLowerCase()}|${task.toLowerCase()}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      actions.push({
        assignee,
        task,
        deadline: dateMatch ? dateMatch[0].trim() : 'TBD',
        priority
      });
    });

    return actions.slice(0, 8);
  }

  function extractDecisions(lines) {
    const decisionKeywords = [
      /\bdecision(?:\s*:|\s+(?:is|was|has been)\b)/i,
      /\bdecided\b/i, /\bagreed\b/i, /\bgoing with\b/i,
      /\bwe['']re moving to\b/i, /\bwe['']ve chosen\b/i,
      /\bour approach\b/i, /\bprioritize\b/i,
      /\boverall.*direction\b/i, /\bnorth star\b/i
    ];

    const decisions = [];
    const seen = new Set();
    lines.forEach((line, idx) => {
      const text = normalizeWhitespace(line?.text);
      if (!text || !decisionKeywords.some(kw => kw.test(text))) return;

      const context = normalizeWhitespace(lines[idx - 1]?.text || lines[idx + 1]?.text || '');
      let title = cleanDecisionTitle(text);
      if (!title) return;
      if (title.length > 80) title = `${title.substring(0, 77)}...`;
      const canonical = title.toLowerCase();
      if (seen.has(canonical)) return;
      seen.add(canonical);

      decisions.push({
        title: title.charAt(0).toUpperCase() + title.slice(1),
        context,
        speaker: isPlaceholderSpeakerLabel(line?.speaker) ? 'Unknown' : normalizeWhitespace(line?.speaker) || 'Unknown'
      });
    });

    return decisions.slice(0, 6);
  }

  function extractSummary(lines, options = {}) {
    const speakers = getVisibleSpeakers(lines);
    const actions = extractActionItems(lines);
    const decisions = extractDecisions(lines);
    const topics = extractTopicPhrases(lines, 6);
    const evidence = collectSummaryEvidence(lines, 4);
    const coverage = buildChunkCoverage(lines);
    const wordCount = countWords(lines.map(l => l.text).join(' '));
    const speakerList = speakers.length === 0
      ? 'the team'
      : speakers.slice(0, 3).join(', ') + (speakers.length > 3 ? ` and ${speakers.length - 3} others` : '');
    const parts = [];
    const seen = new Set();
    const style = ['brief', 'detailed', 'executive'].includes(options?.summaryStyle) ? options.summaryStyle : 'executive';

    function pushPart(text) {
      const cleaned = normalizeWhitespace(text);
      if (!cleaned) return;
      const canonical = cleaned.toLowerCase();
      if (seen.has(canonical)) return;
      seen.add(canonical);
      parts.push(cleaned);
    }

    if (topics.length > 0) {
      if (speakers.length > 0) pushPart(`${speakerList} discussed ${humanJoin(topics.slice(0, style === 'brief' ? 2 : 3))}.`);
      else pushPart(`The transcript focused on ${humanJoin(topics.slice(0, 3))}.`);
    } else if (speakers.length > 0) {
      if (speakers.length === 1) pushPart(`${speakerList} outlined the main points of the meeting.`);
      else pushPart(`This meeting included ${speakerList}.`);
    }

    pushPart(formatDecisionSummary(decisions[0]));
    pushPart(formatActionSummary(actions[0]));

    const supportingEvidence = evidence.filter(sentence => {
      if (decisions[0]?.title && hasStrongWordOverlap(sentence, decisions[0].title)) return false;
      if (actions[0]?.task && hasStrongWordOverlap(sentence, actions[0].task)) return false;
      return true;
    });

    if (style === 'detailed') {
      coverage.forEach(pushPart);
    }

    if (parts.length < 2) supportingEvidence.slice(0, 2).forEach(pushPart);
    else if (parts.length < 3) supportingEvidence.slice(0, 1).forEach(pushPart);

    if (actions.length === 0 && decisions.length === 0) {
      pushPart('No explicit decisions or assigned next steps were clearly stated in the transcript.');
    }

    const maxSentences = style === 'brief' ? 2 : style === 'detailed' ? 5 : 3;
    const body = parts.slice(0, maxSentences).join(' ');
    const sections = buildSummarySections(lines, body, topics, actions, decisions);
    const confidence = computeLocalConfidence(lines, actions, decisions, speakers, sections);
    const duration = Math.max(1, Math.round(wordCount / 130));

    return {
      body: normalizeWhitespace(body),
      topics: topics.length > 0 ? topics : ['Meeting'],
      confidence,
      style,
      sections,
      speakers,
      wordCount,
      duration
    };
  }

  function computeScore(lines, actions, decisions) {
    const wordCount = countWords(lines.map(l => l.text).join(' '));
    const speakerCount = Math.max(1, getVisibleSpeakers(lines).length);
    const actionScore = Math.min(100, actions.length * 14);
    const decisionScore = Math.min(100, decisions.length * 18);
    const engageScore = Math.min(100, speakerCount * 22);
    const lengthScore = wordCount > 120 ? Math.min(100, wordCount / 8) : 40;
    const overall = Math.round((actionScore * 0.3 + decisionScore * 0.3 + engageScore * 0.2 + lengthScore * 0.2));
    return { overall: Math.min(98, overall), actionScore, decisionScore, engageScore, lengthScore };
  }

  function buildParticipants(lines) {
    const map = {};
    const totalWords = Math.max(1, countWords(lines.map(l => l.text).join(' ')));
    lines.forEach(l => {
      if (isPlaceholderSpeakerLabel(l.speaker)) return;
      if (!map[l.speaker]) map[l.speaker] = { turns: 0, words: 0, texts: [] };
      const wc = countWords(l.text);
      map[l.speaker].turns++;
      map[l.speaker].words += wc;
      map[l.speaker].texts.push(l.text);
    });
    return Object.entries(map).map(([name, d]) => ({
      name,
      turns: d.turns,
      words: d.words,
      talkPct: Math.max(1, Math.round(d.words / totalWords * 100)),
      sentiment: analyseSentiment(d.texts.join(' '))
    }));
  }

  function process(lines, options = {}) {
    const actions = extractActionItems(lines);
    const decisions = extractDecisions(lines);
    const summary = extractSummary(lines, options);
    const score = computeScore(lines, actions, decisions);
    const participants = buildParticipants(lines);
    return { summary, actions, decisions, lines, score, participants };
  }

  return { process };
})();

// ===== SESSION STORE =====
const SessionStore = (() => {
  const KEY = 'meetmind_sessions';

  function getAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }

  function save(session) {
    const sessions = getAll();
    sessions.unshift(session);
    if (sessions.length > 20) sessions.pop();
    localStorage.setItem(KEY, JSON.stringify(sessions));
    renderHistory();
  }

  function remove(index) {
    const sessions = getAll();
    if (index < 0 || index >= sessions.length) return;
    sessions.splice(index, 1);
    localStorage.setItem(KEY, JSON.stringify(sessions));
    renderHistory();
  }

  function clear() {
    localStorage.removeItem(KEY);
    renderHistory();
  }

  function renderHistory() {
    const list = document.getElementById('history-list');
    const sessions = getAll();
    const query = document.getElementById('history-search').value.toLowerCase();
    const filtered = sessions
      .map((session, index) => ({ ...session, session, index }))
      .filter(({ session }) =>
        session.title.toLowerCase().includes(query) ||
        session.summary?.toLowerCase().includes(query)
      );

    if (filtered.length === 0) {
      list.innerHTML = `<div class="history-empty">
        <div class="empty-icon">📋</div>
        <p>${sessions.length === 0 ? 'No meetings yet.<br/>Start a recording or upload a file.' : 'No results found.'}</p>
      </div>`;
      return;
    }

    list.innerHTML = filtered.map((s, i) => `
      <div class="history-item" data-idx="${i}">
        <div class="history-item-title">${escapeHtml(s.title)}</div>
        <div class="history-item-meta">${s.date} · ${s.duration}min · ${s.actions} actions</div>
      </div>
    `).join('');

    list.querySelectorAll('.history-item').forEach((el, i) => {
      const { session, index } = filtered[i];
      el.dataset.idx = String(index);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'history-delete-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.setAttribute('aria-label', `Delete ${session.title}`);
      deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (confirm(`Delete "${session.title}" from meeting history?`)) {
          remove(index);
          showToast(`Deleted "${session.title}"`, 'info', 2600);
        }
      });
      el.appendChild(deleteBtn);

      el.addEventListener('click', () => loadSession(session));
    });
  }

  function loadSession(session) {
    const data = applySummaryPreferences(session.data, getLocalProcessingPreferences());
    UI.displayResults(data);
    ExportEngine.setData(data);
    QAEngine.init(data);
    sidebar.classList.remove('open');
    document.getElementById('input-section').classList.add('hidden');
    document.getElementById('pipeline-section').classList.add('hidden');
    document.getElementById('results-section').classList.remove('hidden');
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
  }

  document.getElementById('history-search').addEventListener('input', renderHistory);
  document.getElementById('clear-history-btn').addEventListener('click', () => {
    if (confirm('Clear all meeting history?')) clear();
  });

  renderHistory();
  return { save, getAll, remove, renderHistory };
})();

// ===== EXPORT ENGINE =====
const ExportEngine = (() => {
  let currentData = null;

  function setData(data) { currentData = data; }

  function buildText(data) {
    const { lines, summary, importantPoints, actions, decisions } = data;
    const showSpeakers = hasRealSpeakerNames(lines);
    const participantText = summary.speakers.length > 0 ? summary.speakers.join(', ') : 'Not identified';
    let out = `MEETING TRANSCRIPT\n${'='.repeat(50)}\n\n`;
    out += `Date: ${new Date().toLocaleDateString()}\n`;
    out += `Duration: ~${summary.duration} minutes\n`;
    out += `Participants: ${participantText}\n\n`;

    out += `TRANSCRIPT\n${'-'.repeat(40)}\n`;
    lines.forEach(l => { out += `${formatSpeakerAwareLine(l, showSpeakers)}\n\n`; });

    out += `\nSUMMARY\n${'-'.repeat(40)}\n${buildSummaryText(summary)}\n\n`;

    out += `\nIMPORTANT POINTS\n${'-'.repeat(40)}\n${buildImportantPointsText(importantPoints)}\n\n`;

    out += `\nACTION ITEMS\n${'-'.repeat(40)}\n`;
    actions.forEach((a, i) => {
      out += `${i + 1}. [${a.assignee}] ${a.task} (Due: ${a.deadline}, Priority: ${a.priority})\n`;
    });

    out += `\nKEY DECISIONS\n${'-'.repeat(40)}\n`;
    decisions.forEach((d, i) => { out += `${i + 1}. ${d.title}\n`; });

    return out;
  }

  function downloadBlob(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function buildDocumentHTML(data) {
    const { lines, summary, importantPoints, actions, decisions } = data;
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const showSpeakers = hasRealSpeakerNames(lines);
    const participantText = summary.speakers.length > 0 ? summary.speakers.join(', ') : 'Not identified';
    
    return `
      <div id="export-doc-wrapper" style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px; background: #fff;">
        <h1 style="color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 15px; margin-bottom: 20px;">Meeting Intelligence Report</h1>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 30px;">
          <p style="margin: 0 0 8px 0;"><strong>📅 Date:</strong> ${dateStr}</p>
          <p style="margin: 0 0 8px 0;"><strong>⏱️ Duration:</strong> ~${summary.duration || 1} minutes</p>
          <p style="margin: 0;"><strong>👥 Participants:</strong> ${participantText}</p>
        </div>
        
        <h2 style="color: #0f172a; margin-top: 30px; font-size: 1.4rem;">Executive Summary</h2>
        <p style="font-size: 1rem; color: #334155; white-space: pre-line;">${escapeHtml(buildSummaryText(summary))}</p>

        <h2 style="color: #0f172a; margin-top: 30px; font-size: 1.4rem;">Important Points</h2>
        ${normalizeImportantPoints(importantPoints).length > 0 ? `
        <ul style="padding-left: 20px; color: #334155;">
          ${normalizeImportantPoints(importantPoints).map(point => `<li style="margin-bottom: 12px;"><strong>${escapeHtml(point.title)}</strong><br/><span style="color: #64748b; font-size: 0.9em;">${escapeHtml(point.detail || formatImportantPointType(point.type))}</span></li>`).join('')}
        </ul>` : '<p style="color: #64748b; font-style: italic;">No important points detected.</p>'}
        
        <h2 style="color: #0f172a; margin-top: 30px; font-size: 1.4rem;">Key Decisions</h2>
        ${decisions.length > 0 ? `
        <ul style="padding-left: 20px; color: #334155;">
          ${decisions.map(d => `<li style="margin-bottom: 12px;"><strong>${escapeHtml(d.title)}</strong><br/><span style="color: #64748b; font-size: 0.9em;">Context: ${escapeHtml(d.context || '')}</span></li>`).join('')}
        </ul>` : '<p style="color: #64748b; font-style: italic;">No specific decisions recorded.</p>'}
        
        <h2 style="color: #0f172a; margin-top: 30px; font-size: 1.4rem;">Action Items</h2>
        ${actions.length > 0 ? `
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f1f5f9; text-align: left;">
              <th style="padding: 12px; border: 1px solid #e2e8f0; color: #0f172a;">Task</th>
              <th style="padding: 12px; border: 1px solid #e2e8f0; color: #0f172a;">Assignee</th>
              <th style="padding: 12px; border: 1px solid #e2e8f0; color: #0f172a;">Deadline</th>
              <th style="padding: 12px; border: 1px solid #e2e8f0; color: #0f172a;">Priority</th>
            </tr>
          </thead>
          <tbody>
            ${actions.map(a => `
              <tr>
                <td style="padding: 12px; border: 1px solid #e2e8f0; color: #334155;">${escapeHtml(a.task)}</td>
                <td style="padding: 12px; border: 1px solid #e2e8f0; color: #334155; font-weight: 600;">${escapeHtml(a.assignee)}</td>
                <td style="padding: 12px; border: 1px solid #e2e8f0; color: #ef4444; font-weight: 600;">${escapeHtml(a.deadline)}</td>
                <td style="padding: 12px; border: 1px solid #e2e8f0; color: #334155;">${escapeHtml(a.priority.toUpperCase())}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<p style="color: #64748b; font-style: italic;">No action items recorded.</p>'}

        <div style="page-break-before: always;"></div>

        <h2 style="color: #0f172a; margin-top: 40px; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; font-size: 1.4rem;">Full Transcript</h2>
        <div style="font-size: 0.95em; color: #334155; margin-top: 20px;">
          ${lines.map(l => showSpeakers
            ? `<p style="margin-bottom: 12px; line-height: 1.6;"><strong>${escapeHtml(l.speaker)}:</strong> ${escapeHtml(l.text)}</p>`
            : `<p style="margin-bottom: 12px; line-height: 1.6;">${escapeHtml(l.text)}</p>`).join('')}
        </div>
      </div>
    `;
  }

  function downloadDoc(htmlContent, filename) {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>MeetMind Report</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + htmlContent + footer;
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = filename;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  }

  document.getElementById('export-pdf-btn').addEventListener('click', () => {
    if (!currentData) return;
    if (typeof html2pdf === 'undefined') {
      showToast('PDF generator library loading... try again.', 'error');
      return;
    }
    showToast('Generating PDF... Please wait.', 'info', 4000);
    const htmlString = buildDocumentHTML(currentData);
    const container = document.createElement('div');
    container.innerHTML = htmlString;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    const opt = {
      margin:       0.5,
      filename:     'MeetMind-Report.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(container.firstElementChild).save().then(() => {
      document.body.removeChild(container);
      showToast('PDF Exported Successfully!', 'success');
    }).catch(err => {
      console.error(err);
      document.body.removeChild(container);
      showToast('Error generating PDF.', 'error');
    });
  });

  document.getElementById('export-doc-btn').addEventListener('click', () => {
    if (!currentData) return;
    showToast('Generating Document... Please wait.', 'info', 2000);
    const htmlContent = buildDocumentHTML(currentData);
    downloadDoc(htmlContent, 'MeetMind-Report.doc');
  });

  document.getElementById('copy-all-btn').addEventListener('click', () => {
    if (!currentData) return;
    navigator.clipboard.writeText(buildText(currentData)).then(() => {
      showToast('Copied to clipboard!', 'success');
    });
  });

  document.getElementById('copy-transcript-btn').addEventListener('click', () => {
    if (!currentData) return;
    const showSpeakers = hasRealSpeakerNames(currentData.lines);
    const text = currentData.lines.map(l => formatSpeakerAwareLine(l, showSpeakers)).join('\n\n');
    navigator.clipboard.writeText(text).then(() => showToast('Transcript copied', 'success'));
  });

  document.getElementById('copy-summary-btn').addEventListener('click', () => {
    if (!currentData) return;
    navigator.clipboard.writeText(buildSummaryText(currentData.summary)).then(() => showToast('Summary copied', 'success'));
  });

  document.getElementById('copy-important-btn').addEventListener('click', () => {
    if (!currentData) return;
    navigator.clipboard.writeText(buildImportantPointsText(currentData.importantPoints)).then(() => showToast('Important points copied', 'success'));
  });

  document.getElementById('copy-actions-btn').addEventListener('click', () => {
    if (!currentData) return;
    const text = currentData.actions.map((a,i) => `${i+1}. [${a.assignee}] ${a.task} (${a.deadline})`).join('\n');
    navigator.clipboard.writeText(text).then(() => showToast('Action items copied', 'success'));
  });

  document.getElementById('copy-decisions-btn').addEventListener('click', () => {
    if (!currentData) return;
    const text = currentData.decisions.map((d,i) => `${i+1}. ${d.title}`).join('\n');
    navigator.clipboard.writeText(text).then(() => showToast('Decisions copied', 'success'));
  });

  document.getElementById('copy-participants-btn').addEventListener('click', () => {
    if (!currentData || !currentData.participants) return;
    if (currentData.participants.length === 0) {
      navigator.clipboard.writeText('No identified participants.').then(() => showToast('Participants data copied', 'success'));
      return;
    }
    const text = currentData.participants.map(p =>
      `${p.name}: ${p.turns} turns, ${p.words} words, ${p.talkPct}% talk time, Sentiment: ${p.sentiment}`
    ).join('\n');
    navigator.clipboard.writeText(text).then(() => showToast('Participants data copied', 'success'));
  });

  return { setData };
})();

// ===== PIPELINE =====
function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function isPlaceholderSpeakerLabel(value) {
  return /^speaker(?:[\s_-]+)\d+$/i.test(String(value || '').trim());
}

function hasRealSpeakerNames(lines) {
  return (Array.isArray(lines) ? lines : []).some(line => {
    const speaker = String(line?.speaker || '').trim();
    return speaker && !isPlaceholderSpeakerLabel(speaker);
  });
}

function formatSpeakerAwareLine(line, showSpeakers) {
  const text = String(line?.text || '').trim();
  const speaker = String(line?.speaker || '').trim();
  if (!showSpeakers || !speaker) return text;
  return `${speaker}: ${text}`;
}

function normalizeSummaryItems(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => String(item || '').trim())
    .filter(Boolean);
}

function getEffectiveSummaryStyle(summary) {
  const style = String(summary?.style || '').trim().toLowerCase();
  return ['brief', 'detailed', 'executive'].includes(style) ? style : 'executive';
}

function computeSummaryConfidence(data) {
  const lines = Array.isArray(data?.lines) ? data.lines : [];
  const summary = data?.summary || {};
  const sections = summary?.sections || {};
  const wordCount = Number(summary?.wordCount) || lines.map(line => String(line?.text || '')).join(' ').split(/\s+/).filter(Boolean).length;
  const actions = Array.isArray(data?.actions) ? data.actions : [];
  const decisions = Array.isArray(data?.decisions) ? data.decisions : [];
  const namedSpeakers = Array.isArray(summary?.speakers) ? summary.speakers.length : 0;
  let score = 0;

  if (wordCount >= 180) score += 3;
  else if (wordCount >= 90) score += 2;
  else if (wordCount >= 40) score += 1;

  if (actions.length > 0) score += 2;
  if (decisions.length > 0) score += 2;
  if (namedSpeakers > 1) score += 2;
  else if (namedSpeakers === 1) score += 1;
  if (normalizeSummaryItems(sections.risks).length > 0) score += 1;
  if (normalizeSummaryItems(sections.outcomes).length > 0) score += 1;

  const speakerNote = namedSpeakers === 0
    ? 'Speaker attribution may be incomplete because the transcript did not include named speakers.'
    : '';
  const coverageNote = wordCount < 60
    ? 'This was a short transcript, so the summary is based on limited evidence.'
    : '';
  const notes = [speakerNote, coverageNote].filter(Boolean);

  if (score >= 8) {
    return { level: 'high', label: 'High confidence', note: notes[0] || 'This summary is based on multiple grounded signals across the transcript.' };
  }
  if (score >= 4) {
    return { level: 'medium', label: 'Medium confidence', note: notes[0] || 'Some sections are inferred from partial evidence, so wording stays cautious.' };
  }
  return { level: 'low', label: 'Low confidence', note: notes[0] || notes[1] || 'The transcript had limited structure, so this summary should be treated as directional.' };
}

function getStyledSummaryLead(summary) {
  const style = getEffectiveSummaryStyle(summary);
  const sections = summary?.sections || {};
  const outcomes = normalizeSummaryItems(sections.outcomes);
  const risks = normalizeSummaryItems(sections.risks);
  const nextSteps = normalizeSummaryItems(sections.nextSteps);
  const overview = String(summary?.body || '').trim();
  const sentences = overview.split(/(?<=[.!?])\s+/).filter(Boolean);
  const leadSentences = [];

  if (style === 'brief') {
    if (sentences[0]) leadSentences.push(sentences[0]);
    if (!sentences[0] && overview) leadSentences.push(overview);
    if (outcomes[0]) leadSentences.push(`Main outcome: ${outcomes[0]}.`);
    return leadSentences.join(' ');
  }

  if (style === 'detailed') {
    if (overview) leadSentences.push(overview);
    if (outcomes[0]) leadSentences.push(`Key outcome: ${outcomes[0]}.`);
    if (risks[0]) leadSentences.push(`Risk noted: ${risks[0]}`);
    else if (nextSteps[0]) leadSentences.push(`Next step: ${nextSteps[0]}.`);
    return leadSentences.join(' ');
  }

  if (sentences[0]) leadSentences.push(sentences[0]);
  else if (overview) leadSentences.push(overview);
  if (outcomes[0]) leadSentences.push(`Outcome: ${outcomes[0]}.`);
  if (risks[0]) leadSentences.push(`Risk: ${risks[0]}`);
  return leadSentences.join(' ');
}

function normalizeImportantPoints(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => {
      if (typeof item === 'string') {
        return { type: 'discussion', title: item.trim(), detail: '' };
      }
      return {
        type: String(item?.type || 'discussion').trim().toLowerCase(),
        title: String(item?.title || '').trim(),
        detail: String(item?.detail || '').trim()
      };
    })
    .filter(item => item.title);
}

function buildImportantPoints(data) {
  const summarySections = data?.summary?.sections || {};
  const points = [];
  const seen = new Set();

  function pushPoint(type, title, detail = '') {
    const cleanTitle = String(title || '').trim().replace(/\.$/, '');
    const cleanDetail = String(detail || '').trim();
    if (!cleanTitle) return;
    const canonical = `${type}|${cleanTitle}`.toLowerCase();
    if (seen.has(canonical)) return;
    seen.add(canonical);
    points.push({ type, title: cleanTitle, detail: cleanDetail });
  }

  (Array.isArray(data?.decisions) ? data.decisions : []).forEach(decision => {
    pushPoint('decision', decision?.title, decision?.context || `Identified from ${decision?.speaker || 'the transcript'}.`);
  });

  normalizeSummaryItems(summarySections.risks).forEach(risk => {
    pushPoint('risk', risk, 'Flagged as a risk or blocker in the transcript.');
  });

  (Array.isArray(data?.actions) ? data.actions : []).forEach(action => {
    const headline = `${action?.assignee && action.assignee !== 'Unassigned' ? `${action.assignee} to ` : ''}${String(action?.task || '').trim()}`.trim();
    const detail = action?.deadline && action.deadline !== 'TBD'
      ? `Follow-up item due ${action.deadline}.`
      : `Follow-up item with ${String(action?.priority || 'medium').toUpperCase()} priority.`;
    pushPoint('action', headline, detail);
  });

  normalizeSummaryItems(summarySections.outcomes).forEach(outcome => {
    pushPoint('outcome', outcome, 'Derived from the strongest meeting outcomes.');
  });

  const transcriptLines = Array.isArray(data?.lines) ? data.lines : [];
  transcriptLines.slice(0, 8).forEach(line => {
    const text = String(line?.text || '').trim();
    if (/(\bdecision\b|\bdecided\b|\bagreed\b|\bblocker\b|\brisk\b|\bissue\b|\bneed to\b|\bwill\b)/i.test(text)) {
      pushPoint('discussion', text, line?.speaker && !isPlaceholderSpeakerLabel(line.speaker) ? `Raised by ${line.speaker}.` : 'High-signal discussion point.');
    }
  });

  return points.slice(0, 6);
}

function buildImportantPointsText(points) {
  const normalized = normalizeImportantPoints(points);
  if (normalized.length === 0) return 'No important points detected.';
  return normalized
    .map((point, index) => `${index + 1}. ${point.title}${point.detail ? ` - ${point.detail}` : ''}`)
    .join('\n');
}

function formatImportantPointType(type) {
  const normalized = String(type || 'discussion').trim().toLowerCase();
  if (normalized === 'decision') return 'Decision';
  if (normalized === 'action') return 'Action';
  if (normalized === 'risk') return 'Risk';
  if (normalized === 'outcome') return 'Outcome';
  return 'Discussion';
}

function applySummaryPreferences(data, preferences = {}) {
  if (!data?.summary) return data;
  const summary = data.summary;
  summary.style = ['brief', 'detailed', 'executive'].includes(preferences.summaryStyle) ? preferences.summaryStyle : (summary.style || 'executive');
  if (!summary.confidence) {
    summary.confidence = computeSummaryConfidence(data);
  }
  data.importantPoints = normalizeImportantPoints(data.importantPoints);
  if (data.importantPoints.length === 0) {
    data.importantPoints = buildImportantPoints(data);
  }
  return data;
}

function getSummarySections(summary) {
  const sections = summary?.sections || {};
  const definitions = [
    { key: 'themes', title: 'Key Themes', kind: 'chips' },
    { key: 'outcomes', title: 'Outcomes', kind: 'list' },
    { key: 'risks', title: 'Risks & Blockers', kind: 'list' },
    { key: 'nextSteps', title: 'Next Steps', kind: 'list' }
  ];

  return definitions
    .map(definition => ({
      ...definition,
      items: normalizeSummaryItems(sections?.[definition.key])
    }))
    .filter(section => section.items.length > 0);
}

function buildSummaryText(summary) {
  if (!summary) return '';
  const sections = getSummarySections(summary);
  const chunks = [];
  const confidence = summary?.confidence;

  const lead = getStyledSummaryLead(summary);
  if (lead) chunks.push(lead);
  if (confidence?.label && confidence?.note) {
    chunks.push(`Confidence: ${confidence.label}. ${confidence.note}`);
  }
  sections.forEach(section => {
    chunks.push(`${section.title}: ${section.items.join('; ')}`);
  });

  return chunks.filter(Boolean).join('\n\n');
}

function buildSummarySectionsHtml(summary) {
  const sections = getSummarySections(summary);
  const confidence = summary?.confidence;
  if (sections.length === 0 && !confidence?.label) return '';

  return `
    <div class="summary-grid">
      ${confidence?.label ? `
        <section class="summary-card summary-card-confidence confidence-${String(confidence.level || 'medium')}">
          <div class="summary-card-title">Summary Confidence</div>
          <div class="summary-confidence-badge">${escapeHtml(confidence.label)}</div>
          <p class="summary-confidence-note">${escapeHtml(confidence.note || '')}</p>
        </section>
      ` : ''}
      ${sections.map(section => `
        <section class="summary-card summary-card-${section.kind}">
          <div class="summary-card-title">${escapeHtml(section.title)}</div>
          ${section.kind === 'chips'
            ? `<div class="summary-chip-row">${section.items.map(item => `<span class="topic-chip">${escapeHtml(item)}</span>`).join('')}</div>`
            : `<ul class="summary-list">${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`}
        </section>
      `).join('')}
    </div>
  `;
}

function shortenProcessingWarning(message) {
  const text = String(message || '');
  const lower = text.toLowerCase();

  if (lower.includes('pyannote diarization failed')) {
    return 'Speaker separation is unavailable on this system, so MeetMind used single-speaker fallback.';
  }
  if (lower.includes('speaker diarization was not available for this file')) {
    return 'Speaker separation was unavailable, so the transcript was labeled as one speaker.';
  }
  if (lower.includes('openai analysis was unavailable')) {
    return 'OpenAI analysis was unavailable, so MeetMind used local analysis.';
  }
  if (lower.includes('openai transcription was unavailable')) {
    return 'OpenAI transcription was unavailable, so MeetMind kept using local processing.';
  }
  if (lower.includes('hugging face token not provided')) {
    return 'Speaker separation is off because the Hugging Face token is missing.';
  }

  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function getBrowserFallbackLines(job) {
  const transcriptText = String(job?.text || job?.liveTranscript || '').trim();
  if (!transcriptText) return null;

  const lines = parsePastedText(transcriptText);
  return lines.length > 0 ? lines : null;
}

async function runPipeline(lines, options = {}) {
  const pipelineSection = document.getElementById('pipeline-section');
  const inputSection = document.getElementById('input-section');
  const resultsSection = document.getElementById('results-section');

  inputSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  pipelineSection.classList.remove('hidden');
  pipelineSection.scrollIntoView({ behavior: 'smooth' });
  setStatus('Processing…', 'processing');

  const steps = ['transcribe', 'analyze', 'generate'];
  const progressBar = document.getElementById('progress-bar');
  const logEl = document.getElementById('pipeline-log');
  const localPreferences = options.localPreferences || {};
  const qualityLabel = localPreferences.localQuality === 'quality'
    ? 'higher-quality'
    : localPreferences.localQuality === 'speed'
    ? 'fast'
    : 'balanced';

  function log(msg) {
    logEl.innerHTML = `<span class="log-line">&gt; ${msg}</span>`;
  }

  async function activateStep(stepId, logMsg, duration) {
    const step = document.getElementById(`step-${stepId}`);
    step.classList.add('active');
    step.querySelector('.step-status').textContent = 'In progress…';
    log(logMsg);
    await delay(duration);
    step.classList.remove('active');
    step.classList.add('done');
    step.querySelector('.step-status').textContent = 'Complete ✓';
  }

  // Step 1 — Transcribe
  progressBar.style.width = '10%';
  log(`Initializing ${qualityLabel} local processing…`);
  await delay(600);
  progressBar.style.width = '30%';
  await activateStep('transcribe', 'Segmenting the transcript and preparing speaker-aware context…', 1400);

  // Step 2 — Analyze
  progressBar.style.width = '40%';
  await delay(200);
  progressBar.style.width = '65%';
  await activateStep('analyze', 'Parsing semantic structure, identifying topics and participants…', 1200);

  // Step 3 — Generate
  progressBar.style.width = '70%';
  await delay(200);
  progressBar.style.width = '85%';
  await activateStep('generate', options.generateLog || 'Generating a local meeting brief: summary, actions, decisions…', 1600);

  progressBar.style.width = '100%';
  log('Processing complete! Rendering insights…');
  await delay(500);

  // Process and display
  const results = applySummaryPreferences(
    LocalSummaryEngine.process(lines, options.localPreferences || {}),
    options.localPreferences || {}
  );
  progressBar.style.width = '0%';
  pipelineSection.classList.add('hidden');

  UI.displayResults(results);
  ExportEngine.setData(results);
  QAEngine.init(results);

  // Save to history
  const meetingTitle = getMeetingTitle() || `Meeting — ${new Date().toLocaleDateString()}`;
  SessionStore.save({
    title: meetingTitle,
    date: new Date().toLocaleDateString(),
    duration: results.summary.duration || 1,
    actions: results.actions.length,
    summary: buildSummaryText(results.summary),
    data: results
  });

  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth' });
  setStatus('Analysis complete', 'idle');
  showToast(options.completionToast || 'Meeting analysis complete!', 'success');
}

const BrowserWhisper = (() => {
  const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1';
  const FFMPEG_CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
  const FFMPEG_UTIL_CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js';
  const FFMPEG_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
  const MODEL_BY_QUALITY = {
    speed: 'Xenova/whisper-tiny.en',
    balanced: 'Xenova/whisper-base.en',
    quality: 'Xenova/whisper-base.en'
  };

  let ffmpeg = null;
  let ffmpegUtils = null;
  let whisperFactory = null;
  const whisperPipelines = new Map();

  async function loadFfmpeg() {
    if (ffmpeg && ffmpegUtils) return { ffmpeg, ffmpegUtils };

    const [{ FFmpeg }, ffmpegUtilModule] = await Promise.all([
      import(FFMPEG_CDN),
      import(FFMPEG_UTIL_CDN)
    ]);

    ffmpeg = new FFmpeg();
    ffmpegUtils = ffmpegUtilModule;

    await ffmpeg.load({
      coreURL: await ffmpegUtils.toBlobURL(`${FFMPEG_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await ffmpegUtils.toBlobURL(`${FFMPEG_BASE}/ffmpeg-core.wasm`, 'application/wasm')
    });

    return { ffmpeg, ffmpegUtils };
  }

  async function loadWhisper(modelName) {
    if (!whisperFactory) {
      whisperFactory = import(TRANSFORMERS_CDN).then(module => module.pipeline);
    }

    if (whisperPipelines.has(modelName)) return whisperPipelines.get(modelName);

    const pipeline = await whisperFactory;
    const instance = await pipeline('automatic-speech-recognition', modelName, {
      dtype: 'q8'
    });
    whisperPipelines.set(modelName, instance);
    return instance;
  }

  function resolveWhisperPreset(preferences = {}) {
    const quality = ['speed', 'balanced', 'quality'].includes(preferences?.localQuality)
      ? preferences.localQuality
      : 'balanced';
    if (quality === 'speed') {
      return { quality, modelName: MODEL_BY_QUALITY.speed, chunkLength: 24, stride: 4 };
    }
    if (quality === 'quality') {
      return { quality, modelName: MODEL_BY_QUALITY.quality, chunkLength: 18, stride: 6 };
    }
    return { quality, modelName: MODEL_BY_QUALITY.balanced, chunkLength: 22, stride: 5 };
  }

  function getExtension(name, fallback) {
    const match = String(name || '').toLowerCase().match(/(\.[a-z0-9]+)$/i);
    return match ? match[1] : fallback;
  }

  async function convertToWav(file) {
    const { ffmpeg, ffmpegUtils } = await loadFfmpeg();
    const inputExtension = getExtension(file?.name, file?.type.startsWith('video/') ? '.mp4' : '.webm');
    const inputName = `input${inputExtension}`;
    const outputName = 'output.wav';

    try {
      await ffmpeg.writeFile(inputName, await ffmpegUtils.fetchFile(file));
      await ffmpeg.exec(['-i', inputName, '-vn', '-ac', '1', '-ar', '16000', outputName]);
      const wavData = await ffmpeg.readFile(outputName);
      return new Blob([wavData.buffer], { type: 'audio/wav' });
    } finally {
      try { await ffmpeg.deleteFile(inputName); } catch (error) {}
      try { await ffmpeg.deleteFile(outputName); } catch (error) {}
    }
  }

  async function decodeAudioBlob(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContextCtor({ sampleRate: 16000 });

    try {
      if (typeof audioCtx.resume === 'function' && audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      const channel = audioBuffer.getChannelData(0);
      const waveform = new Float32Array(channel.length);
      waveform.set(channel);
      return waveform;
    } finally {
      await audioCtx.close();
    }
  }

  function buildLines(output) {
    const chunks = Array.isArray(output?.chunks)
      ? output.chunks.map(chunk => String(chunk?.text || '').trim()).filter(Boolean)
      : [];

    if (chunks.length > 0) {
      return chunks
        .flatMap(text => text.split(/(?<=[.!?])\s+/).map(sentence => sentence.trim()).filter(Boolean))
        .map(text => ({ speaker: 'Speaker 1', text }));
    }

    const fallbackLines = parsePastedText(String(output?.text || '').trim());
    return fallbackLines.length > 0 ? fallbackLines : [{ speaker: 'Speaker 1', text: String(output?.text || '').trim() }];
  }

  async function transcribeFile(file, preferences = {}) {
    if (!(file instanceof File)) {
      throw new Error('No local file was selected for Whisper transcription.');
    }

    const preset = resolveWhisperPreset(preferences);
    const modelLabel = preset.quality === 'speed' ? 'fast' : preset.quality === 'quality' ? 'higher-quality' : 'balanced';
    showToast(`Loading ${modelLabel} local Whisper in the browser. First run may take a minute.`, 'info', 7000);
    const wavBlob = await convertToWav(file);
    const waveform = await decodeAudioBlob(wavBlob);
    const transcriber = await loadWhisper(preset.modelName);
    const output = await transcriber(waveform, {
      chunk_length_s: preset.chunkLength,
      stride_length_s: preset.stride,
      return_timestamps: true
    });

    return {
      text: String(output?.text || '').trim(),
      lines: buildLines(output)
    };
  }

  return { transcribeFile };
})();

async function runBrowserWhisperFilePipeline(job) {
  const file = job?.file;
  const localPreferences = job?.localPreferences || getLocalProcessingPreferences();
  if (!(file instanceof File)) {
    throw new Error('A local audio or video file is required for browser Whisper.');
  }

  setStatus('Local Whisper...', 'processing');
  showToast('Preparing your file for local Whisper transcription...', 'info', 5000);
  const output = await BrowserWhisper.transcribeFile(file, localPreferences);
  if (!output.text || !Array.isArray(output.lines) || output.lines.length === 0) {
    throw new Error('Local Whisper could not extract a usable transcript from this file.');
  }

  showToast('Local Whisper transcription finished. Generating insights...', 'info', 4000);
  return runPipeline(output.lines, {
    localPreferences,
    generateLog: 'Compressing the transcript into a browser-side meeting brief…',
    completionToast: 'Meeting analysis complete using local Whisper!'
  });
}

const ProcessingAPI = (() => {
  function helpMessage() {
    if (location.protocol === 'file:') {
      return 'Open this app through the local server. Run `node server.js` and visit http://localhost:3000.';
    }
    return 'Could not reach the local processing server. Start it with `node server.js`, then run `npm run doctor` if setup still looks wrong.';
  }

  function extractError(payload, fallback) {
    if (payload && typeof payload === 'object' && payload.error) return payload.error;
    return fallback;
  }

  async function request(job) {
    let response;
    try {
      if (job.file) {
        const form = new FormData();
        form.append('source', job.source || 'upload');
        form.append('title', job.title || '');
        form.append('liveTranscript', job.liveTranscript || '');
        form.append('file', job.file, job.file.name || 'meeting.webm');
        response = await fetch('/api/process', { method: 'POST', body: form });
      } else {
        response = await fetch('/api/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: job.source || 'paste',
            title: job.title || '',
            liveTranscript: job.liveTranscript || '',
            text: job.text || ''
          })
        });
      }
    } catch (error) {
      throw new Error(helpMessage());
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(extractError(payload, 'Processing failed on the local server.'));
    }
    if (!payload?.data?.summary || !Array.isArray(payload?.data?.lines)) {
      throw new Error('The processing server returned an unexpected response.');
    }

    return payload;
  }

  return { helpMessage, request };
})();

(function initProcessingHealth() {
  if (location.protocol === 'file:') {
    setStatus('Server required', 'error');
    showLaunchBanner({
      type: 'error',
      title: 'Do not open index.html directly',
      message: 'This app now needs the local server. Double-click "start-meetmind.bat", then use http://localhost:3000 in your browser.'
    });
    return;
  }

  fetch('/api/health')
    .then(response => response.json())
    .then(payload => {
      const local = payload?.capabilities?.local || {};
      const openai = payload?.capabilities?.openai || {};
      const diarization = local?.diarization || {};
      const localIssues = Array.isArray(local.issues) ? local.issues.filter(Boolean) : [];
      const localWarnings = Array.isArray(local.warnings) ? local.warnings.filter(Boolean) : [];
      const mode = payload?.mode || 'unconfigured';
      const localReady = Boolean(local.ready);
      const cloudReady = Boolean(openai.configured);

      if (cloudReady) {
        setRecordChip(
          recordSpeakerChip,
          'Speaker split: OpenAI is preferred, with local fallback if needed',
          'good'
        );
      } else if (localReady && diarization.ready) {
        setRecordChip(
          recordSpeakerChip,
          'Speaker split: local diarization is ready on this system',
          'good'
        );
      } else if (localReady) {
        setRecordChip(
          recordSpeakerChip,
          'Speaker split: local transcription is ready, but some files may still collapse to one speaker',
          'info'
        );
      } else {
        setRecordChip(
          recordSpeakerChip,
          'Speaker split: browser fallback only until local or cloud processing is configured',
          'error'
        );
      }

      if (!payload?.configured) {
        setStatus('Setup required', 'error');
        showLaunchBanner({
          type: 'error',
          title: 'Processing stack is not ready yet',
          message: 'MeetMind could not find a working cloud or local transcription path on this machine. Run `npm run doctor` to see the missing setup, then update `.env` or install the local Python stack.',
          notes: localIssues.slice(0, 3)
        });
        return;
      }

      if (mode === 'hybrid') {
        setStatus('Hybrid mode ready', 'idle');
        if (localWarnings.length > 0) {
          showLaunchBanner({
            type: 'info',
            title: 'Hybrid processing is ready',
            message: 'MeetMind can use OpenAI first and keep local fallback available on this machine.',
            notes: localWarnings.slice(0, 3)
          });
        } else {
          clearLaunchBanner();
        }
        return;
      }

      if (mode === 'cloud') {
        setStatus('Cloud mode ready', 'idle');
        if (localIssues.length > 0 || localWarnings.length > 0) {
          showLaunchBanner({
            type: 'info',
            title: 'Cloud processing is ready',
            message: 'OpenAI is configured. Local transcription is optional and is not fully available on this machine yet.',
            notes: [...localIssues.slice(0, 2), ...localWarnings.slice(0, 1)]
          });
        } else {
          clearLaunchBanner();
        }
        return;
      }

      if (mode === 'local') {
        setStatus('Local mode ready', 'idle');
        showLaunchBanner({
          type: localWarnings.length > 0 ? 'warning' : 'info',
          title: 'Local processing is ready',
          message: 'MeetMind can transcribe files on this PC and will use local fallback analysis when OpenAI is unavailable.',
          notes: localWarnings.length > 0
            ? localWarnings.slice(0, 3)
            : ['Add OPENAI_API_KEY later if you want cloud analysis or hosted deployment.']
        });
        return;
      }

      setStatus('Ready', 'idle');
      clearLaunchBanner();
    })
    .catch(() => {
      setStatus('Server offline', 'error');
      showLaunchBanner({
        type: 'error',
        title: 'Local server is offline',
        message: 'Start the app with "node server.js" or double-click "start-meetmind.bat", then open http://localhost:3000.'
      });
    });
})();

async function runServerPipeline(job) {
  const pipelineSection = document.getElementById('pipeline-section');
  const inputSection = document.getElementById('input-section');
  const resultsSection = document.getElementById('results-section');
  const progressBar = document.getElementById('progress-bar');
  const logEl = document.getElementById('pipeline-log');
  const isRecordJob = job.source === 'record';
  const localPreferences = job.localPreferences || getLocalProcessingPreferences();

  inputSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  pipelineSection.classList.remove('hidden');
  pipelineSection.scrollIntoView({ behavior: 'smooth' });
  setStatus('Processing...', 'processing');

  ['transcribe', 'analyze', 'generate'].forEach(stepId => {
    const step = document.getElementById(`step-${stepId}`);
    step.classList.remove('active', 'done', 'error');
    step.querySelector('.step-status').textContent = 'Pending';
  });
  progressBar.style.width = '0%';

  function log(msg) {
    logEl.innerHTML = `<span class="log-line">&gt; ${msg}</span>`;
  }

  async function activateStep(stepId, logMsg, work) {
    const step = document.getElementById(`step-${stepId}`);
    step.classList.add('active');
    step.querySelector('.step-status').textContent = 'In progress...';
    log(logMsg);

    try {
      const result = typeof work === 'function'
        ? await work()
        : await delay(typeof work === 'number' ? work : 300);
      step.classList.remove('active');
      step.classList.add('done');
      step.querySelector('.step-status').textContent = 'Complete';
      return result;
    } catch (error) {
      step.classList.remove('active');
      step.classList.add('error');
      step.querySelector('.step-status').textContent = 'Failed';
      throw error;
    }
  }

  try {
    progressBar.style.width = '10%';
    log(
      isRecordJob
        ? 'Preparing recorded audio and live transcript context...'
        : job.file
          ? 'Preparing media for upload...'
          : 'Preparing transcript input...'
    );
    await delay(200);

    progressBar.style.width = '28%';
    await activateStep(
      'transcribe',
      isRecordJob
        ? 'Finalizing your recording and browser transcript before analysis...'
        : job.file
          ? 'Preparing audio/video for transcription...'
          : 'Normalizing transcript for AI analysis...',
      job.file ? 450 : 220
    );

    progressBar.style.width = '70%';
    const payload = await activateStep(
      'analyze',
      isRecordJob
        ? 'Transcribing the recording and extracting meeting insights...'
        : job.file
        ? 'Transcribing audio and extracting meeting insights...'
        : 'Analyzing transcript and extracting meeting insights...',
      () => ProcessingAPI.request(job)
    );
    const results = applySummaryPreferences(payload.data, localPreferences);

    progressBar.style.width = '92%';
    await activateStep(
      'generate',
      'Rendering transcript, summary, actions, and participant insights...',
      320
    );

    progressBar.style.width = '100%';
    log('Processing complete. Rendering results...');
    await delay(180);

    progressBar.style.width = '0%';
    pipelineSection.classList.add('hidden');

    UI.displayResults(results);
    ExportEngine.setData(results);
    QAEngine.init(results);

    const warnings = Array.isArray(payload?.meta?.warnings)
      ? payload.meta.warnings.filter(Boolean)
      : [];
    warnings.forEach((warning, index) => {
      setTimeout(() => showToast(shortenProcessingWarning(warning), 'info', 4200), index * 180);
    });

    const meetingTitle = job.title || getMeetingTitle() || `Meeting - ${new Date().toLocaleDateString()}`;
    SessionStore.save({
      title: meetingTitle,
      date: new Date().toLocaleDateString(),
      duration: results.summary.duration || 1,
      actions: results.actions.length,
      summary: buildSummaryText(results.summary),
      data: results
    });

    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
    setStatus('Analysis complete', 'idle');
    showToast('Meeting analysis complete!', 'success');
  } catch (error) {
    const fallbackLines = getBrowserFallbackLines(job);
    if (fallbackLines) {
      showToast('OpenAI or server processing was unavailable. Switching to free browser analysis.', 'info', 5200);
      return runPipeline(fallbackLines, {
        localPreferences,
        generateLog: 'Generating a browser-side meeting brief with local heuristics…',
        completionToast: 'Meeting analysis complete using browser fallback!'
      });
    }

    if (job?.file instanceof File) {
      showToast('Server processing was unavailable. Falling back to browser Whisper.', 'info', 5200);
      return runBrowserWhisperFilePipeline({
        ...job,
        localPreferences
      });
    }

    progressBar.style.width = '0%';
    pipelineSection.classList.add('hidden');
    inputSection.classList.remove('hidden');
    inputSection.scrollIntoView({ behavior: 'smooth' });
    setStatus('Processing failed', 'error');
    showToast(error.message || ProcessingAPI.helpMessage(), 'error', 5200);
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== MEETING TITLE HELPER =====
function getMeetingTitle() {
  const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab;
  const ids = { upload: 'upload-title', record: 'record-title', paste: 'paste-title' };
  return document.getElementById(ids[activeTab] || 'paste-title')?.value?.trim() || '';
}

function getActiveInputTab() {
  return document.querySelector('.tab-btn.active')?.dataset?.tab || 'paste';
}

function getLocalProcessingPreferences() {
  const activeTab = getActiveInputTab();
  const summaryStyle = document.getElementById(`${activeTab}-summary-style`)?.value || 'executive';
  const localQuality = document.getElementById(`${activeTab}-local-quality`)?.value || 'balanced';
  return { summaryStyle, localQuality };
}

// ===== TRANSCRIPT SEARCH =====
(function initTranscriptSearch() {
  const searchInput = document.getElementById('transcript-search');
  const countEl = document.getElementById('search-count');
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    const content = document.getElementById('transcript-content');
    // Remove old highlights
    content.querySelectorAll('.search-highlight').forEach(el => {
      const parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });
    if (!q || q.length < 2) { countEl.textContent = ''; return; }
    let count = 0;
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(n => {
      const idx = n.textContent.toLowerCase().indexOf(q.toLowerCase());
      if (idx === -1) return;
      const highlight = document.createElement('mark');
      highlight.className = 'search-highlight';
      highlight.textContent = n.textContent.substring(idx, idx + q.length);
      const after = n.splitText(idx);
      after.textContent = after.textContent.substring(q.length);
      n.parentNode.insertBefore(highlight, after);
      count++;
    });
    countEl.textContent = count > 0 ? `${count}` : '';
  });
})();

// ===== UI DISPLAY =====
const UI = (() => {

  // Result Tab switching
  document.querySelectorAll('.result-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.result-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.result-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panelId = `rp-${tab.dataset.rtab}`;
      document.getElementById(panelId).classList.add('active');
    });
  });

  function displayResults(data) {
    const { lines, summary, importantPoints, actions, decisions, score, participants } = data;
    const showSpeakers = hasRealSpeakerNames(lines);

    // Metadata
    const now = new Date();
    document.getElementById('res-duration').textContent = `~${summary.duration || 1} min`;
    document.getElementById('res-words').textContent = `${summary.wordCount || lines.length * 20} words`;
    document.getElementById('res-date').textContent = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    // TRANSCRIPT
    const colors = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ec4899'];
    const speakerColors = {};
    let colorIdx = 0;
    if (showSpeakers) {
      lines.forEach(l => {
        if (!speakerColors[l.speaker]) speakerColors[l.speaker] = colors[colorIdx++ % colors.length];
      });
    }

    const transcriptHtml = lines.map(l => `
      <div class="transcript-line">
        ${showSpeakers ? `<span class="speaker-label" style="color:${speakerColors[l.speaker]}">${escapeHtml(l.speaker)}:</span>` : ''}
        <span class="speaker-text">${escapeHtml(l.text)}</span>
      </div>
    `).join('');
    document.getElementById('transcript-content').innerHTML = transcriptHtml;
    document.getElementById('badge-transcript').textContent = `${lines.length} turns`;
    document.getElementById('transcript-info').textContent = showSpeakers && summary.speakers.length > 0
      ? `${lines.length} speaker turns · ${summary.speakers.join(', ')}`
      : `${lines.length} transcript lines · Speaker names unavailable`;

    // SUMMARY — with score card
    const summarySections = getSummarySections(summary);
    const hasThemeSection = summarySections.some(section => section.key === 'themes');
    const topicsHtml = summary.topics.map(t => `<span class="topic-chip">${escapeHtml(t)}</span>`).join('');
    const structuredSummaryHtml = buildSummarySectionsHtml(summary);
    const circumference = 2 * Math.PI * 36; // r=36
    const scoreOffset = circumference - (score.overall / 100) * circumference;
    const scoreColor = score.overall >= 75 ? '#10b981' : score.overall >= 50 ? '#6366f1' : '#f59e0b';
    const scoreLabel = score.overall >= 80 ? 'Excellent' : score.overall >= 65 ? 'Good' : score.overall >= 45 ? 'Fair' : 'Needs Work';
    document.getElementById('summary-content').innerHTML = `
      <div class="score-card">
        <div class="score-ring-wrap">
          <svg width="88" height="88" viewBox="0 0 88 88">
            <circle class="score-ring-bg" cx="44" cy="44" r="36"/>
            <circle class="score-ring-fill" cx="44" cy="44" r="36"
              stroke="${scoreColor}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${scoreOffset}"/>
          </svg>
          <div class="score-ring-center">
            <span class="score-value" style="color:${scoreColor}">${score.overall}</span>
            <span class="score-label">/ 100</span>
          </div>
        </div>
        <div class="score-details">
          <div>
            <div class="score-title">Meeting Score: ${scoreLabel}</div>
            <div class="score-subtitle">Based on action density, decisions, engagement &amp; depth</div>
          </div>
          <div class="score-bars">
            <div class="score-bar-row"><span class="score-bar-label">Action Density</span><div class="score-bar-track"><div class="score-bar-fill" style="width:${score.actionScore}%"></div></div><span class="score-bar-val">${score.actionScore}</span></div>
            <div class="score-bar-row"><span class="score-bar-label">Decision Quality</span><div class="score-bar-track"><div class="score-bar-fill" style="width:${score.decisionScore}%"></div></div><span class="score-bar-val">${score.decisionScore}</span></div>
            <div class="score-bar-row"><span class="score-bar-label">Engagement</span><div class="score-bar-track"><div class="score-bar-fill" style="width:${score.engageScore}%"></div></div><span class="score-bar-val">${score.engageScore}</span></div>
          </div>
        </div>
      </div>
      <p class="summary-intro">Executive Summary</p>
      <div class="summary-lead">
        <p class="summary-body">${escapeHtml(getStyledSummaryLead(summary))}</p>
        ${hasThemeSection ? '' : `<div class="summary-topics">${topicsHtml}</div>`}
      </div>
      ${structuredSummaryHtml}
    `;

    const importantPointsHtml = normalizeImportantPoints(importantPoints).length === 0
      ? '<p class="placeholder">No important points detected.</p>'
      : normalizeImportantPoints(importantPoints).map(point => `
        <div class="important-point-card">
          <div class="important-point-head">
            <div class="important-point-title">${escapeHtml(point.title)}</div>
            <span class="important-point-type type-${escapeHtml(point.type)}">${escapeHtml(formatImportantPointType(point.type))}</span>
          </div>
          ${point.detail ? `<p class="important-point-detail">${escapeHtml(point.detail)}</p>` : ''}
        </div>
      `).join('');
    document.getElementById('important-points-list').innerHTML = importantPointsHtml;
    document.getElementById('badge-important').textContent = normalizeImportantPoints(importantPoints).length;

    // ACTION ITEMS
    const actionsHtml = actions.length === 0
      ? '<p class="placeholder">No action items detected.</p>'
      : actions.map(a => `
        <div class="action-card">
          <div class="action-check" onclick="this.classList.toggle('checked');this.textContent=this.classList.contains('checked')?'✓':''"></div>
          <div class="action-body">
            <div class="action-task">${escapeHtml(a.task)}</div>
            <div class="action-meta">
              <span class="action-meta-item">👤 ${escapeHtml(a.assignee)}</span>
              <span class="action-meta-item">📅 ${escapeHtml(a.deadline)}</span>
              <span class="priority-badge priority-${a.priority}">${a.priority.toUpperCase()}</span>
            </div>
          </div>
        </div>
      `).join('');
    document.getElementById('actions-list').innerHTML = actionsHtml;
    document.getElementById('badge-actions').textContent = actions.length;

    // KEY DECISIONS
    const decisionColors = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ec4899'];
    const decisionsHtml = decisions.length === 0
      ? '<p class="placeholder">No key decisions detected.</p>'
      : decisions.map((d, i) => `
        <div class="decision-card">
          <div class="decision-header">
            <div class="decision-num" style="background:${decisionColors[i % decisionColors.length]}">${i + 1}</div>
            <div class="decision-title">${escapeHtml(d.title)}</div>
          </div>
          ${d.context ? `<div class="decision-context">${escapeHtml(d.context)}</div>` : ''}
          <div class="decision-impact">
            <span class="impact-icon">👤</span>
            <span>Identified from: ${escapeHtml(d.speaker)}</span>
          </div>
        </div>
      `).join('');
    document.getElementById('decisions-list').innerHTML = decisionsHtml;
    document.getElementById('badge-decisions').textContent = decisions.length;

    // PARTICIPANTS
    const avatarColors = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ec4899'];
    const sentimentLabels = { positive: '😊 Positive', neutral: '😐 Neutral', critical: '⚠️ Mixed' };
    const maxWords = Math.max(...(participants || []).map(p => p.words), 1);
    const participantsHtml = !participants || participants.length === 0
      ? '<p class="placeholder">No participants detected.</p>'
      : participants.map((p, i) => `
        <div class="participant-card">
          <div class="participant-header">
            <div class="participant-avatar" style="background:${avatarColors[i % avatarColors.length]}">${escapeHtml(p.name.charAt(0))}</div>
            <div>
              <div class="participant-name">${escapeHtml(p.name)}</div>
              <div class="participant-role">${p.turns} turn${p.turns !== 1 ? 's' : ''} · ${p.talkPct}% talk time</div>
            </div>
            <span class="participant-sentiment sentiment-${p.sentiment}">${sentimentLabels[p.sentiment] || '😐 Neutral'}</span>
          </div>
          <div class="participant-stats">
            <div class="p-stat"><span class="p-stat-value" style="color:${avatarColors[i % avatarColors.length]}">${p.turns}</span><span class="p-stat-label">Turns</span></div>
            <div class="p-stat"><span class="p-stat-value" style="color:${avatarColors[i % avatarColors.length]}">${p.words}</span><span class="p-stat-label">Words</span></div>
            <div class="p-stat"><span class="p-stat-value" style="color:${avatarColors[i % avatarColors.length]}">${p.talkPct}%</span><span class="p-stat-label">Talk Time</span></div>
          </div>
          <div class="participant-bar-wrap">
            <span class="participant-bar-label">Talk share</span>
            <div class="participant-bar-track"><div class="participant-bar-fill" style="width:${p.talkPct}%;background:${avatarColors[i % avatarColors.length]}"></div></div>
          </div>
        </div>
      `).join('');
    document.getElementById('participants-list').innerHTML = participantsHtml;
    document.getElementById('badge-participants').textContent = participants ? participants.length : 0;

    // Reset to first tab
    document.querySelectorAll('.result-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.result-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-rtab="transcript"]').classList.add('active');
    document.getElementById('rp-transcript').classList.add('active');
  }

  return { displayResults };
})();

// ===== PASTE WORD COUNT =====
const pasteInput = document.getElementById('paste-input');
pasteInput.addEventListener('input', () => {
  const words = pasteInput.value.trim().split(/\s+/).filter(w => w).length;
  document.getElementById('paste-word-count').textContent = `${words} word${words !== 1 ? 's' : ''}`;
});

// ===== PROCESS HANDLERS =====
function parsePastedText(text) {
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
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}[,\s-]*/i, '')
      .replace(/^[\[(]?\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?[\])]?[\s-]*/i, '')
      .replace(/\s*[\[(]?\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?[\])]?$/i, '')
      .replace(/\s*[-|]\s*$/g, '')
      .trim();
  }

  function isMetadataLine(value) {
    const cleaned = String(value || '').trim().replace(/\s+/g, ' ');
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
    const line = String(rawLine || '').trim().replace(/\s+/g, ' ');
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
        text: match[2].trim()
      };
    }

    return null;
  }

  function extractSpeakerHeader(rawLine) {
    const line = String(rawLine || '').trim().replace(/\s+/g, ' ');
    if (!line || isMetadataLine(line)) return null;
    const match = line.match(/^(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}[,\s-]+)?(.{2,60}?)\s+[\[(]?\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?[\])]?$/i);
    if (!match) return null;
    const speaker = normalizeSpeakerCandidate(match[1]);
    return isLikelySpeakerLabel(speaker) ? speaker : null;
  }

  const labeledLineCount = rawLines.reduce((count, line) => {
    return count + (extractSpeakerTurn(line) ? 1 : 0);
  }, 0);

  if (labeledLineCount < 2) {
    const paragraphs = rawText
      .split(/\r?\n\s*\r?\n/)
      .map(block => block.trim().replace(/\s+/g, ' '))
      .filter(block => !isMetadataLine(block))
      .filter(Boolean);
    const blocks = paragraphs.length > 0 ? paragraphs : [rawText.trim().replace(/\s+/g, ' ')].filter(Boolean);
    const segmented = blocks.flatMap(textBlock => {
      const sentences = textBlock.split(/(?<=[.!?])\s+/).filter(Boolean);
      if (sentences.length <= 2) return [textBlock];
      const grouped = [];
      for (let index = 0; index < sentences.length; index += 2) {
        grouped.push(sentences.slice(index, index + 2).join(' '));
      }
      return grouped;
    });
    return segmented.map(textBlock => ({ speaker: 'Speaker 1', text: textBlock }));
  }

  const lines = [];
  let pendingSpeaker = '';
  rawLines.forEach(line => {
    if (isMetadataLine(line)) return;
    const turn = extractSpeakerTurn(line);
    if (turn) {
      lines.push({ speaker: turn.speaker, text: turn.text });
      pendingSpeaker = '';
      return;
    }

    const headerSpeaker = extractSpeakerHeader(line);
    if (headerSpeaker) {
      pendingSpeaker = headerSpeaker;
      return;
    }

    if (lines.length === 0) {
      lines.push({ speaker: pendingSpeaker || 'Speaker 1', text: line.trim() });
      pendingSpeaker = '';
      return;
    }

    if (pendingSpeaker && pendingSpeaker !== lines[lines.length - 1].speaker) {
      lines.push({ speaker: pendingSpeaker, text: line.trim() });
      pendingSpeaker = '';
      return;
    }

    lines[lines.length - 1].text += ` ${line.trim()}`;
  });

  return lines.filter(l => l.text.length > 2);
}

document.getElementById('process-upload-btn').addEventListener('click', () => {
  if (!currentFile) {
    showToast('Choose an audio or video file first.', 'error');
    return;
  }
  runServerPipeline({
    source: 'upload',
    title: getMeetingTitle(),
    file: currentFile,
    localPreferences: getLocalProcessingPreferences()
  });
});

function getExtensionFromMimeType(mimeType) {
  const normalized = String(mimeType || '').toLowerCase().split(';')[0].trim();
  const map = {
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'video/webm': 'webm'
  };
  return map[normalized] || 'webm';
}

document.getElementById('process-record-btn').addEventListener('click', async () => {
  if (AudioEngine.isRecording()) {
    await AudioEngine.stop();
  }

  const liveText = Transcriber.getLiveTranscript().trim();
  const recordedBlob = AudioEngine.getBlob();
  if (!recordedBlob && liveText.length < 10) {
    showToast('Record some meeting audio first.', 'error');
    return;
  }

  const recordingMimeType = AudioEngine.getMimeType() || recordedBlob?.type || 'audio/webm';
  const recordingExtension = getExtensionFromMimeType(recordingMimeType);
  const recordingFile = recordedBlob
    ? new File([recordedBlob], `meetmind-recording-${Date.now()}.${recordingExtension}`, {
        type: recordingMimeType
      })
    : null;

  runServerPipeline({
    source: 'record',
    title: getMeetingTitle(),
    file: recordingFile,
    liveTranscript: liveText,
    text: recordingFile ? '' : liveText,
    localPreferences: getLocalProcessingPreferences()
  });
});

document.getElementById('rerecord-btn')?.addEventListener('click', () => {
  AudioEngine.reset();
  showToast('Recorder reset. You can capture a fresh take now.', 'info', 3200);
});

document.getElementById('process-paste-btn').addEventListener('click', () => {
  const text = pasteInput.value.trim();
  if (text.length < 10) {
    showToast('Please enter some meeting content first.', 'error');
    return;
  }
  runServerPipeline({
    source: 'paste',
    title: getMeetingTitle(),
    text,
    localPreferences: getLocalProcessingPreferences()
  });
});

// ===== NEW MEETING =====
document.getElementById('new-meeting-btn').addEventListener('click', () => {
  document.getElementById('results-section').classList.add('hidden');
  document.getElementById('input-section').classList.remove('hidden');
  document.getElementById('input-section').scrollIntoView({ behavior: 'smooth' });
  // Reset
  pasteInput.value = '';
  document.getElementById('paste-word-count').textContent = '0 words';
  resetSelectedFile();
  AudioEngine.reset();
  setStatus('Ready', 'idle');
  QAEngine.reset();
});

// ===== RESTART APP =====
document.getElementById('restart-app-btn').addEventListener('click', () => {
  if (confirm('Are you sure you want to restart the application? Any unsaved current meeting data will be lost.')) {
    window.scrollTo(0, 0);
    window.location.reload();
  }
});

// ===== Q&A ENGINE =====
const QAEngine = (() => {
  let meetingData = null;

  // ── Intent patterns ──────────────────────────────────────────────
  const INTENTS = [
    {
      name: 'who_said',
      patterns: [/who (said|mentioned|talked about|spoke about|brought up)\s*(.*)/i, /what did (.+?) say/i],
      handler: whoSaid
    },
    {
      name: 'who_responsible',
      patterns: [/who (is responsible|will handle|will do|will take care|is assigned|is in charge|will lead|volunteered)\s*(.*)/i,
                 /who('s| is) (responsible|handling|doing|taking care of|leading)\s*(.*)/i,
                 /who (owns|will own)\s*(.*)/i],
      handler: whoResponsible
    },
    {
      name: 'what_decided',
      patterns: [/what (was|were|has been)? ?(decided|agreed|resolved|concluded|determined)\s*(.*)/i,
                 /what (decisions?|conclusions?|resolutions?) (were made|was made|did (they|the team) make)/i],
      handler: whatDecided
    },
    {
      name: 'action_items',
      patterns: [/what (are|were) (the )?(action items?|tasks?|to.?dos?|next steps?|deliverables?)/i,
                 /list (the )?(action items?|tasks?|next steps?)/i,
                 /what (needs to|has to) (be done|happen)/i],
      handler: actionItems
    },
    {
      name: 'deadline',
      patterns: [/when (is|are|was|were) (the )?(deadline|due date|due|expected)/i,
                 /what('s| is) (the )?deadline\s*(.*)/i,
                 /when (is .+ due|does .+ need to)/i,
                 /by when/i],
      handler: deadlines
    },
    {
      name: 'topic_summary',
      patterns: [/what (was|is|were) (discussed|covered|talked about|mentioned|addressed)\s*(.*)?/i,
                 /what (topics?|subjects?|issues?) (were|was) (covered|discussed|raised)/i,
                 /summarize/i, /give me a summary/i, /brief summary/i],
      handler: topicSummary
    },
    {
      name: 'participants',
      patterns: [/who (was|were|attended|participated|joined|spoke)/i,
                 /who (are|were) (the )?(attendees?|participants?|speakers?|people)/i,
                 /how many (people|participants|speakers)/i],
      handler: participantsList
    },
    {
      name: 'specific_search',
      patterns: [/.*?about (budg|pric|cost|fund|money|dollar|invest)/i,
                 /.*?about (the )?\w+/i,
                 /tell me about\s*(.*)/i,
                 /what about\s*(.*)/i,
                 /find .*(mention|said|about)\s*(.*)/i],
      handler: specificSearch
    }
  ];

  // ── Utility helpers ──────────────────────────────────────────────
  function now() {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function scoreRelevance(text, keywords) {
    let score = 0;
    keywords.forEach(kw => {
      const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
      score += (text.match(re) || []).length;
    });
    return score;
  }

  function extractKeywords(question) {
    const stopWords = new Set(['what','who','when','where','how','why','is','are','was','were','the','a','an','did','do','does','will','about','for','of','in','on','with','that','this','me','us','they','their','any','all','some','to','about','and','or','but','from','by']);
    return question.toLowerCase()
      .replace(/[?!.,]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
  }

  function findRelevantLines(keywords, topN = 4) {
    if (!meetingData || !meetingData.lines) return [];
    return meetingData.lines
      .map(l => ({ ...l, score: scoreRelevance(l.text, keywords) }))
      .filter(l => l.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  }

  function truncate(str, max = 120) {
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  }

  function tag(text, type = '') {
    return `<span class="qa-tag ${type}">${escapeHtml(text)}</span>`;
  }

  function quote(text, speaker) {
    return `<span class="qa-quote">"${escapeHtml(truncate(text))}" <span class="qa-quote-attr">— ${escapeHtml(speaker)}</span></span>`;
  }

  // ── Intent handlers ──────────────────────────────────────────────
  function whoSaid(question) {
    const keywords = extractKeywords(question);
    if (keywords.length === 0) return "Could you be more specific? What topic are you asking about?";
    const hits = findRelevantLines(keywords, 3);
    if (hits.length === 0) return `I couldn't find any mentions of <strong>${keywords.join(', ')}</strong> in the transcript.`;
    let html = `Here's what I found related to <strong>${keywords.join(', ')}</strong>:<br/><br/>`;
    hits.forEach(h => { html += quote(h.text, h.speaker); });
    return html;
  }

  function whoResponsible(question) {
    const { actions } = meetingData;
    if (actions.length === 0) return "No action items were detected in this meeting, so no assignees were identified.";
    const keywords = extractKeywords(question);
    const relevant = keywords.length > 0
      ? actions.filter(a => scoreRelevance(a.task, keywords) > 0)
      : actions;
    if (relevant.length === 0) {
      const all = actions.map(a => `${tag(a.assignee)} for: ${escapeHtml(truncate(a.task, 70))}`).join('<br/>');
      return `No direct match found, but here are all assigned responsibilities:<br/><br/>${all}`;
    }
    let html = `Here are the people responsible:<br/><br/>`;
    relevant.forEach(a => {
      html += `${tag(a.assignee)} ${escapeHtml(truncate(a.task, 90))}`;
      if (a.deadline !== 'TBD') html += ` ${tag(a.deadline, 'deadline')}`;
      html += '<br/>';
    });
    return html;
  }

  function whatDecided(question) {
    const { decisions } = meetingData;
    if (decisions.length === 0) return "No specific decisions were detected in this meeting.";
    const keywords = extractKeywords(question);
    const relevant = keywords.length > 0
      ? decisions.filter(d => scoreRelevance(d.title + ' ' + d.context, keywords) > 0)
      : decisions;
    if (relevant.length === 0) {
      return `Could not find a decision about that topic. The ${decisions.length} recorded decision(s) cover: <br/>` +
        decisions.map(d => `${tag('Decision', 'decision')} ${escapeHtml(truncate(d.title, 80))}`).join('<br/>');
    }
    let html = `${relevant.length} decision(s) found:<br/><br/>`;
    relevant.forEach(d => {
      html += `${tag('Decision', 'decision')} <strong>${escapeHtml(truncate(d.title, 90))}</strong><br/>`;
      if (d.context) html += `<small style="color:var(--text-secondary)">${escapeHtml(truncate(d.context, 80))}</small><br/>`;
      html += `<small style="color:var(--text-muted)">Identified from: ${escapeHtml(d.speaker)}</small><br/><br/>`;
    });
    return html.trim();
  }

  function actionItems() {
    const { actions } = meetingData;
    if (actions.length === 0) return "No action items were detected in this meeting.";
    let html = `<strong>${actions.length} action item(s) from this meeting:</strong><br/><br/>`;
    actions.forEach((a, i) => {
      const pStyle = a.priority === 'high' ? '#fca5a5' : a.priority === 'medium' ? '#fcd34d' : '#6ee7b7';
      html += `<strong>${i + 1}.</strong> ${escapeHtml(truncate(a.task, 80))}<br/>`;
      html += `${tag(a.assignee)} `;
      if (a.deadline !== 'TBD') html += `${tag(a.deadline, 'deadline')} `;
      html += `<span style="font-size:0.72rem;color:${pStyle}">${a.priority.toUpperCase()}</span><br/><br/>`;
    });
    return html.trim();
  }

  function deadlines() {
    const { actions } = meetingData;
    const withDates = actions.filter(a => a.deadline !== 'TBD');
    if (withDates.length === 0) {
      const l = findRelevantLines(['deadline', 'due', 'by', 'friday', 'monday', 'week', 'month', 'april', 'march'], 4);
      if (l.length === 0) return "No specific deadlines were mentioned in this meeting.";
      let html = "No structured deadlines found, but these lines mentioned timing:<br/><br/>";
      l.forEach(h => { html += quote(h.text, h.speaker); });
      return html;
    }
    let html = `<strong>${withDates.length} deadline(s) identified:</strong><br/><br/>`;
    withDates.forEach(a => {
      html += `${tag(a.deadline, 'deadline')} — ${escapeHtml(truncate(a.task, 70))} ${tag(a.assignee)}<br/>`;
    });
    return html;
  }

  function topicSummary() {
    const { summary } = meetingData;
    let html = getStyledSummaryLead(summary) ? `${escapeHtml(getStyledSummaryLead(summary))}<br/><br/>` : '';
    if (summary?.confidence?.label) {
      html += `<strong>${escapeHtml(summary.confidence.label)}:</strong> ${escapeHtml(summary.confidence.note || '')}<br/><br/>`;
    }
    getSummarySections(summary).forEach(section => {
      html += `<strong>${escapeHtml(section.title)}:</strong> `;
      html += section.kind === 'chips'
        ? `${section.items.map(item => tag(item)).join(' ')}<br/><br/>`
        : `${section.items.map(item => escapeHtml(item)).join('<br/>')}<br/><br/>`;
    });
    return html || "No summary data available.";
  }

  function participantsList() {
    const { participants, summary } = meetingData;
    if (!participants || participants.length === 0) {
      return summary.speakers && summary.speakers.length > 0
        ? `The following people were identified in this meeting: <br/>${summary.speakers.map(s => tag(s)).join(' ')}`
        : "No participant data available.";
    }
    let html = `<strong>${participants.length} participant(s):</strong><br/><br/>`;
    participants.forEach(p => {
      const sentEmoji = p.sentiment === 'positive' ? '😊' : p.sentiment === 'critical' ? '⚠️' : '😐';
      html += `${tag(p.name)} ${sentEmoji} ${p.turns} turns · ${p.words} words · ${p.talkPct}% talk time<br/>`;
    });
    return html;
  }

  function specificSearch(question) {
    const keywords = extractKeywords(question);
    if (keywords.length === 0) return "I didn't understand that question. Try asking about decisions, actions, people, or topics.";
    const hits = findRelevantLines(keywords, 5);
    if (hits.length === 0) {
      return `I searched the transcript but couldn't find any mention of <strong>${keywords.join(', ')}</strong>.`;
    }
    let html = `Found ${hits.length} relevant passage(s) about <strong>${keywords.join(', ')}</strong>:<br/><br/>`;
    hits.forEach(h => { html += quote(h.text, h.speaker); });
    return html;
  }

  function fallback(question) {
    const keywords = extractKeywords(question);
    if (keywords.length > 0) {
      const hits = findRelevantLines(keywords, 4);
      if (hits.length > 0) {
        let html = `Here's what I found related to your question:<br/><br/>`;
        hits.forEach(h => { html += quote(h.text, h.speaker); });
        return html;
      }
    }
    return `I'm not sure how to answer that exactly. Try asking about:<br/>
      ${tag('Who decided...')} ${tag('Action items')} ${tag('Deadlines')} ${tag('Who said...')} ${tag('Summary')}`;
  }

  // ── Suggested questions builder ─────────────────────────────────
  function buildSuggestions(data) {
    const { actions, decisions, summary, participants } = data;
    const sugs = [];
    const speakers = summary?.speakers || [];

    if (decisions.length > 0) sugs.push('What decisions were made?');
    if (actions.length > 0)   sugs.push('What are the action items?');
    if (actions.some(a => a.deadline !== 'TBD')) sugs.push('What are the deadlines?');
    if (speakers.length > 1)  sugs.push(`What did ${speakers[1]} say?`);
    if (speakers.length > 0)  sugs.push(`Who is responsible for tasks?`);
    if (summary?.topics?.length > 0) sugs.push(`What was discussed about ${summary.topics[0]?.toLowerCase()}?`);
    sugs.push('Give me a summary');
    sugs.push('Who attended this meeting?');

    return sugs.slice(0, 7);
  }

  // ── Answer dispatcher ────────────────────────────────────────────
  function answer(question) {
    if (!meetingData) return "No meeting data loaded yet. Please process a meeting first.";
    const q = question.trim();
    for (const intent of INTENTS) {
      for (const pattern of intent.patterns) {
        if (pattern.test(q)) {
          return intent.handler(q);
        }
      }
    }
    return fallback(q);
  }

  // ── UI helpers ────────────────────────────────────────────────────
  function addMessage(role, htmlContent) {
    const box = document.getElementById('qa-messages');
    // Remove welcome card on first message
    const welcome = box.querySelector('.qa-welcome');
    if (welcome) welcome.remove();

    const wrapper = document.createElement('div');
    wrapper.className = `qa-msg ${role}`;
    const avatarEmoji = role === 'user' ? '👤' : '🤖';
    wrapper.innerHTML = `
      <div class="qa-msg-avatar">${avatarEmoji}</div>
      <div class="qa-msg-body">
        <div class="qa-msg-bubble">${htmlContent}</div>
        <div class="qa-msg-time">${now()}</div>
      </div>`;
    box.appendChild(wrapper);
    box.scrollTop = box.scrollHeight;
  }

  function showTyping() {
    const box = document.getElementById('qa-messages');
    const el = document.createElement('div');
    el.className = 'qa-msg bot qa-typing-row';
    el.innerHTML = `
      <div class="qa-msg-avatar">🤖</div>
      <div class="qa-typing-dots"><span></span><span></span><span></span></div>`;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    return el;
  }

  function removeTyping(el) { el?.remove(); }

  async function ask(question) {
    if (!question.trim()) return;
    const input = document.getElementById('qa-input');
    const btn   = document.getElementById('qa-send-btn');

    // Show user message
    addMessage('user', escapeHtml(question));
    input.value = '';
    input.disabled = true;
    btn.disabled   = true;

    // Typing animation (simulates thinking delay)
    const typingEl = showTyping();
    const thinkMs  = 600 + Math.random() * 700;
    await delay(thinkMs);
    removeTyping(typingEl);

    // Generate and show answer
    const response = answer(question);
    addMessage('bot', response);

    input.disabled = false;
    btn.disabled   = false;
    input.focus();
  }

  function init(data) {
    meetingData = data;

    // Build suggestion chips
    const chips = document.getElementById('qa-chips');
    chips.innerHTML = '';
    const suggestions = buildSuggestions(data);
    suggestions.forEach(s => {
      const chip = document.createElement('button');
      chip.className = 'qa-chip';
      chip.textContent = s;
      chip.addEventListener('click', () => {
        document.getElementById('qa-input').value = s;
        ask(s);
      });
      chips.appendChild(chip);
    });
  }

  function reset() {
    meetingData = null;
    const box = document.getElementById('qa-messages');
    box.innerHTML = `
      <div class="qa-welcome">
        <div class="qa-welcome-icon">🤖</div>
        <div class="qa-welcome-text">
          <strong>Ask anything about this meeting</strong>
          <p>I can answer questions about decisions, action items, who said what, deadlines, topics discussed, and more.</p>
        </div>
      </div>`;
    document.getElementById('qa-chips').innerHTML = '';
    document.getElementById('qa-input').value = '';
  }

  // Wire up send button + Enter key
  document.getElementById('qa-send-btn').addEventListener('click', () => {
    ask(document.getElementById('qa-input').value);
  });
  document.getElementById('qa-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask(document.getElementById('qa-input').value);
    }
  });

  return { init, reset };
})();

