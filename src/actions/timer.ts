import {
  Action,
  action,
  DialAction,
  DidReceiveSettingsEvent,
  JsonObject,
  KeyAction,
  KeyDownEvent,
  KeyUpEvent,
  SingletonAction,
  TouchTapEvent,
  WillAppearEvent,
} from '@elgato/streamdeck';
import { EventSource } from 'eventsource';

@action({ UUID: 'me.junzhe.mobtimer.action' })
export class Timer extends SingletonAction<TimerSettings> {
  requestedTimestamp: number = 0;
  timerDurationInMilliseconds: number = 0;
  roomEventsUrl: string = '';
  hostUrl: string = '';

  override onWillAppear(ev: WillAppearEvent<TimerSettings>): void {
    const { payload, action } = ev;
    const {
      settings: { host, room },
    } = payload;
    this.roomEventsUrl = `${host}/${room}/events`;

    console.log('Timer action received settings', payload);
    const eventSource = new EventSource(this.roomEventsUrl);
    let interval: NodeJS.Timeout | null = null;
    try {
      if (eventSource && eventSource.readyState === EventSource.OPEN) {
        console.log('closing open EventSource');
        eventSource.close();
      }

      eventSource.onopen = () => {
        console.log('opened connection to ' + this.roomEventsUrl);
      };

      eventSource.addEventListener('TIMER_REQUEST', (event: any) => {
        if (interval) {
          console.log('clearing existing interval');
          clearInterval(interval);
        }
        console.log('received timer request', event);
        const timerRequest = JSON.parse(event.data);
        let { requested, timer: timerInMinutes, type } = timerRequest;
        if (!requested) {
          this.reset(interval, action);
          return;
        }
        this.requestedTimestamp = Date.parse(requested);
        this.timerDurationInMilliseconds = timerInMinutes * 60 * 1000;
        interval = setInterval(() => {
          let elapsedMillisecondsSinceRequested =
            Date.now() - this.requestedTimestamp;
          if (
            elapsedMillisecondsSinceRequested > this.timerDurationInMilliseconds
          ) {
            this.reset(interval, action);
            return;
          }
          const remainingTime = getCountdownRemainingTimeString(
            this.timerDurationInMilliseconds,
            elapsedMillisecondsSinceRequested,
          );
          const prefix = type === 'BREAKTIMER' ? '☕' : '⏲️';
          setText(`${prefix} ${remainingTime}`, action);
        }, 1000);
      });
    } catch (error) {
      console.error(error);
      this.reset(interval, action);
    }
  }
  override async onKeyUp({
    payload: { settings },
  }: KeyUpEvent<TimerSettings>): Promise<void> {
    await this.setTimer(settings, 'timer');
  }

  override onTouchTap(ev: TouchTapEvent<TimerSettings>): Promise<void> | void {
    ev.payload.hold
      ? this.setTimer(ev.payload.settings, 'timer')
      : this.setTimer(ev.payload.settings, 'breaktimer');
  }

  setTimer = async (
    settings: TimerSettings,
    timerType: 'timer' | 'breaktimer',
  ) => {
    const { host, room, name, timer } = settings;
    try {
      return await fetch(`${host}/${room}`, {
        method: 'PUT',
        headers: {
          'Content-type': 'application/json',
        },
        body: JSON.stringify({ [timerType]: Number(timer), user: name }),
      });
    } catch (err) {
      console.error('Putting timer failed', err);
    }
  };

  reset = (
    interval: NodeJS.Timeout | null,
    action: DialAction<TimerSettings> | KeyAction<TimerSettings>,
  ) => {
    if (interval) {
      clearInterval(interval);
    }
    setText('mob timer', action);
  };
}

const getCountdownRemainingTimeString = (
  timerDurationInMilliseconds: number,
  elapsedMillisecondsSinceRequested: number,
) => {
  let remainingDurationInMilliseconds =
    timerDurationInMilliseconds - elapsedMillisecondsSinceRequested;
  let remainingSeconds = Math.floor(remainingDurationInMilliseconds / 1000);
  let remainingMinutesPart = Math.floor(remainingSeconds / 60);
  let remainingSecondsPart = remainingSeconds % 60;
  return `${addLeadingZero(remainingMinutesPart)}:${addLeadingZero(remainingSecondsPart)}`;
};

const addLeadingZero = (num: number) => {
  return (num < 10 ? '0' : '') + num;
};

const setText = (
  text: string,
  action: DialAction<TimerSettings> | KeyAction<TimerSettings>,
) => {
  if (action.isDial()) {
    action.setFeedback({ value: text });
  } else {
    action.setTitle(text);
  }
};

type TimerSettings = {
  host?: string;
  room?: string;
  name?: string;
  timer?: string;
};
