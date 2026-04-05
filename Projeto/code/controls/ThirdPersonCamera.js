import * as THREE from 'three';

class ThirdPersonCamera {
    constructor(camera, target, domElement) {
        this.camera = camera;
        this.target = target;
        this.isInteracting = false;
        
        // Offset para visão "The Last of Us" (ombro direito, acima da cabeça)
        this.defaultOffset = new THREE.Vector3(0.5, 0.6, -1.5);
        this.lookAtOffset = new THREE.Vector3(0, 0.5, 0);

        // Listeners para detetar interação manual
        domElement.addEventListener('mousedown', () => this.isInteracting = true);
        window.addEventListener('mouseup', () => this.isInteracting = false);
        domElement.addEventListener('touchstart', () => this.isInteracting = true);
        window.addEventListener('touchend', () => this.isInteracting = false);
    }

    update(isMoving, orbitControls) {
        if (!this.target) return;

        // Garantir que os OrbitControls estão sempre centrados no guaxinim
        const targetPos = this.target.position.clone().add(this.lookAtOffset);
        orbitControls.target.copy(targetPos);

        // Se não houver interação manual e estiver a mover (ou até parado, para posição inicial)
        // Lerp para a posição ideal
        if (!this.isInteracting) {
            const idealOffset = this.defaultOffset.clone().applyQuaternion(this.target.quaternion);
            const idealPosition = this.target.position.clone().add(idealOffset);

            // Se estiver parado, lerp mais devagar. Se estiver a mover, lerp mais rápido para alinhar atrás.
            const lerpFactor = isMoving ? 0.05 : 0.03;
            this.camera.position.lerp(idealPosition, lerpFactor);
            
            // Garantir que a câmara olha para o ponto correto
            this.camera.lookAt(targetPos);
        }
    }
}

export { ThirdPersonCamera };
