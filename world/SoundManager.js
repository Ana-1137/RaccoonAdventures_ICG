import { getAssetPath } from '../config.js';

// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────
const SETTINGS = {
    masterVolume: 0.7,
    ambient: {
        day:       { file: 'sounds/enviroment_day.mp3',   volume: 0.4 },
        night:     { file: 'sounds/enviroment_night.mp3', volume: 0.35 },
        rain:      { file: 'sounds/rain.mp3',             volume: 0.5 },
        river:     { file: 'sounds/river.mp3',            volume: 0.35 },
        fireplace: { file: 'sounds/fireplace.mp3',        volume: 0.3 },
    },
    shine:   { file: 'sounds/shine.mp3',   volume: 0.0 },  // volume dinâmico
    collect: { file: 'sounds/collect.mp3', volume: 0.8 },
};

// ─── ESTADO ──────────────────────────────────────────────────────────────────
let _ctx = null;
let _master = null;   // GainNode master
const _nodes = {};    // name → { source, gain, buffer }
let _enabled = true;

// ─── INIT ────────────────────────────────────────────────────────────────────

/** Inicializa o AudioContext e carrega todos os sons. Chamar após interação do utilizador. */
export async function initSounds() {
    if (_ctx) return;
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
    _master = _ctx.createGain();
    _master.gain.value = SETTINGS.masterVolume;
    _master.connect(_ctx.destination);

    await Promise.all([
        _load('day',       SETTINGS.ambient.day),
        _load('night',     SETTINGS.ambient.night),
        _load('rain',      SETTINGS.ambient.rain),
        _load('river',     SETTINGS.ambient.river),
        _load('fireplace', SETTINGS.ambient.fireplace),
        _load('shine',     SETTINGS.shine),
        _load('collect',   SETTINGS.collect),
    ]);

    _playLoop('day',       0);
    _playLoop('night',     0);
    _playLoop('rain',      0);
    _playLoop('river',     SETTINGS.ambient.river.volume);
    _playLoop('fireplace', SETTINGS.ambient.fireplace.volume);
    _playLoop('shine',     0);
}

// ─── API PÚBLICA ─────────────────────────────────────────────────────────────

/**
 * Atualiza volumes dos ambientes com base na hora e intensidade de chuva.
 * @param {number} hour       0–24
 * @param {number} rainLevel  0–1
 */
export function updateAmbient(hour, rainLevel) {
    if (!_ctx || !_enabled) return;

    const isNight = hour >= 18 || hour < 6;
    // Fade suave entre dia/noite
    const nightVol = isNight ? SETTINGS.ambient.night.volume : 0;
    const dayVol   = isNight ? 0 : SETTINGS.ambient.day.volume;

    _setVol('day',   dayVol);
    _setVol('night', nightVol);
    _setVol('rain',  rainLevel * SETTINGS.ambient.rain.volume);
}

/**
 * Atualiza volume do shine com base na distância à flor mais próxima.
 * @param {number} proximity  0 (longe) → 1 (em cima)
 */
export function updateShine(proximity) {
    if (!_ctx || !_enabled) return;
    _setVol('shine', proximity * SETTINGS.shine.volume || proximity * 0.6);
}

/** Toca o som de coleta (one-shot). */
export function playCollect() {
    if (!_ctx || !_enabled) return;
    _playOnce('collect', SETTINGS.collect.volume);
}

/** Liga/desliga todo o áudio. */
export function setAudioEnabled(val) {
    _enabled = val;
    if (_master) _master.gain.value = val ? SETTINGS.masterVolume : 0;
}

export function setMasterVolume(val) {
    SETTINGS.masterVolume = val;
    if (_master && _enabled) _master.gain.value = val;
}

export function getMasterVolume() { return SETTINGS.masterVolume; }

// ─── INTERNOS ────────────────────────────────────────────────────────────────

async function _load(name, cfg) {
    const res = await fetch(getAssetPath(cfg.file));
    const buf = await res.arrayBuffer();
    _nodes[name] = { buffer: await _ctx.decodeAudioData(buf), gain: null, source: null };
}

function _playLoop(name, volume) {
    const n = _nodes[name];
    if (!n?.buffer) return;

    const gain = _ctx.createGain();
    gain.gain.value = volume;
    gain.connect(_master);

    const src = _ctx.createBufferSource();
    src.buffer = n.buffer;
    src.loop = true;
    src.connect(gain);
    src.start();

    n.gain = gain;
    n.source = src;
}

function _playOnce(name, volume) {
    const n = _nodes[name];
    if (!n?.buffer) return;
    const gain = _ctx.createGain();
    gain.gain.value = volume;
    gain.connect(_master);
    const src = _ctx.createBufferSource();
    src.buffer = n.buffer;
    src.connect(gain);
    src.start();
}

function _setVol(name, value) {
    const n = _nodes[name];
    if (!n?.gain) return;
    // Ramp suave de 0.3s para evitar cliques
    n.gain.gain.linearRampToValueAtTime(
        Math.max(0, value),
        _ctx.currentTime + 0.3
    );
}
