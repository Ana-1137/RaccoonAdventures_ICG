import * as THREE from 'three';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
const SETTINGS = {
    // ── Varais de lâmpadas festoon ──────────────────────────────────────────
    festoonStrings: [
        {
            // Varal 1: horizontal ao lado do acampamento (esquerda ↔ direita)
            poleA: { x: -1.5, z: 3.7 },
            poleB: { x: 0.4, z: 3.7 },
            poleHeight: 1.4,
        },
        {
            // Varal 2: vertical ao lado das árvores (norte ↔ sul), junto à floresta
            poleA: { x: -2.0, z: 2.5 },
            poleB: { x: -2.0, z: 0.0 },
            poleHeight: 1.4,
        },
        {
            // Varal 3: horizontal lado do rio
            poleA: { x: 1.7, z: 0.5 },
            poleB: { x: 4.2, z: 0.5 },
            poleHeight: 1.4,
        },
    ],
    festoon: {
        bulbsPerString: 5,
        bulbColor: 0xffdd88,
        bulbRadius: 0.05,
        lightIntensity: 0.7,
        lightRange: 1.8,
        sag: 0.3,
    },
    // ── Marcadores de chão ao longo do rio ──────────────────────────────────
    // x: 0.8 — na margem esquerda do rio, fora da depressão do vale
    groundMarkers: [
        { x: 0.8, z: 3.5 },
        { x: 1.8, z: 1.5 },
        { x: 2.0, z: -2.2 },
    ],
    marker: {
        stakeHeight: 0.12,
        lightIntensity: 0.3,
        lightRange: 0.6,
        lightColor: 0xffeebb,
    },
    // ── Lanterna da tenda ────────────────────────────────────────────────────
    // Tenda em {x:0, y:0.4, z:-2}, escala 0.8 — lanterna à entrada
    lantern: {
        position: { x: -0.2, y: 0.08, z: -2.2 },
        lightIntensity: 0.6,
        lightRange: 2.5,
        lightColor: 0xffcc66,
    },
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

/** Cria um poste alto de varal (cilindro fino). */
function createFestoonPole(x, z, height) {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.03, height, 6),
        new THREE.MeshLambertMaterial({ color: 0x5c3d1e })
    );
    mesh.position.set(x, height / 2, z);
    mesh.raycast = () => {};  // sem colisão
    return mesh;
}

/** Cria um bulbo esférico de lâmpada festoon. */
function createBulb(color, radius) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 6, 6),
        new THREE.MeshBasicMaterial({ color })
    );
    mesh.raycast = () => {};  // sem colisão
    return mesh;
}

/** Cria um marcador de chão minúsculo (estaca + ponto de luz). */
function createGroundMarker(x, z) {
    const group = new THREE.Group();
    const { stakeHeight, lightIntensity, lightRange, lightColor } = SETTINGS.marker;

    // Estaca
    const stake = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.01, stakeHeight, 5),
        new THREE.MeshLambertMaterial({ color: 0x4a3010 })
    );
    stake.position.y = stakeHeight / 2;
    group.add(stake);

    // Cúpula minúscula
    const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: lightColor })
    );
    cap.position.y = stakeHeight;
    group.add(cap);

    // Luz pontual fraca
    const light = new THREE.PointLight(lightColor, lightIntensity, lightRange);
    light.position.y = stakeHeight;
    group.add(light);

    group.position.set(x, 0, z);
    return { group, light };
}

/** Cria a lanterna da tenda — base + corpo de vidro + telhado piramidal + bulbo. */
function createTentLantern() {
    const group = new THREE.Group();
    const { position, lightIntensity, lightRange, lightColor } = SETTINGS.lantern;
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const glassMat = new THREE.MeshBasicMaterial({ color: lightColor, transparent: true, opacity: 0.55 });

    // Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.02, 0.10), frameMat);
    base.position.y = 0;
    group.add(base);

    // Corpo retangular de vidro
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.08), glassMat);
    body.position.y = 0.06;
    group.add(body);

    // Telhado piramidal (ConeGeometry com 4 lados)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.06, 4), frameMat);
    roof.position.y = 0.14;
    roof.rotation.y = Math.PI / 4; // alinhar arestas com o corpo
    group.add(roof);

    // Bulbo interior
    const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 6, 6),
        new THREE.MeshBasicMaterial({ color: lightColor })
    );
    bulb.position.y = 0.06;
    group.add(bulb);

    const light = new THREE.PointLight(lightColor, lightIntensity, lightRange);
    light.position.y = 0.06;
    group.add(light);

    group.position.set(position.x, position.y, position.z);
    return { group, light };
}

