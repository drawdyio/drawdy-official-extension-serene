'use strict';

function stamp(ctx) {
    return { driverId: ctx.driverId, requestId: ctx.nextRequestId() };
}
function unwrap(response) {
    const { error, value } = response.res;
    if (error !== undefined) {
        throw new Error(`${error.type}${error.message ? `: ${error.message}` : ""}`);
    }
    return value;
}

const playMenuId = (driverId) => `${driverId}:play`;
const stopMenuId = (driverId) => `${driverId}:stop`;
async function registerMenus(ctx) {
    const menus = [
        { menuId: playMenuId(ctx.driverId), menuTitle: "Serene play" },
        { menuId: stopMenuId(ctx.driverId), menuTitle: "Serene stop" },
    ];
    for (const menu of menus) {
        unwrap(await ctx.issueCommand({
            type: "command:context-menu:add",
            ...stamp(ctx),
            req: menu,
        }));
        unwrap(await ctx.issueCommand({
            type: "subscription:context-menu:clicked",
            ...stamp(ctx),
            req: { menuId: menu.menuId },
        }));
    }
}

const SCALES = [
    {
        id: "major-pentatonic",
        name: "C major pentatonic",
        steps: [0, 2, 4, 7, 9],
    },
    { id: "major", name: "C major", steps: [0, 2, 4, 5, 7, 9, 11] },
    { id: "dorian", name: "C dorian", steps: [0, 2, 3, 5, 7, 9, 10] },
    { id: "lydian", name: "C lydian", steps: [0, 2, 4, 6, 7, 9, 11] },
    { id: "mixolydian", name: "C mixolydian", steps: [0, 2, 4, 5, 7, 9, 10] },
    { id: "japanese", name: "Japanese hirajoshi", steps: [0, 2, 3, 7, 8] },
];
const DEFAULT_SCALE_ID = "major-pentatonic";
const BOTTOM_MIDI = 60;
const OCTAVES = 3;
function getScale(id) {
    return (SCALES.find((scale) => scale.id === id) ??
        SCALES.find((scale) => scale.id === DEFAULT_SCALE_ID));
}
function scaleRows(scale) {
    return scale.steps.length * OCTAVES + 1;
}
function rowToMidi(scale, row) {
    const rows = scaleRows(scale);
    const clamped = Math.max(0, Math.min(rows - 1, Math.round(row)));
    const octave = Math.floor(clamped / scale.steps.length);
    const step = scale.steps[clamped % scale.steps.length];
    return BOTTOM_MIDI + octave * 12 + step;
}
function midiToHz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}
function rowToHz(scale, row) {
    return midiToHz(rowToMidi(scale, row));
}
function yToRow(scale, y, top, height) {
    if (height <= 0)
        return 0;
    const rows = scaleRows(scale);
    const fromBottom = 1 - (y - top) / height;
    return Math.max(0, Math.min(rows - 1, Math.floor(fromBottom * rows)));
}

const PANEL_HTML = `<!doctype html>
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

// Mozart portrait (assets/serene-icon-256.webp, 128px) embedded so the rail icon ships inside main.js.
const ACTION_BUTTON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><clipPath id="drawdy-serene-rail-clip"><rect width="24" height="24" rx="5"/></clipPath><image href="data:image/webp;base64,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" x="0" y="0" width="24" height="24" clip-path="url(#drawdy-serene-rail-clip)"/></svg>`;
const actionButtonId = (driverId) => `${driverId}:action-button`;
const panelWebviewId = (driverId) => `${driverId}:webview`;
function stylingCssVars(styling) {
    return Object.entries(styling)
        .map(([key, value]) => key === "theme"
        ? `color-scheme: ${value};`
        : `--drawdy-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${value};`)
        .join("");
}
const serializeVoice = (score) => (voice) => ({
    t: voice.startSec,
    d: voice.durationSec,
    v: voice.velocity,
    pitches: voice.pitches.map((pitch) => ({
        t: pitch.t,
        hz: rowToHz(score.scale, pitch.row),
        row: pitch.row,
    })),
});
function serializeScore(score, elementCount) {
    return {
        durationSec: score.durationSec,
        pxPerSecond: score.pxPerSecond,
        rectWidth: score.rect.width,
        rectHeight: score.rect.height,
        elementCount,
        scaleId: score.scale.id,
        scaleName: score.scale.name,
        voices: score.voices.map(serializeVoice(score)),
    };
}
async function openPanel(ctx, styling) {
    await ctx.issueCommand({
        type: "command:webview:create",
        ...stamp(ctx),
        req: {
            webviewDomId: panelWebviewId(ctx.driverId),
            htmlContent: PANEL_HTML.replace("/*__DRAWDY_STYLING__*/", stylingCssVars(styling)),
            keepStateWhenClosed: true,
        },
    });
}
const scaleOptions = () => SCALES.map((scale) => ({ id: scale.id, name: scale.name }));
function postToPanel(ctx, message) {
    void ctx.issueCommand({
        type: "command:webview:post-message",
        ...stamp(ctx),
        req: { webviewDomId: panelWebviewId(ctx.driverId), message },
    });
}

