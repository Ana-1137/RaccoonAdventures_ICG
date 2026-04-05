import * as THREE from 'three';

class ThirdPersonCamera {
    constructor(camera, target, domElement, orbitControls) {
        this.camera = camera;
        this.target = target;
        this.isInteracting = false;
        
        // Offset mais baixo e curto (visão ao nível do chão/guaxinim)
        // x: ombro, y: altura (mais baixo), z: profundidade
        this.defaultOffsetDirection = new THREE.Vector3(0.2, 0.15, -0.6).normalize();
        this.lookAtOffset = new THREE.Vector3(0, 0.18, 0); // Foco ligeiramente acima para apanhar o horizonte

        // Distância default fixa (não persiste mais o zoom)
        this.defaultDistance = 0.55; 
        this.lastTargetPosition = new THREE.Vector3();
        if (target) this.lastTargetPosition.copy(target.position);

        // Usar eventos do OrbitControls para interação
        orbitControls.addEventListener('start', () => {
            this.isInteracting = true;
        });
        orbitControls.addEventListener('end', () => {
            setTimeout(() => { this.isInteracting = false; }, 100);
        });

        // Capturar wheel para zoom
        domElement.addEventListener('wheel', () => {
            this.isInteracting = true;
            clearTimeout(this.wheelTimeout);
            this.wheelTimeout = setTimeout(() => {
                this.isInteracting = false;
            }, 500);
        }, { passive: true });
    }

    update(isMoving, orbitControls) {
        if (!this.target) return;

        const targetPos = this.target.position.clone().add(this.lookAtOffset);
        
        // Sincronização direta de posição
        const deltaMove = this.target.position.clone().sub(this.lastTargetPosition);
        this.camera.position.add(deltaMove);
        this.lastTargetPosition.copy(this.target.position);

        // Atualizar o alvo dos controlos sempre
        orbitControls.target.copy(targetPos);

        // Regras de retorno (Fase 4): 
        // Se NÃO estivermos a interagir, voltamos para a posição default e para o zoom default suavemente
        
        if (!this.isInteracting) {
            const idealOffset = this.defaultOffsetDirection.clone().applyQuaternion(this.target.quaternion);
            const idealPosition = targetPos.clone().add(idealOffset.multiplyScalar(this.defaultDistance));

            // Lerp para posição e zoom (mais rápido se estiver a mover)
            const lerpFactor = (isMoving || this.camera.position.distanceTo(idealPosition) > 1.0) ? 0.1 : 0.05;
            this.camera.position.lerp(idealPosition, lerpFactor);
            
            // Suavizar o foco
            this.camera.lookAt(targetPos);
        }
    }
}

export { ThirdPersonCamera };
