const { MessageEmbed } = require('discord.js');

// TODO add fields can be improved maybe
const createSyntaxErrorHelpEmbed = (syntax, argumentList, usages) => {
	const syntaxErrorHelpEmbed = new MessageEmbed()
		.setColor('#00fafa')
		.setTitle('Syntax Helper')
		.setDescription('Looks like you are using the wrong syntax, hope this will help.')
		.setTimestamp();

	if (syntax)
		syntaxErrorHelpEmbed.addField('Syntax', `\`\`\`\n${syntax}\n\`\`\``, false);

	if (Object.keys(argumentList).length > 0) {
		const argumentFieldValues = Object.keys(argumentList).reduce((argumentFieldValuesAccumulator, argument) => {
			return [...argumentFieldValuesAccumulator, `\`${argument}\` - ${argumentList[argument]?.message} ${argumentList[argument]?.isOptional && '`optional`'}`];
		}, []);
		syntaxErrorHelpEmbed.addField('Argument List', argumentFieldValues.join('\n'), false);
	}

	if (Object.keys(usages).length > 0) {
		const usageFieldValues = Object.keys(usages).reduce((usageFieldValuesAccumulator, usage) => {
			return [...usageFieldValuesAccumulator, `**${usages[usage]?.useCase}**\n\`\`\`\n${usages[usage]?.syntax}\n\`\`\``];
		}, []);
		syntaxErrorHelpEmbed.addField('Usage', usageFieldValues.join('\n'), false);
	}

	return syntaxErrorHelpEmbed;
};

// TODO move this to apt directory once discord libs are setup
const sendEmbedsGroupedByTargetChannelIds = (client, embedsGroupedByTargetChannelIds) => {
	const getChannelPromises = Object.keys(embedsGroupedByTargetChannelIds)?.map(channelId => client.channels.fetch(channelId));
	return Promise.all(getChannelPromises).then(channels => {
		const sendMessagesPromises = channels.reduce((sendPromises, channel) => {
			return [...sendPromises, ...embedsGroupedByTargetChannelIds[channel.id]?.map(embed => channel.send(embed))];
		}, []);
		return Promise.all(sendMessagesPromises)
			.then(() => true)
			.catch(error => console.error(error.message));
	});
};

module.exports = {
	createSyntaxErrorHelpEmbed,
	sendEmbedsGroupedByTargetChannelIds,
};