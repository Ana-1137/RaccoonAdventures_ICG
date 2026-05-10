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
let _savedCamPos   = null;  // posição da câmara antes do showcase
let _savedCamQuat  = null;

const ORBIT_RADIUS = 0.22;  // distância da câmara à flor
const ORBIT_SPEED  = 0.7;   // rad/s
// Flor fica a esta altura — câmara orbita ao mesmo nível Y
const FLOWER_Y     = 3.5;
const SHOWCASE_POS = new THREE.Vector3(0, FLOWER_Y, 0);

// ─── Overlay ─────────────────────────────────────────────────────────────────
const _overlay = document.createElement('div');
_overlay.style.cssText = `
    position:fixed; inset:0; display:none; align-items:flex-end;
    justify-content:center; padding-bottom:40px; z-index:3000; pointer-events:none;
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
        positions[i * 3]     = pos.x + (Math.random() - 0.5) * 0.2;
        positions[i * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.2;
        positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.2;
        phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        color: 0xffee44, size: 0.05, sizeAttenuation: true,
        transparent: true, opacity: 0.9, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.userData.isParticles = true;
    pts._phases = phases;
    scene.add(pts);
    return pts;
}

// ─── API ─────────────────────────────────────────────────────────────────────
export async function startShowcase(scene, camera, orbitControls, itemId, itemName, itemIcon, _unused = null, onClose = null) {
    if (_active) return;
    _active    = true;
    _camera    = camera;
    _orbitCtrl = orbitControls;
    _onClose   = onClose;
    _time      = 0;

    // Guardar estado da câmara para restaurar depois
    _savedCamPos  = camera.position.clone();
    _savedCamQuat = camera.quaternion.clone();

    orbitControls.enabled = false;

    const gltf = await loadGLTF(getAssetPath('elements/Flower.glb'));
    _mesh = cloneScene(gltf);
    _mesh.scale.setScalar(0.07);
    _mesh.rotation.x = -Math.PI / 2;
    _mesh.position.copy(SHOWCASE_POS);
    _mesh.traverse(o => { if (o.isMesh) o.raycast = () => {}; });
    scene.add(_mesh);

    _glitter = _createGlitter(scene, SHOWCASE_POS);

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

    // Restaurar câmara
    if (_savedCamPos) {
        _camera.position.copy(_savedCamPos);
        _camera.quaternion.copy(_savedCamQuat);
        _savedCamPos = null; _savedCamQuat = null;
    }

    addItem(itemId, itemName, itemIcon);
    if (_onClose) { _onClose(); _onClose = null; }
}

export function updateShowcase(delta) {
    if (!_active || !_mesh) return;
    _time += delta;

    // Flor roda no lugar
    _mesh.rotation.z += delta * 1.5;

    // Câmara orbita em círculo ligeiramente acima da flor, focada nela
    const angle = _time * ORBIT_SPEED;
    _camera.position.set(
        SHOWCASE_POS.x + Math.cos(angle) * ORBIT_RADIUS,
        SHOWCASE_POS.y + 0.08,   // ligeiramente acima
        SHOWCASE_POS.z + Math.sin(angle) * ORBIT_RADIUS
    );
    _camera.lookAt(SHOWCASE_POS);

    // Glitter orbita à volta da flor
    if (_glitter) {
        const pos = _glitter.geometry.attributes.position;
        const now = Date.now() * 0.001;
        for (let i = 0; i < 40; i++) {
            const ph = _glitter._phases[i];
            const r  = 0.12 + Math.sin(now + ph) * 0.06;
            pos.array[i * 3]     = SHOWCASE_POS.x + Math.cos(now * 1.5 + ph) * r;
            pos.array[i * 3 + 1] = SHOWCASE_POS.y + Math.sin(now * 2.0 + ph) * r;
            pos.array[i * 3 + 2] = SHOWCASE_POS.z + Math.sin(now * 1.2 + ph) * r;
        }
        pos.needsUpdate = true;
    }
}

export function isShowcaseActive() { return _active; }
