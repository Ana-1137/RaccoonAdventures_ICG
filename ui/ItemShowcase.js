import * as THREE from 'three';
import { loadGLTF, cloneScene } from '../core/AssetCache.js';
import { getAssetPath } from '../config.js';
import { addItem } from './Inventory.js';

let _active = false;
let _mesh   = null;
let _time   = 0;
let _camera = null;
let _orbitCtrl  = null;
let _onClose    = null;
let _savedCamPos  = null;
let _savedCamQuat = null;

const ORBIT_RADIUS = 1.5;
const ORBIT_SPEED  = 0.6;
const SHOWCASE_POS = new THREE.Vector3(1, 0.3, 1.2);

const _overlay = document.createElement('div');
_overlay.style.cssText = `position:fixed;inset:0;display:none;align-items:flex-end;justify-content:center;padding-bottom:40px;z-index:3000;pointer-events:none;`;
const _hint = document.createElement('div');
_hint.style.cssText = `background:rgba(0,0,0,0.7);color:#fff;font-family:sans-serif;font-size:1rem;padding:10px 24px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);pointer-events:auto;cursor:pointer;`;
_hint.textContent = 'Clica para guardar 🌸';
_overlay.appendChild(_hint);
document.body.appendChild(_overlay);

export async function startShowcase(scene, camera, orbitControls, itemId, itemName, itemIcon, _unused = null, onClose = null) {
    if (_active) return;
    _active = true;
    _camera = camera;
    _orbitCtrl = orbitControls;
    _onClose = onClose;
    _time = 0;

    _savedCamPos  = camera.position.clone();
    _savedCamQuat = camera.quaternion.clone();
    orbitControls.enabled = false;

    const gltf = await loadGLTF(getAssetPath('elements/Flower.glb'));
    _mesh = cloneScene(gltf);
    _mesh.scale.setScalar(0.08);
    _mesh.position.copy(SHOWCASE_POS);
    _mesh.traverse(o => { if (o.isMesh) o.raycast = () => {}; });
    scene.add(_mesh);

    camera.position.set(SHOWCASE_POS.x, SHOWCASE_POS.y, SHOWCASE_POS.z + ORBIT_RADIUS);
    camera.lookAt(SHOWCASE_POS);

    _overlay.style.display = 'flex';
    _hint.onclick = () => _close(scene, itemId, itemName, itemIcon);
}

function _close(scene, itemId, itemName, itemIcon) {
    if (!_active) return;
    _active = false;
    scene.remove(_mesh);
    _mesh = null;
    _overlay.style.display = 'none';
    _orbitCtrl.enabled = true;
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
    _mesh.rotation.y += delta * 1.5;
    const angle = _time * ORBIT_SPEED;
    _camera.position.set(
        SHOWCASE_POS.x + Math.cos(angle) * ORBIT_RADIUS,
        SHOWCASE_POS.y,
        SHOWCASE_POS.z + Math.sin(angle) * ORBIT_RADIUS
    );
    _camera.lookAt(SHOWCASE_POS);
}

export function isShowcaseActive() { return _active; }
