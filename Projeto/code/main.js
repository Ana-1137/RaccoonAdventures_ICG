import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createScene } from './world/scene.js';
import { createLights } from './world/lights.js';
import { Raccoon } from './entities/Raccoon.js';
import { ThirdPersonCamera } from './controls/ThirdPersonCamera.js';
import { keyStates } from './controls/KeyboardControls.js';
import { spawnForest, update as updateTrees } from './world/Trees.js';

// Elementos principais da cena
const scene = createScene();
createLights(scene);

// Câmara e Renderer
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 5, 10);

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
raccoon.modelLoaded.then(() => {
    // Spawnar floresta (passa o raccoon para LOD)
    spawnForest(scene, raccoon.model);
    
    const thirdPersonCamera = new ThirdPersonCamera(camera, raccoon.model, renderer.domElement, orbitControls);
    
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const delta = clock.getDelta();
        const isMoving = keyStates.w || keyStates.s || keyStates.a || keyStates.d;
        const isRunning = isMoving && keyStates.shift;

        // Atualizar a lógica do guaxinim (animações e movimento)
        raccoon.update(delta, keyStates);

        // Atualizar animação de vento das árvores (com LOD baseado na posição do raccoon)
        updateTrees(delta, raccoon.model.position);

        // Atualizar a câmara de terceira pessoa (agora passando isRunning para efeitos de velocidade)
        thirdPersonCamera.update(isMoving, orbitControls, isRunning);

        // Atualizar sempre os controlos de órbita para manter o estado interno sincronizado
        orbitControls.update();

        renderer.render(scene, camera);
    }

    animate();
});


// Chão
const planeGeometry = new THREE.PlaneGeometry(50, 50);
const planeMaterial = new THREE.MeshPhongMaterial({ color: 'rgb(50, 100, 50)', side: THREE.DoubleSide });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);

// Lidar com o redimensionamento da janela
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
