import * as THREE from 'three';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
const SETTINGS = {
    // ── Varais de lâmpadas festoon ──────────────────────────────────────────
    festoonStrings: [
        {
            // Varal 1: horizontal ao lado do acampamento (esquerda ↔ direita)
            poleA: { x: -1.2, z:  0.5 },
            poleB: { x:  1.2, z:  0.5 },
            poleHeight: 1.4,
        },
        {
            // Varal 2: vertical ao lado das árvores (norte ↔ sul), junto à floresta
            poleA: { x: -2.0, z:  0.5 },
            poleB: { x: -2.0, z: -2.0 },
            poleHeight: 1.4,
        },
        {
            // Varal 3: horizontal mais abaixo, lado do rio (menos disperso)
            poleA: { x:  0.5, z: -1.5 },
            poleB: { x:  2.5, z: -1.5 },
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
    // Removido o marcador em z:-3.0 (sobrepunha-se à cascata)
    groundMarkers: [
        { x: 1.2, z:  1.5 },
        { x: 1.2, z:  0.0 },
        { x: 1.2, z: -1.5 },
    ],
    marker: {
        stakeHeight: 0.12,
        lightIntensity: 0.3,
        lightRange: 0.6,
        lightColor: 0xffeebb,
    },
    // ── Lanterna da tenda ────────────────────────────────────────────────────
    lantern: {
        position: { x: 0.6, y: 1.6, z: -2.2 },
        lightIntensity: 0.9,
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
    return mesh;
}

/** Cria um bulbo esférico de lâmpada festoon. */
function createBulb(color, radius) {
    return new THREE.Mesh(
        new THREE.SphereGeometry(radius, 6, 6),
        new THREE.MeshBasicMaterial({ color })
    );
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

/** Cria a lanterna da tenda. */
function createTentLantern() {
    const group = new THREE.Group();
    const { position, lightIntensity, lightRange, lightColor } = SETTINGS.lantern;

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.12, 0.08),
        new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    group.add(body);

    const glass = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.09, 0.06),
        new THREE.MeshBasicMaterial({ color: lightColor, transparent: true, opacity: 0.7 })
    );
    group.add(glass);

    const light = new THREE.PointLight(lightColor, lightIntensity, lightRange);
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

        // Lâmpadas ao longo do varal com sag parabólico
        const n = festoon.bulbsPerString;
        for (let i = 1; i <= n; i++) {
            const t = i / (n + 1);
            const x = poleA.x + (poleB.x - poleA.x) * t;
            const z = poleA.z + (poleB.z - poleA.z) * t;
            const y = poleHeight - festoon.sag * 4 * t * (1 - t); // parábola

            const bulb = createBulb(festoon.bulbColor, festoon.bulbRadius);
            bulb.position.set(x, y, z);
            scene.add(bulb);

            const light = new THREE.PointLight(festoon.bulbColor, festoon.lightIntensity, festoon.lightRange);
            light.position.set(x, y, z);
            scene.add(light);
            allLights.push(light);
        }
    }

    // ── 2. MARCADORES DE CHÃO ────────────────────────────────────────────────
    for (const cfg of groundMarkers) {
        const { group, light } = createGroundMarker(cfg.x, cfg.z);
        scene.add(group);
        allLights.push(light);
    }

    // ── 3. LANTERNA DA TENDA ─────────────────────────────────────────────────
    const { group: lanternGroup, light: lanternLight } = createTentLantern();
    scene.add(lanternGroup);
    allLights.push(lanternLight);

    const settings = { enabled: true };
    return { lights: allLights, settings };
}
