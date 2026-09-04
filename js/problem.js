// --- 1. Constants & State ---
const GITHUB_LCS_URL = 'https://raw.githubusercontent.com/shivanshsanoria1/LeetcodeSolutions/main';
const PATH_LC_PROBLEM_LIST = '/util/web/generated/json-min/lc-problem-list-min.json';
const PATH_JSON_DIR = '/util/web/generated/json';
const PATH_SOLVED_LIST = '/stats/lc-solved-problems-list.json';

const LC_ASSETS_BASE_URL = 'https://assets.leetcode.com/static_assets/media/original_images';
const LC_PROBLEM_BASE_URL = 'https://leetcode.com/problems';

// Initialize Highlight.js Copy Plugin Safely
if (window.hljs && typeof CopyButtonPlugin !== 'undefined') {
	hljs.addPlugin(new CopyButtonPlugin());
}

let currentProblemSolvedStats = null;
let currentProblemMasterData = null; // Stores global problem metadata for URL generation

// Elements
const codeViewer = document.getElementById('codeViewer');
let currentCode = ''; // Store the fetched code globally for the copy function

// --- 2. Resizer Logic ---
const resizer = document.getElementById('resizer');
const leftPane = document.getElementById('left-pane');
let isResizing = false;

resizer.addEventListener('mousedown', () => {
	isResizing = true;
	document.body.style.cursor = 'col-resize';
	document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
	if (!isResizing) return;
	const newWidth = Math.max(20, Math.min((e.clientX / window.innerWidth) * 100, 80));
	leftPane.style.width = `${newWidth}%`;
});

document.addEventListener('mouseup', () => {
	if (isResizing) {
		isResizing = false;
		document.body.style.cursor = 'default';
		document.body.style.userSelect = 'auto';
	}
});

// --- Helper Formatting ---
function getRateColor(rate) {
	if (rate >= 75) return 'color-green';
	if (rate >= 50) return 'color-yellow';
	return 'color-red';
}

function getDefaultLanguageForType(type) {
	if (type === 'general') return 'cpp';
	if (type === 'database') return 'mysql';
	if (type === 'javascript/typescript') return 'js';
	return '';
}

// --- 3. Data Fetching & UI Population ---
async function loadProblem() {
	const params = new URLSearchParams(window.location.search);
	const quesIdParam = params.get('quesId');

	if (!quesIdParam) {
		showError("No Problem ID specified in the URL.");
		return;
	}

	const quesId = Number(quesIdParam);

	try {
		// Step 1: Fetch master list
		const listResponse = await fetch(GITHUB_LCS_URL + PATH_LC_PROBLEM_LIST);
		if (!listResponse.ok) throw new Error("Failed to load master problem list.");
		const allProblems = await listResponse.json();

		currentProblemMasterData = allProblems.find(p => p.quesId === quesId);
		if (!currentProblemMasterData) throw new Error(`Problem ID ${quesId} not found.`);

		// Step 2: Fetch detailed JSON
		const detailUrl = `${GITHUB_LCS_URL}${PATH_JSON_DIR}/${quesId}.${currentProblemMasterData.titleSlug}.json`;
		const detailResponse = await fetch(detailUrl);

		if (!detailResponse.ok) throw new Error(`Failed to load details for problem ${quesId}.`);
		const data = await detailResponse.json();

		// Step 3: Fetch solved stats
		try {
			const solvedResponse = await fetch(GITHUB_LCS_URL + PATH_SOLVED_LIST);
			if (solvedResponse.ok) {
				const solvedList = await solvedResponse.json();
				currentProblemSolvedStats = solvedList.find(p => p.quesId === quesId);
			}
		} catch (e) {
			console.warn("Could not load solved problems stats.", e);
		}

		// Step 4: Populate DOM
		populateUI(data, allProblems);
		populateEditorToolbar();

		if (window.MathJax && window.MathJax.typesetPromise) {
			MathJax.typesetPromise();
		}

	} catch (err) {
		console.error('Error:', err);
		showError(err.message);
	}
}

