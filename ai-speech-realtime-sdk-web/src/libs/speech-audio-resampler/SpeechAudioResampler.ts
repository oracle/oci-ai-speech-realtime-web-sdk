/*
**
** Copyright (c) 2024 Oracle and/or its affiliates
** Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl/
*/

import { LP_275_TO_100_FIR, LP_2_TO_1_FIR, LP_3_TO_1_FIR } from "./filters";

export declare type SampleRate = 8000 | 16000 | 24000 | 32000 | 48000 | 96000 | 192000 | 384000 | 11025 | 22050 | 44100 | 88200 | 176400 | 352800;
export default class AudioResampler {
  /**
   * Initialize a AudioResampler instance so that configurations need not to be applied before every chunk.
   *
   * @param {SampleRate} oldSampleRate Input sample rate for the audio buffer
   * @param {SampleRate} newSampleRate Target sample rate for the audio buffer
   * @param {boolean} liveAudio Set whether the audio is live (multiple sequential chunks) or a single audio buffer.
   * @param {boolean} antiAlias Set whether to enable or disable Anti-aliasing filters. Recommended for downsampling, disabled by default for upsampling.
   * @returns {AudioResampler}
   */
  constructor(oldSampleRate: SampleRate, newSampleRate: SampleRate, liveAudio: boolean, antiAlias?: boolean) {
    this.oldSampleRate = oldSampleRate;
    this.newSampleRate = newSampleRate;
    this.antiAlias = oldSampleRate > newSampleRate ? antiAlias : false;
    this.decimationFactor = oldSampleRate / newSampleRate;
    this.liveAudio = liveAudio;
  }

  oldSampleRate: SampleRate;
  newSampleRate: SampleRate;
  antiAlias: boolean = true;
  decimationFactor: number;
  liveAudio: boolean;
  isFirstFrame: boolean = true;
  filterBuffer: Float32Array = new Float32Array();

  /**
   * Lanczos resampling
   * https://en.wikipedia.org/wiki/Lanczos_resampling
   *
   * @private
   * @param {number} a
   * @param {number} t
   * @returns {number}
   */
  private lanczosWindow = (a: number, t: number): number => {
    if (t === 0) return 1;
    if (t >= a || t <= -a) return 0;

    const p = Math.PI * t;
    return (a * Math.sin(p) * Math.sin(p / a)) / (p * p);
  };

