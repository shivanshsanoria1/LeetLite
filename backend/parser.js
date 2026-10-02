const path = require('node:path');
const fs = require('node:fs/promises')

const config = require('./config.json')
const helper = require('./helper.js')
const logger = require('./logger.js');
const timer = require('./timer.js')

const PARSE_ALL_JSON = config.PARSE_ALL_JSON ?? false // default is to not do full parsing

async function createJSONFilenameMap(mode = 'raw') {
	try {
		const dirPath = mode === 'parsed' ? helper.getDirPath('LCProblemsJSONParsed') : helper.getDirPath('LCProblemsJSONRaw')
		const filenames = await fs.readdir(dirPath);

		const filenameMapJSON = new Map();

		for (const filename of filenames) {
			if (!filename.endsWith(".json")) {
				logger.info(`Invalid filename in ${mode} JSON dir: ${filename}`)
				continue;
			}

			const quesId = Number(filename.split('.')[0])
			const titleSlug = filename.split('.')[1]

			filenameMapJSON.set(quesId, titleSlug)
		}

		return filenameMapJSON
	} catch (err) {
		throw err
	}
}

function parseRawProblem(baseProblems, problemRaw, mode = 'full') {
	try {
		const parseJSONString = (value, fallback = []) => {
			try {
				return typeof value === "string" ? JSON.parse(value) : value;
			} catch {
				return fallback;
			}
		};

		const findQuesIdFromSlug = (baseProblems, titleSlug) => Number(baseProblems.find(p => p.titleSlug === titleSlug)?.questionFrontendId ?? -1);

		const parsedProblemObj = {
			quesId: Number(problemRaw.questionFrontendId),
			title: problemRaw.title,
			titleSlug: problemRaw.titleSlug,
			difficulty: problemRaw.difficulty,
			isPaidOnly: problemRaw.isPaidOnly,
			categoryTitle: problemRaw.categoryTitle,
			stats: JSON.parse(problemRaw.stats),
			// similarQuestions: parseJSONString(problemRaw.similarQuestions).map(q => q.titleSlug),
			similarQuesIds: parseJSONString(problemRaw.similarQuestions)
				.map(({ titleSlug }) => findQuesIdFromSlug(baseProblems, titleSlug)),
			topicTags: problemRaw.topicTags ?? []
		};

		parsedProblemObj.stats.acRateRaw = problemRaw.acRate
		parsedProblemObj.stats.likes = problemRaw.likes
		parsedProblemObj.stats.dislikes = problemRaw.dislikes

		parsedProblemObj.meta = {
			quesIdLCBackend: Number(problemRaw.questionId),
			hasSolution: problemRaw.hasSolution,
			hasVideoSolution: problemRaw.hasVideoSolution,
		}

		if (mode === 'list') {
			return parsedProblemObj
		}

		parsedProblemObj.exampleTestcases = problemRaw.exampleTestcases
		parsedProblemObj.solution = {
			canSeeDetail: problemRaw.solution?.canSeeDetail ?? false,
			content: problemRaw.solution?.content
		}
		parsedProblemObj.content = problemRaw.content
		parsedProblemObj.hints = problemRaw.hints

		// timestamp of pulling the data from LC
		parsedProblemObj.LC_SYNC_ISO = problemRaw.LAST_UPDATED_ISO
		// timestamp of parsing
		parsedProblemObj.PARSED_ISO = timer.getTimestamp('ISO')

		return parsedProblemObj
	} catch (err) {
		throw err;
	}
}

async function parseRawProblems(baseProblems, rawJSONFilenameMap, parsedJSONFilenameMap, stats) {
	try {
		const problems = []
		let maxParsedQuesId = 0
		for (const [quesId, titleSlug] of rawJSONFilenameMap) {
			const filenameJSON = `${quesId}.${titleSlug}.json`
			const filePathJSONRaw = path.join(helper.getDirPath('LCProblemsJSONRaw'), filenameJSON)

			const problemRaw = await helper.readFromJSON(filePathJSONRaw)

			//needs to be parsed
			if (PARSE_ALL_JSON || !parsedJSONFilenameMap.get(quesId)) {
				const problem = parseRawProblem(baseProblems, problemRaw, 'full')

				const filePathJSON = path.join(helper.getDirPath('LCProblemsJSONParsed'), filenameJSON)
				await helper.writeToJSON(filePathJSON, problem)
			}

			const problem = parseRawProblem(baseProblems, problemRaw, 'list')
			maxParsedQuesId = Math.max(maxParsedQuesId, quesId)
			problems.push(problem)
		}

		problems.sort((a, b) => Number(a.quesId) - Number(b.quesId));
		stats.MAX_PARSED_QUES_ID = maxParsedQuesId
		logger.info(`MAX_PARSED_QUES_ID = ${stats.MAX_PARSED_QUES_ID}`)

		const filePathJSON = helper.getFilePath('LCProblemList')
		await helper.writeToJSON(filePathJSON, problems)

		const filePathJSONMin = helper.getFilePath('LCProblemListMin')
		await helper.writeToJSON(filePathJSONMin, problems, true)

		return problems
	} catch (err) {
		throw err;
	}
}