const PLAYHEAD_WIDTH = 2;
const REGION_SEED = 7;
const LINE_SEED = 11;
class Playhead {
    _ctx;
    _styling;
    _previewId = null;
    _rect = null;
    _inFlight = false;
    _pendingX = null;
    constructor(_ctx, _styling) {
        this._ctx = _ctx;
        this._styling = _styling;
    }
    setStyling(styling) {
        this._styling = styling;
    }
    get _lineId() {
        return `${this._ctx.driverId}:playhead-line`;
    }
    get _regionId() {
        return `${this._ctx.driverId}:playhead-region`;
    }
    _lineSchema(rect, x) {
        return {
            type: "line",
            drawdyElementId: this._lineId,
            color: this._styling.primary,
            strokeWidth: PLAYHEAD_WIDTH,
            roughness: 0,
            seed: LINE_SEED,
            from: [x, rect.y],
            to: [x, rect.y + rect.height],
        };
    }
    _regionSchema(rect) {
        return {
            type: "shape",
            drawdyElementId: this._regionId,
            componentType: "rect",
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            strokeColor: this._styling.border,
            fillColor: "transparent",
            strokeWidth: 1,
            strokeDash: "dashed",
            cornerRadius: 0,
            roughness: 0,
            seed: REGION_SEED,
            opacity: 0.7,
        };
    }
    async show(rect) {
        await this.hide();
        const { previewId } = unwrap(await this._ctx.issueCommand({
            type: "command:scene:create-drawdy-preview-elements",
            ...stamp(this._ctx),
            req: {
                elements: [
                    this._regionSchema(rect),
                    this._lineSchema(rect, rect.x),
                ],
            },
        }));
        this._previewId = previewId;
        this._rect = rect;
    }
    move(x) {
        if (!this._previewId || !this._rect)
            return;
        this._pendingX = x;
        if (this._inFlight)
            return;
        void this._flush();
    }
    async _flush() {
        const rect = this._rect;
        if (!rect || this._pendingX === null)
            return;
        const x = this._pendingX;
        this._pendingX = null;
        this._inFlight = true;
        try {
            await this._ctx.issueCommand({
                type: "command:scene:update-drawdy-preview-elements",
                ...stamp(this._ctx),
                req: { elements: [this._lineSchema(rect, x)] },
            });
        }
        finally {
            this._inFlight = false;
        }
        if (this._pendingX !== null)
            await this._flush();
    }
    async hide() {
        this._pendingX = null;
        this._rect = null;
        const previewId = this._previewId;
        this._previewId = null;
        if (!previewId)
            return;
        await this._ctx.issueCommand({
            type: "command:scene:delete-drawdy-preview-elements",
            ...stamp(this._ctx),
            req: { previewIds: [previewId] },
        });
    }
}

function rotatePoint(p, cx, cy, angle) {
    if (angle === 0)
        return [p[0], p[1]];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}
function rotatePolyline(points, cx, cy, angle) {
    if (angle === 0)
        return points;
    return points.map((p) => rotatePoint(p, cx, cy, angle));
}
function combineRects(rects) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const r of rects) {
        if (r.width < 0 || r.height < 0)
            continue;
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.width);
        maxY = Math.max(maxY, r.y + r.height);
    }
    if (!isFinite(minX))
        return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