  /**
   * Downsampling with Anti-Aliasing
   *
   * @private
   * @param {Float32Array} buffer
   * @returns {Float32Array}
   */
  private antiAliasDownsample = (buffer: Float32Array): Float32Array => {
    let filter = [];
    if (this.decimationFactor === 3) {
      filter = LP_3_TO_1_FIR;
    } else if (this.decimationFactor === 2) {
      filter = LP_2_TO_1_FIR;
    } else if (this.decimationFactor === 2.75625) {
      filter = LP_275_TO_100_FIR;
    } else {
      throw new Error(this.oldSampleRate + " kHz is not an expected input sampling frequency for conversion into " + this.newSampleRate + " kHz");
    }

    let nSamplesForNextFrame: number; //number of samples set aside for the next frame
    let nSamplesCurrentFrame: number; //number of samples taken for the current frame
    let workBuffer: Float32Array; //working buffer for the current chunk

    if (this.isFirstFrame) {
      nSamplesForNextFrame = Math.floor(buffer.length % this.decimationFactor); //number of samples saved for the next frame
      nSamplesCurrentFrame = buffer.length - nSamplesForNextFrame; //number of samples selected for the current frame

      if (nSamplesForNextFrame === 0) {
        workBuffer = buffer;
      } else {
        workBuffer = buffer.slice(0, nSamplesCurrentFrame);
      }
    } else {
      nSamplesForNextFrame = Math.floor((buffer.length + this.filterBuffer.length - filter.length) % this.decimationFactor); // Avoid temporal shift
      nSamplesCurrentFrame = buffer.length + this.filterBuffer.length - filter.length - nSamplesForNextFrame;

      workBuffer = new Float32Array(this.filterBuffer.length + nSamplesCurrentFrame);
      workBuffer.set(this.filterBuffer);
      workBuffer.set(buffer.slice(0, nSamplesCurrentFrame), this.filterBuffer.length);
    }

    // Apply filtering and decimation / interpolation
    const outBufferLength = Math.floor(nSamplesCurrentFrame / this.decimationFactor);
    const outBuffer = new Float32Array(outBufferLength);

    // decimationFactor is an integer (3)
    if (this.decimationFactor === 3 || this.decimationFactor === 2) {
      for (let i = filter.length; i < workBuffer.length; i += this.decimationFactor) {
        // Low Pass filtering
        let acc = 0;
        for (let k = 0; k < filter.length; k++) {
          acc += workBuffer[i - k] * filter[k];
        }

        // Handle clipping and short formatting
        const formattedValue = Math.max(Math.min(acc, 1), -1);

        // Decimation
        outBuffer[(i - filter.length) / this.decimationFactor] = formattedValue;
      }
    } else if (this.decimationFactor === 2.75625) {
      // 44100 kHz : decimationFactor is not an integer (~2.75)
      // Low Pass filtering
      const LP_SIGNAL = [];
      for (let i = filter.length; i < workBuffer.length; i++) {
        let acc = 0;
        for (let k = 0; k < filter.length; k++) {
          acc += workBuffer[i - k] * filter[k];
        }
        LP_SIGNAL[i - filter.length] = acc;
      }

      // Decimation / interpolation
      for (let n = 0; n < outBufferLength; n++) {
        const a = 3; // Lanczos window type 3
        const x = n * this.decimationFactor;
        const start = Math.floor(x) - a + 1;
        const end = Math.floor(x) + a;
        let acc = 0;

        for (let i = start; i <= end; i++) {
          let s;
          if (i < 0) s = LP_SIGNAL[0];
          else if (i >= LP_SIGNAL.length) s = LP_SIGNAL[LP_SIGNAL.length - 1];
          else s = LP_SIGNAL[i];
          acc += s * this.lanczosWindow(a, x - i);
        }

        // Handle clipping and short formatting
        outBuffer[n] = Math.max(Math.min(acc, 1), -1);
      }
    }

    // Update filterBuffer with the last samples of current frame
    if (this.isFirstFrame) {
      this.filterBuffer = buffer.slice(nSamplesCurrentFrame - filter.length - this.filterBuffer.length);
    } else {
      this.filterBuffer = buffer.slice(nSamplesCurrentFrame - filter.length - (this.filterBuffer.length - filter.length));
    }

    // First frame already handled
    this.isFirstFrame = false; // will be re-initialized when listening is done (allowing next records)
    return outBuffer;
  };

  /**
   * Upsampling
   *
   * @private
   * @param {Float32Array} buffer
   * @returns {Float32Array}
   */
  private upsample = (buffer: Float32Array): Float32Array => {
    return buffer;
  };

  /**
   * Downsampling without Anti-Aliasing
   *
   * @private
   * @param {Float32Array} buffer
   * @returns {Float32Array}
   */
  private downsample = (buffer: Float32Array): Float32Array => {
    return buffer;
  };

  /**
   * Resampling with applied config.
   * Determines whether to downsample or upsample using `oldSampleRate` and `newSampleRate` values.
   * @public
   * @param {Float32Array} buffer
   * @returns {Float32Array}
   */
  resample = (buffer: Float32Array): Float32Array => {
    if (this.decimationFactor === 1) {
      return buffer;
    } else if (this.decimationFactor > 1) {
      if (this.antiAlias) {
        return this.antiAliasDownsample(buffer);
      } else {
        return this.downsample(buffer);
      }
    } else {
      return this.upsample(buffer);
    }
  };

  /**
   * Encodes audio buffers as WAVE Format.
   *
   * @public
   * @param {Float32Array} buffer
   * @returns {DataView}
   */
  encodeAsWav = (buffer: Float32Array): DataView => {
    return new DataView(new ArrayBuffer(buffer.length));
  };
}
