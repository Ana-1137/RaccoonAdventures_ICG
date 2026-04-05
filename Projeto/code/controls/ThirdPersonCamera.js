import * as THREE from 'three';

class ThirdPersonCamera {
    constructor(camera, target, domElement, orbitControls) {
        this.camera = camera;
        this.target = target;
        this.isInteracting = false;
        
        // Offset extremamente próximo e baixo (escala de guaxinim pequena)
        this.defaultOffsetDirection = new THREE.Vector3(0.25, 0.35, -0.7).normalize();
        this.lookAtOffset = new THREE.Vector3(0, 0.2, 0);

        // Distância inicial muito curta
        this.currentDistance = 0.8;
        this.lastTargetPosition = new THREE.Vector3();
        if (target) this.lastTargetPosition.copy(target.position);

        // Usar eventos do OrbitControls para maior precisão na interação
        orbitControls.addEventListener('start', () => {
            this.isInteracting = true;
        });
        orbitControls.addEventListener('end', () => {
            // Pequeno delay para garantir que o zoom terminou
            setTimeout(() => {
                this.isInteracting = false;
            }, 100);
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
        
        // Sincronização direta de posição para evitar "desprendimento"
        // Movemos a câmara a mesma distância que o personagem se moveu neste frame
        const deltaMove = this.target.position.clone().sub(this.lastTargetPosition);
        this.camera.position.add(deltaMove);
        this.lastTargetPosition.copy(this.target.position);

        // Atualizar o alvo dos controlos
        orbitControls.target.copy(targetPos);

        // Sempre atualizar a distância atual com base no zoom do utilizador
        if (this.isInteracting) {
            this.currentDistance = this.camera.position.distanceTo(targetPos);
        }

        // Regras de retorno:
        // 1. Se estiver a interagir (clicar ou zoom), NÃO forçamos posição
        // 2. Se NÃO estiver em movimento (idle), NÃO forçamos posição (mantemos onde o user deixou)
        // 3. Se ESTIVER em movimento e NÃO estiver a interagir, forçamos o regresso suave para trás (shoulder)
        
        if (isMoving && !this.isInteracting) {
            const idealOffset = this.defaultOffsetDirection.clone().applyQuaternion(this.target.quaternion);
            const idealPosition = targetPos.clone().add(idealOffset.multiplyScalar(this.currentDistance));

            // Lerp para suavizar o regresso enquanto corre
            this.camera.position.lerp(idealPosition, 0.08);
        }

        // Garantir que a câmara olha sempre para o ponto correto (cabeça do guaxinim)
        this.camera.lookAt(targetPos);
    }
}

export { ThirdPersonCamera };
