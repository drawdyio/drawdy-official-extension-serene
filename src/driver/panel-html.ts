export const PANEL_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style id="theme">:root{/*__DRAWDY_STYLING__*/}</style>
<style>
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 13px;
    line-height: 1.45;
    color: var(--drawdy-foreground, #111);
    background: var(--drawdy-background, #fff);
    background-image: radial-gradient(
        130% 70% at 50% -10%,
        color-mix(in oklab, var(--drawdy-primary, #6366f1) 16%, transparent),
        transparent 62%
    );
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
}
main {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 18px 18px 14px;
    display: flex;
    flex-direction: column;
    gap: 18px;
}
header {
    display: flex;
    align-items: center;
    gap: 8px;
}
.mark {
    width: 26px;
    height: 15px;
    fill: none;
    stroke: var(--drawdy-primary, #6366f1);
    stroke-width: 1.6;
    stroke-linecap: round;
    opacity: 0.9;
}
.brand {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
}
.chip {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    padding: 3px 8px;
    border-radius: 999px;
    color: var(--drawdy-muted-foreground, #888);
    border: 1px solid var(--drawdy-border, #e5e5e5);
}
.hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 6px 0 2px;
}
.dial {
    position: relative;
    width: 132px;
    height: 132px;
}
.dial::before {
    content: "";
    position: absolute;
    inset: 14px;
    border-radius: 999px;
    background: var(--drawdy-primary, #6366f1);
    opacity: 0;
    transition: opacity 0.4s ease;
}
body.playing .dial::before {
    opacity: 0.14;
    animation: breathe 3s ease-in-out infinite;
}
@keyframes breathe {
    0%, 100% { transform: scale(0.94); opacity: 0.08; }
    50% { transform: scale(1.05); opacity: 0.18; }
}
.ring {
    position: absolute;
    inset: 0;
    width: 132px;
    height: 132px;
    transform: rotate(-90deg);
}
.ring circle {
    fill: none;
    stroke-width: 5;
    stroke-linecap: round;
}
.ring-track {
    stroke: var(--drawdy-border, #e5e5e5);
}
.ring-fill {
    stroke: var(--drawdy-primary, #6366f1);
    stroke-dasharray: 339.292;
    stroke-dashoffset: 339.292;
    transition: stroke-dashoffset 0.09s linear;
}
#play {
    position: absolute;
    inset: 29px;
    display: grid;
    place-items: center;
    padding: 0;
    border: none;
    border-radius: 999px;
    cursor: pointer;
    color: var(--drawdy-primary-foreground, #fff);
    background: var(--drawdy-primary, #6366f1);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.18);
    transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}
#play svg { width: 26px; height: 26px; fill: currentColor; }
#play:hover:not(:disabled) { transform: scale(1.05); }
#play:active:not(:disabled) { transform: scale(0.97); }
#play:focus-visible { outline: 2px solid var(--drawdy-ring, #94ba00); outline-offset: 3px; }
#play:disabled { opacity: 0.3; cursor: default; box-shadow: none; }
.time {
    font-variant-numeric: tabular-nums;
    font-size: 12px;
    letter-spacing: 0.03em;
    color: var(--drawdy-muted-foreground, #888);
}
.time b { color: var(--drawdy-foreground, #111); font-weight: 600; }
.card {
    border: 1px solid var(--drawdy-border, #e5e5e5);
    border-radius: var(--drawdy-radius-lg, 14px);
    background: var(--drawdy-surface, #fafafa);
    padding: 4px 12px;
}
.row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
}
.row + .row { border-top: 1px solid var(--drawdy-border, #e5e5e5); }
.row label {
    width: 54px;
    flex: none;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--drawdy-muted-foreground, #888);
}
.row .val {
    width: 50px;
    flex: none;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    color: var(--drawdy-muted-foreground, #888);
}
select {
    flex: 1;
    min-width: 0;
    height: 30px;
    padding: 0 26px 0 9px;
    font: inherit;
    font-size: 12px;
    color: var(--drawdy-foreground, #111);
    background-color: var(--drawdy-background, #fff);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%23888' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 12px;
    border: 1px solid var(--drawdy-border, #e5e5e5);
    border-radius: var(--drawdy-radius-md, 9px);
    appearance: none;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s ease;
}
select:hover { border-color: var(--drawdy-primary, #6366f1); }
select:focus-visible { box-shadow: 0 0 0 2px var(--drawdy-ring, #94ba00); }
.rack {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    padding: 14px 4px 12px;
}
.knob {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 2px 0;
    border-radius: var(--drawdy-radius-md, 9px);
    cursor: ns-resize;
    outline: none;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
}
.knob:focus-visible { box-shadow: 0 0 0 2px var(--drawdy-ring, #94ba00); }
.knob svg { width: 50px; height: 50px; display: block; }
.k-track {
    fill: none;
    stroke: var(--drawdy-border, #e5e5e5);
    stroke-width: 4;
    stroke-linecap: round;
}
.k-fill {
    fill: none;
    stroke: var(--drawdy-primary, #6366f1);
    stroke-width: 4;
    stroke-linecap: round;
    stroke-dasharray: 84.823;
    stroke-dashoffset: 84.823;
}
.k-cap {
    fill: var(--drawdy-background, #fff);
    stroke: var(--drawdy-border, #e5e5e5);
    stroke-width: 1;
    transition: stroke 0.15s ease;
}
.k-tick {
    stroke: var(--drawdy-foreground, #111);
    stroke-width: 2.4;
    stroke-linecap: round;
}
.knob:hover .k-cap, .knob.live .k-cap { stroke: var(--drawdy-primary, #6366f1); }
.knob.live .k-tick { stroke: var(--drawdy-primary, #6366f1); }
.k-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--drawdy-muted-foreground, #888);
}
.k-value {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--drawdy-foreground, #111);
}
.status {
    font-size: 11px;
    line-height: 1.6;
    text-align: center;
    text-wrap: balance;
    color: var(--drawdy-muted-foreground, #888);
}
.status.hint { color: var(--drawdy-warning, #d97706); }
.status b { color: var(--drawdy-foreground, #111); font-weight: 600; }
</style>
</head>
<body>
<main>
    <header>
        <svg class="mark" viewBox="0 0 28 16" aria-hidden="true"><path d="M1 8c3.2-7.5 6.4-7.5 9.6 0s6.4 7.5 9.6 0 4.6-3.4 6.8 0"/></svg>
        <div class="brand">Serene</div>
        <div class="chip">C4&ndash;C7</div>
    </header>

    <div class="hero">
        <div class="dial">
            <svg class="ring" viewBox="0 0 132 132" aria-hidden="true">
                <circle class="ring-track" cx="66" cy="66" r="54"></circle>
                <circle class="ring-fill" id="ring" cx="66" cy="66" r="54"></circle>
            </svg>
            <button id="play" type="button" disabled aria-label="Play">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path id="play-icon" d="M9 5.5v13l10-6.5z"/></svg>
            </button>
        </div>
        <div class="time" id="time"><b>0.0</b> / 0.0s</div>
    </div>

    <section class="card">
        <div class="row">
            <label for="scale">Scale</label>
            <select id="scale"></select>
        </div>
    </section>

    <section class="card rack" id="rack"></section>

    <div class="status" id="status">Right-click anything on the board and pick <b>Serene play</b>.</div>
</main>
<script>
(function () {
    var api = acquireDrawdyApi();
    var themeStyle = document.getElementById("theme");
    var playBtn = document.getElementById("play");
    var playIcon = document.getElementById("play-icon");
    var ring = document.getElementById("ring");
    var timeEl = document.getElementById("time");
    var statusEl = document.getElementById("status");
    var scaleSelect = document.getElementById("scale");
    var rack = document.getElementById("rack");

    var ARC_LENGTH = 84.823;
    var ARC_PATH = "M11.27 36.73A18 18 0 1 1 36.73 36.73";
    var DRAG_PX = 170;
    var FINE = 4;
    var WHEEL_STEP = 0.03;
    var WHEEL_COMMIT_MS = 220;

    function asPercent(value) {
        return Math.round(value * 100) + "%";
    }

    var KNOB_SPECS = [
        {
            id: "speed",
            label: "Speed",
            min: 40,
            max: 900,
            step: 10,
            value: 220,
            format: function (v) { return String(Math.round(v)); },
        },
        {
            id: "volume",
            label: "Volume",
            min: 0,
            max: 1,
            step: 0.01,
            value: 0.7,
            format: asPercent,
        },
        {
            id: "glide",
            label: "Glide",
            min: 0,
            max: 1,
            step: 0.01,
            value: 0.3,
            format: asPercent,
        },
        {
            id: "reverb",
            label: "Reverb",
            min: 0,
            max: 1,
            step: 0.01,
            value: 0.38,
            format: asPercent,
        },
    ];

    function renderKnob(knob) {
        var spec = knob.spec;
        var value = Number(knob.input.value);
        var ratio = (value - spec.min) / (spec.max - spec.min);
        knob.fill.style.strokeDashoffset = String(ARC_LENGTH * (1 - ratio));
        knob.tick.setAttribute(
            "transform",
            "rotate(" + (225 + 270 * ratio).toFixed(2) + " 24 24)"
        );
        knob.valueEl.textContent = spec.format(value);
        knob.el.setAttribute("aria-valuenow", String(value));
        knob.el.setAttribute("aria-valuetext", spec.format(value));
    }

    function quantize(spec, raw) {
        var clamped = Math.max(spec.min, Math.min(spec.max, raw));
        var steps = Math.round((clamped - spec.min) / spec.step);
        return Number((spec.min + steps * spec.step).toFixed(6));
    }

    function applyKnob(knob, raw, commit, silent) {
        var next = quantize(knob.spec, raw);
        var changed = next !== Number(knob.input.value);
        if (changed) {
            knob.input.value = String(next);
            renderKnob(knob);
            if (!silent) knob.input.dispatchEvent(new Event("input"));
        }
        if (commit && !silent) knob.input.dispatchEvent(new Event("change"));
    }

    function nudgeKnob(knob, ratioDelta, commit) {
        var spec = knob.spec;
        applyKnob(
            knob,
            Number(knob.input.value) + ratioDelta * (spec.max - spec.min),
            commit,
            false
        );
    }

    function buildKnob(spec) {
        var input = document.createElement("input");
        input.type = "range";
        input.id = spec.id;
        input.min = String(spec.min);
        input.max = String(spec.max);
        input.step = String(spec.step);
        input.value = String(spec.value);
        input.hidden = true;

        var el = document.createElement("div");
        el.className = "knob";
        el.tabIndex = 0;
        el.setAttribute("role", "slider");
        el.setAttribute("aria-label", spec.label);
        el.setAttribute("aria-valuemin", String(spec.min));
        el.setAttribute("aria-valuemax", String(spec.max));
        el.innerHTML =
            '<svg viewBox="0 0 48 48" aria-hidden="true">' +
            '<path class="k-track" d="' + ARC_PATH + '"/>' +
            '<path class="k-fill" d="' + ARC_PATH + '"/>' +
            '<circle class="k-cap" cx="24" cy="24" r="12.5"/>' +
            '<line class="k-tick" x1="24" y1="16.4" x2="24" y2="11.6"/>' +
            "</svg>" +
            '<div class="k-label"></div>' +
            '<div class="k-value"></div>';

        var knob = {
            spec: spec,
            input: input,
            el: el,
            fill: el.querySelector(".k-fill"),
            tick: el.querySelector(".k-tick"),
            valueEl: el.querySelector(".k-value"),
            dragging: false,
            lastY: 0,
            wheelTimer: null,
        };
        el.querySelector(".k-label").textContent = spec.label;

        el.addEventListener("pointerdown", function (event) {
            event.preventDefault();
            el.setPointerCapture(event.pointerId);
            el.focus();
            knob.dragging = true;
            knob.lastY = event.clientY;
            el.classList.add("live");
        });
        el.addEventListener("pointermove", function (event) {
            if (!knob.dragging) return;
            var dy = knob.lastY - event.clientY;
            knob.lastY = event.clientY;
            nudgeKnob(knob, dy / (event.shiftKey ? DRAG_PX * FINE : DRAG_PX), false);
        });
        var release = function () {
            if (!knob.dragging) return;
            knob.dragging = false;
            el.classList.remove("live");
            knob.input.dispatchEvent(new Event("change"));
        };
        el.addEventListener("pointerup", release);
        el.addEventListener("pointercancel", release);
        el.addEventListener("dblclick", function () {
            applyKnob(knob, spec.value, true, false);
        });
        el.addEventListener(
            "wheel",
            function (event) {
                event.preventDefault();
                nudgeKnob(knob, event.deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP, false);
                clearTimeout(knob.wheelTimer);
                knob.wheelTimer = setTimeout(function () {
                    knob.input.dispatchEvent(new Event("change"));
                }, WHEEL_COMMIT_MS);
            },
            { passive: false }
        );
        el.addEventListener("keydown", function (event) {
            if (event.key === "Home") {
                event.preventDefault();
                applyKnob(knob, spec.min, true, false);
                return;
            }
            if (event.key === "End") {
                event.preventDefault();
                applyKnob(knob, spec.max, true, false);
                return;
            }
            var up = event.key === "ArrowUp" || event.key === "ArrowRight";
            var down = event.key === "ArrowDown" || event.key === "ArrowLeft";
            if (!up && !down) return;
            event.preventDefault();
            var amount = spec.step * (event.shiftKey ? 10 : 1);
            applyKnob(
                knob,
                Number(input.value) + (up ? amount : -amount),
                true,
                false
            );
        });

        rack.appendChild(el);
        rack.appendChild(input);
        renderKnob(knob);
        return knob;
    }

    var knobs = {};
    KNOB_SPECS.forEach(function (spec) {
        knobs[spec.id] = buildKnob(spec);
    });
    var speedInput = knobs.speed.input;
    var volumeInput = knobs.volume.input;
    var glideInput = knobs.glide.input;
    var reverbInput = knobs.reverb.input;

    var LOOKAHEAD = 0.25;
    var TAIL = 0.9;
    var PROGRESS_MS = 33;
    var DECAY = 0.22;
    var SUSTAIN_RATIO = 0.45;
    var RELEASE = 0.55;
    var PEAK_GAIN = 0.2;
    var MAX_GLIDE = 0.3;
    var LIMIT_THRESHOLD = -3;
    var LIMIT_RATIO = 20;
    var LIMIT_ATTACK = 0.002;
    var LIMIT_RELEASE = 0.18;
    var LIMIT_TRIM = 0.821;
    var RING_LENGTH = 339.292;
    var PLAY_PATH = "M9 5.5v13l10-6.5z";
    var STOP_PATH = "M7.5 7.5h9v9h-9z";

    var score = null;
    var audio = null;
    var playing = false;
    var startTime = 0;
    var cursor = 0;
    var voices = [];
    var pumpTimer = null;
    var progressTimer = null;
    var wantedPlay = false;
    var elapsed = 0;

    function audioUnlocked() {
        return Boolean(audio) && audio.ctx.state === "running";
    }

    function makeImpulse(ctx, seconds, decay) {
        var rate = ctx.sampleRate;
        var length = Math.max(1, Math.floor(rate * seconds));
        var buffer = ctx.createBuffer(2, length, rate);
        for (var channel = 0; channel < 2; channel++) {
            var data = buffer.getChannelData(channel);
            for (var i = 0; i < length; i++) {
                var fade = Math.pow(1 - i / length, decay);
                data[i] = (Math.random() * 2 - 1) * fade;
            }
        }
        return buffer;
    }

    function ensureAudio() {
        if (audio) return audio;
        var Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        var ctx = new Ctor();
        var master = ctx.createGain();
        master.gain.value = Number(volumeInput.value);
        master.connect(ctx.destination);
        var trim = ctx.createGain();
        trim.gain.value = LIMIT_TRIM;
        trim.connect(master);
        var limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = LIMIT_THRESHOLD;
        limiter.knee.value = 0;
        limiter.ratio.value = LIMIT_RATIO;
        limiter.attack.value = LIMIT_ATTACK;
        limiter.release.value = LIMIT_RELEASE;
        limiter.connect(trim);
        var mix = ctx.createGain();
        mix.connect(limiter);
        var dry = ctx.createGain();
        dry.gain.value = 0.85;
        dry.connect(mix);
        var send = ctx.createDelay(0.5);
        send.delayTime.value = 0.024;
        var tone = ctx.createBiquadFilter();
        tone.type = "lowpass";
        tone.frequency.value = 3200;
        var convolver = ctx.createConvolver();
        convolver.buffer = makeImpulse(ctx, 2.8, 2.6);
        var wet = ctx.createGain();
        wet.gain.value = Number(reverbInput.value);
        send.connect(tone);
        tone.connect(convolver);
        convolver.connect(wet);
        wet.connect(mix);
        audio = {
            ctx: ctx,
            master: master,
            trim: trim,
            limiter: limiter,
            mix: mix,
            dry: dry,
            send: send,
            wet: wet
        };
        return audio;
    }

    function resumeAudio() {
        var a = ensureAudio();
        if (!a) return Promise.resolve(false);
        if (a.ctx.state === "running") return Promise.resolve(true);
        return a.ctx.resume().then(
            function () { return a.ctx.state === "running"; },
            function () { return false; }
        );
    }

    function tilt(hz) {
        var v = Math.pow(440 / Math.max(110, hz), 0.35);
        return Math.max(0.5, Math.min(1.25, v));
    }

    function meanHz(pitches) {
        var total = 0;
        for (var i = 0; i < pitches.length; i++) total += pitches[i].hz;
        return total / pitches.length;
    }

    function schedulePitches(osc, at, pitches) {
        var glide = Number(glideInput.value);
        var prevTime = at;
        var prevHz = pitches[0].hz;
        osc.frequency.setValueAtTime(prevHz, at);
        for (var i = 1; i < pitches.length; i++) {
            var when = at + pitches[i].t;
            var span = Math.max(0, when - prevTime);
            var slide = Math.min(glide * span, MAX_GLIDE);
            if (slide > 0.004) {
                if (slide < span) {
                    osc.frequency.setValueAtTime(prevHz, when - slide);
                }
                osc.frequency.exponentialRampToValueAtTime(
                    pitches[i].hz,
                    when
                );
            } else {
                osc.frequency.setValueAtTime(pitches[i].hz, when);
            }
            prevTime = when;
            prevHz = pitches[i].hz;
        }
    }

    function playVoice(note) {
        var ctx = audio.ctx;
        var at = startTime + note.t;
        var peak = Math.max(
            0.0005,
            note.v * PEAK_GAIN * tilt(meanHz(note.pitches))
        );
        var sustain = Math.max(0.0004, peak * SUSTAIN_RATIO);
        var hold = Math.max(0.09, note.d);
        var osc = ctx.createOscillator();
        osc.type = "sine";
        schedulePitches(osc, at, note.pitches);
        var gain = ctx.createGain();
        gain.gain.setValueAtTime(peak, at);
        gain.gain.exponentialRampToValueAtTime(sustain, at + DECAY);
        gain.gain.setTargetAtTime(0.0001, at + hold, RELEASE / 3);
        osc.connect(gain);
        gain.connect(audio.dry);
        gain.connect(audio.send);
        osc.start(at);
        osc.stop(at + hold + RELEASE + 0.2);
        var voice = { osc: osc, gain: gain };
        voices.push(voice);
        osc.onended = function () {
            var index = voices.indexOf(voice);
            if (index >= 0) voices.splice(index, 1);
        };
    }

    function killVoices() {
        if (!audio) return;
        var now = audio.ctx.currentTime;
        for (var i = 0; i < voices.length; i++) {
            var voice = voices[i];
            try {
                voice.gain.gain.cancelScheduledValues(now);
                voice.gain.gain.setTargetAtTime(0.0001, now, 0.03);
                voice.osc.stop(now + 0.25);
            } catch (err) {
                void err;
            }
        }
    }

    function pump() {
        if (!playing || !score) return;
        var now = audio.ctx.currentTime;
        var horizon = now + LOOKAHEAD;
        while (
            cursor < score.voices.length &&
            startTime + score.voices[cursor].t < horizon
        ) {
            playVoice(score.voices[cursor]);
            cursor++;
        }
        if (now - startTime >= score.durationSec + TAIL) finish();
    }

    function tickProgress() {
        if (!playing || !score) return;
        elapsed = Math.max(
            0,
            Math.min(score.durationSec, audio.ctx.currentTime - startTime)
        );
        render();
        api.postMessage({ type: "progress", t: elapsed });
    }

    function start() {
        if (!score || score.voices.length === 0) return;
        resumeAudio().then(function (ok) {
            if (!ok) {
                setStatusText(
                    "Audio stays blocked until you click inside this panel.",
                    true
                );
                return;
            }
            stopTimers();
            killVoices();
            voices = [];
            elapsed = 0;
            cursor = 0;
            startTime = audio.ctx.currentTime + 0.12;
            setPlaying(true);
            api.postMessage({ type: "started" });
            pumpTimer = setInterval(pump, 25);
            progressTimer = setInterval(tickProgress, PROGRESS_MS);
            pump();
            render();
        });
    }

    function stopTimers() {
        if (pumpTimer) clearInterval(pumpTimer);
        if (progressTimer) clearInterval(progressTimer);
        pumpTimer = null;
        progressTimer = null;
    }

    function stop(reason) {
        if (!playing) return;
        stopTimers();
        killVoices();
        setPlaying(false);
        elapsed = 0;
        render();
        api.postMessage({ type: reason });
    }

    function finish() {
        stop("ended");
    }

    function setPlaying(next) {
        playing = next;
        document.body.classList.toggle("playing", next);
        playIcon.setAttribute("d", next ? STOP_PATH : PLAY_PATH);
        playBtn.setAttribute("aria-label", next ? "Stop" : "Play");
    }

    function render() {
        var total = score ? score.durationSec : 0;
        timeEl.innerHTML =
            "<b>" + elapsed.toFixed(1) + "</b> / " + total.toFixed(1) + "s";
        var progress = total > 0 ? Math.min(1, elapsed / total) : 0;
        ring.style.strokeDashoffset = String(RING_LENGTH * (1 - progress));
    }

    function setStatus(html, warn) {
        statusEl.innerHTML = html;
        statusEl.className = warn ? "status hint" : "status";
    }

    function setStatusText(text, warn) {
        statusEl.textContent = text;
        statusEl.className = warn ? "status hint" : "status";
    }

    function describe() {
        if (!score) return;
        if (score.voices.length === 0) {
            setStatusText("Nothing to play in that region.", true);
            return;
        }
        if (!audioUnlocked()) {
            setStatusText(
                "Press play once to let this panel make sound.",
                true
            );
            return;
        }
        setStatus(
            "<b>" +
                score.voices.length +
                "</b> legato voices from <b>" +
                score.elementCount +
                "</b> elements<br />" +
                score.scaleName +
                " &middot; " +
                Math.round(score.rectWidth) +
                "&#215;" +
                Math.round(score.rectHeight) +
                " px",
            false
        );
    }

    playBtn.addEventListener("click", function () {
        if (playing) {
            stop("stopped");
            return;
        }
        start();
    });

    speedInput.addEventListener("change", function () {
        wantedPlay = playing;
        if (playing) stop("stopped");
        api.postMessage({ type: "speed", value: Number(speedInput.value) });
    });

    volumeInput.addEventListener("input", function () {
        if (audio) audio.master.gain.value = Number(volumeInput.value);
    });

    reverbInput.addEventListener("input", function () {
        if (audio) audio.wet.gain.value = Number(reverbInput.value);
    });

    scaleSelect.addEventListener("change", function () {
        wantedPlay = playing;
        if (playing) stop("stopped");
        api.postMessage({ type: "scale", value: scaleSelect.value });
    });

    api.onMessage(function (msg) {
        if (!msg || typeof msg !== "object") return;
        if (msg.type === "theme") {
            themeStyle.textContent = ":root{" + msg.css + "}";
            return;
        }
        if (msg.type === "stop") {
            stop("stopped");
            return;
        }
        if (msg.type === "scales") {
            scaleSelect.textContent = "";
            msg.scales.forEach(function (scale) {
                var option = document.createElement("option");
                option.value = scale.id;
                option.textContent = scale.name;
                scaleSelect.appendChild(option);
            });
            scaleSelect.value = msg.current;
            return;
        }
        if (msg.type !== "score") return;
        if (playing) stop("stopped");
        score = msg.score;
        if (scaleSelect.options.length > 0) scaleSelect.value = score.scaleId;
        applyKnob(knobs.speed, score.pxPerSecond, false, true);
        elapsed = 0;
        playBtn.disabled = score.voices.length === 0;
        render();
        describe();
        if ((msg.autoplay || wantedPlay) && audioUnlocked()) {
            wantedPlay = false;
            start();
        }
        wantedPlay = false;
    });

    render();
    api.postMessage({ type: "ready" });
})();
</script>
</body>
</html>`;
