/**
 * Zero-cost browser-side Voice Biometric Feature Extractor (Web Audio DSP).
 * Extracts speaker-discriminative acoustic features from a recorded Blob:
 *  - F0 fundamental pitch distribution (median Hz & IQR) via normalized autocorrelation
 *  - 13 Mel-Frequency Cepstral Coefficients (MFCC mean & std across voiced frames via radix-2 FFT + DCT-II)
 *  - 24-band L2-normalized log-spectral envelope, spectral centroid, zero-crossing rate, and voiced ratio
 *
 * Runs 100% locally in the browser in <80ms with zero external API keys or network cost.
 */

export interface AcousticSignature {
  version: 2;
  f0Median: number;
  f0Iqr: number;
  mfccMean: number[];
  mfccStd: number[];
  bands: number[];
  centroid: number;
  zcr: number;
  voicedRatio: number;
}

const FRAME_SIZE = 512;
const NUM_MEL_FILTERS = 26;
const NUM_MFCC = 13;
const NUM_BANDS = 24;

function fftRadix2(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wLenRe = Math.cos(ang);
    const wLenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + half] * wRe - im[i + j + half] * wIm;
        const vIm = re[i + j + half] * wIm + im[i + j + half] * wRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;
        const nextWRe = wRe * wLenRe - wIm * wLenIm;
        wIm = wRe * wLenIm + wIm * wLenRe;
        wRe = nextWRe;
      }
    }
  }
}

const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
const melToHz = (mel: number) => 700 * (Math.pow(10, mel / 2595) - 1);

function estimatePitchHz(samples: Float32Array, offset: number, length: number, sampleRate: number): number | null {
  const minLag = Math.max(16, Math.floor(sampleRate / 380)); // 380 Hz upper bound
  const maxLag = Math.min(length - 2, Math.floor(sampleRate / 70)); // 70 Hz lower bound
  if (maxLag <= minLag) return null;

  let energy0 = 0;
  for (let i = 0; i < length; i++) {
    const s = samples[offset + i];
    energy0 += s * s;
  }
  if (energy0 < 1e-5) return null;

  let bestLag = -1;
  let bestCorr = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let num = 0;
    let denA = 0;
    let denB = 0;
    const limit = length - lag;
    for (let i = 0; i < limit; i++) {
      const a = samples[offset + i];
      const b = samples[offset + i + lag];
      num += a * b;
      denA += a * a;
      denB += b * b;
    }
    const denom = Math.sqrt(denA * denB);
    if (denom <= 1e-8) continue;
    const corr = num / denom;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  // Require clear periodicity so unvoiced consonants/noise don't pollute F0
  if (bestLag <= 0 || bestCorr < 0.58) return null;
  return sampleRate / bestLag;
}

export async function extractAcousticSignature(blob: Blob): Promise<AcousticSignature | null> {
  if (typeof window === "undefined" || !blob || blob.size < 1500) return null;

  const AudioCtx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  let ctx: AudioContext | null = null;
  try {
    const buffer = await blob.arrayBuffer();
    ctx = new AudioCtx();
    const decoded = await ctx.decodeAudioData(buffer.slice(0));
    const channel = decoded.getChannelData(0);
    const sampleRate = decoded.sampleRate || 48000;
    return extractAcousticSignatureFromPCM(channel, sampleRate);
  } catch {
    return null;
  } finally {
    if (ctx) {
      void ctx.close().catch(() => undefined);
    }
  }
}

