import * as THREE from 'three';
import { loadGLTF, cloneScene } from '../../core/AssetCache.js';
import { getAssetPath } from '../../config.js';
import { addItem } from '../../ui/Inventory.js';

// ─── Estado ──────────────────────────────────────────────────────────────────
let _active    = false;
let _mesh      = null;
let _glitter   = null;
let _time      = 0;
let _camera    = null;
let _orbitCtrl = null;
let _onClose   = null;

const ORBIT_RADIUS = 0.6;
const ORBIT_Y      = 0.3;
const ORBIT_SPEED  = 0.8;   // rad/s

// ─── Overlay "clica para guardar" ────────────────────────────────────────────
const _overlay = document.createElement('div');
_overlay.style.cssText = `
    position:fixed; inset:0; display:none; align-items:flex-end;
    justify-content:center; padding-bottom:40px; z-index:3000;
    pointer-events:none;
`;
const _hint = document.createElement('div');
_hint.style.cssText = `
    background:rgba(0,0,0,0.7); color:#fff; font-family:sans-serif;
    font-size:1rem; padding:10px 24px; border-radius:8px;
    border:1px solid rgba(255,255,255,0.2); pointer-events:auto; cursor:pointer;
`;
_hint.textContent = 'Clica para guardar 🌸';
_overlay.appendChild(_hint);
document.body.appendChild(_overlay);

// ─── Glitter ─────────────────────────────────────────────────────────────────
function _createGlitter(scene, pos) {
    const count = 40;
    const positions = new Float32Array(count * 3);
    const phases    = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        positions[i * 3]     = pos.x + (Math.random() - 0.5) * 0.3;
        positions[i * 3 + 1] = pos.y + Math.random() * 0.4;
        positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.3;
        phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        color: 0xffee44, size: 0.04, sizeAttenuation: true,
        transparent: true, opacity: 0.9, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.userData.isParticles = true;
    pts._phases = phases;
    pts._basePos = pos.clone();
    scene.add(pts);
    return pts;
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Inicia o showcase do item desbloqueado.
 * @param {THREE.Scene}    scene
 * @param {THREE.Camera}   camera
 * @param {object}         orbitControls
 * @param {string}         itemId
 * @param {string}         itemName
 * @param {string}         itemIcon
 * @param {Function}       [onClose]
 */
export async function startShowcase(scene, camera, orbitControls, itemId, itemName, itemIcon, worldPos = null, onClose = null) {
    if (_active) return;
    _active    = true;
    _camera    = camera;
    _orbitCtrl = orbitControls;
    _onClose   = onClose;
    _time      = 0;

    // Centro do showcase: posição fornecida ou origem
    const cx = worldPos ? worldPos.x : 0;
    const cy = worldPos ? worldPos.y + ORBIT_Y + 0.6 : ORBIT_Y;
    const cz = worldPos ? worldPos.z : 0;

    orbitControls.enabled = false;

    const gltf = await loadGLTF(getAssetPath('elements/Flower.glb'));
    _mesh = cloneScene(gltf);
    _mesh.scale.setScalar(0.06);
    _mesh.rotation.x = -Math.PI / 2;
    _mesh.position.set(cx, cy, cz);
    _mesh.traverse(o => { if (o.isMesh) o.raycast = () => {}; });
    scene.add(_mesh);

    _glitter = _createGlitter(scene, new THREE.Vector3(cx, cy, cz));
    // Store center for updateShowcase
    _glitter._center = new THREE.Vector3(cx, cy, cz);

    _overlay.style.display = 'flex';
    _hint.onclick = () => _close(scene, itemId, itemName, itemIcon);
}

function _close(scene, itemId, itemName, itemIcon) {
    if (!_active) return;
    _active = false;

    scene.remove(_mesh);
    scene.remove(_glitter);
    _mesh = null; _glitter = null;

    _overlay.style.display = 'none';
    _orbitCtrl.enabled = true;

    addItem(itemId, itemName, itemIcon);

    if (_onClose) { _onClose(); _onClose = null; }
}

export function updateShowcase(delta) {
    if (!_active || !_mesh) return;
    _time += delta;

    _mesh.rotation.z += delta * 1.2;

    const center = _glitter?._center ?? new THREE.Vector3(0, ORBIT_Y, 0);
    const angle = _time * ORBIT_SPEED;
    _camera.position.set(
        center.x + Math.cos(angle) * ORBIT_RADIUS,
        center.y + 0.25,
        center.z + Math.sin(angle) * ORBIT_RADIUS
    );
    _camera.lookAt(center);

    if (_glitter) {
        const pos = _glitter.geometry.attributes.position;
        const bp  = _glitter._center;
        const now = Date.now() * 0.001;
        for (let i = 0; i < 40; i++) {
            const ph = _glitter._phases[i];
            pos.array[i * 3]     = bp.x + Math.cos(now * 1.5 + ph) * 0.25;
            pos.array[i * 3 + 1] = bp.y + ((now * 0.3 + ph * 0.5) % 0.5);
            pos.array[i * 3 + 2] = bp.z + Math.sin(now * 1.5 + ph) * 0.25;
        }
        pos.needsUpdate = true;
    }
}

export function isShowcaseActive() { return _active; }
