
/* Prize Wheel
         - Draws a wheel on a <canvas> element using the `segments` array.
         - Uses CSS rotation on the canvas to animate spins (keeps drawing simple).
         - When spin finishes, determines which segment is at the pointer and shows the result.
*/

const STORAGE_KEY = 'prizeWheelItems';

function defaultPrizes() {
    return [
        { label: 'Chores   ', color: '#ff6384' },
        { label: 'Candy   ', color: '#36a2eb' },
        { label: 'Prize   ', color: '#cc65fe' },
        { label: 'Mystery ???', color: '#22ab2b' },
        { label: 'Clean Up   ', color: '#ffcc00' },
        { label: 'Mom Picks   ', color: '#ff9f40' },
        { label: 'Dad Picks   ', color: '#4bc0c0' },
        { label: 'Free Spin   ', color: '#9966ff' }
    ];
}

function loadPrizes() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultPrizes();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) return defaultPrizes();
        return parsed;
    } catch (e) {
        return defaultPrizes();
    }
}

function savePrizes(list) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
        // ignore
    }
}

let segments = loadPrizes();
let displaySegments = null; // temporary duplicated/randomized segments used for drawing/spinning

const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const resultEl = document.getElementById('result');
const countdownEl = document.getElementById('countdown');
const postCountdownEl = document.getElementById('postTimeout');
const centerControls = document.querySelector('.center-controls');

// prize form elements
const prizeForm = document.getElementById('prizeForm');
const prizeLabelInput = document.getElementById('prizeLabel');
const prizeColorInput = document.getElementById('prizeColor');
const prizeList = document.getElementById('prizeList');

let spinning = false;

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale drawing operations
    drawWheel();
}

function duplicateSegments(segs) {
    // Duplicate segments for a fuller wheel, preserving original indices
    const base = segs.map((s, i) => ({ label: s.label, color: s.color, originalIndex: i }));
    return base.concat(base.map(s => ({ ...s })));
}

function drawWheel() {
    // Always use doubled segments for display
    if (!displaySegments) {
        displaySegments = duplicateSegments(segments);
    }
    const { width, height } = canvas;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 8;

    ctx.clearRect(0, 0, w, h);

    const count = displaySegments.length || 1;
    const angle = (Math.PI * 2) / count;

    // draw segments
    for (let i = 0; i < displaySegments.length; i++) {
        const seg = displaySegments[i];
        const start = -Math.PI / 2 + i * angle; // start from top
        const end = start + angle;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, end, false);
        ctx.closePath();
        ctx.fillStyle = seg ? seg.color : '#cccccc';
        ctx.fill();

        // text
        ctx.save();
        ctx.translate(cx, cy);
        const textAngle = start + angle / 2;
        ctx.rotate(textAngle);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px system-ui, Arial';
        const label = seg ? seg.label : '';
        ctx.fillText(label, radius - 12, 6);
        ctx.restore();
    }

    // center circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#eee';
    ctx.stroke();
}

// When the canvas's CSS transform transition ends, compute the winner
canvas.addEventListener('transitionend', (ev) => {
    if (!spinning) return;
    // only respond to transform transitions
    if (ev.propertyName && ev.propertyName !== 'transform') return;
    // read current rotation from computed style (matrix) to be robust
    const st = window.getComputedStyle(canvas);
    const transform = st.getPropertyValue('transform');
    let deg = 0;
    if (transform && transform !== 'none') {
        const values = transform.split('(')[1].split(')')[0].split(',');
        const a = parseFloat(values[0]);
        const b = parseFloat(values[1]);
        deg = Math.round(Math.atan2(b, a) * (180 / Math.PI));
        if (deg < 0) deg = 360 + deg;
    }
    
    // Use the same completion handler as the JS animation
    onSpinComplete(deg);
});

