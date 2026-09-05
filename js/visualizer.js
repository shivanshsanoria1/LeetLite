const GITHUB_LCS_URL = 'https://raw.githubusercontent.com/shivanshsanoria1/LeetcodeSolutions/main';
const PATH_LC_PROBLEM_LIST = '/util/web/generated/lc-problem-list.json';

let problemMap = new Map();
let currentRootId = null;
let clickTimeout = null;

const searchInput = document.getElementById('quesIdInput');
const searchBtn = document.getElementById('searchGraphBtn');
const errorMsg = document.getElementById('search-error');
const container = document.getElementById('nodesContainer');
const svg = document.getElementById('svgEdges');
const viewport = document.getElementById('graphContainer');
const rootDetails = document.getElementById('root-details');

async function initGraph() {
	try {
		const res = await fetch(GITHUB_LCS_URL + PATH_LC_PROBLEM_LIST);
		if (!res.ok) throw new Error("Could not load problem list");

		const allProblems = await res.json();
		allProblems.forEach(p => problemMap.set(Number(p.quesId), p));

		if (problemMap.has(1)) renderGraph(1);
	} catch (err) {
		console.error("Graph initialization failed:", err);
	}
}

function getRateColor(rate) {
	if (rate >= 75) return 'color-green';
	if (rate >= 50) return 'color-yellow';
	return 'color-red';
}

function getCategoryColor(category) {
	if (!category) return 'text-secondary';
	const cat = category.toLowerCase();

	if (cat === 'algorithms') return 'color-green';
	if (cat === 'database') return 'color-blue';
	if (cat.includes('javascript') || cat.includes('typescript')) return 'color-yellow';

	return 'text-secondary';
}

let errorTimeout = null; // Add this near your other let declarations at the top

// --- Search & Input Validation ---
function handleSearch() {
	const val = searchInput.value.trim();
	if (!val) return;

	// Check if input is exactly a positive integer
	if (!/^[1-9]\d*$/.test(val)) {
		errorMsg.textContent = "invalid ques id";
		errorMsg.classList.remove('d-none');

		if (errorTimeout) clearTimeout(errorTimeout);
		errorTimeout = setTimeout(() => {
			errorMsg.classList.add('d-none');
		}, 5000);

		searchInput.value = ''; // Clear the bar even on invalid input
		return;
	}

	renderGraph(Number(val));
	searchInput.value = '';
}

// --- Render Graph Logic ---
function renderGraph(rootId) {
	const rootData = problemMap.get(Number(rootId));

	if (!rootData) {
		// Reset the error text to the default before displaying
		errorMsg.textContent = "Problem not found.";
		errorMsg.classList.remove('d-none');

		if (errorTimeout) clearTimeout(errorTimeout);
		errorTimeout = setTimeout(() => {
			errorMsg.classList.add('d-none');
		}, 5000);

		return;
	}

	// If successful, clear error state
	if (errorTimeout) clearTimeout(errorTimeout);
	errorMsg.classList.add('d-none');

	currentRootId = rootId;
	populateSidePanel(rootData);

	container.innerHTML = '';
	svg.innerHTML = '';

	const width = viewport.clientWidth;
	const height = viewport.clientHeight;
	const centerX = width / 2;
	const centerY = height / 2;
	const radius = Math.min(centerX, centerY) * 0.55;

	createNode(rootData, centerX, centerY, centerX, centerY, true);

	const neighbours = (rootData.similarQuesIds || [])
		.map(id => problemMap.get(Number(id)))
		.filter(p => p !== undefined);

	const total = neighbours.length;

	neighbours.forEach((prob, i) => {
		const angle = (i * 2 * Math.PI) / total - (Math.PI / 2);
		const nodeX = centerX + radius * Math.cos(angle);
		const nodeY = centerY + radius * Math.sin(angle);

		const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		line.setAttribute('x1', centerX);
		line.setAttribute('y1', centerY);
		line.setAttribute('x2', centerX);
		line.setAttribute('y2', centerY);
		line.setAttribute('class', 'edge-line');
		svg.appendChild(line);

		createNode(prob, centerX, centerY, nodeX, nodeY, false);

		setTimeout(() => {
			line.setAttribute('x2', nodeX);
			line.setAttribute('y2', nodeY);
		}, 10);
	});
}

