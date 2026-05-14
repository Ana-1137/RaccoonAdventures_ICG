import { getAssetPath } from '../config.js';

// Inventário simples — tecla I ou botão abre/fecha
// Items: { id, name, icon (emoji), qty }

const _items = [];
let _open = false;

// ─── Botão de inventário (canto superior esquerdo) ───────────────────────────
const _btn = document.createElement('img');
_btn.src = getAssetPath('elements/inventory.png');
_btn.style.cssText = `
    position:fixed; top:12px; left:12px; width:48px; height:48px;
    cursor:pointer; z-index:1500; border-radius:8px;
    filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));
    transition:transform .15s;
`;
_btn.title = 'Inventário [I]';
_btn.addEventListener('mouseenter', () => { _btn.style.transform = 'scale(1.1)'; });
_btn.addEventListener('mouseleave', () => { _btn.style.transform = 'scale(1)'; });
_btn.addEventListener('click', toggleInventory);
document.body.appendChild(_btn);

// ─── UI ──────────────────────────────────────────────────────────────────────
const _overlay = document.createElement('div');
_overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.6);
    display:none; align-items:center; justify-content:center; z-index:2000;
`;

const _panel = document.createElement('div');
_panel.style.cssText = `
    background:#1a1a1a; border:1px solid rgba(255,255,255,0.15);
    border-radius:12px; padding:24px 32px; min-width:320px; max-width:480px;
    color:#fff; font-family:sans-serif;
`;
_panel.innerHTML = `<h2 style="margin:0 0 16px;font-size:1.2rem;letter-spacing:.05em;">🎒 Inventário</h2><div id="inv-grid"></div><p style="margin:16px 0 0;font-size:.75rem;color:#888;text-align:right;">[I] para fechar</p>`;
_overlay.appendChild(_panel);
document.body.appendChild(_overlay);

const _grid = _panel.querySelector('#inv-grid');

function _render() {
    if (_items.length === 0) {
        _grid.innerHTML = '<p style="color:#666;font-size:.9rem;">Nenhum item ainda.</p>';
        return;
    }
    _grid.innerHTML = _items.map(item => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
            <span style="font-size:2rem;">${item.icon}</span>
            <div style="flex:1;">
                <div style="font-size:1rem;font-weight:bold;">${item.name}</div>
                <div style="font-size:.8rem;color:#aaa;line-height:1.2;">
                    ${item.description ? item.description : 'x' + item.qty}
                </div>
            </div>
        </div>
    `).join('');
}

// ─── API ─────────────────────────────────────────────────────────────────────

/** Adiciona ou incrementa um item no inventário. */
export function addItem(id, name, icon, description = null) {
    const existing = _items.find(i => i.id === id);
    if (existing) {
        existing.qty++;
        if (description) existing.description = description;
    } else {
        _items.push({ id, name, icon, qty: 1, description });
    }
    if (_open) _render();
}

export function toggleInventory() {
    _open = !_open;
    if (_open) { _render(); _overlay.style.display = 'flex'; }
    else { _overlay.style.display = 'none'; }
}

export function isInventoryOpen() { return _open; }

// Tecla I
window.addEventListener('keydown', e => {
    if (e.code === 'KeyI') toggleInventory();
});
// Click fora do painel fecha
_overlay.addEventListener('click', e => { if (e.target === _overlay) toggleInventory(); });
