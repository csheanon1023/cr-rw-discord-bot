exports.handleRoleAdd = (reaction, user, roleIds) => {
	const { name } = reaction.emoji;
	const member = reaction.message.guild.members.cache.get(user.id);
	switch (name) {
	case '1️⃣':
		member.roles.add(roleIds['#2PYUJUL'])
			.then(({ user: userDetails }) => {
				console.log(`added role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds[0]).name} to ${userDetails.username}`);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to add clan 1 role to ${user.username}`);
			});
		break;
	case '2️⃣':
		member.roles.add(roleIds['#P9QQVJVG'])
			.then(({ userDetails }) => {
				console.log(`added role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds[1]).name} to ${userDetails.username}`);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to add clan 2 role to ${user.username}`);
			});
		break;
	}
};

exports.handleRoleRemove = (reaction, user, roleIds) => {
	const { name } = reaction.emoji;
	const member = reaction.message.guild.members.cache.get(user.id);
	console.log(`${user.username} removed reaction ${name}`);
	switch (name) {
	case '1️⃣':
		member.roles.remove(roleIds[0])
			.then(({ userDetails }) => {
				console.log(`removed role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds[0]).name} from ${userDetails.username} `);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to remove clan 1 role from ${user.username}`);
			});
		break;
	case '2️⃣':
		member.roles.remove(roleIds[1])
			.then(({ userDetails }) => {
				console.log(`removed role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds[1]).name} from ${userDetails.username}`);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to remove clan 2 role from ${user.username}`);
			});
		break;
	}
};
