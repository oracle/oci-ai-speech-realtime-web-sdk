// Mock implementation of WebSocket
export class MockWebSocket {
    static instances: MockWebSocket[] = []; // Track created instances
    constructor(url: string) {
        if (!url || typeof url !== "string") {
            throw new Error("A valid WebSocket URL must be provided.");
        }
        this.url = url; // Capture the provided URL
        MockWebSocket.instances.push(this); // Track this instance
    }
    url = ""
    onopen: (() => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
  
    send = jest.fn();
    close = jest.fn();
  
    // Simulate opening the connection
    simulateOpen() {
      if (this.onopen) {
        this.onopen();
      }
    }
  
    // Simulate receiving a message
    simulateMessage(data: any) {
      if (this.onmessage) {
        this.onmessage({ data } as MessageEvent);
      }
    }
  
    // Simulate closing the connection
    simulateClose(event: Partial<CloseEvent> = {}) {
      if (this.onclose) {
        this.onclose(event as CloseEvent);
      }
    }
  
    // Simulate an error
    simulateError(event: Partial<Event> = {}) {
      if (this.onerror) {
        this.onerror(event as ErrorEvent);
      }
    }
  }

interface MockAudioStreamConfig {
  sampleRate: number;
  mimeType: string;
  bitRate: number;
  bufferSize: 0 | 256 | 512 | 1024 | 2048 | 4096 | 8192 | 16384;
  callBack?: Function;
}

export class MockAudioStreamer {
  mediaStream: MediaStream;
  config: MockAudioStreamConfig;
  state: string;
  constructor(mediaStream: MediaStream, config: MockAudioStreamConfig) {
    console.log("mock audio streamer used")
    this.config = config;
    this.mediaStream = mediaStream;
    this.state = "INACTIVE";
    this.enableCompatibility();
  }
  startRecording() {return true}
  enableCompatibility() {
    return true;
  }
}


// Mocking MediaStream class
export class MockMediaStream {
  id: string;
  tracks: MediaStreamTrack[];

  constructor(id = "mock-stream-id") {
    this.id = id;
    this.tracks = [];
  }

  getTracks() {
    return this.tracks;
  }
}

// Mocking the Navigator class with mediaDevices and getUserMedia
export class MockNavigator {
  mediaDevices: {
    getUserMedia: jest.Mock;
  };

  constructor() {
    this.mediaDevices = {
      getUserMedia: jest.fn((constraints) => {
        console.log("getUserMedia called with:", constraints);
        // Return a mocked MediaStream when getUserMedia is called
        return Promise.resolve(new MockMediaStream());
      }),
    };
  }
}

  