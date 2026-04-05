const keyStates = {
    w: false, a: false, s: false, d: false, shift: false, space: false
};

document.addEventListener('keydown', (event) => {
    const key = event.key === ' ' ? 'space' : event.key.toLowerCase();
    if (keyStates[key] !== undefined) {
        keyStates[key] = true;
    }
});

document.addEventListener('keyup', (event) => {
    const key = event.key === ' ' ? 'space' : event.key.toLowerCase();
    if (keyStates[key] !== undefined) {
        keyStates[key] = false;
    }
});

export { keyStates };
