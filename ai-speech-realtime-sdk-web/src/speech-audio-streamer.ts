/*
 ** Copyright (c) 2024, 2025, Oracle and/or its affiliates.
 ** Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl/
 */

import AudioResampler from "./libs/speech-audio-resampler";
import { SampleRate } from "./libs/speech-audio-resampler/SpeechAudioResampler";

declare global {
  interface Window {
    webkitAudioContext: any;
    mozAudioContext: any;
    webkitMediaStream: any;
    process: any;
  }
  interface Navigator {
    msSaveOrOpenBlob: any;
    msSaveBlob: any;
  }
}

export interface AudioStreamConfig {
  sampleRate: number;
  mimeType: string;
  bitRate: number;
  bufferSize: 0 | 256 | 512 | 1024 | 2048 | 4096 | 8192 | 16384;
  callBack?: Function;
}

export declare type AudioWorker = {
  worker: Worker;
  workerURL: string;
};

export declare type AudioStreamState = "PAUSED" | "RECORDING" | "INACTIVE" | "STOPPED" | "DESTROYED";

export default class AudioStreamer {
  constructor(mediaStream: MediaStream, config: AudioStreamConfig) {
    this.config = config;
    this.mediaStream = mediaStream;
    this.state = "INACTIVE";
    this.enableCompatibility();
  }

  mediaStream: MediaStream;
  config: AudioStreamConfig;
  state: AudioStreamState;
  blob: Blob;

  audioNode: ScriptProcessorNode;
  audioInput: MediaStreamAudioSourceNode;
  audioProcessStatus: boolean = false;
  audioContext: AudioContext;
  audioResampler: AudioResampler;

  timeSlicedAudioBuffer: { bufferArray: Array<Float32Array>; length: number };
  completeAudioBuffer: { bufferArray: Array<Float32Array>; length: number };

  onAudioDataAvailable = (e: AudioProcessingEvent) => {
    if (this.getState() === "PAUSED") {
      return;
    }

    if (!this.isMediaStreamActive()) {
      this.audioNode.disconnect();
      this.setState("STOPPED");
    }

    if (this.getState() !== "RECORDING") {
      if (this.audioInput) {
        this.audioInput.disconnect();
        this.audioInput = {} as typeof AudioStreamer.prototype.audioInput;
      }
      return;
    }

    if (!this.audioProcessStatus) this.audioProcessStatus = true;

    const bufferData = e.inputBuffer.getChannelData(0);
    const buffersCopy = new Float32Array(bufferData);

    this.timeSlicedAudioBuffer.bufferArray.push(buffersCopy);
    this.timeSlicedAudioBuffer.length += this.config.bufferSize;

    if (this.getState() !== "RECORDING" || typeof this.config.callBack !== "function") return;
    if (this.timeSlicedAudioBuffer.bufferArray.length) {
      this.processAudioBuffers();
      this.timeSlicedAudioBuffer = { bufferArray: [], length: 0 };
    }
  };

  private callBack = (buffer: ArrayBuffer, view: DataView) => {
    const blob = new Blob([view], {
      type: "audio/wav",
    });
    this.config.callBack(blob);
  };

  private processAudioBuffers = () => {
    const sampleRate = this.audioContext.sampleRate;
    const targetSampleRate = this.config.sampleRate;
    const audioBuffer = this.timeSlicedAudioBuffer;

    let buffers = mergeBuffers(audioBuffer.bufferArray.slice(0), audioBuffer.length);

    if (sampleRate !== targetSampleRate) buffers = this.audioResampler.resample(buffers);

    function mergeBuffers(bufferArray: Array<Float32Array>, bufferLength: number) {
      const result = new Float32Array(bufferLength);
      let offset = 0;
      const length = bufferArray.length;
      for (let i = 0; i < length; i++) {
        const buffer = bufferArray[i];
        result.set(buffer, offset);
        offset += buffer.length;
      }
      return result;
    }

    const interleavedLength = buffers.length;
    const resultingBufferLength = interleavedLength * 2;
    const buffer = new ArrayBuffer(resultingBufferLength);
    const view = new DataView(buffer);

    // data chunk length
    // write the PCM samples
    const lng = interleavedLength;
    let index = 0;
    const volume = 1;
    for (let i = 0; i < lng; i++) {
      view.setInt16(index, buffers[i] * (0x7fff * volume), true);
      index += 2;
    }

    this.callBack(buffer, view);
  };

