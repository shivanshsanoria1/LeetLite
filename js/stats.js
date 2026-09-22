import {
	GITHUB_LCS_URL,
	PATH_LC_SOLVED_PROBLEM_LIST,
	PATH_LC_PROBLEM_LIST,
	PATH_LC_TOPIC_TAGS,
} from './config.js';

const HEATMAP_COLUMNS = 25; // Adjust this number to change grid density

let officialChartInstance = null;
let solvedChartInstance = null;
let tagsBarChartInstance = null;
let currentHeatmapMode = 'difficulty';

// Removed "tags" from statsData since we fetch them directly now
const statsData = {
	official: { difficulty: { Easy: 0, Medium: 0, Hard: 0 }, category: {}, total: 0 },
	solved: { difficulty: { Easy: 0, Medium: 0, Hard: 0 }, category: {}, total: 0 }
};

let masterTagsList = []; // Stores the raw pre-sorted, pre-colored array from backend
let globalMasterProblems = []; // NEW: Store raw list for heatmap

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

		globalMasterProblems = masterProblems.sort((a, b) => a.quesId - b.quesId);

		masterProblems.forEach(p => {
			// Processing for Doughnuts
			if (statsData.official.difficulty[p.difficulty] !== undefined) {
				statsData.official.difficulty[p.difficulty]++;
			}

			// FIX: Point to the new meta object location
			const cat = p.meta?.categoryTitle || p.categoryTitle || 'Unknown';

			statsData.official.category[cat] = (statsData.official.category[cat] || 0) + 1;
			statsData.official.total++;

			diffMap[p.quesId] = p.difficulty;
			catMap[p.quesId] = cat;
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

function renderDashboard(type) {
	const doughnutWrapper = document.getElementById('doughnut-wrapper');
	const barWrapper = document.getElementById('bar-wrapper');
	const heatmapWrapper = document.getElementById('heatmap-wrapper');
	const heatmapHeader = document.getElementById('heatmap-header');

	// Hide everything first
	doughnutWrapper.classList.add('d-none');
	barWrapper.classList.add('d-none');
	heatmapWrapper.classList.add('d-none');
	if (heatmapHeader) heatmapHeader.classList.add('d-none');

	if (type === 'tags') {
		barWrapper.classList.remove('d-none');
		renderBarChart();
	} else if (type === 'heatmap') {
		heatmapWrapper.classList.remove('d-none');
		if (heatmapHeader) heatmapHeader.classList.remove('d-none'); // Show combined header

		renderHeatmapLegend(currentHeatmapMode);
		renderHeatmap(currentHeatmapMode);
	} else {
		doughnutWrapper.classList.remove('d-none');

		const off = processChartData(statsData.official[type], statsData.official.total, type);
		const sol = processChartData(statsData.solved[type], statsData.solved.total, type);

		renderDoughnutChart('officialChart', officialChartInstance, off);
		renderDoughnutChart('solvedChart', solvedChartInstance, sol);

		generateHTMLLegend('officialLegend', off);
		generateHTMLLegend('solvedLegend', sol);
	}
}

function renderHeatmapLegend(mode) {
	const legendContainer = document.getElementById('heatmap-legend');
	const dataObj = statsData.official[mode];
	const palette = colorPalettes[mode];
	let html = '';

	// 1. Extract active data and sort by count (desc) -> slug (asc)
	const sortedEntries = Object.entries(dataObj)
		.filter(([_, count]) => count > 0) // Only show items that actually exist
		.sort((a, b) => {
			const countDiff = b[1] - a[1];
			if (countDiff !== 0) return countDiff;

			// Generate slugs for the tie-breaker (e.g., "Hash Table" -> "hash-table")
			const slugA = a[0].toLowerCase().replace(/\s+/g, '-');
			const slugB = b[0].toLowerCase().replace(/\s+/g, '-');
			return slugA.localeCompare(slugB);
		});

	// 2. Render the sorted legend
	sortedEntries.forEach(([key, count]) => {
		// Safely pull the color, checking both exact case and lowercase fallback
		const color = palette[key] || palette[key.toLowerCase()] || '#6c757d';

		html += `
            <div class="d-flex align-items-center gap-2">
                <span class="rounded-1 shadow-sm" style="width: 14px; height: 14px; background-color: ${color};"></span> 
                ${key} (${count.toLocaleString('en-US')})
            </div>
        `;
	});

	legendContainer.innerHTML = html;
}

function renderHeatmap(mode) {
	const container = document.getElementById('heatmap-container');
	container.style.gridTemplateColumns = `repeat(${HEATMAP_COLUMNS}, minmax(28px, 1fr))`;

	let htmlBuffer = '';

	globalMasterProblems.forEach(p => {
		let bgColor;

		if (mode === 'difficulty') {
			bgColor = colorPalettes.difficulty[p.difficulty] || '#6c757d';
		} else {
			// FIX: Point to the new meta object location
			const cat = p.meta?.categoryTitle || p.categoryTitle || 'Unknown';
			bgColor = colorPalettes.category[cat] || '#6c757d';
		}

		htmlBuffer += `
            <div class="heatmap-cell" 
                 style="background-color: ${bgColor};" 
                 title="${p.quesId}. ${p.title}">
                ${p.quesId}
            </div>
        `;
	});

	container.innerHTML = htmlBuffer;
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

document.getElementById('btn-heatmap').addEventListener('click', () => {
	sessionStorage.setItem('stats_active_tab', 'heatmap');
	setActiveSidebarTab('heatmap');
	renderDashboard('heatmap');
});

// Add this to your Event Listeners section at the bottom
document.getElementById('heatmap-color-select').addEventListener('change', (e) => {
	currentHeatmapMode = e.target.value;
	renderHeatmapLegend(currentHeatmapMode);
	renderHeatmap(currentHeatmapMode);
});

// Initialize
loadStats();