function rectContainsPoint(rect, x, y) {
    return (x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height);
}
function rectArea(rect) {
    return Math.max(0, rect.width) * Math.max(0, rect.height);
}
function monotonicRuns(line) {
    if (line.length < 2)
        return [];
    const runs = [];
    let current = [line[0]];
    let direction = 0;
    for (let i = 1; i < line.length; i++) {
        const dx = line[i][0] - line[i - 1][0];
        const sign = dx > 0 ? 1 : dx < 0 ? -1 : 0;
        if (sign !== 0 && direction !== 0 && sign !== direction) {
            runs.push(current);
            current = [line[i - 1]];
            direction = sign;
        }
        else if (direction === 0) {
            direction = sign;
        }
        current.push(line[i]);
    }
    runs.push(current);
    return runs
        .filter((run) => run.length >= 2)
        .map((run) => run[run.length - 1][0] < run[0][0] ? [...run].reverse() : run);
}
function evenPick(items, keep) {
    if (items.length <= keep)
        return items;
    if (keep <= 1)
        return [items[0]];
    const out = [];
    for (let i = 0; i < keep; i++) {
        out.push(items[Math.round((i * (items.length - 1)) / (keep - 1))]);
    }
    return out;
}

const ELLIPSE_SEGMENTS = 48;
const STROKE_COMPONENT_TYPES = new Set(["line", "arrow"]);
function elementBounds(el) {
    const { x, y, width, height } = el;
    if (x == null || y == null || width == null || height == null)
        return null;
    return { x, y, width, height };
}
function closed(points) {
    if (points.length < 2)
        return points;
    const first = points[0];
    const last = points[points.length - 1];
    if (first[0] === last[0] && first[1] === last[1])
        return points;
    return [...points, [first[0], first[1]]];
}
function rectOutline(r) {
    return closed([
        [r.x, r.y],
        [r.x + r.width, r.y],
        [r.x + r.width, r.y + r.height],
        [r.x, r.y + r.height],
    ]);
}
function diamondOutline(r) {
    return closed([
        [r.x + r.width / 2, r.y],
        [r.x + r.width, r.y + r.height / 2],
        [r.x + r.width / 2, r.y + r.height],
        [r.x, r.y + r.height / 2],
    ]);
}
function ellipseOutline(r) {
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const out = [];
    for (let i = 0; i <= ELLIPSE_SEGMENTS; i++) {
        const t = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
        out.push([
            cx + (r.width / 2) * Math.cos(t),
            cy + (r.height / 2) * Math.sin(t),
        ]);
    }
    return out;
}
function shapeOutline(componentType, r) {
    switch (componentType) {
        case "rect":
            return rectOutline(r);
        case "diamond":
            return diamondOutline(r);
        case "circle":
            return ellipseOutline(r);
        default:
            return null;
    }
}
function elementInk(el) {
    if (el.type === "frame")
        return [];
    const bounds = elementBounds(el);
    const rotation = el.rotation ?? 0;
    const center = bounds
        ? [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2]
        : null;
    const spin = (points) => center ? rotatePolyline(points, center[0], center[1], rotation) : points;
    if (el.type === "freedraw") {
        const points = el.points;
        if (!points || points.length < 2)
            return [];
        return [points.map(([x, y]) => [x, y])];
    }
    if (STROKE_COMPONENT_TYPES.has(el.componentType ?? "")) {
        const points = el.points;
        if (!points || points.length < 2)
            return [];
        return [spin(points.map(([x, y]) => [x, y]))];
    }
    if (!bounds || bounds.width < 0 || bounds.height < 0)
        return [];
    const outline = shapeOutline(el.componentType, bounds);
    if (outline)
        return [spin(outline)];
    return [spin(rectOutline(bounds))];
}
function sceneInk(elements) {
    return elements.flatMap(elementInk).filter((line) => line.length >= 2);
}

