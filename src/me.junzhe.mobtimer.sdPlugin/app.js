/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />

const myAction = new Action('me.junzhe.mobtimer.action');
let requestedTimestamp = null;
let timerDurationInMilliseconds = null;
let roomEventsUrl;
let hostUrl;
let eventSource;
let interval;
/**
 * The first event fired when Stream Deck starts
 */
$SD.onConnected(
  ({ actionInfo, appInfo, connection, messageType, port, uuid }) => {
    console.log('Stream Deck connected!');
  },
);

myAction.onKeyUp(async ({ action, context, device, event, payload: { settings } }) => {
  const { host, room, name, timer } = settings;
  try {
    await fetch(`${host}/${room}`, {
      method: 'PUT',
      headers: { 
        'Content-type': 'application/json'
      },
      body: JSON.stringify({ breaktimer: Number(timer), user: name })
    })
  } catch(err) {
    console.error('Putting timer failed', err)
  }
});

myAction.onDialRotate(({ action, context, device, event, payload }) => {
  console.log('Your dial code goes here!');
});

myAction.onWillAppear(({ context }) => {
  $SD.getSettings(context);
});

$SD.onDidReceiveSettings(
  myAction.UUID,
  ({ payload: { settings }, context }) => {
    try {
      if (eventSource && eventSource.readyState === EventSource.OPEN) {
        console.log('closing open EventSource');
        eventSource.close();
      }
      const { host, room } = settings;
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
          reset(context);
          return;
        }
        requestedTimestamp = Date.parse(requested);
        timerDurationInMilliseconds = timerInMinutes * 60 * 1000;
        interval = setInterval(() => {
          let elapsedMillisecondsSinceRequested =
            Date.now() - requestedTimestamp;
          if (elapsedMillisecondsSinceRequested > timerDurationInMilliseconds) {
            reset(context);
            return;
          }
          const remainingTime = getCountdownRemainingTimeString(
            timerDurationInMilliseconds,
            elapsedMillisecondsSinceRequested,
          );
          const prefix = type === 'BREAKTIMER' ? '☕' : '⏲️';
          $SD.setTitle(context, `${prefix} ${remainingTime}`);
        }, 1000);
      });
    } catch (error) {
      console.error(error);
      reset(context);
    }
  },
);

function getCountdownRemainingTimeString(
  timerDurationInMilliseconds,
  elapsedMillisecondsSinceRequested,
) {
  let remainingDurationInMilliseconds =
    timerDurationInMilliseconds - elapsedMillisecondsSinceRequested;
  let remainingSeconds = Math.floor(remainingDurationInMilliseconds / 1000);
  let remainingMinutesPart = Math.floor(remainingSeconds / 60);
  let remainingSecondsPart = remainingSeconds % 60;
  return `${addLeadingZero(remainingMinutesPart)}:${addLeadingZero(remainingSecondsPart)}`;
}

function addLeadingZero(num) {
  return (num < 10 ? '0' : '') + num;
}

function reset(context) {
  clearInterval(interval);
  $SD.setTitle(context, 'mob timer');
}
