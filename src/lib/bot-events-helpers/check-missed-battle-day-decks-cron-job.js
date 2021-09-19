const databaseRepository = require('../database-helpers/database-repository');
const currentRiverRaceDataHelper = require('../clash-royale-api-helpers/current-river-race-data-helper');
const riverRaceLogDataHelper = require('../clash-royale-api-helpers/river-race-log-data-helper');
const membersDataHelper = require('../clash-royale-api-helpers/members-data-helper');
const cron = require('node-cron');

exports.scheduleCronsTOCollectDataAboutMissedBattleDecks = (database, client, channelList) => {
  let clanListCache = [ '#2PYUJUL', '#P9QQVJVG' ];
  // let clanNameByKeyCache = {
  //   '#2PYUJUL': 'ROYAL WARRIORS!',
  //   '#P9QQVJVG': 'HARAMI_CLASHERS'
  // };
  // let isRiverRaceDataUpdatedToNextDay = clanListCache.reduce((obj, clanTag) => ({...obj, [clanTag]: false}), {});
  let isRiverRaceDataSnapSaved = clanListCache.reduce((obj, clanTag) => ({...obj, [clanTag]: false}), {});
  let isDailyReportSent = clanListCache.reduce((obj, clanTag) => ({...obj, [clanTag]: false}), {});
  
  //At every minute from 15 through 20 past hour 12 on Sunday, Thursday, Friday, and Saturday [offset 3]
  cron.schedule('3 15-20 12 * * 0,4,5,6', async () => {
    const currentDate = new Date();
    const currentDay = currentDate.getDay();
    /**
     * Relation between periodIndex and date
     * Time in 24Hr format
     * Javascript Date object gives day as an integer number, between 0 and 6, 0 for Sunday, 1 for Monday, and so on.
     * periodIndex field is also an integer but, monday is referenced by 0(periodIndex % 7).
     * Also, CR War days start at ~10:00AM UTC so in the format "(currentDay + offset) % 7", offset for the same period depends on which day the cron is scheduled.
     * Consider periodIndex % 7 == 3, this should start at ~10:00 Thursday and end at ~10:00 Friday.
     * A task at 12:00 Thursday will use offset 6 but, a task at 8:00 Friday will use offset 5.
     */
    const currentRiverRacePeriodIndex = (currentDay + 6) % 7;
    const formattedCurrentTime = getCurrentTime(currentDate);

    if(clanListCache == null || clanListCache.length == 0) {
      console.log(`${formattedCurrentTime} Skipping river race data collection, clanListCache is empty`);
      return;
    }

    if(Object.values(isRiverRaceDataSnapSaved).find(val => val == false) == undefined) {
      console.log(`${formattedCurrentTime} Skipping river race data collection, data has been updated to next day for all clans`);
      return;
    }

    try {
      const currentRiverRaceData = await Promise.all(clanListCache.map(clan => currentRiverRaceDataHelper.getCurrentRiverRaceData(clan)));
      currentRiverRaceData.forEach(({ data }) => {
        let clanRiverRaceDataSnap = {};
        if(data?.periodIndex % 7 != currentRiverRacePeriodIndex) {
          console.log(`${formattedCurrentTime} Skipping river race data collection for ${data?.clan?.tag}, periodIndex value was unexpected`)
          return;
        }
        clanRiverRaceDataSnap[data?.clan?.tag?.substring(1)] = {
          clan: data.clan,
          periodLogs: data.periodLogs,
          timestamp: currentDate.getTime()
        };
        const isDataSnapSavedSuccessfully = databaseRepository.setLastKnownBattleDayData(clanRiverRaceDataSnap, database);
        isRiverRaceDataSnapSaved[data?.clan?.tag] = isDataSnapSavedSuccessfully;
      });
    } catch(e) {
      console.error(e);
      console.log(`${formattedCurrentTime} river race data collection cron failed`);
      return;
    }
  });

  //CRON At every minute from 15 through 20 past hour 10 on Sunday, Monday, Friday, and Saturday [offset 6]
  cron.schedule('6 15-20 10 * * 0,1,5,6', async () => {
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

    try {
      const previousRiverRaceDataSnpashot = await databaseRepository.getLastKnownBattleDayData(database);
      const previousRiverRaceDataSnpashotValue = previousRiverRaceDataSnpashot.val();
      const endOfDayRiverRaceData = [];

      if([3, 4, 5].includes(previousRiverRacePeriodIndex)){
        const currentRiverRaceData = await Promise.all([ ...clanListCache.map(clan => currentRiverRaceDataHelper.getCurrentRiverRaceData(clan)) ]);
        currentRiverRaceData.forEach(({ data }) => {
          if(data.periodIndex % 7 == previousRiverRacePeriodIndex) {
            console.log(`${formattedCurrentTime} River race report generation, current data's period index suggests that war has not ended yet`);
            return;
          }
          data.clan?.participants?.forEach(participant => participant.decksUsed = participant.decksUsed - participant. decksUsedToday);
          endOfDayRiverRaceData.push({
            participants: data.clan?.participants,
            clanTag: data.clan?.tag
          });
        });
      }
      
      else if(previousRiverRacePeriodIndex == 6){
        const currentRiverRaceData = await Promise.all([ ...clanListCache.map(clan => riverRaceLogDataHelper.getRiverRaceLogData(clan)) ]);
        currentRiverRaceData.forEach(clanCurrentRiverRaceData => {
          clanMostRecentEntryInRiverRaceLogs = clanCurrentRiverRaceData.data.items.items[0];
          clanStandings = clanMostRecentEntryInRiverRaceLogs.standings.filter(clanStandings => clanListCache.includes(clanStandings.clan.tag));
          if(clanStandings.length == 0)
          return;
          // const createdDate = clanMostRecentEntryInRiverRaceLogs.createdDate;
          // TODO some validation
          endOfDayRiverRaceData.push({
            participants: clanStandings.clan?.participants,
            clanTag: clanStandings.clan?.tag
          });
        });
      }

      if(!clanListCache.every(cacheClanTag => endOfDayRiverRaceData.find(({ clanTag }) => clanTag == cacheClanTag))) {
        console.log(`${formattedCurrentTime} River race report generation, river race log doesn't have data for all clans`);
      }
      
      //Generate Report
      for (const [key, clanPreviousRiverRaceData] of Object.entries(previousRiverRaceDataSnpashotValue)) {
        if(isDailyReportSent[clanPreviousRiverRaceData.clan.tag]) {
          console.log(`${formattedCurrentTime} River race report for ${clanPreviousRiverRaceData.clan.tag} has already been sent`)
          continue;
        }
        const clanEndOfDayRiverRaceData = endOfDayRiverRaceData.find(({ clanTag }) => clanTag == clanPreviousRiverRaceData.clan.tag);
        
        //TODO check if return is needed
        if(clanEndOfDayRiverRaceData == undefined) {
          console.log(`${formattedCurrentTime} river race report generation cron failed, not able to match clans in previousSnap and current data returned from the API for ${clanPreviousRiverRaceData.clan.tag}`);
          return;
        }
        
        let currentClanMemberList = await membersDataHelper.getMembers(clanPreviousRiverRaceData?.clan?.tag);
        let participantList = clanPreviousRiverRaceData?.clan?.participants?.filter(participant => currentClanMemberList.data.items.find(member => member.tag == participant.tag));
        participantList.forEach(participant => {
          const currentParticipantData = clanEndOfDayRiverRaceData.participants.find(player => player.tag == participant.tag);
          if(currentParticipantData == undefined) {
            console.error(`${formattedCurrentTime} Unexpected: not able to find player in new river race data: ${participant.tag}`);
            return;
          }
          const unuesdDecks = 4 - (participant.decksUsedToday + currentParticipantData.decksUsed - participant.decksUsed);
          if(unuesdDecks < 0 || unuesdDecks > 4) {
            console.log(`${formattedCurrentTime} river race report generation cron failed, something wrong with the calculations, invalid value for unuesdDecks: ${unuesdDecks}, player: ${participant.name}, ID: ${participant.tag}`);
            return;
          }
          if(unuesdDecks != 0) {
            const reportPlayerData = {
              tag: participant.tag,
              name: participant.name,
              unusedDecks: unuesdDecks
            };
            let clanUnusedDecksReport = unusedDecksReport.find(e => e.clanTag == clanEndOfDayRiverRaceData.clanTag)
            if(clanUnusedDecksReport) {
              clanUnusedDecksReport.unusedDecksReport.push(reportPlayerData);
            }
            else {
              unusedDecksReport.push({
                clanTag: clanEndOfDayRiverRaceData.clanTag,
                unusedDecksReport: [reportPlayerData]
              });
            }
          }
        });
      }

      //Send Report
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
  });

  //Reset flags crons At minute 15, 30, and 45 past hour 11 on Sunday, Monday, Thursday, Friday, and Saturday [Offset 9]
  cron.schedule('9 15,30,45 11 * * 0,1,4,5,6', async () => {
    var currentdate = getCurrentTime();
    console.log(`Reset counts and flags at ${currentdate}`)
    isRiverRaceDataSnapSaved = clanListCache.reduce((obj, clanTag) => ({...obj, [clanTag]: false}), {});
    isDailyReportSent = clanListCache.reduce((obj, clanTag) => ({...obj, [clanTag]: false}), {});
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