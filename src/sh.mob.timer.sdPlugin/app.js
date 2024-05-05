/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />

const myAction = new Action('sh.mob.timer.action');
let requestedTimestamp = null;
let timerDurationInMilliseconds = null;
let roomEventsUrl;
let eventSource;
/**
 * The first event fired when Stream Deck starts
 */
$SD.onConnected(({ actionInfo, appInfo, connection, messageType, port, uuid }) => {
	console.log('Stream Deck connected!');
})

myAction.onKeyUp(({ action, context, device, event, payload }) => {
	console.log('Your key code goes here!');
});

myAction.onDialRotate(({ action, context, device, event, payload }) => {
	console.log('Your dial code goes here!');
});

myAction.onWillAppear(({context, payload}) => {
	$SD.getSettings(context)
})

$SD.onDidReceiveSettings(myAction.UUID, ({payload: {settings}, context}) => {
	console.log("received settings", settings)
	if(eventSource && eventSource.readyState === EventSource.OPEN) {
		console.log("closing open EventSource")
		eventSource.close()
	}
	roomEventsUrl = `https://timer.mob.sh/${settings.room}/events`;

	eventSource = new EventSource(roomEventsUrl);
    eventSource.onopen = () => {
		console.log('opened connection to ' + roomEventsUrl);
	};

	let interval;
	eventSource.addEventListener('TIMER_REQUEST', (event) => {
		if(interval){
			console.log("clearing existing interval")
			clearInterval(interval)
		}
		console.log("received timer request", event)
		const timerRequest = JSON.parse(event.data);
		let { requested, timer: timerInMinutes} = timerRequest
		if(!requested) {
			console.log("no requested", requested)
			return
		}
		requestedTimestamp = Date.parse(requested);
		timerDurationInMilliseconds = timerInMinutes * 60 * 1000;
		interval = setInterval(() => {
			let elapsedMillisecondsSinceRequested = Date.now() - requestedTimestamp;
			if (elapsedMillisecondsSinceRequested > timerDurationInMilliseconds) {
				$SD.showOk(context)
				clearInterval(interval)
				$SD.setTitle(context, '')
				return;
			}
			const remainingTime =  getCountdownRemainingTimeString(timerDurationInMilliseconds, elapsedMillisecondsSinceRequested)
			$SD.setTitle(context, remainingTime)
		}, 1000)
	})
})


function getCountdownRemainingTimeString(timerDurationInMilliseconds, elapsedMillisecondsSinceRequested) {
	let remainingDurationInMilliseconds = timerDurationInMilliseconds - elapsedMillisecondsSinceRequested;
	let remainingSeconds = Math.floor(remainingDurationInMilliseconds / 1000);
	let remainingMinutesPart = Math.floor(remainingSeconds / 60);
	let remainingSecondsPart = remainingSeconds % 60;
	return `${addLeadingZero(remainingMinutesPart)}:${addLeadingZero(remainingSecondsPart)}`;
}

function addLeadingZero(num) {
	return (num < 10 ? '0' : '') + num;
}