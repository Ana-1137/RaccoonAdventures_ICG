import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createScene }        from './world/scene.js';
import { createLights }       from './lights/SceneLights.js';
import { createClimate }      from './world/Climate.js';
import { buildWorld }         from './world/World.js';
import { Raccoon }            from './entities/player/Raccoon.js';
import { ThirdPersonCamera }  from './controls/ThirdPersonCamera.js';
import { keyStates }          from './controls/KeyboardControls.js';
import { createTouchControls } from './controls/TouchControls.js';
import { update as updateForest } from './entities/environment/Forest.js';
import { updateWater }        from './entities/environment/Water.js';
import { updateFish }         from './entities/environment/Fish.js';
import { updateFireflies }    from './entities/environment/Fireflies.js';
import { updateFlowers, getFlowerCount, getNearestFlowerProximity } from './entities/environment/Flowers.js';
import { createCampfireLight } from './lights/CampfireLight.js';
import { createStructureLights } from './lights/StructureLights.js';
import { createDashboard }    from './ui/Dashboard.js';
import { createRain, updateRain, getRainIntensity } from './world/Rain.js';
import { initSounds, updateAmbient, updateShine } from './world/SoundManager.js';

// ─── LOADING SCREEN ──────────────────────────────────────────────────────────
const _loadingScreen = document.getElementById('loading-screen');
const _loadingBar    = document.getElementById('loading-bar');
const _loadingMsg    = document.getElementById('loading-msg');

function setProgress(pct, msg) {
    _loadingBar.style.width = `${pct}%`;
    if (msg) _loadingMsg.textContent = msg;
}

function hideLoading() {
    _loadingScreen.classList.add('hidden');
    setTimeout(() => { _loadingScreen.style.display = 'none'; }, 700);
}

// ─── CENA, LUZES E CLIMA ─────────────────────────────────────────────────────
const scene = createScene();
const { ambientLight, directionalLight } = createLights(scene);
const climate = createClimate(scene, directionalLight, ambientLight);

// ─── CÂMARA ──────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 1.5, 2.5);

// ─── RENDERER ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.getElementById('Tag3DScene').appendChild(renderer.domElement);

// Controlos tácteis (só activos em dispositivos touch)
createTouchControls(keyStates);

// ─── ORBIT CONTROLS ──────────────────────────────────────────────────────────
// HACK: proxy que ignora Shift nos eventos de rato para não bloquear rotação
const orbitControls = new OrbitControls(camera, _createShiftIgnoringProxy(renderer.domElement));
orbitControls.enableDamping  = true;
orbitControls.dampingFactor  = 0.1;
orbitControls.enablePan      = false;
orbitControls.minDistance    = 0.2;
orbitControls.maxDistance    = 5.0;
orbitControls.minPolarAngle  = Math.PI / 10;
orbitControls.maxPolarAngle  = Math.PI / 1.5;
orbitControls.target.set(0, 0, 0);
orbitControls.mouseButtons   = { LEFT: 0, MIDDLE: 1, RIGHT: 0 };

// ─── CHUVA ───────────────────────────────────────────────────────────────────
createRain(scene);

// ─── ÁUDIO — inicia após primeira interação (política do browser) ─────────────
const _startAudio = () => { initSounds(); window.removeEventListener('pointerdown', _startAudio); window.removeEventListener('keydown', _startAudio); };
window.addEventListener('pointerdown', _startAudio);
window.addEventListener('keydown', _startAudio);

// ─── CONTADOR DE FLORES (HUD) ────────────────────────────────────────────────
const _flowerHUD = document.createElement('div');
_flowerHUD.style.cssText = 'position:fixed;bottom:16px;left:16px;color:#fff;font-family:sans-serif;font-size:1rem;text-shadow:0 1px 3px #000;pointer-events:none;';
_flowerHUD.textContent = '🌸 0 / 0';
document.body.appendChild(_flowerHUD);

// ─── GUAXINIM ────────────────────────────────────────────────────────────────
const raccoon = new Raccoon(scene);

raccoon.modelLoaded.then(async () => {
    setProgress(5, 'Guaxinim carregado...');
    const world = await buildWorld(scene, raccoon.model, setProgress);
    hideLoading();

    const { total } = getFlowerCount();
    _flowerHUD.textContent = `🌸 0 / ${total}`;

    const thirdPersonCamera = new ThirdPersonCamera(camera, raccoon.model, renderer.domElement, orbitControls);
    const campfire      = createCampfireLight(scene);
    const structureLights = createStructureLights(scene);
    const dashboard     = createDashboard(climate, campfire, structureLights, scene);
    const fpsDisplay    = dashboard._fpsDisplay;

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const delta    = clock.getDelta();
        const isMoving = keyStates.w || keyStates.s || keyStates.a || keyStates.d;
        const isRunning = isMoving && keyStates.shift;

        fpsDisplay.fps = (1 / delta).toFixed(1);

        climate.update(delta);
        climate._guiTimeDisplay.time = climate.getTimeFormatted();

        // Luzes estruturais: acendem à noite, apagam de dia (se enabled no dashboard)
        if (structureLights.settings.enabled) {
            const on = structureLights.settings.alwaysOn || climate.isNight();
            for (const light of structureLights.lights) light.visible = on;
        } else {
            for (const light of structureLights.lights) light.visible = false;
        }

        // Passar posição do raccoon para LOD de distância das partículas
        campfire.update(raccoon.model.position, delta);

        raccoon.update(delta, keyStates);
        updateForest(delta, raccoon.model.position);

        if (world.basin) updateWater(world.basin, delta);
        updateFish(delta);
        updateFireflies(delta, climate.getHour());

        // Chuva — centrada na câmara
        updateRain(delta, camera.position);

        // Flores — coleta por proximidade
        const collected = updateFlowers(raccoon.model.position, delta);
        const { total } = getFlowerCount();
        _flowerHUD.textContent = `🌸 ${collected} / ${total}`;

        // Áudio
        updateAmbient(climate.getHour(), getRainIntensity());
        updateShine(getNearestFlowerProximity(raccoon.model.position));

        thirdPersonCamera.update(isMoving, orbitControls, isRunning);
        orbitControls.update();
        renderer.render(scene, camera);
    }

    animate();
});

// ─── RESIZE ──────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── UTILITÁRIOS ─────────────────────────────────────────────────────────────

/**
 * Proxy do canvas que reporta shiftKey=false em eventos de rato.
 * Impede que os OrbitControls entrem em modo PAN quando Shift está pressionado.
 * @param {HTMLCanvasElement} canvas
 * @returns {Proxy}
 */
function _createShiftIgnoringProxy(canvas) {
    return new Proxy(canvas, {
        get(target, prop) {
            if (prop === 'addEventListener') {
                return (type, listener, options) => {
                    const wrapped = (event) => {
                        const isMouseLike = event instanceof PointerEvent
                                         || event instanceof MouseEvent
                                         || event instanceof WheelEvent;
                        if (isMouseLike) {
                            return listener(new Proxy(event, {
                                get(e, p) {
                                    if (p === 'shiftKey') return false;
                                    const v = e[p];
                                    return typeof v === 'function' ? v.bind(e) : v;
                                },
                            }));
                        }
                        return listener(event);
                    };
                    return target.addEventListener(type, wrapped, options);
                };
            }
            const value = target[prop];
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
}
