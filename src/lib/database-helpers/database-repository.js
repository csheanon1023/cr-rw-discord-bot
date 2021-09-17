const {firebaseConfig} = require('./firebaseConfig');
const admin = require('firebase-admin');

const DB_KEY_LAST_KNOWN_MEMBER_LIST_OBJECT = 'last-known-member-list'
const DB_KEY_LAST_KNOWN_BATTLE_DAY_OBJECT = 'last-known-battle-day-data'

exports.connectRealtimeDatabase = () => {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseConfig),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });

  var database = admin.database();
  return database;
};

//last-known-member-list
exports.getLastKnownMembersListData = (clanTag, database) => {
  return database.ref(`/${DB_KEY_LAST_KNOWN_MEMBER_LIST_OBJECT}/${clanTag.substring(1)}`).once('value');
};

exports.setLastKnownMembersListData = (data, database) => {
  database.ref(`/${DB_KEY_LAST_KNOWN_MEMBER_LIST_OBJECT}/${data.clan.substring(1)}`).set(data, (error) => {
    if (error) {
      console.log('Data could not be saved.' + error);
    } else {
      console.log('Data saved successfully.');
    }
  });
};

//last-known-battle-day-data
exports.getLastKnownBattleDayData = (database) => {
  return database.ref(`/${DB_KEY_LAST_KNOWN_BATTLE_DAY_OBJECT}`).once('value');
};

exports.setLastKnownBattleDayData = (data, database) => {
  database.ref(`/${DB_KEY_LAST_KNOWN_BATTLE_DAY_OBJECT}`).update(data, (error) => {
    if (error) {
      console.log('Data could not be saved.' + error);
    } else {
      console.log('Data saved successfully.');
    }
  });
};