function assignVIBGYORColors(topicTags) {
	try {
		if (!topicTags || !topicTags.length) return [];

		const VIBGYOR = [
			'#a371f7', // Violet (Highest frequency)
			'#6610f2', // Indigo
			'#0d6efd', // Blue
			'#2cbb5d', // Green
			'#ffc01e', // Yellow
			'#fd7e14', // Orange
			'#ef4743'  // Red (Lowest frequency)
		];

		// 1. Group by frequency to count how many unique tags share each exact frequency count
		const freqCounts = {};
		let totalTags = topicTags.length;

		topicTags.forEach(tag => {
			freqCounts[tag.freq] = (freqCounts[tag.freq] || 0) + 1;
		});

		// 2. Sort unique frequencies in ASCENDING order (lowest first)
		const uniqueFreqs = Object.keys(freqCounts).map(Number).sort((a, b) => a - b);

		// 3. Allocate to 7 buckets dynamically (starting from Red)
		const colorMap = {};
		let currentBucket = VIBGYOR.length - 1;
		let currentItemsInBucket = 0;
		let remainingTags = totalTags;
		let remainingBuckets = VIBGYOR.length;
		let targetPerBucket = remainingTags / remainingBuckets;

		for (let i = 0; i < uniqueFreqs.length; i++) {
			const freq = uniqueFreqs[i];
			const count = freqCounts[freq];

			// Assign the current frequency to the current color bucket
			colorMap[freq] = VIBGYOR[currentBucket];
			currentItemsInBucket += count;

			// If bucket hits target size, move to the next color (towards Violet)
			if (currentItemsInBucket >= targetPerBucket && currentBucket > 0) {
				remainingTags -= currentItemsInBucket;
				remainingBuckets--;
				targetPerBucket = remainingTags / remainingBuckets;

				currentBucket--;
				currentItemsInBucket = 0;
			}
		}

		// 4. Construct the strictly formatted array
		const formattedTags = topicTags.map(tag => ({
			slug: tag.slug,
			name: tag.name,
			freq: tag.freq,
			color: colorMap[tag.freq]
		}));

		// 5. Sort: Highest frequency -> lowest frequency, tie-breaker: alphabetical slug
		formattedTags.sort((a, b) =>
			a.freq === b.freq
				? a.slug.localeCompare(b.slug)
				: b.freq - a.freq
		);

		return formattedTags;
	} catch (err) {
		throw err
	}
}

async function generateTopicTagsList(problems, stats) {
	try {
		let topicTagsList = []
		for (const { topicTags } of problems) {
			for (const { name, slug } of topicTags) {
				const topicTag = topicTagsList.find((topicTag) => topicTag.slug === slug)
				if (topicTag) {
					topicTag.freq++
				} else {
					topicTagsList.push({
						slug,
						name,
						freq: 1
					})
				}
			}
		}

		topicTagsList = assignVIBGYORColors(topicTagsList)

		stats.TOPIC_TAG_COUNT = topicTagsList.length
		logger.info(`TOPIC_TAG_COUNT = ${stats.TOPIC_TAG_COUNT}`)

		// save the readable json
		const filePath = helper.getFilePath('LCTopicTag')
		await helper.writeToJSON(filePath, topicTagsList)
		// save the minified json
		const filePathMin = helper.getFilePath('LCTopicTagMin')
		await helper.writeToJSON(filePathMin, topicTagsList, true)

		return topicTagsList
	} catch (err) {
		throw err
	}
}

async function main() {
	try {
		const startTime = Date.now();
		const scriptName = path.basename(__filename)
		logger.info('')
		logger.time(`${scriptName} running...`)
		logger.time('Open the logs file to see contiuous updates.')

		// 1. load the base problem list
		const baseProblemsPath = helper.getFilePath('LCBaseProblemList')
		const baseProblems = await helper.readFromJSON(baseProblemsPath)

		// 2. create a map of raw JSON files {quesId -> titleSlug}
		const rawJSONFilenameMap = await createJSONFilenameMap('raw')
		logger.info(`raw JSON file map first pair (after fetching new) = 1: ${rawJSONFilenameMap.get(1)}`)

		// 3. create a map of parsed JSON files {quesId -> titleSlug}
		const parsedJSONFilenameMap = await createJSONFilenameMap('parsed')
		logger.info(`raw JSON file map first pair = 1: ${parsedJSONFilenameMap.get(1)}`)

		// 4. load previous stats
		const statsJSONPath = helper.getFilePath('stats')
		const stats = await helper.readFromJSON(statsJSONPath, {})
		logger.info(`stats before update = ${JSON.stringify(stats)}`)

		// 5. parse the new batch of JSON and create a list from parsing
		const problems = await parseRawProblems(baseProblems, rawJSONFilenameMap, parsedJSONFilenameMap, stats)
		logger.info('Main Problem list length = ' + problems.length)
		logger.info('Main Problem at index 0 = ' + JSON.stringify(problems[0]))

		// 6. create topic tag map 
		const topicTags = await generateTopicTagsList(problems, stats)
		logger.info('Topic tag list size = ' + topicTags.length)
		logger.info('Topic tag at index 0 = ' + JSON.stringify(topicTags[0]))

		// 7. save updated stats
		await helper.writeToJSON(statsJSONPath, stats)
		logger.info(`Updated ${statsJSONPath}`)

		if (logger.getErrorCount() > 0) {
			console.log('Issue(s) found during execution: check logs')
		}

		const endTime = Date.now();
		logger.time(`${scriptName} completed.`)
		logger.time(`Time Taken to run ${scriptName} = ${(endTime - startTime).toLocaleString('en-US')} ms`);

	} catch (err) {
		console.error(err)
		logger.error(err)
	}
}

main()