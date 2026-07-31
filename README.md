# ⚡ Mun Light Electricals & Electronics Accessories Wholesaler

Welcome to the official web repository for **Mun Light Electricals Accessories Wholesaler**, located in Neemuch, Madhya Pradesh. This repository hosts a lightweight, high-performance, single-page wholesale store catalog along with a password-protected admin management console backed dynamically by Google Sheets and Google Apps Script.

---

## 🌟 Key Features

### 🛒 Customer Storefront (`index.html` & `store.js`)
* **Live Catalog Synchronization**: Real-time CSV sync directly from Google Sheets for fast item lookups.
* **Multi-Media Stage & Lightbox**: Supports multiple high-res product photos and embedded `.mp4` video clips per item with a full-screen interactive zoom/pan viewer.
* **Wholesale & Retail MRP Pricing**: Clearly displays wholesale prices alongside cross-out retail MRP values.
* **Minimum Order Quantity (MOQ) Rules**: Enforces item-level MOQ restrictions during ordering.
* **Dynamic Average Ratings & Reviews**: Calculates and displays customer ratings in real time.
* **Interactive WhatsApp Order Builder**: Compiles selected bulk order quantities into a pre-formatted WhatsApp message for direct store inquiries.
* **Catalog Filtering & Search**: Category dropdown filter, favorite items wishlist, and instant keyword search.

### 🛡️ Admin Management Console (`admin.html` & `admin.js`)
* **Secure Login Authorization**: Password-protected entrance backed by backend verification.
* **Catalog Inventory Management**: Add, edit, or delete items (title, category, wholesale price, retail MRP, available stock, MOQ, and multi-media URLs).
* **Smart Product ID Generator**: Built-in SKU auto-suggester with real-time duplicate ID validation.
* **Advanced Filtering & Sorting**: Filter inventory by Category, Stock Status (In Stock / Out of Stock), or Sort by Price, Name, and Stock Level.
* **Automated Email Invoicing**: Generates and emails rich HTML order invoices complete with a dynamic UPI QR Code payment scanner.

---

Can be accessed using - 
1. Store Front: https://munlight-electricals.netlify.app/

Looks like -
<img width="1910" height="984" alt="image" src="https://github.com/user-attachments/assets/56d7a7cd-606a-4ff3-be51-d7de5372f566" />

2. Admin Panel: https://munlight-electricals.netlify.app/admin.html

Looks like -
<img width="1901" height="980" alt="image" src="https://github.com/user-attachments/assets/66beba62-1ad2-4e5e-adb0-022f912615f5" />

## 📂 Repository Structure

```text
MunLight/
├── index.html        # Public-facing wholesale catalog markup
├── store.js          # Storefront logic, cart rules & gallery viewer
├── admin.html        # Protected Admin Console markup
├── admin.js          # Admin dashboard, item management & passcode auth
└── README.md         # Project documentation
