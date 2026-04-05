import * as THREE from 'three';

class ThirdPersonCamera {
    constructor(camera, target, domElement, orbitControls) {
        this.camera = camera;
        this.target = target;
        this.isInteracting = false;
        
        // Offset (Fase 6): Equilíbrio entre horizonte e personagem
        this.defaultOffsetDirection = new THREE.Vector3(0.25, 0.18, -0.65).normalize();
        this.lookAtOffset = new THREE.Vector3(0, 0.18, 0); 

        this.defaultDistance = 0.6; 
        this.lastTargetPosition = new THREE.Vector3();
        if (target) this.lastTargetPosition.copy(target.position);

        // Listeners manuais
        const startInteracting = () => {
            this.isInteracting = true;
            if (this.interactionTimeout) clearTimeout(this.interactionTimeout);
        };
        const stopInteracting = () => {
            if (this.interactionTimeout) clearTimeout(this.interactionTimeout);
            this.interactionTimeout = setTimeout(() => {
                this.isInteracting = false;
            }, 600);
        };

        // Escutar no elemento DOM e window
        domElement.addEventListener('mousedown', startInteracting);
        window.addEventListener('mouseup', stopInteracting);
        domElement.addEventListener('touchstart', startInteracting);
        window.addEventListener('touchend', stopInteracting);
        
        // Wheel zoom deve ser tratado como interação
        window.addEventListener('wheel', () => {
            startInteracting();
            stopInteracting();
        }, { passive: true });

        // Eventos do OrbitControls como backup
        orbitControls.addEventListener('start', startInteracting);
        orbitControls.addEventListener('end', stopInteracting);
    }

    update(isMoving, orbitControls) {
        if (!this.target) return;

        const targetPos = this.target.position.clone().add(this.lookAtOffset);
        
        // Sincronização direta de posição para evitar lag/desprendimento
        const deltaMove = this.target.position.clone().sub(this.lastTargetPosition);
        this.camera.position.add(deltaMove);
        this.lastTargetPosition.copy(this.target.position);

        // Alvo dos controlos sempre no guaxinim
        orbitControls.target.copy(targetPos);

        // LÓGICA DE RETORNO (Fase 6):
        // Só forçamos o regresso ao default se NÃO estivermos a interagir E estivermos a mover
        if (!this.isInteracting && isMoving) {
            const idealOffset = this.defaultOffsetDirection.clone().applyQuaternion(this.target.quaternion);
            const idealPosition = targetPos.clone().add(idealOffset.multiplyScalar(this.defaultDistance));

            // Retorno suave à posição default de ombro e zoom
            this.camera.position.lerp(idealPosition, 0.1);
            this.camera.lookAt(targetPos);
        } else if (!this.isInteracting) {
            // Se parado e sem interação, mantemos a posição onde o user deixou, mas focamos no alvo
            this.camera.lookAt(targetPos);
        }
        // Se isInteracting for true, main.js chamará orbitControls.update()
    }
}

export { ThirdPersonCamera };
