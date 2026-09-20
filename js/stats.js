const GITHUB_LCS_URL = 'https://raw.githubusercontent.com/shivanshsanoria1/LeetcodeSolutions/main';
const PATH_LC_SOLVED_PROBLEM_LIST = '/util/web/generated/json-min/lc-solved-problems-list-min.json';

const PATH_LC_PROBLEM_LIST = '/backend/generated/json-min/lc-problem-list-min.json';
const PATH_LC_TOPIC_TAGS = '/backend/generated/json-min/lc-topic-tag-min.json';

let officialChartInstance = null;
let solvedChartInstance = null;
let tagsBarChartInstance = null;

// Removed "tags" from statsData since we fetch them directly now
const statsData = {
	official: { difficulty: { Easy: 0, Medium: 0, Hard: 0 }, category: {}, total: 0 },
	solved: { difficulty: { Easy: 0, Medium: 0, Hard: 0 }, category: {}, total: 0 }
};

let masterTagsList = []; // Stores the raw pre-sorted, pre-colored array from backend

const colorPalettes = {
	difficulty: {
		'Easy': '#2cbb5d',
		'Medium': '#ffc01e',
		'Hard': '#ef4743'
	},
	category: {
		'Algorithms': '#2cbb5d',
		'Database': '#0d6efd',
		'JavaScript': '#ffc01e',
		'Shell': '#6c757d',
		'Concurrency': '#d63384',
		'Pandas': '#a371f7',
		'pandas': '#a371f7'
	}
};

async function loadStats() {
	try {
		// Fetch all three JSON files concurrently
		const [masterRes, solvedRes, tagsRes] = await Promise.all([
			fetch(PATH_LC_PROBLEM_LIST),
			fetch(GITHUB_LCS_URL + PATH_LC_SOLVED_PROBLEM_LIST),
			fetch(PATH_LC_TOPIC_TAGS)
		]);

		if (!masterRes.ok || !solvedRes.ok || !tagsRes.ok) throw new Error("Failed to load problem or tag lists.");

		const masterProblems = await masterRes.json();
		const solvedProblems = await solvedRes.json();

		// Save the pre-formatted backend tags list globally
		masterTagsList = await tagsRes.json();

		const diffMap = {};
		const catMap = {};

		masterProblems.forEach(p => {
			// Processing for Doughnuts
			if (statsData.official.difficulty[p.difficulty] !== undefined) {
				statsData.official.difficulty[p.difficulty]++;
			}
			const cat = p.categoryTitle || 'Unknown';
			statsData.official.category[cat] = (statsData.official.category[cat] || 0) + 1;
			statsData.official.total++;

			diffMap[p.quesId] = p.difficulty;
			catMap[p.quesId] = cat;

			// Note: Topic tags aggregation removed! Backend handles it now.
		});

		solvedProblems.forEach(p => {
			if (p.isAccepted) {
				const diff = diffMap[p.quesId];
				const cat = catMap[p.quesId];

				if (diff && statsData.solved.difficulty[diff] !== undefined) {
					statsData.solved.difficulty[diff]++;
				}
				if (cat) {
					statsData.solved.category[cat] = (statsData.solved.category[cat] || 0) + 1;
				}
				statsData.solved.total++;
			}
		});

		document.getElementById('officialTotal').textContent = statsData.official.total.toLocaleString('en-US');
		document.getElementById('solvedTotal').textContent = statsData.solved.total.toLocaleString('en-US');

		const savedTab = sessionStorage.getItem('stats_active_tab') || 'difficulty';
		setActiveSidebarTab(savedTab);
		renderDashboard(savedTab);

	} catch (error) {
		console.error("Error loading stats:", error);
	}
}

// --- Doughnut Data Prep ---
function processChartData(dataObj, totalCount, type) {
	let entries = Object.entries(dataObj)
		.filter(([_, val]) => val > 0)
		.sort((a, b) => b[1] - a[1]);

	const labels = entries.map(e => e[0]);
	const realData = entries.map(e => e[1]);

	const minVisualFloor = totalCount * 0.015;
	const visualData = realData.map(val => Math.max(val, minVisualFloor));

	const bgColors = labels.map(label => colorPalettes[type][label] || '#6c757d');

	return { labels, realData, visualData, bgColors, totalCount };
}

// --- View Router ---
function renderDashboard(type) {
	const doughnutWrapper = document.getElementById('doughnut-wrapper');
	const barWrapper = document.getElementById('bar-wrapper');
	const title = document.getElementById('chart-main-title');

	if (type === 'tags') {
		doughnutWrapper.classList.add('d-none');
		barWrapper.classList.remove('d-none');
		title.textContent = 'Topic Tags Distribution';
		renderBarChart();
	} else {
		barWrapper.classList.add('d-none');
		doughnutWrapper.classList.remove('d-none');
		title.textContent = type === 'difficulty' ? 'Difficulty Distribution' : 'Problem Type Distribution';

		const off = processChartData(statsData.official[type], statsData.official.total, type);
		const sol = processChartData(statsData.solved[type], statsData.solved.total, type);

		renderDoughnutChart('officialChart', officialChartInstance, off);
		renderDoughnutChart('solvedChart', solvedChartInstance, sol);

		generateHTMLLegend('officialLegend', off);
		generateHTMLLegend('solvedLegend', sol);
	}
}

