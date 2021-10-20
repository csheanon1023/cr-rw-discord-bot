const { MessageEmbed } = require('discord.js');


const createSyntaxErrorHelpEmbed = (syntax, argumentList, usages) => {
	const syntaxErrorHelpEmbed = new MessageEmbed()
		.setColor('#00fafa')
		.setTitle('Syntax Helper')
		.setDescription('Looks like you are using the wrong syntax, hope this will help.')
		.setTimestamp();

	if (syntax)
		syntaxErrorHelpEmbed.addField('Syntax', `\`\`\`${syntax}\`\`\``, false);

	if (Object.keys(argumentList).length > 0) {
		const argumentFieldValues = Object.keys(argumentList).reduce((argumentFieldValuesAccumulator, argument) => {
			return [...argumentFieldValuesAccumulator, `\`${argument}\` - ${argumentList[argument]?.message} ${argumentList[argument]?.isOptional && '`optional`'}`];
		}, []);
		syntaxErrorHelpEmbed.addField('Argument List', argumentFieldValues.join('\n'), false);
		// for (const argument in argumentList) {
		// 	const argumentFieldValue = `\`${argument}\` - ${argumentList[argument]?.message} ${argumentList[argument]?.isOptional && '`optional`'}`;
		// 	argumentFieldValues.push(argumentFieldValues);
		// 	syntaxErrorHelpEmbed.addField(`\`${argument}\``, `${argumentList[argument]?.message} ${argumentList[argument]?.isOptional && '`optional`'}`, false);
		// }
	}

	if (Object.keys(usages).length > 0) {
		const usageFieldValues = Object.keys(usages).reduce((usageFieldValuesAccumulator, usage) => {
			return [...usageFieldValuesAccumulator, `**${usages[usage]?.useCase}**\n\`\`\`${usages[usage]?.syntax}\`\`\``];
		}, []);
		syntaxErrorHelpEmbed.addField('Usage', usageFieldValues.join('\n'), false);
	}

	// if (Object.keys(usages).length > 0) {
	// 	syntaxErrorHelpEmbed.addField('Usages', 'for now some text', false);
	// 	for (const usage in usages) {
	// 		syntaxErrorHelpEmbed.addField(`${usages[usage]?.useCase}`, `\`${usages[usage]?.syntax}\``, false);
	// 	}
	// }

	return syntaxErrorHelpEmbed;
};

module.exports = { createSyntaxErrorHelpEmbed };