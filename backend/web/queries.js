const queries = {
	'LC_Base_Problem_List': `
		query allQuestions {
			allQuestions {
				questionFrontendId
				title
				titleSlug
				difficulty
				isPaidOnly
				acRate
				topicTags {
					name
					slug
				}
			}
		}
	`,
	'LC_Problem_Detailed': `
		query getQuestionPublicData($titleSlug: String!) {
			question(titleSlug: $titleSlug) {
				questionId
				questionFrontendId
				title
				titleSlug
				difficulty
				likes
				dislikes
				acRate
				isPaidOnly
				categoryTitle
				companyTagStats
				hasSolution
				hasVideoSolution
				stats
				similarQuestions
				content
				hints
				exampleTestcases
				solution {
					canSeeDetail
					content
				}
				topicTags {
					name
					slug
				}
				codeSnippets {
					lang
					langSlug
					code
				}
			}
		}
	`
}

module.exports = queries