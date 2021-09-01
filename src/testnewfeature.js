require("dotenv").config();
// const databaseConnector = require('./lib/database-repository/database-helper');
const membersDataHelper = require('./lib/clash-royale-api-helpers/members-data-helper');
const playerDataHelper = require('./lib/clash-royale-api-helpers/player-data-helper');
const cron = require('node-cron');

let clanListCache = [ '#2PYUJUL', '#P9QQVJVG' ];
let clanMembersCache = [];
let lastInOutCronSuccessTimestamp = -1;
let clanNameByKeyCache = {
  '#2PYUJUL': 'ROYAL WARRIORS!',
  '#P9QQVJVG': 'HARAMI_CLASHERS'
};

// const database = databaseConnector.connectRealtimeDatabase();
//CRON
cron.schedule('* * * * *', async () => {

  // //Get clans
  // const snapshot = await database.collection('clans').get();
  // const clans = [];
  // snapshot.forEach(doc => {
  //   clans.push(doc.id);
  // });

  // //Check if there is a new clan collection in DB
  // if(clanListCache.length != clans.length) {
  //   const diff = (arr1, arr2) => arr1.filter(item => !arr2.includes(item));
  //   const change = { added: diff(clans, clanListCache), missing: diff(clanListCache, clans) };
  //   //TODO Update caches
  //   //Atleast DM me on discord, should happen very rarely
  //   console.log(`added:${change.added} \nmissing:${change.missing}`)
  // }

  //If clanMembersCache is not populated yet, populate from DB
  if(clanMembersCache.length == 0) {
    const getMemberListPromises = [];
    clanListCache.forEach(clan => getMemberListPromises.push(membersDataHelper.getMembers(clan)));
    if(getMemberListPromises.length == 0) {
      console.log('init clanMembers cache failed, getMembers didn\'t return any promises');
      return;
    }
    const clanMembersData = await Promise.all(getMemberListPromises);
    if(!clanMembersData || clanMembersData.length == 0) {
      console.log('init clanMembers cache failed, get members data didn\'t get resolved');
      return;
    }
    clanMembersData.forEach(clanData => {
      const clanTag = clanData.request.path.split("/")[3].replace("%23", "#");
      const mapMemberToCurrentMembersItemForCache = (members) => {
        return members.map(member => member.tag);
      }
      clanMembersCache.push({
        members: mapMemberToCurrentMembersItemForCache(clanData.data.items),
        clan: clanTag
      });
    });
  }

  //Get change in member list in last 1 minute
  const getMemberListPromises = [];
  const dirtyMembersData = [];
  const dirtyMembersClanTag = [];
  clanListCache.forEach(clan => getMemberListPromises.push(membersDataHelper.getMembers(clan)));
  if(getMemberListPromises.length == 0) {
    console.log('find change failed, getMembers didn\'t return any promises');
    return;
  }
  const clanMembersData = await Promise.all(getMemberListPromises);
  if(!clanMembersData || clanMembersData.length == 0) {
    console.log('find change failed, get members data didn\'t get resolved');
    return;
  }
  clanMembersData.forEach(clanData => {
    const clanTag = clanData.request.path.split("/")[3].replace("%23", "#");
    const mapMemberToCurrentMembersItemForCache = (members) => {
      return members.map(member => member.tag);
    }
    const changeInMemberList = (oldList, newList) => {
      const diff = (arr1, arr2) => arr1.filter(item => !arr2.includes(item));
      return { joined: diff(newList, oldList), left: diff(oldList, newList) };
    }
    const memberList = mapMemberToCurrentMembersItemForCache(clanData.data.items);
    const cachedList = clanMembersCache.find(item => item.clan == clanTag).members;
    if(!cachedList) {
      console.log(`failed to find cached members list for clan tag ${clanTag}`);
      return;
    }
    const {joined, left} = changeInMemberList(cachedList, memberList);
    if(joined.length != 0 || left.length != 0) {
      console.log(`joined:${joined} \nleft:${left}`);
      if(joined.length != 0)
        joined.forEach(player => sendInOutMessage('Joined', player, clanNameByKeyCache[clanTag]));
      if(left.length != 0)
        left.forEach(player => sendInOutMessage('Left', player, clanNameByKeyCache[clanTag]));
      dirtyMembersData.push({
        members: memberList,
        clan: clanTag
      });
      dirtyMembersClanTag.push(clanTag);
    }
  })

  //Update cache to clear dirty fields
  if(dirtyMembersClanTag.length != 0) {
    const unchangedClans = clanMembersCache.filter(clanMembers => !dirtyMembersClanTag.includes(clanMembers.clan));
    dirtyMembersData.forEach(data => unchangedClans.push(data));
    clanMembersCache = unchangedClans;
  }

  //log success
  const currentTimestamp = Date.now();
  const timeSinceLastSuccess = lastInOutCronSuccessTimestamp == -1 ? 0 : Math.round((currentTimestamp - lastInOutCronSuccessTimestamp) / 1000);
  console.log(timeSinceLastSuccess  + ' running a task every minute');
  lastInOutCronSuccessTimestamp = currentTimestamp;
});

const sendInOutMessage = async (change, playerTag, clan) => {
  if(!playerTag || playerTag == '')
    return;
  const response = await playerDataHelper.getPlayerData(playerTag);
  const playerDetails = response.data;
  // const channel = await client.channels.fetch('879119156665016400');
  // channel.send(`This player has ${change}: ${playerDetails.name} [${clan}]`);
  console.log(`This player has ${change}: ${playerDetails.name} [${clan}]`);
}