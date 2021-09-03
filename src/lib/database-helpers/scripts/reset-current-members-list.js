// ONLY TO BE USED WHEN NEW CLAN IS ADDED (uncomment only the sections that you need)
// to run script: node -r dotenv/config ./src/lib/database-helpers/scripts/reset-current-members-list.js

//SECTION helper functions (safe to uncomment)
/*
const admin = require("firebase-admin");
const membersDataHelper = require('../../clash-royale-api-helpers/members-data-helper');

let currentClans = [ '#2PYUJUL', '#P9QQVJVG' ];
// Fetch the service account key JSON file contents
const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_CONFIG);

// Initialize the app with a service account, granting admin privileges
//TODO set-up security rules
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});
var db = admin.database();


// generate last-known-members-list object
const resetMembersList = async (clanTag) => {
  if(!currentClans.includes(clanTag)) {
    console.log('This clan tag is not in list of existing tags');
    return;
  }
  const clanMembersCache = [];
  const res = await membersDataHelper.getMembers(clanTag);
  const membersList = res.data.items;
  if(!membersList || membersList.length == 0) {
    console.log('reset clan members list failed, get members data didn\'t get resolved');
    return;
  }
  clanMembersCache.push({
    members: membersList.map(member => member.tag),
    clan: clanTag
  });
  if(clanMembersCache && clanMembersCache.length != 0) {
    let ref = db.ref(`/last-known-member-list/${clanTag.substring(1)}`);
    ref.set(clanMembersCache[0], (error) => {
      if (error) {
        console.log('Data could not be saved.' + error);
      } else {
        console.log('Data saved successfully.');
      }
    });
  }
}

*/


//SECTION last-known-members-list object (uncomment only the parts that you need, this will mutate the DB)
/*
// uncomment this to generate/reset last-known-members-list object
// currentClans.forEach(clan => resetMembersList(clan));

// uncomment this to get clan data from last-known-members-list object
// db.ref(`/last-known-member-list/${clanTag.substring(1)}`).once('value', (data) => {
//   console.log(data.val());
// });

//async await implementation for the same for reference
// (async () => {
//   const snap = await db.ref(`/last-known-member-list/${currentClans[0].substring(1)}`).once('value')
//   console.log(snap.val());
// })();
*/
