// Inventário simples — tecla I abre/fecha
// Items: { id, name, icon (emoji), qty }

const _items = [];
let _open = false;

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
            <div>
                <div style="font-size:1rem;font-weight:bold;">${item.name}</div>
                <div style="font-size:.8rem;color:#aaa;">x${item.qty}</div>
            </div>
        </div>
    `).join('');
}

// ─── API ─────────────────────────────────────────────────────────────────────

/** Adiciona ou incrementa um item no inventário. */
export function addItem(id, name, icon) {
    const existing = _items.find(i => i.id === id);
    if (existing) { existing.qty++; }
    else { _items.push({ id, name, icon, qty: 1 }); }
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
