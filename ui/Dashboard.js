import GUI from 'lil-gui';
import * as THREE from 'three';
import { setRainIntensity } from '../world/Rain.js';
import { setAudioEnabled, setMasterVolume, setAmbientVolume, setEffectsVolume,
         getMasterVolume, getAmbientVolume, getEffectsVolume } from '../world/SoundManager.js';
import { setQuestActive, cheatCollectAll } from '../entities/environment/Flowers.js';
import { createBirdMesh } from '../entities/environment/Birds.js';
import { createFishMesh } from '../entities/environment/Fish.js';

/**
 * Cria e configura o painel de controlo lil-GUI.
 * @param {Object} climate  - Sistema de clima (retornado por createClimate)
 * @param {Object} campfire - Fogueira (retornado por createCampfireLight)
 * @param {Object} structureLights - Luzes estruturais (retornado por createStructureLights)
 * @returns {GUI} Instância do painel
 */
function createDashboard(climate, campfire, structureLights, scene) {
    const gui = new GUI({ title: '🌞 Climate Dashboard' });
    gui.domElement.style.cssText = 'position:fixed;top:10px;right:10px;z-index:1000;';

    _buildTimeFolder(gui, climate);
    _buildLightingFolder(gui, campfire, structureLights);
    _buildClimaFolder(gui, scene);
    _buildSoundFolder(gui);
    _buildPerformanceFolder(gui);
    _buildDebugFolder(gui, scene);

    return gui;
}

// ─── FOLDERS ────────────────────────────────────────────────────────────────

/**
 * Pasta de controlo do ciclo dia/noite.
 * @param {GUI}    gui
 * @param {Object} climate
 */
function _buildTimeFolder(gui, climate) {
    const folder = gui.addFolder('⏰ Tempo');
    folder.open();

    folder.add(climate.settings.time, 'enabled').name('Ativar Ciclo');
    folder.add(climate.settings.time, 'hour', 0, 24, 0.01).name('Hora do Dia');
    folder.add(climate.settings.time, 'speed', 0, 0.3, 0.01).name('Velocidade');

    // Display de hora (read-only, atualizado em cada frame via .listen())
    const timeDisplay = { time: climate.getTimeFormatted() };
    folder.add(timeDisplay, 'time').name('Hora Atual').listen().disable();

    // Guardar referência para que main.js possa atualizar o display
    climate._guiTimeDisplay = timeDisplay;
}

/**
 * Pasta de controlo da fogueira e luzes estruturais.
 * @param {GUI}    gui
 * @param {Object} campfire
 * @param {Object} structureLights
 */
function _buildLightingFolder(gui, campfire, structureLights) {
    const folder = gui.addFolder('💡 Iluminação');
    folder.open();

    folder
        .add(campfire.settings, 'enabled')
        .name('Ativar Fogueira')
        .onChange((value) => {
            campfire.light.visible = value;
            campfire.mesh.visible  = value;
        });

    folder
        .add(campfire.settings, 'intensity', 0, 2, 0.1)
        .name('Intensidade');

    folder
        .add(campfire.settings, 'range', 5, 30, 1)
        .name('Alcance')
        .onChange((value) => {
            campfire.light.distance   = value;
            campfire.settings.range   = value;
        });

    folder
        .addColor(campfire.settings, 'color')
        .name('Cor')
        .onChange((value) => campfire.light.color.setStyle(value));

    if (structureLights) {
        folder
            .add(structureLights.settings, 'enabled')
            .name('Luzes Estruturais');
        folder
            .add(structureLights.settings, 'alwaysOn')
            .name('Sempre Ligadas');
    }
}

/**
 * Pasta de controlo do clima: nevoeiro e chuva.
 * @param {GUI}          gui
 * @param {THREE.Scene}  scene
 */
function _buildClimaFolder(gui, scene) {
    const folder = gui.addFolder('🌦 Clima');

    if (scene?.fog) {
        const fogSettings = { density: 0.0 };
        folder
            .add(fogSettings, 'density', 0, 0.15, 0.005)
            .name('Nevoeiro')
            .onChange((value) => { scene.fog.density = value; });
    }

    const rainSettings = { rain: 0 };
    folder
        .add(rainSettings, 'rain', 0, 1, 0.05)
        .name('Chuva')
        .onChange(setRainIntensity);
}

/**
 * Pasta de controlo de áudio.
 * @param {GUI} gui
 */
function _buildSoundFolder(gui) {
    const folder = gui.addFolder('🔊 Sons');
    const s = { enabled: true, master: getMasterVolume(), ambient: getAmbientVolume(), effects: getEffectsVolume() };
    folder.add(s, 'enabled').name('Ativar Som').onChange(setAudioEnabled);
    folder.add(s, 'master',  0, 1, 0.05).name('Master').onChange(setMasterVolume);
    folder.add(s, 'ambient', 0, 1, 0.05).name('Ambiente').onChange(setAmbientVolume);
    folder.add(s, 'effects', 0, 1, 0.05).name('Efeitos').onChange(setEffectsVolume);
}

/**
 * Pasta de performance: exibe FPS em tempo real.
 * @param {GUI} gui
 * @returns {Object} fpsDisplay — atualizar `fpsDisplay.fps` em cada frame
 */
function _buildPerformanceFolder(gui) {
    const folder     = gui.addFolder('⚙️ Performance');
    const fpsDisplay = { fps: '0.0' };
    folder.open();
    folder.add(fpsDisplay, 'fps').name('FPS').listen().disable();
    // Guardar no objeto global para acesso em main.js
    gui._fpsDisplay = fpsDisplay;
    return fpsDisplay;
}

/**
 * Pasta de debug: cheats e visualização de modelos individuais.
 * @param {GUI}         gui
 * @param {THREE.Scene} scene
 */
function _buildDebugFolder(gui, scene) {
    const folder = gui.addFolder('🐛 Debug');

    // ── Cheat: apanhar todas as flores ───────────────────────────────────────
    const debugState = { collectAll: false, showBird: false, showFish: false };
    let birdModel = null;
    let fishModel = null;

    folder
        .add(debugState, 'collectAll')
        .name('Apanhar todas as flores')
        .onChange((value) => {
            if (value) {
                setQuestActive(true);
                cheatCollectAll();
            }
        });

    // ── Modelo pássaro ───────────────────────────────────────────────────────
    folder
        .add(debugState, 'showBird')
        .name('Modelo pássaro')
        .onChange((value) => {
            if (value) {
                if (!birdModel) {
                    const { group } = createBirdMesh(0x4a6fa5);
                    group.position.set(0, 0.2, 1.8);
                    group.scale.setScalar(2);
                    group.traverse(o => { if (o.isMesh) o.raycast = () => {}; });
                    scene.add(group);
                    birdModel = group;
                } else {
                    birdModel.visible = true;
                }
            } else if (birdModel) {
                birdModel.visible = false;
            }
        });

    // ── Modelo peixe ─────────────────────────────────────────────────────────
    folder
        .add(debugState, 'showFish')
        .name('Modelo peixe')
        .onChange((value) => {
            if (value) {
                if (!fishModel) {
                    const group = createFishMesh();
                    group.position.set(-1, 0.2, 1.8);
                    group.scale.setScalar(4);
                    group.traverse(o => { if (o.isMesh || o.isLine) o.raycast = () => {}; });
                    scene.add(group);
                    fishModel = group;
                } else {
                    fishModel.visible = true;
                }
            } else if (fishModel) {
                fishModel.visible = false;
            }
        });
}

export { createDashboard };