const DEFAULT_SCORE_OPTIONS = {
    pxPerSecond: 220,
    stepsPerSecond: 8,
    maxVoices: 5,
    scale: DEFAULT_SCALE_ID,
};
const MIN_PX_PER_SECOND = 40;
const MAX_PX_PER_SECOND = 900;
const MIN_DURATION_SEC = 0.4;
const MAX_DURATION_SEC = 180;
const MAX_COLUMNS = 1024;
const MAX_SEGMENT_SAMPLES = 4096;
const MAX_PITCH_POINTS = 256;
const FULL_VELOCITY_HITS = 8;
const MIN_VELOCITY = 0.42;
function clampSpeed(pxPerSecond) {
    if (!isFinite(pxPerSecond))
        return DEFAULT_SCORE_OPTIONS.pxPerSecond;
    return Math.max(MIN_PX_PER_SECOND, Math.min(MAX_PX_PER_SECOND, pxPerSecond));
}
class Grid {
    _rect;
    columns;
    _scale;
    cells;
    rows;
    constructor(_rect, columns, _scale) {
        this._rect = _rect;
        this.columns = columns;
        this._scale = _scale;
        this.rows = scaleRows(_scale);
        this.cells = new Array(columns * this.rows).fill(0);
    }
    get colWidth() {
        return this._rect.width / this.columns;
    }
    get rowHeight() {
        return this._rect.height / this.rows;
    }
    locate(x, y) {
        const { _rect: rect } = this;
        if (x < rect.x ||
            x > rect.x + rect.width ||
            y < rect.y ||
            y > rect.y + rect.height) {
            return null;
        }
        const column = Math.max(0, Math.min(this.columns - 1, Math.floor((x - rect.x) / this.colWidth)));
        return {
            column,
            row: yToRow(this._scale, y, rect.y, rect.height),
        };
    }
    hit(cell) {
        this.cells[cell.column * this.rows + cell.row]++;
    }
    hitsAt(cell) {
        return this.cells[cell.column * this.rows + cell.row];
    }
}
function walkRun(run, grid, sampleStep, onCell) {
    for (let i = 1; i < run.length; i++) {
        const [ax, ay] = run[i - 1];
        const [bx, by] = run[i];
        const length = Math.hypot(bx - ax, by - ay);
        const samples = Math.max(1, Math.min(MAX_SEGMENT_SAMPLES, Math.ceil(length / sampleStep)));
        for (let s = i === 1 ? 0 : 1; s <= samples; s++) {
            const t = s / samples;
            onCell(grid.locate(ax + (bx - ax) * t, ay + (by - ay) * t));
        }
    }
}
function groupByColumn(cells) {
    const groups = [];
    for (const cell of cells) {
        const last = groups[groups.length - 1];
        if (last && last.column === cell.column) {
            if (last.rows[last.rows.length - 1] !== cell.row) {
                last.rows.push(cell.row);
            }
            continue;
        }
        groups.push({ column: cell.column, rows: [cell.row] });
    }
    return groups;
}
function decimate(pitches) {
    if (pitches.length <= MAX_PITCH_POINTS)
        return pitches;
    return evenPick(pitches, MAX_PITCH_POINTS);
}
function toVoice(groups, grid, stepSec) {
    if (groups.length === 0)
        return null;
    const firstColumn = groups[0].column;
    const lastColumn = groups[groups.length - 1].column;
    const startSec = firstColumn * stepSec;
    const pitches = [];
    let peak = 0;
    for (const group of groups) {
        const slots = group.rows.length;
        group.rows.forEach((row, index) => {
            peak = Math.max(peak, grid.hitsAt({ column: group.column, row }));
            const at = (group.column + index / slots) * stepSec - startSec;
            const previous = pitches[pitches.length - 1];
            if (previous && previous.row === row)
                return;
            pitches.push({ t: Math.max(0, at), row });
        });
    }
    if (pitches.length === 0)
        return null;
    return {
        startSec,
        durationSec: (lastColumn + 1) * stepSec - startSec,
        column: firstColumn,
        velocity: MIN_VELOCITY +
            (1 - MIN_VELOCITY) * Math.min(1, peak / FULL_VELOCITY_HITS),
        pitches: decimate(pitches),
    };
}
function buildVoices(lines, grid, stepSec, maxVoices) {
    const sampleStep = Math.max(0.5, Math.min(grid.colWidth, grid.rowHeight) / 2);
    const strands = [];
    for (const line of lines) {
        for (const run of monotonicRuns(line)) {
            let pending = [];
            const flush = () => {
                if (pending.length > 0)
                    strands.push(pending);
                pending = [];
            };
            walkRun(run, grid, sampleStep, (cell) => {
                if (!cell) {
                    flush();
                    return;
                }
                grid.hit(cell);
                pending.push(cell);
            });
            flush();
        }
    }
    const voices = strands
        .map((strand) => toVoice(groupByColumn(strand), grid, stepSec))
        .filter((voice) => voice !== null);
    const byColumn = new Map();
    for (const voice of voices) {
        const bucket = byColumn.get(voice.column);
        if (bucket)
            bucket.push(voice);
        else
            byColumn.set(voice.column, [voice]);
    }
    const kept = [];
    for (const bucket of byColumn.values()) {
        bucket.sort((a, b) => a.pitches[0].row - b.pitches[0].row);
        kept.push(...evenPick(bucket, maxVoices));
    }
    kept.sort((a, b) => a.startSec - b.startSec || a.pitches[0].row - b.pitches[0].row);
    return kept;
}
function buildScore(rect, lines, options = {}) {
    const { pxPerSecond, stepsPerSecond, maxVoices, scale } = {
        ...DEFAULT_SCORE_OPTIONS,
        ...options,
    };
    const resolved = getScale(scale);
    const speed = clampSpeed(pxPerSecond);
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const durationSec = Math.max(MIN_DURATION_SEC, Math.min(MAX_DURATION_SEC, width / speed));
    const columns = Math.max(1, Math.min(MAX_COLUMNS, Math.round(durationSec * stepsPerSecond)));
    const stepSec = durationSec / columns;
    const normalized = { x: rect.x, y: rect.y, width, height };
    const grid = new Grid(normalized, columns, resolved);
    const voices = buildVoices(lines, grid, stepSec, maxVoices);
    return {
        rect: normalized,
        scale: resolved,
        pxPerSecond: speed,
        durationSec,
        columns,
        rows: grid.rows,
        stepSec,
        cells: grid.cells,
        voices,
    };
}
function playheadX(score, elapsedSec) {
    const t = Math.max(0, Math.min(score.durationSec, elapsedSec));
    return score.rect.x + (t / score.durationSec) * score.rect.width;
}

