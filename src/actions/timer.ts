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

@action({ UUID: 'me.junzhe.mob.timer.action' })
export class Timer extends SingletonAction<TimerSettings> {
  requestedTimestamp: number = 0;
  timerDurationInMilliseconds: number = 0;
  roomEventsUrl: string = '';
  hostUrl: string = '';
  eventSource?: EventSource = undefined;
  interval: NodeJS.Timeout | null = null;

  override onWillAppear(ev: WillAppearEvent<TimerSettings>): void {
    this.reset(ev.action);
    this.init(ev);
  }

  override onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<TimerSettings>,
  ): Promise<void> | void {
    this.reset(ev.action);
    this.init(ev);
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

  reset = (action: DialAction<TimerSettings> | KeyAction<TimerSettings>) => {
    if (this.interval) {
      clearInterval(this.interval);
    }
    setText('mob timer', action);
  };

  init = (
    ev: WillAppearEvent<TimerSettings> | DidReceiveSettingsEvent<TimerSettings>,
  ) => {
    const { payload, action } = ev;
    const {
      settings: { host, room },
    } = payload;
    this.roomEventsUrl = `${host}/${room}/events`;

    this.eventSource = new EventSource(this.roomEventsUrl);
    try {
      if (
        this.eventSource &&
        this.eventSource.readyState === this.eventSource.OPEN
      ) {
        this.eventSource.close();
      }

      this.eventSource.onopen = () => {
        console.log('opened connection to ' + this.roomEventsUrl);
      };

      this.eventSource.addEventListener('TIMER_REQUEST', (event: any) => {
        if (this.interval) {
          clearInterval(this.interval);
        }
        const timerRequest = JSON.parse(event.data);
        let { requested, timer: timerInMinutes, type } = timerRequest;
        if (!requested) {
          this.reset(action);
          return;
        }
        this.requestedTimestamp = Date.parse(requested);
        this.timerDurationInMilliseconds = timerInMinutes * 60 * 1000;
        this.interval = setInterval(() => {
          let elapsedMillisecondsSinceRequested =
            Date.now() - this.requestedTimestamp;
          if (
            elapsedMillisecondsSinceRequested > this.timerDurationInMilliseconds
          ) {
            this.reset(action);
            return;
          }
          const remainingTime = getCountdownRemainingTimeString(
            this.timerDurationInMilliseconds,
            elapsedMillisecondsSinceRequested,
          );
          const prefix = type === 'BREAKTIMER' ? '☕' : '⏲️';
          setText(`${prefix} ${remainingTime}`, action);
        }, 500);
      });
    } catch (error) {
      console.error(error);
      this.reset(action);
    }
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
