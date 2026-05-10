import * as THREE from 'three';

const SETTINGS = {
    count: 8,
    colors: [0x4a6fa5, 0x8b5e3c, 0x5a8a5a, 0xaa6644, 0x7755aa],
    // Voam numa elipse larga acima da cena
    orbit: {
        radiusX: 9,
        radiusZ: 7,
        centerX: 0,
        centerZ: 1.5,
        yMin: 4.5,
        yMax: 6.5,
    },
    speed: { min: 0.18, max: 0.35 },
    wing: {
        flapSpeed: 3.5,
        flapAngle: 0.55,   // radianos máx de batimento
    },
    bob: { amplitude: 0.08, speed: 2.2 },
    fadeSpeed: 0.03,
};

const _birds = [];
let _currentOpacity = 1;

function createBirdMesh(color) {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color });

    // ── Corpo: cone longo, ponta para trás ──────────────────────────────────
    const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.07, 0.38, 5),
        mat
    );
    body.rotation.z = Math.PI / 2;   // ponta → +X (traseira), base → -X (peito)
    group.add(body);

    // ── Cabeça: tetraedro pequeno na frente ──────────────────────────────────
    const head = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.07),
        mat
    );
    head.position.x = -0.22;
    group.add(head);

    // ── Asas com pivot de ombro ──────────────────────────────────────────────
    const wingGeo = _createWingGeometry();

    const pivotL = new THREE.Group();
    pivotL.position.set(0, 0, 0);
    const wingL = new THREE.Mesh(wingGeo, mat);
    wingL.position.z = 0.22;         // desloca para fora do pivot
    pivotL.add(wingL);
    group.add(pivotL);

    const pivotR = new THREE.Group();
    pivotR.position.set(0, 0, 0);
    const wingR = new THREE.Mesh(wingGeo, mat);
    wingR.position.z = -0.22;
    wingR.scale.z = -1;              // espelha para o lado oposto
    pivotR.add(wingR);
    group.add(pivotR);

    return { group, pivotL, pivotR };
}

function _createWingGeometry() {
    // Triângulo achatado: base no pivot (z=0), ponta para fora
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(-0.14, 0.04);
    shape.lineTo(-0.05, 0.28);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
}

export function createBirds(scene) {
    const { count, colors, orbit, speed } = SETTINGS;

    for (let i = 0; i < count; i++) {
        const color = colors[i % colors.length];
        const { group, pivotL, pivotR } = createBirdMesh(color);

        const angle  = (i / count) * Math.PI * 2;
        const spd    = speed.min + Math.random() * (speed.max - speed.min);
        const y      = orbit.yMin + Math.random() * (orbit.yMax - orbit.yMin);
        const phase  = Math.random() * Math.PI * 2;
        const dir    = i % 2 === 0 ? 1 : -1;

        group.position.set(
            orbit.centerX + Math.cos(angle) * orbit.radiusX,
            y,
            orbit.centerZ + Math.sin(angle) * orbit.radiusZ
        );

        // Sem colisão
        group.traverse(o => { if (o.isMesh) o.raycast = () => {}; });
        scene.add(group);

        _birds.push({ group, pivotL, pivotR, angle, spd, dir, y, phase });
    }
}

export function updateBirds(delta, hour) {
    if (_birds.length === 0) return;

    const { orbit, wing, bob, fadeSpeed } = SETTINGS;
    const isDay = hour >= 6 && hour < 18;
    const now = Date.now() * 0.001;

    // Fade in/out com hora
    _currentOpacity = THREE.MathUtils.lerp(_currentOpacity, isDay ? 1 : 0, fadeSpeed);
    const visible = _currentOpacity > 0.01;

    for (const b of _birds) {
        b.group.visible = visible;
        if (!visible) continue;

        // Orbitar
        b.angle += b.dir * b.spd * delta;
        const x = orbit.centerX + Math.cos(b.angle) * orbit.radiusX;
        const z = orbit.centerZ + Math.sin(b.angle) * orbit.radiusZ;

        // Bob vertical
        const bobY = b.y + Math.sin(now * bob.speed + b.phase) * bob.amplitude;
        b.group.position.set(x, bobY, z);

        // Orientar na direção do movimento (tangente à elipse)
        const tx = -b.dir * Math.sin(b.angle) * orbit.radiusX;
        const tz =  b.dir * Math.cos(b.angle) * orbit.radiusZ;
        b.group.rotation.y = Math.atan2(tx, tz);

        // Bater asas
        const flap = Math.sin(now * wing.flapSpeed + b.phase) * wing.flapAngle;
        b.pivotL.rotation.z =  flap;
        b.pivotR.rotation.z = -flap;
    }
}
