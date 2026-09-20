async function loadComponents() {
	// Determine relative depth to support both local Live Server and GitHub Pages
	const isInHtmlDir = window.location.pathname.includes('/html/');
	const basePath = isInHtmlDir ? '../' : './';

	// 1. Load Navbar
	const navPlaceholder = document.getElementById('navbar-placeholder');
	if (navPlaceholder) {
		try {
			// Update fetch path to be dynamically relative
			const response = await fetch(`${basePath}components/navbar.html`);
			if (!response.ok) throw new Error('Failed to fetch navbar');

			navPlaceholder.innerHTML = await response.text();

			// --- Dynamically adjust relative navbar paths ---
			navPlaceholder.querySelectorAll('a').forEach(link => {
				const href = link.getAttribute('href');
				if (!href || href.startsWith('http')) return;

				if (isInHtmlDir) {
					if (href === 'index.html') {
						link.setAttribute('href', '../index.html');
					} else if (href.startsWith('html/')) {
						link.setAttribute('href', href.replace('html/', ''));
					}
				}
			});

			// --- Navbar Highlighting Logic ---
			const currentPath = window.location.pathname;
			if (!currentPath.endsWith('index.html') && currentPath !== '/' && !currentPath.endsWith('/')) {
				const navLinks = document.querySelectorAll('#nav-links .nav-link');
				navLinks.forEach(link => {
					const linkHref = link.getAttribute('href');
					if (linkHref && currentPath.includes(linkHref)) {
						link.classList.add('text-warning');
					}
				});
			}
		} catch (error) {
			console.error("Error loading navbar:", error);
		}
	}

	// 2. Load Footer
	const footerPlaceholder = document.getElementById('footer-placeholder');
	if (footerPlaceholder) {
		try {
			// Update fetch path to be dynamically relative
			const response = await fetch(`${basePath}components/footer.html`);
			if (!response.ok) throw new Error('Failed to fetch footer');
			footerPlaceholder.innerHTML = await response.text();
		} catch (error) {
			console.error("Error loading footer:", error);
		}
	}
}

// Call the function when the DOM is ready
document.addEventListener('DOMContentLoaded', loadComponents);