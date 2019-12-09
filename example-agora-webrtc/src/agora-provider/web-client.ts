import AgoraRTC from 'agora-rtc-sdk';
import { Map } from 'immutable';
import { IWebClientState } from './container';
import { Subject } from 'rxjs';
import { EventEmitter } from 'events';

const APP_ID = process.env.REACT_APP_AGORA_APP_ID as string;

const ClientEvents: any[] = [
  "error",
  "exception",
  "network-quality",
  "peer-leave",
  "stream-subscribed",
  "stream-added",
  "stream-removed",
  "stream-published",
  "connection-state-changed"
];

export const defaultState: IWebClientState = {
  init: false,
  join: false,
  publish: false,
  localStream: null,
  remoteStreams: Map<number, any>()
}

export class AgoraWebClient extends EventEmitter {
  private subject: Subject<IWebClientState> | null;
  public state: IWebClientState;
  public readonly client: any | null;
  private events: any[] = [];
  private localStream: any;
  constructor() {
    super();
    this.state = defaultState;
    this.client = AgoraRTC.createClient({
      mode: 'rtc',
      codec: 'h264'
    });
    this.subject = null;
  }

  commit(state: IWebClientState) {
    this.subject && this.subject.next(state);
  }

  initialize() {
    this.subject = new Subject<IWebClientState>();
    this.subject.next(defaultState);
  }

  subscribe(setState: any) {
    this.initialize();
    this.subject && this.subject.subscribe(setState);
  }

  unsubscribe() {
    this.subject && this.subject.unsubscribe();
    this.subject = null;
  }

  async init () {
    await new Promise((resolve, reject) => {
      this.client.init(APP_ID, () => {
        this.state = {
          ...this.state,
          init: true,
        }
        this.commit(this.state);
        resolve();
      }, reject);
    })
  }

  subscribeClientEvents() {
    for (let event of ClientEvents) {
      this.events.push(event);
      this.client.on(event, (evt: any) => {
        this.emit(event, evt);
      })
    }
  }

  unsubscribeClientEvents() {
    for (let event of this.events) {
      this.client.off(event, () => {});
    }
    this.events = [];
  }

  async join(uid: number, cname: string) {
    await new Promise((resolve, reject) => {
      const webClient = this;
      webClient.on('error', (evt: any) => {
        console.warn('error', evt);
      });
      webClient.on('exception', (evt: any) => {
        console.warn('exception', evt);
      });
      // webClient.on('network-quality', (evt: any) => {
      //   console.warn('network-quality', evt);
      // });
      webClient.on('peer-leave', (evt: any) => {
        webClient.removeRemote(evt.uid);
      });
      webClient.on('stream-subscribed', (evt: any) => {
        const uid = evt.stream.getId();
        webClient.addRemoteStreams(uid, evt.stream);
      })
      webClient.on('stream-added', (evt: any) => {
        console.log(" peer stream ", evt.stream.getId());
        webClient.client.subscribe(evt.stream, {audio: true, video: true});
      });
      webClient.on('stream-removed', (evt: any) => {
        webClient.removeRemote(evt.stream.getId());
      });
      webClient.on('stream-published', (evt: any) => {
        console.log("stream published", evt.stream);
        webClient.addLocal(evt.stream);
      });
      webClient.on('connection-state-change', (evt: any) => {
      });
      this.subscribeClientEvents();
      this.client.join(null, cname, uid, () => {
        this.state = {
          ...this.state,
          join: true,
        }
        this.commit(this.state);
        resolve()
      }, reject);
    })
  }

  async leave() {
    await new Promise((resolve, reject) => {
      this.unsubscribeClientEvents();
      this.client.leave(() => {
        this.state = {
          ...this.state,
          join: false,
          publish: false,
        }
        this.commit(this.state);
        resolve();
      }, reject);
    })
  }

  async createLocalStream(uid: number) {
    const stream = AgoraRTC.createStream({
      video: true,
      audio: true,
      microphoneId: '',
      cameraId: '',
      streamID: uid,
      mirror: false,
    });
    await new Promise((resolve, reject) => {
      stream.init(() => {
        this.localStream = stream;
        resolve();
      }, reject);
    })
  }

  async publish() {
    await new Promise((resolve, reject) => {
      if (this.localStream) {
        this.client.publish(this.localStream, reject)
        setTimeout(() => {
          this.state = {
            ...this.state,
            publish: true,
          }
          this.commit(this.state);
          resolve()
        }, 300);
      }
      resolve();
    });
  }

  async unpublish() {
    this.localStream && this.localStream.close();
    this.localStream = null;
    this.remoteAllStreams();
  }

  async startBroadcasting(uid: number, cname: string) {
    await this.init();
    await this.join(uid, cname);
    await this.createLocalStream(uid);
    await this.publish();
  }

  async stopBroadcasting() {
    this.removeAllListeners();
    await this.unpublish();
    await this.leave();
  }


  addLocal(stream: any) {
    this.state = {
      ...this.state,
      localStream: stream
    }
    this.commit(this.state);
  }

  removeLocal() {
    this.state.localStream && this.state.localStream.close();
    this.state = {
      ...this.state,
      localStream: null
    }
    this.commit(this.state);
  }

  addRemoteStreams(uid: number, stream: any) {
    this.state = {
      ...this.state,
      remoteStreams: this.state.remoteStreams.set(uid, stream)
    }
    this.commit(this.state);
  }

  removeRemote(uid: number) {
    const remoteStream = this.state.remoteStreams.get(uid);
    if (remoteStream) {
      remoteStream.isPlaying() && remoteStream.stop();
    }
    this.state = {
      ...this.state,
      remoteStreams: this.state.remoteStreams.delete(uid)
    }
    this.commit(this.state);
  }

  remoteAllStreams () {
    this.removeLocal();
    this.state.remoteStreams.forEach((stream: AgoraRTC.Stream) => {
      stream.isPlaying() && stream.stop();
    });
  }
}

export const webClient = new AgoraWebClient();

