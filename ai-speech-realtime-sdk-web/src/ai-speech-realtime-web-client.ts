/*
 ** Copyright (c) 2024, 2025, Oracle and/or its affiliates.
 ** Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl/
 */

import AudioStreamer, { AudioStreamConfig } from "./speech-audio-streamer";
import {
  RealtimeMessage,
  RealtimeMessageAckAudio,
  RealtimeMessageAuthenticationToken,
  RealtimeMessageAuthenticationAuthenticationTypeEnum,
  RealtimeMessageEventEnum,
  RealtimeMessageConnect,
  RealtimeMessageError,
  RealtimeMessageResult,
  RealtimeParameters,
  RealtimeMessageSendFinalResult,
  RealtimeParametersModelDomainEnum,
  RealtimeParametersStabilizePartialResultsEnum,
  RealtimeMessageOutEventEnum,
  RealtimeParametersPunctuationEnum,
} from "./ai-speech-api-client";

export enum RealtimeWebSocketState {
  "STOPPED",
  "RUNNING",
  "OPENING",
  "AUTHENTICATING",
  "ERROR",
}

export interface RealtimeClientListener {
  onClose(closeEvent: CloseEvent): any;
  onConnect(openEvent: Event): any;
  onError(errorEvent: Error): any;
  onConnectMessage(connectMessage: RealtimeMessageConnect): any;
  onResult(resultMessage: RealtimeMessageResult): any;
  onAckAudio(ackMessage: RealtimeMessageAckAudio): any;
}
export class AIServiceSpeechRealtimeApi {
  constructor(realtimeClientListener: RealtimeClientListener, token: string, compartmentId: string, realtimeEndpoint?: string, realtimeParameters?: RealtimeParameters) {
    this.realtimeClientListener = realtimeClientListener;
    this.token = token;
    this.compartmentId = compartmentId;
    if (realtimeParameters) this.realtimeParameters = realtimeParameters;
    if (realtimeEndpoint) this.realtimeEndpoint = realtimeEndpoint;
  }

  token: string;
  realtimeEndpoint: string;
  realtimeWebSocketClient: WebSocket;
  realtimeWebSocketState: RealtimeWebSocketState;
  realtimeParameters: RealtimeParameters = {
    isAckEnabled: false,
    shortPauseInMs: 0,
    longPauseInMs: 1000,
    stabilizePartialResults: RealtimeParametersStabilizePartialResultsEnum.MEDIUM,
    shouldIgnoreInvalidCustomizations: false,
    languageCode: "en-US",
    modelDomain: RealtimeParametersModelDomainEnum.GENERIC,
    modelType: "ORACLE",
    encoding: "audio/raw;rate=16000",
    punctuation: RealtimeParametersPunctuationEnum.NONE,
  } as RealtimeParameters;
  audioStreamer: AudioStreamer;
  audioStreamConfig: AudioStreamConfig;
  mediaStream: MediaStream;
  realtimeAuthPayload: RealtimeMessageAuthenticationToken;
  compartmentId: string;
  realtimeClientListener: RealtimeClientListener;

  private onWebsocketOpen = (event: Event) => {
    this.realtimeClientListener.onConnect(event);
    this.setWebSocketState(RealtimeWebSocketState.AUTHENTICATING);
    try {
      if (this.realtimeAuthPayload !== null) this.realtimeWebSocketClient.send(JSON.stringify(this.realtimeAuthPayload));
      else {
        this.realtimeWebSocketClient.close();
        this.setWebSocketState(RealtimeWebSocketState.STOPPED);
      }
    } catch (error) {
      try {
        this.realtimeWebSocketClient.close();
      } catch (err) {
        this.onWebsocketError(err);
      }
      this.setWebSocketState(RealtimeWebSocketState.STOPPED);
    }
  };

  private onWebsocketClose = (close: CloseEvent) => {
    this.close();
    this.setWebSocketState(RealtimeWebSocketState.STOPPED);
    this.realtimeClientListener.onClose(close);
  };

  private onWebsocketMessage = (message: MessageEvent) => {
    if (message.data) {
      const data = JSON.parse(message.data.toString()) as RealtimeMessage;
      const realtimeMessageEvent: RealtimeMessageEventEnum = data.event;
      if (realtimeMessageEvent === "ACKAUDIO") {
        this.realtimeClientListener.onAckAudio(data as any as RealtimeMessageAckAudio);
      } else if (realtimeMessageEvent === "CONNECT") {
        this.initAudio();
        this.realtimeClientListener.onConnectMessage(data as any as RealtimeMessageConnect);
      } else if (realtimeMessageEvent === "RESULT") {
        this.realtimeClientListener.onResult(data as any as RealtimeMessageResult);
      } else if (realtimeMessageEvent === "ERROR") {
        const errorMessage = (data as any as RealtimeMessageError).code + ": " + (data as any as RealtimeMessageError).message;
        this.onWebsocketError(new Error(errorMessage));
      }
    }
  };