// Helpers for JS-driven animation/easing
function getCurrentRotationDeg() {
    const st = window.getComputedStyle(canvas);
    const transform = st.getPropertyValue('transform');
    if (!transform || transform === 'none') return 0;
    const values = transform.split('(')[1].split(')')[0].split(',');
    const a = parseFloat(values[0]);
    const b = parseFloat(values[1]);
    let deg = Math.round(Math.atan2(b, a) * (180 / Math.PI));
    if (deg < 0) deg = 360 + deg;
    return deg % 360;
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function animateSpinTo(finalDeg, durationMs) {
    const startDeg = getCurrentRotationDeg();
    const start = performance.now();

    const active = displaySegments || segments;
    const count = Math.max(1, active.length);
    const segmentAngle = 360 / count;
    // initial sector index
    const normStart = ((360 - (startDeg % 360)) + 360) % 360;
    let prevSectorIndex = Math.floor(normStart / segmentAngle) % count;

    function frame(now) {
        const elapsed = now - start;
        const t = Math.min(1, elapsed / durationMs);
        const eased = easeOutCubic(t);
        const current = startDeg + (finalDeg - startDeg) * eased;
        canvas.style.transform = `rotate(${current}deg)`;
                            // detect segment boundary crossings and play tick when they occur
                            if (ticksEnabled) {
                                    const norm = ((360 - (current % 360)) + 360) % 360;
                                    const sectorFloat = norm / segmentAngle;
                                    const currIndex = Math.floor(sectorFloat) % count;
                                    if (currIndex !== prevSectorIndex) {
                                            // compute progress to shape tick timbre
                                            const progress = Math.min(1, Math.max(0, elapsed / durationMs));
                                            const minFreq = 1200;
                                            const maxFreq = 600;
                                            const freq = Math.round(minFreq - (minFreq - maxFreq) * progress);
                                            const volume = 0.06 * (1 - 0.5 * progress);
                                            playTick(freq, volume, 0.07);
                                            prevSectorIndex = currIndex;
                                    }
                            }
        if (t < 1) {
            requestAnimationFrame(frame);
        } else {
            // ensure final exact position
            canvas.style.transform = `rotate(${finalDeg}deg)`;
            // handle spin completion
            onSpinComplete(finalDeg);
        }
    }

    requestAnimationFrame(frame);
}

function onSpinComplete(finalDeg) {
    // compute winner using finalDeg
    const count = displaySegments.length;
    const segmentAngle = 360 / count;
    
    // Because drawing starts at -90deg (top) and positive rotation is clockwise,
    // normalize final angle to find which segment is at the top pointer (0 degrees)
    const normalized = Math.round(finalDeg) % 360;
    const topDeg = (360 - normalized) % 360;
    
    // The winning segment's index is determined by which segment contains topDeg
    const index = Math.floor(topDeg / segmentAngle) % count;
    
    const winner = displaySegments[index];
    // Map back to original prize index (stored in each duplicated segment)
    const original = segments[winner.originalIndex];
    
    resultEl.textContent = `You won: ${original.label}`;
    // stop spin feedback and play the win sound
    stopSpinFeedback();
    playWinSound();
    spinning = false;

    // If the prize is a free spin, allow immediate re-spin (no post timeout).
    const labelNorm = String(original.label || '').toLowerCase().trim();
    const isFreeSpin = labelNorm === 'free spin' || labelNorm === 'freespin' || labelNorm === 'free-spin';
    if (isFreeSpin) {
        // re-enable controls immediately
        spinBtn.disabled = false;
        setFormEnabled(true);
        if (centerControls) centerControls.classList.remove('locked');
    } else {
        // Keep UI locked briefly: start a 2-minute post-spin timeout during which
        // the user cannot start another spin. This uses the center post-timeout
        // display to show remaining lockout time.
        spinBtn.disabled = true;
        setFormEnabled(false);
        startPostTimeout(5 * 60 * 1000);
    }

    // Keep doubled display consistent
    drawWheel();
}

function spin() {
    if (spinning) return;
    spinning = true;
    resultEl.textContent = '';
    spinBtn.disabled = true;
    setFormEnabled(false);

    // Ensure we have doubled segments for display
    if (!displaySegments) {
        displaySegments = duplicateSegments(segments);
    }
    const count = displaySegments.length;
    const segmentAngle = 360 / count;

    const targetIndex = Math.floor(Math.random() * count);

    // choose a number of extra rotations for visual effect (always at least 2)
    const minRotations = 5;
    const extraRotations = Math.floor(Math.random() * 4) + minRotations; // 2..5

    // compute rotation so the target index lands at the top pointer
    // Use a positive (clockwise) rotation amount. CSS rotate(+) spins clockwise.
    const degToTarget = (360 - (targetIndex * segmentAngle + segmentAngle / 2)) % 360;

    // finalDeg is a positive number of degrees to rotate clockwise.
    const finalDeg = extraRotations * 360 + degToTarget;

        // apply rotation via CSS transform (canvas element is centered)
        // use a small timeout so the browser registers the transition
        // disable CSS transition so we drive animation frame-by-frame for a realistic easing
        canvas.style.transition = 'none';
        // start JS-driven animation (easier to apply a true ease-out decel)
        animateSpinTo(finalDeg, 10000);
        // start countdown & ticking sound
        startSpinFeedback(10000); // 10 seconds
}

// hook up UI
spinBtn.addEventListener('click', spin);

// prize form handling
function renderPrizeList() {
    prizeList.innerHTML = '';
    segments.forEach((p, i) => {
        const li = document.createElement('li');
        li.className = 'prize-item';

        const dot = document.createElement('span');
        dot.className = 'prize-color';
        dot.style.background = p.color;

        const label = document.createElement('span');
        label.textContent = p.label;

        const btn = document.createElement('button');
        btn.className = 'prize-remove';
        btn.type = 'button';
        btn.textContent = '✕';
        btn.title = 'Remove prize';
        btn.dataset.index = String(i);

        li.appendChild(dot);
        li.appendChild(label);
        li.appendChild(btn);
        prizeList.appendChild(li);
    });
}

/* Audio & countdown feedback during spin */
let audioCtx = null;
let ticksEnabled = false;
let countdownRaf = null;
let countdownStart = 0;
let countdownDuration = 0;
// post-spin timeout (prevent immediate re-spin)
let postCountdownRaf = null;
let postCountdownStart = 0;
let postCountdownDuration = 0;

function formatMsToMMSS(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function ensureAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playTick(frequency = 1000, volume = 0.06, duration = 0.08) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    // use a sine wave for a softer tone
    o.type = 'sine';
    o.frequency.setValueAtTime(frequency, now);
    g.gain.setValueAtTime(0, now);
    // quick attack and gentle decay
    g.gain.linearRampToValueAtTime(volume, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(now);
    o.stop(now + duration + 0.02);
}

function startTicking() {
    ensureAudioContext();
    ticksEnabled = true;
}

function stopTicking() {
    ticksEnabled = false;
}

function playWinSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const notes = [880, 1100, 1320];
    notes.forEach((freq, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, now + i * 0.12);
        g.gain.setValueAtTime(0, now + i * 0.12);
        g.gain.linearRampToValueAtTime(0.12, now + i * 0.12 + 0.01);
        g.gain.linearRampToValueAtTime(0.0001, now + i * 0.12 + 0.11);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(now + i * 0.12);
        o.stop(now + i * 0.12 + 0.14);
    });
}

