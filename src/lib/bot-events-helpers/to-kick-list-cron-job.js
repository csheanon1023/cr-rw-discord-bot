const databaseRepository = require('../database-helpers/database-repository');
const currentRiverRaceDataHelper = require('../clash-royale-api-helpers/current-river-race-data-helper');
const riverRaceLogDataHelper = require('../clash-royale-api-helpers/river-race-log-data-helper');
const membersDataHelper = require('../clash-royale-api-helpers/members-data-helper');
const cron = require('node-cron');
const { getCurrentTime } = require('../utils/dateTimeUtils');

const clanListCache = [ '#2PYUJUL', '#P9QQVJVG' ];


// Mock data
const memberList = {
    "2PYUJUL" : {
      "clan" : "#2PYUJUL",
      "members" : [ "#PQVV898P2", "#GVQGRL9U", "#U80J98P2", "#8RL8C9YCJ", "#YV9JQYP08", "#22QUVQPGQ", "#8P89Q8Y9Y", "#GYUQV0J2J", "#G2C2YL2JR", "#PQ9G08C0", "#PL29G9Q92", "#Q0V9V2GGG", "#28V2GV2YY", "#YYRLRRV90", "#2G829C8P", "#RGQYUY9QQ", "#RUGJGGJR8", "#GQPQGUYJ2", "#8LVCYJUCY", "#9JRPG8999", "#9RQYCCQJ2", "#2QCCV9U", "#QVP0JRV0", "#GG9CQR8LY", "#Q0JJ99GYY", "#JR2RJYU8P", "#LVUY02VGR", "#28JRYR8L0", "#LLYV8UVUJ", "#8YY8U892G", "#RQPLUQC9C", "#QVCGQ0Q09", "#98UVG0CVP", "#2UUQ08PLV", "#G2QVG89YL", "#GGUCCLC0C", "#8QRVYJ99R", "#CP2GCUL", "#QP0J8CPYR", "#LRVLGYV0J", "#2QY00UPCY", "#LUJP2VUG8", "#90GP8GUCC", "#8G89VU9YC", "#CG22RLJ0", "#GUGUYUQYP", "#RCR088J28", "#28PPCCR2Y", "#PUP29VGR8" ]
    },
    "P9QQVJVG" : {
      "clan" : "#P9QQVJVG",
      "members" : [ "#YL9YY9Y8", "#9UVRC9LC0", "#99VUQP2VJ", "#QQ0GJ8UPV", "#280LYRYP", "#RR9YVJRUG", "#90G8LQGV8", "#GYYJ8VQ0", "#2Y0Q0UGCC", "#2Q8RVPC22", "#98Q0VCQLL", "#J2LL9P8L8", "#PJ9V2VGRQ", "#RGUJ000Q8", "#LQ08VURJG", "#LLQJ20UQV", "#RPUVR2VGG", "#8QP8Q8R0Y", "#RV9Y29Q00", "#2LLYG0UV", "#2U2JV0JUR", "#RRGJPPQL9", "#V8UVGJYV", "#J0ULRCVRJ", "#P8V2CGYV9", "#G9VR9LU0", "#LL98CRC88", "#90LQ0RQC9", "#QQP80JURP", "#RUUCL0R", "#J90CJ9VYY", "#22Y0JVC29", "#828VR002V", "#9URCVU9RC", "#Y8LCY00UQ", "#22YLUCGY9", "#QCULVGQQR", "#8UC0CQRVY", "#999CLCY2C", "#9Q90Y8CUU", "#PVQPL9GV8", "#RULJG0VG9", "#R808GC8LC", "#RPGLGRUU2", "#RJ8920LP9", "#92LJYYRJ2", "#RY9P8P0PJ" ]
    }
  };
    

const toKickPlayerTagsByClan = {
    '2PYUJUL': ['#PQVV898P2', '#GVQGRL9U', '#U80J98P2', '#8RL8C9YCJ', '#YV9JQYP08', '#22QUVQPGQ'],
    'P9QQVJVG': ['#YL9YY9Y8', '#9UVRC9LC0', '#99VUQP2VJ', '#QQ0GJ8UPV', '#280LYRYP', '#RR9YVJRUG'],
};

const kickingTeamMemberPendingKicks = {
    '#PQVV898P2': '#YV9JQYP08',
    '#U80J98P2': '#YV9JQYP08',
    '#YV9JQYP08': '#YV9JQYP08',
    '#22QUVQPGQ': '#LVUY02VGR',
    '#9UVRC9LC0': '#G9VR9LU0',
    '#99VUQP2VJ': '#RY9P8P0PJ',
    '#QQ0GJ8UPV': '#RY9P8P0PJ',
    '#RR9YVJRUG': '#G9VR9LU0',
};

const clanTeams = {
    '2PYUJUL': {
        'kicking': ['#YV9JQYP08', '#LVUY02VGR', '#2G829C8P'],
        'boat': ['#22QUVQPGQ', '#GQPQGUYJ2', '#2G829C8P'],
        'promotions': ['#8RL8C9YCJ', '#Q0JJ99GYY', '#2G829C8P'],
    },
    'P9QQVJVG': {
        'kicking': ['#RY9P8P0PJ', '#QCULVGQQR', '#G9VR9LU0'],
        'boat': ['#RY9P8P0PJ', '#QCULVGQQR', '#G9VR9LU0'],
        'promotions': ['#RY9P8P0PJ', '#QCULVGQQR', '#G9VR9LU0'],
    },
};

const onLeaveMembersByClan = [];

const scheduleCronToRefreshKickingBoardData = (database) => {
	// At every 5th minute [offset 15]
	cron.schedule('15 */5 * * * *', async () => {
		try {
            for (clanTag of clanListCache) {
                // TODO get from DB
                let clanToKickPlayerTagsByClan = toKickPlayerTagsByClan[clanTag.substring(1)];
                let clanKickingTeamMemberPendingKicks = kickingTeamMemberPendingKicks[clanTag.substring(1)];
                // validations
                let clanMemberList = memberList[clanTag.substring(1)];
                clanToKickPlayerTagsByClan = clanToKickPlayerTagsByClan.filter(playeTag => clanMemberList.includes(playeTag));

                // check in kicking team member pending kicks list if is assigned
                for (playerTag of clanToKickPlayerTagsByClan) {
                    if (kickingTeamMemberPendingKicks.hasOwnProperty(playeTag?.substring(1)))
                        continue;
                    const randomlyAssignedTeamMember = await findRandomTeamMemberToAssign(clanTeams[clantag]['kicking'], clanTag);
                    kickingTeamMemberPendingKicks[playeTag?.substring(1)] = randomlyAssignedTeamMember;
                }

                // update the DB


                // update the embed
                // clanToKickPlayerTagsByClan
            }			
		}
		catch (e) {
			console.error(e);
			console.log(`Something failed`);
			return false;
		}
	});
};

const findRandomTeamMemberToAssign = async (teamMembersTags, clanTag) => {
    try {	
        // TODO get members on leave
        let filteredTeamMembersTags = [];
        if (onLeaveMembersByClan?.length != 0) 
            filteredTeamMembersTags = teamMembersTags.filter(teamMemberTag => !onLeaveMembersByClan.includes(teamMemberTag));
        if (filteredTeamMembersTags?.length == 0)
            return teamMembersTags[Math.floor((Math.random() * 100) % teamMembersTags.length)];
        return filteredTeamMembersTags[Math.floor((Math.random() * 100) % filteredTeamMembersTags.length)];
    }
    catch (error) {
		console.error(`Something failed \n${error}`);
		return false;
    }
}

module.exports = { scheduleCronToRefreshKickingBoardData };