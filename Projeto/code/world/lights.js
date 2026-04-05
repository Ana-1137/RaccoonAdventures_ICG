import * as THREE from 'three';

function createLights(scene) {
    // Luz ambiente para iluminar toda a cena
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Luz direcional para simular o sol
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true; // Ativar sombras
    scene.add(directionalLight);

    // TODO: Adicionar luzes pontuais (fogueira) e focais (luzes de jardim)
}

export { createLights };