const INK_PROPERTIES = [
    "type",
    "componentType",
    "x",
    "y",
    "width",
    "height",
    "points",
    "rotation",
];
const BOUNDS_PROPERTIES = [
    "type",
    "x",
    "y",
    "width",
    "height",
];
const HIT_PAD = 8;
const STAGE_TOLERANCE = 1;
function encloses(outer, inner) {
    return (inner.x >= outer.x - STAGE_TOLERANCE &&
        inner.y >= outer.y - STAGE_TOLERANCE &&
        inner.x + inner.width <= outer.x + outer.width + STAGE_TOLERANCE &&
        inner.y + inner.height <= outer.y + outer.height + STAGE_TOLERANCE);
}
function dropStageElements(elements, stageIds) {
    const stage = new Set(stageIds);
    const content = elements.filter((el) => !stage.has(el.id));
    if (content.length === 0)
        return elements;
    const contentRects = content
        .map(elementBounds)
        .filter((r) => r !== null);
    return elements.filter((el) => {
        if (!stage.has(el.id))
            return true;
        const bounds = elementBounds(el);
        if (!bounds)
            return true;
        return !contentRects.every((inner) => encloses(bounds, inner));
    });
}
async function elementsInRect(ctx, rect, properties) {
    const { drawdyElements } = unwrap(await ctx.issueCommand({
        type: "command:scene:query-rect",
        ...stamp(ctx),
        req: { rect, properties },
    }));
    return drawdyElements;
}
async function elementsByIds(ctx, drawdyElementIds, properties) {
    const { drawdyElements } = unwrap(await ctx.issueCommand({
        type: "command:scene:get-drawdy-elements",
        ...stamp(ctx),
        req: { properties, drawdyElementIds },
    }));
    return drawdyElements;
}
function boundsUnion(elements) {
    const rects = elements
        .map(elementBounds)
        .filter((r) => r !== null);
    return combineRects(rects);
}
async function boardRect(ctx) {
    const { drawdyElements } = unwrap(await ctx.issueCommand({
        type: "command:scene:get-drawdy-elements",
        ...stamp(ctx),
        req: { properties: BOUNDS_PROPERTIES },
    }));
    return boundsUnion(drawdyElements);
}
function pickHit(hits, pointer) {
    const enclosingFrame = hits.find((el) => {
        if (el.type !== "frame")
            return false;
        const bounds = elementBounds(el);
        return bounds ? rectContainsPoint(bounds, pointer.x, pointer.y) : false;
    });
    if (enclosingFrame)
        return enclosingFrame;
    let smallest = null;
    let smallestArea = Infinity;
    for (const el of hits) {
        const bounds = elementBounds(el);
        if (!bounds)
            continue;
        const area = rectArea(bounds);
        if (area < smallestArea) {
            smallestArea = area;
            smallest = el;
        }
    }
    return smallest;
}
async function seedIds(ctx, pointer) {
    const { drawdyElementIds } = unwrap(await ctx.issueCommand({
        type: "command:scene:get-current-selected-drawdy-elements",
        ...stamp(ctx),
    }));
    if (drawdyElementIds.length > 0)
        return drawdyElementIds;
    if (!pointer)
        return [];
    const hits = await elementsInRect(ctx, {
        x: pointer.x - HIT_PAD,
        y: pointer.y - HIT_PAD,
        width: HIT_PAD * 2,
        height: HIT_PAD * 2,
    }, BOUNDS_PROPERTIES);
    const hit = pickHit(hits, pointer);
    return hit ? [hit.id] : [];
}
async function resolveRegion(ctx, pointer) {
    const stageIds = await seedIds(ctx, pointer);
    let rect;
    if (stageIds.length > 0) {
        const seeds = await elementsByIds(ctx, stageIds, BOUNDS_PROPERTIES);
        const frames = seeds.filter((el) => el.type === "frame");
        rect = boundsUnion(frames.length > 0 ? frames : seeds);
    }
    else {
        rect = await boardRect(ctx);
    }
    if (!rect || rect.width <= 0 || rect.height <= 0)
        return null;
    return { rect, stageIds };
}
async function resolveTarget(ctx, pointer) {
    const region = await resolveRegion(ctx, pointer);
    if (!region)
        return null;
    const inRegion = (await elementsInRect(ctx, region.rect, INK_PROPERTIES)).filter((el) => el.type !== "frame");
    const elements = dropStageElements(inRegion, region.stageIds);
    if (elements.length === 0)
        return null;
    return { rect: region.rect, elements };
}

