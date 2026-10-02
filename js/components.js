async function loadComponents() {
	const isInHtmlDir = window.location.pathname.includes('/html/');

	// Dynamically point to the new nested directory structure
	const componentsPath = isInHtmlDir ? './components/' : './html/components/';

	// 1. Load Navbar
	const navPlaceholder = document.getElementById('navbar-placeholder');
	if (navPlaceholder) {
		try {
			// Update fetch path to use the new componentsPath
			const response = await fetch(`${componentsPath}navbar.html`);
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
						// Strips "html/" prefix so sibling files link correctly
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
			// Update fetch path to use the new componentsPath
			const response = await fetch(`${componentsPath}footer.html`);
			if (!response.ok) throw new Error('Failed to fetch footer');
			footerPlaceholder.innerHTML = await response.text();
		} catch (error) {
			console.error("Error loading footer:", error);
		}
	}
}

// Call the function when the DOM is ready
document.addEventListener('DOMContentLoaded', loadComponents);