// --- Side Panel Population ---
function populateSidePanel(data) {
	rootDetails.classList.remove('d-none');

	document.getElementById('det-id').textContent = data.quesId;
	document.getElementById('det-title-link').href = `problem.html?quesId=${data.quesId}`;

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

		titleHtml = `${data.title} 
            <span title="Last synced with LeetCode: ${syncDate}" style="cursor: help;" class="text-secondary align-middle ms-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle" viewBox="0 0 16 16">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                  <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
                </svg>
            </span>`;
	}
	document.getElementById('det-title').innerHTML = titleHtml;

	// Row 1
	const diffEl = document.getElementById('det-difficulty');
	diffEl.textContent = data.difficulty;
	diffEl.className = `fw-bold diff-${data.difficulty}`;

	const categoryEl = document.getElementById('det-type');
	const categoryTitle = data.meta?.categoryTitle || data.categoryTitle || 'Unknown';
	categoryEl.textContent = categoryTitle;
	categoryEl.className = `fw-bold badge bg-dark border border-secondary ${getCategoryColor(categoryTitle)}`;

	// Row 2
	const likes = data.stats?.likes || 0;
	const dislikes = data.stats?.dislikes || 0;
	document.getElementById('det-likes').textContent = likes;
	document.getElementById('det-dislikes').textContent = dislikes;

	const totalVotes = likes + dislikes;
	const likeRate = totalVotes === 0 ? 0 : (likes / totalVotes) * 100;
	const likeRateEl = document.getElementById('det-like-rate');
	likeRateEl.textContent = totalVotes === 0 ? "NA" : `${likeRate.toFixed(2)}%`;
	likeRateEl.className = `fw-bold ${totalVotes === 0 ? 'text-secondary' : getRateColor(likeRate)}`;

	// Row 3: Accepted, Submissions, Acceptance Rate
	const acceptedEl = document.getElementById('det-accepted');
	acceptedEl.textContent = data.stats?.totalAccepted || '0';
	acceptedEl.title = `Accepted: ${Number(data.stats?.totalAcceptedRaw || 0).toLocaleString('en-US')}`;
	acceptedEl.style.cursor = 'help';

	const submissionsEl = document.getElementById('det-submissions');
	submissionsEl.textContent = data.stats?.totalSubmission || '0';
	submissionsEl.title = `Submissions: ${Number(data.stats?.totalSubmissionRaw || 0).toLocaleString('en-US')}`;
	submissionsEl.style.cursor = 'help';

	const acRateRaw = data.stats?.acRateRaw || 0;
	const acRateEl = document.getElementById('det-ac');
	acRateEl.textContent = `${acRateRaw.toFixed(2)}%`;
	acRateEl.className = `fw-bold ${getRateColor(acRateRaw)}`;

	// Row 4 (Solutions)
	const hasSol = data.meta?.hasSolution || false;
	const solEl = document.getElementById('det-has-solution');
	solEl.textContent = hasSol ? 'Yes' : 'No';
	solEl.className = `fw-bold ${hasSol ? 'text-primary' : 'text-secondary'}`;

	const hasVid = data.meta?.hasVideoSolution || false;
	const vidEl = document.getElementById('det-has-video');
	vidEl.textContent = hasVid ? 'Yes' : 'No';
	vidEl.className = `fw-bold ${hasVid ? 'text-primary' : 'text-secondary'}`;

	// Topic Tags
	const tagsContainer = document.getElementById('det-tags');
	tagsContainer.innerHTML = (data.topicTags || []).map(t =>
		`<span class="badge bg-secondary opacity-75">${t.name}</span>`
	).join('') || '<span class="text-muted">None</span>';
}

// --- Node Creation with Lock ---
function createNode(prob, startX, startY, endX, endY, isRoot) {
	const el = document.createElement('div');
	el.className = `node-card border-${prob.difficulty} diff-${prob.difficulty} ${isRoot ? 'node-root' : ''}`;
	el.style.left = `${startX}px`;
	el.style.top = `${startY}px`;
	el.textContent = prob.quesId;

	const titleText = isRoot ? `${prob.title} (Double-click to open)` : prob.title;
	el.setAttribute('data-title', titleText);

	// Add Lock for Premium Problems
	if (prob.isPaidOnly) {
		const lock = document.createElement('div');
		lock.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-lock-fill" viewBox="0 0 16 16">
              <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2z"/>
            </svg>`;
		lock.className = 'position-absolute text-warning bg-dark rounded-circle d-flex align-items-center justify-content-center p-1';
		lock.style.top = '-10px';
		lock.style.right = '-10px';
		lock.style.pointerEvents = 'none';
		el.appendChild(lock);
	}

	el.addEventListener('click', () => {
		if (clickTimeout) {
			clearTimeout(clickTimeout);
			clickTimeout = null;
			if (isRoot) window.open(`problem.html?quesId=${prob.quesId}`, '_blank');
		} else {
			clickTimeout = setTimeout(() => {
				clickTimeout = null;
				if (!isRoot) renderGraph(prob.quesId);
			}, 250);
		}
	});

	container.appendChild(el);

	if (!isRoot) {
		setTimeout(() => {
			el.style.left = `${endX}px`;
			el.style.top = `${endY}px`;
		}, 10);
	}

	return el;
}

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
	if (e.key === 'Enter') handleSearch();
});

window.addEventListener('resize', () => {
	if (currentRootId) renderGraph(currentRootId);
});

initGraph();