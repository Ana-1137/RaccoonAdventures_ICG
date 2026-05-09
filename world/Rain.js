import * as THREE from 'three';

const SETTINGS = {
    count: 600,
    area: 14,       // raio horizontal da chuva em torno da câmara
    height: 8,      // altura de spawn
    speed: 12,      // unidades/s para baixo
    color: 0xaaccff,
    size: 0.04,
};

let _points = null;
let _positions = null;
let _intensity = 0;   // 0–1, controlado pelo Dashboard

export function createRain(scene) {
    const { count, area, height, color, size } = SETTINGS;
    _positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        _positions[i * 3]     = (Math.random() - 0.5) * area * 2;
        _positions[i * 3 + 1] = Math.random() * height;
        _positions[i * 3 + 2] = (Math.random() - 0.5) * area * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(_positions, 3));

    const mat = new THREE.PointsMaterial({
        color,
        size,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
    });

    _points = new THREE.Points(geo, mat);
    _points.userData.isParticles = true;  // ignorado pelo raycast do raccoon
    _points.visible = false;
    scene.add(_points);
}

/** @param {number} value 0–1 */
export function setRainIntensity(value) {
    _intensity = Math.max(0, Math.min(1, value));
    if (_points) {
        _points.visible = _intensity > 0;
        _points.material.opacity = 0.35 + _intensity * 0.45;
    }
}

export function getRainIntensity() { return _intensity; }

/**
 * @param {number} delta
 * @param {THREE.Vector3} cameraPos - centro da chuva (segue câmara)
 */
export function updateRain(delta, cameraPos) {
    if (!_points || _intensity === 0) return;

    const { count, area, height, speed } = SETTINGS;
    const drop = speed * _intensity * delta;
    const pos = _points.geometry.attributes.position;

    for (let i = 0; i < count; i++) {
        pos.array[i * 3 + 1] -= drop;
        if (pos.array[i * 3 + 1] < 0) {
            // reset no topo, centrado na câmara
            pos.array[i * 3]     = cameraPos.x + (Math.random() - 0.5) * area * 2;
            pos.array[i * 3 + 1] = height;
            pos.array[i * 3 + 2] = cameraPos.z + (Math.random() - 0.5) * area * 2;
        }
    }
    pos.needsUpdate = true;
}
