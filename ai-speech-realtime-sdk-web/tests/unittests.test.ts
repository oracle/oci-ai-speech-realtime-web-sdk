/*
** Copyright (c) 2024, Oracle and/or its affiliates. 
** Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl/ 
*/

import {AIServiceSpeechRealtimeApi, RealtimeClientListener, RealtimeWebSocketState} from "../src/ai-speech-realtime-web-client"
import { RealtimeMessageAuthenticationToken, RealtimeMessageOutEventEnum, RealtimeMessageSendFinalResult, RealtimeParameters, RealtimeParametersModelDomainEnum, RealtimeParametersStabilizePartialResultsEnum } from "../src/ai-speech-api-client";
import { RealtimeMessageConnect, RealtimeMessageResult, RealtimeMessageAckAudio } from "../src/ai-speech-api-client";
import { MockNavigator, MockWebSocket } from "./test-resources/mocked-classes";

const listener: RealtimeClientListener = {
    onClose: jest.fn((closeEvent: CloseEvent) => {
      console.log("onClose: ", closeEvent);
    }),
    onConnect: jest.fn((openEvent: Event) => {
      console.log("onConnect: ", openEvent);
    }),
    onError: jest.fn((errorEvent: Error) => {
      console.log("onError: ", errorEvent);
    }),
    onConnectMessage: jest.fn((connectMessage: RealtimeMessageConnect) => {
      console.log("onConnectMessage: ", connectMessage);
    }),
    onResult: jest.fn((resultMessage: RealtimeMessageResult) => {
      console.log("onResult: ", resultMessage);
    }),
    onAckAudio: jest.fn((ackMessage: RealtimeMessageAckAudio) => {
      console.log("onAckAudio: ", ackMessage);
    }),
  };
  
  
