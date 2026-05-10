import { getAssetPath } from '../config.js';

// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────
const SETTINGS = {
    volumes: {
        master: 0.7,
        ambient: 1.0,
        effects: 1.0,
    },
    ambient: {
        day: { file: 'sounds/enviroment_day.mp3', volume: 0.4 },
        night: { file: 'sounds/enviroment_night.mp3', volume: 0.15 },
        rain: { file: 'sounds/rain.mp3', volume: 0.5 },
        river: { file: 'sounds/river.mp3', volume: 0.35 },
    },
    effects: {
        fireplace: { file: 'sounds/fireplace.mp3', volume: 0.7, range: 2.0 },
        shine: { file: 'sounds/shine.mp3', volume: 1.9, range: 4.5 },
        collect: { file: 'sounds/collect.mp3', volume: 0.8 },
    },
};

// ─── ESTADO ──────────────────────────────────────────────────────────────────
let _ctx = null;
let _masterGain = null;
let _ambientGain = null;
let _effectsGain = null;
const _nodes = {};
let _enabled = true;

// ─── INIT ────────────────────────────────────────────────────────────────────
export async function initSounds() {
    if (_ctx) return;
    _ctx = new (window.AudioContext || window.webkitAudioContext)();

    _masterGain = _ctx.createGain();
    _ambientGain = _ctx.createGain();
    _effectsGain = _ctx.createGain();

    _masterGain.gain.value = SETTINGS.volumes.master;
    _ambientGain.gain.value = SETTINGS.volumes.ambient;
    _effectsGain.gain.value = SETTINGS.volumes.effects;

    _ambientGain.connect(_masterGain);
    _effectsGain.connect(_masterGain);
    _masterGain.connect(_ctx.destination);

    await Promise.all([
        _load('day', SETTINGS.ambient.day, _ambientGain),
        _load('night', SETTINGS.ambient.night, _ambientGain),
        _load('rain', SETTINGS.ambient.rain, _ambientGain),
        _load('river', SETTINGS.ambient.river, _ambientGain),
        _load('fireplace', SETTINGS.effects.fireplace, _effectsGain),
        _load('shine', SETTINGS.effects.shine, _effectsGain),
        _load('collect', SETTINGS.effects.collect, _effectsGain),
        _load('unlock', { file: 'sounds/unlock.mp3' }, _effectsGain),
    ]);

    _playLoop('day', 0);
    _playLoop('night', 0);
    _playLoop('rain', 0);
    _playLoop('river', SETTINGS.ambient.river.volume);
    _playLoop('fireplace', 0);
    _playLoop('shine', 0);
}

// ─── API PÚBLICA ─────────────────────────────────────────────────────────────

/** Atualiza ambientes (dia/noite/chuva). */
export function updateAmbient(hour, rainLevel) {
    if (!_ctx || !_enabled) return;
    const isNight = hour >= 18 || hour < 6;
    _setVol('day', isNight ? 0 : SETTINGS.ambient.day.volume);
    _setVol('night', isNight ? SETTINGS.ambient.night.volume : 0);
    _setVol('rain', rainLevel * SETTINGS.ambient.rain.volume);
}

/**
 * Atualiza som da fogueira por proximidade.
 * @param {THREE.Vector3} playerPos
 * @param {boolean}       campfireEnabled
 */
export function updateFireplace(playerPos, campfireEnabled) {
    if (!_ctx || !_enabled) return;
    if (!campfireEnabled) { _setVol('fireplace', 0); return; }
    // Fogueira está em (0, 0, 0) — usar distância XZ
    const dx = playerPos.x, dz = playerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const { range, volume } = SETTINGS.effects.fireplace;
    const proximity = Math.max(0, 1 - dist / range);
    _setVol('fireplace', proximity * volume);
}

/**
 * Atualiza volume do shine por proximidade à flor.
 * @param {number} proximity 0–1
 */
export function updateShine(proximity) {
    if (!_ctx || !_enabled) return;
    _setVol('shine', proximity * SETTINGS.effects.shine.volume);
}

/** Toca som de coleta (one-shot). */
export function playCollect() {
    if (!_ctx || !_enabled) return;
    _playOnce('collect', SETTINGS.effects.collect.volume);
}

/** Toca som de unlock (one-shot). */
export function playUnlock() {
    if (!_ctx || !_enabled) return;
    _playOnce('unlock', 0.9);
}

export function setAudioEnabled(val) {
    _enabled = val;
    if (_masterGain) _masterGain.gain.value = val ? SETTINGS.volumes.master : 0;
}
export function setMasterVolume(val) { SETTINGS.volumes.master = val; if (_masterGain && _enabled) _masterGain.gain.value = val; }
export function setAmbientVolume(val) { SETTINGS.volumes.ambient = val; if (_ambientGain) _ambientGain.gain.value = val; }
export function setEffectsVolume(val) { SETTINGS.volumes.effects = val; if (_effectsGain) _effectsGain.gain.value = val; }
export function getMasterVolume() { return SETTINGS.volumes.master; }
export function getAmbientVolume() { return SETTINGS.volumes.ambient; }
export function getEffectsVolume() { return SETTINGS.volumes.effects; }

// ─── INTERNOS ────────────────────────────────────────────────────────────────
async function _load(name, cfg, busGain) {
    const res = await fetch(getAssetPath(cfg.file));
    const buf = await res.arrayBuffer();
    _nodes[name] = { buffer: await _ctx.decodeAudioData(buf), gain: null, source: null, bus: busGain };
}

function _playLoop(name, volume) {
    const n = _nodes[name];
    if (!n?.buffer) return;
    const gain = _ctx.createGain();
    gain.gain.value = volume;
    gain.connect(n.bus);
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
    gain.connect(n.bus);
    const src = _ctx.createBufferSource();
    src.buffer = n.buffer;
    src.connect(gain);
    src.start();
}

function _setVol(name, value) {
    const n = _nodes[name];
    if (!n?.gain) return;
    n.gain.gain.linearRampToValueAtTime(Math.max(0, value), _ctx.currentTime + 0.3);
}
