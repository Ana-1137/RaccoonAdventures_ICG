import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { createScene } from './world/scene.js';
import { createLights } from './world/lights.js';
import { createClimate } from './world/Climate.js';
import { buildWorld } from './world/World.js';
import { Raccoon } from './entities/Raccoon.js';
import { ThirdPersonCamera } from './controls/ThirdPersonCamera.js';
import { keyStates } from './controls/KeyboardControls.js';
import { update as updateTrees } from './world/Trees.js';
import { updateWater } from './entities/Water.js';


// Elementos principais da cena
const scene = createScene();
const { ambientLight, directionalLight } = createLights(scene);

// Sistema de Clima com Ciclo Dia/Noite
const climate = createClimate(scene, directionalLight, ambientLight);

// Câmara e Renderer
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 1.5, 2.5);  // Bem mais perto do raccoon

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
const canvasParent = document.getElementById('Tag3DScene');
const canvas = renderer.domElement;
canvasParent.appendChild(canvas);

// HACK: Esconder a tecla Shift dos OrbitControls para permitir rotação enquanto corre
// Os OrbitControls forçam o modo PAN quando o Shift está pressionado, o que bloqueia a rotação.
const proxyCanvas = new Proxy(canvas, {
    get(target, prop) {
        if (prop === 'addEventListener') {
            return (type, listener, options) => {
                const wrappedListener = (event) => {
                    if (event instanceof PointerEvent || event instanceof MouseEvent || event instanceof WheelEvent) {
                        // Criar um proxy do evento que mente sobre o estado da tecla Shift
                        const eventProxy = new Proxy(event, {
                            get(e, p) {
                                if (p === 'shiftKey') return false;
                                let v = e[p];
                                return typeof v === 'function' ? v.bind(e) : v;
                            }
                        });
                        return listener(eventProxy);
                    }
                    return listener(event);
                };
                return target.addEventListener(type, wrappedListener, options);
            };
        }
        let value = target[prop];
        return typeof value === 'function' ? value.bind(target) : value;
    }
});

// Controlo de órbita para debugging e interação (usando o proxy para ignorar Shift)
const orbitControls = new OrbitControls(camera, proxyCanvas);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.1;
orbitControls.enablePan = false;
orbitControls.minDistance = 0.2; 
orbitControls.maxDistance = 5.0; 
orbitControls.minPolarAngle = Math.PI / 10; 
orbitControls.maxPolarAngle = Math.PI / 1.5; 
orbitControls.target.set(0, 0, 0);

// Forçar rotação em todos os botões e desativar PAN
orbitControls.mouseButtons = {
    LEFT: 0,   // THREE.MOUSE.ROTATE
    MIDDLE: 1, // THREE.MOUSE.DOLLY
    RIGHT: 0   // THREE.MOUSE.ROTATE (Substituir PAN para evitar bloqueios)
};
orbitControls.enablePan = false; 

// Guaxinim e câmara de terceira pessoa
const raccoon = new Raccoon(scene);
// Passamos o modelo do guaxinim para a câmara depois de carregado
raccoon.modelLoaded.then(async () => {
    // Construir o mundo (carregar floresta, tenda, e outros elementos)
    const world = await buildWorld(scene, raccoon.model);
    
    const thirdPersonCamera = new ThirdPersonCamera(camera, raccoon.model, renderer.domElement, orbitControls);
    
    // ═════════════════════════════════════════════════════════════════════════
    // ─── CONFIGURAR LIL-GUI DASHBOARD PARA CONTROLO DO CLIMA ────────────────
    // ═════════════════════════════════════════════════════════════════════════
    
    const gui = new GUI({ title: '🌞 Climate Dashboard' });
    gui.domElement.style.position = 'fixed';
    gui.domElement.style.top = '10px';
    gui.domElement.style.right = '10px';
    gui.domElement.style.zIndex = '1000';
    
    // Pasta: Controlo de Tempo
    const timeFolder = gui.addFolder('⏰ Tempo');
    timeFolder.open();
    
    timeFolder
        .add(climate.settings.time, 'enabled')
        .name('Ativar Ciclo')
        .onChange((value) => climate.setTimeEnabled(value));
    
    timeFolder
        .add(climate.settings.time, 'hour', 0, 24, 0.1)
        .name('Hora do Dia')
        .onChange((value) => climate.setHour(value));
    
    timeFolder
        .add(climate.settings.time, 'speed', 0, 0.2, 0.01)
        .name('Velocidade');
    
    // Mostrar hora formatada (read-only)
    const timeDisplay = { time: climate.getTimeFormatted() };
    timeFolder
        .add(timeDisplay, 'time')
        .name('Hora Atual')
        .listen()
        .disable();
    
    // Pasta: Iluminação
    const lightingFolder = gui.addFolder('💡 Iluminação');
    
    lightingFolder
        .add(directionalLight, 'intensity', 0, 2, 0.1)
        .name('Intensidade Sol');
    
    lightingFolder
        .add(ambientLight, 'intensity', 0, 1, 0.1)
        .name('Luz Ambiente');
    
    // Atalhos para horas específicas (botões)
    const presetsFolder = gui.addFolder('⚙️ Presets');
    presetsFolder.open();
    
    const hoursPresets = {
        'Amanhecer (6h)': () => climate.setHour(6),
        'Manhã (9h)': () => climate.setHour(9),
        'Meio-dia (12h)': () => climate.setHour(12),
        'Tarde (15h)': () => climate.setHour(15),
        'Pôr do Sol (18h)': () => climate.setHour(18),
        'Noite (21h)': () => climate.setHour(21),
        'Meia-noite (0h)': () => climate.setHour(0),
    };
    
    Object.entries(hoursPresets).forEach(([label, fn]) => {
        presetsFolder.add({ preset: fn }, 'preset').name(label);
    });
    
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const delta = clock.getDelta();
        const isMoving = keyStates.w || keyStates.s || keyStates.a || keyStates.d;
        const isRunning = isMoving && keyStates.shift;

        // ─── Atualizar Sistema de Clima ───
        climate.update(delta);
        timeDisplay.time = climate.getTimeFormatted(); // Atualizar display de hora
        
        // Atualizar a lógica do guaxinim (animações e movimento)
        raccoon.update(delta, keyStates);

        // Atualizar animação de vento das árvores (com LOD baseado na posição do raccoon)
        updateTrees(delta, raccoon.model.position);

        // Atualizar a animação da água (ondas)
        if (world.basin) {
            updateWater(world.basin, delta);
        }

        // Atualizar a câmara de terceira pessoa (agora passando isRunning para efeitos de velocidade)
        thirdPersonCamera.update(isMoving, orbitControls, isRunning);

        // Atualizar sempre os controlos de órbita para manter o estado interno sincronizado
        orbitControls.update();

        renderer.render(scene, camera);
    }

    animate();
});

// Lidar com o redimensionamento da janela
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