export function extractAcousticSignatureFromPCM(
  channel: Float32Array,
  sampleRate = 48000
): AcousticSignature | null {
  if (!channel || channel.length < FRAME_SIZE * 4) return null;

  // Precompute Hann window
    const hann = new Float64Array(FRAME_SIZE);
    for (let i = 0; i < FRAME_SIZE; i++) {
      hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FRAME_SIZE - 1)));
    }

    // Precompute Mel filterbank weights across FFT bins [0 .. FRAME_SIZE/2]
    const halfN = FRAME_SIZE >> 1;
    const melMin = hzToMel(80);
    const melMax = hzToMel(Math.min(7600, sampleRate / 2));
    const melCenters = new Float64Array(NUM_MEL_FILTERS + 2);
    for (let m = 0; m < NUM_MEL_FILTERS + 2; m++) {
      const mel = melMin + ((melMax - melMin) * m) / (NUM_MEL_FILTERS + 1);
      melCenters[m] = Math.floor(((FRAME_SIZE + 1) * melToHz(mel)) / sampleRate);
    }

    const filterWeights: Array<{ start: number; weights: Float64Array }> = [];
    for (let m = 1; m <= NUM_MEL_FILTERS; m++) {
      const left = Math.max(1, Math.floor(melCenters[m - 1]));
      const center = Math.max(left + 1, Math.floor(melCenters[m]));
      const right = Math.min(halfN - 1, Math.max(center + 1, Math.floor(melCenters[m + 1])));
      const w = new Float64Array(right - left + 1);
      for (let k = left; k <= right; k++) {
        w[k - left] = k <= center ? (k - left) / Math.max(1, center - left) : (right - k) / Math.max(1, right - center);
      }
      filterWeights.push({ start: left, weights: w });
    }

    // Precompute 24-band log-spaced spectral envelope mapping
    const binFreq = sampleRate / FRAME_SIZE;
    const logMin = Math.log(80);
    const logMax = Math.log(Math.min(7600, sampleRate / 2));
    const binBand = new Int8Array(halfN).fill(-1);
    for (let k = 1; k < halfN; k++) {
      const f = k * binFreq;
      if (f < 80 || f > 7600 || f > sampleRate / 2) continue;
      const ratio = (Math.log(f) - logMin) / Math.max(1e-6, logMax - logMin);
      binBand[k] = Math.min(NUM_BANDS - 1, Math.max(0, Math.floor(ratio * NUM_BANDS)));
    }

    const totalFrames = Math.floor(channel.length / FRAME_SIZE);
    const step = Math.max(1, Math.floor(totalFrames / 300));
    const pitchWindowLen = Math.min(2048, Math.max(1024, Math.floor(sampleRate * 0.032)));

    const mfccAccum: number[][] = [];
    const bandAccum = new Array<number>(NUM_BANDS).fill(0);
    const f0Samples: number[] = [];
    let centroidSum = 0;
    let zcrSum = 0;
    let analyzedFrames = 0;
    let voicedFrames = 0;

    const re = new Float64Array(FRAME_SIZE);
    const im = new Float64Array(FRAME_SIZE);
    const mag = new Float64Array(halfN);

    for (let fIdx = 0; fIdx < totalFrames; fIdx += step) {
      analyzedFrames++;
      const offset = fIdx * FRAME_SIZE;
      let energy = 0;
      let zc = 0;
      let prev = channel[offset];
      for (let i = 0; i < FRAME_SIZE; i++) {
        const s = channel[offset + i];
        energy += s * s;
        if (i > 0 && ((s >= 0 && prev < 0) || (s < 0 && prev >= 0))) zc++;
        prev = s;
        re[i] = s * hann[i];
        im[i] = 0;
      }

      const rms = Math.sqrt(energy / FRAME_SIZE);
      if (rms < 0.012) continue;

      voicedFrames++;
      zcrSum += zc / FRAME_SIZE;

      // Estimate F0 pitch roughly every 3rd voiced frame to keep processing ultra-fast
      if (voicedFrames % 3 === 1 && offset + pitchWindowLen < channel.length) {
        const f0 = estimatePitchHz(channel, offset, pitchWindowLen, sampleRate);
        if (f0 !== null) f0Samples.push(f0);
      }

      fftRadix2(re, im);

      let weightedFreqSum = 0;
      let magSum = 0;
      const frameBands = new Array<number>(NUM_BANDS).fill(0);

      for (let k = 1; k < halfN; k++) {
        const m = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
        mag[k] = m;
        magSum += m;
        weightedFreqSum += k * binFreq * m;
        const b = binBand[k];
        if (b >= 0) frameBands[b] += m;
      }

      if (magSum <= 1e-6) continue;
      centroidSum += weightedFreqSum / magSum;

      for (let b = 0; b < NUM_BANDS; b++) {
        bandAccum[b] += Math.log1p((frameBands[b] / magSum) * 100);
      }

      // Compute Mel log energies + DCT-II for MFCC C1..C13 (skipping C0 for gain invariance)
      const logMel = new Float64Array(NUM_MEL_FILTERS);
      for (let m = 0; m < NUM_MEL_FILTERS; m++) {
        const { start, weights } = filterWeights[m];
        let melEnergy = 0;
        for (let j = 0; j < weights.length; j++) {
          const p = mag[start + j];
          melEnergy += p * p * weights[j];
        }
        logMel[m] = Math.log(Math.max(1e-9, melEnergy / (magSum * magSum + 1e-9)));
      }

      const frameMfcc: number[] = [];
      const scale = Math.sqrt(2 / NUM_MEL_FILTERS);
      for (let c = 1; c <= NUM_MFCC; c++) {
        let sum = 0;
        for (let m = 0; m < NUM_MEL_FILTERS; m++) {
          sum += logMel[m] * Math.cos((Math.PI * c * (m + 0.5)) / NUM_MEL_FILTERS);
        }
        frameMfcc.push(sum * scale);
      }
      mfccAccum.push(frameMfcc);
    }

    if (voicedFrames < 4 || mfccAccum.length < 4) return null;

    // Mean and Std of MFCC C1..C13
    const mfccMean = new Array<number>(NUM_MFCC).fill(0);
    for (const row of mfccAccum) {
      for (let c = 0; c < NUM_MFCC; c++) mfccMean[c] += row[c];
    }
    for (let c = 0; c < NUM_MFCC; c++) mfccMean[c] /= mfccAccum.length;

    const mfccStd = new Array<number>(NUM_MFCC).fill(0);
    for (const row of mfccAccum) {
      for (let c = 0; c < NUM_MFCC; c++) {
        const d = row[c] - mfccMean[c];
        mfccStd[c] += d * d;
      }
    }
    for (let c = 0; c < NUM_MFCC; c++) {
      mfccStd[c] = Number(Math.sqrt(mfccStd[c] / mfccAccum.length).toFixed(4));
      mfccMean[c] = Number(mfccMean[c].toFixed(4));
    }

    // L2-normalized 24-band spectral envelope
    const avgBands = bandAccum.map((v) => v / voicedFrames);
    const norm = Math.sqrt(avgBands.reduce((acc, v) => acc + v * v, 0));
    const normalizedBands = norm > 1e-8 ? avgBands.map((v) => Number((v / norm).toFixed(6))) : avgBands;

    // F0 median & interquartile range
    let f0Median = 0;
    let f0Iqr = 0;
    if (f0Samples.length >= 2) {
      f0Samples.sort((a, b) => a - b);
      f0Median = f0Samples[Math.floor(f0Samples.length / 2)];
      const q1 = f0Samples[Math.floor(f0Samples.length * 0.25)];
      const q3 = f0Samples[Math.floor(f0Samples.length * 0.75)];
      f0Iqr = Math.max(0, q3 - q1);
    }

    return {
      version: 2,
      f0Median: Number(f0Median.toFixed(2)),
      f0Iqr: Number(f0Iqr.toFixed(2)),
      mfccMean,
      mfccStd,
      bands: normalizedBands,
      centroid: Number((centroidSum / voicedFrames).toFixed(2)),
      zcr: Number((zcrSum / voicedFrames).toFixed(4)),
      voicedRatio: Number((voicedFrames / Math.max(1, analyzedFrames)).toFixed(3)),
    };
}
