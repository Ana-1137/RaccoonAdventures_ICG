import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createScene } from './world/scene.js';
import { createLights } from './world/lights.js';
import { Raccoon } from './entities/Raccoon.js';
import { ThirdPersonCamera } from './controls/ThirdPersonCamera.js';
import { keyStates } from './controls/KeyboardControls.js';

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
canvasParent.appendChild(renderer.domElement);

// Controlo de órbita para debugging
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.1;
orbitControls.enablePan = false;
orbitControls.target.set(0, 0, 0);

// Guaxinim e câmara de terceira pessoa
const raccoon = new Raccoon(scene);
// Passamos o modelo do guaxinim para a câmara depois de carregado
raccoon.modelLoaded.then(() => {
    const thirdPersonCamera = new ThirdPersonCamera(camera, raccoon.model, renderer.domElement);
    
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const delta = clock.getDelta();
        const isMoving = keyStates.w || keyStates.s || keyStates.a || keyStates.d;

        // Atualizar a lógica do guaxinim (animações e movimento)
        raccoon.update(delta, keyStates);

        // Atualizar a câmara de terceira pessoa
        thirdPersonCamera.update(isMoving, orbitControls);

        // Atualizar os controlos de órbita apenas se houver interação manual
        if (thirdPersonCamera.isInteracting) {
            orbitControls.update();
        }

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