  private onWebsocketError = (error: Error) => {
    console.error(error);
    this.setWebSocketState(RealtimeWebSocketState.ERROR);
    this.realtimeClientListener.onError(error);
  };

  private initAudio = () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            this.mediaStream = stream;
            this.audioStreamer = new AudioStreamer(this.mediaStream, {
              mimeType: "audio/wav",
              bitRate: 256000,
              sampleRate: 16000,
              bufferSize: 1024,
              callBack: (data: Blob) => {
                data.arrayBuffer().then((arrayBuffer) => {
                  if (this.realtimeWebSocketClient.readyState !== WebSocket.CLOSED && this.realtimeWebSocketClient.readyState !== WebSocket.CLOSING) {
                    setTimeout(() => this.realtimeWebSocketClient.send(arrayBuffer), 1);
                  }
                });
              },
            });
            if (this.audioStreamer.startRecording()) this.setWebSocketState(RealtimeWebSocketState.RUNNING);
            else this.setWebSocketState(RealtimeWebSocketState.ERROR);
          })
          .catch((err) => {
            this.onWebsocketError(err);
          });
      } else {
        throw new Error("getUserMedia not supported on your browser.");
      }
    } catch (err) {
      this.onWebsocketError(err);
      try {
        this.close();
      } catch (error) {
        this.onWebsocketError(error);
        this.close();
      }
      this.setWebSocketState(RealtimeWebSocketState.ERROR);
    }
  };

  private parseParameters = (params: RealtimeParameters) => {
    let parameterString = "?";
    if (params.isAckEnabled !== undefined) parameterString += "isAckEnabled=" + params.isAckEnabled + "&";
    if (params.encoding !== undefined) parameterString += "encoding=" + params.encoding + "&";
    if (params.partialSilenceThresholdInMs !== undefined) parameterString += "partialSilenceThresholdInMs=" + params.partialSilenceThresholdInMs + "&";
    if (params.finalSilenceThresholdInMs !== undefined) parameterString += "finalSilenceThresholdInMs=" + params.finalSilenceThresholdInMs + "&";
    if (params.languageCode !== undefined) parameterString += "languageCode=" + params.languageCode + "&";
    if (params.modelDomain !== undefined) parameterString += "modelDomain=" + params.modelDomain + "&";
    if (params.modelType !== undefined && params.modelType !== "ORACLE") parameterString += "modelType=" + params.modelType + "&";
    if (params.stabilizePartialResults !== undefined) parameterString += "stabilizePartialResults=" + params.stabilizePartialResults + "&";
    if (params.shouldIgnoreInvalidCustomizations !== undefined) parameterString += "shouldIgnoreInvalidCustomizations=" + params.shouldIgnoreInvalidCustomizations + "&";
    if (params.punctuation !== undefined && params.punctuation !== RealtimeParametersPunctuationEnum.NONE) parameterString += "punctuation=" + params.punctuation + "&";
    if (params.customizations !== undefined && params.customizations.length > 0) {
      parameterString += "customizations=" + encodeURIComponent(JSON.stringify(params.customizations));
    }

    return parameterString;
  };

  private createAuthenticationPayload = (authType: RealtimeMessageAuthenticationAuthenticationTypeEnum) => {
    const payload: RealtimeMessageAuthenticationToken = {
      authenticationType: authType,
      compartmentId: this.compartmentId,
      token: this.token,
    };
    this.realtimeAuthPayload = payload;
  };

  public connect = () => {
    try {
      this.realtimeWebSocketClient = new WebSocket(this.realtimeEndpoint + this.parseParameters(this.realtimeParameters));
      this.realtimeWebSocketClient.onopen = (open: Event) => this.onWebsocketOpen(open);
      this.realtimeWebSocketClient.onmessage = (message: MessageEvent) => this.onWebsocketMessage(message);
      this.realtimeWebSocketClient.onclose = (close: CloseEvent) => this.onWebsocketClose(close);
      this.realtimeWebSocketClient.onerror = (event: ErrorEvent) => this.onWebsocketError(new Error(`${event.type}: ${event.message}`));
      this.setWebSocketState(RealtimeWebSocketState.OPENING);
      this.createAuthenticationPayload("TOKEN");
    } catch (err) {
      this.onWebsocketError(err);
      this.close();
    }
  };

  public close = () => {
    try {
      if (this.audioStreamer) {
        this.audioStreamer.stopRecording(() => {
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
          }
        });
      }
    } catch (err) {
      this.onWebsocketError(err);
    }
    try {
      this.realtimeWebSocketClient.close();
    } catch (err) {
      this.onWebsocketError(err);
    }
  };

  public getWebSocketState = () => {
    return this.realtimeWebSocketState;
  };

  public setWebSocketState = (state: RealtimeWebSocketState) => {
    this.realtimeWebSocketState = state;
  };

  public requestFinalResult = () => {
    const requestMessage: RealtimeMessageSendFinalResult = {
      event: RealtimeMessageOutEventEnum.SEND_FINAL_RESULT,
    };
    this.realtimeWebSocketClient.send(JSON.stringify(requestMessage));
  };
}
