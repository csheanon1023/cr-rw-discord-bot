const membersDataHelper = require('../clash-royale-api-helpers/members-data-helper')

exports.getMembersByLevel = async (message, args, accessLevel) => {
  const clanCodes = {
    'rw': '#2PYUJUL',
    'hc': '#P9QQVJVG'
  };
  const memberRoles = await message.member.roles.cache;
  let flag = false;
  accessLevel.forEach(roleId => {
    if(memberRoles.get(roleId))
      flag = true;
  });
  if(!flag)
    return message.reply('Seems like you are not authorized to use this command!');
  if(args.length != 2)
    return message.reply('Please specify clan code and level!');
  if(args[1] < 1 || args[1] > 13)
    return message.reply('Level should be between 1-13!');
  if(!Object.keys(clanCodes)?.includes(args[0].toLowerCase()))
    return message.reply('Check the clan code!');
  const allPlayers = await membersDataHelper.getMembers(clanCodes[args[0]].substring(1));
  const filteredByLevel = membersDataHelper
                            .getMembersByLevel(allPlayers.data.items, args[1])
                            ?.map(member => member.name)
                            .join('\n');
  if(filteredByLevel == null || filteredByLevel == '')
    return message.reply(`There are no level ${args[1]} players`);
  return message.reply(`\n${filteredByLevel}`);
}