// --- Helper Formatting ---
function parseOfficialSolution(markdownContent) {
	if (!markdownContent) return '<span class="text-muted">No solution available.</span>';

	let text = markdownContent;

	// 1. Remove the [TOC] (Table of Contents) marker
	text = text.replace(/\[TOC\]/gi, '');

	// 2. Skip the Video Solution section entirely
	// Account for both "## Solution Article" and "## Solution" variations
	const articleMarker = "## Solution Article";
	const altArticleMarker = "## Solution";

	if (text.includes(articleMarker)) {
		text = text.substring(text.indexOf(articleMarker));
	} else if (text.includes(altArticleMarker)) {
		// Drops prepended videos that lack the explicit "Video Solution" header
		text = text.substring(text.indexOf(altArticleMarker));
	} else {
		// Fallback regex if markers are completely missing
		text = text.replace(/##\s*Video Solution[\s\S]*?(?=##|$)/i, '');
	}

	// 3. Skip the Implementation Section
	// Matches "**Implementation**", "### Implementation", "#### Implementation", etc.
	// and explicitly removes everything until the next "Complexity" heading or end of string.
	text = text.replace(/(?:#+|\*\*)\s*Implementation[\s\S]*?(?=(?:#+|\*\*)\s*Complexity|$)/gi, '');

	// As a strict fallback, strip any remaining embedded iframes (Leetcode playgrounds)
	text = text.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');

	// 4. Fix Broken Image Links
	// Replaces all instances of "../Figures/" with the absolute LeetCode assets URL
	text = text.replace(/\.\.\/Figures\//gi, LC_ASSETS_BASE_URL + '/');

	// 5. Parse the remaining clean Markdown into HTML
	if (window.marked) {
		return marked.parse(text);
	}

	// Fallback if marked.js fails to load
	return `<pre style="white-space: pre-wrap; font-family: inherit;">${text}</pre>`;
}

function populateUI(data, allProblems) {
	document.getElementById('loading-spinner').style.display = 'none';
	document.getElementById('problem-content-wrapper').style.display = 'block';

	// Header & Meta 
	document.getElementById('prob-id').textContent = data.quesId;

	const star = data.isPaidOnly ? `<span class="text-warning ms-2" title="Premium">★</span>` : '';

	// Construct the official LeetCode URL using the titleSlug
	const lcProblemUrl = LC_PROBLEM_BASE_URL + `/${data.titleSlug}/description/`;

	// Format the sync time for the tooltip in dd-mmm-yyyy hh:mm:ss (UTC)
	let titleHtml = data.title;
	if (data.LAST_UPDATED_ISO) {
		const d = new Date(data.LAST_UPDATED_ISO);

		const day = String(d.getUTCDate()).padStart(2, '0');
		const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		const month = monthNames[d.getUTCMonth()];
		const year = d.getUTCFullYear();

		const hours = String(d.getUTCHours()).padStart(2, '0');
		const minutes = String(d.getUTCMinutes()).padStart(2, '0');
		const seconds = String(d.getUTCSeconds()).padStart(2, '0');

		const syncDate = `${day}-${month}-${year} ${hours}:${minutes}:${seconds} (UTC)`;

		// Append a clean info-circle SVG to the title
		titleHtml = `${data.title} 
            <span title="Last synced with LeetCode: ${syncDate}" style="cursor: pointer;" class="text-secondary align-middle ms-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle" viewBox="0 0 16 16">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                  <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
                </svg>
            </span>`;
	}

	// Create the external link SVG
	const extLink = `
        <a href="${lcProblemUrl}" target="_blank" class="text-secondary ms-2 hover-primary align-middle" title="Open in LeetCode">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-box-arrow-up-right" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
              <path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
            </svg>
        </a>`;

	// Append the formatted title, star (if paid), and the external link
	document.getElementById('prob-title').innerHTML = `${titleHtml} ${star} ${extLink}`;

	// --- Row 1: Difficulty, Likes, Dislikes, Like Rate ---
	const diffEl = document.getElementById('prob-difficulty');
	diffEl.textContent = data.difficulty;
	diffEl.className = `fw-bold diff-${data.difficulty}`;

	const likes = data.stats?.likes || 0;
	const dislikes = data.stats?.dislikes || 0;
	document.getElementById('prob-likes').textContent = likes;
	document.getElementById('prob-dislikes').textContent = dislikes;

	// Like Rate Calculation with Traffic Light Colors
	const totalVotes = likes + dislikes;
	const likeRate = totalVotes === 0 ? 0 : (likes / totalVotes) * 100;
	const likeRateDisplay = totalVotes === 0 ? "NA" : `${likeRate.toFixed(2)}%`;
	const likeRateElement = document.getElementById('prob-like-rate');
	if (likeRateElement) {
		likeRateElement.textContent = likeRateDisplay;
		likeRateElement.className = `fw-bold ${totalVotes === 0 ? 'text-secondary' : getRateColor(likeRate)}`;
	}

	// --- Row 2: Accepted, Submissions, Acceptance Rate, Category ---
	document.getElementById('prob-accepted').textContent = data.stats?.totalAccepted || '0';
	document.getElementById('prob-submissions').textContent = data.stats?.totalSubmission || '0';

	// Acceptance Rate with Traffic Light Colors
	const acRateRaw = data.stats?.acRateRaw || 0;
	const acRateElement = document.getElementById('prob-ac');
	if (acRateElement) {
		acRateElement.textContent = `${acRateRaw.toFixed(2)}%`;
		acRateElement.className = `fw-bold ${getRateColor(acRateRaw)}`;
	}

	const categoryEl = document.getElementById('prob-category');
	const categoryTitle = data.categoryTitle || 'Unknown';
	categoryEl.textContent = categoryTitle;
	// Replace solid grey bg with dark bg and apply the dynamic text color
	categoryEl.className = `badge bg-dark border border-secondary ms-2 ${getCategoryColor(categoryTitle)}`;

	// Main Description Content
	document.getElementById('prob-content').innerHTML = data.content || '<p>No description available.</p>';

	// Topic Tags
	const tagsContainer = document.getElementById('prob-tags');
	tagsContainer.innerHTML = (data.topicTags || []).map(t =>
		`<span class="badge bg-secondary opacity-75">${t.name}</span>`
	).join('') || '<span class="text-muted">None</span>';

	// Hints
	const hintsContainer = document.getElementById('hintsAccordion');
	hintsContainer.innerHTML = (data.hints || []).map((hint, i) => `
        <div class="accordion-item bg-dark border-secondary">
            <h2 class="accordion-header">
                <button class="accordion-button collapsed bg-dark text-light shadow-none" type="button" data-bs-toggle="collapse" data-bs-target="#collapseHint${i}">
                    Hint ${i + 1}
                </button>
            </h2>
            <div id="collapseHint${i}" class="accordion-collapse collapse" data-bs-parent="#hintsAccordion">
                <div class="accordion-body text-secondary">${hint}</div>
            </div>
        </div>
    `).join('') || '<div class="text-muted fs-6 p-2">No hints available.</div>';

	// Official Solution
	const solutionWrapper = document.getElementById('solution-wrapper');
	if (data.solution && data.solution.canSeeDetail && data.solution.content) {
		// Using our new parser function here
		document.getElementById('prob-solution-content').innerHTML = parseOfficialSolution(data.solution.content);
		solutionWrapper.style.display = 'block';
	} else {
		solutionWrapper.style.display = 'none';
	}

	// Similar Questions - Mapped, Sorted, and rendered as an Ordered List with Stars
	const similarContainer = document.getElementById('prob-similar-list');

	// Safely check for the new array
	if (data.similarQuesIds && data.similarQuesIds.length > 0) {
		const mappedSimilarProbs = data.similarQuesIds
			// Cast both to Number to prevent String vs Integer strict equality failures
			.map(id => allProblems.find(p => Number(p.quesId) === Number(id)))
			.filter(p => p !== undefined);

		// Cast to Number for the tie-breaker sort
		mappedSimilarProbs.sort((a, b) => Number(a.quesId) - Number(b.quesId));

		if (mappedSimilarProbs.length > 0) {
			similarContainer.innerHTML = `<ul class="list-unstyled mb-0 d-flex flex-column gap-2">` +
				mappedSimilarProbs.map(p => {
					const simStar = p.isPaidOnly ? `<span class="text-warning ms-1" title="Premium Problem">★</span>` : '';
					return `
                    <li>
                        <a href="problem.html?quesId=${p.quesId}" class="text-decoration-none text-light fw-semibold hover-primary">
                            ${p.quesId}. ${p.title} ${simStar}
                        </a>
                    </li>
                `}).join('') +
				`</ul>`;
		} else {
			similarContainer.innerHTML = '<span class="text-muted">None</span>';
		}
	} else {
		similarContainer.innerHTML = '<span class="text-muted">None</span>';
	}
}

// --- 4. Right Pane Editor Logic ---
function populateEditorToolbar() {
	const langSelect = document.getElementById('lang-select');
	const versionSelect = document.getElementById('version-select');

	if (currentProblemSolvedStats && currentProblemSolvedStats.counter) {
		const languages = Object.keys(currentProblemSolvedStats.counter);

		if (languages.length > 0) {
			langSelect.innerHTML = languages.map(lang => `<option value="${lang}">${lang}</option>`).join('');

			// Apply default language logic
			const expectedDefaultLang = getDefaultLanguageForType(currentProblemSolvedStats.type);
			if (languages.includes(expectedDefaultLang)) {
				langSelect.value = expectedDefaultLang;
			} else {
				langSelect.value = languages[0]; // fallback
			}

			populateVersions(langSelect.value);
			langSelect.disabled = false;
		} else {
			langSelect.innerHTML = '<option value="">-</option>';
			versionSelect.innerHTML = '<option value="">-</option>';
			langSelect.disabled = true;
			versionSelect.disabled = true;
		}
	} else {
		langSelect.innerHTML = '<option value="">-</option>';
		versionSelect.innerHTML = '<option value="">-</option>';
		langSelect.disabled = true;
		versionSelect.disabled = true;
	}

	// Event listeners trigger code fetch
	langSelect.addEventListener('change', (e) => {
		populateVersions(e.target.value);
		fetchAndDisplayCode();
	});

	versionSelect.addEventListener('change', fetchAndDisplayCode);

	// Initial Fetch
	fetchAndDisplayCode();
}

function populateVersions(lang) {
	const versionSelect = document.getElementById('version-select');

	if (currentProblemSolvedStats && currentProblemSolvedStats.counter[lang]) {
		const stats = currentProblemSolvedStats.counter[lang];
		// Calculate total versions (accepted + unaccepted)
		const totalVersions = (stats.accepted || 0) + (stats.unaccepted || 0);

		if (totalVersions > 0) {
			// Version dropdown values are strictly numeric
			versionSelect.innerHTML = Array.from({ length: totalVersions }, (_, i) =>
				`<option value="${i + 1}">${i + 1}</option>`
			).join('');
			versionSelect.disabled = false;
			versionSelect.value = "1"; // Auto-default to version 1
		} else {
			versionSelect.innerHTML = '<option value="">-</option>';
			versionSelect.disabled = true;
		}
	} else {
		versionSelect.innerHTML = '<option value="">-</option>';
		versionSelect.disabled = true;
	}
}

// --- 5. Code Fetching Logic ---
function generateCodeUrl(lang, version) {
	if (!currentProblemMasterData || !lang || !version) return null;

	const quesId = currentProblemMasterData.quesId;
	const titleSlug = currentProblemMasterData.titleSlug;

	let ext = lang.toLowerCase();
	let dirName = "";

	// 1. Resolve Directory Name & Extension based on Language
	if (ext === 'cpp') {
		// 500-problem range split ONLY for C++ (e.g., 0001-0500)
		const rangeStart = Math.floor((quesId - 1) / 500) * 500 + 1;
		const rangeEnd = rangeStart + 499;
		const padStart = String(rangeStart).padStart(4, '0');
		const padEnd = String(rangeEnd).padStart(4, '0');

		dirName = `CPP [${padStart}-${padEnd}]`;
	}
	else if (ext === 'js' || ext === 'javascript') {
		dirName = 'Javascript';
		ext = 'js'; // Ensure extension is .js
	}
	else if (ext === 'mysql') {
		dirName = 'MySQL';
		ext = 'sql'; // Map extension for MySQL
	}
	else {
		// Fallback for any other future languages
		dirName = lang.charAt(0).toUpperCase() + lang.slice(1);
		if (ext === 'python3' || ext === 'python') ext = 'py';
	}

	// 2. Construct the exact filename
	const fileName = `${quesId}.${titleSlug} [${version}].${ext}`;

	// 3. Encode URI components to safely handle spaces and brackets in GitHub URLs
	return `${GITHUB_LCS_URL}/${encodeURIComponent(dirName)}/${encodeURIComponent(fileName)}`;
}

// --- 5. Code Fetching Logic ---
async function fetchAndDisplayCode() {
	const lang = document.getElementById('lang-select').value;
	const version = document.getElementById('version-select').value;
	const container = document.getElementById('code-editor-container');
	const complexityBlock = document.getElementById('complexity-block');

	if (!container) return;

	const fallbackMsg = "Solution not found. Keep tuned for future release";

	// Hide complexity block initially while loading or if no selection
	if (complexityBlock) {
		complexityBlock.classList.remove('d-flex');
		complexityBlock.classList.add('d-none');
	}

	if (!lang || !version) {
		currentRawCode = '';
		container.innerHTML = `<div class="d-flex flex-column h-100 align-items-center justify-content-center text-secondary text-center p-4">
            <h5 class="mb-0">${fallbackMsg}</h5>
        </div>`;
		return;
	}

	container.innerHTML = `<div class="d-flex h-100 align-items-center justify-content-center text-secondary"><div class="spinner-border" role="status"></div></div>`;

	const codeUrl = generateCodeUrl(lang, version);

	try {
		const response = await fetch(codeUrl);
		if (!response.ok) {
			throw new Error(fallbackMsg);
		}

		const codeText = await response.text();
		currentRawCode = codeText;

		// --- Complexity Extraction Regex ---
		// Safely handles nested parentheses like O(n*log(n)) or O(V+E)
		const regexPattern = /=\s*(O\((?:[^()]+|\([^()]+\))*\))/i;

		const tcMatch = codeText.match(new RegExp(`T\\.?C\\.?\\s*${regexPattern.source}`, 'i'));
		const scMatch = codeText.match(new RegExp(`S\\.?C\\.?\\s*${regexPattern.source}`, 'i'));

		if (complexityBlock) {
			// Wrap the extracted string in $ delimiters for MathJax, or default to N/A
			const tcText = tcMatch ? `$${tcMatch[1]}$` : 'N/A';
			const scText = scMatch ? `$${scMatch[1]}$` : 'N/A';

			// Build the block content with Bootstrap success (green) text and no icon
			complexityBlock.innerHTML = `
                <span class="text-secondary">T.C: <span class="text-success fw-bold">${tcText}</span></span>
                <div class="vr text-secondary mx-1"></div>
                <span class="text-secondary">S.C: <span class="text-success fw-bold">${scText}</span></span>
            `;

			// Apply the warning tooltip and cursor directly to the entire block
			complexityBlock.title = "Complexity metrics are auto-extracted from code comments and may contain inaccuracies. Please verify manually.";
			complexityBlock.style.cursor = "pointer";

			complexityBlock.classList.remove('d-none');
			complexityBlock.classList.add('d-flex');

			// Tell MathJax to process the newly injected LaTeX in this specific block
			if (window.MathJax && window.MathJax.typesetPromise) {
				MathJax.typesetPromise([complexityBlock]).catch((err) => console.error('MathJax rendering failed:', err));
			}
		}
		// -----------------------------------

		// Escape HTML to prevent injection and rendering issues
		const escapedCode = codeText.replace(/</g, '&lt;').replace(/>/g, '&gt;');

		let hljsLang = lang.toLowerCase();
		if (hljsLang === 'mysql') hljsLang = 'sql';
		if (hljsLang === 'js') hljsLang = 'javascript';
		if (hljsLang === 'python3') hljsLang = 'python';

		container.innerHTML = `<pre class="m-0 h-100"><code class="language-${hljsLang} h-100" style="border-radius: 0; font-family: monospace; font-size: 14px;">${escapedCode}</code></pre>`;

		if (window.hljs) {
			hljs.highlightElement(container.querySelector('code'));
		}

	} catch (error) {
		currentRawCode = '';

		// Ensure complexity block remains hidden if code is not found
		if (complexityBlock) {
			complexityBlock.classList.remove('d-flex');
			complexityBlock.classList.add('d-none');
		}

		const errorMsg = error.message === fallbackMsg ? error.message : fallbackMsg;

		container.innerHTML = `<div class="d-flex flex-column h-100 align-items-center justify-content-center text-secondary text-center p-4">
            <h5 class="mb-0">${errorMsg}</h5>
        </div>`;
	}
}

// Handle Editor Toolbar Reset Button
const resetEditorBtn = document.getElementById('reset-editor-btn');
if (resetEditorBtn) {
	resetEditorBtn.addEventListener('click', () => {
		if (currentProblemSolvedStats && currentProblemSolvedStats.counter) {
			const langSelect = document.getElementById('lang-select');
			const languages = Object.keys(currentProblemSolvedStats.counter);
			const expectedDefaultLang = getDefaultLanguageForType(currentProblemSolvedStats.type);

			// Reset to default language if possible
			if (languages.includes(expectedDefaultLang)) {
				langSelect.value = expectedDefaultLang;
			} else if (languages.length > 0) {
				langSelect.value = languages[0];
			}

			// Populate versions, set to 1, and fetch
			populateVersions(langSelect.value);
			fetchAndDisplayCode();
		}
	});
}

function showError(msg) {
	document.getElementById('loading-spinner').style.display = 'none';
	const wrapper = document.getElementById('problem-content-wrapper');
	wrapper.style.display = 'block';
	wrapper.innerHTML = `<div class="alert alert-danger border-danger bg-dark text-danger">${msg}</div>`;
}

// Initialize
loadProblem();

function getCategoryColor(category) {
	if (!category) return 'text-secondary';
	const cat = category.toLowerCase();

	if (cat === 'algorithms') return 'color-green';
	if (cat === 'database') return 'color-blue';
	if (cat.includes('javascript') || cat.includes('typescript')) return 'color-yellow';

	return 'text-secondary'; // Fallback for any other categories
}

// 1. Function to fetch and display the code
async function loadSolutionCode(solutionUrl) {
	try {
		const response = await fetch(solutionUrl);

		// Throw an error if the file doesn't exist or we hit a 404
		if (!response.ok) {
			throw new Error(`Failed to fetch code: ${response.status}`);
		}

		currentCode = await response.text();
		codeViewer.textContent = currentCode;
	} catch (error) {
		// Handle the missing file explicitly
		currentCode = '';
		codeViewer.textContent = 'solution not available currently';
	}
}