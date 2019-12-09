import React from 'react';
import {Map} from 'immutable';
import {webClient, defaultState} from './web-client';

export interface IWebClientState {
  init: boolean
  join: boolean
  publish: boolean
  localStream: any
  remoteStreams: Map<number, any>
}

export const WebClientContext = React.createContext({} as IWebClientState);

export const Container: React.FC<{}> = ({children}) => {

  const [state, updateState] = React.useState<IWebClientState>(defaultState);

  React.useEffect(() => {
    webClient.subscribe((state: IWebClientState) => {
      updateState(state);
    });
    return () => {
      webClient.unsubscribe();
    }
  }, []);

  const value = state;

  return (
    <WebClientContext.Provider value={value}>
      {children}
    </WebClientContext.Provider>
  )
}