// --- Chart Renderers ---
function generateHTMLLegend(legendContainerId, dataPack) {
	const container = document.getElementById(legendContainerId);
	container.innerHTML = '';

	dataPack.labels.forEach((label, i) => {
		const color = dataPack.bgColors[i];
		const html = `
            <div class="d-flex align-items-center gap-2">
                <span style="display:inline-block; width: 36px; height: 12px; background-color: ${color}; border-radius: 2px;"></span>
                <span class="text-light small">${label}</span>
            </div>
        `;
		container.innerHTML += html;
	});
}

function renderDoughnutChart(canvasId, chartInstance, dataPack) {
	const ctx = document.getElementById(canvasId).getContext('2d');

	if (canvasId === 'officialChart' && officialChartInstance) officialChartInstance.destroy();
	if (canvasId === 'solvedChart' && solvedChartInstance) solvedChartInstance.destroy();

	const newChart = new Chart(ctx, {
		type: 'doughnut',
		data: {
			labels: dataPack.labels,
			datasets: [{
				data: dataPack.visualData,
				realData: dataPack.realData,
				totalCount: dataPack.totalCount,
				backgroundColor: dataPack.bgColors,
				borderWidth: 2,
				borderColor: '#0d1117',
				hoverOffset: 6
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			cutout: '65%',
			plugins: {
				legend: { display: false },
				title: { display: false },
				tooltip: {
					callbacks: {
						label: function (context) {
							const label = context.label || '';
							const realValue = context.dataset.realData[context.dataIndex];
							const total = context.dataset.totalCount;

							const percentage = ((realValue / total) * 100).toFixed(2);
							return ` ${label}: ${realValue.toLocaleString('en-US')} (${percentage}%)`;
						}
					}
				}
			}
		}
	});

	if (canvasId === 'officialChart') officialChartInstance = newChart;
	if (canvasId === 'solvedChart') solvedChartInstance = newChart;
}

function renderBarChart() {
	const scrollContainer = document.getElementById('bar-scroll-container');
	const ctx = document.getElementById('tagsBarChart').getContext('2d');

	// Extract strictly from the master list fetched from the backend, keeping exact order
	const labels = masterTagsList.map(tag => tag.name);
	const dataCounts = masterTagsList.map(tag => tag.freq);
	const bgColors = masterTagsList.map(tag => tag.color);

	// Dynamically set container height to enable scrolling (approx 25px per bar)
	const minHeight = labels.length * 25;
	scrollContainer.style.height = `${Math.max(minHeight, 500)}px`;

	if (tagsBarChartInstance) tagsBarChartInstance.destroy();

	tagsBarChartInstance = new Chart(ctx, {
		type: 'bar',
		data: {
			labels: labels,
			datasets: [{
				label: 'Frequency',
				data: dataCounts,
				backgroundColor: bgColors,
				borderRadius: 4,
				borderWidth: 1,
				borderColor: '#0d1117',
				minBarLength: 6 // Guarantees a minimum width in pixels for hoverability
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			indexAxis: 'y', // Horizontal
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						label: function (context) {
							return ` Frequency: ${context.parsed.x}`;
						}
					}
				}
			},
			scales: {
				x: {
					ticks: { color: '#c9d1d9' },
					grid: { color: '#30363d' },
					beginAtZero: true,
					position: 'top'
				},
				y: {
					ticks: { color: '#c9d1d9', autoSkip: false },
					grid: { display: false }
				}
			}
		}
	});
}

// --- UI Helpers ---
function setActiveSidebarTab(type) {
	document.querySelectorAll('.list-group-item').forEach(btn => {
		btn.classList.remove('text-primary', 'fw-semibold');
		btn.classList.add('text-light');
	});

	const activeBtn = document.getElementById(`btn-${type}`);
	if (activeBtn) {
		activeBtn.classList.remove('text-light');
		activeBtn.classList.add('text-primary', 'fw-semibold');
	}
}

// --- Event Listeners ---
document.getElementById('btn-difficulty').addEventListener('click', () => {
	sessionStorage.setItem('stats_active_tab', 'difficulty');
	setActiveSidebarTab('difficulty');
	renderDashboard('difficulty');
});

document.getElementById('btn-category').addEventListener('click', () => {
	sessionStorage.setItem('stats_active_tab', 'category');
	setActiveSidebarTab('category');
	renderDashboard('category');
});

document.getElementById('btn-tags').addEventListener('click', () => {
	sessionStorage.setItem('stats_active_tab', 'tags');
	setActiveSidebarTab('tags');
	renderDashboard('tags');
});

// Initialize
loadStats();