/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />

const myAction = new Action('me.junzhe.mobtimer.action');
let requestedTimestamp = null;
let timerDurationInMilliseconds = null;
let roomEventsUrl;
let hostUrl;


/**
 * The first event fired when Stream Deck starts
 */
$SD.onConnected(
  ({ actionInfo, appInfo, connection, messageType, port, uuid }) => {
    console.log('Stream Deck connected!');
  },
);

myAction.onTouchTap(({payload: { settings, hold }}) => {
  hold ? setTimer(settings, 'timer') : setTimer(settings, 'breaktimer')
})

myAction.onKeyUp(({ action, context, device, event, payload: { settings } }) => {
  setTimer(settings, 'breaktimer')
});

myAction.onDialRotate(({ action, context, device, event, payload }) => {
  console.log('Your dial code goes here!');
});

myAction.onWillAppear(({ context }) => {
  $SD.getSettings(context, 'breaktimer');
});

$SD.onDidReceiveSettings(
  myAction.UUID,
  ({ payload, device, action, context }) => {
    let eventSource;
    let interval;
    try {
      if (eventSource && eventSource.readyState === EventSource.OPEN) {
        console.log('closing open EventSource');
        eventSource.close();
      }
      const { settings: { host, room }, controller  } = payload;
      roomEventsUrl = `${host}/${room}/events`;

      eventSource = new EventSource(roomEventsUrl);
      eventSource.onopen = () => {
        console.log('opened connection to ' + roomEventsUrl);
      };

      eventSource.addEventListener('TIMER_REQUEST', (event) => {
        if (interval) {
          console.log('clearing existing interval');
          clearInterval(interval);
        }
        console.log('received timer request', event);
        const timerRequest = JSON.parse(event.data);
        let { requested, timer: timerInMinutes, type } = timerRequest;
        if (!requested) {
          console.log('no requested', requested);
          reset(context, interval, controller);
          return;
        }
        requestedTimestamp = Date.parse(requested);
        timerDurationInMilliseconds = timerInMinutes * 60 * 1000;
        interval = setInterval(() => {
          let elapsedMillisecondsSinceRequested =
            Date.now() - requestedTimestamp;
          if (elapsedMillisecondsSinceRequested > timerDurationInMilliseconds) {
            reset(context, interval, controller);
            return;
          }
          const remainingTime = getCountdownRemainingTimeString(
            timerDurationInMilliseconds,
            elapsedMillisecondsSinceRequested,
          );
          const prefix = type === 'BREAKTIMER' ? '☕' : '⏲️';
          setText(context, `${prefix} ${remainingTime}`, controller)
        }, 1000);
      });
    } catch (error) {
      console.error(error);
      reset(context, interval);
    }
  },
);

const getCountdownRemainingTimeString = (
  timerDurationInMilliseconds,
  elapsedMillisecondsSinceRequested,
) => {
  let remainingDurationInMilliseconds =
    timerDurationInMilliseconds - elapsedMillisecondsSinceRequested;
  let remainingSeconds = Math.floor(remainingDurationInMilliseconds / 1000);
  let remainingMinutesPart = Math.floor(remainingSeconds / 60);
  let remainingSecondsPart = remainingSeconds % 60;
  return `${addLeadingZero(remainingMinutesPart)}:${addLeadingZero(remainingSecondsPart)}`;
}

const addLeadingZero = (num) => {
  return (num < 10 ? '0' : '') + num;
}

const reset =(context, interval, controller) => {
  clearInterval(interval);
  $SD.setTitle(context, 'mob timer');
  $SD.setFeedback(context, {value: 'mob timer'})
}

const setText = (context, text, controller) => {
  if(controller === 'Keypad') {
    $SD.setTitle(context, text);
  } else {
    $SD.setFeedback(context, { value: text })
  }
}

const setTimer = async (settings, timerType) => {
  const { host, room, name, timer } = settings;
  try {
    await fetch(`${host}/${room}`, {
      method: 'PUT',
      headers: { 
        'Content-type': 'application/json'
      },
      body: JSON.stringify({ [timerType]: Number(timer), user: name })
    })
  } catch(err) {
    console.error('Putting timer failed', err)
  }
}
