const getCurrentTime = (currentDate = new Date()) => {
	const datetime = 'Last Sync: ' + currentDate.getDate() + '/'
                               + (currentDate.getMonth() + 1) + '/'
                               + currentDate.getFullYear() + ' @ '
                               + currentDate.getHours() + ':'
                               + currentDate.getMinutes() + ':'
                               + currentDate.getSeconds();
	return datetime;
};

const convertCrTimeStampsToDateObject = (timestamp) => {
	return isValidCrTimestamp(timestamp) ? new Date(convertCrTimeStampsToDateString(timestamp)) : false;
};

const isValidCrTimestamp = (timestamp) => {
	return isNaN(Date.parse(convertCrTimeStampsToDateString(timestamp)));
};

const convertCrTimeStampsToDateString = (timestamp) => {
	return `${timestamp.substring(0, 4)}-${timestamp.substring(4, 6)}-${timestamp.substring(6, 11)}:${timestamp.substring(11, 13)}:${timestamp.substring(13)}`;
};

const timePassedBetweenTwoMillisecondTimestamps = (msTimestamp, currentTimestamp) => {
	const timePassed = (currentTimestamp - msTimestamp) / 604800000;
	if (timePassed < 0) return '0d';
	return Math.floor(timePassed) == 0 ? `${Math.floor(timePassed * 7)}d` : `${Math.round(timePassed)}w`;
};

module.exports = {
	getCurrentTime,
	convertCrTimeStampsToDateObject,
	isValidCrTimestamp,
	convertCrTimeStampsToDateString,
	timePassedBetweenTwoMillisecondTimestamps,
};