// gives the local timestamp by default, use 'ISO' to get the ISOString
function getTimestamp(zone = 'local') {
	const now = new Date();

	if (String(zone).toUpperCase() === 'ISO') {
		return now.toISOString();
	}

	// Local system time
	const pad = (n) => String(n).padStart(2, "0");

	return (
		`${now.getFullYear()}-` +
		`${pad(now.getMonth() + 1)}-` +
		`${pad(now.getDate())}T` +
		`${pad(now.getHours())}:` +
		`${pad(now.getMinutes())}:` +
		`${pad(now.getSeconds())}.` +
		`${String(now.getMilliseconds()).padStart(3, "0")}`
	);
}

function getYYYYMMDD() {
	const now = new Date();

	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');

	return `${year}-${month}-${day}`;
}

function getFileSafeISOTimestamp() {
	return new Date().toISOString().replace(/[:.]/g, '-');
}

function getUTCTimestamp(timezone = 'GMT') {
	const isIST = timezone === 'IST';
	const timeZone = isIST ? 'Asia/Kolkata' : 'UTC';
	const zone = isIST ? 'IST' : 'GMT';

	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
		timeZoneName: 'longOffset'
	}).formatToParts(new Date());

	const get = (type) => parts.find(p => p.type === type)?.value;

	const offset = get('timeZoneName')
		.replace(':', '')
		.replace('GMT', 'GMT');

	return `${get('day')} ${get('month')} ${get('year')} ` +
		`${get('hour')}:${get('minute')}:${get('second')} ` +
		`${offset} (${zone})`;
}

module.exports = {
	getTimestamp,
	getYYYYMMDD,
	getFileSafeISOTimestamp,
	getUTCTimestamp
}