function updateCountdown() {
    if (!countdownStart) return;
    const elapsed = performance.now() - countdownStart;
    const remaining = Math.max(0, countdownDuration - elapsed);
    const sec = (remaining / 1000).toFixed(1);
    if (countdownEl) countdownEl.textContent = `${sec}s`;
    if (remaining > 0) {
        countdownRaf = requestAnimationFrame(updateCountdown);
    } else {
        countdownRaf = null;
        if (countdownEl) countdownEl.classList.remove('running');
    }
}

// Post-spin timeout: prevents re-spinning for a fixed duration after a spin completes
function updatePostCountdown() {
    if (!postCountdownStart) return;
    const elapsed = performance.now() - postCountdownStart;
    const remaining = Math.max(0, postCountdownDuration - elapsed);
    // show mm:ss in the center post-timeout display
    if (postCountdownEl) postCountdownEl.textContent = formatMsToMMSS(remaining);
    if (remaining > 0) {
        postCountdownRaf = requestAnimationFrame(updatePostCountdown);
    } else {
        postCountdownRaf = null;
        postCountdownStart = 0;
        if (postCountdownEl) {
            postCountdownEl.classList.remove('running');
            postCountdownEl.textContent = '';
        }
        // re-enable controls after timeout
        spinBtn.disabled = false;
        setFormEnabled(true);
        if (centerControls) centerControls.classList.remove('locked');
    }
}

