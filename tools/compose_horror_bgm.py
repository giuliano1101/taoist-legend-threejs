"""Original, deterministic 96-second horror score; no samples or external services.

All events wrap around the buffer, including reverberation, for a seamless loop.
Rebuild: python tools/compose_horror_bgm.py, then encode the WAV with ffmpeg.
"""
from pathlib import Path
import json
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt

ROOT = Path(__file__).resolve().parents[1]
SR, DURATION = 32000, 96
N = SR * DURATION
rng = np.random.default_rng(512742)
mix = np.zeros((N, 2), dtype=np.float32)


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def add(signal, start, gain=1, pan=0, echoes=True):
    """Equal-power stereo placement, circular tails and dark echo reflections."""
    placements = [(0, 1, pan)]
    if echoes:
        placements += [(.37, .29, -pan-.2), (.83, .17, pan+.3),
                       (1.47, .10, -pan), (2.31, .055, pan)]
    for delay, level, position in placements:
        position = np.clip(position, -.85, .85)
        stereo = np.array([np.cos((position+1)*np.pi/4),
                           np.sin((position+1)*np.pi/4)])
        at = int((start+delay)*SR) % N
        remaining = len(signal)
        offset = 0
        while remaining:
            count = min(remaining, N-at)
            mix[at:at+count] += (signal[offset:offset+count, None]
                                * stereo * gain * level).astype(np.float32)
            remaining -= count
            offset += count
            at = 0


# Breathing bass drones. Integer cycle counts make their phase continuous at wrap.
t = np.arange(N, dtype=np.float64)/SR
for midi, level, pan in [(26, .12, -.15), (38, .052, .2), (45, .025, -.35)]:
    f = round(hz(midi)*DURATION)/DURATION
    breath = .72+.24*np.sin(2*np.pi*t/24)+.04*np.sin(2*np.pi*t/6)
    signal = (np.sin(2*np.pi*f*t+.13*np.sin(2*np.pi*t/12))
              +.15*np.sin(2*np.pi*f*2*t)) * breath
    add(signal, 0, level, pan, False)

# Eight overlapping, slow dissonant bowed-string harmonies, with no bright lead.
chords = [(50, 57, 65), (50, 56, 63), (51, 58, 66), (49, 55, 62),
          (50, 57, 65), (46, 53, 61), (49, 56, 62), (50, 57, 63)]
for bar, chord in enumerate(chords):
    length = 16
    u = np.arange(length*SR)/SR
    env = np.sin(np.pi*u/length)**2
    for voice, note in enumerate(chord):
        f = hz(note)
        phase = 2*np.pi*f*u+.12*np.sin(2*np.pi*.27*u+bar)
        strings = (np.sin(phase)+.24*np.sin(phase*2+.2)
                   +.09*np.sin(phase*3))
        beating = .5+.5*np.sin(2*np.pi*.061*u+voice+bar*.4)**2
        add(strings*env*beating, bar*12-2, .028, (voice-1)*.55)

# Circular filtered air, like a long, hollow passage rather than spoken whispers.
noise = rng.normal(size=N)
spectrum = np.fft.rfft(noise)
freq = np.fft.rfftfreq(N, 1/SR)
shape = np.exp(-.5*((freq-480)/380)**2)
shape *= np.minimum(freq/110, 1)
air = np.fft.irfft(spectrum*shape, n=N)
air /= max(np.std(air), .001)
air *= .011*(.55+.45*np.sin(2*np.pi*t/16)**2)
add(air, 0, 1, -.35, False)
add(np.roll(air, int(.11*SR)), 0, .7, .65, False)

# Slow paired heartbeats / muffled temple drum. Eight-beat breathing spaces.
for beat in np.arange(0, DURATION, 3):
    for delay, gain in [(0, .11), (.24, .065)]:
        u = np.arange(int(.65*SR))/SR
        phase = 2*np.pi*(45*u+27*.065*(1-np.exp(-u/.065)))
        pulse = np.sin(phase)*(1-np.exp(-u/.006))*np.exp(-u/.12)
        add(pulse, beat+delay, gain, -.1, False)

# Sparse detuned bronze bell motif and reverse swells, never a jump-scare hit.
motif = [(3,62), (11.25,63), (21,57), (32.25,62), (39,68),
         (51,62), (62.25,58), (72,61), (83.25,57), (92.25,63)]
for index, (at, note) in enumerate(motif):
    u = np.arange(7*SR)/SR
    bell = np.zeros_like(u)
    for ratio, level, decay in [(1,1,2.1),(2.009,.36,1.5),(2.77,.15,.8),(4.06,.055,.4)]:
        bell += np.sin(2*np.pi*hz(note)*ratio*u)*level*np.exp(-u/decay)
    bell *= 1-np.exp(-u/.012)
    add(bell, at, .075, (-1 if index%2 else 1)*.48)
    if index in (2,4,7,9):
        swell = np.sin(2*np.pi*hz(note-12)*u)*np.sin(np.pi*u/7)**3
        add(swell, at-6, .022, .5)

# Tame high frequencies, preserve headroom. No hard limiting or clipping.
mix = sosfiltfilt(butter(2, 3800, fs=SR, output='sos'), mix, axis=0)
mix -= mix.mean(axis=0)
rms = float(np.sqrt(np.mean(mix**2)))
mix *= min(.13/max(rms, 1e-9), .78/max(float(np.max(np.abs(mix))), 1e-9))
output = ROOT/'artwork/audio/fog-alley-night.wav'
output.parent.mkdir(parents=True, exist_ok=True)
wavfile.write(output, SR, np.round(mix*32767).astype(np.int16))
report = dict(title='雾巷 · 夜行', duration=DURATION, sampleRate=SR,
              channels=2, bpm=80, peak=float(np.max(np.abs(mix))),
              rms=float(np.sqrt(np.mean(mix**2))),
              seamDelta=float(np.max(np.abs(mix[-1]-mix[0]))),
              origin='Original procedural composition; no external samples.')
(ROOT/'artwork/audio/composition.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
