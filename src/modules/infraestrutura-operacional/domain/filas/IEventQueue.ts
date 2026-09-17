export interface IEvent {
  eventName: string;
  timestamp: Date;
  payload: any;
}

export interface IEventQueue {
  publish(event: IEvent): Promise<void>;
  subscribe<T extends IEvent>(eventName: string, handler: (event: T) => Promise<void>): void;
}
