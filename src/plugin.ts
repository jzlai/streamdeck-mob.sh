import streamDeck, { LogLevel } from '@elgato/streamdeck';

import { Timer } from './actions/timer';

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel(LogLevel.INFO);

streamDeck.actions.registerAction(new Timer());

// Finally, connect to the Stream Deck.
streamDeck.connect();
