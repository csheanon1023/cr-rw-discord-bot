// to run script: node -r dotenv/config ./src/lib/database-helpers/database-repository.js
const { firebaseConfig } = require('./firebaseConfig');
const admin = require('firebase-admin');

const DB_KEY_LAST_KNOWN_MEMBER_LIST_OBJECT = 'last-known-member-list';
const DB_KEY_LAST_KNOWN_BATTLE_DAY_OBJECT = 'last-known-battle-day-data';
const DB_KEY_DISCORD_ID_TO_CR_ACCOUNTS_MAP_OBJECT = 'discord-id-to-cr-accounts-map';
const DB_KEY_PENDING_VERIFICATION_REQUESTS_OBJECT = 'pending-verification-requests';
const DB_KEY_ALREADY_LINKED_PLAYER_TAGS_OBJECT = 'already-linked-player-tags';
const DB_KEY_APPLICATION_LEVEL_FLAGS_OBJECT = 'application-level-flags';
const DB_KEY_CURRENT_WAR_MISSED_DECKS_OBJECT = 'current-war-missed-decks';

const connectRealtimeDatabase = () => {
	admin.initializeApp({
		credential: admin.credential.cert(firebaseConfig),
		databaseURL: process.env.FIREBASE_DATABASE_URL,
	});

	const database = admin.database();
	return database;
};

// last-known-member-list
const getLastKnownMembersListData = (clanTag, database) => {
	return database.ref(`/${DB_KEY_LAST_KNOWN_MEMBER_LIST_OBJECT}/${clanTag.substring(1)}`).once('value');
};

const setLastKnownMembersListData = (data, database) => {
	return database.ref(`/${DB_KEY_LAST_KNOWN_MEMBER_LIST_OBJECT}/${data.clan.substring(1)}`).set(data)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

// last-known-battle-day-data
const getLastKnownBattleDayData = (database) => {
	return database.ref(`/${DB_KEY_LAST_KNOWN_BATTLE_DAY_OBJECT}`).once('value');
};

const setLastKnownBattleDayData = (data, database) => {
	return database.ref(`/${DB_KEY_LAST_KNOWN_BATTLE_DAY_OBJECT}`).update(data)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

// discord-id-to-cr-accounts-map
const getDiscordIdToCrAccountsMap = (database) => {
	return database.ref(`/${DB_KEY_DISCORD_ID_TO_CR_ACCOUNTS_MAP_OBJECT}`).once('value');
};

const setDiscordIdToCrAccountsMap = (userDiscordId, playerTags, database) => {
	return database.ref(`/${DB_KEY_DISCORD_ID_TO_CR_ACCOUNTS_MAP_OBJECT}/${userDiscordId}`).set(playerTags)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

// pending-verification-requests
const getPendingVerificationRequests = (database) => {
	return database.ref(`/${DB_KEY_PENDING_VERIFICATION_REQUESTS_OBJECT}`).once('value');
};

const setPendingVerificationRequests = (userDiscordId, verificationParams, database) => {
	return database.ref(`/${DB_KEY_PENDING_VERIFICATION_REQUESTS_OBJECT}/${userDiscordId}`).set(verificationParams)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

// already-linked-player-tags
const getAlreadyLinkedPlayerTags = (database) => {
	return database.ref(`/${DB_KEY_ALREADY_LINKED_PLAYER_TAGS_OBJECT}`).once('value');
};

// TODO for now sending the full object, in future just do a push and use security rules for duplicates
const setAlreadyLinkedPlayerTags = (playerTags, database) => {
	return database.ref(`/${DB_KEY_ALREADY_LINKED_PLAYER_TAGS_OBJECT}`).set(playerTags)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

// application-flags
const getApplicationFlagByKey = (flagKey, database) => {
	return database.ref(`/${DB_KEY_APPLICATION_LEVEL_FLAGS_OBJECT}/${flagKey}`).once('value');
};

const bulkSetApplicationFlag = (data, database) => {
	if (Object.values(data).find(val => typeof val == 'boolean' == false) != undefined) {
		console.log('Flags need boolean values');
		return false;
	}
	return database.ref(`/${DB_KEY_APPLICATION_LEVEL_FLAGS_OBJECT}`).update(data)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

// current-war-missed-decks
const getCurrentWarMissedDecksData = (clanTag, database) => {
	return database.ref(`/${DB_KEY_CURRENT_WAR_MISSED_DECKS_OBJECT}/${clanTag.substring(1)}`).once('value');
};

const setCurrentWarMissedDecksData = (clanTag, dayId, data, database) => {
	return database.ref(`/${DB_KEY_CURRENT_WAR_MISSED_DECKS_OBJECT}/${clanTag.substring(1)}/${dayId}`).set(data)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

module.exports = {
	connectRealtimeDatabase,
	getLastKnownMembersListData,
	setLastKnownMembersListData,
	getLastKnownBattleDayData,
	setLastKnownBattleDayData,
	getDiscordIdToCrAccountsMap,
	setDiscordIdToCrAccountsMap,
	getApplicationFlagByKey,
	bulkSetApplicationFlag,
	getCurrentWarMissedDecksData,
	setCurrentWarMissedDecksData,
	getPendingVerificationRequests,
	setPendingVerificationRequests,
	getAlreadyLinkedPlayerTags,
	setAlreadyLinkedPlayerTags,
};