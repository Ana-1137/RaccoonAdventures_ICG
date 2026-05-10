import * as THREE from 'three';

const SETTINGS = {
    count: 8,
    colors: [0x4a6fa5, 0x8b5e3c, 0x5a8a5a, 0xaa6644, 0x7755aa],
    orbit: {
        radiusX: 9,
        radiusZ: 7,
        centerX: 0,
        centerZ: 1.5,
        yMin: 1.8,
        yMax: 3.0,
    },
    speed: { min: 0.18, max: 0.35 },
    wing: {
        flapSpeed: 3.5,
        flapAngle: 0.6,   // radianos máx de batimento (eixo X = cima/baixo)
    },
    bob: { amplitude: 0.08, speed: 2.2 },
    fadeSpeed: 0.03,
};

const _birds = [];
let _currentOpacity = 1;

function createBirdMesh(color) {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });

    // ── Corpo: cone deitado no eixo X (peito → -X, cauda → +X) ─────────────
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.38, 5), mat);
    body.rotation.z = Math.PI / 2;
    group.add(body);

    // ── Cabeça: tetraedro na frente ──────────────────────────────────────────
    const head = new THREE.Mesh(new THREE.TetrahedronGeometry(0.065), mat);
    head.position.x = -0.22;
    group.add(head);

    // ── Asas: PlaneGeometry achatada no plano XZ (horizontal) ───────────────
    // Pivot no ombro — a asa desloca-se para o lado dentro do pivot
    // O batimento é rotation.x do pivot (roda a asa para cima/baixo)
    const wingGeo = new THREE.PlaneGeometry(0.28, 0.10);
    // Deslocar vértices para que a base fique no pivot (z=0) e a ponta vá para fora
    const pos = wingGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        pos.setZ(i, pos.getZ(i) + 0.14); // desloca +Z para fora do pivot
    }
    pos.needsUpdate = true;
    wingGeo.rotateX(-Math.PI / 2); // deitar no plano XZ

    const pivotL = new THREE.Group();
    const wingL = new THREE.Mesh(wingGeo, mat);
    pivotL.add(wingL);
    group.add(pivotL);

    const pivotR = new THREE.Group();
    const wingR = new THREE.Mesh(wingGeo.clone(), mat);
    wingR.scale.z = -1;             // espelha para o lado oposto
    pivotR.add(wingR);
    group.add(pivotR);

    return { group, pivotL, pivotR };
}

export function createBirds(scene) {
    const { count, colors, orbit, speed } = SETTINGS;

    for (let i = 0; i < count; i++) {
        const color = colors[i % colors.length];
        const { group, pivotL, pivotR } = createBirdMesh(color);

        const angle = (i / count) * Math.PI * 2;
        const spd   = speed.min + Math.random() * (speed.max - speed.min);
        const y     = orbit.yMin + Math.random() * (orbit.yMax - orbit.yMin);
        const phase = Math.random() * Math.PI * 2;
        const dir   = i % 2 === 0 ? 1 : -1;

        group.position.set(
            orbit.centerX + Math.cos(angle) * orbit.radiusX,
            y,
            orbit.centerZ + Math.sin(angle) * orbit.radiusZ
        );

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

    _currentOpacity = THREE.MathUtils.lerp(_currentOpacity, isDay ? 1 : 0, fadeSpeed);
    const visible = _currentOpacity > 0.01;

    for (const b of _birds) {
        b.group.visible = visible;
        if (!visible) continue;

        b.angle += b.dir * b.spd * delta;
        const x = orbit.centerX + Math.cos(b.angle) * orbit.radiusX;
        const z = orbit.centerZ + Math.sin(b.angle) * orbit.radiusZ;

        const bobY = b.y + Math.sin(now * bob.speed + b.phase) * bob.amplitude;
        b.group.position.set(x, bobY, z);

        // Orientar na direção do movimento
        const tx = -b.dir * Math.sin(b.angle) * orbit.radiusX;
        const tz =  b.dir * Math.cos(b.angle) * orbit.radiusZ;
        b.group.rotation.y = Math.atan2(tx, tz);

        // Bater asas no eixo X (cima/baixo) — funciona independentemente da rotação Y do grupo
        const flap = Math.sin(now * wing.flapSpeed + b.phase) * wing.flapAngle;
        b.pivotL.rotation.x =  flap;
        b.pivotR.rotation.x = -flap;
    }
}
