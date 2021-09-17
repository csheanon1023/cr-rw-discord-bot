const databaseRepository = require('../database-helpers/database-repository');
const currentRiverRaceDataHelper = require('../clash-royale-api-helpers/current-river-race-data-helper');
const riverRaceLogDataHelper = require('../clash-royale-api-helpers/river-race-log-data-helper');
const membersDataHelper = require('../clash-royale-api-helpers/members-data-helper');
const cron = require('node-cron');

exports.scheduleCronsTOCollectDataAboutMissedBattleDecks = (database, client, channelList) => {
  let clanListCache = [ '#2PYUJUL', '#P9QQVJVG' ];
  let isRiverRaceDataUpdatedToNextDay = false;
  let isDailyReportSent = {
    '#2PYUJUL': false,
    '#P9QQVJVG': false
  };
  let clanNameByKeyCache = {
    '#2PYUJUL': 'ROYAL WARRIORS!',
    '#P9QQVJVG': 'HARAMI_CLASHERS'
  };
  //TODO setup flags
  
  //CRON At every 5th minute from 0 through 59 past hour 9 on Sunday, Monday, Friday, and Saturday [offset 6]
  cron.schedule('6 0-59/5 9 * * 0,1,5,6', async () => {
    const currentDate = new Date();
    const currentDay = currentDate.getDay();
    const currentRiverRacePeriodIndex = (currentDay + 5) % 7;
    const formattedCurrentTime = getCurrentTime(currentDate);

    if(clanListCache == null || clanListCache.length == 0) {
      console.log(`${formattedCurrentTime} Skipping river race data collection, clanListCache is empty`);
      return;
    }

    //TODO handle case when the first cron finds that periodIndex has changed to next period (unlikely now that we're starting at 9:00)
    //check for this is also done in the other cron so this is anyway not very critical but, do this someday to make it more fault tolerant

    if(isRiverRaceDataUpdatedToNextDay) {
      console.log(`${formattedCurrentTime} Skipping river race data collection, data has been updated to next day`);
      return;
    }

    try {
      const currentRiverRaceDataPromises = clanListCache.map(clan => currentRiverRaceDataHelper.getCurrentRiverRaceData(clan));
      const currentRiverRaceData = await Promise.all(currentRiverRaceDataPromises);
      currentRiverRaceData.forEach(({ data }) => {
        let clanRiverRaceDataSnap = {};
        if(data?.periodIndex % 7 != currentRiverRacePeriodIndex) {
          isRiverRaceDataUpdatedToNextDay = true;
          return;
        }
        clanRiverRaceDataSnap[data?.clan?.tag?.substring(1)] = {
          clan: data.clan,
          periodLogs: data.periodLogs,
          timestamp: currentDate.getTime()
        };
        databaseRepository.setLastKnownBattleDayData(clanRiverRaceDataSnap, database);
      });
    } catch(e) {
      console.error(e);
      console.log(`${formattedCurrentTime} river race data collection cron failed`);
      return;
    }
  });

  //CRON At every minute from 15 through 20 past hour 10 on Sunday, Monday, Friday, and Saturday [offset 3]
  cron.schedule('3 15-20 10 * * 0,1,5,6', async () => {
    const currentDate = new Date();
    const currentDay = currentDate.getDay();
    const previousRiverRacePeriodIndex = (currentDay + 5) % 7;
    const formattedCurrentTime = getCurrentTime(currentDate);
    const unusedDecksReport = [];

    if(clanListCache == null || clanListCache.length == 0) {
      console.log(`${formattedCurrentTime} Skipping river race report generation as clanListCache is empty`);
      return;
    }
    
    if(Object.values(isDailyReportSent).find(val => val == false) == undefined) {
      console.log(`${formattedCurrentTime} Skipping river race report generation cron, all reports have already been sent`);
      return;
    }
    
    if(!isRiverRaceDataUpdatedToNextDay) {
      console.error(`${formattedCurrentTime} isRiverRaceDataUpdatedToNextDay was not true in psot cron`);
    }

    if([3, 4, 5].includes(previousRiverRacePeriodIndex)){
      try {
        const currentRiverRaceDataPromises = clanListCache.map(clan => currentRiverRaceDataHelper.getCurrentRiverRaceData(clan));
        const previousRiverRaceDataSnpashotPromises = databaseRepository.getLastKnownBattleDayData(database);
        const [ previousRiverRaceDataSnpashot, ...currentRiverRaceData ] = await Promise.all([ previousRiverRaceDataSnpashotPromises, ...currentRiverRaceDataPromises]);
        const previousRiverRaceDataSnpashotValue = previousRiverRaceDataSnpashot.val();
        for (const [key, clanPreviousRiverRaceData] of Object.entries(previousRiverRaceDataSnpashotValue)) {
          //TODO add validation to make sure data is fresh
          if(key == 'timestamp')
            continue;
          if(isDailyReportSent[clanPreviousRiverRaceData.clan.tag]) {
            console.log(`${formattedCurrentTime} River race report for ${clanPreviousRiverRaceData.clan.tag} has already been sent`)
            continue;
          }
          const clanCurrentRiverRaceData = currentRiverRaceData.find(({ data }) => data.clan.tag == clanPreviousRiverRaceData.clan.tag);
          if(clanCurrentRiverRaceData.data?.periodIndex % 7 == previousRiverRacePeriodIndex) {
            console.log(`${formattedCurrentTime} Skippng river race report generation as the battle day has not ended yet`)
            continue;
          }
          //TODO check if return is needed
          if(clanCurrentRiverRaceData == undefined) {
            console.log(`${formattedCurrentTime} river race report generation cron failed, not able to match clans in previousSnap and current data returned from the API for ${clanPreviousRiverRaceData.clan.tag}`);
            return;
          }
          let participantList = clanPreviousRiverRaceData?.clan?.participants;
          let currentClanMemberList = await membersDataHelper.getMembers(clanPreviousRiverRaceData?.clan?.tag);
          participantList = participantList.filter(participant => currentClanMemberList.data.items.find(member => member.tag == participant.tag));
          participantList.forEach(participant => {
            const currentParticipantData = clanCurrentRiverRaceData.data?.clan?.participants.find(player => player.tag == participant.tag);
            if(currentParticipantData == undefined) {
              console.error(`${formattedCurrentTime} Unexpected: not able to find player in new river race data: ${participant.tag}`);
              return;
            }
            const totalDecksUsedByTheEndOPreviousBattleDay = currentParticipantData.decksUsed - currentParticipantData.decksUsedToday;
            const unuesdDecks = 4 - participant.decksUsedToday + totalDecksUsedByTheEndOPreviousBattleDay - participant.decksUsed;
            if(unuesdDecks < 0 || unuesdDecks > 4) {
              console.log(`${formattedCurrentTime} river race report generation cron failed, something wrong with the calculations, invalid value for unuesdDecks: ${unuesdDecks}`);
              return;
            }
            if(unuesdDecks != 0) {
              const reportPlayerData = {
                tag: participant.tag,
                name: participant.name,
                unusedDecks: unuesdDecks
              };
              let clanUnusedDecksReport = unusedDecksReport.find(e => e.clanTag == clanCurrentRiverRaceData.data?.clan?.tag)
              if(clanUnusedDecksReport) {
                clanUnusedDecksReport.unusedDecksReport.push(reportPlayerData);
              }
              else {
                unusedDecksReport.push({
                  clanTag: clanCurrentRiverRaceData.data?.clan?.tag,
                  unusedDecksReport: [reportPlayerData]
                });
              }
            }
          });
        }
        unusedDecksReport.forEach(clanUnusedDecksReport => {
          if(Object.keys(channelList).includes(clanUnusedDecksReport.clanTag)) {
            sendMissedDeckReport(clanUnusedDecksReport.unusedDecksReport, channelList[clanUnusedDecksReport.clanTag]);
            isDailyReportSent[clanUnusedDecksReport.clanTag] = true;
          }
        });
      } catch(e) {
        console.error(e);
        console.log(`${formattedCurrentTime} river race report generation cron failed`);
        return;
      }
    }

    else if(previousRiverRacePeriodIndex == 6){
      try {
        const currentRiverRaceDataPromises = clanListCache.map(clan => riverRaceLogDataHelper.getRiverRaceLogData(clan));
        const previousRiverRaceDataSnpashotPromises = databaseRepository.getLastKnownBattleDayData(database);
        const [ previousRiverRaceDataSnpashot, ...currentRiverRaceData ] = await Promise.all([ previousRiverRaceDataSnpashotPromises, ...currentRiverRaceDataPromises]);
        const mostRecentEntryInRiverRaceLogs = currentRiverRaceData.map(clanCurrentRiverRaceData => ({
          standings: clanCurrentRiverRaceData.data.items.items[0].standings,
          createdDate: clanCurrentRiverRaceData.data.items.items[0].createdDate,
          participatingClans: clanCurrentRiverRaceData.data.items.items[0].standings.map(clanStandings => clanStandings.clan.tag)
        }));
        // if(mostRecentEntryInRiverRaceLogs[0].createdDate) {
        //   //TODO handle this
        // }
        const previousRiverRaceDataSnpashotValue = previousRiverRaceDataSnpashot.val();
        for (const [key, clanPreviousRiverRaceData] of Object.entries(previousRiverRaceDataSnpashotValue)) {
          //TODO add validation to make sure data is fresh
          if(key == 'timestamp')
            continue;
          if(isDailyReportSent[clanPreviousRiverRaceData.clan.tag]) {
            console.log(`${formattedCurrentTime} River race report for ${clanPreviousRiverRaceData.clan.tag} has already been sent`)
            continue;
          }
          //TODO this will fail if 2 of our clans are paired up (very unlikely to happen but, possible)
          const clanRiverRaceLogData = mostRecentEntryInRiverRaceLogs.find(clanMostRecentEntryInRiverRaceLog => clanMostRecentEntryInRiverRaceLog.participatingClans.includes(clanPreviousRiverRaceData.clan.tag));
          //TODO check if return is needed
          if(clanRiverRaceLogData == undefined) {
            console.log(`${formattedCurrentTime} river race report generation cron failed, not able to match clans in previousSnap and current data returned from the API for ${clanPreviousRiverRaceData.clan.tag}`);
            return;
          }
          let participantList = clanPreviousRiverRaceData?.clan?.participants;
          participantList.forEach(participant => {
            const ourClanStandingData = clanRiverRaceLogData.standings?.find(clanStanding => clanStanding.clan.tag == clanPreviousRiverRaceData.clan.tag);
            if(currentParticipantData == undefined) {
              console.error(`${formattedCurrentTime} Unexpected: not able to find clan in filtered river race logs data: ${clanPreviousRiverRaceData.clan.tag}`);
              return;
            }
            const currentParticipantData = ourClanStandingData.clan?.participants.find(player => player.tag == participant.tag);
            if(currentParticipantData == undefined) {
              console.error(`${formattedCurrentTime} Unexpected: not able to find player in new river race data: ${participant.tag}`);
              return;
            }
            const totalDecksUsedByTheEndOPreviousBattleDay = currentParticipantData.decksUsed;
            const unuesdDecks = 4 - participant.decksUsedToday + totalDecksUsedByTheEndOPreviousBattleDay - participant.decksUsed;
            if(unuesdDecks < 0 || unuesdDecks > 4) {
              console.log(`${formattedCurrentTime} river race report generation cron failed, something wrong with the calculations, invalid value for unuesdDecks: ${unuesdDecks}`);
              return;
            }
            if(unuesdDecks != 0) {
              const reportPlayerData = {
                tag: participant.tag,
                name: participant.name,
                unusedDecks: unuesdDecks
              };
              let clanUnusedDecksReport = unusedDecksReport.find(e => e.clanTag == clanCurrentRiverRaceData.data?.clan?.tag)
              if(clanUnusedDecksReport) {
                clanUnusedDecksReport.unusedDecksReport.push(reportPlayerData);
              }
              else {
                unusedDecksReport.push({
                  clanTag: clanCurrentRiverRaceData.data?.clan?.tag,
                  unusedDecksReport: [reportPlayerData]
                });
              }
            }
          });
        }
        unusedDecksReport.forEach(clanUnusedDecksReport => {
          if(Object.keys(channelList).includes(clanUnusedDecksReport.clanTag)) {
            sendMissedDeckReport(clanUnusedDecksReport.unusedDecksReport, channelList[clanUnusedDecksReport.clanTag]);
            isDailyReportSent[clanUnusedDecksReport.clanTag] = true;
          }
        });
      } catch(e) {
        console.error(e);
        console.log(`${formattedCurrentTime} river race report generation cron failed`);
        return;
      }
    }
  });

  //Reset flags crons At minute 0 past hour 11, 12, and 13 on Sunday, Monday, Friday, and Saturday. [Offset 9]
  cron.schedule('9 0 11,12,13 * * 0,1,5,6', async () => {
    var currentdate = getCurrentTime();
    console.log(`Reset counts and flags at ${currentdate}`)
    isRiverRaceDataUpdatedToNextDay = false;
    isDailyReportSent = {
      '#2PYUJUL': false,
      '#P9QQVJVG': false
    };
  });
  
  //Helpers
  const getCurrentTime = (currentDate = new Date()) => {
    var datetime = "Last Sync: " + currentDate.getDate() + "/"
                                 + (currentDate.getMonth()+1)  + "/" 
                                 + currentDate.getFullYear() + " @ "  
                                 + currentDate.getHours() + ":"  
                                 + currentDate.getMinutes() + ":" 
                                 + currentDate.getSeconds();
    return datetime;
  }

  const sendMissedDeckReport = async (unusedDecksReport, channelId) => {
    if(!unusedDecksReport || unusedDecksReport.length == 0)
      return;
    if(channelList == null || Object.keys(channelList).length == 0) {
      console.log('No channels defined for river race report');
      return;
    }
    const channel = await client.channels.fetch(channelId);
    const listOfPlayersWithUnusedDeckCount = unusedDecksReport.map(playerUnusedDecksReport => ({
      name: playerUnusedDecksReport.name,
      unusedDecks: playerUnusedDecksReport.unusedDecks
    }));
    const tableHead = 'Player Name     UnusedDecks';
    const removeEmojisFromString = (text) => text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
    const formatPlayerReportData = (playerData) => `${removeEmojisFromString(playerData.name.length > 15 ? playerData.name.substring(0, 15) : playerData.name).padEnd(15)} ${(playerData.unusedDecks.toString()).padStart(11)}`;
    channel.send(`\`\`\`${tableHead}\n${listOfPlayersWithUnusedDeckCount.map(formatPlayerReportData).join('\n')}\`\`\``);
    // console.log(`[${clan}] This player has ${change}: ${playerDetails.name}.`);
  }
}