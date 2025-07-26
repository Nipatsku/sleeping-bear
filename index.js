
const listeners = []
function processAudio(stream) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256; // small size for low-latency volume analysis
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    let buffer = []
    function getVolume() {
        analyser.getByteTimeDomainData(dataArray);
        // Calculate root mean square (RMS) volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            let sample = dataArray[i] / 128 - 1; // normalize between -1 and 1
            sum += sample * sample;
        }
        let rms = Math.sqrt(sum / dataArray.length);
        let volume = rms * 100; // scale to 0–100
        const t = performance.now()
        buffer.push({ volume, t })
        buffer = buffer.filter(s => s.t > t - 7500)
        const smoothed = buffer.reduce((prev, cur) => prev + cur.volume, 0) / buffer.length
        listeners.forEach(listener => listener({ latest: volume, smoothed, buffer }))
        // console.log('Volume Level:', volume.toFixed(2)); // or update UI
        requestAnimationFrame(getVolume); // keep running
    }
    getVolume();
}

navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        processAudio(stream);
    })
    .catch(err => {
        console.error('Microphone access denied:', err);
    });

let wakeLock = null;
let wakeLockRequested = false
async function requestWakeLock() {
    if (wakeLockRequested) return
    wakeLockRequested = true
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock is active');

            // Optional: re-acquire lock if it's released by the system
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock was released');
            });
        } else {
            console.warn('Wake Lock API not supported on this browser.');
        }
    } catch (err) {
        console.error(`Wake Lock error: ${err.name}, ${err.message}`);
    }
}

const thresholds = [
    { volume: 30, level: 'chaos' },
    { volume: 20, level: 'noisy' },
    { volume: 10, level: 'slightly noisy' },
    { volume: 0, level: 'calm' },
]

const lc = lcjs.lightningChart({
    license: "0002-n+cbHOx5FNw2JuPLwVSr1uls1gAuKwDmGyX4YxXGIjzi0Rnsc9MA+P51RNUUvfJ0Ogq9nCbEZs8T0xEOqb0QJy05-MEQCIHRrDkUJqPN3UZsl3OvT8MPHvCYXj7X8fZbwisfbfT8+AiAozDZyyRR0tkQXxa5jK/0oityPhI9qyrpld9/ADMs7lA==",
    licenseInformation: {
        appTitle: "LightningChart JS Trial",
        company: "LightningChart Ltd."
    },
})
const chart = lc.ChartXY({
    container: document.getElementById('chart'),
    animationsEnabled: false,
    theme: lcjsThemes.flatThemeLight,
    interactable: false,
    defaultAxisY: { opposite: true }
})
    .setTitle('')
const axis1 = chart.axisY
const axis2 = chart.addAxisY()
lcjs.synchronizeAxisIntervals(axis1, axis2)
axis2.setStrokeStyle(new lcjs.SolidLine({ thickness: 1, fillStyle: new lcjs.SolidFill({ color: lcjs.ColorRGBA(0, 0, 0) }) }))
    ;[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach(v => axis2.addCustomTick().setValue(v).setGridStrokeStyle(lcjs.emptyLine).setTextFormatter(_ => `${v}`))

chart.forEachAxis(axis => axis.setTickStrategy(lcjs.AxisTickStrategies.Empty))
axis1.setInterval({ start: 0, end: 50 })
axis1.setStrokeStyle(new lcjs.SolidLine({ thickness: 1, fillStyle: new lcjs.SolidFill({ color: lcjs.ColorRGBA(0, 0, 0) }) }))
const ticks = thresholds.map(threshold =>
    axis1.addCustomTick()
        .setValue(threshold.volume)
        .setTextFormatter(() => threshold.level)
)
chart.engine.container.style.width = '100vw'
chart.engine.container.style.height = '10rem'
chart.engine.container.style.position = 'fixed'
chart.engine.container.style.bottom = '1rem'
const seriesRaw = chart.addPointLineAreaSeries({ dataPattern: 'ProgressiveX' })
    .setAreaFillStyle(lcjs.emptyFill)
    .setStrokeStyle(new lcjs.SolidLine({ thickness: 1, fillStyle: new lcjs.SolidFill({ color: lcjs.ColorRGBA(0, 0, 0) }) }))
    .setPointFillStyle(lcjs.emptyFill)
const seriesSmoothed = chart.addPointLineAreaSeries({ dataPattern: 'ProgressiveX' })
    .setMaxSampleCount(10000)
    .setAutoScrollingEnabled(false)
    .setPointFillStyle(lcjs.emptyFill)

let prevLevel
listeners.push((info) => {
    if (!visible) return
    const { latest, smoothed, buffer } = info
    seriesRaw.clear().appendJSON(buffer, { x: 't', y: 'volume' })
    seriesSmoothed.appendSample({ x: performance.now(), y: smoothed })
    const level = thresholds.find(t => smoothed >= t.volume)
    if (level !== prevLevel) {
        console.log(level.level)
        const iLevel = thresholds.indexOf(level)
        ticks.forEach((tick, i) => tick.setMarker(marker => marker.setTextFont(font => font.setWeight(i === iLevel ? 'bold' : 'normal'))))
        prevLevel = level
    }
})

let visible = true
document.getElementById('calibrate').onclick = () => {
    visible = !visible
    chart.engine.container.style.opacity = !visible ? '0' : '1'
    document.getElementById('calibrate').style.opacity = !visible ? '0.3' : '1'
    requestWakeLock()
}