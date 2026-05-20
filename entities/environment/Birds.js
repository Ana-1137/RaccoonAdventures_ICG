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

export function createBirdMesh(color) {
    const group = new THREE.Group();
    const meshGroup = new THREE.Group();
    meshGroup.rotation.y = Math.PI / 2; // Rodar para que o -X (peito) aponte para +Z (frente)
    group.add(meshGroup);

    const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const beakMat = new THREE.MeshLambertMaterial({ color: 0xddaa00 });

    // ── Corpo: elipse com volume (esfera escalada) ─────────────
    // Peito -> -X, cauda -> +X
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), mat);
    body.scale.set(1.5, 0.8, 0.8); // alongado no eixo X
    meshGroup.add(body);

    // ── Cabeça: esfera ──────────────────────────────────────────
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), mat);
    head.position.set(-0.20, 0.05, 0);
    meshGroup.add(head);

    // ── Olhos: duas esferas ─────────────────────────────────────
    // Puxados mais para fora para não ficarem dentro da cabeça
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), eyeMat);
    eyeL.position.set(-0.26, 0.085, 0.06);
    meshGroup.add(eyeL);

    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), eyeMat);
    eyeR.position.set(-0.26, 0.085, -0.06);
    meshGroup.add(eyeR);

    // ── Bico: cone ──────────────────────────────────────────────
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 8), beakMat);
    beak.rotation.z = Math.PI / 2; // Apontar para -X
    beak.position.set(-0.30, 0.04, 0);
    meshGroup.add(beak);

    // ── Rabo: elipse preenchida mais achatada ───────────────────
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), mat);
    tail.scale.set(1.0, 0.2, 0.8);
    tail.position.set(0.20, 0, 0);
    meshGroup.add(tail);

    // ── Asas: prismas quadrangulares (CylinderGeometry com 4 lados)
    // base maior no corpo, ponta mais pequena.
    const wingGeo = new THREE.CylinderGeometry(0.02, 0.08, 0.3, 4);
    wingGeo.rotateY(Math.PI / 4); // alinhar as faces planas com os eixos
    wingGeo.rotateX(Math.PI / 2); // deitar ao longo do Z (ponta no +Z, base no -Z)
    wingGeo.translate(0, 0, 0.15); // transladar para que a base fique no 0
    wingGeo.scale(1, 0.15, 1); // achatar no Y para parecer uma asa

    const pivotL = new THREE.Group();
    const wingL = new THREE.Mesh(wingGeo, mat);
    pivotL.add(wingL);
    pivotL.position.set(0, 0.05, 0.08); 
    meshGroup.add(pivotL);

    const pivotR = new THREE.Group();
    const wingR = new THREE.Mesh(wingGeo.clone(), mat);
    wingR.scale.z = -1; // espelhar para o outro lado
    pivotR.add(wingR);
    pivotR.position.set(0, 0.05, -0.08);
    meshGroup.add(pivotR);

    return { group, pivotL, pivotR };
}

export function createBirds(scene) {
    const { count, colors, orbit, speed } = SETTINGS;

    for (let i = 0; i < count; i++) {
        const color = colors[i % colors.length];
        const { group, pivotL, pivotR } = createBirdMesh(color);

        const angle = (i / count) * Math.PI * 2;
        const spd = speed.min + Math.random() * (speed.max - speed.min);
        const y = orbit.yMin + Math.random() * (orbit.yMax - orbit.yMin);
        const phase = Math.random() * Math.PI * 2;
        const dir = i % 2 === 0 ? 1 : -1;

        group.position.set(
            orbit.centerX + Math.cos(angle) * orbit.radiusX,
            y,
            orbit.centerZ + Math.sin(angle) * orbit.radiusZ
        );

        group.traverse(o => { if (o.isMesh) o.raycast = () => { }; });
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
        const tz = b.dir * Math.cos(b.angle) * orbit.radiusZ;
        b.group.rotation.y = Math.atan2(tx, tz);

        // Bater asas no eixo X (cima/baixo) — funciona independentemente da rotação Y do grupo
        const flap = Math.sin(now * wing.flapSpeed + b.phase) * wing.flapAngle;
        b.pivotL.rotation.x = flap;
        b.pivotR.rotation.x = -flap;
    }
}