// ─── FUNÇÃO PÚBLICA ──────────────────────────────────────────────────────────

/**
 * Cria e adiciona à cena:
 *  - 2 varais de lâmpadas festoon (acampamento + atravessa o rio)
 *  - Marcadores de chão minúsculos ao longo da margem do rio
 *  - Lanterna pendurada na tenda
 * @param {THREE.Scene} scene
 * @returns {{ lights: THREE.Light[], settings: Object }}
 */
export function createStructureLights(scene) {
    const allLights = [];
    const { festoon, festoonStrings, groundMarkers, marker } = SETTINGS;

    // ── 1. VARAIS FESTOON ────────────────────────────────────────────────────
    for (const str of festoonStrings) {
        const { poleA, poleB, poleHeight } = str;

        // Postes
        scene.add(createFestoonPole(poleA.x, poleA.z, poleHeight));
        scene.add(createFestoonPole(poleB.x, poleB.z, poleHeight));

        // Fio + lâmpadas ao longo do varal com sag parabólico
        const n = festoon.bulbsPerString;
        // Pontos do fio: poste A → lâmpadas → poste B (resolução maior para curva suave)
        const wirePoints = [];
        const wireSegments = 20;
        for (let i = 0; i <= wireSegments; i++) {
            const t = i / wireSegments;
            const x = poleA.x + (poleB.x - poleA.x) * t;
            const z = poleA.z + (poleB.z - poleA.z) * t;
            const y = poleHeight - festoon.sag * 4 * t * (1 - t);
            wirePoints.push(new THREE.Vector3(x, y, z));
        }
        const wireGeo = new THREE.BufferGeometry().setFromPoints(wirePoints);
        const wireMat = new THREE.LineBasicMaterial({ color: 0x333333 });
        const wire = new THREE.Line(wireGeo, wireMat);
        wire.raycast = () => {};
        scene.add(wire);

        for (let i = 1; i <= n; i++) {
            const t = i / (n + 1);
            const x = poleA.x + (poleB.x - poleA.x) * t;
            const z = poleA.z + (poleB.z - poleA.z) * t;
            const y = poleHeight - festoon.sag * 4 * t * (1 - t);

            const bulb = createBulb(festoon.bulbColor, festoon.bulbRadius);
            bulb.position.set(x, y, z);
            scene.add(bulb);

            const light = new THREE.SpotLight(festoon.bulbColor, festoon.lightIntensity, festoon.lightRange, Math.PI / 5, 0.4);
            light.position.set(x, y, z);
            light.target.position.set(x, 0, z);
            light.castShadow = false;
            scene.add(light);
            scene.add(light.target);
            allLights.push(light);
        }
    }

    // ── 2. MARCADORES DE CHÃO ────────────────────────────────────────────────
    for (const cfg of groundMarkers) {
        const { group, light } = createGroundMarker(cfg.x, cfg.z);
        group.traverse(o => { if (o.isMesh || o.isLine) o.raycast = () => {}; });
        scene.add(group);
        allLights.push(light);
    }

    // ── 3. LANTERNA DA TENDA ─────────────────────────────────────────────────
    const { group: lanternGroup, light: lanternLight } = createTentLantern();
    lanternGroup.traverse(o => { if (o.isMesh) o.raycast = () => {}; });
    scene.add(lanternGroup);
    allLights.push(lanternLight);

    const settings = { enabled: true, alwaysOn: false };
    return { lights: allLights, settings };
}
