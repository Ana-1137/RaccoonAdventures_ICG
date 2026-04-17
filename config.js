// GitHub Pages configuration
// If deployed to a subdirectory, update this path
export const BASE_PATH = window.location.hostname === 'localhost' ? '' : '/RaccoonAdventures_ICG';

export function getAssetPath(relativePath) {
    const fullPath = `${BASE_PATH}/${relativePath}`;
    console.log(`getAssetPath("${relativePath}") => "${fullPath}"`);
    return fullPath;
}