const EMPTY_REGION = { x: 0, y: 0, width: 1, height: 1 };
class SereneSession {
    _ctx;
    _playhead;
    _styling;
    _score = null;
    _rect = null;
    _lines = [];
    _elementCount = 0;
    _speed = DEFAULT_SCORE_OPTIONS.pxPerSecond;
    _scale = DEFAULT_SCALE_ID;
    _pointer = null;
    _pendingAutoplay = false;
    constructor(_ctx, _playhead, _styling) {
        this._ctx = _ctx;
        this._playhead = _playhead;
        this._styling = _styling;
    }
    setPointer(pointer) {
        this._pointer = pointer;
    }
    setStyling(styling) {
        this._styling = styling;
        this._playhead.setStyling(styling);
    }
    async openPanel() {
        await openPanel(this._ctx, this._styling);
    }
    postScales() {
        postToPanel(this._ctx, {
            type: "scales",
            scales: scaleOptions(),
            current: this._scale,
        });
    }
    postTheme() {
        postToPanel(this._ctx, {
            type: "theme",
            css: stylingCssVars(this._styling),
        });
    }
    async _resolve() {
        const target = await resolveTarget(this._ctx, this._pointer);
        if (!target) {
            this._rect = null;
            this._lines = [];
            this._elementCount = 0;
            this._score = buildScore(EMPTY_REGION, [], {
                scale: this._scale,
            });
            return false;
        }
        this._rect = target.rect;
        this._elementCount = target.elements.length;
        this._lines = sceneInk(target.elements);
        this._rebuild();
        return true;
    }
    async play() {
        const resolved = await this._resolve();
        await this.openPanel();
        if (!resolved) {
            this._postScore(false);
            return;
        }
        this._postScore(true);
    }
    async stop() {
        postToPanel(this._ctx, { type: "stop" });
        await this._playhead.hide();
    }
    async onPanelMessage(message) {
        switch (message.type) {
            case "ready":
                this.postTheme();
                this.postScales();
                if (this._score) {
                    const autoplay = this._pendingAutoplay;
                    this._pendingAutoplay = false;
                    this._postScore(autoplay);
                }
                return;
            case "started":
                this._pendingAutoplay = false;
                if (this._rect)
                    await this._playhead.show(this._rect);
                return;
            case "progress":
                if (this._score) {
                    this._playhead.move(playheadX(this._score, message.t));
                }
                return;
            case "ended":
            case "stopped":
                await this._playhead.hide();
                return;
            case "speed":
                this._speed = clampSpeed(message.value);
                if (!this._rect)
                    return;
                this._rebuild();
                this._postScore(false);
                return;
            case "scale":
                this._scale = getScale(message.value).id;
                if (!this._rect)
                    return;
                this._rebuild();
                this._postScore(false);
                return;
        }
    }
    _rebuild() {
        if (!this._rect)
            return;
        this._score = buildScore(this._rect, this._lines, {
            pxPerSecond: this._speed,
            scale: this._scale,
        });
    }
    _postScore(autoplay) {
        if (!this._score)
            return;
        if (autoplay)
            this._pendingAutoplay = true;
        postToPanel(this._ctx, {
            type: "score",
            score: serializeScore(this._score, this._elementCount),
            autoplay,
        });
    }
}