  private enableCompatibility = () => {
    window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext;

    window.URL = window.URL || window.webkitURL;

    window.MediaStream = window.MediaStream || window.webkitMediaStream;
  };

  private setState = (state: AudioStreamState) => {
    this.state = state;
  };

  private initiateAudioWithSampleRate = (sampleRate: number) => {
    this.audioContext = new window.AudioContext({ sampleRate: sampleRate });
    this.audioInput = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.audioNode = this.audioContext.createScriptProcessor(this.config.bufferSize, 1, 1);

    this.audioInput.connect(this.audioNode);
    this.audioNode.onaudioprocess = this.onAudioDataAvailable;
    this.audioNode.connect(this.audioContext.createMediaStreamDestination());

    this.audioResampler = new AudioResampler(this.audioContext.sampleRate as SampleRate, this.config.sampleRate as SampleRate, true, true);
  };

  private initiateAudio = () => {
    try {
      this.config.bufferSize = this.config.bufferSize || 1024;
      this.initiateAudioWithSampleRate(16000);
    } catch (err) {
      try {
        this.config.bufferSize = 4096;
        this.initiateAudioWithSampleRate(48000);
      } catch (err) {
        try {
          this.config.bufferSize = 4096;
          this.initiateAudioWithSampleRate(44100);
        } catch (err) {
          console.log(err);
          this.reset();
          return false;
        }
      }
    }
    return true;
  };

  private isMediaStreamActive = () => {
    if ("active" in this.mediaStream) {
      if (!this.mediaStream.active) {
        // console.error("Please make sure MediaStream is active.");
        return false;
      }
    }
    return true;
  };

  private reset = () => {
    this.setState("INACTIVE");
    this.state = "INACTIVE";
    this.blob = new Blob();
    this.audioContext = {} as AudioContext;
    if (this.audioNode) {
      this.audioNode.onaudioprocess = null;
      try {
        this.audioNode.disconnect();
      } catch (err) {
        // console.error(err);
      }
      this.audioNode = {} as ScriptProcessorNode;
    }
    if (this.audioInput) {
      try {
        this.audioInput.disconnect();
      } catch (err) {
        // console.error(err);
      }
      this.audioInput = {} as MediaStreamAudioSourceNode;
    }
    this.audioProcessStatus = false;
    this.audioContext = {} as AudioContext;
    this.timeSlicedAudioBuffer = {
      length: 0,
      bufferArray: [],
    } as typeof AudioStreamer.prototype.timeSlicedAudioBuffer;
    this.completeAudioBuffer = {
      length: 0,
      bufferArray: [],
    } as typeof AudioStreamer.prototype.completeAudioBuffer;
    this.audioResampler = null;
  };

  private getTracks = (mediaStream: MediaStream) => {
    if (!mediaStream || !mediaStream.getTracks) {
      return [];
    }
    return mediaStream.getTracks().filter((track) => track.kind === "audio");
  };

  startRecording = () => {
    this.reset();
    if (this.isMediaStreamActive()) {
      this.setState("RECORDING");
      return this.initiateAudio();
    } else return false;
  };

  pauseRecording = () => {
    if (this.state === "PAUSED") return;
    this.setState("PAUSED");
  };

  resumeRecording = () => {
    this.isMediaStreamActive();
    if (this.state !== "PAUSED") return;
    this.setState("RECORDING");
  };

  stopRecording = (callback: Function) => {
    callback = callback || (() => {});

    if (this.state === "PAUSED") {
      this.resumeRecording();
      setTimeout(() => {
        this.stopRecording(callback);
      }, 1);
      return;
    }

    this.setState("STOPPED");
    if (callback) {
      let url;
      try {
        url = URL.createObjectURL(this.blob);
      } catch (e) {}

      if (typeof callback.call === "function") {
        callback.call(this, url);
      } else {
        callback(url);
      }
    }
    this.reset();
  };

  destroy = () => {
    this.reset();
    this.mediaStream = {} as MediaStream;
    this.setState("DESTROYED");
  };

  getBlob = () => {
    if (!this.blob) return new Blob();
    return this.blob;
  };

  getURL = () => {
    if (!this.blob) return;
    return URL.createObjectURL(this.blob);
  };

  getState = () => {
    return this.state;
  };
}
