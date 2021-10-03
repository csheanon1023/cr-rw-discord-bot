exports.handleRoleAdd = (reaction, user, roleIds) => {
	const { name } = reaction.emoji;
	const member = reaction.message.guild.members.cache.get(user.id);
	switch (name) {
	case '1️⃣':
		member.roles.add(roleIds['#2PYUJUL'])
			.then(({ user: userDetails }) => {
				console.log(`added role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds['#2PYUJUL']).name} to ${userDetails.username}`);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to add clan 1 role to ${user.username}`);
			});
		break;
	case '2️⃣':
		member.roles.add(roleIds['#P9QQVJVG'])
			.then(({ user: userDetails }) => {
				console.log(`added role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds['#P9QQVJVG']).name} to ${userDetails.username}`);
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
		member.roles.remove(roleIds['#2PYUJUL'])
			.then(({ user: userDetails }) => {
				console.log(`removed role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds['#2PYUJUL']).name} from ${userDetails.username} `);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to remove clan 1 role from ${user.username}`);
			});
		break;
	case '2️⃣':
		member.roles.remove(roleIds['#P9QQVJVG'])
			.then(({ user: userDetails }) => {
				console.log(`removed role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds['#P9QQVJVG']).name} from ${userDetails.username}`);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to remove clan 2 role from ${user.username}`);
			});
		break;
	}
};
