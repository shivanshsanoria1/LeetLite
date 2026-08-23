async function loadComponents() {
	// 1. Load Navbar
	const navPlaceholder = document.getElementById('navbar-placeholder');
	if (navPlaceholder) {
		try {
			const response = await fetch('./components/navbar.html');
			if (!response.ok) throw new Error('Failed to fetch navbar');
			navPlaceholder.innerHTML = await response.text();
		} catch (error) {
			console.error("Error loading navbar:", error);
		}
	}

	// 2. Load Footer
	const footerPlaceholder = document.getElementById('footer-placeholder');
	if (footerPlaceholder) {
		try {
			const response = await fetch('./components/footer.html');
			if (!response.ok) throw new Error('Failed to fetch footer');
			footerPlaceholder.innerHTML = await response.text();
		} catch (error) {
			console.error("Error loading footer:", error);
		}
	}
}

// Call the function immediately or attach to DOMContentLoaded
document.addEventListener('DOMContentLoaded', loadComponents);