function startPostTimeout(ms) {
    // ensure any existing post timeout is cleared
    if (postCountdownRaf) cancelAnimationFrame(postCountdownRaf);
    postCountdownDuration = ms;
    postCountdownStart = performance.now();
    if (postCountdownEl) {
        postCountdownEl.classList.add('running');
        // immediate display in mm:ss
        postCountdownEl.textContent = formatMsToMMSS(ms);
    }
    if (centerControls) centerControls.classList.add('locked');
    postCountdownRaf = requestAnimationFrame(updatePostCountdown);
}

function stopPostTimeout() {
    if (postCountdownRaf) {
        cancelAnimationFrame(postCountdownRaf);
        postCountdownRaf = null;
    }
    postCountdownStart = 0;
    if (postCountdownEl) {
        postCountdownEl.classList.remove('running');
        postCountdownEl.textContent = '';
    }
    if (centerControls) centerControls.classList.remove('locked');
    // ensure controls are enabled when stopping the timeout early
    spinBtn.disabled = false;
    setFormEnabled(true);
}

function startCountdown(ms) {
    countdownDuration = ms;
    countdownStart = performance.now();
    if (countdownEl) {
        countdownEl.classList.add('running');
        countdownEl.textContent = `${(ms / 1000).toFixed(1)}s`;
    }
    if (countdownRaf) cancelAnimationFrame(countdownRaf);
    countdownRaf = requestAnimationFrame(updateCountdown);
}

function stopCountdown() {
    if (countdownRaf) {
        cancelAnimationFrame(countdownRaf);
        countdownRaf = null;
    }
    countdownStart = 0;
    if (countdownEl) {
        countdownEl.classList.remove('running');
        countdownEl.textContent = '';
    }
}

function startSpinFeedback(ms) {
    // must be triggered by user gesture to allow AudioContext
    ensureAudioContext();
    startCountdown(ms);
    startTicking();
}

function stopSpinFeedback() {
    stopTicking();
    stopCountdown();
}

// (previously had a shuffle helper; randomization was removed)

function addPrize(label, color) {
    if (!label) return;
    segments.push({ label, color });
    savePrizes(segments);
    // reset any rotation so new wheel draws predictably
    canvas.style.transition = 'none';
    canvas.style.transform = 'rotate(0deg)';
    // Update displaySegments with new doubled segments
    displaySegments = duplicateSegments(segments);
    renderPrizeList();
    drawWheel();
}

function removePrize(index) {
    if (index < 0 || index >= segments.length) return;
    segments.splice(index, 1);
    savePrizes(segments);
    canvas.style.transition = 'none';
    canvas.style.transform = 'rotate(0deg)';
    // Update displaySegments with new doubled segments
    displaySegments = duplicateSegments(segments);
    renderPrizeList();
    drawWheel();
}

function setFormEnabled(enabled) {
    const btn = prizeForm.querySelector('button[type="submit"]');
    if (btn) btn.disabled = !enabled;
    // disable remove buttons too
    const removes = prizeList.querySelectorAll('.prize-remove');
    removes.forEach(b => (b.disabled = !enabled));
}

prizeForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (spinning) return;
    const label = prizeLabelInput.value.trim();
    const color = prizeColorInput.value || '#999999';
    if (!label) return;
    addPrize(label, color);
    prizeLabelInput.value = '';
    prizeLabelInput.focus();
});

prizeList.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.prize-remove');
    if (!btn) return;
    const idx = Number(btn.dataset.index);
    removePrize(idx);
});

// initial setup
window.addEventListener('resize', resizeCanvas);
window.addEventListener('load', () => {
    // initial sizing + draw
    resizeCanvas();
    renderPrizeList();
});






