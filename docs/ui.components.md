### Login / Account Icon
• Filename: /icons/driven-login-icon.png
• Purpose: Universal login/account indicator
• Placement: Top-right corner of header on every page
• Behavior:
  - If user is not logged in → redirect to /login
  - If user is logged in → open small dropdown with “Logout”
• Size: 22×22 px
• Style:
  - Dark gray (#333)
  - Circle containing head-and-shoulders silhouette
  - Transparent background
• CSS class:
.login-icon {
  width: 22px;
  height: 22px;
  cursor: pointer;
}
