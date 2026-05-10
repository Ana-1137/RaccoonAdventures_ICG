import * as THREE from 'three';
import { loadGLTF, cloneScene } from '../../core/AssetCache.js';
import { getAssetPath } from '../../config.js';

// Posição relativa à cabeça (ajustar se necessário)
const HEAD_OFFSET = new THREE.Vector3(0, 0.18, 0);
const FLOWER_SCALE = 0.015;

// Animação de recompensa: flor sobe do chão até à cabeça
const ANIM_DURATION = 2.0; // segundos

let _rewardFlower = null;   // mesh da flor cosmética
let _headBone     = null;   // osso mixamorig:Head do raccoon
let _animating    = false;
let _animTime     = 0;
let _startPos     = null;
let _onDone       = null;

/**
 * Inicia a sequência de recompensa.
 * @param {THREE.Scene}  scene
 * @param {THREE.Object3D} raccoonModel
 * @param {Function}     playUnlockSound  — callback para tocar unlock.mp3
 * @param {Function}     [onDone]
 */
export async function startReward(scene, raccoonModel, playUnlockSound, onDone = null) {
    _onDone = onDone;

    // Encontrar osso da cabeça
    raccoonModel.traverse(c => {
        if (c.isBone && c.name === 'mixamorig:Head') _headBone = c;
    });

    // Carregar flor (já em cache se as flores do mundo foram carregadas)
    const gltf = await loadGLTF(getAssetPath('elements/Flower.glb'));
    _rewardFlower = cloneScene(gltf);
    _rewardFlower.scale.setScalar(FLOWER_SCALE);
    _rewardFlower.traverse(o => { if (o.isMesh) o.raycast = () => {}; });

    // Posição inicial: à frente do raccoon, no chão
    const rp = raccoonModel.position;
    _startPos = new THREE.Vector3(rp.x, rp.y + 0.1, rp.z - 0.3);
    _rewardFlower.position.copy(_startPos);
    scene.add(_rewardFlower);

    // Tocar som
    playUnlockSound();

    _animating = true;
    _animTime  = 0;
}

/**
 * Atualizar a cada frame enquanto a animação decorre.
 * Depois fixa a flor à cabeça do raccoon.
 * @param {number} delta
 */
export function updateReward(delta) {
    if (!_rewardFlower) return;

    if (_animating) {
        _animTime += delta;
        const t = Math.min(_animTime / ANIM_DURATION, 1);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut

        if (_headBone) {
            // Interpolar da posição inicial até à cabeça
            const worldHead = new THREE.Vector3();
            _headBone.getWorldPosition(worldHead);
            worldHead.add(HEAD_OFFSET);
            _rewardFlower.position.lerpVectors(_startPos, worldHead, ease);
            // Rodar suavemente
            _rewardFlower.rotation.y += delta * 3;
        }

        if (t >= 1) {
            _animating = false;
            if (_onDone) { _onDone(); _onDone = null; }
        }
        return;
    }

    // Após animação: seguir a cabeça do raccoon
    if (_headBone) {
        const worldHead = new THREE.Vector3();
        _headBone.getWorldPosition(worldHead);
        worldHead.add(HEAD_OFFSET);
        _rewardFlower.position.copy(worldHead);

        // Manter orientação upright independente da rotação do raccoon
        const worldQuat = new THREE.Quaternion();
        _headBone.getWorldQuaternion(worldQuat);
        _rewardFlower.quaternion.copy(worldQuat);
        _rewardFlower.rotateX(-Math.PI / 2); // compensar rotação do GLB
    }
}

export function isRewardActive() { return _rewardFlower !== null; }
