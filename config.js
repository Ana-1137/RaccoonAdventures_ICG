// GitHub Pages configuration
// Se o domínio for localhost ou 127.0.0.1 (Live Server), sem prefixo.
// Em GitHub Pages o hostname é o domínio do repositório, por isso usa o subdiretório.
const IS_LOCAL = window.location.hostname === 'localhost'
              || window.location.hostname === '127.0.0.1'
              || window.location.protocol === 'file:';

export const BASE_PATH = IS_LOCAL ? '' : '/RaccoonAdventures_ICG';

export function getAssetPath(relativePath) {
    return `${BASE_PATH}/${relativePath}`;
}
