# ershu (二十五) - Homebar Website

A modern, responsive static website for the ershu homebar, featuring a curated cocktail menu and Instagram integration.

## 🍸 Features

- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Modern UI**: Clean, elegant design with smooth animations
- **Interactive Menu**: Categorized drink menu with filtering
- **Instagram Integration**: Ready for Instagram feed integration
- **Contact Form**: Functional contact form with validation
- **SEO Optimized**: Meta tags and semantic HTML structure
- **Fast Loading**: Optimized images and minimal dependencies

## 🚀 Quick Start

### Local Development

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd ershu25
   ```

2. Open `index.html` in your browser or use a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```

3. Visit `http://localhost:8000` to view the website

### GitHub Pages Deployment

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository settings
   - Scroll to "Pages" section
   - Select "Deploy from a branch"
   - Choose "main" branch and "/ (root)" folder
   - Click "Save"

3. **Automatic Deployment**:
   - The GitHub Actions workflow will automatically deploy your site
   - Your site will be available at `https://yourusername.github.io/ershu25`

## 📁 Project Structure

```
ershu25/
├── index.html          # Main HTML file
├── styles.css          # CSS styles
├── script.js           # JavaScript functionality
├── logo.jpeg           # Homebar logo
├── 纽约第一深情.JPG      # Sample drink image
├── .github/
│   └── workflows/
│       └── deploy.yml  # GitHub Actions deployment
└── README.md           # This file
```

## 🎨 Customization

### Adding New Menu Items

1. Open `index.html`
2. Find the menu section with class `menu-category`
3. Add new menu items following this structure:

```html
<div class="menu-item">
    <div class="menu-item-image">
        <img src="your-image.jpg" alt="Drink name">
    </div>
    <div class="menu-item-content">
        <h3 class="item-name">Drink Name</h3>
        <p class="item-description">Description of the drink</p>
        <span class="item-price">¥XX</span>
    </div>
</div>
```

### Updating Instagram Integration

1. Get Instagram Basic Display API credentials
2. Update the Instagram username in `index.html` (search for `@ershu_homebar`)
3. Implement the Instagram API in `script.js` (see `loadInstagramFeed()` function)

### Styling Customization

- **Colors**: Update CSS custom properties in `styles.css`
- **Fonts**: Change the Google Fonts import in `index.html`
- **Layout**: Modify grid and flexbox properties in `styles.css`

## 📱 Mobile Optimization

The website is fully responsive and includes:
- Mobile-first design approach
- Touch-friendly navigation
- Optimized images for different screen sizes
- Hamburger menu for mobile devices

## 🔧 Technical Details

- **HTML5**: Semantic markup with accessibility features
- **CSS3**: Modern CSS with Flexbox and Grid
- **JavaScript**: Vanilla JS with no external dependencies
- **Performance**: Optimized images and minimal external resources
- **SEO**: Meta tags, structured data, and semantic HTML

## 🌐 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## 📞 Support

For questions or support regarding this website, please contact the ershu homebar team.

## 📄 License

This project is for the ershu homebar. All rights reserved.

---

**ershu (二十五)** - Crafting exceptional cocktail experiences 🍸