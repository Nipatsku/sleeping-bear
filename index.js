
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
        buffer.push({volume, t})
        buffer = buffer.filter(s => s.t > t - 5000)
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

const thresholds = [
    { volume: 80, level: 'chaos' },
    { volume: 60, level: 'noisy' },
    { volume: 40, level: 'slightly noisy' },
    { volume: 20, level: 'calm' },
    // ^ from 0 to x, = calm
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
    theme: lcjsThemes.flatThemeLight
})
    .setTitle('')
chart.forEachAxis(axis => axis.setTickStrategy(lcjs.AxisTickStrategies.Empty))
chart.axisY.setInterval({ start: 0, end: 100 }).setStrokeStyle(new lcjs.SolidLine({ thickness: 1, fillStyle: new lcjs.SolidFill({ color: lcjs.ColorRGBA(0,0,0) }) }))
thresholds.forEach(threshold => {
    chart.axisY.addCustomTick()
        .setValue(threshold.volume)
        .setTextFormatter(() => threshold.level)
})
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

listeners.push((info) => {
    if (!visible) return
    const { latest, smoothed, buffer } = info
    // console.log(`${volume} %`)
    // volumeMeter.style.width = `${Math.random() * 50}%`//`${volume}%`
    seriesRaw.clear().appendJSON(buffer, { x: 't', y: 'volume' })
    seriesSmoothed.appendSample({ x: performance.now(), y: smoothed })
})

let visible = true
document.getElementById('calibrate').onclick = () => {
    visible = !visible
    chart.engine.container.style.display = !visible ? 'none' : 'block'
}