describe("TestWebSocketClient", () => {
    let mockWebSocket: MockWebSocket;
    let parameters: RealtimeParameters = {  }
    const COMPARTMENT_ID = "compartmentId"
    const TOKEN = "TOKEN"
    const REALTIME_ENDPOINT = "realtimeEndpoint"
    let api = new AIServiceSpeechRealtimeApi(listener, TOKEN, COMPARTMENT_ID, REALTIME_ENDPOINT, parameters)
    
    beforeAll(() => {
        // Replace global WebSocket wi th the mock
        global.WebSocket = MockWebSocket as any;
        global.navigator = MockNavigator as any
        // Replace the global `navigator` with the mock
        Object.defineProperty(global, "navigator", {
            value: new MockNavigator(),
            configurable: true,
        });
        MockWebSocket.instances = [];
        api.connect()
        mockWebSocket = MockWebSocket.instances[0]
    });

    it("should handle the open event with auth", () => {
        // capture the mock websocket instance that the realtime client created
        expect(mockWebSocket).toBeDefined()
        // have that websocket simulate an open event so we can test the onWebsocketOpen callback
        mockWebSocket.simulateOpen();
        expect(listener.onConnect).toHaveBeenCalled()
        expect(api.getWebSocketState()).toBe(RealtimeWebSocketState.AUTHENTICATING)
        const authPayload: RealtimeMessageAuthenticationToken = {
            authenticationType: TOKEN,
            compartmentId: COMPARTMENT_ID,
            token: TOKEN,
        };
        expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(authPayload))
      });

    it("should handle open event exceptions", () => {
        // cover ws.send catch block
        mockWebSocket.send.mockImplementation(() => {
            throw new Error("send failed")
        })
        mockWebSocket.simulateOpen()
        expect(mockWebSocket.close).toHaveBeenCalled()
        expect(api.getWebSocketState()).toBe(RealtimeWebSocketState.STOPPED)

        // cover auth == false else block before send
        api.realtimeAuthPayload = null
        mockWebSocket.simulateOpen()
        expect(mockWebSocket.close).toHaveBeenCalled()
        expect(api.getWebSocketState()).toBe(RealtimeWebSocketState.STOPPED)

        // cover catch within the catch
        mockWebSocket.close.mockImplementation(() => {
            throw new Error("close failed")
        })
        mockWebSocket.simulateOpen()
        expect(api.getWebSocketState()).toBe(RealtimeWebSocketState.STOPPED)
        expect(listener.onError).toHaveBeenCalled()
    })

    it("should handle websocket connect message catch", () => {
        const connectMessage = '{"event": "CONNECT"}'
        mockWebSocket.simulateMessage(connectMessage)
        expect(listener.onConnectMessage).toHaveBeenCalledWith({"event": "CONNECT"})
        expect(api.getWebSocketState()).toBe(RealtimeWebSocketState.STOPPED)
    })

    it("should handle websocket connect message else", () => {
        const connectMessage = '{"event": "CONNECT"}'
        Object.defineProperty(navigator, "mediaDevices", {
            value: {
              getUserMedia: undefined, // Set it as falsy
            },
            configurable: true, // Allow redefinition
        });
        api.close = jest.fn().mockImplementationOnce(() => {
            throw new Error("mock close error")
        })
        mockWebSocket.simulateMessage(connectMessage)
        expect(listener.onConnectMessage).toHaveBeenCalledWith({"event": "CONNECT"})
        expect(api.getWebSocketState()).toBe(RealtimeWebSocketState.ERROR)
    })
    
    it("should handle websocket ackaudio message", () => {
        const message = '{"event": "ACKAUDIO"}'
        mockWebSocket.simulateMessage(message)
        expect(listener.onAckAudio).toHaveBeenCalledWith({"event": "ACKAUDIO"})
    })
    
    it("should handle websocket result message", () => {
        const message = '{"event": "RESULT"}'
        mockWebSocket.simulateMessage(message)
        expect(listener.onResult).toHaveBeenCalledWith({"event": "RESULT"})
    })
    
    it("should handle websocket error message", () => {
        const message = '{"event": "ERROR"}'
        mockWebSocket.simulateMessage(message)
        expect(api.getWebSocketState()).toBe(RealtimeWebSocketState.ERROR)
    })

    it("should handle websocket close event", () => {
        mockWebSocket.simulateClose();
        expect(listener.onClose).toHaveBeenCalled()
        expect(api.getWebSocketState()).toBe(RealtimeWebSocketState.STOPPED)
    })

    it("should parse parameters", () => {
        parameters = {
            isAckEnabled: false,
            partialSilenceThresholdInMs: 0,
            finalSilenceThresholdInMs: 1000,
            stabilizePartialResults: RealtimeParametersStabilizePartialResultsEnum.MEDIUM,
            shouldIgnoreInvalidCustomizations: false,
            languageCode: "en-US",
            modelDomain: RealtimeParametersModelDomainEnum.GENERIC,
            customizations: [{"compartmentId": "12345", "customizationAlias": "test"}]
        }
        api = new AIServiceSpeechRealtimeApi(listener, TOKEN, COMPARTMENT_ID, REALTIME_ENDPOINT, parameters)
        MockWebSocket.instances = [];
        api.connect()
        mockWebSocket = MockWebSocket.instances[0]
        expect(mockWebSocket.url).toBe("realtimeEndpoint?isAckEnabled=false&partialSilenceThresholdInMs=0&finalSilenceThresholdInMs=1000&languageCode=en-US&modelDomain=GENERIC&stabilizePartialResults=MEDIUM&shouldIgnoreInvalidCustomizations=false&customizations=%5B%7B%22compartmentId%22%3A%2212345%22%2C%22customizationAlias%22%3A%22test%22%7D%5D")
    })

    it("should send final result", () => {
        const requestMessage: RealtimeMessageSendFinalResult = {
            event: RealtimeMessageOutEventEnum.SEND_FINAL_RESULT,
        };
        api.requestFinalResult()
        expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(requestMessage))
    })

    it("should close", () => {
        api.close()
        expect(mockWebSocket.close).toHaveBeenCalled()
        mockWebSocket.close = jest.fn().mockImplementationOnce(() => {
            throw new Error("mock close error")
        })
        api.close()
        expect(api.getWebSocketState()).toBe(RealtimeWebSocketState.ERROR)
        expect(listener.onError).toHaveBeenCalled()
    })
    
});