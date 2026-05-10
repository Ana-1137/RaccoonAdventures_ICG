import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { getAssetPath } from '../../config.js';

// Junto ao varal 3 (poleA: x:1.7, z:0.5), ligeiramente perto do rio
const POSITION = { x: 2.2, y: 0, z: 1.2 };
const WAVE_RADIUS    = 2.0;   // distância para acenar
const TALK_RADIUS    = 1.2;   // distância para interagir (tecla E)

const DIALOGUE = [
    "Olá! Bem-vindo ao acampamento! 🦊",
    "Já exploraste a floresta toda?",
    "Cuidado perto das cascatas!",
    "Até logo! 👋",
];

// ─── HUD de diálogo ──────────────────────────────────────────────────────────
let _dialogueBox = null;
function _getDialogueBox() {
    if (_dialogueBox) return _dialogueBox;
    _dialogueBox = document.createElement('div');
    _dialogueBox.style.cssText = `
        position:fixed; bottom:60px; left:50%; transform:translateX(-50%);
        background:rgba(0,0,0,0.75); color:#fff; font-family:sans-serif;
        font-size:1rem; padding:12px 20px; border-radius:8px;
        max-width:420px; text-align:center; pointer-events:none;
        display:none; border:1px solid rgba(255,255,255,0.2);
    `;
    document.body.appendChild(_dialogueBox);
    return _dialogueBox;
}

function _showDialogue(text) {
    const box = _getDialogueBox();
    box.textContent = text + '  [E]';
    box.style.display = 'block';
}

function _hideDialogue() {
    const box = _getDialogueBox();
    box.style.display = 'none';
}

// ─── Prompt de interação ─────────────────────────────────────────────────────
let _promptBox = null;
function _getPrompt() {
    if (_promptBox) return _promptBox;
    _promptBox = document.createElement('div');
    _promptBox.style.cssText = `
        position:fixed; bottom:110px; left:50%; transform:translateX(-50%);
        background:rgba(255,255,255,0.15); color:#fff; font-family:sans-serif;
        font-size:0.85rem; padding:6px 14px; border-radius:6px;
        pointer-events:none; display:none;
    `;
    _promptBox.textContent = 'Pressiona [E] para falar';
    document.body.appendChild(_promptBox);
    return _promptBox;
}

// ─── Fox ─────────────────────────────────────────────────────────────────────
export class Fox {
    constructor(scene) {
        this.scene  = scene;
        this.model  = null;
        this.mixer  = null;
        this.actions = {};
        this._state  = 'idle';       // idle | wave | talking
        this._dialogueIdx = 0;
        this._talking = false;

        this.modelLoaded = new Promise(r => this._load(r));

        // Tecla E para avançar diálogo
        this._onKey = (e) => {
            if (e.code !== 'KeyE') return;
            if (this._talking) {
                // Avançar diálogo
                this._dialogueIdx++;
                if (this._dialogueIdx >= DIALOGUE.length) {
                    this._talking = false;
                    this._dialogueIdx = 0;
                    _hideDialogue();
                    this._play('idle');
                } else {
                    _showDialogue(DIALOGUE[this._dialogueIdx]);
                }
            } else {
                this._pendingTalk = true;
            }
        };
        window.addEventListener('keydown', this._onKey);
    }

    _load(resolve) {
        const loader = new FBXLoader();
        loader.load(getAssetPath('elements/fox.fbx'), (fbx) => {
            this.model = fbx;
            this.model.scale.setScalar(0.1);
            this.model.position.set(POSITION.x, POSITION.y, POSITION.z);
            this.model.rotation.y = -Math.PI / 2; // virado para o acampamento

            this.model.traverse(c => {
                if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; c.raycast = () => {}; }
            });

            this.scene.add(this.model);
            this.mixer = new THREE.AnimationMixer(this.model);
            this._loadAnims(resolve);
        });
    }

    _loadAnims(resolve) {
        const loader = new FBXLoader();
        const base   = getAssetPath('animations') + '/';
        const files  = [
            { name: 'idle',    file: 'Dwarf Idle.fbx' },
            { name: 'wave',    file: 'Waving.fbx' },
            { name: 'talking', file: 'Talking.fbx' },
        ];
        let done = 0;
        for (const { name, file } of files) {
            loader.load(base + file, (fbx) => {
                const action = this.mixer.clipAction(fbx.animations[0]);
                action.loop = THREE.LoopRepeat;
                this.actions[name] = action;
                if (++done === files.length) {
                    this._play('idle');
                    resolve();
                }
            });
        }
    }

    _play(name) {
        if (this._state === name) return;
        const prev = this.actions[this._state];
        const next = this.actions[name];
        if (!next) return;
        if (prev) prev.fadeOut(0.3);
        next.reset().fadeIn(0.3).play();
        this._state = name;
    }

    _interact() {
        if (!this._talking) return;
        this._dialogueIdx++;
        if (this._dialogueIdx >= DIALOGUE.length) {
            // Fim do diálogo
            this._talking = false;
            this._dialogueIdx = 0;
            _hideDialogue();
            this._play('idle');
        } else {
            _showDialogue(DIALOGUE[this._dialogueIdx]);
        }
    }

    update(delta, playerPos) {
        if (!this.model || !this.mixer) return;
        this.mixer.update(delta);

        const dx = playerPos.x - POSITION.x;
        const dz = playerPos.z - POSITION.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (this._talking) {
            _getPrompt().style.display = 'none';
            return;
        }

        if (dist < TALK_RADIUS) {
            this._play('wave');
            _getPrompt().style.display = 'block';
            if (this._pendingTalk) {
                this._pendingTalk = false;
                this._talking = true;
                this._dialogueIdx = 0;
                _getPrompt().style.display = 'none';
                _showDialogue(DIALOGUE[0]);
                this._play('talking');
            }
        } else if (dist < WAVE_RADIUS) {
            _getPrompt().style.display = 'none';
            this._play('wave');
        } else {
            _getPrompt().style.display = 'none';
            this._play('idle');
        }
    }
}