let driver = null;
const activate = async ({ manifest, issueCommand, generateId, styling, }) => {
    let requestId = 0;
    const ctx = {
        driverId: manifest.driverId,
        issueCommand,
        generateId,
        nextRequestId: () => String(requestId++),
    };
    const playhead = new Playhead(ctx, styling);
    const session = new SereneSession(ctx, playhead, styling);
    driver = { ctx, session, styling };
    unwrap(await issueCommand({
        type: "command:dom:create-action-button",
        ...stamp(ctx),
        req: {
            domElementId: actionButtonId(ctx.driverId),
            svg: ACTION_BUTTON_SVG,
        },
    }));
    unwrap(await issueCommand({
        type: "subscription:dom:element-clicked",
        ...stamp(ctx),
        req: { domElementId: actionButtonId(ctx.driverId) },
    }));
    unwrap(await issueCommand({
        type: "subscription:webview:message",
        ...stamp(ctx),
        req: { webviewDomId: panelWebviewId(ctx.driverId) },
    }));
    unwrap(await issueCommand({
        type: "subscription:dom:theme-changed",
        ...stamp(ctx),
    }));
    unwrap(await issueCommand({
        type: "subscription:scene:pointer-position",
        ...stamp(ctx),
    }));
    await registerMenus(ctx);
};
const onEvent = async (event) => {
    if (!driver)
        return;
    const { ctx, session } = driver;
    switch (event.type) {
        case "subscription:context-menu:clicked": {
            if (event.body.menuId === playMenuId(ctx.driverId)) {
                await session.play();
                return;
            }
            if (event.body.menuId === stopMenuId(ctx.driverId)) {
                await session.stop();
            }
            return;
        }
        case "subscription:scene:pointer-position": {
            session.setPointer(event.body.position.canvasSpace);
            return;
        }
        case "subscription:dom:element-clicked": {
            if (event.body.domElementId !== actionButtonId(ctx.driverId))
                return;
            await session.openPanel();
            session.postTheme();
            return;
        }
        case "subscription:webview:message": {
            if (event.body.webviewDomId !== panelWebviewId(ctx.driverId))
                return;
            const message = event.body.message;
            if (typeof message !== "object" || message === null)
                return;
            await session.onPanelMessage(message);
            return;
        }
        case "subscription:dom:theme-changed": {
            driver.styling = event.body.styling;
            session.setStyling(event.body.styling);
            session.postTheme();
            return;
        }
        default:
            return;
    }
};

exports.activate = activate;
exports.onEvent = onEvent;
