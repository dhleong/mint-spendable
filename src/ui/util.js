
function delay(durationMs) {
    return new Promise(resolve => {
        setTimeout(resolve, durationMs);
    });
}

function fmt$(amount) {
    return '$' + amount.toFixed(2);
}

module.exports = {
    fmt$,
    delay,
};
